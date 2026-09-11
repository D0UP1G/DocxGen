import { DomainError, AiUnavailableError, AiInvalidResponseError } from '../core/errors.js';

/**
 * Express error-handler middleware.
 *
 * Layered by error type:
 *   DomainError     → its own status + { error: { code, message } }
 *   Ai*Error        → 503 + generic message (don't leak infra details)
 *   everything else → 500 + log the stack for debugging
 *
 * The `log` param is the pino logger — injected, never imported.
 */
export function errorHandler(log) {
  // Express error handlers MUST have 4 params — eslint-disable-next-line
  return function _errorHandler(err, _req, res, _next) {
    // DomainError — known business error
    if (err instanceof DomainError) {
      res.status(err.status).json({
        error: { code: err.code, message: err.message },
      });
      return;
    }

    // AI infrastructure errors — don't expose internals
    if (err instanceof AiUnavailableError || err instanceof AiInvalidResponseError) {
      res.status(503).json({
        error: { code: 'AI_UNAVAILABLE', message: err.message },
      });
      return;
    }

    // Unknown error — log stack, return generic 500
    log.error({ err }, 'Unhandled error');
    res.status(500).json({
      error: { code: 'INTERNAL', message: 'Внутренняя ошибка сервера' },
    });
  };
}
