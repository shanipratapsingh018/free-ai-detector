/**
 * Free AI Detector — workspace controller.
 * - All user text is rendered with textContent (never innerHTML).
 * - Every request is tied to an input version; responses for older input are discarded.
 * - Nothing is persisted in browser storage.
 */
import { LIMITS, MODES, countWords, validateText } from './limits.js';
import { extractFile, ExtractError } from './extract.js';
import { diffWords, diffStats } from './diff.js';

const $ = id => document.getElementById(id);
const editor = $('editor');
const resultsBody = $('results-body');
const nf = new Intl.NumberFormat('en-US');
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const CLIENT_TIMEOUT_MS = 90000;

const SAMPLES = {
  casual: `I finally fixed the squeaky gate this weekend. Took three tries — the first hinge I bought at the hardware store on Elm was the wrong size, and the second one I somehow installed upside down, which my neighbor Dana found hilarious. By Sunday afternoon it swung shut without a sound. Honestly the best part was the cup of coffee afterward, sitting on the porch steps and listening to absolutely nothing squeak.

Next project is the shed door, though I'm in no hurry. That one has been sticking since 2019 and at this point I think it's part of its charm. Dana says she'll help, mostly so she can watch.`,
  polished: `In today's fast-paced world, effective time management has become an essential skill for personal and professional success. By prioritizing tasks, setting clear goals, and minimizing distractions, individuals can significantly enhance their productivity. Furthermore, leveraging digital tools such as calendars and task management applications can streamline workflows and foster greater accountability.

It is important to note that time management is not merely about doing more in less time; rather, it is about aligning daily activities with long-term objectives. Ultimately, by cultivating these habits, individuals can achieve a healthier work-life balance, reduce stress, and unlock their full potential in an increasingly demanding environment.`,
};

const CLASS_LABEL = { human: 'Human', mixed: 'Mixed', ai: 'AI' };
const VERDICT = { human: 'Human-written', mixed: 'Mixed human and AI writing', ai: 'AI-generated' };
const SUBCLASS = { pure_ai: 'Purely AI-generated', ai_paraphrased: 'AI-paraphrased', concatenated: 'Human and AI sections combined', polished: 'Human writing polished by AI' };

const state = {
  mode: 'detect',
  inputVersion: 0,
  seq: 0,
  status: { loaded: false, failed: false, detector: { available: false }, writer: { available: false } },
  results: {},   // mode -> result record for the current inputVersion
  pending: {},   // mode -> { controller, seq }
  stale: false,
  restore: null, // { text, message, label }
  fileToken: 0,
  view: {},      // mode -> compare view
};

/* ---------- tiny DOM helper (text-safe) ---------- */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
const icon = name => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
};
const btn = (cls, iconName, label, onclick, attrs = {}) => h('button', { type: 'button', class: cls, onclick, ...attrs }, iconName ? icon(iconName) : null, label);

function announce(msg) {
  const a = $('announcer');
  a.textContent = '';
  setTimeout(() => { a.textContent = msg; }, 30);
}

/* ---------- formatting ---------- */
export function pct(p) {
  if (p > 0 && p < 0.005) return '<1%';
  if (p < 1 && p >= 0.995) return '>99%';
  return `${Math.round(p * 100)}%`;
}
const plural = (n, w) => `${nf.format(n)} ${w}${n === 1 ? '' : 's'}`;
const fmtTime = iso => { try { return new Date(iso).toLocaleString(); } catch { return iso; } };

/* ---------- counts & validation ---------- */
function updateCounts() {
  const text = editor.value;
  const words = countWords(text);
  const chars = text.length;
  $('word-count').textContent = plural(words, 'word');
  $('char-count').textContent = plural(chars, 'character');
  const spec = MODES[state.mode];
  $('limits-hint').textContent = `${spec.label}: ${nf.format(spec.min)}–${nf.format(LIMITS.maxWords)} words, up to ${nf.format(LIMITS.maxChars)} characters`;
  const fill = $('meter-fill');
  const ratio = Math.max(words / LIMITS.maxWords, chars / LIMITS.maxChars);
  fill.style.width = `${Math.min(ratio, 1) * 100}%`;
  const over = words > LIMITS.maxWords || chars > LIMITS.maxChars;
  fill.className = over ? 'over' : words >= spec.min ? 'ok' : '';
  if (over) showInputMsg(validateText(text, state.mode));
  else if (!$('input-msg').classList.contains('info')) hideInputMsg();
}
function showInputMsg(msg, info = false) {
  const el = $('input-msg');
  el.textContent = msg;
  el.classList.toggle('info', info);
  el.hidden = false;
  if (!info) editor.setAttribute('aria-invalid', 'true');
}
function hideInputMsg() {
  $('input-msg').hidden = true;
  $('input-msg').classList.remove('info');
  editor.removeAttribute('aria-invalid');
}

/* ---------- input lifecycle ---------- */
function abortAll() {
  for (const p of Object.values(state.pending)) p.controller.abort('input-changed');
  state.pending = {};
}
function onInputChanged() {
  state.inputVersion++;
  const had = Object.keys(state.results).length > 0 || Object.keys(state.pending).length > 0;
  abortAll();
  state.results = {};
  if (had) { state.stale = true; announce('Your text changed, so previous results were cleared.'); }
  if ($('input-msg').classList.contains('info')) hideInputMsg();
  updateCounts();
  render();
}
function setEditorText(text, restore) {
  if (restore) state.restore = { text: editor.value, ...restore };
  editor.value = text;
  onInputChanged();
  renderRestore();
}
function renderRestore() {
  const r = state.restore;
  $('restore-bar').hidden = !r;
  if (!r) return;
  $('restore-msg').textContent = r.message;
  $('restore-label').textContent = r.label;
}

/* ---------- modes ---------- */
function setMode(mode, focus = false) {
  state.mode = mode;
  for (const b of document.querySelectorAll('.mode')) {
    const on = b.dataset.mode === mode;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  }
  if ($('input-msg').classList.contains('info') === false) hideInputMsg();
  updateCounts();
  render();
}

function serviceFor(mode) {
  return mode === 'detect' ? state.status.detector : state.status.writer;
}
/** true = known available, false = known unavailable, null = unknown (status check failed) */
function availability(mode) {
  if (!state.status.loaded) return state.status.failed ? null : undefined;
  return !!serviceFor(mode).available;
}

/* ---------- networking ---------- */
async function postJson(path, body, controller) {
  let res;
  try {
    res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted) throw Object.assign(new Error('aborted'), { aborted: true, reason: controller.signal.reason });
    throw { code: 'network', message: 'Couldn’t reach the server. Check your connection and try again. Your text is unchanged.' };
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok || !data || !data.result) {
    const code = data?.error?.code || (res.status === 404 ? 'no_backend' : `http_${res.status}`);
    const message = data?.error?.message || (res.status === 404 || res.status === 405
      ? 'The analysis server isn’t running on this host, so this feature is unavailable.'
      : 'The server returned an unexpected response. Your text is unchanged; please try again.');
    throw { status: res.status, code, message };
  }
  return data.result;
}

function classifyError(err) {
  const code = err?.code || '';
  if (/_unavailable$|^provider_auth$|^provider_quota$|^no_backend$/.test(code)) return 'unavailable';
  if (code === 'timeout' || err?.status === 504) return 'timeout';
  if (code === 'rate_limited' || code === 'daily_cap' || code === 'provider_busy' || err?.status === 429) return 'limited';
  return 'error';
}

async function run() {
  const mode = state.mode;
  const text = editor.value;
  const problem = validateText(text, mode);
  if (problem) { showInputMsg(problem); editor.focus(); announce(problem); return; }
  if (availability(mode) === false) { render(); return; }
  hideInputMsg();
  state.pending[mode]?.controller.abort('superseded');
  const controller = new AbortController();
  const seq = ++state.seq;
  const version = state.inputVersion;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort('timeout'); }, CLIENT_TIMEOUT_MS);
  state.pending[mode] = { controller, seq };
  state.stale = false;
  delete state.results[mode];
  render();
  announce(mode === 'detect' ? 'Checking your text with the AI detector…' : `${MODES[mode].label} in progress…`);
  scrollResultsIntoView();
  try {
    const path = mode === 'detect' ? '/api/detect' : `/api/revise?mode=${mode}`;
    const data = await postJson(path, { text }, controller);
    if (!isCurrent(mode, seq, version)) return;
    state.results[mode] = { kind: mode === 'detect' ? 'detect' : 'revision', data, original: text, words: countWords(text) };
    announceResult(mode, data);
  } catch (err) {
    if (err?.aborted && !timedOut) return; // user cancel or input change: handled elsewhere
    if (!isCurrent(mode, seq, version)) return;
    const e = timedOut ? { code: 'timeout', message: 'The request took too long. Your text is unchanged; please try again.' } : err;
    state.results[mode] = { kind: 'error', type: classifyError(e), message: e.message || 'Something went wrong.' };
    announce(mode === 'detect' ? `Score unavailable. ${e.message}` : e.message);
  } finally {
    clearTimeout(timer);
    if (state.pending[mode]?.seq === seq) delete state.pending[mode];
    if (isCurrent(mode, seq, version) || state.mode === mode) render();
  }
}
function isCurrent(mode, seq, version) {
  return state.inputVersion === version && state.pending[mode]?.seq === seq;
}
function cancel(mode) {
  const p = state.pending[mode];
  if (!p) return;
  p.controller.abort('cancelled');
  delete state.pending[mode];
  announce('Cancelled. Your text is unchanged.');
  render();
}

/** Explicit, user-initiated detector check of a revision. Never automatic. */
async function checkRevision(mode) {
  const rec = state.results[mode];
  if (!rec || rec.kind !== 'revision') return;
  const version = state.inputVersion;
  const controller = new AbortController();
  const seq = ++state.seq;
  rec.check = { status: 'loading', seq, controller };
  render();
  announce('Checking the revision with the AI detector…');
  const timer = setTimeout(() => controller.abort('timeout'), CLIENT_TIMEOUT_MS);
  try {
    const data = await postJson('/api/detect', { text: rec.data.text }, controller);
    if (state.inputVersion !== version || state.results[mode] !== rec || rec.check?.seq !== seq) return;
    rec.check = { status: 'done', data, words: countWords(rec.data.text) };
    announceResult('detect', data, 'revision');
  } catch (err) {
    if (state.inputVersion !== version || state.results[mode] !== rec || rec.check?.seq !== seq) return;
    if (err?.aborted && controller.signal.reason !== 'timeout') { rec.check = null; return; }
    const e = err?.aborted ? { code: 'timeout', message: 'The detector took too long to respond.' } : err;
    rec.check = { status: 'error', type: classifyError(e), message: e.message };
    announce(`Score unavailable. ${e.message}`);
  } finally {
    clearTimeout(timer);
    if (state.mode === mode) render();
  }
}

function announceResult(mode, data, what = 'text') {
  if (mode === 'detect') {
    const conf = data.confidenceCategory ? `, ${data.confidenceCategory} confidence` : '';
    announce(`Detector result for your ${what} is ready. GPTZero predicts ${VERDICT[data.predictedClass]}${conf}. Human ${pct(data.classProbabilities.human)}, mixed ${pct(data.classProbabilities.mixed)}, AI ${pct(data.classProbabilities.ai)}.`);
  } else {
    announce(`${MODES[mode].label} finished. Your revision is ready to compare. Your original is unchanged.`);
  }
}

function scrollResultsIntoView() {
  const panel = $('results');
  const r = panel.getBoundingClientRect();
  if (r.top > window.innerHeight - 120 || r.bottom < 0) {
    panel.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  }
}

/* ---------- rendering ---------- */
function setStatusChip(text, tone) {
  const c = $('results-status');
  c.textContent = text;
  c.dataset.tone = tone;
}

function render() {
  const mode = state.mode;
  const spec = MODES[mode];
  const avail = availability(mode);
  const pending = state.pending[mode];
  const rec = state.results[mode];

  // Run button + provider note
  $('run-label').textContent = spec.verb;
  $('run-btn').disabled = !!pending || avail === false;
  const svc = serviceFor(mode);
  $('provider-note').textContent =
    avail === undefined ? 'Checking service…'
      : avail === false ? (mode === 'detect' ? 'AI detector not connected — score unavailable.' : 'Writing tools not connected yet.')
        : avail === null ? ''
          : mode === 'detect' ? 'Scored by GPTZero’s detector API.' : `Uses ${svc.provider}${svc.model ? ` (${svc.model})` : ''}. Your original stays unchanged.`;
  $('results-title').textContent = mode === 'detect' ? 'Detector result' : `${spec.label} result`;
  $('results').setAttribute('aria-busy', String(!!pending));

  let view;
  if (pending) view = renderLoading(mode);
  else if (rec?.kind === 'detect') view = renderDetect(rec.data, { words: rec.words, original: rec.original });
  else if (rec?.kind === 'revision') view = renderRevision(mode, rec);
  else if (rec?.kind === 'error') view = renderError(mode, rec);
  else if (avail === false) view = renderUnavailable(mode);
  else if (state.stale) view = renderStale(mode);
  else view = renderEmpty(mode);
  resultsBody.replaceChildren(view);
}

function stateBlock(cls, iconName, title, text, ...extra) {
  return h('div', { class: `state ${cls}` }, h('div', { class: 'state-art' }, icon(iconName)), h('h4', {}, title), text ? h('p', {}, text) : null, ...extra);
}

function renderEmpty(mode) {
  setStatusChip('Waiting for text', 'idle');
  const copy = {
    detect: ['Your detector result will appear here', 'Add at least 50 words, then choose Check for AI. You’ll see GPTZero’s human, mixed, and AI probabilities with a plain-language explanation.'],
    humanize: ['A more natural version, side by side', 'Humanize suggests conservative edits for smoother phrasing. Your original stays in the editor.'],
    grammar: ['Corrections, clearly marked', 'Fix Grammar corrects errors with minimal rewriting and shows every change.'],
    simplify: ['Easier to read, same meaning', 'Simplify shortens sentences and uses plainer words while keeping your key points.'],
    summarize: ['A faithful summary', 'Summarize condenses at least 60 words without adding new claims.'],
  }[mode];
  return stateBlock('', mode === 'detect' ? 'search' : 'feather', copy[0], copy[1]);
}
function renderStale(mode) {
  setStatusChip('Text changed', 'warn');
  return stateBlock('warn', 'info', 'Your text changed', `Previous results were cleared so they can’t be mistaken for this version. ${MODES[mode].verb} again when you’re ready.`);
}
function renderLoading(mode) {
  setStatusChip(mode === 'detect' ? 'Checking…' : 'Writing…', 'busy');
  return h('div', { class: 'state' },
    h('div', { class: 'spinner', role: 'presentation' }),
    h('h4', {}, mode === 'detect' ? 'Checking with GPTZero…' : `${MODES[mode].label} in progress…`),
    h('p', {}, mode === 'detect' ? 'This usually takes a few seconds.' : 'This can take up to a minute for longer passages.'),
    h('div', { class: 'skeleton', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
    h('div', { class: 'actions' }, btn('btn-secondary', 'x', 'Cancel', () => cancel(mode))));
}
function renderUnavailable(mode) {
  if (mode === 'detect') {
    setStatusChip('Score unavailable', 'warn');
    return stateBlock('warn', 'alert', 'Score unavailable', 'The AI detector isn’t connected on this site right now, so no score can be shown. We never substitute an estimated number. You can still use the writing tools if they’re available.');
  }
  setStatusChip('Unavailable', 'warn');
  return stateBlock('warn', 'alert', 'Writing tools unavailable', 'The language-model service isn’t connected on this site right now. Your text hasn’t been sent anywhere.');
}
function renderError(mode, rec) {
  const titles = { unavailable: 'unavailable', timeout: 'Request timed out', limited: 'Please wait a moment', error: 'Something went wrong' };
  const tone = rec.type === 'error' ? 'error' : 'warn';
  const title = mode === 'detect' ? 'Score unavailable' : (rec.type === 'unavailable' ? 'Writing tools unavailable' : titles[rec.type]);
  setStatusChip(mode === 'detect' ? 'Score unavailable' : titles[rec.type].replace(/^./, c => c.toUpperCase()), tone);
  const retry = rec.type !== 'unavailable' ? h('div', { class: 'actions' }, btn('btn-secondary', 'undo', 'Try again', run)) : null;
  return stateBlock(tone === 'error' ? 'error' : 'warn', 'alert', title, rec.message, retry);
}

function probsList(cp, predicted) {
  return h('ul', { class: 'probs' }, ['human', 'mixed', 'ai'].map(c => {
    const span = h('span');
    const row = h('li', { class: `prob-row${c === predicted ? ' top' : ''}`, 'data-class': c },
      h('span', { class: 'label' }, CLASS_LABEL[c], c === predicted ? h('span', { class: 'predicted-tag' }, ' · predicted') : null),
      h('span', { class: 'value' }, pct(cp[c])),
      h('span', { class: 'bar', role: 'img', 'aria-label': `${CLASS_LABEL[c]} class probability ${pct(cp[c])}` }, span));
    requestAnimationFrame(() => requestAnimationFrame(() => { span.style.width = `${Math.max(cp[c] * 100, cp[c] > 0 ? 1 : 0)}%`; }));
    return row;
  }));
}

function renderDetect(d, { words, original, nested = false } = {}) {
  if (!nested) setStatusChip('Result ready', 'ok');
  const cp = d.classProbabilities;
  const wrap = h('div', { class: 'detect-result' });
  wrap.append(
    h('div', { class: 'verdict' },
      h('span', { class: 'eyebrow' }, nested ? 'Revision · GPTZero’s prediction' : 'GPTZero’s prediction'),
      h(nested ? 'h5' : 'h4', {}, VERDICT[d.predictedClass]),
      h('span', { class: 'confidence' }, [d.confidenceCategory ? `${d.confidenceCategory[0].toUpperCase()}${d.confidenceCategory.slice(1)} confidence` : 'Confidence not provided', d.subclass ? ` · ${SUBCLASS[d.subclass] || d.subclass.replace(/_/g, ' ')}` : ''].join(''))),
    d.resultMessage ? h('blockquote', { class: 'provider-quote' }, `“${d.resultMessage}”`, h('cite', {}, '— GPTZero’s own wording')) : null,
    probsList(cp, d.predictedClass),
    h('p', { class: 'prob-caption' }, 'Class probabilities for the whole document. They are not the share of words written by AI.'),
  );
  const explain = h('details', { class: 'explain', open: !nested },
    h('summary', {}, 'What these numbers mean'),
    h('div', {},
      h('ul', {},
        h('li', {}, 'Each bar is GPTZero’s probability that the entire document belongs to that class: written by a human, by AI, or a mix of both. The three add up to about 100%.'),
        h('li', {}, `GPTZero predicts “${CLASS_LABEL[d.predictedClass]}” because it has the highest probability (${pct(cp[d.predictedClass])}). GPTZero describes this value as the chance its prediction is correct on similar documents.`),
        h('li', {}, `A ${pct(cp.ai)} AI probability does not mean ${pct(cp.ai)} of the words were AI-written.`),
        d.confidenceCategory ? h('li', {}, `The “${d.confidenceCategory}” confidence category comes from GPTZero’s own thresholds, not from us.`) : null,
        words < 150 ? h('li', {}, `This passage is short (${plural(words, 'word')}). Detectors are less reliable on short text.`) : null)));
  wrap.append(explain);
  if (d.sentenceCount > 0) {
    const n = d.highlightedSentences.length;
    wrap.append(h('details', { class: 'explain' },
      h('summary', {}, `Sentences GPTZero highlighted: ${n} of ${d.sentenceCount}`),
      h('div', {}, n ? h('ul', { class: 'flagged' }, d.highlightedSentences.map(s => h('li', {}, s)))
        : h('p', {}, 'GPTZero didn’t highlight any individual sentences.'),
      h('p', { class: 'muted small' }, 'Highlights point to passages worth reviewing; they don’t identify who wrote them.'))));
  }
  wrap.append(
    h('dl', { class: 'meta' },
      h('dt', {}, 'Provider'), h('dd', {}, 'GPTZero API'),
      h('dt', {}, 'Detector version'), h('dd', {}, d.modelVersion || 'Not reported'),
      h('dt', {}, 'Words checked'), h('dd', {}, nf.format(words)),
      h('dt', {}, 'Checked'), h('dd', {}, fmtTime(d.checkedAt))),
    h('div', { class: 'limit-note' }, icon('info'), h('span', {}, 'A detector result can’t prove who wrote a text, and it can’t reliably identify which AI tool was used. Use it as one signal, not as evidence.')));
  if (!nested) {
    const include = h('input', { type: 'checkbox', id: 'include-text' });
    wrap.append(
      h('div', { class: 'actions' },
        btn('btn-secondary', 'copy', 'Copy summary', () => copyText(detectSummary(d), 'Result summary copied.')),
        btn('btn-secondary', 'download', 'Download report', () => download(`free-ai-detector-report-${stamp()}.txt`, detectReport(d, { words, text: include.checked ? original : null }))),
        btn('btn-secondary', 'flag', 'Report a problem', () => openInfo('report'))),
      h('label', { class: 'check-include', for: 'include-text' }, include, 'Include my text and highlighted sentences in the downloaded report'));
  }
  return wrap;
}

function renderRevision(mode, rec) {
  setStatusChip('Revision ready', 'ok');
  const d = rec.data;
  const isSummary = mode === 'summarize';
  const tabs = isSummary ? [['side', 'Side by side'], ['rev', 'Summary only']] : [['changes', 'Changes'], ['side', 'Side by side'], ['rev', 'Revision only']];
  let current = state.view[mode] && tabs.some(t => t[0] === state.view[mode]) ? state.view[mode] : tabs[0][0];
  const segments = isSummary ? null : diffWords(rec.original, d.text);
  const panel = h('div', { role: 'tabpanel', id: 'compare-panel', tabindex: '0' });
  const tabButtons = tabs.map(([id, label]) => h('button', { type: 'button', role: 'tab', id: `tab-${id}`, 'aria-controls': 'compare-panel', onclick: () => select(id) }, label));
  const tablist = h('div', { class: 'compare-tabs', role: 'tablist', 'aria-label': 'Comparison view' }, tabButtons);
  tablist.addEventListener('keydown', e => {
    const i = tabs.findIndex(t => t[0] === current);
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = tabs[(i + dir + tabs.length) % tabs.length][0];
    select(next); $(`tab-${next}`).focus();
  });
  function select(id) {
    current = id; state.view[mode] = id;
    tabButtons.forEach((b, i) => { const on = tabs[i][0] === id; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    panel.setAttribute('aria-labelledby', `tab-${id}`);
    if (id === 'changes') {
      panel.replaceChildren(h('div', { class: 'compare-view', 'aria-label': 'Changes: insertions and deletions' },
        segments.map(s => s.type === 'same' ? s.text : h(s.type === 'add' ? 'ins' : 'del', {}, s.text))));
    } else if (id === 'side') {
      panel.replaceChildren(h('div', { class: 'side-by-side' },
        h('div', {}, h('h5', {}, 'Original'), h('div', { class: 'compare-view' }, rec.original)),
        h('div', {}, h('h5', {}, isSummary ? 'Summary' : 'Revision'), h('div', { class: 'compare-view' }, d.text))));
    } else {
      panel.replaceChildren(h('div', { class: 'compare-view' }, d.text));
    }
  }
  select(current);
  const stats = segments ? diffStats(segments) : null;
  const detectorOk = availability('detect') !== false;
  const wrap = h('div', { class: 'revision-result' },
    h('div', { class: 'verdict' },
      h('span', { class: 'eyebrow' }, `${MODES[mode].label} · ${d.provider}`),
      h('h4', {}, isSummary ? 'Your summary' : d.changed ? 'Your revision' : 'No changes needed'),
      h('span', { class: 'confidence' }, isSummary
        ? `${plural(countWords(d.text), 'word')} from ${plural(rec.words, 'word')}`
        : `${plural(countWords(d.text), 'word')} · ${stats.added} added, ${stats.removed} removed`)),
    d.missingNumbers?.length ? h('div', { class: 'warn-note', role: 'note' }, icon('alert'),
      h('span', {}, `Check these numbers — they appear in your original but not in the revision: ${d.missingNumbers.join(', ')}`)) : null,
    tablist, panel,
    h('div', { class: 'limit-note' }, icon('info'), h('span', {},
      isSummary ? 'AI-generated summary. Check it against your original — it should add nothing that isn’t there.'
        : 'AI-assisted revision. Review facts, names, numbers, and meaning before using it. We make no promise about how any detector will score it.')),
    h('div', { class: 'actions' },
      btn('btn-secondary', 'copy', isSummary ? 'Copy summary' : 'Copy revision', () => copyText(d.text, 'Revision copied.')),
      btn('btn-secondary', 'download', 'Download .txt', () => download(`free-ai-detector-${mode}-${stamp()}.txt`, d.text + '\n')),
      btn('btn-secondary', 'undo', 'Use as my text', () => {
        setEditorText(d.text, { message: `${MODES[mode].label} result placed in the editor.`, label: 'Restore original' });
        editor.focus();
        announce('Revision placed in the editor. Use Restore original to undo.');
      }),
      detectorOk ? btn('btn-secondary', 'search', 'Check revision for AI', () => checkRevision(mode), { disabled: rec.check?.status === 'loading' }) : null,
      btn('btn-secondary', 'flag', 'Report a problem', () => openInfo('report'))),
    h('dl', { class: 'meta' },
      h('dt', {}, 'Model'), h('dd', {}, `${d.provider} · ${d.model}`),
      h('dt', {}, 'Created'), h('dd', {}, fmtTime(d.createdAt))));
  if (rec.check) {
    const sub = h('div', { class: 'subresult', 'aria-live': 'off' });
    if (rec.check.status === 'loading') sub.append(h('div', { class: 'state' }, h('div', { class: 'spinner' }), h('p', {}, 'Checking the revision with GPTZero…')));
    else if (rec.check.status === 'error') sub.append(stateBlock('warn', 'alert', 'Score unavailable', rec.check.message));
    else sub.append(renderDetect(rec.check.data, { words: rec.check.words, nested: true }));
    wrap.append(sub);
  }
  return wrap;
}

/* ---------- reports, copy, download ---------- */
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
function detectSummary(d) {
  const cp = d.classProbabilities;
  return `GPTZero prediction: ${VERDICT[d.predictedClass]}${d.confidenceCategory ? ` (${d.confidenceCategory} confidence)` : ''}. Class probabilities for the whole document — Human ${pct(cp.human)}, Mixed ${pct(cp.mixed)}, AI ${pct(cp.ai)}. Detector version: ${d.modelVersion || 'not reported'}. These are not the share of words written by AI, and cannot prove authorship.`;
}
export function detectReport(d, { words, text }) {
  const cp = d.classProbabilities;
  const lines = [
    'FREE AI DETECTOR — DETECTION REPORT',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Provider: GPTZero API (${d.providerUrl})`,
    `Detector version: ${d.modelVersion || 'not reported'}`,
    d.scanId ? `Scan ID: ${d.scanId}` : null,
    `Checked at: ${d.checkedAt}`,
    `Words checked: ${words}`,
    '',
    'PREDICTION',
    `Predicted class: ${VERDICT[d.predictedClass]}`,
    `Confidence category: ${d.confidenceCategory || 'not provided'}`,
    d.subclass ? `Subtype: ${SUBCLASS[d.subclass] || d.subclass}` : null,
    d.resultMessage ? `GPTZero's message: "${d.resultMessage}"` : null,
    '',
    'CLASS PROBABILITIES (whole document)',
    `Human: ${pct(cp.human)}`,
    `Mixed: ${pct(cp.mixed)}`,
    `AI:    ${pct(cp.ai)}`,
    '',
    'WHAT THESE NUMBERS MEAN',
    'Each value is GPTZero\'s probability that the entire document belongs to that class. GPTZero describes the probability of the predicted class as the chance its prediction is correct on similar documents. They are NOT the percentage of words written by AI.',
    '',
    `HIGHLIGHTED SENTENCES: ${d.highlightedSentences.length} of ${d.sentenceCount}`,
    ...(text ? d.highlightedSentences.map(s => `- ${s}`) : ['(Sentence text omitted. Choose "Include my text" to add it.)']),
    '',
    'LIMITATIONS',
    'A detector result cannot prove who wrote a text or reliably identify which AI tool was used. Detectors can produce false positives and false negatives, especially on short, formal, edited, or non-native English writing. Do not use this report as the sole basis for academic, employment, or disciplinary decisions.',
  ];
  if (text) lines.push('', 'SUBMITTED TEXT', text);
  return lines.filter(l => l !== null).join('\n') + '\n';
}
async function copyText(text, msg) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = h('textarea', { class: 'visually-hidden', 'aria-hidden': 'true' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand && document.execCommand('copy');
    ta.remove();
    if (!ok) { announce('Copy failed. Select the text and copy it manually.'); return; }
  }
  announce(msg);
  flash(msg);
}
function download(name, content) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  announce(`Downloaded ${name}.`);
}
let flashTimer;
function flash(msg) {
  const chip = $('results-status');
  const prev = [chip.textContent, chip.dataset.tone];
  setStatusChip(msg.replace(/\.$/, ''), 'ok');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { if (chip.textContent === msg.replace(/\.$/, '')) setStatusChip(...prev); }, 1800);
}

/* ---------- files ---------- */
async function handleFile(file, extraNote) {
  if (!file) return;
  const token = ++state.fileToken;
  showInputMsg(`Reading “${file.name}”…`, true);
  try {
    const result = await extractFile(file);
    if (token !== state.fileToken) return;
    hideInputMsg();
    openReview(file.name, result, extraNote);
  } catch (e) {
    if (token !== state.fileToken) return;
    const msg = e instanceof ExtractError ? e.message : 'Couldn’t extract text from that file. Try pasting the text instead.';
    showInputMsg(`${file.name}: ${msg}`);
    announce(msg);
  } finally {
    $('file-input').value = '';
  }
}
function openReview(name, result, extraNote) {
  const dlg = $('review-dialog');
  const kind = { text: 'Text file', docx: 'Word document', pdf: 'PDF' }[result.kind];
  $('review-meta').textContent = `${name} · ${kind}${result.pages ? ` · ${plural(result.pages, 'page')}` : ''}. Nothing has been checked or sent yet.`;
  const warnings = [...(result.warnings || []), ...(extraNote ? [extraNote] : [])];
  $('review-warnings').replaceChildren(...warnings.map(w => h('li', {}, w)));
  const ta = $('review-text');
  ta.value = result.text;
  const refresh = () => {
    const w = countWords(ta.value), c = ta.value.length;
    const over = w > LIMITS.maxWords || c > LIMITS.maxChars;
    $('review-counts').textContent = `${plural(w, 'word')} · ${plural(c, 'character')}${over ? ` — over the ${nf.format(LIMITS.maxWords)}-word / ${nf.format(LIMITS.maxChars)}-character limit. Trim it here or after inserting; nothing is cut automatically.` : ''}`;
  };
  ta.oninput = refresh;
  refresh();
  $('review-append').hidden = !editor.value.trim();
  $('review-replace').textContent = editor.value.trim() ? 'Replace my text' : 'Use this text';
  dlg.returnValue = '';
  dlg.showModal();
  ta.focus();
  ta.setSelectionRange(0, 0);
  ta.scrollTop = 0;
}
$('review-dialog').addEventListener('close', () => {
  const dlg = $('review-dialog');
  const text = $('review-text').value;
  if (dlg.returnValue === 'replace') {
    setEditorText(text, editor.value.trim() ? { message: 'Document text replaced your previous text.', label: 'Restore my text' } : null);
    announce('Document text inserted into the editor.');
  } else if (dlg.returnValue === 'append') {
    setEditorText(`${editor.value.replace(/\s+$/, '')}\n\n${text}`, { message: 'Document text added to the end.', label: 'Undo' });
    announce('Document text added to the end of your text.');
  }
  editor.focus();
});

/* ---------- dialogs ---------- */
const INFO = { privacy: 'Privacy', terms: 'Terms of use', contact: 'Contact', report: 'Report a problem' };
let infoReturnFocus = null;
function openInfo(which) {
  infoReturnFocus = document.activeElement;
  $('info-title').textContent = INFO[which];
  $('info-body').replaceChildren($(`t-${which}`).content.cloneNode(true));
  $('info-dialog').showModal();
  $('info-close').focus();
}
$('info-close').addEventListener('click', () => $('info-dialog').close());
$('info-dialog').addEventListener('click', e => { if (e.target === $('info-dialog')) $('info-dialog').close(); });
$('info-dialog').addEventListener('close', () => infoReturnFocus?.focus?.());
document.addEventListener('click', e => {
  const t = e.target.closest('[data-dialog]');
  if (t) openInfo(t.dataset.dialog);
});

/* ---------- wiring ---------- */
editor.addEventListener('input', onInputChanged);
editor.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (!$('run-btn').disabled) run(); }
});
$('run-btn').addEventListener('click', run);

const modeButtons = [...document.querySelectorAll('.mode')];
modeButtons.forEach((b, i) => {
  b.addEventListener('click', () => setMode(b.dataset.mode));
  b.addEventListener('keydown', e => {
    const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setMode(modeButtons[e.key === 'Home' ? 0 : modeButtons.length - 1].dataset.mode, true);
    } else if (dir) {
      e.preventDefault();
      setMode(modeButtons[(i + dir + modeButtons.length) % modeButtons.length].dataset.mode, true);
    }
  });
});

$('clear-btn').addEventListener('click', () => {
  if (!editor.value) { editor.focus(); return; }
  setEditorText('', { message: 'Text cleared.', label: 'Undo' });
  editor.focus();
  announce('Text cleared. Use Undo to bring it back.');
});

$('paste-btn').addEventListener('click', async () => {
  const version = state.inputVersion;
  let text;
  try {
    if (!navigator.clipboard?.readText) throw new Error('unsupported');
    text = await navigator.clipboard.readText();
  } catch {
    showInputMsg('Your browser didn’t allow clipboard access. Click in the editor and press Ctrl+V (⌘V on Mac).', true);
    editor.focus();
    return;
  }
  if (version !== state.inputVersion) return; // user typed meanwhile; don't clobber
  if (!text) { showInputMsg('Your clipboard is empty.', true); return; }
  editor.focus();
  const { selectionStart: s, selectionEnd: e } = editor;
  editor.setRangeText(text, s, e, 'end');
  onInputChanged();
  announce(`Pasted ${plural(countWords(text), 'word')}.`);
});

$('upload-btn').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', e => handleFile(e.target.files[0]));

const drop = $('drop-zone');
let dragDepth = 0;
drop.addEventListener('dragenter', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); dragDepth++; drop.classList.add('dragging'); } });
drop.addEventListener('dragover', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
drop.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) drop.classList.remove('dragging'); });
drop.addEventListener('drop', e => {
  if (!e.dataTransfer?.files?.length) return;
  e.preventDefault();
  dragDepth = 0; drop.classList.remove('dragging');
  const files = e.dataTransfer.files;
  handleFile(files[0], files.length > 1 ? `Only the first of ${files.length} dropped files was used.` : null);
});
// Prevent the browser from navigating away when a file is dropped outside the editor.
window.addEventListener('dragover', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault(); });
window.addEventListener('drop', e => { if (!drop.contains(e.target)) e.preventDefault(); });

for (const b of document.querySelectorAll('[data-sample]')) {
  b.addEventListener('click', () => {
    const had = editor.value.trim();
    setEditorText(SAMPLES[b.dataset.sample], had ? { message: `Example loaded (${b.textContent.replace('Example · ', '')}). Your text is saved.`, label: 'Restore my text' } : { message: 'Example loaded — this is sample text, not yours.', label: 'Clear example' });
    announce('Example text loaded into the editor.');
  });
}
$('restore-btn').addEventListener('click', () => {
  const r = state.restore;
  if (!r) return;
  state.restore = null;
  editor.value = r.text;
  onInputChanged();
  renderRestore();
  editor.focus();
  announce('Your previous text was restored.');
});
$('restore-dismiss').addEventListener('click', () => { state.restore = null; renderRestore(); editor.focus(); });

async function loadStatus() {
  try {
    const res = await fetch('/api/status', { signal: AbortSignal.timeout(10000), headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (!data || !data.detector || !data.writer) throw new Error('bad status');
    state.status = { loaded: true, failed: false, detector: data.detector, writer: data.writer };
  } catch {
    // Could not determine; e.g. static preview without the Worker. Treat detector/writer as unavailable.
    state.status = { loaded: true, failed: true, detector: { available: false }, writer: { available: false } };
  }
  render();
}

updateCounts();
render();
loadStatus();
