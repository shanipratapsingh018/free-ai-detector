import { test } from 'node:test';
import assert from 'node:assert/strict';
import { words, validate, analyzeText, createReport } from '../dist/engine.js';
test('counts Unicode prose and apostrophes', () => {
  assert.equal(words("It's a well-written café story.").length, 5);
});
test('validates empty, short, over-limit and character-heavy passages', () => {
  for (const text of ['', 'short text', 'word '.repeat(1501), 'a'.repeat(100001)]) assert.ok(validate(text));
  assert.equal(validate('word '.repeat(50)), null);
  assert.equal(validate('word '.repeat(1500)), null);
});
test('describes patterns accurately without inventing AI scores', () => {
  const text = 'One two three four five. '.repeat(10);
  const r = analyzeText(text);
  assert.equal(r.wordCount, 50); assert.equal(r.sentenceCount, 10);
  assert.equal(r.averageSentenceLength, 5); assert.equal(r.uniqueWords, 5);
  assert.equal(r.sentenceLengthDeviation, 0); assert.equal(r.repeatedPhraseCount, 5);
  assert.equal(r.aiProbability, undefined);
  const report = createReport(r);
  assert.ok(report.includes('cannot establish authorship'));
  assert.ok(!report.includes(text));
});
test('treats markup as input text without execution', () => {
  const r = analyzeText('<script>alert(1)</script> ' + 'word '.repeat(50));
  assert.ok(r.wordCount > 50);
  assert.throws(() => analyzeText('short'));
});
