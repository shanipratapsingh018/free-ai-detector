/**
 * Free AI Detector — Cloudflare Worker entry.
 * Static files in /public are served by Workers Static Assets; this script handles /api/*.
 *
 * Privacy: request bodies, submitted text, provider responses, and secrets are never logged
 * or stored. Text is forwarded only to the provider needed for the requested action.
 */
import { json, errorResponse, readJson, ApiError } from './http.js';
import { enforceLimits } from './ratelimit.js';
import { detectWithGptzero, isConfigured as detectorConfigured } from './detector/gptzero.js';
import { revise, writerStatus } from './llm/index.js';
import { LIMITS, REVISION_MODES, validateText } from '../public/limits.js';

function checkOrigin(request, url) {
  const origin = request.headers.get('Origin');
  if (origin !== url.origin) throw new ApiError(403, 'bad_origin', 'Please use the form on this site.');
}

async function readText(request, mode) {
  const body = await readJson(request, LIMITS.maxRequestBytes);
  const text = typeof body?.text === 'string' ? body.text.replace(/\r\n?/g, '\n') : null;
  const problem = validateText(text, mode);
  if (problem) throw new ApiError(400, 'invalid_text', problem);
  return { body, text };
}

export async function handleApi(request, env, fetcher = fetch) {
  const url = new URL(request.url);
  try {
    if (url.pathname === '/api/status') {
      if (request.method !== 'GET') throw new ApiError(405, 'method', 'Use GET.');
      return json({
        detector: { available: detectorConfigured(env), provider: 'GPTZero' },
        writer: writerStatus(env),
        limits: LIMITS,
      });
    }
    if (url.pathname === '/api/detect' || url.pathname === '/api/revise') {
      if (request.method !== 'POST') throw new ApiError(405, 'method', 'Use POST.');
      checkOrigin(request, url);
      if (url.pathname === '/api/detect') {
        // Fail fast without consuming rate-limit budget or reading text when disconnected.
        if (!detectorConfigured(env)) {
          throw new ApiError(503, 'detector_unavailable', 'The AI detector is not connected, so no score is available. Your text was not sent anywhere.');
        }
        await enforceLimits(request, env, 'detect');
        const { text } = await readText(request, 'detect');
        return json({ result: await detectWithGptzero(text, env, fetcher) });
      }
      if (!writerStatus(env).available) {
        throw new ApiError(503, 'writer_unavailable', 'The writing tools are not connected yet. Your text was not sent anywhere.');
      }
      const mode = url.searchParams.get('mode');
      if (!REVISION_MODES.includes(mode)) throw new ApiError(400, 'bad_mode', 'Choose Humanize, Fix Grammar, Simplify, or Summarize.');
      await enforceLimits(request, env, 'revise');
      const { text } = await readText(request, mode);
      return json({ result: await revise(text, mode, env, fetcher) });
    }
    throw new ApiError(404, 'not_found', 'Not found.');
  } catch (err) {
    return errorResponse(err);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env);
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  },
};
