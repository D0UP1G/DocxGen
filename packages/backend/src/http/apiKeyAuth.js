import { env } from '../config/env.js';

/**
 * API Key authentication middleware.
 *
 * Checks the X-API-Key header against the configured API_KEY.
 * Skips authentication if no API_KEY is set (backward compatible with tests).
 * Skips /health endpoint (always available without auth).
 *
 * Design decisions:
 * - Conditional auth: if env.API_KEY is empty/missing, middleware passes through.
 *   This allows tests to work without setting API_KEY, and production to enforce it.
 * - Uses timing-safe comparison to prevent timing attacks on the key.
 * - Returns structured JSON error matching the existing error format.
 *
 * @returns {import('express').RequestHandler}
 */
export function apiKeyAuth() {
  return function _apiKeyAuth(req, res, next) {
    // Skip auth if no API key is configured — allows tests to work without it
    if (!env.API_KEY) return next();

    const key = req.headers['x-api-key'];

    if (!key) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Missing API key' },
      });
    }

    // Timing-safe comparison to prevent timing attacks
    if (!timingSafeEqual(key, env.API_KEY)) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Invalid API key' },
      });
    }

    next();
  };
}

/**
 * Timing-safe string comparison to prevent timing attacks.
 * Compares strings of equal length; returns false for different lengths
 * without revealing which string was shorter.
 */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) {
    // Still compare to avoid short-circuit timing leak
    let result = a.length === b.length ? 0 : 1;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ (b.charCodeAt(i % b.length) || 0);
    }
    return result === 0;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
