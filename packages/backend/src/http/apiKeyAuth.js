import crypto from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Межсервисная аутентификация по ключу X-API-Key.
 *
 * Design decisions:
 * - Ключ приходит параметром (по умолчанию из env) — так его можно подменить
 *   в тестах, не трогая глобальное окружение, как и остальные зависимости здесь.
 * - При успешной сверке выставляется req.apiKeyAuthenticated. На этот признак
 *   опирается ownerHeaders(): доверять заголовкам владельца можно только после
 *   доказанной принадлежности вызова к своим сервисам.
 * - Ключ проверяется, только если он предъявлен. Веб-клиент публичный и ключа
 *   не имеет: он приходит из браузера с cookie сессии и работает от своего имени.
 *   Требовать ключ от всех означало бы закрыть веб-клиент; охраняется не доступ
 *   к API, а возможность выдать себя за другого владельца (ownerHeaders).
 * - Предъявленный неверный ключ — отказ: это не браузер, а сломанный или чужой сервис.
 * - Сравнение постоянного времени идёт по SHA-256-дайджестам: буферы всегда
 *   одной длины, поэтому длина настоящего ключа не утекает по времени ответа.
 *
 * @param {{ apiKey?: string }} [options]
 * @returns {import('express').RequestHandler}
 */
export function apiKeyAuth({ apiKey = env.API_KEY } = {}) {
  return function _apiKeyAuth(req, res, next) {
    const provided = req.headers['x-api-key'];

    if (typeof provided !== 'string' || provided.length === 0) return next();
    if (!apiKey) return next();

    if (!secretEquals(provided, apiKey)) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Invalid API key' },
      });
    }

    req.apiKeyAuthenticated = true;
    next();
  };
}

/**
 * Сравнение секретов за постоянное время.
 * Сравниваются дайджесты, а не сами строки: длины буферов совпадают всегда,
 * поэтому timingSafeEqual не бросает и не выдаёт длину ключа.
 */
function secretEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const digestA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const digestB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(digestA, digestB);
}
