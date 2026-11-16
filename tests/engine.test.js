import { test } from 'node:test';
import assert from 'node:assert/strict';
import { words, sentences, detectLanguage, basicStats, validateScore, validateRewrite, LIMITS } from '../public/engine.js';

test('counts words in English, Hindi and Chinese', () => {
  assert.equal(words("It's a café story.").length, 4);
  assert.equal(words('यह एक परीक्षण वाक्य है जो हिंदी शब्दों की गिनती जांचता है').length, 12);
  assert.ok(words('这是一个测试句子用来检查分词是否正确').length > 5);
  assert.deepEqual(words(''), []);
});

test('does not split sentences on abbreviations, initials or decimals', () => {
  const s = sentences('Dr. Singh met Prof. Rao at 3.30 p.m. in the U.S. office, e.g. room 4. Then he left. "Really?" she asked.');
  assert.equal(s.length, 3);
  assert.equal(sentences('We used the method of A. K. Jain et al. in this work. It worked.').length, 2);
});

test('sentence pieces reproduce the input exactly', () => {
  const text = 'First one.  Second one!\n\nNew paragraph here? Yes.';
  assert.equal(sentences(text).map(s => s.text).join(''), text);
});

test('splits Hindi sentences on the danda', () => {
  assert.equal(sentences('यह पहला वाक्य है। यह दूसरा वाक्य है।').length, 2);
});

test('language check separates English from other scripts', () => {
  assert.equal(detectLanguage('The cat sat on the mat and it was happy to be there with all of us.').english, true);
  assert.equal(detectLanguage('यह एक परीक्षण वाक्य है').english, false);
});

test('basic statistics are exact', () => {
  const r = basicStats('One two three four five. '.repeat(10));
  assert.equal(r.wordCount, 50); assert.equal(r.sentenceCount, 10); assert.equal(r.averageSentenceLength, 5);
  assert.equal(r.uniqueWords, 5); assert.equal(r.sentenceLengthDeviation, 0); assert.equal(r.repeatedPhraseCount, 5);
});

test('validation: scoring takes any non-empty text, rewriting has word limits', () => {
  assert.equal(validateScore('Hello'), null);
  assert.ok(validateScore('   '));
  assert.ok(validateScore('!!! ...'));
  assert.ok(validateScore('a'.repeat(LIMITS.maxChars + 1)));
  assert.equal(validateRewrite('Three short words'), null);
  assert.ok(validateRewrite('two words'));
  assert.ok(validateRewrite('word '.repeat(1501)));
  assert.ok(validateRewrite('x'.repeat(LIMITS.rewriteMaxChars + 1)));
});
