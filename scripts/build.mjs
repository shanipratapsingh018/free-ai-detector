import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
const assets = {};
const types = { html:'text/html; charset=utf-8', css:'text/css; charset=utf-8', js:'text/javascript; charset=utf-8', svg:'image/svg+xml', zip:'application/zip' };
for (const file of readdirSync('dist')) {
 const ext=file.split('.').at(-1); if (!types[ext]) continue;
 assets['/'+file] = { type:types[ext], encoding:ext==='zip'?'base64':'utf8', body:readFileSync('dist/'+file, ext==='zip'?'base64':'utf8') };
}
mkdirSync('dist/server', {recursive:true});
writeFileSync('dist/server/index.js', 'const ASSETS = '+JSON.stringify(assets)+';\n'+readFileSync('worker/index.js','utf8'));
console.log('Built Worker with embedded static assets.');
