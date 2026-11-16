/** Pure browser-local analysis. No network, persistence, or authorship classification. */
export const LIMITS = Object.freeze({ minWords: 50, maxWords: 1500, maxChars: 100000, maxBytes: 100000 });
export function words(text) {
  return text.match(/[\p{L}\p{N}]+(?:[’'\-][\p{L}\p{N}]+)*/gu) || [];
}
export function validate(text) {
  const n = words(text).length;
  if (!text.trim()) return 'Add some text first, or try an example below the editor.';
  if (text.length > LIMITS.maxChars) return 'This passage is too long. Use fewer than 100,000 characters and no more than 1,500 words.';
  if (n < LIMITS.minWords) return `Add ${LIMITS.minWords - n} more words to reach the 50-word minimum.`;
  if (n > LIMITS.maxWords) return `This passage has ${n.toLocaleString('en-US')} words. Shorten it to 1,500 words or fewer; your text has not been cut.`;
  return null;
}
export function analyzeText(text) {
  const error = validate(text);
  if (error) throw new Error(error);
  const tokens = words(text.toLowerCase());
  const sentences = text.split(/[.!?。！？]+(?:[”"’']|\s|$)|\n+/u).map(s => words(s).length).filter(Boolean);
  const mean = sentences.reduce((a, b) => a + b, 0) / sentences.length;
  const deviation = Math.sqrt(sentences.reduce((a, n) => a + (n - mean) ** 2, 0) / sentences.length);
  const unique = new Set(tokens).size;
  const phrases = new Map();
  for (let i = 0; i < tokens.length - 2; i++) {
    const phrase = tokens.slice(i, i + 3).join(' ');
    phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
  }
  const repeated = [...phrases].filter(([, n]) => n > 1).length;
  return Object.freeze({ version: 'local-patterns-1.0', mode: 'Experimental writing-pattern analysis', wordCount: tokens.length,
    sentenceCount: sentences.length, averageSentenceLength: +mean.toFixed(1), sentenceLengthDeviation: +deviation.toFixed(1),
    shortestSentence: Math.min(...sentences), longestSentence: Math.max(...sentences), uniqueWords: unique, repeatedPhraseCount: repeated,
    createdAt: new Date().toISOString(), limitation: 'No trained AI detector is connected. These observations cannot establish authorship or estimate AI probability.' });
}
export function createReport(r) {
  return `FREE AI DETECTOR\n${r.mode}\nGenerated: ${r.createdAt}\nEngine: ${r.version}\n\n${r.limitation}\n\nOBSERVATIONS\nWords: ${r.wordCount}\nSentences: ${r.sentenceCount}\nAverage sentence length: ${r.averageSentenceLength} words\nSentence length range: ${r.shortestSentence}–${r.longestSentence} words\nSentence length standard deviation: ${r.sentenceLengthDeviation} words\nUnique words (case-insensitive): ${r.uniqueWords} of ${r.wordCount}\nDistinct three-word phrases occurring more than once: ${r.repeatedPhraseCount}\n\nMETHOD\nLocal, deterministic counts of Unicode words, punctuation-delimited sentences, unique lowercased words, and repeated overlapping three-word phrases. Apostrophes and hyphens within words are retained. Abbreviations and punctuation may affect sentence boundaries. Vocabulary counts vary with passage length. Repeated phrases can be ordinary language.\n\nLIMITATIONS\nIntended for English prose. Not validated for AI detection. No accuracy or AI percentage is provided. Editing, genre, language proficiency, passage length, and punctuation affect patterns. Never use this report alone for academic, employment, or disciplinary decisions.\n\nPRIVACY\nAnalysis runs in your browser. The app sends no editor text to a server and does not save submissions. Your original passage is omitted from this report.\n`;
}
