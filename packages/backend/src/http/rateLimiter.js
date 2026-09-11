/**
 * Simple in-memory rate limiter for mutating routes.
 *
 * Limits: 30 requests per minute per IP.
 * Returns 429 with structured error on violation.
 *
 * Design decisions:
 * - In-memory: no external dependencies (Redis), good enough for single-instance
 * - Sliding window with cleanup: prevents memory leak from abandoned IPs
 * - Per-IP: fair across users, simple to implement
 * - Only mutating routes (POST/PUT/PATCH/DELETE): GET is safe, no rate limit needed
 *
 * @param {{ windowMs?: number, max?: number }} options
 * @returns {import('express').RequestHandler & { reset: () => void }}
 */
export function rateLimiter({ windowMs = 60_000, max = 30 } = {}) {
  const hits = new Map();

  // Periodic cleanup to prevent memory leak from abandoned IPs
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits) {
      if (now - entry.windowStart > windowMs * 2) {
        hits.delete(ip);
      }
    }
  }, windowMs);

  // Allow the timer to not keep the process alive
  if (cleanup.unref) cleanup.unref();

  function rateLimit(req, res, next) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();

    let entry = hits.get(ip);

    if (!entry || now - entry.windowStart > windowMs) {
      // New window
      entry = { windowStart: now, count: 0 };
      hits.set(ip, entry);
    }

    entry.count++;

    if (entry.count > max) {
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many requests' },
      });
      return;
    }

    // Set rate limit headers for transparency
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    res.set('X-RateLimit-Reset', String(Math.ceil((entry.windowStart + windowMs) / 1000)));

    next();
  }

  // Expose reset for testing — clears all IP counters
  rateLimit.reset = () => hits.clear();

  return rateLimit;
}
