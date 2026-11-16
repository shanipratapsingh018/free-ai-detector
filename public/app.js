import { LIMITS, words, validateScore, validateRewrite } from './engine.js';
import { scoreText, createReport } from './detector.js';
import { rewriteLocally, ACTIONS } from './rewrite-local.js';
import { diffWords } from './diff.js';
import { docxToText } from './docx.js';
import { samples } from './samples.js';

const $ = id => document.getElementById(id);
const input = $('text-input');
const panel = $('results-panel');
const content = $('result-content');

/* ---------- state ---------- */
let action = 'detect';
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
  const original = button.dataset.label || button.textContent;
  button.dataset.label = original;
  try { await navigator.clipboard.writeText(text); button.lastChild.textContent = 'Copied'; }
  catch { button.lastChild.textContent = 'Select the text and press Ctrl/⌘+C'; }
  setTimeout(() => { button.lastChild.textContent = original; }, 2200);
}
const status = text => { $('result-status').textContent = text; };
function showError(message) { $('input-error').textContent = message; $('input-error').hidden = false; input.setAttribute('aria-invalid', 'true'); }
function clearError() { $('input-error').hidden = true; input.removeAttribute('aria-invalid'); }

/* ---------- idle and loading states ---------- */
const EMPTY = {
  detect: ['Paste text to see its score.', 'You will get a 0–100 AI-likeness score, the signals behind it and sentence highlights.'],
  humanize: ['A more natural version will appear here.', 'Your original stays in the editor so you can compare.'],
  grammar: ['A corrected version will appear here.', 'Every correction is highlighted against your original.'],
  simplify: ['A plainer version will appear here.', 'Shorter words and sentences, same facts.'],
  summarize: ['A summary will appear here.', 'The key points, in the order they appear.']
};
function renderEmpty() {
  const [title, body] = EMPTY[action];
  content.replaceChildren(el('div', { class: 'empty-result' }, el('div', { class: 'empty-art', 'aria-hidden': 'true' }, icon(action === 'detect' ? 'shield' : 'spark')), el('h3', { text: title }), el('p', { text: body })));
}
function renderLoading(title, body) {
  content.replaceChildren(el('div', { class: 'empty-result' }, el('div', { class: 'spinner', 'aria-hidden': 'true' }), el('h3', { text: title }), el('p', { text: body })));
}
function setBusy(busy) {
  panel.setAttribute('aria-busy', String(busy));
  $('run').disabled = busy;
}

/* ---------- tool switching ---------- */
const RUN_LABEL = { detect: 'Check text', humanize: 'Humanize', grammar: 'Fix grammar', simplify: 'Simplify', summarize: 'Summarize' };
const providerName = () => provider === 'openai' ? 'OpenAI' : provider === 'workers-ai' ? 'Cloudflare Workers AI' : null;
function describeMode() {
  const rewriting = action !== 'detect';
  $('result-label').textContent = rewriting ? ACTIONS[action].label : 'Score';
  $('run-label').textContent = RUN_LABEL[action];
  $('guidance').textContent = rewriting
    ? `${LIMITS.rewriteMinWords}–${LIMITS.rewriteMaxWords.toLocaleString('en-US')} words, up to ${LIMITS.rewriteMaxChars.toLocaleString('en-US')} characters.`
    : `Any length up to ${LIMITS.maxChars.toLocaleString('en-US')} characters.`;
  if (!rewriting) {
    $('engine-note').textContent = 'Scoring runs on this device.';
    $('mode-disclosure').textContent = 'The score is a rule-based estimate of how closely the writing matches patterns common in AI output. It is not proof of authorship. Your text is not uploaded.';
  } else if (provider) {
    $('engine-note').textContent = `Rewriting with ${providerName()}.`;
    $('mode-disclosure').textContent = `This tool sends your text through this site’s server to ${providerName()} and shows the revision beside your original. Do not submit sensitive material. Review every revision before using it.`;
  } else {
    $('engine-note').textContent = 'Offline rewriting (rule-based).';
    $('mode-disclosure').textContent = 'No language model is connected, so this tool uses offline rules in your browser. Edits are conservative and your text is not uploaded. A connected model gives deeper rewrites.';
  }
}
function invalidate() {
  revision++;
  pending?.abort(); pending = null;
  setBusy(false);
  status('Ready');
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
  $('count').textContent = `${n.toLocaleString('en-US')} ${n === 1 ? 'word' : 'words'} · ${input.value.length.toLocaleString('en-US')} characters`;
}
function inputChanged() {
  clearError();
  invalidate();
  clearTimeout(countTimer);
  countTimer = setTimeout(updateCount, 120);
}
function setInput(text) { input.value = text; inputChanged(); updateCount(); input.focus(); }

input.addEventListener('input', () => { fileRevision++; inputChanged(); });
input.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); $('run').click(); } });
$('clear').addEventListener('click', () => { fileRevision++; beforeSample = null; $('undo-sample').hidden = true; setInput(''); });
$('paste').addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) { showError('Your clipboard is empty. Copy some text first.'); return; }
    fileRevision++; setInput(text.slice(0, LIMITS.maxChars));
    if (text.length > LIMITS.maxChars) showError(`Only the first ${LIMITS.maxChars.toLocaleString('en-US')} characters were pasted.`);
  } catch { showError('Clipboard access is blocked. Click in the editor and press Ctrl+V or ⌘V.'); input.focus(); }
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
  if (!/\.(txt|md|docx)$/.test(name)) { showError('Choose a .txt, .md or .docx file. PDF is not supported yet; copy the text and paste it instead.'); return; }
  if (file.size > LIMITS.maxFileBytes) { showError('That file is larger than 2 MB. Paste the part you want to check instead.'); return; }
  try {
    const buffer = await file.arrayBuffer();
    let text;
    if (name.endsWith('.docx')) text = await docxToText(buffer);
    else {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, '');
      if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)) throw new Error('binary');
    }
    if (current !== fileRevision) return;
    if (!text.trim()) { showError('No text was found in that file.'); return; }
    beforeSample = null; $('undo-sample').hidden = true;
    setInput(text.slice(0, LIMITS.maxChars));
    if (text.length > LIMITS.maxChars) showError(`This file is long. Only the first ${LIMITS.maxChars.toLocaleString('en-US')} characters were loaded.`);
  } catch {
    if (current === fileRevision) showError(name.endsWith('.docx') ? 'This .docx file could not be read. Open it in Word, copy the text and paste it here.' : 'This file is not plain UTF-8 text. Save it as UTF-8 and try again.');
  }
});

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
  const card = el('div', { class: 'score-card' },
    el('div', { class: `ring ${tone}`, role: 'img', 'aria-label': `AI-likeness score ${result.score} out of 100` }, ring,
      el('div', { class: 'ring-number' }, el('span', { text: String(result.score) }), el('small', { text: 'AI-LIKENESS' }))),
    el('div', { class: 'score-text' },
      el('h3', { class: tone, text: result.band }),
      el('p', {}, el('span', { class: 'confidence', text: `Confidence: ${result.confidence}. ` }), result.confidenceNote),
      el('p', { text: `Language check: ${result.language}.` })));

  const signals = el('div', { class: 'result-section' }, el('h4', { text: 'Why this score' }));
  if (!result.signals.length) signals.append(el('p', { class: 'caveat', text: 'There is too little text for any signal to be measured.' }));
  for (const signal of result.signals) {
    const pct = Math.round(signal.strength * 100);
    const level = pct >= 65 ? 'tone-high' : pct >= 35 ? 'tone-medium' : 'tone-low';
    const fill = el('i'); fill.style.width = `${pct}%`;
    signals.append(el('div', { class: 'signal' },
      el('span', { class: 'signal-name', text: signal.label }),
      el('span', { class: `signal-bar ${level}`, 'aria-hidden': 'true' }, fill),
      el('span', { class: `signal-value ${level}`, text: String(pct), title: '0 = human-like, 100 = AI-like' }),
      el('p', { class: 'signal-detail', text: `${signal.detail}. ${signal.hint}` })));
  }

  const view = el('div', { class: 'sentence-view', tabindex: '0', 'aria-label': 'Your text with AI-like sentences highlighted' });
  for (const sentence of result.sentences) {
    if (sentence.level === 'high' || sentence.level === 'medium') view.append(el('span', { class: `lvl-${sentence.level}`, title: sentence.reasons.join(', ') || 'even, neutral phrasing', text: sentence.text }));
    else view.append(sentence.text);
  }
  const sentenceSection = el('div', { class: 'result-section' }, el('h4', { text: 'Sentence view' }),
    el('div', { class: 'legend' }, el('span', { class: 'lg-high', text: 'Strongly AI-like' }), el('span', { class: 'lg-medium', text: 'Somewhat AI-like' }), el('span', { text: 'No strong signal' })),
    view);

  const s = result.stats;
  const stat = (label, value) => el('div', {}, el('dt', { text: label }), el('dd', { text: String(value) }));
  const stats = el('div', { class: 'result-section' }, el('h4', { text: 'Counts' }), el('dl', { class: 'stats' },
    stat('Words', s.wordCount.toLocaleString('en-US')), stat('Sentences', s.sentenceCount), stat('Paragraphs', s.paragraphCount),
    stat('Avg. sentence', `${s.averageSentenceLength} words`), stat('Unique words', s.uniqueWords.toLocaleString('en-US')), stat('Flagged sentences', result.flaggedSentences)));

  const copyButton = el('button', { type: 'button', class: 'button' }, icon('copy'), 'Copy summary');
  copyButton.addEventListener('click', () => copyText(`AI-likeness score: ${result.score}/100 (${result.band}; confidence ${result.confidence.toLowerCase()}). Heuristic estimate, not proof of authorship.`, copyButton));
  const footer = el('div', { class: 'result-section' }, el('p', { class: 'caveat', text: result.limitation }),
    el('div', { class: 'actions' },
      el('button', { type: 'button', class: 'button', onclick: () => saveText(createReport(result), 'ai-detector-report.txt') }, icon('download'), 'Download report'),
      copyButton,
      el('button', { type: 'button', class: 'button strong', onclick: () => { setAction('humanize'); $('run').click(); } }, icon('spark'), 'Humanize this text')));

  content.replaceChildren(card, signals, sentenceSection, stats, footer);
  content.scrollTop = 0;
  status('Score ready');
}

/* ---------- rewrite results ---------- */
function renderRewrite(original, output, meta) {
  const box = el('div', { class: 'rewrite-output', tabindex: '0', 'aria-label': 'Revised text' });
  const showClean = () => { box.replaceChildren(output); };
  const showChanges = () => {
    box.replaceChildren(...diffWords(original, output).map(run => run.type === 'same' ? run.text : el(run.type === 'add' ? 'ins' : 'del', { text: run.text })));
  };
  const cleanButton = el('button', { type: 'button', 'aria-pressed': 'true', text: 'Result' });
  const changesButton = el('button', { type: 'button', 'aria-pressed': 'false', text: 'Changes' });
  cleanButton.addEventListener('click', () => { cleanButton.setAttribute('aria-pressed', 'true'); changesButton.setAttribute('aria-pressed', 'false'); showClean(); });
  changesButton.addEventListener('click', () => { cleanButton.setAttribute('aria-pressed', 'false'); changesButton.setAttribute('aria-pressed', 'true'); showChanges(); });
  showClean();

  const inWords = words(original).length, outWords = words(output).length;
  const head = el('div', { class: 'rewrite-meta' },
    el('span', { class: 'chip', text: meta.engine }),
    el('span', { text: `${inWords.toLocaleString('en-US')} → ${outWords.toLocaleString('en-US')} words` }),
    el('div', { class: 'view-toggle', role: 'group', 'aria-label': 'Choose a view' }, cleanButton, changesButton));

  const copyButton = el('button', { type: 'button', class: 'button strong' }, icon('copy'), 'Copy');
  copyButton.addEventListener('click', () => copyText(output, copyButton));
  const actions = el('div', { class: 'actions' }, copyButton,
    el('button', { type: 'button', class: 'button', onclick: () => saveText(output, `${action}-result.txt`) }, icon('download'), 'Download .txt'),
    el('button', { type: 'button', class: 'button', onclick: () => { fileRevision++; setAction('detect'); setInput(output); $('run').click(); } }, icon('shield'), 'Check this version'));

  const notes = [];
  if (meta.warning) notes.push(el('p', { class: 'notice warn', text: meta.warning }));
  if (meta.note) notes.push(el('p', { class: 'notice', text: meta.note }));
  notes.push(el('p', { class: 'notice', text: 'Compare the result with your original before using it. There is no promise that any detector will rate it as human-written.' }));

  content.replaceChildren(head, box, actions, ...notes);
  content.scrollTop = 0;
  status(output === original ? 'No changes needed' : 'Revision ready');
}

async function modelRewrite(text, current) {
  const controller = new AbortController(); pending = controller;
  const timer = setTimeout(() => controller.abort(), 50000);
  try {
    const response = await fetch('api/rewrite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, action }), signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'The model service did not finish.');
    if (typeof data.text !== 'string' || !data.text.trim()) throw new Error('The model service returned nothing.');
    return data.text;
  } catch (error) {
    if (current !== revision) throw error;
    throw new Error(error.name === 'AbortError' ? 'The model service timed out.' : error.message || 'The model service could not be reached.');
  } finally { clearTimeout(timer); if (pending === controller) pending = null; }
}

/* ---------- run ---------- */
$('run').addEventListener('click', async () => {
  const text = input.value;
  const error = action === 'detect' ? validateScore(text) : validateRewrite(text);
  if (error) { showError(error); input.focus(); return; }
  clearError();
  const current = ++revision;
  const ran = action;
  setBusy(true);
  try {
    if (ran === 'detect') {
      status('Scoring');
      renderLoading('Reading the patterns…', 'Scoring on this device.');
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0))); // let the spinner paint first
      if (current !== revision) return;
      renderScore(scoreText(text));
      return;
    }
    status(ACTIONS[ran].verb);
    renderLoading(`${ACTIONS[ran].verb}…`, provider ? `Waiting for ${providerName()}. Your original stays in the editor.` : 'Applying offline rules on this device.');
    let output, meta;
    if (provider) {
      try {
        output = await modelRewrite(text, current);
        meta = { engine: providerName(), note: 'AI-assisted revision produced by a language model.' };
      } catch (failure) {
        if (current !== revision) return;
        const local = rewriteLocally(text, ran);
        output = local.text;
        meta = { engine: 'Offline rules', note: local.note, warning: `${failure.message} Showing the offline rewrite instead.` };
      }
    } else {
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
      const local = rewriteLocally(text, ran);
      output = local.text;
      meta = { engine: 'Offline rules', note: local.note };
    }
    if (current !== revision) return;
    renderRewrite(text, output, meta);
  } catch (failure) {
    if (current !== revision) return;
    renderEmpty(); status('Something went wrong');
    showError(failure.message || 'That did not work. Please try again.');
  } finally {
    if (current === revision) setBusy(false);
  }
});

for (const tab of document.querySelectorAll('.tabs button')) tab.addEventListener('click', () => setAction(tab.dataset.action));

/* ---------- start ---------- */
async function checkService() {
  try {
    const response = await fetch('api/status', { cache: 'no-store' });
    const data = response.ok ? await response.json() : {};
    provider = data.rewriteConfigured === true && typeof data.provider === 'string' ? data.provider : null;
  } catch { provider = null; }
  describeMode();
}
$('year').textContent = new Date().getFullYear();
setAction('detect');
updateCount();
checkService();
