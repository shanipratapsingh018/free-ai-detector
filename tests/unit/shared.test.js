import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { countWords, validateText, LIMITS } from '../../public/limits.js';
import { diffWords, diffStats } from '../../public/diff.js';

const read = p => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('word counting handles Unicode, apostrophes, hyphens', () => {
  assert.equal(countWords("It's a well-written café story, 2026."), 6);
  assert.equal(countWords('   '), 0);
});

test('validation per mode and limits', () => {
  const w = n => 'word '.repeat(n);
  assert.match(validateText('', 'detect'), /Add some text/);
  assert.match(validateText(w(49), 'detect'), /at least 50 words. Add 1 more/);
  assert.equal(validateText(w(50), 'detect'), null);
  assert.equal(validateText(w(5), 'grammar'), null);
  assert.match(validateText(w(59), 'summarize'), /60/);
  assert.match(validateText(w(LIMITS.maxWords + 1), 'humanize'), /nothing has been cut/);
  assert.match(validateText('a'.repeat(LIMITS.maxChars + 1), 'humanize'), /characters/);
  assert.match(validateText(w(60), 'nope'), /Choose a tool/);
});

test('diff marks insertions and deletions and reconstructs both texts', () => {
  const a = 'The quick brown fox jumps over the lazy dog.';
  const b = 'The quick red fox leaps over the lazy dog!';
  const segs = diffWords(a, b);
  assert.equal(segs.filter(s => s.type !== 'add').map(s => s.text).join(''), a);
  assert.equal(segs.filter(s => s.type !== 'del').map(s => s.text).join(''), b);
  assert.deepEqual(diffStats(segs), { added: 2, removed: 2 });
  assert.deepEqual(diffWords('same', 'same'), [{ type: 'same', text: 'same' }]);
});

test('diff falls back to block replacement for huge inputs', () => {
  const segs = diffWords('a b c d', 'w x y z', 4);
  assert.deepEqual(segs.map(s => s.type), ['del', 'add']);
});

test('markup: unique IDs, every $() id exists, local refs exist, CSP-friendly', () => {
  const html = read('public/index.html');
  const app = read('public/app.js');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size, 'duplicate ids');
  for (const [, id] of app.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(id), `missing #${id}`);
  for (const [, ref] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(ref), `missing anchor #${ref}`);
  for (const [, t] of app.matchAll(/openInfo\('([a-z]+)'\)/g)) assert.ok(ids.includes(`t-${t}`));
  for (const [, t] of html.matchAll(/data-dialog="([a-z]+)"/g)) assert.ok(ids.includes(`t-${t}`));
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, 'no inline scripts (CSP)');
  assert.doesNotMatch(html, /\sstyle="/, 'no inline styles (CSP)');
  assert.doesNotMatch(app, /\.innerHTML\s*=|insertAdjacentHTML/, 'user text must never be rendered via innerHTML');
  assert.doesNotMatch(html + app, /googleapis|gstatic|adsbygoogle/, 'no third-party requests or live ads');
});

test('no secrets or provider keys in frontend; honest copy', () => {
  const front = read('public/index.html') + read('public/app.js') + read('public/extract.js');
  assert.doesNotMatch(front, /sk-[A-Za-z0-9]{10,}|x-api-key|api\.openai\.com|api\.gptzero\.me|api\.anthropic\.com/);
  assert.doesNotMatch(front, /testimonial|trusted by|99(\.\d)?% accura|million users|approved by/i);
  assert.match(front, /Score unavailable/);
  assert.match(front, /not the share of words written by AI/);
});

test('ad slots exist, are empty and hidden', () => {
  const html = read('public/index.html');
  const slots = [...html.matchAll(/<aside class="ad-slot[^>]*>(.*?)<\/aside>/gs)];
  assert.equal(slots.length, 2);
  for (const s of slots) { assert.match(s[0], /\shidden>/); assert.equal(s[1].trim(), ''); }
});
