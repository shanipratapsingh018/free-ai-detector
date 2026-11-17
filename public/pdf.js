/**
 * PDF text extraction on the device, using Mozilla's pdf.js (Apache-2.0, self-hosted in /vendor/pdfjs).
 * The library is about 1.7 MB, so it is loaded only when someone actually opens a PDF.
 * Scanned PDFs contain pictures of text and return nothing.
 */
let loading = null;
function library() {
  loading ??= import('/vendor/pdfjs/pdf.min.mjs').then(pdfjs => {
    pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
    return pdfjs;
  });
  return loading;
}

/**
 * @param {ArrayBuffer} buffer contents of a .pdf file
 * @param {{maxPages?: number, maxChars?: number}} limits stop early once enough text has been read
 * @returns {Promise<{text: string, pages: number, pagesRead: number}>}
 */
export async function pdfToText(buffer, { maxPages = 60, maxChars = 60000 } = {}) {
  const pdfjs = await library();
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false });
  const doc = await task.promise;
  try {
    const parts = [];
    let length = 0, pagesRead = 0;
    for (let n = 1; n <= Math.min(doc.numPages, maxPages) && length < maxChars; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let pageText = '';
      for (const item of content.items) if (typeof item.str === 'string') pageText += item.str + (item.hasEOL ? '\n' : '');
      // Join lines that were only wrapped for layout; keep blank lines as paragraph breaks.
      pageText = pageText.replace(/-\n(?=\p{Ll})/gu, '').replace(/(?<![.!?:।\n])\n(?!\n)/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
      if (pageText) { parts.push(pageText); length += pageText.length; }
      pagesRead = n;
    }
    return { text: parts.join('\n\n'), pages: doc.numPages, pagesRead };
  } finally {
    await task.destroy();
  }
}
