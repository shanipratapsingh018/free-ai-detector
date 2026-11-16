/**
 * GPTZero detector adapter (server-only).
 * Docs: https://docs.gptzero.me/quickstart/ and https://docs.gptzero.me/api-reference/
 *   POST https://api.gptzero.me/v2/predict/text   header: x-api-key
 *   body: { document, multilingual?, modelVersion? }
 *   response: { version, scanId?, documents: [{ predicted_class, class_probabilities{human,ai,mixed},
 *               confidence_category, result_message, subclass, sentences[] }] }
 *
 * We only surface values GPTZero actually returned. Deprecated fields such as
 * completely_generated_prob are intentionally ignored.
 */
import { ApiError, providerFetch, providerStatusError } from '../http.js';

export const GPTZERO_ENDPOINT = 'https://api.gptzero.me/v2/predict/text';
const LABEL = 'AI detector (GPTZero)';
const CLASSES = ['human', 'mixed', 'ai'];
const CONFIDENCE = ['high', 'medium', 'low'];

export function isConfigured(env) {
  return Boolean(env.GPTZERO_API_KEY) && env.DETECTOR_ENABLED !== 'false';
}

const isProb = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const shortString = (v, max = 400) => (typeof v === 'string' && v.length <= max ? v : null);

/** Validates and normalizes a GPTZero response. Throws ApiError(502) if the shape is wrong. */
export function normalizeGptzero(data) {
  const doc = data && Array.isArray(data.documents) ? data.documents[0] : null;
  const probs = doc?.class_probabilities;
  const bad = () => new ApiError(502, 'provider_bad_response', 'The AI detector returned an unexpected response, so no score is shown. Please try again.');
  if (!doc || !probs || typeof probs !== 'object') throw bad();
  if (!CLASSES.includes(doc.predicted_class)) throw bad();
  const classProbabilities = {};
  for (const c of CLASSES) {
    if (!isProb(probs[c])) throw bad();
    classProbabilities[c] = probs[c];
  }
  const sum = CLASSES.reduce((a, c) => a + classProbabilities[c], 0);
  if (Math.abs(sum - 1) > 0.02) throw bad();

  let subclass = null;
  const sub = doc.subclass?.[doc.predicted_class]?.predicted_class;
  if (typeof sub === 'string' && /^[a-z_]{1,40}$/.test(sub)) subclass = sub;

  const sentences = Array.isArray(doc.sentences) ? doc.sentences : [];
  const highlightedSentences = sentences
    .filter(s => s && s.highlight_sentence_for_ai === true && typeof s.sentence === 'string')
    .slice(0, 300)
    .map(s => s.sentence.slice(0, 2000));

  return {
    provider: 'GPTZero',
    providerUrl: 'https://gptzero.me',
    modelVersion: shortString(data.version, 80),
    scanId: shortString(data.scanId, 120),
    predictedClass: doc.predicted_class,
    confidenceCategory: CONFIDENCE.includes(doc.confidence_category) ? doc.confidence_category : null,
    classProbabilities,
    resultMessage: shortString(doc.result_message),
    subclass,
    highlightedSentences,
    sentenceCount: sentences.length,
    checkedAt: new Date().toISOString(),
  };
}

export async function detectWithGptzero(text, env, fetcher = fetch) {
  if (!isConfigured(env)) {
    throw new ApiError(503, 'detector_unavailable', 'The AI detector is not connected, so no score is available. Your text was not sent anywhere.');
  }
  const body = { document: text };
  // GPTZero docs: don't combine modelVersion with multilingual; modelVersion wins if both are set.
  if (env.GPTZERO_MODEL_VERSION) body.modelVersion = String(env.GPTZERO_MODEL_VERSION);
  else if (env.GPTZERO_MULTILINGUAL === 'true') body.multilingual = true;

  const res = await providerFetch(fetcher, GPTZERO_ENDPOINT, {
    method: 'POST',
    headers: { 'x-api-key': env.GPTZERO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  }, Number(env.DETECTOR_TIMEOUT_MS || 30000), LABEL);

  if (!res.ok) throw providerStatusError(res.status, LABEL);
  let data;
  try { data = await res.json(); } catch { throw new ApiError(502, 'provider_bad_response', 'The AI detector returned an unreadable response, so no score is shown.'); }
  return normalizeGptzero(data);
}
