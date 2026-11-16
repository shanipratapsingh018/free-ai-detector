/**
 * Shared limits and text helpers. Imported by the browser (public/app.js) and
 * the Worker (worker/index.js) so client hints and server enforcement agree.
 */
export const LIMITS = Object.freeze({
  maxChars: 20000,
  maxWords: 2500,
  detectMinWords: 50,
  toolMinWords: 5,
  summarizeMinWords: 60,
  maxTextFileBytes: 2 * 1024 * 1024,
  maxBinaryFileBytes: 10 * 1024 * 1024,
  maxPdfPages: 80,
  // Request body cap (JSON overhead + UTF-8 expansion of maxChars).
  maxRequestBytes: 100000,
});

export const MODES = Object.freeze({
  detect: { label: 'AI Detector', verb: 'Check for AI', min: LIMITS.detectMinWords },
  humanize: { label: 'Humanize', verb: 'Humanize text', min: LIMITS.toolMinWords },
  grammar: { label: 'Fix Grammar', verb: 'Fix grammar', min: LIMITS.toolMinWords },
  simplify: { label: 'Simplify', verb: 'Simplify text', min: LIMITS.toolMinWords },
  summarize: { label: 'Summarize', verb: 'Summarize text', min: LIMITS.summarizeMinWords },
});

export const REVISION_MODES = Object.freeze(['humanize', 'grammar', 'simplify', 'summarize']);

export function countWords(text) {
  return (String(text).match(/[\p{L}\p{N}]+(?:[’'\-][\p{L}\p{N}]+)*/gu) || []).length;
}

/** Returns a user-facing validation message, or null when the text is acceptable for the mode. */
export function validateText(text, mode) {
  const spec = MODES[mode];
  if (!spec) return 'Choose a tool first.';
  if (typeof text !== 'string' || !text.trim()) return 'Add some text first — paste it, type it, or upload a document.';
  if (text.length > LIMITS.maxChars) return `This passage has ${text.length.toLocaleString('en-US')} characters. The limit is ${LIMITS.maxChars.toLocaleString('en-US')}; nothing has been cut.`;
  const n = countWords(text);
  if (n > LIMITS.maxWords) return `This passage has ${n.toLocaleString('en-US')} words. The limit is ${LIMITS.maxWords.toLocaleString('en-US')}; nothing has been cut.`;
  if (n < spec.min) return `${spec.label} needs at least ${spec.min} words. Add ${spec.min - n} more.`;
  return null;
}
