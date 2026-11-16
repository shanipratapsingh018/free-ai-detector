/**
 * Minimal .docx text extraction in the browser, with no dependencies.
 * A .docx file is a ZIP archive; the body text lives in word/document.xml.
 * Nothing is uploaded: the file is read and unpacked on the device.
 */

const MAX_XML_BYTES = 25000000; // guard against decompression bombs

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const chunks = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_XML_BYTES) { await reader.cancel(); throw new Error('too-large'); }
    chunks.push(value);
  }
  const out = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.byteLength; }
  return out;
}

function findEntry(view, bytes, wanted) {
  // End of central directory record: search backwards for its signature.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return null;
  const total = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  for (let n = 0; n < total && p + 46 <= bytes.length; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) return null;
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const nameLength = view.getUint16(p + 28, true);
    const extraLength = view.getUint16(p + 30, true);
    const commentLength = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength));
    if (name === wanted) return { method, compressedSize, localOffset };
    p += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodeEntities = s => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, code) => {
  if (code[0] === '#') { const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  return ENTITIES[code] ?? m;
});

/** Paragraph text from WordprocessingML. Tables, headers and footnotes are read as plain paragraphs or skipped. */
export function documentXmlToText(xml) {
  const paragraphs = [];
  for (const para of xml.split(/<\/w:p>/)) {
    let text = '';
    const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\b[^>]*\/>|<w:(?:br|cr)\b[^>]*\/>/g;
    let m;
    while ((m = re.exec(para))) text += m[1] !== undefined ? decodeEntities(m[1]) : m[0].startsWith('<w:tab') ? '\t' : '\n';
    paragraphs.push(text);
  }
  return paragraphs.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** @param {ArrayBuffer} buffer contents of a .docx file */
export async function docxToText(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (bytes.length < 30 || view.getUint32(0, true) !== 0x04034b50) throw new Error('not-docx');
  const entry = findEntry(view, bytes, 'word/document.xml');
  if (!entry) throw new Error('not-docx');
  const p = entry.localOffset;
  if (view.getUint32(p, true) !== 0x04034b50) throw new Error('not-docx');
  const start = p + 30 + view.getUint16(p + 26, true) + view.getUint16(p + 28, true);
  const data = bytes.subarray(start, start + entry.compressedSize);
  let xmlBytes;
  if (entry.method === 0) xmlBytes = data;
  else if (entry.method === 8) xmlBytes = await inflateRaw(data);
  else throw new Error('not-docx');
  return documentXmlToText(new TextDecoder('utf-8').decode(xmlBytes));
}
