/**
 * Browser-side document text extraction. Files never leave the device during extraction;
 * only text the user later submits is sent to the server.
 *
 * Supports .txt, .md/.markdown, .docx (built-in ZIP + WordprocessingML reader), and .pdf
 * (pdf.js, loaded lazily). Works in Node 18+ too (for tests), except PDF which needs a loader.
 */
import { LIMITS } from './limits.js';

export class ExtractError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const KINDS = { txt: 'text', md: 'text', markdown: 'text', docx: 'docx', pdf: 'pdf' };

export function fileKind(name) {
  const ext = String(name || '').toLowerCase().split('.').pop();
  return KINDS[ext] || null;
}

export function normalizeText(text) {
  return String(text)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    // drop control chars except tab/newline
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const fmtMB = b => `${(b / 1024 / 1024).toFixed(b < 1024 * 1024 ? 2 : 0)} MB`;

export async function extractFile(file, { loadPdfjs } = {}) {
  const kind = fileKind(file?.name);
  if (!kind) {
    if (/\.doc$/i.test(file?.name || '')) throw new ExtractError('unsupported', 'Older .doc files aren’t supported. Open it in your word processor and save it as .docx, then upload again.');
    throw new ExtractError('unsupported', 'That file type isn’t supported. Use .txt, .md, .pdf, or .docx.');
  }
  const max = kind === 'text' ? LIMITS.maxTextFileBytes : LIMITS.maxBinaryFileBytes;
  if (file.size > max) throw new ExtractError('too_large', `That file is ${fmtMB(file.size)}. The limit for this type is ${fmtMB(max)}.`);
  if (file.size === 0) throw new ExtractError('empty', 'That file is empty.');

  let bytes;
  try { bytes = new Uint8Array(await file.arrayBuffer()); } catch { throw new ExtractError('read_failed', 'Couldn’t read that file. Try saving it again or pasting the text.'); }

  let result;
  if (kind === 'text') result = { text: decodeText(bytes), warnings: [] };
  else if (kind === 'docx') result = await extractDocx(bytes);
  else result = await extractPdf(bytes, loadPdfjs);

  const text = normalizeText(result.text);
  if (!text) throw new ExtractError('no_text', 'No readable text was found in that file.');
  return { text, warnings: result.warnings, kind, pages: result.pages };
}

export function decodeText(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  const sample = bytes.subarray(0, 8192);
  if (sample.includes(0)) throw new ExtractError('binary', 'This doesn’t look like a plain-text file. If it’s a Word or PDF document, give it the right extension.');
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch {
    throw new ExtractError('encoding', 'This text file isn’t UTF-8 encoded. Re-save it as UTF-8 and try again.');
  }
}

/* ---------------- DOCX ---------------- */

const MAX_UNZIPPED = 40 * 1024 * 1024;

function u16(b, o) { return b[o] | (b[o + 1] << 8); }
function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

/** Minimal ZIP reader: returns an entry's bytes or null if absent. */
export async function readZipEntry(bytes, wanted) {
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (u32(bytes, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new ExtractError('corrupt', 'This .docx file appears to be damaged or isn’t a real Word document.');
  const count = u16(bytes, eocd + 10);
  let p = u32(bytes, eocd + 16);
  for (let n = 0; n < count; n++) {
    if (p + 46 > bytes.length || u32(bytes, p) !== 0x02014b50) throw new ExtractError('corrupt', 'This .docx file appears to be damaged.');
    const flags = u16(bytes, p + 8), method = u16(bytes, p + 10);
    const compSize = u32(bytes, p + 20), size = u32(bytes, p + 24);
    const nameLen = u16(bytes, p + 28), extraLen = u16(bytes, p + 30), commentLen = u16(bytes, p + 32);
    const local = u32(bytes, p + 42);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (name !== wanted) continue;
    if (flags & 1) throw new ExtractError('encrypted', 'This document is encrypted. Remove the password in your word processor, then upload again.');
    if (size > MAX_UNZIPPED) throw new ExtractError('too_large', 'This document’s text is too large to process.');
    if (u32(bytes, local) !== 0x04034b50) throw new ExtractError('corrupt', 'This .docx file appears to be damaged.');
    const start = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28);
    const data = bytes.subarray(start, start + compSize);
    if (method === 0) return data;
    if (method !== 8) throw new ExtractError('corrupt', 'This .docx uses an unsupported compression method.');
    return inflateRaw(data);
  }
  return null;
}

async function inflateRaw(data) {
  if (typeof DecompressionStream === 'undefined') throw new ExtractError('unsupported_browser', 'Your browser can’t open .docx files. Update it, or paste the text instead.');
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const chunks = []; let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_UNZIPPED) { await reader.cancel(); throw new ExtractError('too_large', 'This document’s text is too large to process.'); }
      chunks.push(value);
    }
  } catch (e) {
    if (e instanceof ExtractError) throw e;
    throw new ExtractError('corrupt', 'This .docx file appears to be damaged.');
  }
  const out = new Uint8Array(total); let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return out;
}

const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
    }
    return ENTITIES[e.toLowerCase()];
  });
}

/** Extracts visible text from WordprocessingML (w:t runs, tabs, breaks, paragraphs). Tracked deletions are skipped. */
export function docxXmlToText(xml) {
  let out = '';
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\b[^>]*\/>|<w:cr\/>|<\/w:p>/g;
  let m;
  while ((m = re.exec(xml))) {
    if (m[1] !== undefined) out += decodeEntities(m[1]);
    else if (m[0] === '<w:tab/>') out += '\t';
    else out += '\n';
  }
  return out;
}

async function extractDocx(bytes) {
  if (u32(bytes, 0) === 0xe011cfd0) {
    // OLE compound file: password-protected .docx files and legacy .doc both use this container.
    throw new ExtractError('encrypted', 'This file is password-protected or in the older .doc format. Remove the password or save it as .docx, then upload again.');
  }
  if (u32(bytes, 0) !== 0x04034b50) throw new ExtractError('corrupt', 'This file isn’t a valid .docx document.');
  const doc = await readZipEntry(bytes, 'word/document.xml');
  if (!doc) throw new ExtractError('corrupt', 'This file isn’t a Word document (no document body found).');
  const xml = new TextDecoder().decode(doc);
  return { text: docxXmlToText(xml), warnings: [] };
}

/* ---------------- PDF ---------------- */

async function extractPdf(bytes, loadPdfjs) {
  const head = new TextDecoder().decode(bytes.subarray(0, 1024));
  if (!head.includes('%PDF-')) throw new ExtractError('corrupt', 'This file isn’t a valid PDF.');
  let pdfjs;
  try { pdfjs = await (loadPdfjs || defaultPdfLoader)(); } catch {
    throw new ExtractError('pdf_engine', 'The PDF reader couldn’t load. Check your connection and try again, or paste the text.');
  }
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise;
  } catch (e) {
    if (e?.name === 'PasswordException') throw new ExtractError('encrypted', 'This PDF is password-protected. Remove the password (or export an unlocked copy), then upload again.');
    if (e?.name === 'InvalidPDFException') throw new ExtractError('corrupt', 'This PDF appears to be damaged.');
    throw new ExtractError('extract_failed', 'Couldn’t read text from this PDF. Try copying the text and pasting it instead.');
  }
  const warnings = [];
  const pages = Math.min(doc.numPages, LIMITS.maxPdfPages);
  if (doc.numPages > LIMITS.maxPdfPages) warnings.push(`Only the first ${LIMITS.maxPdfPages} of ${doc.numPages} pages were read.`);
  const parts = [];
  try {
    for (let i = 1; i <= pages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let line = '';
      for (const item of content.items) {
        if (typeof item.str !== 'string') continue;
        line += item.str;
        if (item.hasEOL) line += '\n';
      }
      parts.push(line);
      page.cleanup?.();
    }
  } catch {
    throw new ExtractError('extract_failed', 'Text extraction failed partway through this PDF. Try pasting the text instead.');
  } finally {
    doc.destroy?.();
  }
  const text = parts.join('\n\n');
  if (text.replace(/\s/g, '').length < 20) {
    throw new ExtractError('image_only', 'No selectable text was found. This PDF may be scanned images; text recognition (OCR) isn’t supported. Paste the text instead.');
  }
  warnings.push('PDF layouts (columns, headers, footnotes) can scramble extracted text. Please review it.');
  return { text, warnings, pages: doc.numPages };
}

async function defaultPdfLoader() {
  const pdfjs = await import('./vendor/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;
  return pdfjs;
}
