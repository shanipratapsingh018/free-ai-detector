/**
 * Abuse and cost controls.
 *
 * 1. If a Cloudflare Rate Limiting binding is configured (see wrangler.jsonc), it is
 *    used per client IP and route. This is shared across a Cloudflare location.
 * 2. Otherwise an in-memory fixed window is used. It is per Worker isolate, so it is a
 *    best-effort guard only — configure the binding and provider-side spending limits
 *    for real cost control.
 * 3. A best-effort daily cap per isolate (DAILY_DETECT_LIMIT / DAILY_REVISE_LIMIT).
 *
 * The client IP is held in memory only for the current window; nothing is persisted or logged.
 */
import { ApiError } from './http.js';

const windows = new Map();
const daily = { day: '', counts: new Map() };

export function _resetForTests() { windows.clear(); daily.day = ''; daily.counts.clear(); }

function memoryLimit(key, limit, periodMs, now) {
  const entry = windows.get(key);
  if (!entry || now - entry.start >= periodMs) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 5000) { // bound memory
      for (const [k, v] of windows) if (now - v.start >= periodMs) windows.delete(k);
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

export async function enforceLimits(request, env, route, now = Date.now()) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const perMinute = Number(env.RATE_LIMIT_PER_MINUTE || 6);
  const key = `${route}:${ip}`;
  let ok;
  if (env.RATE_LIMITER && typeof env.RATE_LIMITER.limit === 'function') {
    try { ({ success: ok } = await env.RATE_LIMITER.limit({ key })); } catch { ok = memoryLimit(key, perMinute, 60000, now); }
  } else {
    ok = memoryLimit(key, perMinute, 60000, now);
  }
  if (!ok) throw new ApiError(429, 'rate_limited', 'You’re sending requests quickly. Please wait a minute and try again.', { retryAfter: 60 });

  const cap = Number(route === 'detect' ? env.DAILY_DETECT_LIMIT : env.DAILY_REVISE_LIMIT) || 0;
  if (cap > 0) {
    const day = new Date(now).toISOString().slice(0, 10);
    if (daily.day !== day) { daily.day = day; daily.counts.clear(); }
    const used = (daily.counts.get(route) || 0) + 1;
    if (used > cap) throw new ApiError(429, 'daily_cap', 'This free service has reached today’s usage cap. Please try again tomorrow.', { retryAfter: 3600 });
    daily.counts.set(route, used);
  }
}
