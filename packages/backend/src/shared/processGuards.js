import { env } from '../config/env.js';
import { logFilePath } from '../logger.js';

/**
 * Общие страховки для точки входа любого сервиса.
 *
 * Одиночный потерянный отказ промиса (например, таймаут стороннего API) не должен
 * ронять единый backend вместе с веб-клиентом и адаптерами. Пишем в лог и
 * работаем дальше. Заодно печатаем уровень и путь к файлу лога.
 *
 * Здесь же — единственное предупреждение о выключенной аутентификации внешних
 * интеграций: без API_KEY заголовки владельца отклоняются. Встроенные MAX/VK
 * адаптеры работают напрямую и от этого ключа не зависят. На проде пустой ключ
 * вообще не даёт стартовать (проверка в config/env.js).
 *
 * @param {object} log - pino-совместимый логгер
 * @param {string} service - имя сервиса, попадает в записи
 */
export function installProcessGuards(log, service) {
  log.info({ service, logLevel: env.LOG_LEVEL, file: logFilePath }, 'Логи: уровень и файл (JSON-строки, грепается)');

  if (!env.API_KEY) {
    log.warn(
      { service },
      'API_KEY не задан: аутентификация внешних owner-заголовков выключена — такие интеграции будут отклонены',
    );
  }

  process.on('unhandledRejection', (reason) => {
    log.error(
      { service, err: reason instanceof Error ? reason : new Error(String(reason)) },
      'необработанный отказ промиса — процесс продолжает работу',
    );
  });
}
