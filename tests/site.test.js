import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { outputs } from '../scripts/build-pages.mjs';
import { pages } from '../site/content.mjs';
import { SITE_URL } from '../site/config.mjs';

const read = name => readFileSync(new URL('../public/' + name, import.meta.url), 'utf8');
const exists = name => existsSync(new URL('../public/' + name, import.meta.url));
const app = read('app.js'), css = read('styles.css');
const htmlFiles = [...readdirSync(new URL('../public/', import.meta.url)).filter(n => n.endsWith('.html')), ...readdirSync(new URL('../public/articles/', import.meta.url)).map(n => 'articles/' + n)];
const toolPages = pages.filter(p => p.kind === 'tool').map(p => (p.path || 'index') + '.html');
const resolves = ref => { const path = ref.replace(/^\//, '').split('#')[0]; return path === '' || exists(path) || exists(path + '.html'); };

test('generated files on disk match the content source', () => {
  for (const [name, body] of outputs()) assert.equal(read(name), body, `${name} is out of date; run "npm run build"`);
});

test('every tool page has unique ids and every element the script needs', () => {
  for (const page of toolPages) {
    const html = read(page);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(ids.length, new Set(ids).size, `duplicate id in ${page}`);
    for (const [, id] of app.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(id), `${page} is missing #${id}`);
    assert.deepEqual([...html.matchAll(/data-action="([^"]+)" aria-pressed/g)].map(m => m[1]), ['detect', 'humanize', 'grammar', 'simplify', 'summarize', 'count']);
  }
});

test('local links, scripts, fonts and anchors resolve on every page', () => {
  for (const page of htmlFiles) {
    const html = read(page);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    for (const [, ref] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (ref.startsWith('http')) continue;
      if (ref.startsWith('#')) assert.ok(ids.includes(ref.slice(1)), `Missing anchor ${ref} in ${page}`);
      else assert.ok(ref.startsWith('/') && resolves(ref), `Broken link ${ref} in ${page}`);
    }
  }
  for (const [, ref] of css.matchAll(/url\('([^']+)'\)/g)) assert.ok(exists(ref), ref);
  for (const file of ['app.js', 'detector.js', 'rewrite-local.js', 'pdf.js']) for (const [, ref] of read(file).matchAll(/(?:from|import\()\s*'\.?\/([^']+)'/g)) assert.ok(exists(ref), `${ref} imported by ${file}`);
});

test('pages work under the strict content security policy', () => {
  const headers = read('_headers');
  assert.match(headers, /script-src 'self'/); assert.match(headers, /frame-ancestors 'none'/);
  for (const page of htmlFiles) {
    const source = read(page);
    assert.ok(!/\sstyle="/.test(source), `inline style in ${page}`);
    assert.ok(!/<script(?![^>]*\b(?:src=|type="application\/ld\+json"))[^>]*>/.test(source), `inline script in ${page}`);
    assert.ok(!/\son\w+="/.test(source), `inline handler in ${page}`);
    assert.ok(!/https?:\/\/fonts\.g/.test(source + css), 'third-party font request');
  }
  assert.ok(!/innerHTML|insertAdjacentHTML|document\.write/.test(app), 'user text must be inserted with DOM APIs');
});

test('search basics: unique titles and descriptions, one h1, canonical, valid structured data, sitemap', () => {
  const titles = new Set(), descriptions = new Set();
  for (const page of pages) {
    const file = (page.path || 'index') + '.html', html = read(file);
    const title = html.match(/<title>([^<]+)<\/title>/)[1], description = html.match(/<meta name="description" content="([^"]+)"/)[1];
    assert.ok(!titles.has(title), `duplicate title: ${title}`); titles.add(title);
    assert.ok(!descriptions.has(description), `duplicate description in ${file}`); descriptions.add(description);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${file} needs exactly one h1`);
    if (!page.noindex) {
      assert.ok(html.includes(`<link rel="canonical" href="${SITE_URL}/${page.path}">`), `canonical missing in ${file}`);
      assert.ok(description.length >= 50 && description.length <= 160, `${file} description is ${description.length} characters`);
      assert.ok(read('sitemap.xml').includes(`<loc>${SITE_URL}/${page.path}</loc>`), `${file} missing from sitemap`);
    }
    for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) assert.ok(JSON.parse(json)['@type']);
    assert.ok(html.includes('property="og:image" content="' + SITE_URL + '/og.png"'));
  }
  assert.ok(exists('og.png')); assert.ok(exists('404.html'));
  assert.match(read('robots.txt'), /Sitemap: https:\/\//);
  assert.match(read('index.html'), /<h1[^>]*>Free AI detector/);
  assert.match(read('hi.html'), /<html lang="hi">/);
});

test('no leftover placeholder copy remains', () => {
  for (const page of [...htmlFiles, 'app.js', 'i18n.js']) assert.ok(!/ChatGPT conversation|private preview|SETUP NEEDED|lorem ipsum|\[CONFIRM\]|__REPO__/i.test(read(page)), page);
});
