import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { extractFile, ExtractError, docxXmlToText, normalizeText, fileKind } from '../../public/extract.js';
import { LIMITS } from '../../public/limits.js';

const fx = name => readFileSync(new URL(`../fixtures/${name}`, import.meta.url));
const file = (data, name) => new File([data], name);
const loadPdfjs = async () => import('pdfjs-dist/legacy/build/pdf.mjs');
const rejectsWith = (p, code) => assert.rejects(p, e => e instanceof ExtractError && e.code === code);

/** Builds a minimal ZIP (one or more deflated entries) for DOCX edge cases. */
function zip(entries, { encryptedFlag = false } = {}) {
  const locals = []; const centrals = []; let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const n = Buffer.from(name), raw = Buffer.from(content), comp = deflateRawSync(raw);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(encryptedFlag ? 1 : 0, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(n.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(encryptedFlag ? 1 : 0, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(offset, 42);
    locals.push(lh, n, comp); centrals.push(ch, n); offset += 30 + n.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(centrals.length / 2, 8); eocd.writeUInt16LE(centrals.length / 2, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

test('file kinds', () => {
  assert.equal(fileKind('a.TXT'), 'text');
  assert.equal(fileKind('notes.md'), 'text');
  assert.equal(fileKind('x.docx'), 'docx');
  assert.equal(fileKind('x.pdf'), 'pdf');
  assert.equal(fileKind('x.png'), null);
});

test('plain text and Markdown: UTF-8, BOM, CRLF, UTF-16', async () => {
  const r = await extractFile(file('\uFEFFHello  \r\nwörld\r\n\r\n\r\n\r\nend', 'a.txt'));
  assert.equal(r.text, 'Hello\nwörld\n\nend');
  const md = await extractFile(file('# Title\n\n- item', 'n.md'));
  assert.equal(md.text, '# Title\n\n- item');
  const u16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('Hi there', 'utf16le')]);
  assert.equal((await extractFile(file(u16, 'u.txt'))).text, 'Hi there');
});

test('text: rejects binary, non-UTF-8, empty, oversized, unsupported', async () => {
  await rejectsWith(extractFile(file(Buffer.from([0x50, 0x4b, 0, 0, 1, 2]), 'x.txt')), 'binary');
  await rejectsWith(extractFile(file(Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x20]), 'latin1.txt')), 'encoding');
  await rejectsWith(extractFile(file('', 'e.txt')), 'empty');
  await rejectsWith(extractFile(file('   \n  ', 'w.txt')), 'no_text');
  await rejectsWith(extractFile(file('a'.repeat(LIMITS.maxTextFileBytes + 1), 'big.txt')), 'too_large');
  await rejectsWith(extractFile(file('x', 'photo.png')), 'unsupported');
  await assert.rejects(extractFile(file('x', 'old.doc')), /\.docx/);
});

test('docx: real LibreOffice document', async () => {
  const r = await extractFile(file(fx('sample.docx'), 'notes.docx'));
  assert.equal(r.kind, 'docx');
  assert.match(r.text, /Quarterly notes/);
  assert.match(r.text, /4 features & fixed <12> bugs\.\tTabbed text\./);
  assert.match(r.text, /“smart quotes”/);
});

test('docx: encrypted (OLE container), corrupt, missing body, zip-encrypted flag, oversize', async () => {
  await rejectsWith(extractFile(file(fx('encrypted.docx'), 'locked.docx')), 'encrypted');
  await rejectsWith(extractFile(file('not a zip at all', 'bad.docx')), 'corrupt');
  await rejectsWith(extractFile(file(zip({ 'other.xml': '<x/>' }), 'nobody.docx')), 'corrupt');
  await rejectsWith(extractFile(file(zip({ 'word/document.xml': '<w:p/>' }, { encryptedFlag: true }), 'enc.docx')), 'encrypted');
  const big = new File([new Uint8Array(LIMITS.maxBinaryFileBytes + 1)], 'huge.docx');
  await rejectsWith(extractFile(big), 'too_large');
});

test('docx XML: paragraphs, tabs, breaks, entities; skips deleted text and field codes', () => {
  const xml = '<w:body><w:p><w:r><w:t>A&amp;B</w:t><w:tab/><w:t xml:space="preserve"> c </w:t></w:r></w:p>'
    + '<w:p><w:r><w:delText>gone</w:delText><w:instrText>PAGE</w:instrText><w:t>D&#8217;E</w:t><w:br/><w:t>F</w:t></w:r></w:p></w:body>';
  assert.equal(docxXmlToText(xml), 'A&B\t c \nD’E\nF\n');
});

test('pdf: extracts text from every page with a review warning', async () => {
  const r = await extractFile(file(fx('sample.pdf'), 's.pdf'), { loadPdfjs });
  assert.equal(r.kind, 'pdf');
  assert.equal(r.pages, 2);
  assert.match(r.text, /river rose 3\.5 metres in 2021/);
  assert.match(r.text, /Page two: Recovery took eleven weeks/);
  assert.ok(r.warnings.some(w => /review/i.test(w)));
});

test('pdf: encrypted, image-only, corrupt, engine failure', async () => {
  await rejectsWith(extractFile(file(fx('encrypted.pdf'), 'locked.pdf'), { loadPdfjs }), 'encrypted');
  await rejectsWith(extractFile(file(fx('image-only.pdf'), 'scan.pdf'), { loadPdfjs }), 'image_only');
  await rejectsWith(extractFile(file('hello world', 'fake.pdf'), { loadPdfjs }), 'corrupt');
  await rejectsWith(extractFile(file('%PDF-1.4 garbage garbage', 'broken.pdf'), { loadPdfjs }), 'corrupt');
  await rejectsWith(extractFile(file(fx('sample.pdf'), 's.pdf'), { loadPdfjs: async () => { throw new Error('offline'); } }), 'pdf_engine');
});

test('normalizeText strips control characters', () => {
  assert.equal(normalizeText('a\u0000b\u0007c\td'), 'abc\td');
});
