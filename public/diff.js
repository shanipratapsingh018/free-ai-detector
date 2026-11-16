/** Word-level diff (LCS) for comparing an original with its revision. Pure; no DOM. */
export function tokenize(text) {
  return String(text).match(/\s+|[\p{L}\p{N}’'-]+|[^\s\p{L}\p{N}]/gu) || [];
}

/** Returns [{type:'same'|'add'|'del', text}] segments, merged. */
export function diffWords(a, b, maxCells = 9_000_000) {
  const A = tokenize(a), B = tokenize(b);
  let pre = 0;
  while (pre < A.length && pre < B.length && A[pre] === B[pre]) pre++;
  let suf = 0;
  while (suf < A.length - pre && suf < B.length - pre && A[A.length - 1 - suf] === B[B.length - 1 - suf]) suf++;
  const a2 = A.slice(pre, A.length - suf), b2 = B.slice(pre, B.length - suf);
  const out = [];
  const push = (type, text) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text; else out.push({ type, text });
  };
  push('same', A.slice(0, pre).join(''));
  const n = a2.length, m = b2.length;
  if ((n + 1) * (m + 1) > maxCells) {
    // Too large for a fine diff: show as a block replacement.
    push('del', a2.join('')); push('add', b2.join(''));
  } else {
    const W = m + 1;
    const L = new Uint16Array((n + 1) * W);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        L[i * W + j] = a2[i] === b2[j] ? L[(i + 1) * W + j + 1] + 1 : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
      }
    }
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a2[i] === b2[j]) { push('same', a2[i]); i++; j++; }
      else if (L[(i + 1) * W + j] >= L[i * W + j + 1]) { push('del', a2[i]); i++; }
      else { push('add', b2[j]); j++; }
    }
    while (i < n) push('del', a2[i++]);
    while (j < m) push('add', b2[j++]);
  }
  push('same', A.slice(A.length - suf).join(''));
  return out;
}

export function diffStats(segments) {
  const words = s => (s.match(/[\p{L}\p{N}]+/gu) || []).length;
  let added = 0, removed = 0;
  for (const s of segments) {
    if (s.type === 'add') added += words(s.text);
    if (s.type === 'del') removed += words(s.text);
  }
  return { added, removed };
}
