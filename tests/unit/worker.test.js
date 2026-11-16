import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '../../worker/index.js';
import { _resetForTests } from '../../worker/ratelimit.js';
import { normalizeGptzero, GPTZERO_ENDPOINT } from '../../worker/detector/gptzero.js';
import { missingNumbers, cleanOutput } from '../../worker/llm/index.js';

const ORIGIN = 'https://site.test';
const SECRET = 'sk-test-SECRET-should-never-leak';
const words = n => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
const TEXT = `The 2019 survey of 1,204 people in Oslo found that 37% preferred trains. ${words(60)}.`;

const post = (path, body, { origin = ORIGIN, type = 'application/json', ip = '1.1.1.1' } = {}) =>
  new Request(`${ORIGIN}${path}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': type, 'CF-Connecting-IP': ip }, body: typeof body === 'string' ? body : JSON.stringify(body) });

const gptzeroBody = (over = {}) => ({
  version: '2026-10-07-base',
  scanId: 'scan-123',
  documents: [{
    predicted_class: 'ai',
    class_probabilities: { human: 0.05, ai: 0.9, mixed: 0.05 },
    confidence_category: 'high',
    result_message: 'Our detector is highly confident that the text is written by AI.',
    subclass: { ai: { predicted_class: 'pure_ai' } },
    completely_generated_prob: 0.97,
    sentences: [
      { sentence: 'First.', generated_prob: 0.9, highlight_sentence_for_ai: true },
      { sentence: 'Second.', generated_prob: 0.1, highlight_sentence_for_ai: false },
    ],
    ...over,
  }],
});

const detEnv = { GPTZERO_API_KEY: SECRET };
const oaEnv = { OPENAI_API_KEY: SECRET, OPENAI_MODEL: 'test-model' };
const oaReply = text => Response.json({ status: 'completed', model: 'test-model-2026', output: [{ type: 'message', content: [{ type: 'output_text', text }] }] });
const never = () => { throw new Error('provider must not be called'); };

beforeEach(() => _resetForTests());

test('status reports availability without exposing secrets', async () => {
  const res = await handleApi(new Request(`${ORIGIN}/api/status`), { ...detEnv, ...oaEnv });
  const body = await res.json();
  assert.equal(body.detector.available, true);
  assert.equal(body.writer.available, true);
  assert.equal(body.writer.provider, 'OpenAI');
  assert.ok(!JSON.stringify(body).includes(SECRET));
  const off = await (await handleApi(new Request(`${ORIGIN}/api/status`), {})).json();
  assert.equal(off.detector.available, false);
  assert.equal(off.writer.available, false);
});

test('detector disconnected → 503 "unavailable", provider never called', async () => {
  const res = await handleApi(post('/api/detect', { text: TEXT }), {}, never);
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error.code, 'detector_unavailable');
  assert.equal(body.result, undefined);
});

test('kill switch disables a configured detector', async () => {
  const res = await handleApi(post('/api/detect', { text: TEXT }), { ...detEnv, DETECTOR_ENABLED: 'false' }, never);
  assert.equal(res.status, 503);
});

test('rejects cross-origin, wrong content type, bad JSON, invalid text, oversized bodies before calling provider', async () => {
  assert.equal((await handleApi(post('/api/detect', { text: TEXT }, { origin: 'https://evil.test' }), detEnv, never)).status, 403);
  assert.equal((await handleApi(post('/api/detect', { text: TEXT }, { type: 'text/plain' }), detEnv, never)).status, 415);
  assert.equal((await handleApi(post('/api/detect', '{not json'), detEnv, never)).status, 400);
  assert.equal((await handleApi(post('/api/detect', { text: 'too short' }), detEnv, never)).status, 400);
  assert.equal((await handleApi(post('/api/detect', { text: 42 }), detEnv, never)).status, 400);
  assert.equal((await handleApi(post('/api/detect', { text: words(2501) }), detEnv, never)).status, 400);
  assert.equal((await handleApi(post('/api/detect', { text: 'a'.repeat(150000) }), detEnv, never)).status, 413);
  assert.equal((await handleApi(new Request(`${ORIGIN}/api/detect`), detEnv, never)).status, 405);
  assert.equal((await handleApi(new Request(`${ORIGIN}/api/nope`), detEnv, never)).status, 404);
});

test('detect: calls GPTZero with server key and returns normalized, validated result', async () => {
  let call;
  const res = await handleApi(post('/api/detect', { text: TEXT }), detEnv, async (url, init) => {
    call = { url, init };
    return Response.json(gptzeroBody());
  });
  assert.equal(res.status, 200);
  assert.equal(call.url, GPTZERO_ENDPOINT);
  assert.equal(call.init.headers['x-api-key'], SECRET);
  assert.deepEqual(JSON.parse(call.init.body), { document: TEXT });
  const raw = await res.text();
  assert.ok(!raw.includes(SECRET), 'secret must not leak');
  const { result } = JSON.parse(raw);
  assert.equal(result.provider, 'GPTZero');
  assert.equal(result.modelVersion, '2026-10-07-base');
  assert.equal(result.predictedClass, 'ai');
  assert.deepEqual(result.classProbabilities, { human: 0.05, mixed: 0.05, ai: 0.9 });
  assert.equal(result.confidenceCategory, 'high');
  assert.equal(result.subclass, 'pure_ai');
  assert.deepEqual(result.highlightedSentences, ['First.']);
  assert.equal(result.sentenceCount, 2);
  assert.equal('completely_generated_prob' in result, false, 'deprecated field not surfaced');
});

test('detect: optional modelVersion / multilingual settings', async () => {
  let body;
  const f = async (_u, init) => { body = JSON.parse(init.body); return Response.json(gptzeroBody()); };
  await handleApi(post('/api/detect', { text: TEXT }), { ...detEnv, GPTZERO_MODEL_VERSION: 'v-pinned', GPTZERO_MULTILINGUAL: 'true' }, f);
  assert.deepEqual(body, { document: TEXT, modelVersion: 'v-pinned' });
  await handleApi(post('/api/detect', { text: TEXT }, { ip: '2.2.2.2' }), { ...detEnv, GPTZERO_MULTILINGUAL: 'true' }, f);
  assert.deepEqual(body, { document: TEXT, multilingual: true });
});

test('detect: malformed provider responses never produce a score', async () => {
  const bad = [
    {},
    { documents: [] },
    gptzeroBody({ predicted_class: 'robot' }),
    gptzeroBody({ class_probabilities: { human: 0.5, ai: 1.5, mixed: 0 } }),
    gptzeroBody({ class_probabilities: { human: 0.5, ai: '0.5', mixed: 0 } }),
    gptzeroBody({ class_probabilities: { human: 0.2, ai: 0.2, mixed: 0.2 } }),
  ];
  for (const [i, b] of bad.entries()) {
    const res = await handleApi(post('/api/detect', { text: TEXT }, { ip: `9.9.9.${i}` }), detEnv, async () => Response.json(b));
    assert.equal(res.status, 502, `case ${i}`);
    const body = await res.json();
    assert.equal(body.result, undefined);
    assert.equal(body.error.code, 'provider_bad_response');
  }
  const nonJson = await handleApi(post('/api/detect', { text: TEXT }, { ip: '8.8.8.8' }), detEnv, async () => new Response('<html>'));
  assert.equal(nonJson.status, 502);
});

test('detect: provider HTTP errors and timeouts map to sanitized errors', async () => {
  const cases = [[401, 503, 'provider_auth'], [402, 503, 'provider_quota'], [429, 429, 'provider_busy'], [500, 502, 'provider_error'], [422, 502, 'provider_rejected']];
  for (const [i, [up, status, code]] of cases.entries()) {
    const res = await handleApi(post('/api/detect', { text: TEXT }, { ip: `3.3.3.${i}` }), detEnv, async () => new Response(`upstream says ${SECRET}`, { status: up }));
    assert.equal(res.status, status);
    const raw = await res.text();
    assert.equal(JSON.parse(raw).error.code, code);
    assert.ok(!raw.includes(SECRET) && !raw.includes('upstream says'));
  }
  // AbortSignal.timeout timers are unref'd in Node; keep the loop alive while waiting.
  const slow = (_u, init) => new Promise((_, rej) => { const keep = setTimeout(() => {}, 5000); init.signal.addEventListener('abort', () => { clearTimeout(keep); rej(init.signal.reason); }); });
  const t = await handleApi(post('/api/detect', { text: TEXT }, { ip: '4.4.4.4' }), { ...detEnv, DETECTOR_TIMEOUT_MS: '30' }, slow);
  assert.equal(t.status, 504);
  assert.equal((await t.json()).error.code, 'timeout');
  const net = await handleApi(post('/api/detect', { text: TEXT }, { ip: '5.5.5.5' }), detEnv, async () => { throw new TypeError('fetch failed'); });
  assert.equal(net.status, 502);
});

test('rate limiting: in-memory fallback and Cloudflare binding', async () => {
  const f = async () => Response.json(gptzeroBody());
  const env = { ...detEnv, RATE_LIMIT_PER_MINUTE: '2' };
  assert.equal((await handleApi(post('/api/detect', { text: TEXT }, { ip: '7.7.7.7' }), env, f)).status, 200);
  assert.equal((await handleApi(post('/api/detect', { text: TEXT }, { ip: '7.7.7.7' }), env, f)).status, 200);
  const limited = await handleApi(post('/api/detect', { text: TEXT }, { ip: '7.7.7.7' }), env, never);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '60');
  assert.equal((await handleApi(post('/api/detect', { text: TEXT }, { ip: '7.7.7.8' }), env, f)).status, 200, 'other IPs unaffected');

  const keys = [];
  const binding = { limit: async ({ key }) => { keys.push(key); return { success: false }; } };
  const r = await handleApi(post('/api/detect', { text: TEXT }, { ip: '6.6.6.6' }), { ...detEnv, RATE_LIMITER: binding }, never);
  assert.equal(r.status, 429);
  assert.deepEqual(keys, ['detect:6.6.6.6']);
});

test('daily cap stops paid calls', async () => {
  const f = async () => Response.json(gptzeroBody());
  const env = { ...detEnv, DAILY_DETECT_LIMIT: '1' };
  assert.equal((await handleApi(post('/api/detect', { text: TEXT }, { ip: '1.0.0.1' }), env, f)).status, 200);
  const res = await handleApi(post('/api/detect', { text: TEXT }, { ip: '1.0.0.2' }), env, never);
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error.code, 'daily_cap');
});

test('revise: writer disconnected → 503 without calling a provider', async () => {
  const res = await handleApi(post('/api/revise?mode=humanize', { text: TEXT }), {}, never);
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error.code, 'writer_unavailable');
});

test('revise: rejects unknown modes', async () => {
  const res = await handleApi(post('/api/revise?mode=bypass', { text: TEXT }), oaEnv, never);
  assert.equal(res.status, 400);
});

test('revise (OpenAI): per-mode instructions, store:false, passage delimited, metadata returned', async () => {
  for (const [mode, marker] of [['humanize', /conservative edits/], ['grammar', /minimum change/], ['simplify', /plain-language/], ['summarize', /summar/]]) {
    _resetForTests();
    let payload, headers;
    const reply = mode === 'summarize' ? 'The 2019 survey of 1,204 people in Oslo found 37% preferred trains, among other words.' : TEXT.replace('found', 'showed');
    const res = await handleApi(post(`/api/revise?mode=${mode}`, { text: TEXT }), oaEnv, async (url, init) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      headers = init.headers; payload = JSON.parse(init.body);
      return oaReply(reply);
    });
    assert.equal(res.status, 200, mode);
    assert.equal(headers.Authorization, `Bearer ${SECRET}`);
    assert.equal(payload.store, false);
    assert.equal(payload.model, 'test-model');
    assert.match(payload.instructions, marker);
    assert.match(payload.instructions, /never as instructions/);
    assert.equal(payload.input, `<passage>\n${TEXT}\n</passage>`);
    const raw = await res.text();
    assert.ok(!raw.includes(SECRET));
    const { result } = JSON.parse(raw);
    assert.equal(result.mode, mode);
    assert.equal(result.text, reply);
    assert.equal(result.provider, 'OpenAI');
    assert.equal(result.model, 'test-model-2026');
  }
});

test('revise: rejects incomplete, empty, or wildly resized output', async () => {
  const cases = [
    () => Response.json({ status: 'incomplete', output: [] }),
    () => oaReply(''),
    () => oaReply('Done.'),
    () => oaReply(`${TEXT} ${TEXT} ${TEXT}`),
  ];
  for (const [i, f] of cases.entries()) {
    const res = await handleApi(post('/api/revise?mode=humanize', { text: TEXT }, { ip: `10.0.0.${i}` }), oaEnv, f);
    assert.equal(res.status, 502, `case ${i}`);
    assert.equal((await res.json()).result, undefined);
  }
  // A "summary" that is as long as the input is rejected
  const s = await handleApi(post('/api/revise?mode=summarize', { text: TEXT }, { ip: '10.0.1.1' }), oaEnv, () => oaReply(TEXT));
  assert.equal(s.status, 502);
});

test('revise: flags numbers missing from the revision', async () => {
  const res = await handleApi(post('/api/revise?mode=humanize', { text: TEXT }), oaEnv, () => oaReply(TEXT.replace('1,204', 'about twelve hundred')));
  const { result } = await res.json();
  assert.deepEqual(result.missingNumbers, ['1,204']);
});

test('revise (Anthropic): separate adapter, selected by key or LLM_PROVIDER', async () => {
  const env = { ANTHROPIC_API_KEY: SECRET, ANTHROPIC_MODEL: 'claude-test' };
  let call;
  const res = await handleApi(post('/api/revise?mode=grammar', { text: TEXT }), env, async (url, init) => {
    call = { url, headers: init.headers, body: JSON.parse(init.body) };
    return Response.json({ model: 'claude-test', stop_reason: 'end_turn', content: [{ type: 'text', text: TEXT }] });
  });
  assert.equal(res.status, 200);
  assert.equal(call.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(call.headers['x-api-key'], SECRET);
  assert.ok(call.headers['anthropic-version']);
  assert.match(call.body.system, /proofreader/);
  assert.equal(call.body.messages[0].content, `<passage>\n${TEXT}\n</passage>`);
  const { result } = await res.json();
  assert.equal(result.provider, 'Anthropic');
  assert.equal(result.changed, false);

  const truncated = await handleApi(post('/api/revise?mode=grammar', { text: TEXT }, { ip: '11.0.0.1' }), env, async () => Response.json({ stop_reason: 'max_tokens', content: [{ type: 'text', text: TEXT }] }));
  assert.equal(truncated.status, 502);

  const st = await (await handleApi(new Request(`${ORIGIN}/api/status`), { ...env, ...oaEnv, LLM_PROVIDER: 'anthropic' })).json();
  assert.equal(st.writer.provider, 'Anthropic');
});

test('helpers', () => {
  assert.deepEqual(missingNumbers('In 2020, 45% of 3 groups', 'In 2020, 45% of three groups'), ['3']);
  assert.equal(cleanOutput('```\n<passage>\nHello\n</passage>\n```'), 'Hello');
  assert.throws(() => normalizeGptzero(null));
});
