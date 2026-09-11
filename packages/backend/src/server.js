import { env } from './config/env.js';
import { log } from './logger.js';
import { createApp } from './app.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDb } from './db/index.js';
import { createQueue } from './jobs/queue.js';
import { startWorker } from './jobs/worker.js';
import { createAiProvider } from './ai/provider.js';
import { processDraft } from './ai/processDraft.js';
import { loadDocTypes } from './catalog/docTypes.js';
import { loadTemplates } from './catalog/templates.js';
import { createFileStorage } from './storage/files.js';
import { createDocumentService } from './core/documentService.js';
import { createProcessDocumentHandler } from './jobs/handlers/processDocument.js';
import { renderDocx } from './docx/render.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '..');
fs.mkdirSync(env.DATA_DIR, { recursive: true });
const db = openDb(path.resolve(env.DATA_DIR, 'docxgen.sqlite'), { log });
const queue = createQueue(db);
queue.recover();
const docTypes = loadDocTypes(path.join(backendRoot, 'config/doc-types'), log);
const templates = loadTemplates(path.join(backendRoot, 'config/templates'), log);
const fileStorage = createFileStorage(env.DATA_DIR);
const provider = createAiProvider(env);
const documentService = createDocumentService({ db, queue, fileStorage, docTypes, templates, renderDocx, log });
const processHandler = createProcessDocumentHandler({ documentService, processDraft, docTypes, provider, log });
const worker = startWorker({ db, queue, handlers: { process: processHandler }, log });
let cleanupTimer;
if (env.CLEANUP_ENABLED) {
  const { createCleanupHandler } = await import('./jobs/handlers/cleanup.js');
  const cleanup = createCleanupHandler({ db, dataDir: env.DATA_DIR, log, env });
  cleanupTimer = setInterval(cleanup, 60 * 60 * 1000);
  cleanupTimer.unref?.();
}

const app = createApp({ log, deps: { db, queue, docTypes, templates, fileStorage, documentService, processDraft, provider } });

const server = app.listen(env.PORT, () => {
  log.info({ port: env.PORT }, `Сервер запущен на порту ${env.PORT}`);
});

// Graceful shutdown — close server, then clean up resources
async function shutdown(signal) {
  log.info({ signal }, 'Получен сигнал завершения, остановка сервера...');
  if (cleanupTimer) clearInterval(cleanupTimer);
  server.close(async () => {
    await worker.stop();
    db.close();
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
