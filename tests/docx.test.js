import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { docxToText, documentXmlToText } from '../public/docx.js';

// Build a minimal ZIP with one entry, the way Word stores word/document.xml.
function zip(name, content, compress = true) {
  const nameBytes = Buffer.from(name), raw = Buffer.from(content);
  const data = compress ? deflateRawSync(raw) : raw;
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(compress ? 8 : 0, 8);
  local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nameBytes.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(compress ? 8 : 0, 10);
  central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(nameBytes.length, 28); central.writeUInt32LE(0, 42);
  const cdOffset = 30 + nameBytes.length + data.length;
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(46 + nameBytes.length, 12); end.writeUInt32LE(cdOffset, 16);
  const all = Buffer.concat([local, nameBytes, data, central, nameBytes, end]);
  return all.buffer.slice(all.byteOffset, all.byteOffset + all.byteLength);
}
const xml = '<w:document><w:body><w:p><w:r><w:t>Hello &amp; welcome</w:t></w:r><w:r><w:tab/><w:t xml:space="preserve"> to Indore.</w:t></w:r></w:p><w:p><w:r><w:t>दूसरा अनुच्छेद</w:t></w:r></w:p></w:body></w:document>';

test('extracts paragraphs, entities and non-Latin text from WordprocessingML', () => {
  assert.equal(documentXmlToText(xml), 'Hello & welcome\t to Indore.\nदूसरा अनुच्छेद');
});
test('reads compressed and stored .docx archives', async () => {
  assert.equal(await docxToText(zip('word/document.xml', xml)), 'Hello & welcome\t to Indore.\nदूसरा अनुच्छेद');
  assert.equal(await docxToText(zip('word/document.xml', xml, false)), 'Hello & welcome\t to Indore.\nदूसरा अनुच्छेद');
});
test('rejects files that are not .docx', async () => {
  await assert.rejects(docxToText(new TextEncoder().encode('plain text, definitely not a zip archive at all').buffer));
  await assert.rejects(docxToText(zip('other.xml', xml)));
});
