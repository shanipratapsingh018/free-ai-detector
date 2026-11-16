/**
 * Browser end-to-end tests. Starts the real Worker with `wrangler dev` (no provider keys),
 * then uses Playwright. Provider-backed flows are exercised by mocking /api/* routes in the
 * browser, so no paid requests are ever made. Run: npm run test:e2e
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const PORT = 8791;
const BASE = `http://127.0.0.1:${PORT}`;
const fixture = name => new URL(`../fixtures/${name}`, import.meta.url).pathname;
let server, browser;

const DETECT = {
  provider: 'GPTZero', providerUrl: 'https://gptzero.me', modelVersion: '2026-10-07-base', scanId: 'scan-1',
  predictedClass: 'mixed', confidenceCategory: 'medium', classProbabilities: { human: 0.18, mixed: 0.62, ai: 0.2 },
  resultMessage: 'Our detector is moderately confident that the text may include parts written by AI.',
  subclass: 'polished', highlightedSentences: ['Furthermore, leveraging digital tools such as calendars and task management applications can streamline workflows and foster greater accountability.'],
  sentenceCount: 6, checkedAt: '2026-11-16T12:00:00.000Z',
};
const STATUS_ON = { detector: { available: true, provider: 'GPTZero' }, writer: { available: true, provider: 'OpenAI', model: 'gpt-test' } };

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/api/status`)).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('wrangler dev did not start');
}

before(async () => {
  server = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--ip', '127.0.0.1'], { env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: 'ignore', detached: true });
  await waitForServer();
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  try { process.kill(-server.pid); } catch {}
});

/** New page; when `mock` is set, /api/* is answered in-browser and calls are recorded. */
async function open({ mock, viewport = { width: 1440, height: 1000 }, ...ctxOpts } = {}) {
  const context = await browser.newContext({ viewport, acceptDownloads: true, ...ctxOpts });
  const page = await context.newPage();
  const calls = [];
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/status of (4|5)\d\d/.test(m.text())) errors.push(m.text()); });
  if (mock) {
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      const body = route.request().postData() ? JSON.parse(route.request().postData()) : null;
      calls.push({ path: url.pathname + url.search, body });
      const r = await mock(url, body, calls);
      if (r.delay) await new Promise(res => setTimeout(res, r.delay));
      await route.fulfill({ status: r.status || 200, contentType: 'application/json', body: JSON.stringify(r.json) }).catch(() => {});
    });
  }
  await page.goto(BASE);
  return { page, calls, errors, context };
}
const statusOn = (handlers = {}) => async (url, body, calls) => {
  if (url.pathname === '/api/status') return { json: STATUS_ON };
  if (url.pathname === '/api/detect') return handlers.detect ? handlers.detect(body, calls) : { json: { result: DETECT } };
  if (url.pathname === '/api/revise') return handlers.revise(url.searchParams.get('mode'), body, calls);
  return { status: 404, json: {} };
};
const editorValue = page => page.locator('#editor').inputValue();
/** Dialog 'close' events fire asynchronously; poll until the editor matches. */
const waitForEditor = (page, re) => page.waitForFunction(src => new RegExp(src).test(document.getElementById('editor').value), re.source);

test('real Worker without keys: “Score unavailable”, no fake number, button disabled, no console errors', async () => {
  const { page, errors, context } = await open();
  await page.click('[data-sample="polished"]');
  await page.locator('#results-body', { hasText: 'Score unavailable' }).waitFor();
  assert.equal(await page.locator('#run-btn').isDisabled(), true);
  assert.equal(await page.locator('.prob-row').count(), 0);
  assert.doesNotMatch(await page.locator('#results-body').innerText(), /\d+%/);
  await page.click('[data-mode="humanize"]');
  await page.locator('#results-body', { hasText: 'Writing tools unavailable' }).waitFor();
  // Security headers from public/_headers are applied
  const res = await page.request.get(BASE);
  assert.match(res.headers()['content-security-policy'], /default-src 'self'/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('detection success: separate class probabilities, honest explanation, provider metadata, report & copy', async () => {
  const { page, calls, errors, context } = await open({ mock: statusOn(), permissions: ['clipboard-read', 'clipboard-write'] });
  await page.click('[data-sample="polished"]');
  await page.click('#run-btn');
  await page.locator('.prob-row').first().waitFor();
  const rows = await page.locator('.prob-row').allInnerTexts();
  assert.deepEqual(rows.map(r => r.replace(/\s+/g, ' ').trim()), ['Human 18%', 'Mixed · predicted 62%', 'AI 20%']);
  const text = await page.locator('#results-body').innerText();
  assert.match(text, /Mixed human and AI writing/);
  assert.match(text, /not the share of words written by AI/);
  assert.match(text, /can’t prove who wrote a text/);
  assert.match(text, /2026-10-07-base/);
  assert.match(text, /Human writing polished by AI/);
  assert.equal(calls.filter(c => c.path === '/api/detect').length, 1);

  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=Download report')]);
  const report = readFileSync(await dl.path(), 'utf8');
  assert.match(report, /Detector version: 2026-10-07-base/);
  assert.match(report, /NOT the percentage of words written by AI/);
  assert.doesNotMatch(report, /fast-paced world/, 'text excluded by default');
  await page.check('#include-text');
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('text=Download report')]);
  assert.match(readFileSync(await dl2.path(), 'utf8'), /fast-paced world/);

  await page.click('text=Copy summary');
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /Human 18%, Mixed 62%, AI 20%/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('validation: too-short text never triggers a request', async () => {
  const { page, calls, context } = await open({ mock: statusOn() });
  await page.fill('#editor', 'Only a few words here.');
  await page.click('#run-btn');
  await page.locator('#input-msg', { hasText: 'at least 50 words' }).waitFor();
  assert.equal(await page.locator('#editor').getAttribute('aria-invalid'), 'true');
  assert.equal(calls.filter(c => c.path !== '/api/status').length, 0);
  await page.fill('#editor', 'word '.repeat(2600));
  await page.locator('#input-msg', { hasText: 'nothing has been cut' }).waitFor();
  await context.close();
});

test('stale responses: editing during a request clears it and the late response is ignored', async () => {
  const { page, context } = await open({ mock: statusOn({ detect: () => ({ json: { result: DETECT }, delay: 1500 }) }) });
  await page.click('[data-sample="casual"]');
  await page.click('#run-btn');
  await page.locator('#results-body', { hasText: 'Checking with GPTZero' }).waitFor();
  await page.locator('#editor').press('End');
  await page.locator('#editor').type(' More.');
  await page.locator('#results-body', { hasText: 'Your text changed' }).waitFor();
  await page.waitForTimeout(2000);
  assert.equal(await page.locator('.prob-row').count(), 0, 'late response must not render');
  // A finished result is invalidated by later edits too
  await page.click('#run-btn');
  await page.locator('.prob-row').first().waitFor({ timeout: 5000 });
  await page.locator('#editor').type('!');
  await page.locator('#results-body', { hasText: 'Your text changed' }).waitFor();
  assert.equal(await page.locator('.prob-row').count(), 0);
  await context.close();
});

test('cancel stops a pending request without changing text', async () => {
  const { page, context } = await open({ mock: statusOn({ detect: () => ({ json: { result: DETECT }, delay: 1500 }) }) });
  await page.click('[data-sample="casual"]');
  const before = await editorValue(page);
  await page.click('#run-btn');
  await page.click('#results-body >> text=Cancel');
  await page.waitForTimeout(1800);
  assert.equal(await page.locator('.prob-row').count(), 0);
  assert.equal(await editorValue(page), before);
  await context.close();
});

test('provider errors: timeout, rate limit, server error, disconnected — always “Score unavailable”', async () => {
  const cases = [
    [{ status: 504, json: { error: { code: 'timeout', message: 'The AI detector took too long to respond.' } } }, /took too long/],
    [{ status: 429, json: { error: { code: 'rate_limited', message: 'You’re sending requests quickly.' } } }, /sending requests quickly/],
    [{ status: 502, json: { error: { code: 'provider_error', message: 'The AI detector returned an error.' } } }, /returned an error/],
    [{ status: 503, json: { error: { code: 'detector_unavailable', message: 'The AI detector is not connected.' } } }, /not connected/],
    [{ status: 500, json: 'garbage' }, /unexpected response/],
  ];
  for (const [reply, re] of cases) {
    const { page, context } = await open({ mock: statusOn({ detect: () => reply }) });
    await page.click('[data-sample="casual"]');
    await page.click('#run-btn');
    await page.locator('#results-body h4', { hasText: 'Score unavailable' }).waitFor();
    assert.match(await page.locator('#results-body').innerText(), re);
    assert.doesNotMatch(await page.locator('#results-body').innerText(), /\d+%/);
    await context.close();
  }
});

test('samples are labelled and never silently replace user text; restore works', async () => {
  const { page, context } = await open({ mock: statusOn() });
  await page.fill('#editor', 'My own draft about tide pools.');
  await page.click('[data-sample="polished"]');
  assert.match(await page.locator('#restore-msg').innerText(), /Example loaded/);
  await page.click('#restore-btn');
  assert.equal(await editorValue(page), 'My own draft about tide pools.');
  await page.click('#clear-btn');
  assert.equal(await editorValue(page), '');
  await page.click('#restore-btn');
  assert.equal(await editorValue(page), 'My own draft about tide pools.');
  await context.close();
});

test('humanize: original preserved, diff shown, explicit re-check only, use-as-text with restore', async () => {
  const revise = (mode, body) => ({ json: { result: { mode, text: body.text.replace('fast-paced', 'busy').replace('Furthermore, leveraging', 'Using'), provider: 'OpenAI', model: 'gpt-test', changed: true, missingNumbers: [], createdAt: '2026-11-16T12:00:00Z' } } });
  const { page, calls, context } = await open({ mock: statusOn({ revise }) });
  await page.click('[data-sample="polished"]');
  const original = await editorValue(page);
  await page.click('[data-mode="humanize"]');
  await page.click('#run-btn');
  await page.locator('.compare-view ins').first().waitFor();
  assert.equal(await editorValue(page), original, 'original untouched');
  assert.match(await page.locator('.compare-view ins').first().innerText(), /busy/);
  assert.match(await page.locator('.compare-view del').first().innerText(), /fast-paced/);
  assert.match(await page.locator('#results-body').innerText(), /Review facts/);
  assert.equal(calls.filter(c => c.path === '/api/detect').length, 0, 'no automatic detector call');

  await page.click('#tab-side');
  assert.equal(await page.locator('.side-by-side .compare-view').count(), 2);

  await page.click('text=Check revision for AI');
  await page.locator('.subresult .prob-row').first().waitFor();
  const detectCalls = calls.filter(c => c.path === '/api/detect');
  assert.equal(detectCalls.length, 1);
  assert.match(detectCalls[0].body.text, /busy world/, 'revision text was checked');

  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=Download .txt')]);
  assert.match(readFileSync(await dl.path(), 'utf8'), /busy world/);

  await page.click('text=Use as my text');
  assert.match(await editorValue(page), /busy world/);
  await page.click('#restore-btn');
  assert.equal(await editorValue(page), original);
  assert.equal(calls.filter(c => c.path.startsWith('/api/revise?mode=humanize')).length, 1);
  await context.close();
});

test('missing numbers warning and summarize view', async () => {
  const revise = (mode, body) => ({ json: { result: { mode, text: mode === 'summarize' ? 'A short summary of the time management passage.' : body.text.replace('2019', 'a while ago'), provider: 'Anthropic', model: 'claude-test', changed: true, missingNumbers: mode === 'summarize' ? [] : ['2019'], createdAt: '2026-11-16T12:00:00Z' } } });
  const { page, context } = await open({ mock: statusOn({ revise }) });
  await page.click('[data-sample="casual"]');
  await page.click('[data-mode="grammar"]');
  await page.click('#run-btn');
  await page.locator('.warn-note', { hasText: '2019' }).waitFor();
  await page.click('[data-mode="summarize"]');
  await page.click('#run-btn');
  await page.locator('#results-body h4', { hasText: 'Your summary' }).waitFor();
  assert.equal(await page.locator('#tab-changes').count(), 0);
  // Results are kept per tool for the same text
  await page.click('[data-mode="grammar"]');
  await page.locator('.warn-note', { hasText: '2019' }).waitFor();
  await context.close();
});

test('uploads: PDF and DOCX extracted for review; failures explained', async () => {
  const { page, errors, context } = await open({ mock: statusOn() });
  await page.setInputFiles('#file-input', fixture('sample.pdf'));
  await page.locator('#review-dialog[open]').waitFor();
  assert.match(await page.locator('#review-text').inputValue(), /river rose 3\.5 metres/);
  assert.match(await page.locator('#review-meta').innerText(), /2 pages/);
  await page.click('#review-replace');
  await waitForEditor(page, /Recovery took eleven weeks/);

  await page.setInputFiles('#file-input', fixture('sample.docx'));
  await page.locator('#review-dialog[open]').waitFor();
  await page.click('#review-append');
  await waitForEditor(page, /eleven weeks\.\n\nQuarterly notes/);
  await page.click('#restore-btn');
  assert.doesNotMatch(await editorValue(page), /Quarterly/);

  await page.setInputFiles('#file-input', fixture('sample.docx'));
  await page.locator('#review-dialog[open]').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('#review-dialog:not([open])').waitFor({ state: 'attached' });
  await page.waitForTimeout(100);
  assert.doesNotMatch(await editorValue(page), /Quarterly/, 'cancel inserts nothing');

  const failures = [
    ['encrypted.pdf', /password-protected/],
    ['image-only.pdf', /scanned images/],
    ['encrypted.docx', /password-protected/],
  ];
  for (const [f, re] of failures) {
    await page.setInputFiles('#file-input', fixture(f));
    await page.locator('#input-msg', { hasText: re }).waitFor();
  }
  await page.setInputFiles('#file-input', { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('x') });
  await page.locator('#input-msg', { hasText: 'isn’t supported' }).waitFor();
  await page.setInputFiles('#file-input', { name: 'big.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(11 * 1024 * 1024) });
  await page.locator('#input-msg', { hasText: 'limit for this type is 10 MB' }).waitFor();
  assert.match(await editorValue(page), /Recovery took eleven weeks/, 'failed uploads leave text untouched');
  assert.deepEqual(errors.filter(e => /Content Security Policy|Refused/i.test(e)), [], 'pdf.js runs under the CSP');
  await context.close();
});

test('drag and drop a file onto the editor', async () => {
  const { page, context } = await open({ mock: statusOn() });
  const content = readFileSync(fixture('sample.docx')).toString('base64');
  await page.evaluate(b64 => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'dropped.docx'));
    const zone = document.getElementById('drop-zone');
    zone.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true, cancelable: true }));
    zone.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, content);
  await page.locator('#review-dialog[open]').waitFor();
  assert.match(await page.locator('#review-meta').innerText(), /dropped\.docx/);
  await context.close();
});

test('keyboard: mode radiogroup arrows, Ctrl+Enter submits, dialogs close with Escape and restore focus', async () => {
  const { page, calls, context } = await open({ mock: statusOn() });
  await page.focus('[data-mode="detect"]');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.mode), 'humanize');
  assert.equal(await page.getAttribute('[data-mode="humanize"]', 'aria-checked'), 'true');
  await page.keyboard.press('End');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.mode), 'summarize');
  await page.keyboard.press('Home');
  await page.click('[data-sample="casual"]');
  await page.focus('#editor');
  await page.keyboard.press('Control+Enter');
  await page.locator('.prob-row').first().waitFor();
  assert.equal(calls.filter(c => c.path === '/api/detect').length, 1);

  const privacy = page.locator('footer [data-dialog="privacy"]');
  await privacy.focus();
  await page.keyboard.press('Enter');
  await page.locator('#info-dialog[open]').waitFor();
  assert.match(await page.locator('#info-body').innerText(), /GPTZero/);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Privacy');
  await context.close();
});

test('responsive layout: results beside editor on desktop, below on tablet/mobile; no horizontal overflow', async () => {
  for (const [w, h, beside] of [[1440, 1000, true], [1024, 768, true], [820, 1180, false], [390, 844, false], [320, 640, false]]) {
    const { page, context } = await open({ mock: statusOn(), viewport: { width: w, height: h } });
    const e = await page.locator('.editor-panel').boundingBox();
    const r = await page.locator('.results-panel').boundingBox();
    if (beside) { assert.ok(r.x > e.x + e.width - 1, `${w}: beside`); }
    else { assert.ok(r.y >= e.y + e.height - 1, `${w}: below`); }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `${w}px has horizontal overflow ${overflow}`);
    await context.close();
  }
});

test('reduced motion is respected', async () => {
  const { page, context } = await open({ mock: statusOn(), reducedMotion: 'reduce' });
  const d = await page.evaluate(() => getComputedStyle(document.querySelector('.mode')).transitionDuration);
  assert.ok(d.split(',').every(x => parseFloat(x) < 0.01), d);
  await context.close();
});

test('axe accessibility scan: no serious/critical violations in empty, result, and dialog states', async () => {
  const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
  const { page, context } = await open({ mock: statusOn() });
  const scan = async label => {
    // Let entrance animations finish so contrast is measured at rest.
    await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
    await page.addScriptTag({ content: axeSource }).catch(async () => page.evaluate(axeSource));
    const res = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations
      .filter(v => ['serious', 'critical'].includes(v.impact)).map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`));
    assert.deepEqual(res, [], label);
  };
  await scan('empty');
  await page.click('[data-sample="polished"]');
  await page.click('#run-btn');
  await page.locator('.prob-row').first().waitFor();
  await page.waitForTimeout(800);
  await scan('detect result');
  await page.click('footer [data-dialog="terms"]');
  await scan('dialog');
  await context.close();
});
