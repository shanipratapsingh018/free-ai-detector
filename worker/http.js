/** HTTP helpers shared by API routes. Nothing here logs request bodies or secrets. */
const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};

export function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS, ...extra },
  });
}

/** A sanitized, user-safe error. `code` is machine-readable for the UI; `message` is shown to users. */
export class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export function errorResponse(err) {
  if (err instanceof ApiError) {
    const headers = err.extra.retryAfter ? { 'Retry-After': String(err.extra.retryAfter) } : {};
    return json({ error: { code: err.code, message: err.message } }, err.status, headers);
  }
  // Unknown errors: never echo internals (they could contain provider payloads).
  return json({ error: { code: 'internal', message: 'Something went wrong on our side. Your text is unchanged; please try again.' } }, 500);
}

/** Reads a JSON body with a hard byte cap, streaming so oversized bodies are rejected early. */
export async function readJson(request, maxBytes) {
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > maxBytes) throw new ApiError(413, 'too_large', 'This request is too large. Shorten the text and try again.');
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) {
    throw new ApiError(415, 'bad_content_type', 'Expected a JSON request.');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'empty_body', 'Add some text first.');
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new ApiError(413, 'too_large', 'This request is too large. Shorten the text and try again.');
    }
    chunks.push(value);
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) { data.set(c, offset); offset += c.byteLength; }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data));
  } catch {
    throw new ApiError(400, 'bad_json', 'Could not read this request. Please try again.');
  }
}

/**
 * Wraps a provider fetch with a timeout. Maps aborts to a 504 ApiError and network
 * failures to 502 without exposing provider details.
 */
export async function providerFetch(fetcher, url, init, timeoutMs, label) {
  try {
    return await fetcher(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
      throw new ApiError(504, 'timeout', `The ${label} took too long to respond. Your text is unchanged; please try again.`);
    }
    throw new ApiError(502, 'network', `Could not reach the ${label}. Your text is unchanged; please try again.`);
  }
}

/** Maps a non-OK provider HTTP status to a sanitized ApiError. */
export function providerStatusError(status, label) {
  if (status === 401 || status === 403) {
    return new ApiError(503, 'provider_auth', `The ${label} rejected this site's credentials. The site owner needs to check the API key.`);
  }
  if (status === 402) return new ApiError(503, 'provider_quota', `The ${label} account has run out of credit or quota. Please try again later.`);
  if (status === 429) return new ApiError(429, 'provider_busy', `The ${label} is busy or this site has reached its usage limit. Please try again later.`, { retryAfter: 60 });
  if (status === 400 || status === 422) return new ApiError(502, 'provider_rejected', `The ${label} could not process this text. Try editing it or using a shorter passage.`);
  return new ApiError(502, 'provider_error', `The ${label} returned an error. Your text is unchanged; please try again.`);
}
