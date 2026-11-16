import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = name => readFileSync(new URL('../public/' + name, import.meta.url), 'utf8');
const html = read('index.html'), app = read('app.js'), css = read('styles.css');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);

test('element ids are unique and every id the script uses exists', () => {
  assert.equal(ids.length, new Set(ids).size);
  for (const [, id] of app.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(id), `Missing element: ${id}`);
});

test('local links, scripts, fonts and anchors resolve', () => {
  for (const page of ['index.html', 'privacy.html', 'terms.html']) {
    for (const [, ref] of read(page).matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (ref.startsWith('http') || ref === './') continue;
      if (ref.startsWith('#')) assert.ok(ids.includes(ref.slice(1)), `Missing anchor ${ref}`);
      else assert.ok(existsSync(new URL('../public/' + ref.replace(/^\.\//, '').split('#')[0], import.meta.url)), `Missing file ${ref} in ${page}`);
    }
  }
  for (const [, ref] of css.matchAll(/url\('([^']+)'\)/g)) assert.ok(existsSync(new URL('../public/' + ref, import.meta.url)), ref);
  for (const [, ref] of app.matchAll(/from '\.\/([^']+)'/g)) assert.ok(existsSync(new URL('../public/' + ref, import.meta.url)), ref);
});

test('pages work under the strict content security policy', () => {
  const headers = read('_headers');
  assert.match(headers, /script-src 'self'/); assert.match(headers, /frame-ancestors 'none'/);
  for (const page of ['index.html', 'privacy.html', 'terms.html']) {
    const source = read(page);
    assert.ok(!/\sstyle="/.test(source), `inline style in ${page}`);
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(source), `inline script in ${page}`);
    assert.ok(!/\son\w+="/.test(source), `inline handler in ${page}`);
    assert.ok(!/https?:\/\/fonts\.g/.test(source + css), 'third-party font request');
  }
  assert.ok(!/innerHTML|insertAdjacentHTML|document\.write/.test(app), 'user text must be inserted with DOM APIs');
});

test('every tool tab has a matching action and no leftover placeholder copy remains', () => {
  const tabs = [...html.matchAll(/data-action="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(tabs, ['detect', 'humanize', 'grammar', 'simplify', 'summarize']);
  for (const page of ['index.html', 'privacy.html', 'terms.html', 'app.js']) assert.ok(!/ChatGPT conversation|private preview|SETUP NEEDED|lorem ipsum/i.test(read(page)), page);
});
