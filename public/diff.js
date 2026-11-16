/** Word-level diff (longest common subsequence) used to show what a rewrite changed. */

const tokenize = text => text.match(/\s+|[\p{L}\p{M}\p{N}'’-]+|[^\s\p{L}\p{M}\p{N}]/gu) || [];

/**
 * @returns {Array<{type:'same'|'add'|'remove', text:string}>} runs in reading order.
 * Falls back to a whole-text replacement when the inputs are too large to compare cheaply.
 */
export function diffWords(before, after) {
  const a = tokenize(before), b = tokenize(after);
  if (a.length * b.length > 9000000) return [{ type: 'remove', text: before }, { type: 'add', text: after }];
  const width = b.length + 1;
  const table = new Uint16Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * width + j] = a[i] === b[j] ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }
  const runs = [];
  const push = (type, text) => { const last = runs[runs.length - 1]; if (last && last.type === type) last.text += text; else runs.push({ type, text }); };
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { push('same', a[i]); i++; j++; }
    else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) push('remove', a[i++]);
    else push('add', b[j++]);
  }
  while (i < a.length) push('remove', a[i++]);
  while (j < b.length) push('add', b[j++]);
  return runs;
}
