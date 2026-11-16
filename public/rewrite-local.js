/**
 * Offline, rule-based rewriting. Works with no server and no API key.
 *
 * These tools are deliberately conservative: they swap stiff wording for plainer wording,
 * tidy mechanics and pick key sentences. They never invent content. URLs, e-mail addresses,
 * numbers and quoted passages are protected and returned untouched.
 * A language model (when the site owner connects one) produces deeper rewrites.
 */
import { words, sentences, detectLanguage } from './engine.js';

export const ACTIONS = Object.freeze({
  humanize: { label: 'Humanize', verb: 'Humanizing', summary: 'Plainer, more natural wording' },
  grammar: { label: 'Fix grammar', verb: 'Checking', summary: 'Spelling, spacing and basic grammar' },
  simplify: { label: 'Simplify', verb: 'Simplifying', summary: 'Shorter words and sentences' },
  summarize: { label: 'Summarize', verb: 'Summarizing', summary: 'The key sentences only' }
});

/* ---------- protection of spans that must not change ---------- */
const PROTECT_RE = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|[\w.+-]+@[\w-]+\.[\w.-]+|"[^"\n]{1,400}"|“[^”\n]{1,400}”|`[^`\n]+`/g;
function protect(text) {
  const kept = [];
  const masked = text.replace(PROTECT_RE, m => { kept.push(m); return `${kept.length - 1}`; });
  return { masked, restore: s => s.replace(/(\d+)/g, (_, i) => kept[+i]) };
}

/* ---------- replacement helpers ---------- */
const matchCase = (source, replacement) => {
  if (!replacement) return replacement;
  if (source.length > 1 && source === source.toUpperCase() && /[A-Z]/.test(source)) return replacement.toUpperCase();
  if (/^[A-Z]/.test(source)) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
};
function applyRules(text, rules) {
  let changes = 0;
  for (const [pattern, replacement] of rules) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])${replacement ? '' : '\\s?'}`, 'giu');
    text = text.replace(re, (m, ...groups) => {
      changes++;
      return matchCase(m, replacement.replace(/\$(\d)/g, (_, n) => groups[+n - 1] ?? ''));
    });
  }
  return { text, changes };
}
// After deleting a leading phrase, the next word needs a capital letter.
const recapitalize = text => sentences(text).map(s => s.text.replace(/^([\s"“'(]*)(\p{Ll})/u, (_, lead, ch) => lead + ch.toUpperCase())).join('');
const tidySpaces = text => text.replace(/[ \t]{2,}/g, ' ').replace(/ +([,.;:!?])/g, '$1').replace(/([,;:])\1+/g, '$1').replace(/^ +/gm, '');

/* ---------- humanize ---------- */
const PLAIN_WORDING = [
  // filler that can simply go
  ["it is important to note that", ''], ["it is worth noting that", ''], ["it should be noted that", ''],
  ["it(?:'|’)s (?:worth noting|important to note) that", ''], ["in today(?:'|’)s (?:(?:fast-paced|digital|modern|ever-evolving|rapidly changing|competitive) )*(?:world|age|landscape|era|environment),", ''],
  ["needless to say,", ''], ["at the end of the day,", ''],
  // stiff connectives
  ['furthermore,', 'also,'], ['moreover,', 'plus,'], ['additionally,', 'also,'], ['in addition,', 'also,'],
  ['consequently,', 'so,'], ['therefore,', 'so,'], ['thus,', 'so,'], ['hence,', 'so,'], ['nevertheless,', 'still,'], ['nonetheless,', 'still,'],
  ['in conclusion,', 'in short,'], ['to summarize,', 'in short,'], ['in summary,', 'in short,'], ['ultimately,', 'in the end,'],
  // phrases
  ['in order to', 'to'], ['due to the fact that', 'because'], ['in the event that', 'if'], ['at this point in time', 'now'],
  ['with regard to', 'about'], ['with respect to', 'about'], ['in terms of', 'for'], ['prior to', 'before'], ['subsequent to', 'after'],
  ['a wide range of', 'many'], ['a wide variety of', 'many'], ['a variety of', 'many'], ['a plethora of', 'plenty of'], ['a myriad of', 'many'],
  ['plays a (?:crucial|vital|key|pivotal|significant|important) role in', 'matters a lot for'], ['plays an (?:important|essential|integral) role in', 'matters a lot for'],
  ['is a testament to', 'shows'], ['serves as a', 'is a'], ['serves as an', 'is an'], ['stands as a', 'is a'],
  ['delve into', 'look into'], ['delves into', 'looks into'], ['delving into', 'looking into'],
  ['navigate the complexities of', 'deal with'], ['navigating the complexities of', 'dealing with'],
  ['in the realm of', 'in'], ['when it comes to', 'for'], ['it is essential to', 'you need to'], ['it is crucial to', 'you need to'],
  ['offer a (?:wide )?range of benefits', 'do a lot'], ['offers a (?:wide )?range of benefits', 'does a lot'], ['a range of', 'many'],
  ['provide opportunities for (\\p{L}+) to', 'let $1'], ['provides opportunities for (\\p{L}+) to', 'lets $1'],
  ['(one|another) (?:important|key|major|significant) (benefit|aspect|factor|advantage|challenge|consideration)', '$1 $2'],
  ['not only ([^.;,\\n]{3,80}?) but also', '$1 and also'], ['help ensure that', 'help make sure'], ['ensure that', 'make sure'],
  ['ensures that', 'makes sure'], ['ensuring that', 'making sure'], ['contribute to', 'add to'], ['contributes to', 'adds to'],
  ['contributing to', 'adding to'], ['a common purpose', 'a shared goal'], ['vast amounts of', 'huge amounts of'], ['such as', 'like'],
  ['aims to', 'tries to'], ['aim to', 'try to'], ['is designed to', 'is meant to'], ['are designed to', 'are meant to'], ['it is clear that', ''],
  ['overall,', 'all in all,'], ['however,', 'but'], ['as a result,', 'so,'], ['on the other hand,', 'then again,'],
  // single words
  ['more meaningful', 'more worthwhile'], ['meaningful', 'real'], ['thoughtful', 'careful'], ['valuable', 'useful'], ['ongoing', 'steady'], ['various', 'different'],
  ['require', 'need'], ['requires', 'needs'], ['required', 'needed'], ['significant', 'big'], ['transformative', 'far-reaching'],
  ['innovative', 'new'], ['essential', 'vital'], ['utilize', 'use'], ['utilizes', 'uses'], ['utilized', 'used'], ['utilizing', 'using'], ['utilization', 'use'],
  ['leverage', 'use'], ['leverages', 'uses'], ['leveraging', 'using'], ['leveraged', 'used'],
  ['facilitate', 'help'], ['facilitates', 'helps'], ['facilitating', 'helping'],
  ['foster', 'build'], ['fosters', 'builds'], ['fostering', 'building'],
  ['enhance', 'improve'], ['enhances', 'improves'], ['enhancing', 'improving'], ['enhanced', 'improved'],
  ['demonstrate', 'show'], ['demonstrates', 'shows'], ['demonstrated', 'showed'], ['demonstrating', 'showing'],
  ['numerous', 'many'], ['individuals', 'people'], ['approximately', 'about'], ['commence', 'start'], ['commences', 'starts'],
  ['crucial', 'key'], ['pivotal', 'key'], ['paramount', 'vital'], ['robust', 'strong'], ['seamless', 'smooth'], ['seamlessly', 'smoothly'],
  ['comprehensive', 'thorough'], ['multifaceted', 'complex'], ['myriad', 'many'], ['harness', 'use'], ['harnessing', 'using'],
  ['streamline', 'simplify'], ['streamlines', 'simplifies'], ['empower', 'help'], ['empowers', 'helps'], ['empowering', 'helping'],
  ['underscores', 'shows'], ['underscore', 'show'], ['showcases', 'shows'], ['showcasing', 'showing'], ['endeavor', 'try'], ['endeavour', 'try']
];
const CONTRACTIONS = [
  ['it is(?= \\p{Ll})', "it's"], ['that is(?= \\p{Ll})', "that's"], ['there is(?= \\p{Ll})', "there's"], ['what is(?= \\p{Ll})', "what's"],
  ['do not', "don't"], ['does not', "doesn't"], ['did not', "didn't"], ['is not', "isn't"], ['are not', "aren't"], ['was not', "wasn't"],
  ['were not', "weren't"], ['cannot', "can't"], ['can not', "can't"], ['will not', "won't"], ['would not', "wouldn't"], ['should not', "shouldn't"],
  ['could not', "couldn't"], ['have not', "haven't"], ['has not', "hasn't"], ['had not', "hadn't"],
  ['they are(?= \\p{Ll})', "they're"], ['we are(?= \\p{Ll})', "we're"], ['you are(?= \\p{Ll})', "you're"], ['i am', "I'm"], ['i will', "I'll"], ['let us', "let's"]
];

function splitLongSentences(text, limit) {
  let changes = 0;
  const out = sentences(text).map(s => {
    if (s.words.length <= limit || !s.text.includes(';')) return s.text;
    const parts = s.text.split(/;\s+/);
    if (parts.some(p => words(p).length < 5)) return s.text;
    changes += parts.length - 1;
    return parts.map((p, i) => i === 0 ? p : p[0].toUpperCase() + p.slice(1)).join('. ');
  }).join('');
  return { text: out, changes };
}

function humanizeEnglish(masked) {
  let total = 0;
  let r = applyRules(masked, PLAIN_WORDING); total += r.changes;
  r = applyRules(r.text, CONTRACTIONS); total += r.changes;
  r = splitLongSentences(r.text, 34); total += r.changes;
  return { text: recapitalize(tidySpaces(r.text)), changes: total };
}

/* ---------- grammar and mechanics ---------- */
const TYPOS = [
  ['teh', 'the'], ['recieve', 'receive'], ['recieved', 'received'], ['definately', 'definitely'], ['seperate', 'separate'], ['occured', 'occurred'],
  ['occurence', 'occurrence'], ['untill', 'until'], ['wich', 'which'], ['alot', 'a lot'], ['becuase', 'because'], ['beleive', 'believe'],
  ['acheive', 'achieve'], ['accomodate', 'accommodate'], ['adress', 'address'], ['begining', 'beginning'], ['enviroment', 'environment'],
  ['goverment', 'government'], ['independant', 'independent'], ['neccessary', 'necessary'], ['necesary', 'necessary'], ['occassion', 'occasion'],
  ['publically', 'publicly'], ['refered', 'referred'], ['succesful', 'successful'], ['tommorow', 'tomorrow'], ['truely', 'truly'], ['wierd', 'weird'],
  ['thier', 'their'], ['freind', 'friend'], ['arguement', 'argument'], ['calender', 'calendar'], ['existance', 'existence'], ['grammer', 'grammar'],
  ['dont', "don't"], ['doesnt', "doesn't"], ['didnt', "didn't"], ['isnt', "isn't"], ['wasnt', "wasn't"], ['couldnt', "couldn't"],
  ['shouldnt', "shouldn't"], ['wouldnt', "wouldn't"], ['havent', "haven't"], ['im', "I'm"], ['ive', "I've"], ['could of', 'could have'],
  ['should of', 'should have'], ['would of', 'would have']
];
const AN_EXCEPTIONS = /^(?:uni|use|usu|uti|eu|one|once|ubiq|ura|uro)/i; // vowel letter, consonant sound
const A_EXCEPTIONS = /^(?:hour|honest|honor|honour|heir|mba|mri|html|http|fbi|sms|x-ray)/i; // consonant letter, vowel sound

function fixMechanics(masked, english) {
  let changes = 0;
  const step = (re, fn) => {
    masked = masked.replace(re, (...args) => {
      const out = typeof fn === 'function' ? fn(...args) : fn.replace(/\$(\d)/g, (_, n) => args[+n] ?? '');
      if (out !== args[0]) changes++;
      return out;
    });
  };
  step(/[ \t]+$/gm, '');
  step(/[ \t]{2,}/g, ' ');
  step(/ +([,.;:!?।])(?!\d)/g, '$1');
  step(/([.!?।])(?=\p{Lu}\p{Ll}|[\u0900-\u097F])/gu, '$1 ');
  step(/([,;!?])(?=[\p{L}])/gu, '$1 ');
  step(/\b(\p{L}+) \1\b/giu, (m, w) => /^(?:that|had|is|very|so|no|bye|ha|ho)$/i.test(w) ? m : w);
  step(/([,;:])\1+/g, '$1');
  step(/([!?])\1{2,}/g, '$1');
  if (english) {
    const r = applyRules(masked, TYPOS); masked = r.text; changes += r.changes;
    step(/(?<![\p{L}'’])i(?=[\s,.;:!?'’]|$)/gu, 'I');
    step(/([.!?])(?=I[\s'’])/g, '$1 ');
    step(/\b(a|an) (\p{L}[\p{L}-]*)/giu, (m, article, word) => {
      const vowelSound = (/^[aeiou]/i.test(word) && !AN_EXCEPTIONS.test(word)) || A_EXCEPTIONS.test(word);
      if (word.length === 1 || word === word.toUpperCase()) return m; // single letters and acronyms are unpredictable
      const want = vowelSound ? 'an' : 'a';
      return article.toLowerCase() === want ? m : matchCase(article, want) + ' ' + word;
    });
  }
  const before = masked;
  masked = recapitalize(masked);
  // The sentence segmenter does not break before a lowercase letter, so catch "…here. see" separately.
  if (english) masked = masked.replace(/(\p{L}+)([.!?]\s+)(\p{Ll})/gu, (m, word, gap, ch) => /^(?:etc|viz|approx|fig|vs|al|no|eg|ie|g|e|i|m|a|p)$/i.test(word) || word.length < 3 ? m : word + gap + ch.toUpperCase());
  if (masked !== before) changes++;
  return { text: masked, changes };
}

/* ---------- simplify ---------- */
const SIMPLER = [
  ...PLAIN_WORDING,
  ['assistance', 'help'], ['purchase', 'buy'], ['purchased', 'bought'], ['sufficient', 'enough'], ['terminate', 'end'], ['terminated', 'ended'],
  ['obtain', 'get'], ['obtained', 'got'], ['require', 'need'], ['requires', 'needs'], ['required', 'needed'], ['regarding', 'about'],
  ['concerning', 'about'], ['methodology', 'method'], ['implement', 'carry out'], ['implemented', 'carried out'], ['implementation', 'rollout'],
  ['additional', 'more'], ['attempt', 'try'], ['attempted', 'tried'], ['component', 'part'], ['components', 'parts'], ['indicate', 'show'],
  ['indicates', 'shows'], ['indicated', 'showed'], ['initial', 'first'], ['initiate', 'start'], ['modify', 'change'], ['modified', 'changed'],
  ['objective', 'goal'], ['objectives', 'goals'], ['optimal', 'best'], ['possess', 'have'], ['possesses', 'has'], ['primarily', 'mainly'],
  ['principal', 'main'], ['provide', 'give'], ['provides', 'gives'], ['provided', 'gave'], ['retain', 'keep'], ['substantial', 'large'],
  ['frequently', 'often'], ['inquire', 'ask'], ['locate', 'find'], ['numerous', 'many'], ['participate', 'take part'], ['remainder', 'rest'],
  ['beneficial', 'helpful'], ['significant', 'big'], ['significantly', 'greatly'], ['however,', 'but'], ['a number of', 'several'],
  ['in spite of the fact that', 'although'], ['for the purpose of', 'for'], ['has the ability to', 'can'], ['have the ability to', 'can'],
  ['is able to', 'can'], ['are able to', 'can'], ['in close proximity to', 'near'], ['the majority of', 'most'], ['on a daily basis', 'daily']
];

/* ---------- summarize (extractive) ---------- */
const STOP = new Set('the of and to a in is that it for was on with as be by at this are or from an have not but had they you which we his her their has were been one all can will there if more when would who so no what about its than into them only other some could these two may then do any my our over such also most i he she'.split(' '));
function summarize(text) {
  const sents = sentences(text).filter(s => s.words.length >= 3);
  if (sents.length <= 2) return { text: text.trim(), changes: 0, note: 'This passage is already only one or two sentences long.' };
  const freq = new Map();
  for (const s of sents) for (const w of s.words) { const k = w.toLowerCase(); if (!STOP.has(k) && k.length > 1) freq.set(k, (freq.get(k) || 0) + 1); }
  const top = Math.max(...freq.values(), 1);
  const scored = sents.map((s, index) => {
    let score = 0;
    for (const w of new Set(s.words.map(x => x.toLowerCase()))) score += (freq.get(w) || 0) / top;
    score /= Math.sqrt(s.words.length);
    if (index === 0) score *= 1.35; // opening sentences usually set the topic
    if (/\d/.test(s.text)) score *= 1.1; // keep concrete figures
    return { index, score, text: s.text.trim() };
  });
  const keep = Math.min(7, Math.max(1, Math.round(sents.length * 0.3)));
  const chosen = scored.slice().sort((a, b) => b.score - a.score).slice(0, keep).sort((a, b) => a.index - b.index);
  return { text: chosen.map(c => c.text).join(' '), changes: sents.length - chosen.length, note: `Kept ${chosen.length} of ${sents.length} sentences, word for word.` };
}

/**
 * Run an offline rewrite.
 * @returns {{text:string, changes:number, note:string}}
 */
export function rewriteLocally(text, action = 'humanize') {
  if (!ACTIONS[action]) throw new Error('Unknown action.');
  if (action === 'summarize') return summarize(text);
  const english = detectLanguage(text).english;
  const { masked, restore } = protect(text);
  let result;
  if (action === 'grammar') result = fixMechanics(masked, english);
  else if (!english) result = { ...fixMechanics(masked, false), limited: true };
  else if (action === 'humanize') result = humanizeEnglish(masked);
  else {
    const swapped = applyRules(masked, SIMPLER);
    const split = splitLongSentences(swapped.text, 24);
    result = { text: recapitalize(tidySpaces(split.text)), changes: swapped.changes + split.changes };
  }
  const output = restore(result.text);
  let note;
  if (result.limited) note = 'Offline wording rules cover English only, so only spacing and punctuation were tidied. Connect a language model for other languages.';
  else if (!result.changes) note = 'The offline rules found nothing to change in this text.';
  else note = `${result.changes} ${result.changes === 1 ? 'edit' : 'edits'} made by offline rules.`;
  return { text: output, changes: result.changes, note };
}
