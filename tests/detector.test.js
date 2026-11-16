import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreText, createReport } from '../public/detector.js';
import { ai, human } from './fixtures.js';

test('AI-style passages score high and informal human passages score low', () => {
  for (const text of ai) assert.ok(scoreText(text).score >= 70, `expected >= 70, got ${scoreText(text).score}`);
  for (const text of human) assert.ok(scoreText(text).score <= 30, `expected <= 30, got ${scoreText(text).score}`);
});

test('any string can be scored; short text stays near 50 with very low confidence', () => {
  for (const text of ['Hello world', 'a', 'The quick brown fox jumps over the lazy dog.', '12345 test']) {
    const r = scoreText(text);
    assert.ok(r.score >= 35 && r.score <= 65, `${text}: ${r.score}`);
    assert.equal(r.confidence, 'Very low');
  }
  assert.throws(() => scoreText(''));
  assert.throws(() => scoreText('?!'));
});

test('non-English text is scored with reduced confidence and no English wording signals', () => {
  const r = scoreText('यह एक परीक्षण वाक्य है। मुझे नहीं पता कि यह कैसे काम करेगा। चलो देखते हैं कि क्या होता है जब हम इसे चलाते हैं। यह वाक्य भी उतना ही लंबा है जितना पिछला वाला था। '.repeat(3));
  assert.equal(r.english, false);
  assert.equal(r.confidence, 'Low');
  assert.ok(!r.signals.some(s => s.id === 'stock'));
});

test('sentence view reproduces the text and flags stock phrasing', () => {
  const text = ai[0];
  const r = scoreText(text);
  assert.equal(r.sentences.map(s => s.text).join(''), text);
  assert.ok(r.flaggedSentences >= 3);
  assert.ok(r.sentences.some(s => s.reasons.includes('formulaic opener')));
});

test('scores are deterministic and bounded', () => {
  const a = scoreText(human[0]), b = scoreText(human[0]);
  assert.equal(a.score, b.score);
  for (const g of a.signals) assert.ok(g.strength >= 0 && g.strength <= 1);
});

test('report explains the score and leaves the passage out', () => {
  const r = scoreText(ai[1]);
  const report = createReport(r);
  assert.ok(report.includes(`AI-likeness score: ${r.score} / 100`));
  assert.ok(report.includes('cannot establish who or what wrote'));
  assert.ok(!report.includes(ai[1].slice(0, 60)));
});

test('markup in the text is treated as plain text', () => {
  assert.ok(scoreText('<script>alert(1)</script> ' + 'word '.repeat(50)).stats.wordCount > 50);
});
