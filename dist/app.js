import { LIMITS, words, validate, analyzeText, createReport } from './engine.js';
const $ = id => document.getElementById(id);
const input = $('text-input');
let revision = 0;
let result = null;
let fileRevision = 0;
let mode = 'rewrite';
let rewriteReady = false;
let pendingRewrite = null;
let beforeSample = null;
function idleButton() {
  $('analyze').disabled = mode === 'rewrite' && !rewriteReady;
  $('analyze').innerHTML = (mode === 'rewrite' ? 'Humanize text' : 'Analyze text') + ' <svg><use href="#icon-arrow"/></svg>';
}
const rewriteEmpty = `<div class="empty-result"><div class="paper-art" aria-hidden="true"><div class="paper-back"></div><div class="paper-front"><i></i><i></i><i></i><i></i></div><div class="art-spark"><svg><use href="#icon-spark"/></svg></div></div><h3>Your words, a smoother flow.</h3><p>A revision will appear here.<br>Your original will stay in the editor.</p></div>`;
const empty = `<div class="empty-result"><div class="paper-art" aria-hidden="true"><div class="paper-back"></div><div class="paper-front"><i></i><i></i><i></i><i></i></div><div class="art-spark"><svg><use href="#icon-spark"/></svg></div></div><h3>Let’s read between the lines.</h3><p>Your writing patterns will appear here,<br>with a little context for each one.</p></div>`;
function status(text) { $('result-status').replaceChildren(); const dot = document.createElement('span'); dot.className = 'status-dot'; $('result-status').append(dot, document.createTextNode(text)); }
function showError(message) { $('input-error').textContent = message; $('input-error').hidden = false; input.setAttribute('aria-invalid', 'true'); }
function resetResults() {
  revision++; result = null;
  pendingRewrite?.abort(); pendingRewrite = null;
  $('result-content').innerHTML = mode === 'rewrite' ? rewriteEmpty : empty;
  status('Ready when you are');
  document.querySelector('.results-panel').setAttribute('aria-busy', 'false');
  idleButton();
}
function update() {
  resetResults();
  $('input-error').hidden = true;
  input.removeAttribute('aria-invalid');
  const n = words(input.value).length;
  $('count').textContent = `${n.toLocaleString('en-US')} ${n === 1 ? 'word' : 'words'}`;
  $('word-progress').style.width = `${Math.min(n / LIMITS.maxWords * 100, 100)}%`;
  $('word-progress').style.background = n > LIMITS.maxWords ? '#a3412e' : '#8aa56d';
  $('paste').hidden = !!input.value;
  if (n > LIMITS.maxWords || input.value.length > LIMITS.maxChars) showError(validate(input.value));
}
input.addEventListener('input', () => { fileRevision++; update(); });
$('clear').addEventListener('click', () => { fileRevision++; beforeSample = null; $('undo-sample').hidden = true; input.value = ''; $('file').value = ''; update(); input.focus(); });
$('paste').addEventListener('click', async () => {
  const current = revision;
  try {
    const text = await navigator.clipboard.readText();
    if (revision !== current) return;
    if (text.length > LIMITS.maxChars) throw new Error('Clipboard text is too large. Paste an excerpt under 100,000 characters instead.');
    input.value = text; update(); input.focus();
    if (!text) showError('Your clipboard is empty. Copy some text, then paste it here.');
  } catch (e) {
    showError(e.message.startsWith('Clipboard text') ? e.message : 'Clipboard access is unavailable. Click in the editor and use Ctrl+V or ⌘V to paste.');
    input.focus();
  }
});
const samples = {
  human: `I nearly missed the turn to my grandmother’s old house. The hedge had grown taller, and someone had painted the gate blue. It used to be red; I remember because I spent one entire summer picking flakes of paint off it while waiting for her to answer the door.\n\nOn Saturday I went back with a box of photographs. The new owner, a man named Sam, let me stand in the kitchen for a minute. Nothing dramatic happened. The room smelled of coffee instead of toast, and the table was in the wrong corner. I showed him a picture of my grandmother beside the sink. He smiled and pointed to the same crooked tile, still there after all these years.\n\nI thought the visit would make me sad. Mostly, though, I was glad somebody was using the kitchen. On the way home I bought a small tin of red paint. I haven’t decided what to do with it yet.`,
  ai: `Community gardens offer a range of benefits for urban neighborhoods. They provide opportunities for residents to grow fresh produce, develop practical skills, and build meaningful connections. By creating shared green spaces, communities can support both individual well-being and collective resilience.\n\nOne important benefit is improved access to nutritious food. Residents can grow seasonal vegetables and herbs while learning about sustainable cultivation methods. These activities encourage healthier habits and provide a practical introduction to environmental responsibility.\n\nAnother important benefit is stronger social connection. Shared planting sessions bring people together around a common purpose. Residents can exchange knowledge, collaborate on projects, and contribute to a welcoming neighborhood environment.\n\nSuccessful community gardens require thoughtful planning and ongoing participation. Clear guidelines, accessible facilities, and consistent communication help ensure that all participants can contribute. With the right support, these spaces can become valuable resources that strengthen neighborhoods and create lasting opportunities for collaboration.`
};
for (const [id, key] of [['human-sample', 'human'], ['ai-sample', 'ai']]) $(id).addEventListener('click', () => { fileRevision++; if (beforeSample === null) beforeSample = input.value; input.value = samples[key]; $('undo-sample').hidden = false; update(); input.focus(); });
$('undo-sample').addEventListener('click', () => { if (beforeSample === null) return; fileRevision++; input.value = beforeSample; beforeSample = null; $('undo-sample').hidden = true; update(); input.focus(); });
$('upload').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = '';
  if (!file) return;
  const current = ++fileRevision;
  if (!/\.txt$/i.test(file.name)) { showError('Please choose a .txt file. PDF, Word, and other formats are not supported.'); return; }
  if (file.size > LIMITS.maxBytes) { showError('That file is too large. Choose a UTF-8 .txt file up to 100 KB.'); return; }
  try {
    const buffer = await file.arrayBuffer();
    if (current !== fileRevision) return;
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)) throw new Error('binary');
    input.value = text; update(); input.focus();
    if (!text.trim()) showError('That file is empty. Choose another file or paste some text.');
  } catch { if (current === fileRevision) showError('This file could not be read as plain text. Save it as UTF-8 .txt and try again.'); }
});
function renderResult(r) {
  const metrics = [
    ['Sentence length', `${r.averageSentenceLength} words`, `Average across ${r.sentenceCount} sentences; lengths range from ${r.shortestSentence} to ${r.longestSentence} words. Punctuation affects sentence boundaries.`],
    ['Vocabulary variety', `${r.uniqueWords} unique words`, `Out of ${r.wordCount} total words, ignoring case. Longer passages naturally repeat more words.`],
    ['Repeated phrases', `${r.repeatedPhraseCount} found`, 'Distinct three-word phrases that appear more than once. Repetition is common in all kinds of writing.']
  ];
  const root = document.createElement('div'); root.className = 'result-data';
  const title = document.createElement('h3'); title.textContent = 'A snapshot of your writing.';
  const subtitle = document.createElement('p'); subtitle.className = 'result-subtitle'; subtitle.textContent = 'Descriptive patterns · No authorship assessment';
  root.append(title, subtitle);
  metrics.forEach(([label, value, explanation]) => {
    const row = document.createElement('div'); row.className = 'metric';
    const name = document.createElement('span'); name.textContent = label;
    const val = document.createElement('strong'); val.textContent = value;
    const description = document.createElement('p'); description.textContent = explanation;
    row.append(name, val, description); root.append(row);
  });
  const download = document.createElement('button'); download.className = 'report-button';
  download.innerHTML = '<svg><use href="#icon-download"/></svg>Download report (.txt)';
  download.addEventListener('click', () => {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([createReport(result)], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'free-ai-detector-pattern-report.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  root.append(download); $('result-content').replaceChildren(root); status('Analysis complete');
}
function saveText(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function renderRewrite(text) {
  const root = document.createElement('div'); root.className = 'result-data rewrite-data';
  const label = document.createElement('label'); label.htmlFor = 'rewritten-output'; label.textContent = 'Your revised text';
  const output = document.createElement('textarea'); output.id = 'rewritten-output'; output.readOnly = true; output.value = text;
  const note = document.createElement('p'); note.className = 'result-subtitle'; note.textContent = 'AI-assisted edit. Compare details and meaning with your original.';
  const actions = document.createElement('div'); actions.className = 'rewrite-actions';
  const copy = document.createElement('button'); copy.className = 'report-button'; copy.textContent = 'Copy revision';
  copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(text); copy.textContent = 'Copied'; } catch { output.focus(); output.select(); copy.textContent = 'Use Ctrl/Cmd+C to copy'; } });
  const download = document.createElement('button'); download.className = 'report-button'; download.textContent = 'Download .txt'; download.addEventListener('click', () => saveText(text, 'revised-text.txt'));
  actions.append(copy, download); root.append(label, output, note, actions); $('result-content').replaceChildren(root); status('Revision ready');
}
$('analyze').addEventListener('click', async () => {
  const n = words(input.value).length;
  const error = mode === 'detect' ? validate(input.value) : (!input.value.trim() ? 'Paste your text first.' : n < 5 ? 'Add at least 5 words to rewrite.' : n > 1500 || input.value.length > 100000 ? 'Use no more than 1,500 words and 100,000 characters.' : null);
  if (error) { showError(error); input.focus(); return; }
  if (mode === 'rewrite' && !rewriteReady) { showError('The rewrite service needs to be connected by the site owner first. Your text has not been sent.'); return; }
  $('input-error').hidden = true; input.removeAttribute('aria-invalid');
  const current = revision; const text = input.value; const rewriting = mode === 'rewrite';
  $('analyze').disabled = true; $('analyze').textContent = rewriting ? 'Rewriting…' : 'Analyzing…'; status(rewriting ? 'Editing your wording' : 'Reading your patterns');
  document.querySelector('.results-panel').setAttribute('aria-busy', 'true');
  $('result-content').innerHTML = '<div class="empty-result loading-result"><div class="loading-orbit" aria-hidden="true"></div><h3>' + (rewriting ? 'A more natural flow…' : 'A little closer look…') + '</h3><p>' + (rewriting ? 'Your original stays safe in the editor.' : 'Measuring writing patterns locally.') + '</p></div>';
  try {
    if (rewriting) {
      const controller = new AbortController(); pendingRewrite = controller;
      const timer = setTimeout(() => controller.abort(), 50000);
      try {
        const response = await fetch('/api/rewrite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal: controller.signal });
        const data = await response.json();
        if (current !== revision) return;
        if (!response.ok) throw new Error(data.error || 'The rewrite did not finish. Your original is safe.');
        if (typeof data.text !== 'string' || !data.text.trim()) throw new Error('The service returned no revision. Your original is safe.');
        renderRewrite(data.text);
      } finally { clearTimeout(timer); }
    } else {
      await new Promise(resolve => setTimeout(resolve, 650));
      if (current !== revision) return;
      result = analyzeText(text); renderResult(result);
    }
  } catch (error) {
    if (current !== revision) return;
    result = null; status(rewriting ? 'Rewrite unavailable' : 'Analysis unavailable');
    $('result-content').innerHTML = '<div class="empty-result loading-result"><h3>Your original is still here.</h3><p>The request did not complete. Read the message below the editor and try again.</p></div>';
    showError(error.name === 'AbortError' ? 'The request timed out. Your original is safe; try again.' : error.message || 'The request failed. Please try again.');
  } finally {
    if (current === revision) { pendingRewrite = null; document.querySelector('.results-panel').setAttribute('aria-busy', 'false'); idleButton(); }
  }
});
function setMode(next) {
  mode = next;
  const rewriting = mode === 'rewrite';
  $('rewrite-mode').setAttribute('aria-pressed', String(rewriting)); $('detect-mode').setAttribute('aria-pressed', String(!rewriting));
  $('tool-heading').textContent = rewriting ? 'Humanize text' : 'AI text detector';
  $('mode-badge').textContent = rewriting ? (rewriteReady ? 'AI-ASSISTED' : 'SETUP NEEDED') : 'EXPERIMENTAL';
  $('result-label').textContent = rewriting ? 'YOUR REVISION' : 'YOUR ANALYSIS';
  $('guidance').textContent = rewriting ? 'Use 5–1,500 words to rewrite.' : 'Use 50–1,500 words of English prose.';
  $('rewrite-setup').hidden = !rewriting || rewriteReady;
  $('result-footnote').innerHTML = rewriting ? 'Review any revision before using it.<br>No promise of bypassing an AI detector.' : 'Patterns offer perspective, not proof.<br>No result can establish who wrote a text.';
  $('mode-disclosure').innerHTML = rewriting ? '<strong>You stay in control.</strong> Rewriting sends text to OpenAI through this site’s server. Your original is never replaced. Review facts, tone, and meaning before using a revision.' : '<strong>A transparent starting point.</strong> This demo measures writing patterns. A trained AI detector is not connected; it does not provide an AI probability.';
  update();
}
$('rewrite-mode').addEventListener('click', () => setMode('rewrite'));
$('detect-mode').addEventListener('click', () => setMode('detect'));
async function checkService() {
  try { const response = await fetch('/api/status', { cache: 'no-store' }); const data = await response.json(); rewriteReady = response.ok && data.rewriteConfigured === true; } catch { rewriteReady = false; }
  $('rewrite-setup').textContent = rewriteReady ? '' : 'Rewriting is not connected yet. The site owner must configure the model service before this button can work. Your text has not been sent.';
  $('rewrite-setup').hidden = mode !== 'rewrite' || rewriteReady;
  if (mode === 'rewrite') $('mode-badge').textContent = rewriteReady ? 'AI-ASSISTED' : 'SETUP NEEDED';
  idleButton();
}
input.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); $('analyze').click(); } });
const legal = {
  privacy: ['Privacy', '<p>Pattern analysis runs entirely in your browser. It does not transmit text. Rewriting, once configured, sends your passage to this site’s server and then OpenAI. The app does not save submissions or log their content. Provider requests use store:false; provider retention and abuse-monitoring policies may still apply.</p><p>Do not submit sensitive material. Your original and revision remain in page memory until you reload. Reports, copies, and downloads are created only when you choose. Google Fonts and hosting services receive ordinary network requests and may retain access metadata.</p><p>No ad scripts or analytics are installed. Review <a href="https://platform.openai.com/docs/guides/your-data" target="_blank" rel="noopener noreferrer">OpenAI data controls</a> before using rewriting.</p>'],
  terms: ['Terms of use', '<p>The humanizer offers AI-assisted editing, with no guarantee that all facts, meaning, or tone will be preserved. Compare the revision against your original before using it. It does not promise to evade detection or establish human authorship.</p><p>Pattern analysis is a local experimental demo, not a trained AI detector. Never use it alone for academic, employment, or disciplinary decisions. You retain rights to your text and are responsible for material you submit.</p><p>The tool is provided as available. Rewriting requires a configured, paid model service funded by the site owner.</p>'],
  contact: ['Contact', '<p>This is an experimental preview. A public support address has not been configured yet.</p><p>For feedback on this build, return to the ChatGPT conversation where this site was created. Please describe the issue without including private or sensitive passages.</p>']
};
for (const button of document.querySelectorAll('[data-dialog]')) button.addEventListener('click', () => {
  const [title, body] = legal[button.dataset.dialog]; $('dialog-title').textContent = title; $('dialog-body').innerHTML = body; $('legal').showModal();
});
$('legal').setAttribute('aria-labelledby', 'dialog-title');
$('close-dialog').addEventListener('click', () => $('legal').close());
$('legal').addEventListener('click', event => { const rect = $('legal').getBoundingClientRect(); if (event.target === $('legal') && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) $('legal').close(); });
$('year').textContent = new Date().getFullYear();
setMode('rewrite');
checkService();
