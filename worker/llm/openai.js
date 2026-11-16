/**
 * OpenAI adapter (server-only), using the Responses API:
 *   POST https://api.openai.com/v1/responses  (Authorization: Bearer <key>)
 * store:false asks OpenAI not to retain the response for later retrieval; OpenAI's
 * abuse-monitoring retention policies may still apply.
 */
import { ApiError, providerFetch, providerStatusError } from '../http.js';

export const OPENAI_ENDPOINT = 'https://api.openai.com/v1/responses';
export const OPENAI_DEFAULT_MODEL = 'gpt-6.1-terra';
const LABEL = 'writing service (OpenAI)';

export const openaiAdapter = {
  id: 'openai',
  name: 'OpenAI',
  isConfigured: env => Boolean(env.OPENAI_API_KEY),
  model: env => env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL,
  async generate({ instructions, input, env, fetcher, timeoutMs, maxOutputTokens }) {
    const body = { model: this.model(env), instructions, input, max_output_tokens: maxOutputTokens, store: false };
    if (env.OPENAI_REASONING_EFFORT) body.reasoning = { effort: env.OPENAI_REASONING_EFFORT };
    const res = await providerFetch(fetcher, OPENAI_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, timeoutMs, LABEL);
    if (!res.ok) throw providerStatusError(res.status, LABEL);
    let data;
    try { data = await res.json(); } catch { throw new ApiError(502, 'provider_bad_response', 'The writing service returned an unreadable response.'); }
    if (data?.status !== 'completed') {
      throw new ApiError(502, 'incomplete', 'The writing service stopped before finishing. Nothing was changed; try a shorter passage.');
    }
    const text = (Array.isArray(data.output) ? data.output : [])
      .filter(item => item?.type === 'message')
      .flatMap(item => (Array.isArray(item.content) ? item.content : []))
      .filter(part => part?.type === 'output_text' && typeof part.text === 'string')
      .map(part => part.text)
      .join('\n');
    return { text, model: typeof data.model === 'string' ? data.model : this.model(env) };
  },
};
