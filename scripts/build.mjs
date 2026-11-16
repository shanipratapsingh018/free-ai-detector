// Copies third-party browser assets (pdf.js, self-hosted fonts) into public/vendor.
// The output is git-ignored; run `npm run build` after `npm ci` and before deploying.
import { mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const out = new URL('../public/vendor/', import.meta.url).pathname;
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'fonts'), { recursive: true });

const pdfDir = join(dirname(require.resolve('pdfjs-dist/package.json')), 'build');
copyFileSync(join(pdfDir, 'pdf.min.mjs'), join(out, 'pdf.min.mjs'));
copyFileSync(join(pdfDir, 'pdf.worker.min.mjs'), join(out, 'pdf.worker.min.mjs'));

const fonts = {
  '@fontsource/fraunces': ['fraunces-latin-400-normal.woff2', 'fraunces-latin-600-normal.woff2', 'fraunces-latin-400-italic.woff2'],
  '@fontsource/inter': ['inter-latin-400-normal.woff2', 'inter-latin-500-normal.woff2', 'inter-latin-600-normal.woff2'],
};
for (const [pkg, files] of Object.entries(fonts)) {
  const dir = join(dirname(require.resolve(`${pkg}/package.json`)), 'files');
  for (const f of files) copyFileSync(join(dir, f), join(out, 'fonts', f));
}
console.log('Copied pdf.js and fonts into public/vendor/.');
