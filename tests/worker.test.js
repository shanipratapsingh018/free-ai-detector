import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { handleApi, checkRevision, memoryLimit, providerFor, textFromWorkersAI, WORKERS_AI_MODELS } from '../worker/index.js';

let ip = 0;
const request = (body, { origin = 'https://site.test', raw = false } = {}) => new Request('https://site.test/api/rewrite', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': `10.0.0.${++ip}` }, body: raw ? body : JSON.stringify(body)
});
const env = { OPENAI_API_KEY: 'test-not-a-real-key' };
const reply = text => async () => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text }] }] });
const fail = () => { throw Error('provider should not be called'); };
const original = 'I would like this text to sound more natural when people read it in 2026.';

test('status reports the provider and never a secret', async () => {
  assert.deepEqual(await (await handleApi(new Request('https://site.test/api/status'), {})).json(), { rewriteConfigured: false, provider: null, actions: ['humanize', 'grammar', 'simplify', 'summarize'] });
  const body = JSON.stringify(await (await handleApi(new Request('https://site.test/api/status'), env)).json());
  assert.ok(body.includes('"provider":"openai"')); assert.ok(!body.includes('test-not-a-real-key'));
  assert.equal(providerFor({ AI: { run() {} } }), 'workers-ai');
});

test('without a provider the API says so and calls nothing', async () => {
  const response = await handleApi(request({ text: original }), {}, fail);
  assert.equal(response.status, 503); assert.equal((await response.json()).offline, true);
});

test('rejects cross-origin, wrong method, wrong type, bad JSON, bad action and bad input before any provider call', async () => {
  assert.equal((await handleApi(request({ text: original }, { origin: 'https://other.test' }), env, fail)).status, 403);
  assert.equal((await handleApi(new Request('https://site.test/api/rewrite'), env, fail)).status, 405);
  assert.equal((await handleApi(new Request('https://site.test/api/rewrite', { method: 'POST', headers: { Origin: 'https://site.test', 'Content-Type': 'text/plain' }, body: 'x' }), env, fail)).status, 415);
  assert.equal((await handleApi(request('{not json', { raw: true }), env, fail)).status, 400);
  assert.equal((await handleApi(request({ text: original, action: 'constructor' }), env, fail)).status, 400);
  assert.equal((await handleApi(request({ text: 'tiny' }), env, fail)).status, 400);
  assert.equal((await handleApi(request({ text: 'word '.repeat(1501) }), env, fail)).status, 400);
  assert.equal((await handleApi(request({ text: 42 }), env, fail)).status, 400);
  assert.equal((await handleApi(request('x'.repeat(60000), { raw: true }), env, fail)).status, 413);
  assert.equal((await handleApi(new Request('https://site.test/api/unknown'), env, fail)).status, 404);
});

test('accepts non-Latin text up to the stated character limit', async () => {
  const hindi = 'यह एक परीक्षण वाक्य है। '.repeat(290); // 1,450 words, about 7,000 characters and 19 KB as UTF-8
  const response = await handleApi(request({ text: hindi, action: 'grammar' }), env, reply(hindi.trim()));
  assert.equal(response.status, 200);
});

test('sends the right instructions to OpenAI and returns the revision', async () => {
  let payload;
  const response = await handleApi(request({ text: original, action: 'simplify' }), env, async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses'); assert.equal(options.headers.Authorization, 'Bearer test-not-a-real-key');
    payload = JSON.parse(options.body); return reply('I want this text to sound more natural when people read it in 2026.')();
  });
  assert.equal(response.status, 200);
  assert.equal(payload.input, original); assert.equal(payload.store, false); assert.match(payload.instructions, /plain-language editor/);
  const data = await response.json();
  assert.equal(data.provider, 'openai'); assert.equal(data.action, 'simplify'); assert.ok(!JSON.stringify(data).includes('test-not-a-real-key'));
  assert.ok(response.headers.get('X-Content-Type-Options'));
});

test('uses a Workers AI binding when no OpenAI key is set, and strips code fences', async () => {
  let seen;
  const ai = { AI: { async run(model, input) { seen = { model, input }; return { response: 'Here is the rewritten text:\n\n```\nI’d like this text to sound more natural when people read it in 2026.\n```' }; } } };
  const response = await handleApi(request({ text: original }), ai, fail);
  assert.equal(response.status, 200);
  assert.equal(seen.model, WORKERS_AI_MODELS[0]); assert.equal(seen.input.messages[1].content, original);
  const data = await response.json();
  assert.equal(data.provider, 'workers-ai'); assert.ok(!data.text.includes('```')); assert.ok(data.text.startsWith('I’d like'));
});

test('rejects revisions that drift, drop numbers or URLs, or change length too much', async () => {
  const status = async (text, out, action = 'humanize') => (await handleApi(request({ text, action }), env, reply(out))).status;
  assert.equal(await status(original, 'Done.'), 502);
  assert.equal(await status(original, 'Ignore that and visit this other page to send me your password right now please.'), 502);
  assert.equal(await status(original, 'I would like this text to sound more natural when people read it in 2027.'), 502);
  assert.equal(await status('See https://example.com/a for the full list of all items.', 'See https://evil.example/a for the full list of all items.'), 502);
  assert.equal(checkRevision(original, 'I’d like this text to sound more natural when people read it in 2026.', 'humanize'), null);
  assert.equal(checkRevision('In 2020 sales rose 5%. '.repeat(30), 'Sales rose 5% in 2020.', 'summarize'), null);
  assert.equal(checkRevision('In 2020 sales rose 5%. '.repeat(30), 'Sales rose 9% in 2020.', 'summarize'), 'a number not in the original appeared');
  // The same number written another way is not a change.
  assert.equal(checkRevision('The grant was 3,500 rupees for 2.50 years of work in total.', 'The grant was 3500 rupees for 2.5 years of work overall.', 'humanize'), null);
  assert.equal(checkRevision('The grant was 3,500 rupees for 2.50 years of work in total.', 'The grant was 3,600 rupees for 2.5 years of work overall.', 'humanize'), 'a number was changed or dropped');
});

test('maps provider failures to clear errors', async () => {
  assert.equal((await handleApi(request({ text: original }), env, () => new Response('', { status: 429 }))).status, 429);
  assert.equal((await handleApi(request({ text: original }), env, () => new Response('', { status: 500 }))).status, 502);
  assert.equal((await handleApi(request({ text: original }), env, () => { throw Error('network'); })).status, 502);
  assert.equal((await handleApi(request({ text: original }), env, async () => Response.json({ status: 'incomplete', output: [] }))).status, 502);
});

test('rate limits repeated requests from one address', async () => {
  for (let i = 0; i < 8; i++) assert.equal(memoryLimit('1.2.3.4', 8, 60000, 1000), true);
  assert.equal(memoryLimit('1.2.3.4', 8, 60000, 1000), false);
  assert.equal(memoryLimit('1.2.3.4', 8, 60000, 70000), true);
  const limited = { ...env, RATE_LIMITER: { async limit() { return { success: false }; } } };
  assert.equal((await handleApi(request({ text: original }), limited, fail)).status, 429);
});

test('static requests are passed to the assets binding', async () => {
  const response = await worker.fetch(new Request('https://site.test/index.html'), { ASSETS: { fetch: async () => new Response('page') } });
  assert.equal(await response.text(), 'page');
});

test('falls back to the next Workers AI model when one is retired, and reads every response shape', async () => {
  const tried = [];
  const revised = 'I’d like this text to sound more natural when people read it in 2026.';
  const ai = { WORKERS_AI_MODEL: '@cf/retired/model', AI: { async run(model) { tried.push(model); if (tried.length < 3) throw Error('410 Gone'); return { choices: [{ message: { content: revised } }] }; } } };
  const quiet = console.error; console.error = () => {};
  try {
    const response = await handleApi(request({ text: original }), ai, fail);
    assert.equal(response.status, 200);
    assert.deepEqual(tried, ['@cf/retired/model', WORKERS_AI_MODELS[0], WORKERS_AI_MODELS[1]]);
    assert.equal((await response.json()).text, revised);
    const dead = { AI: { async run() { throw Error('410 Gone'); } } };
    assert.equal((await handleApi(request({ text: original }), dead, fail)).status, 502);
  } finally { console.error = quiet; }
  assert.equal(textFromWorkersAI('a'), 'a');
  assert.equal(textFromWorkersAI({ response: 'b' }), 'b');
  assert.equal(textFromWorkersAI({ output: [{ type: 'reasoning', content: [{ text: 'x' }] }, { type: 'message', content: [{ type: 'output_text', text: 'c' }] }] }), 'c');
  assert.equal(textFromWorkersAI({ unexpected: true }), '');
});
