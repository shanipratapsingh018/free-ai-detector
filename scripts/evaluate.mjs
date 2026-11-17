/**
 * Measures the detector on your own labelled passages. See eval/README.md.
 *   npm run evaluate
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { scoreText } from '../public/detector.js';

const root = fileURLToPath(new URL('../eval', import.meta.url));
async function load(label) {
  const dir = join(root, label);
  const names = (await readdir(dir)).filter(n => n.endsWith('.txt'));
  const scores = [];
  for (const name of names) {
    const text = (await readFile(join(dir, name), 'utf8')).trim();
    try { scores.push({ name, score: scoreText(text.slice(0, 30000)).score }); } catch { console.warn(`skipped ${label}/${name} (empty or unreadable)`); }
  }
  return scores;
}
const pct = (n, d) => d ? `${(n / d * 100).toFixed(1)}%` : 'n/a';
const human = await load('human'), ai = await load('ai');
if (!human.length || !ai.length) {
  console.log('Add .txt files to eval/human and eval/ai first. See eval/README.md.');
  process.exit(0);
}
// Scores of 65 and above are shown to visitors as "Mostly AI-like"; under 40 as "Mostly human-like".
const flaggedHuman = human.filter(s => s.score >= 65), caughtAi = ai.filter(s => s.score >= 65);
const clearedHuman = human.filter(s => s.score < 40), missedAi = ai.filter(s => s.score < 40);
const mean = list => (list.reduce((a, s) => a + s.score, 0) / list.length).toFixed(1);
console.log(`Passages: ${human.length} human, ${ai.length} AI`);
console.log(`Average score: human ${mean(human)}, AI ${mean(ai)}`);
console.log(`AI passages scored AI-like (65+):        ${pct(caughtAi.length, ai.length)}`);
console.log(`AI passages scored human-like (<40):     ${pct(missedAi.length, ai.length)}  (missed)`);
console.log(`Human passages scored human-like (<40):  ${pct(clearedHuman.length, human.length)}`);
console.log(`Human passages scored AI-like (65+):     ${pct(flaggedHuman.length, human.length)}  (false positives)`);
console.log(`Overall accuracy at the 65 threshold:    ${pct(caughtAi.length + human.length - flaggedHuman.length, human.length + ai.length)}`);
if (flaggedHuman.length) console.log(`\nHuman files flagged: ${flaggedHuman.slice(0, 15).map(s => `${s.name} (${s.score})`).join(', ')}`);
if (missedAi.length) console.log(`AI files missed: ${missedAi.slice(0, 15).map(s => `${s.name} (${s.score})`).join(', ')}`);
