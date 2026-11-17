/**
 * Shared text utilities: word and sentence segmentation, limits, basic statistics.
 * Runs unchanged in the browser, in Node (tests) and in the Cloudflare Worker.
 * No network access, no persistence.
 */

export const LIMITS = Object.freeze({
  maxChars: 30000, // local scoring
  rewriteMinWords: 3,
  rewriteMaxWords: 1500,
  rewriteMaxChars: 12000,
  maxFileBytes: 2000000, // .txt, .md, .docx
  maxPdfBytes: 10000000,
  maxPdfPages: 60
});

const hasSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function';
const wordSegmenter = hasSegmenter ? new Intl.Segmenter(undefined, { granularity: 'word' }) : null;
const sentenceSegmenter = hasSegmenter ? new Intl.Segmenter('en', { granularity: 'sentence' }) : null;

// Fallback keeps combining marks (\p{M}) so Devanagari and other Indic scripts are not split mid-word.
const WORD_FALLBACK = /[\p{L}\p{M}\p{N}]+(?:['’\-][\p{L}\p{M}\p{N}]+)*/gu;

/** Words in any script. Uses the platform segmenter so Hindi, Chinese, Japanese etc. are counted correctly. */
export function words(text) {
  if (!text) return [];
  if (!wordSegmenter) return text.match(WORD_FALLBACK) || [];
  const out = [];
  for (const part of wordSegmenter.segment(text)) if (part.isWordLike) out.push(part.segment);
  return out;
}

// Abbreviations that almost never end a sentence: always join with what follows.
const JOIN_ALWAYS = /(?:^|[\s(“"'])(?:Dr|Prof|Mr|Mrs|Ms|Mx|Sr|Jr|St|Shri|Smt|Fig|Figs|No|Nos|Eq|Eqs|Sec|Ch|Vol|vs|viz|cf|e\.g|i\.e|[A-Z])\.\s*$/;
// Abbreviations that may end a sentence: join only when the next piece does not look like a new sentence.
const JOIN_IF_CONTINUES = /(?:^|[\s(“"'])(?:etc|al|approx|Inc|Ltd|Co|Corp|pp|a\.m|p\.m|U\.S|U\.K|Ph\.D|M\.Tech|B\.Tech|B\.E|M\.E)\.\s*$/;
const STARTS_LIKE_CONTINUATION = /^[\s"'”’)\]]*[\p{Ll}\p{N},;:]/u;
const CLOSING_QUOTE_END = /[.!?…]["”’')\]]+\s*$/;

/**
 * Sentences with their exact source text. Joining every `text` reproduces the input,
 * so callers can highlight sentences without losing whitespace.
 */
export function sentences(text) {
  if (!text) return [];
  let raw;
  if (sentenceSegmenter) raw = [...sentenceSegmenter.segment(text)].map(s => s.segment);
  else raw = text.match(/[^.!?。！？।\n]+(?:[.!?。！？।]+["”’')\]]*|\n+|$)\s*/gu) || [text];

  const merged = [];
  for (const piece of raw) {
    const prev = merged[merged.length - 1];
    const prevEndsParagraph = prev !== undefined && /\n\s*$/.test(prev);
    const join = prev !== undefined && !prevEndsParagraph && (
      JOIN_ALWAYS.test(prev) ||
      (JOIN_IF_CONTINUES.test(prev) && STARTS_LIKE_CONTINUATION.test(piece)) ||
      (CLOSING_QUOTE_END.test(prev) && /^[\s]*\p{Ll}/u.test(piece)) ||
      !/[\p{L}\p{N}]/u.test(prev)
    );
    if (join) merged[merged.length - 1] = prev + piece;
    else merged.push(piece);
  }
  // A trailing fragment with no letters (stray punctuation) belongs to the previous sentence.
  if (merged.length > 1 && !/[\p{L}\p{N}]/u.test(merged[merged.length - 1])) {
    const tail = merged.pop();
    merged[merged.length - 1] += tail;
  }
  return merged.map(s => ({ text: s, words: words(s) }));
}

export function paragraphs(text) {
  return text.split(/\n\s*\n|\r\n\s*\r\n/).map(p => p.trim()).filter(Boolean);
}

const EN_STOP = new Set('the of and to a in is that it for was on with as be by at this are or from an have not but had they you which we his her their has were been one all can will there if more when would who so no what about its than into them only other some could these two may then do any my our over such also most'.split(' '));

/** Rough script/language check. Scoring signals that rely on English wording are skipped when this is false. */
export function detectLanguage(text, tokens = words(text)) {
  const letters = text.match(/\p{L}/gu) || [];
  if (!letters.length) return { english: false, latinShare: 0, label: 'No letters found' };
  const latin = (text.match(/\p{Script=Latin}/gu) || []).length;
  const latinShare = latin / letters.length;
  if (latinShare < 0.8) return { english: false, latinShare, label: 'Non-Latin script' };
  if (tokens.length < 12) return { english: true, latinShare, label: 'English (assumed, short text)' };
  let stop = 0;
  for (const t of tokens) if (EN_STOP.has(t.toLowerCase())) stop++;
  const english = stop / tokens.length > 0.18;
  return { english, latinShare, label: english ? 'English' : 'Latin script, probably not English' };
}

export const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
export function deviation(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / values.length);
}
export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** Descriptive counts used in the report. */
export function basicStats(text) {
  const tokens = words(text);
  const lower = tokens.map(t => t.toLowerCase());
  const sents = sentences(text).filter(s => s.words.length);
  const lengths = sents.map(s => s.words.length);
  const phrases = new Map();
  for (let i = 0; i < lower.length - 2; i++) {
    const key = lower[i] + ' ' + lower[i + 1] + ' ' + lower[i + 2];
    phrases.set(key, (phrases.get(key) || 0) + 1);
  }
  let repeated = 0;
  for (const n of phrases.values()) if (n > 1) repeated++;
  return {
    wordCount: tokens.length,
    characterCount: text.length,
    sentenceCount: sents.length,
    paragraphCount: paragraphs(text).length,
    averageSentenceLength: +mean(lengths).toFixed(1),
    sentenceLengthDeviation: +deviation(lengths).toFixed(1),
    shortestSentence: lengths.length ? Math.min(...lengths) : 0,
    longestSentence: lengths.length ? Math.max(...lengths) : 0,
    uniqueWords: new Set(lower).size,
    repeatedPhraseCount: repeated
  };
}

/** Validation for model-backed or offline rewriting. Returns an error message or null. */
export function validateRewrite(text) {
  if (typeof text !== 'string' || !text.trim()) return 'Add some text first.';
  if (text.length > LIMITS.rewriteMaxChars) return `Rewriting accepts up to ${LIMITS.rewriteMaxChars.toLocaleString('en-US')} characters. This text has ${text.length.toLocaleString('en-US')}.`;
  const n = words(text).length;
  if (n < LIMITS.rewriteMinWords) return `Add at least ${LIMITS.rewriteMinWords} words to rewrite.`;
  if (n > LIMITS.rewriteMaxWords) return `Rewriting accepts up to ${LIMITS.rewriteMaxWords.toLocaleString('en-US')} words. This text has ${n.toLocaleString('en-US')}.`;
  return null;
}

/** Validation for local scoring. Any non-empty text with at least one word is accepted. */
export function validateScore(text) {
  if (typeof text !== 'string' || !text.trim()) return 'Add some text first, or load an example.';
  if (text.length > LIMITS.maxChars) return `Scoring accepts up to ${LIMITS.maxChars.toLocaleString('en-US')} characters. This text has ${text.length.toLocaleString('en-US')}.`;
  if (!words(text).length) return 'This text has no words to score.';
  return null;
}
