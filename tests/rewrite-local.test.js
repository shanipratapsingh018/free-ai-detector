import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteLocally, ACTIONS } from '../public/rewrite-local.js';
import { diffWords } from '../public/diff.js';
import { scoreText } from '../public/detector.js';
import { ai } from './fixtures.js';

test('humanize swaps stock wording, adds contractions and never raises the score', () => {
  const r = rewriteLocally('Furthermore, it is important to note that we do not utilize a wide range of tools in order to facilitate growth.', 'humanize');
  assert.equal(r.text, "Also, we don't use many tools to help growth.");
  for (const text of ai) assert.ok(scoreText(rewriteLocally(text, 'humanize').text).score <= scoreText(text).score);
});

test('URLs, e-mail addresses, numbers and quotations are left untouched', () => {
  const text = 'We utilize https://example.com/utilize?x=1,2 and mail utilize@example.com. He said "we do not utilize it" in 2,500 cases (3.5%).';
  const r = rewriteLocally(text, 'humanize');
  for (const keep of ['https://example.com/utilize?x=1,2', 'utilize@example.com', '"we do not utilize it"', '2,500', '3.5%']) assert.ok(r.text.includes(keep), keep);
  assert.ok(r.text.startsWith('We use '));
});

test('grammar fixes spacing, typos, articles, repeats and capitals', () => {
  const r = rewriteLocally('this is  teh first sentence .i think it is a apple,and an university is here. see e.g. the the report !!!!', 'grammar');
  assert.equal(r.text, 'This is the first sentence. I think it is an apple, and a university is here. See e.g. the report!');
});

test('simplify uses plainer words', () => {
  const r = rewriteLocally('We require additional assistance in order to obtain sufficient components.', 'simplify');
  assert.equal(r.text, 'We need more help to get enough parts.');
});

test('summarize keeps a subset of the original sentences in order', () => {
  const r = rewriteLocally(ai[0], 'summarize');
  assert.ok(r.text.length < ai[0].length * 0.6);
  let from = 0;
  for (const sentence of r.text.split(/(?<=[.!?]) /)) { const at = ai[0].indexOf(sentence.trim(), from); assert.ok(at >= 0, sentence); from = at; }
  assert.equal(rewriteLocally('Only one sentence here.', 'summarize').text, 'Only one sentence here.');
});

test('non-English text is only tidied, with a clear note', () => {
  const r = rewriteLocally('यह  एक परीक्षण है ।दूसरा वाक्य', 'humanize');
  assert.equal(r.text, 'यह एक परीक्षण है। दूसरा वाक्य');
  assert.match(r.note, /English only/);
});

test('every action is available and unknown actions are rejected', () => {
  for (const action of Object.keys(ACTIONS)) assert.equal(typeof rewriteLocally('This is a simple test sentence for you.', action).text, 'string');
  assert.throws(() => rewriteLocally('text here now', 'explode'));
});

test('diff marks additions and removals and rebuilds both sides', () => {
  const before = 'The quick brown fox', after = 'The slow brown fox jumps';
  const runs = diffWords(before, after);
  assert.equal(runs.filter(r => r.type !== 'add').map(r => r.text).join(''), before);
  assert.equal(runs.filter(r => r.type !== 'remove').map(r => r.text).join(''), after);
  assert.deepEqual(diffWords('same', 'same'), [{ type: 'same', text: 'same' }]);
});
