/**
 * Standalone local chat bot service entry point.
 *
 * Runs as an independent service on BOT_PORT (default 3004).
 * Wires only local chat modules — no MAX/VK adapters.
 *
 * Uses documentServiceClient for REST calls to Document Service (port 3001).
 * Starts Express with local chat routes on BOT_PORT.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { env } from './config/env.js';
import { log } from './logger.js';
import { openDb } from './db/index.js';
import { loadDocTypes } from './catalog/docTypes.js';
import { loadTemplates } from './catalog/templates.js';
import { createQueue } from './jobs/queue.js';
import { startWorker } from './jobs/worker.js';
import { createProcessDocumentHandler } from './jobs/handlers/processDocument.js';
import { createCleanupHandler } from './jobs/handlers/cleanup.js';
import { createFileStorage } from './storage/files.js';
import { createDocumentService } from './core/documentService.js';
import { renderDocx } from './docx/render.js';
import { createAiProvider } from './ai/provider.js';
import { AiFaultManager } from './ai/faults.js';
import { processDraft } from './ai/processDraft.js';
import { createDocumentServiceClient } from './client/index.js';
import { createFlow } from './bot/flow.js';
import { createDispatcher } from './bot/dispatcher.js';
import { createNotifier } from './bot/notifier.js';
import { createLocalChatAdapter } from './adapters/local/adapter.js';
import { createLocalChatRouter } from './adapters/local/router.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── Entry point ──────────────────────────────────────────────────────────────

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Validate LOCAL_CHAT is enabled
  if (!env.LOCAL_CHAT) {
    log.error('LOCAL_CHAT is not set. Cannot start local chat bot service.');
    process.exit(1);
  }

  const db = openDb(path.resolve(env.DATA_DIR, 'app.sqlite'), { log });
  const docTypes = loadDocTypes(path.join(ROOT, 'config/doc-types'), log);
  const templates = loadTemplates(path.join(ROOT, 'config/templates'), log);
  const queue = createQueue(db);
  const fileStorage = createFileStorage(env.DATA_DIR);
  const documentService = createDocumentService({ db, queue, fileStorage, docTypes, templates, renderDocx, log });

  const provider = createAiProvider(env);
  const faultManager = new AiFaultManager(env);

  const handlers = {
    process: createProcessDocumentHandler({ documentService, processDraft, docTypes, provider, faultManager, log }),
    cleanup: createCleanupHandler({ db, dataDir: env.DATA_DIR, log, env }),
  };
  const worker = startWorker({ db, queue, handlers, log });

  // REST client for Document Service
  const docServiceClient = createDocumentServiceClient({
    baseUrl: env.DOCUMENT_SERVICE_URL,
    apiKey: env.API_KEY,
  });

  const flow = createFlow({ docServiceClient, docTypes, templates, faultManager, debugCommands: env.DEBUG_COMMANDS, log });
  const adapters = new Map();
  const dispatcher = createDispatcher({ db, flow, adapters, log });
  const notifier = createNotifier({ dispatcher, flow, adapters, docServiceClient, log });

  flow.setNotifier(notifier);

  // Local adapter
  const files = { get: (id) => db.prepare('SELECT * FROM files WHERE id = ?').get(id) ?? null };
  const adapter = createLocalChatAdapter({ files });
  adapters.set('local', adapter);

  const previewRoot = path.join(ROOT, 'config/templates');
  const router = createLocalChatRouter({ adapter, dispatcher, db, previewDir: path.join(previewRoot, 'previews'), samplesDir: path.join(ROOT, 'demo/cases') });

  // Recover stuck events
  dispatcher.recover(adapters).catch((err) => log.error({ err }, 'inbound events recovery failed'));

  // Start Express server
  const express = (await import('express')).default;
  const app = express();
  app.use(express.json());
  app.use(router);

  const port = env.BOT_PORT;
  const server = app.listen(port, () => {
    log.info({ port, ai: provider.name ?? env.AI_PROVIDER }, 'Local chat bot service started');
    log.info({ url: `http://localhost:${port}/dev/chat` }, 'Local chat interface');
  });

  const shutdown = async (signal) => {
    log.info({ signal }, 'Stopping local chat bot service…');
    server.close();
    notifier.stop();
    await worker.stop();
    db.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}