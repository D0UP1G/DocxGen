import { readOwnerHeaders } from '../shared/owners.js';

/**
 * Владелец из заголовков — для вызовов сервис-сервис.
 *
 * Сервисы ботов не шлют cookie, поэтому пользователя они называют заголовками
 * X-Owner-Platform и X-Owner-Id. Заголовки перекрывают владельца из сессии,
 * а значит решают, чьи документы вернёт сервис, — и доверять им можно только
 * после подтверждённого межсервисного ключа (req.apiKeyAuthenticated).
 *
 * Без этого условия два заголовка давали бы полный доступ к документам любого
 * пользователя: маршруты авторизуют запрос исключительно по req.owner.
 *
 * Запрос с заголовками, но без доказанного ключа отклоняется явно, а не
 * выполняется молча от имени сессии: иначе документ тихо создался бы не тому
 * владельцу и разошёлся бы с состоянием диалога в боте.
 *
 * @returns {import('express').RequestHandler}
 */
export function ownerHeaders() {
  return function _ownerHeaders(req, res, next) {
    const { owner, reason } = readOwnerHeaders(req.headers);

    const declared = req.headers['x-owner-platform'] !== undefined
      || req.headers['x-owner-id'] !== undefined;
    if (!declared) return next();

    if (!req.apiKeyAuthenticated) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Owner headers require API key authentication' },
      });
    }

    if (!owner) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: reason ?? 'Invalid owner headers' },
      });
    }

    req.owner = owner;
    next();
  };
}
