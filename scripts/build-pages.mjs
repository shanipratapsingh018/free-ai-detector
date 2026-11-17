/**
 * Generates the static HTML pages, sitemap.xml, robots.txt and _headers in /public
 * from site/content.mjs, site/template.mjs and site/config.mjs.
 *
 *   npm run build         write the files
 *   npm run build:check   exit with an error if the files on disk are out of date (used by the tests)
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pages } from '../site/content.mjs';
import { renderPage, sitemap, robots, headers } from '../site/template.mjs';

const publicDir = fileURLToPath(new URL('../public', import.meta.url));

export function outputs() {
  const files = new Map();
  for (const page of pages) files.set(page.path ? `${page.path}.html` : 'index.html', renderPage(page));
  files.set('sitemap.xml', sitemap());
  files.set('robots.txt', robots());
  files.set('_headers', headers());
  return files;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const stale = [];
  for (const [name, body] of outputs()) {
    const file = join(publicDir, name);
    if (check) {
      const current = await readFile(file, 'utf8').catch(() => null);
      if (current !== body) stale.push(name);
    } else {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, body);
    }
  }
  if (check && stale.length) { console.error(`Out of date: ${stale.join(', ')}. Run "npm run build".`); process.exit(1); }
  console.log(check ? 'Generated pages are up to date.' : `Wrote ${outputs().size} files to public/.`);
}
