/** Language-model service: picks an adapter, runs a mode, and validates the output. */
import { ApiError } from '../http.js';
import { countWords, LIMITS } from '../../public/limits.js';
import { INSTRUCTIONS, buildUserMessage } from './prompts.js';
import { openaiAdapter } from './openai.js';
import { anthropicAdapter } from './anthropic.js';

const ADAPTERS = { openai: openaiAdapter, anthropic: anthropicAdapter };

/** LLM_PROVIDER selects explicitly; otherwise the first adapter with a key is used (OpenAI, then Anthropic). */
export function selectAdapter(env) {
  if (env.WRITER_ENABLED === 'false') return null;
  const wanted = (env.LLM_PROVIDER || '').toLowerCase();
  if (wanted) {
    const a = ADAPTERS[wanted];
    return a && a.isConfigured(env) ? a : null;
  }
  return [openaiAdapter, anthropicAdapter].find(a => a.isConfigured(env)) || null;
}

// Acceptable output length relative to input, in words.
const RATIOS = { humanize: [0.6, 1.5], grammar: [0.8, 1.25], simplify: [0.4, 1.4], summarize: [0.05, 0.7] };

const NUMBER_RE = /\d[\d,.:/%-]*\d|\d/g;
/** Numbers present in the original but missing from the revision (a review hint, not a rejection). */
export function missingNumbers(original, revision) {
  const out = new Set(revision.match(NUMBER_RE) || []);
  return [...new Set(original.match(NUMBER_RE) || [])].filter(n => !out.has(n)).slice(0, 20);
}

export function cleanOutput(text) {
  return String(text || '')
    .replace(/^\s*```[a-z]*\n?/i, '').replace(/\n?```\s*$/, '')
    .replace(/^\s*<passage>\s*/i, '').replace(/\s*<\/passage>\s*$/i, '')
    .trim();
}

export async function revise(text, mode, env, fetcher = fetch) {
  const adapter = selectAdapter(env);
  if (!adapter) {
    throw new ApiError(503, 'writer_unavailable', 'The writing tools are not connected yet. Your text was not sent anywhere.');
  }
  const inWords = countWords(text);
  const { text: raw, model } = await adapter.generate({
    instructions: INSTRUCTIONS[mode],
    input: buildUserMessage(text),
    env,
    fetcher,
    timeoutMs: Number(env.LLM_TIMEOUT_MS || 60000),
    maxOutputTokens: Number(env.LLM_MAX_OUTPUT_TOKENS || 8000),
  });
  const output = cleanOutput(raw);
  const outWords = countWords(output);
  const [lo, hi] = RATIOS[mode];
  if (!output || output.length > LIMITS.maxChars * 2) {
    throw new ApiError(502, 'empty_output', 'The writing service returned no usable text. Your original is unchanged; please try again.');
  }
  if (outWords < Math.max(1, Math.floor(inWords * lo)) || outWords > Math.ceil(inWords * hi) + 5) {
    throw new ApiError(502, 'length_mismatch', 'The revision’s length changed too much to be trustworthy, so it was discarded. Your original is unchanged; please try again.');
  }
  return {
    mode,
    text: output,
    provider: adapter.name,
    model,
    changed: output !== text.trim(),
    missingNumbers: mode === 'summarize' ? [] : missingNumbers(text, output),
    createdAt: new Date().toISOString(),
  };
}

export function writerStatus(env) {
  const a = selectAdapter(env);
  return a ? { available: true, provider: a.name, model: a.model(env) } : { available: false, provider: null, model: null };
}
