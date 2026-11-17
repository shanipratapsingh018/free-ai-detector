/**
 * Heuristic AI-likeness scorer. Runs entirely on the device.
 *
 * This is a transparent, rule-based estimate built from writing-style signals that are
 * common in text produced by large language models. It is NOT a trained classifier and
 * cannot prove who or what wrote a passage. Every signal is reported so a reader can see
 * why a score came out the way it did.
 */
import { words, sentences, paragraphs, detectLanguage, basicStats, validateScore, mean, deviation, clamp } from './engine.js';

export const ENGINE_VERSION = 'heuristic-2.1';

// Wording that turns up far more often in model output than in everyday human prose.
const STOCK_WORDS = [
  'delve', 'delves', 'delving', 'tapestry', 'testament', 'realm', 'pivotal', 'crucial', 'multifaceted',
  'underscore', 'underscores', 'underscoring', 'foster', 'fosters', 'fostering', 'leverage', 'leverages', 'leveraging',
  'seamless', 'seamlessly', 'robust', 'comprehensive', 'holistic', 'nuanced', 'intricate', 'intricacies', 'vibrant',
  'embark', 'harness', 'harnessing', 'elevate', 'streamline', 'streamlined', 'transformative', 'meticulous', 'meticulously',
  'noteworthy', 'paramount', 'myriad', 'plethora', 'resilience', 'empower', 'empowers', 'empowering', 'synergy',
  'cornerstone', 'landscape', 'utilize', 'utilizes', 'utilizing', 'facilitate', 'facilitates', 'furthermore', 'moreover',
  'additionally', 'notably', 'invaluable', 'indispensable', 'groundbreaking', 'unwavering', 'thoughtful', 'meaningful',
  'well-being', 'ever-evolving', 'fast-paced', 'cutting-edge', 'game-changer', 'showcasing', 'showcases', 'commendable'
];
const STOCK_PHRASES = [
  'it is important to note', 'it is worth noting', "it's worth noting", "it's important to note", 'it is essential to',
  'it is crucial to', 'plays? an? (?:crucial|vital|key|significant|pivotal|important|essential) role', "in today's",
  'in conclusion', 'in summary', 'to summarize', 'a (?:wide )?range of', 'a wide variety of', 'a variety of', 'not only',
  'when it comes to', 'offers? (?:a |an |several |numerous |many )?(?:range of |number of )?(?:benefits|advantages|opportunities)',
  '(?:one|another) (?:important|key|major|significant) (?:benefit|aspect|factor|consideration|advantage|challenge)',
  'serves? as an?', 'stands? as an?', 'rich (?:history|tapestry|heritage)', 'navigat(?:e|es|ing) the (?:complexities|challenges)',
  'ensur(?:e|es|ing) that', 'provides? (?:valuable|practical|meaningful) ', 'as an ai', 'i hope this helps',
  'opportunities for', 'a common purpose', 'both (?:individual|personal) ', 'in the (?:realm|world|field) of', 'the power of',
  'aims? to', 'designed to', 'whether you(?:’|\')?re', 'look no further', 'let(?:’|\')s (?:dive|explore)'
];
const STOCK_RE = new RegExp(`\\b(?:${STOCK_WORDS.join('|')})\\b|\\b(?:${STOCK_PHRASES.join('|')})`, 'gi');

const OPENER_RE = /^[\s"“'(]*(?:furthermore|moreover|additionally|in addition|in conclusion|in summary|overall|ultimately|consequently|therefore|thus|hence|however|nevertheless|nonetheless|similarly|likewise|importantly|notably|firstly|secondly|thirdly|finally|lastly|first|second|third|another|one (?:important|key|major)|as a result|for example|for instance|on the other hand|in contrast|in essence|in today|by \w+ing|to \w+ this|with the (?:rise|advent)|these \w+|this \w+ (?:can|is|helps|allows|ensures|provides|makes|not only)|successful \w+)\b/i;
const VOICE_RE = /\b(?:i|me|my|mine|myself|we|us|our|ours)\b|\b\w+(?:n['’]t|['’](?:re|ve|d|ll|m))\b|\b(?:it|that|there|he|she|what|let|here|who)['’]s\b/gi;
const TRIAD_RE = /\b[\w'’-]+(?: [\w'’-]+){0,3}, [\w'’-]+(?: [\w'’-]+){0,3},? (?:and|or) [\w'’-]+/gi;
const PARTICIPLE_RE = /, (?:\w+ly )?(?!including|according|regarding|during|being|having)\w{4,}ing\b|^[\s"“]*by \w+ing\b/gi;
const INFORMAL_PUNCT_RE = /[?!(]|\.\.\.|…/g;
// Boilerplate that chat assistants wrap around an answer.
const ASSISTANT_RE = /(?<![\p{L}])(?:sure(?:!| thing)|certainly!|absolutely!|great question|happy to help|i(?:'|’)d be happy to|here(?:'|’)s a (?:quick|brief|simple|short)|here are (?:some|a few|the|\w+ (?:tips|ways|steps|ideas))|want me to|would you like me to|let me know if|i hope this helps|hope (?:this|that) helps|feel free to|as an ai\b|quick rundown|break (?:it|this|that|down the)|tl;dr)/giu;
// Concrete detail: figures, citations and names in mid-sentence.
const SPECIFIC_RE = /\d+(?:[.,]\d+)*%?|\bet al\b|(?<=[\p{Ll},;] )\p{Lu}\p{Ll}{2,}/gu;
const TERMINAL_RE = /[.!?…।:;,]["”’)\]]*$/;
const BULLET_RE = /^(?:[-*•▪◦–—]|\d{1,3}[.)])\s/;

/** Headings and short list items are layout, not prose: they must not count as "short sentences". */
function isStructural(sentence) {
  const trimmed = sentence.text.trim();
  if (sentence.words.length > 12 || TERMINAL_RE.test(trimmed)) return false;
  return /\n\s*$/.test(sentence.text) || BULLET_RE.test(trimmed);
}

const SIGNALS = {
  stock: { label: 'Stock phrasing', weight: 0.24, english: true },
  burstiness: { label: 'Sentence rhythm', weight: 0.18, minSentences: 4 },
  openers: { label: 'Formulaic sentence openers', weight: 0.12, english: true, minSentences: 3 },
  voice: { label: 'Personal voice', weight: 0.12, english: true },
  triads: { label: 'Lists of three', weight: 0.10, english: true, minSentences: 3 },
  participles: { label: 'Trailing “-ing” clauses', weight: 0.08, english: true, minSentences: 3 },
  punctuation: { label: 'Punctuation variety', weight: 0.07, minSentences: 3 },
  shortSentences: { label: 'Short sentences', weight: 0.05, minSentences: 4 },
  specificity: { label: 'Concrete detail', weight: 0.10 },
  paragraphShape: { label: 'Paragraph uniformity', weight: 0.04, minParagraphs: 3 }
};

const count = (text, re) => (text.match(re) || []).length;

function sentenceLevel(sentence, english, meanLength) {
  const n = sentence.words.length;
  if (!n) return { level: 'none', points: 0, reasons: [] };
  let points = 0; const reasons = [];
  if (english) {
    const stock = count(sentence.text, STOCK_RE);
    if (stock) { points += Math.min(stock, 3) * 1.2; reasons.push(stock === 1 ? 'stock phrase' : `${stock} stock phrases`); }
    if (OPENER_RE.test(sentence.text)) { points += 1; reasons.push('formulaic opener'); }
    if (count(sentence.text, TRIAD_RE)) { points += 0.9; reasons.push('list of three'); }
    if (count(sentence.text, PARTICIPLE_RE)) { points += 0.7; reasons.push('trailing “-ing” clause'); }
    if (count(sentence.text, ASSISTANT_RE)) { points += 1.5; reasons.push('assistant-style phrase'); }
    if (count(sentence.text, VOICE_RE)) { points -= 1.1; }
  }
  if (count(sentence.text, INFORMAL_PUNCT_RE)) points -= 0.6;
  if (n <= 6) points -= 0.8;
  else if (meanLength && Math.abs(n - meanLength) <= meanLength * 0.2 && n >= 12) { points += 0.4; }
  const level = points >= 1.9 ? 'high' : points >= 0.9 ? 'medium' : 'low';
  return { level, points, reasons };
}

/**
 * Score a passage.
 * @returns {object} score (0–100), band, confidence, per-signal breakdown, per-sentence levels and basic stats.
 */
export function scoreText(text) {
  const error = validateScore(text);
  if (error) throw new Error(error);

  const tokens = words(text);
  const language = detectLanguage(text, tokens);
  const english = language.english;
  const allSentences = sentences(text);
  const withWords = allSentences.filter(s => s.words.length);
  const prose = withWords.filter(s => !isStructural(s));
  // Score prose only; fall back to every line when the text is nothing but headings or list items.
  const sents = prose.length ? prose : withWords;
  const lengths = sents.map(s => s.words.length);
  const paras = paragraphs(text).filter(p => words(p).length > 12);
  const wordCount = tokens.length;
  const per100 = n => wordCount ? n / wordCount * 100 : 0;
  const perSentence = n => sents.length ? n / sents.length : 0;
  const meanLength = mean(lengths);

  const raw = {};
  // 1. Stock phrasing density.
  const stockHits = english ? count(text, STOCK_RE) : 0;
  raw.stock = { strength: clamp(per100(stockHits) / 2.2), detail: `${stockHits} stock ${stockHits === 1 ? 'phrase' : 'phrases'} (${per100(stockHits).toFixed(1)} per 100 words)`, hint: 'Model output leans on a recognisable set of safe, polished phrases.' };
  // 2. Burstiness: humans mix short and long sentences more than models do.
  const cv = meanLength ? deviation(lengths) / meanLength : 0;
  raw.burstiness = { strength: clamp((0.62 - cv) / 0.42), detail: `Sentence lengths vary by ${(cv * 100).toFixed(0)}% around a ${meanLength.toFixed(1)}-word average`, hint: 'Evenly sized sentences are typical of model output; people vary more.' };
  // 3. Formulaic openers.
  const openerShare = perSentence(sents.filter(s => OPENER_RE.test(s.text)).length);
  raw.openers = { strength: clamp(openerShare / 0.32), detail: `${Math.round(openerShare * 100)}% of sentences start with a stock connective`, hint: '“Furthermore”, “Another important…”, “By doing X…” and similar openers.' };
  // 4. Personal voice (first person, contractions) pulls the score down.
  const voiceRate = per100(english ? count(text, VOICE_RE) : 0);
  raw.voice = { strength: clamp(1 - voiceRate / 3.2), detail: `${voiceRate.toFixed(1)} first-person words or contractions per 100 words`, hint: 'Little personal voice is common in model output, and also in formal human writing.' };
  // 5. Lists of three.
  const triadRate = perSentence(english ? count(text, TRIAD_RE) : 0);
  raw.triads = { strength: clamp(triadRate / 0.38), detail: `${triadRate.toFixed(2)} three-part lists per sentence`, hint: 'Models favour tidy “A, B, and C” groupings.' };
  // 6. Trailing participle clauses.
  const participleRate = perSentence(english ? sents.reduce((a, s) => a + count(s.text, PARTICIPLE_RE), 0) : 0);
  raw.participles = { strength: clamp(participleRate / 0.3), detail: `${participleRate.toFixed(2)} “…, doing X” clauses per sentence`, hint: 'Sentences that end in “…, fostering growth” style clauses.' };
  // 7. Punctuation variety.
  const punctRate = perSentence(count(text, INFORMAL_PUNCT_RE));
  raw.punctuation = { strength: clamp(1 - punctRate / 0.3), detail: `${punctRate.toFixed(2)} questions, exclamations, brackets or ellipses per sentence`, hint: 'People ask questions, add asides and trail off more often.' };
  // 8. Very short sentences.
  const shortShare = perSentence(lengths.filter(n => n <= 6).length);
  raw.shortSentences = { strength: clamp(1 - shortShare / 0.22), detail: `${Math.round(shortShare * 100)}% of sentences have six words or fewer`, hint: 'Models rarely write very short sentences.' };
  // 9. Concrete detail: figures, citations and names pull the score down.
  const specificRate = per100(count(text, SPECIFIC_RE));
  raw.specificity = { strength: clamp(1 - specificRate / 4.5), detail: `${specificRate.toFixed(1)} figures, citations or mid-sentence names per 100 words`, hint: 'Generic model prose is light on numbers, sources and named people or places.' };
  // 10. Paragraph uniformity.
  const paraLengths = paras.map(p => words(p).length);
  const paraCv = mean(paraLengths) ? deviation(paraLengths) / mean(paraLengths) : 0;
  raw.paragraphShape = { strength: clamp((0.4 - paraCv) / 0.4), detail: `Paragraph lengths vary by ${(paraCv * 100).toFixed(0)}%`, hint: 'Evenly sized paragraphs are typical of model output.' };

  const signals = [];
  let total = 0, weightSum = 0;
  for (const [id, def] of Object.entries(SIGNALS)) {
    const applies = !(def.english && !english) && !(def.minSentences && sents.length < def.minSentences) && !(def.minParagraphs && paras.length < def.minParagraphs);
    if (!applies) continue;
    total += raw[id].strength * def.weight; weightSum += def.weight;
    signals.push({ id, label: def.label, strength: +raw[id].strength.toFixed(2), detail: raw[id].detail, hint: raw[id].hint });
  }
  let average = weightSum ? total / weightSum : 0.5;
  // Assistant boilerplate ("Sure! Here's a quick rundown…") is strong evidence when present, and says nothing when absent.
  const assistantHits = english ? count(text, ASSISTANT_RE) : 0;
  if (assistantHits) {
    const strength = clamp(assistantHits / 2);
    average = Math.min(1, Math.max(average + 0.2 * strength, 0.3 + 0.35 * strength));
    signals.push({ id: 'assistant', label: 'Assistant-style phrasing', strength: +strength.toFixed(2), detail: `${assistantHits} chat-assistant ${assistantHits === 1 ? 'phrase' : 'phrases'} such as “Sure!”, “Here’s a quick…” or “Let me know if…”`, hint: 'These wrappers are typical of replies copied straight from a chatbot.' });
  }
  // Stretch the weighted average onto 0–1; centre and slope were tuned on the bundled test passages.
  const stretched = 1 / (1 + Math.exp(-9 * (average - 0.5)));

  // Short or non-English passages carry little evidence, so the score is pulled toward 50.
  const lengthTrust = clamp(Math.sqrt(wordCount / 160));
  const coverage = clamp(weightSum / 0.75);
  // Text with almost no sentence boundaries, or made of a few repeated words, gives the signals nothing to measure.
  const uniqueShare = new Set(tokens.map(t => t.toLowerCase())).size / wordCount;
  const degenerate = wordCount >= 40 && (sents.length < 3 || uniqueShare < 0.15);
  const trust = lengthTrust * (english ? 1 : 0.6) * (0.5 + 0.5 * coverage) * (degenerate ? 0.25 : 1);
  const score = Math.round(clamp(50 + (stretched * 100 - 50) * trust, 0, 100));

  let confidence, confidenceNote, confidenceKey;
  if (wordCount < 40) { confidenceKey = 'tooShort'; confidence = 'Very low'; confidenceNote = 'Under 40 words. There is too little text to judge, so the score stays near 50.'; }
  else if (degenerate) { confidenceKey = 'degenerate'; confidence = 'Very low'; confidenceNote = 'This text has too few separate sentences or too much repetition for the signals to mean anything.'; }
  else if (!english) { confidenceKey = 'nonEnglish'; confidence = 'Low'; confidenceNote = 'Wording signals are tuned for English. Only structural signals were used for this text.'; }
  else if (wordCount < 120) { confidenceKey = 'short'; confidence = 'Low'; confidenceNote = 'Under 120 words. Treat the score as a rough hint.'; }
  else if (wordCount < 300) { confidenceKey = 'medium'; confidence = 'Moderate'; confidenceNote = 'A few hundred more words would make the estimate steadier.'; }
  else { confidenceKey = 'fair'; confidence = 'Fair'; confidenceNote = 'Enough text for the signals to settle. This is still an estimate, not proof.'; }

  const band = score >= 65 ? 'Mostly AI-like patterns' : score >= 40 ? 'Mixed or uncertain' : 'Mostly human-like patterns';
  const bandKey = score >= 65 ? 'high' : score >= 40 ? 'medium' : 'low';

  const sentenceView = allSentences.map(s => {
    if (s.words.length && isStructural(s) && prose.length) return { text: s.text, level: 'none', reasons: [] };
    const { level, reasons } = sentenceLevel(s, english, meanLength);
    return { text: s.text, level: wordCount < 40 ? (level === 'none' ? 'none' : 'low') : level, reasons };
  });
  const flagged = sentenceView.filter(s => s.level === 'high').length;

  return Object.freeze({
    version: ENGINE_VERSION,
    score, band, bandKey, confidence, confidenceKey, confidenceNote,
    language: language.label, english,
    signals: signals.sort((a, b) => b.strength * (SIGNALS[b.id]?.weight ?? 0.2) - a.strength * (SIGNALS[a.id]?.weight ?? 0.2)),
    sentences: sentenceView,
    flaggedSentences: flagged,
    stats: basicStats(text),
    createdAt: new Date().toISOString(),
    limitation: 'Heuristic estimate from writing-style signals. It cannot establish who or what wrote a text and must not be the sole basis for any academic, hiring or disciplinary decision.'
  });
}

/** Plain-text report. The analysed passage itself is left out. */
export function createReport(r) {
  const s = r.stats;
  const lines = [
    'FREE AI DETECTOR — SCORE REPORT',
    `Generated: ${r.createdAt}`,
    `Engine: ${r.version} (runs in the browser; no text was uploaded)`,
    '',
    `AI-likeness score: ${r.score} / 100 — ${r.band}`,
    `Confidence: ${r.confidence}. ${r.confidenceNote}`,
    `Language check: ${r.language}`,
    '',
    'SIGNALS (0 = human-like, 100 = AI-like)',
    ...r.signals.map(g => `- ${g.label}: ${Math.round(g.strength * 100)} — ${g.detail}`),
    '',
    'COUNTS',
    `Words: ${s.wordCount}`,
    `Sentences: ${s.sentenceCount}`,
    `Paragraphs: ${s.paragraphCount}`,
    `Average sentence length: ${s.averageSentenceLength} words (range ${s.shortestSentence}–${s.longestSentence}, standard deviation ${s.sentenceLengthDeviation})`,
    `Unique words: ${s.uniqueWords} of ${s.wordCount}`,
    `Three-word phrases used more than once: ${s.repeatedPhraseCount}`,
    `Sentences flagged as strongly AI-like: ${r.flaggedSentences} of ${s.sentenceCount}`,
    '',
    'METHOD',
    'A weighted combination of the signals above, mapped to a 0–100 scale. Scores for short or non-English passages are pulled toward 50 because they carry less evidence.',
    '',
    'LIMITATIONS',
    r.limitation,
    'Formal, academic or carefully edited human writing can score high. Lightly edited model output can score low. Writers using English as an additional language are more likely to be misjudged by tools of this kind.',
    ''
  ];
  return lines.join('\n');
}
