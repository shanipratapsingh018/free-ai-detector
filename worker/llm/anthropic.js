/**
 * Anthropic adapter (server-only), using the Messages API:
 *   POST https://api.anthropic.com/v1/messages  (x-api-key, anthropic-version)
 */
import { ApiError, providerFetch, providerStatusError } from '../http.js';

export const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-5-5';
const LABEL = 'writing service (Anthropic)';

export const anthropicAdapter = {
  id: 'anthropic',
  name: 'Anthropic',
  isConfigured: env => Boolean(env.ANTHROPIC_API_KEY),
  model: env => env.ANTHROPIC_MODEL || ANTHROPIC_DEFAULT_MODEL,
  async generate({ instructions, input, env, fetcher, timeoutMs, maxOutputTokens }) {
    const res = await providerFetch(fetcher, ANTHROPIC_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': env.ANTHROPIC_VERSION || '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model(env),
        max_tokens: maxOutputTokens,
        system: instructions,
        messages: [{ role: 'user', content: input }],
      }),
    }, timeoutMs, LABEL);
    if (!res.ok) throw providerStatusError(res.status, LABEL);
    let data;
    try { data = await res.json(); } catch { throw new ApiError(502, 'provider_bad_response', 'The writing service returned an unreadable response.'); }
    if (data?.stop_reason !== 'end_turn' && data?.stop_reason !== 'stop_sequence') {
      throw new ApiError(502, 'incomplete', 'The writing service stopped before finishing. Nothing was changed; try a shorter passage.');
    }
    const text = (Array.isArray(data.content) ? data.content : [])
      .filter(b => b?.type === 'text' && typeof b.text === 'string')
      .map(b => b.text)
      .join('\n');
    return { text, model: typeof data.model === 'string' ? data.model : this.model(env) };
  },
};
