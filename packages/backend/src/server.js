import { env } from './config/env.js';
import { log } from './logger.js';
import { createApp } from './app.js';

// Database will be initialized here in B2
// import { openDb } from './db/index.js';

const app = createApp({ log, deps: {} });

const server = app.listen(env.PORT, () => {
  log.info({ port: env.PORT }, `Сервер запущен на порту ${env.PORT}`);
});

// Graceful shutdown — close server, then clean up resources
function shutdown(signal) {
  log.info({ signal }, 'Получен сигнал завершения, остановка сервера...');
  server.close(() => {
    // Close database connection here in B2
    // db.close();
    log.info('Сервер остановлен');
    process.exit(0);
  });

  // Force exit after 10s if graceful shutdown stalls
  setTimeout(() => {
    log.error('Принудительное завершение — таймаут graceful shutdown');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
