import crypto from 'node:crypto';

const COOKIE_NAME = 'sid';
const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;

/**
 * Cookie-based session middleware.
 *
 * Creates a `sid` cookie on first request (httpOnly, sameSite lax, 1 year).
 * Attaches `req.owner = { platform: 'web', id: sid }` for downstream use.
 *
 * Design decisions:
 * - httpOnly: JS cannot read the cookie (XSS protection)
 * - sameSite lax: CSRF protection while allowing top-level navigation
 * - 1 year expiry: long-lived session, no login required
 * - No server-side session store: ownership is enforced by cookie value
 *
 * @returns {import('express').RequestHandler}
 */
export function sessionMiddleware() {
  return function session(req, res, next) {
    let sid = req.cookies?.[COOKIE_NAME];

    if (!sid) {
      // Generate a new session ID — 16 bytes = 32 hex chars
      sid = crypto.randomBytes(16).toString('hex');
      res.cookie(COOKIE_NAME, sid, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: ONE_YEAR,
        path: '/',
      });
    }

    // Attach owner to request — downstream middleware and routes use this
    req.owner = { platform: 'web', id: sid };

    next();
  };
}
