import { LIMITS, words, sentences, paragraphs } from './engine.js';
import { scoreText, createReport } from './detector.js';
import { rewriteLocally } from './rewrite-local.js';
import { diffWords } from './diff.js';
import { docxToText } from './docx.js';
import { samples } from './samples.js';
import { strings, numberLocale } from './i18n.js';

const lang = document.documentElement.lang === 'hi' ? 'hi' : 'en';
const t = strings(lang);
const fmt = n => Number(n).toLocaleString(numberLocale(lang));

const $ = id => document.getElementById(id);
const input = $('text-input');
const panel = $('results-panel');
const content = $('result-content');
const ACTIONS = ['detect', 'humanize', 'grammar', 'simplify', 'summarize', 'count'];
const DRAFT_KEY = 'free-ai-detector:draft';

/* ---------- state ---------- */
let action = ACTIONS.includes(document.body.dataset.action) ? document.body.dataset.action : 'detect';
let revision = 0;      // bumps whenever the input or tool changes; stale async results are dropped
let fileRevision = 0;
let pending = null;    // AbortController for an in-flight model request
let provider = null;   // 'openai' | 'workers-ai' | null (offline rules)
let beforeSample = null;
let countTimer = 0;

/* ---------- small DOM helpers ---------- */
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  node.append(...children.filter(c => c !== null && c !== undefined));
  return node;
}
const SVG_NS = 'http://www.w3.org/2000/svg';
function icon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#icon-${name}`);
  svg.append(use);
  return svg;
}
function saveText(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = el('a', { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function copyText(text, button) {
  const original = button.dataset.label || button.lastChild.textContent;
  button.dataset.label = original;
  try { await navigator.clipboard.writeText(text); button.lastChild.textContent = t.copied; }
  catch { button.lastChild.textContent = t.copyFailed; }
  setTimeout(() => { button.lastChild.textContent = original; }, 2200);
}
const status = text => { $('result-status').textContent = text; };
function showError(message) { $('input-error').textContent = message; $('input-error').hidden = false; input.setAttribute('aria-invalid', 'true'); }
function clearError() { $('input-error').hidden = true; input.removeAttribute('aria-invalid'); }

// The draft lives in this tab's session storage so a reload or a move to another tool page keeps it.
// It is cleared when the tab closes and is never sent anywhere.
function saveDraft() { try { if (input.value) sessionStorage.setItem(DRAFT_KEY, input.value); else sessionStorage.removeItem(DRAFT_KEY); } catch { /* storage unavailable */ } }
function loadDraft() { try { return sessionStorage.getItem(DRAFT_KEY) || ''; } catch { return ''; } }

/* ---------- validation (localized; the server validates again) ---------- */
function problemWith(text) {
  if (!text.trim()) return t.errEmpty;
  if (action === 'detect' || action === 'count') {
    if (text.length > LIMITS.maxChars) return t.errTooLong(fmt(LIMITS.maxChars), fmt(text.length));
    return words(text).length ? null : t.errNoWords;
  }
  if (text.length > LIMITS.rewriteMaxChars) return t.errTooLong(fmt(LIMITS.rewriteMaxChars), fmt(text.length));
  const n = words(text).length;
  if (n < LIMITS.rewriteMinWords) return t.errMinWords(LIMITS.rewriteMinWords);
  if (n > LIMITS.rewriteMaxWords) return t.errMaxWords(fmt(LIMITS.rewriteMaxWords), fmt(n));
  return null;
}

/* ---------- idle and loading states ---------- */
function renderEmpty() {
  const [title, body] = t.empty[action];
  content.replaceChildren(el('div', { class: 'empty-result' }, el('div', { class: 'empty-art', 'aria-hidden': 'true' }, icon(action === 'detect' ? 'shield' : 'spark')), el('p', { class: 'empty-title', text: title }), el('p', { text: body })));
}
function renderLoading(title, body) {
  content.replaceChildren(el('div', { class: 'empty-result' }, el('div', { class: 'spinner', 'aria-hidden': 'true' }), el('p', { class: 'empty-title', text: title }), el('p', { text: body })));
}
function setBusy(busy) {
  panel.setAttribute('aria-busy', String(busy));
  $('run').disabled = busy;
}

/* ---------- tool switching ---------- */
const providerName = () => provider === 'openai' ? 'OpenAI' : provider === 'workers-ai' ? 'Cloudflare Workers AI' : null;
function describeMode() {
  $('result-label').textContent = t.label[action];
  $('run-label').textContent = t.run[action];
  if (action === 'detect') {
    $('guidance').textContent = t.guideScore(fmt(LIMITS.maxChars));
    $('engine-note').textContent = t.noteScore; $('mode-disclosure').textContent = t.discScore;
  } else if (action === 'count') {
    $('guidance').textContent = t.guideCount;
    $('engine-note').textContent = t.noteCount; $('mode-disclosure').textContent = t.discCount;
  } else {
    $('guidance').textContent = t.guideRewrite(LIMITS.rewriteMinWords, fmt(LIMITS.rewriteMaxWords), fmt(LIMITS.rewriteMaxChars));
    $('engine-note').textContent = provider ? t.noteModel(providerName()) : t.noteOffline;
    $('mode-disclosure').textContent = provider ? t.discModel(providerName()) : t.discOffline;
  }
}
function invalidate() {
  revision++;
  pending?.abort(); pending = null;
  setBusy(false);
  if (action === 'count' && words(input.value).length) { renderCounts(); return; }
  status(t.ready);
  renderEmpty();
}
function setAction(next) {
  action = next;
  for (const tab of document.querySelectorAll('.tabs button')) tab.setAttribute('aria-pressed', String(tab.dataset.action === action));
  describeMode();
  clearError();
  invalidate();
}

/* ---------- input handling ---------- */
function updateCount() {
  const n = words(input.value).length;
  $('count').textContent = `${t.words(fmt(n))} · ${t.characters(fmt(input.value.length))}`;
}
function inputChanged() {
  clearError();
  clearTimeout(countTimer);
  countTimer = setTimeout(() => { updateCount(); saveDraft(); }, 120);
  invalidate();
}
function setInput(text) { input.value = text; inputChanged(); updateCount(); saveDraft(); input.focus(); }

input.addEventListener('input', () => { fileRevision++; inputChanged(); });
input.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); $('run').click(); } });
$('clear').addEventListener('click', () => { fileRevision++; beforeSample = null; $('undo-sample').hidden = true; setInput(''); });
$('paste').addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) { showError(t.errClipboardEmpty); return; }
    fileRevision++; setInput(text.slice(0, LIMITS.maxChars));
    if (text.length > LIMITS.maxChars) showError(t.errTrimmed(fmt(LIMITS.maxChars)));
  } catch { showError(t.errClipboardBlocked); input.focus(); }
});
for (const [id, key] of [['human-sample', 'human'], ['ai-sample', 'ai']]) $(id).addEventListener('click', () => {
  fileRevision++;
  if (beforeSample === null) beforeSample = input.value;
  $('undo-sample').hidden = !beforeSample;
  setInput(samples[key]);
});
$('undo-sample').addEventListener('click', () => { if (beforeSample === null) return; fileRevision++; const text = beforeSample; beforeSample = null; $('undo-sample').hidden = true; setInput(text); });

$('upload').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = '';
  if (!file) return;
  const current = ++fileRevision;
  const name = file.name.toLowerCase();
  const kind = name.endsWith('.pdf') ? 'pdf' : name.endsWith('.docx') ? 'docx' : /\.(txt|md)$/.test(name) ? 'text' : null;
  if (!kind) { showError(t.errFileType); return; }
  const limit = kind === 'pdf' ? LIMITS.maxPdfBytes : LIMITS.maxFileBytes;
  if (file.size > limit) { showError(t.errFileSize(Math.round(limit / 1000000))); return; }
  try {
    const buffer = await file.arrayBuffer();
    let text;
    if (kind === 'docx') text = await docxToText(buffer);
    else if (kind === 'pdf') {
      status(t.readingPdf);
      const { pdfToText } = await import('./pdf.js');
      text = (await pdfToText(buffer, { maxPages: LIMITS.maxPdfPages, maxChars: LIMITS.maxChars * 2 })).text;
    } else {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, '');
      if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)) throw new Error('binary');
    }
    if (current !== fileRevision) return;
    if (!text.trim()) { status(t.ready); showError(kind === 'pdf' ? t.errPdf : t.errFileEmpty); return; }
    beforeSample = null; $('undo-sample').hidden = true;
    setInput(text.slice(0, LIMITS.maxChars));
    if (text.length > LIMITS.maxChars) showError(t.errTrimmed(fmt(LIMITS.maxChars)));
  } catch {
    if (current !== fileRevision) return;
    status(t.ready);
    showError(kind === 'docx' ? t.errDocx : kind === 'pdf' ? t.errPdf : t.errText);
  }
});

/* ---------- word counter ---------- */
const stat = (label, value) => el('div', {}, el('dt', { text: label }), el('dd', { text: String(value) }));
function duration(wordCount, perMinute) {
  const seconds = Math.round(wordCount / perMinute * 60);
  return t.minutes(Math.floor(seconds / 60), seconds % 60);
}
function renderCounts() {
  const text = input.value;
  const tokens = words(text);
  const lengths = sentences(text).map(s => s.words.length).filter(Boolean);
  const unique = new Set(tokens.map(w => w.toLowerCase())).size;
  const average = lengths.length ? (tokens.length / lengths.length).toFixed(1) : '0';
  content.replaceChildren(el('div', { class: 'result-section' }, el('h4', { text: t.counts }), el('dl', { class: 'stats' },
    stat(t.statWords, fmt(tokens.length)), stat(t.statChars, fmt(text.length)), stat(t.statCharsNoSpaces, fmt(text.replace(/\s/g, '').length)),
    stat(t.statSentences, fmt(lengths.length)), stat(t.statParagraphs, fmt(paragraphs(text).length)), stat(t.statUnique, fmt(unique)),
    stat(t.statAverage, t.wordsUnit(average)), stat(t.statLongest, t.wordsUnit(lengths.length ? Math.max(...lengths) : 0)),
    stat(t.statReading, duration(tokens.length, 200)), stat(t.statSpeaking, duration(tokens.length, 130)))));
  status(t.live);
}

/* ---------- detection results ---------- */
function renderScore(result) {
  const circumference = 2 * Math.PI * 52;
  const ring = document.createElementNS(SVG_NS, 'svg');
  ring.setAttribute('viewBox', '0 0 124 124'); ring.setAttribute('aria-hidden', 'true');
  for (const kind of ['track', 'value']) {
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', '62'); circle.setAttribute('cy', '62'); circle.setAttribute('r', '52'); circle.setAttribute('class', kind);
    if (kind === 'value') {
      circle.setAttribute('stroke-dasharray', circumference.toFixed(1));
      circle.setAttribute('stroke-dashoffset', (circumference * (1 - result.score / 100)).toFixed(1));
      circle.setAttribute('stroke-linecap', 'round');
    }
    ring.append(circle);
  }
  const tone = `tone-${result.bandKey}`;
  const band = t.band[result.bandKey] || result.band;
  const confidence = t.conf[result.confidence] || result.confidence;
  const card = el('div', { class: 'score-card' },
    el('div', { class: `ring ${tone}`, role: 'img', 'aria-label': t.ringAria(result.score) }, ring,
      el('div', { class: 'ring-number' }, el('span', { text: String(result.score) }), el('small', { text: t.ringLabel }))),
    el('div', { class: 'score-text' },
      el('h3', { class: tone, text: band }),
      el('p', {}, el('span', { class: 'confidence', text: `${t.confidence}: ${confidence}. ` }), t.confNote[result.confidenceKey] || result.confidenceNote),
      el('p', { text: `${t.languageCheck}: ${t.language[result.language] || result.language}.` })));

  const signals = el('div', { class: 'result-section' }, el('h4', { text: t.why }));
  if (!result.signals.length) signals.append(el('p', { class: 'caveat', text: t.noSignals }));
  for (const signal of result.signals) {
    const pct = Math.round(signal.strength * 100);
    const level = pct >= 65 ? 'tone-high' : pct >= 35 ? 'tone-medium' : 'tone-low';
    const fill = el('i'); fill.style.width = `${pct}%`;
    signals.append(el('div', { class: 'signal' },
      el('span', { class: 'signal-name', text: t.signal[signal.id] || signal.label }),
      el('span', { class: `signal-bar ${level}`, 'aria-hidden': 'true' }, fill),
      el('span', { class: `signal-value ${level}`, text: String(pct), title: t.scale }),
      el('p', { class: 'signal-detail', text: `${signal.detail}. ${t.hint[signal.id] || signal.hint}` })));
  }
  if (t.detailNote && result.signals.length) signals.append(el('p', { class: 'caveat', text: t.detailNote }));

  // Reasons are shown in a line under the text, so they work on touch screens and with a keyboard, not only on hover.
  const reasonLine = el('p', { class: 'reason-line', role: 'status', text: t.reasonPrompt });
  const view = el('div', { class: 'sentence-view', 'aria-label': t.sentenceView });
  let selected = null;
  const showReason = (span, reasons) => {
    selected?.classList.remove('is-selected'); selected = span; span.classList.add('is-selected');
    reasonLine.textContent = t.reasonPrefix + (reasons.join(', ') || t.reasonNeutral);
  };
  for (const sentence of result.sentences) {
    if (sentence.level !== 'high' && sentence.level !== 'medium') { view.append(sentence.text); continue; }
    const span = el('span', { class: `lvl-${sentence.level}`, tabindex: '0', role: 'button', text: sentence.text });
    for (const type of ['click', 'focus', 'mouseenter']) span.addEventListener(type, () => showReason(span, sentence.reasons));
    view.append(span);
  }
  const flaggedAny = result.sentences.some(s => s.level === 'high' || s.level === 'medium');
  const sentenceSection = el('div', { class: 'result-section' }, el('h4', { text: t.sentenceView }),
    el('div', { class: 'legend' }, el('span', { class: 'lg-high', text: t.legendHigh }), el('span', { class: 'lg-medium', text: t.legendMedium }), el('span', { text: t.legendNone })),
    view, flaggedAny ? reasonLine : null);

  const s = result.stats;
  const stats = el('div', { class: 'result-section' }, el('h4', { text: t.counts }), el('dl', { class: 'stats' },
    stat(t.statWords, fmt(s.wordCount)), stat(t.statSentences, fmt(s.sentenceCount)), stat(t.statParagraphs, fmt(s.paragraphCount)),
    stat(t.statAverage, t.wordsUnit(s.averageSentenceLength)), stat(t.statUnique, fmt(s.uniqueWords)), stat(t.statFlagged, fmt(result.flaggedSentences))));

  const copyButton = el('button', { type: 'button', class: 'button' }, icon('copy'), t.copySummary);
  copyButton.addEventListener('click', () => copyText(t.summaryLine(result.score, band, confidence), copyButton));
  const footer = el('div', { class: 'result-section' }, el('p', { class: 'caveat', text: t.limitation || result.limitation }),
    el('div', { class: 'actions no-print' },
      el('button', { type: 'button', class: 'button', onclick: () => window.print() }, icon('download'), t.print),
      el('button', { type: 'button', class: 'button', onclick: () => saveText(createReport(result), 'ai-detector-report.txt') }, icon('download'), t.download),
      copyButton,
      el('button', { type: 'button', class: 'button strong', onclick: () => { setAction('humanize'); $('run').click(); } }, icon('spark'), t.humanizeThis)));

  content.replaceChildren(card, signals, sentenceSection, stats, footer);
  content.scrollTop = 0;
  status(t.scoreReady);
}

/* ---------- rewrite results ---------- */
function renderRewrite(original, output, meta, ran) {
  const box = el('div', { class: 'rewrite-output', tabindex: '0', 'aria-label': t.result });
  const showClean = () => { box.replaceChildren(output); };
  const showChanges = () => {
    box.replaceChildren(...diffWords(original, output).map(run => run.type === 'same' ? run.text : el(run.type === 'add' ? 'ins' : 'del', { text: run.text })));
  };
  const cleanButton = el('button', { type: 'button', 'aria-pressed': 'true', text: t.result });
  const changesButton = el('button', { type: 'button', 'aria-pressed': 'false', text: t.changes });
  cleanButton.addEventListener('click', () => { cleanButton.setAttribute('aria-pressed', 'true'); changesButton.setAttribute('aria-pressed', 'false'); showClean(); });
  changesButton.addEventListener('click', () => { cleanButton.setAttribute('aria-pressed', 'false'); changesButton.setAttribute('aria-pressed', 'true'); showChanges(); });
  showClean();

  const head = el('div', { class: 'rewrite-meta' },
    el('span', { class: 'chip', text: meta.engine }),
    el('span', { text: `${fmt(words(original).length)} → ${t.words(fmt(words(output).length))}` }),
    el('div', { class: 'view-toggle', role: 'group', 'aria-label': t.chooseView }, cleanButton, changesButton));

  const copyButton = el('button', { type: 'button', class: 'button strong' }, icon('copy'), t.copy);
  copyButton.addEventListener('click', () => copyText(output, copyButton));
  const actions = el('div', { class: 'actions' }, copyButton,
    el('button', { type: 'button', class: 'button', onclick: () => saveText(output, `${ran}-result.txt`) }, icon('download'), t.downloadTxt),
    el('button', { type: 'button', class: 'button', onclick: () => { fileRevision++; setAction('detect'); setInput(output); $('run').click(); } }, icon('shield'), t.checkThis));

  const notes = [];
  if (meta.warning) notes.push(el('p', { class: 'notice warn', text: meta.warning }));
  if (meta.note) notes.push(el('p', { class: 'notice', text: meta.note }));
  notes.push(el('p', { class: 'notice', text: t.compare }));

  content.replaceChildren(head, box, actions, ...notes);
  content.scrollTop = 0;
  status(output === original ? t.noChanges : t.revisionReady);
}

async function modelRewrite(text, ran, current) {
  const controller = new AbortController(); pending = controller;
  const timer = setTimeout(() => controller.abort(), 50000);
  try {
    const response = await fetch('/api/rewrite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, action: ran }), signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || t.modelFailed);
    if (typeof data.text !== 'string' || !data.text.trim()) throw new Error(t.modelFailed);
    return data.text;
  } catch (error) {
    if (current !== revision) throw error;
    throw new Error(error.name === 'AbortError' ? t.modelTimeout : error.message || t.modelFailed);
  } finally { clearTimeout(timer); if (pending === controller) pending = null; }
}

/* ---------- run ---------- */
const paint = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0))); // let the spinner show first
$('run').addEventListener('click', async () => {
  const text = input.value;
  const error = problemWith(text);
  if (error) { showError(error); input.focus(); return; }
  clearError();
  if (action === 'count') { renderCounts(); return; }
  const current = ++revision;
  const ran = action;
  setBusy(true);
  try {
    if (ran === 'detect') {
      status(t.scoring);
      renderLoading(...t.loadingScore);
      await paint();
      if (current !== revision) return;
      renderScore(scoreText(text));
      return;
    }
    status(t.verb[ran]);
    renderLoading(`${t.verb[ran]}…`, provider ? t.loadingModel(providerName()) : t.loadingOffline);
    let output, meta;
    if (provider) {
      try {
        output = await modelRewrite(text, ran, current);
        meta = { engine: providerName(), note: t.modelNote };
      } catch (failure) {
        if (current !== revision) return;
        const local = rewriteLocally(text, ran);
        output = local.text;
        meta = { engine: t.offlineChip, note: local.note, warning: `${failure.message} ${t.fallback}` };
      }
    } else {
      await paint();
      const local = rewriteLocally(text, ran);
      output = local.text;
      meta = { engine: t.offlineChip, note: local.note };
    }
    if (current !== revision) return;
    renderRewrite(text, output, meta, ran);
  } catch (failure) {
    if (current !== revision) return;
    renderEmpty(); status(t.wentWrong);
    showError(failure.message || t.wentWrong);
  } finally {
    if (current === revision) setBusy(false);
  }
});

for (const tab of document.querySelectorAll('.tabs button')) tab.addEventListener('click', () => setAction(tab.dataset.action));

/* ---------- start ---------- */
async function checkService() {
  try {
    const response = await fetch('/api/status', { cache: 'no-store' });
    const data = response.ok ? await response.json() : {};
    provider = data.rewriteConfigured === true && typeof data.provider === 'string' ? data.provider : null;
  } catch { provider = null; }
  describeMode();
}
const draft = loadDraft();
if (draft && !input.value) input.value = draft.slice(0, LIMITS.maxChars);
setAction(action);
updateCount();
checkService();
