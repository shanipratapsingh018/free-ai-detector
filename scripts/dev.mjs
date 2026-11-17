/**
 * Zero-dependency local server: `npm start`, then open http://localhost:3000
 * Serves ./public with the headers from public/_headers and runs the same API handler as the Worker.
 * Set OPENAI_API_KEY in the environment to try model-backed rewriting locally.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from '../worker/index.js';

const root = resolve(fileURLToPath(new URL('../public', import.meta.url)));
const port = Number(process.env.PORT) || 3000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json', '.mjs': 'text/javascript; charset=utf-8', '.png': 'image/png', '.xml': 'application/xml' };

// Reuse the production headers for every path ("/*" block of public/_headers).
const siteHeaders = {};
try {
  const lines = (await readFile(join(root, '_headers'), 'utf8')).split('\n');
  let inAll = false;
  for (const line of lines) {
    if (!line.startsWith(' ')) { inAll = line.trim() === '/*'; continue; }
    const i = line.indexOf(':');
    if (inAll && i > 0) siteHeaders[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
} catch { /* no _headers file */ }
delete siteHeaders['Strict-Transport-Security']; // meaningless on http://localhost

const env = { OPENAI_API_KEY: process.env.OPENAI_API_KEY, OPENAI_MODEL: process.env.OPENAI_MODEL };

async function notFound(res) {
  const page = await readFile(join(root, '404.html')).catch(() => 'Not found');
  res.writeHead(404, { ...siteHeaders, 'Content-Type': 'text/html; charset=utf-8' }).end(page);
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
      headers.set('CF-Connecting-IP', req.socket.remoteAddress || 'local');
      const response = await handleApi(new Request(url, { method: req.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined }), env);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, siteHeaders).end('Method not allowed'); return; }
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(root, path));
    if (!file.startsWith(root) || path === '/_headers') return notFound(res);
    // Like Cloudflare's asset server: "/word-counter" serves word-counter.html.
    let body = null, served = file;
    for (const candidate of extname(file) ? [file] : [file + '.html', join(file, 'index.html')]) {
      try { body = await readFile(candidate); served = candidate; break; } catch { /* try the next candidate */ }
    }
    if (body === null) return notFound(res);
    res.writeHead(200, { ...siteHeaders, 'Content-Type': TYPES[extname(served)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(500, siteHeaders).end('Server error');
  }
}).listen(port, () => console.log(`Free AI Detector running at http://localhost:${port}  (model rewriting: ${env.OPENAI_API_KEY ? 'OpenAI' : 'off, using offline rules'})`));
