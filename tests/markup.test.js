import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../dist/styles.css', import.meta.url), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
test('SVG symbol names do not collide with interactive IDs', () => {
 assert.equal(ids.length, new Set(ids).size);
 for (const [,id] of app.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(id), `Missing UI element: ${id}`);
});
test('anchors, icons and local resources exist', () => {
 for (const [,ref] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
  if (ref === '#' || ref.startsWith('http')) continue;
  if (ref.startsWith('#')) assert.ok(ids.includes(ref.slice(1)), `Missing anchor: ${ref}`);
  else assert.ok(existsSync(new URL('../dist/' + ref, import.meta.url)), `Missing file: ${ref}`);
 }
});
test('explicit hidden states win over component display styles', () => {
 assert.ok(css.includes('[hidden]{display:none!important}'));
 assert.ok(css.includes('@media(max-width:600px)'));
 assert.ok(css.includes('@media(max-width:900px)'));
});
