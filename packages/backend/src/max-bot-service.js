/**
 * Standalone MAX bot service entry point.
 *
 * Runs as an independent service on BOT_PORT (default 3002).
 * Wires only MAX bot modules — no Express API routes, no VK/local adapters.
 *
 * Uses documentServiceClient for REST calls to Document Service (port 3001).
 * Listens for MAX bot webhooks/polling on BOT_PORT.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { env } from './config/env.js';
import { trustExtraCa } from './config/extraCa.js';
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
import { createMaxClient } from './adapters/max/client.js';
import { createMaxAdapter } from './adapters/max/adapter.js';
import { createMaxWebhookRouter } from './adapters/max/webhook.js';
import { createMaxPoller } from './adapters/max/poller.js';
import { toInboundEvents } from './adapters/max/normalize.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── Entry point ──────────────────────────────────────────────────────────────

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Validate MAX is enabled
  if (!env.MAX_ENABLED) {
    log.error('MAX_ENABLED is not set. Cannot start MAX bot service.');
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

  // MAX adapter
  trustExtraCa(env.MAX_CA_FILE ? path.resolve(ROOT, env.MAX_CA_FILE) : '', log);
  const maxClient = createMaxClient({ baseUrl: env.MAX_API_URL, token: env.MAX_TOKEN });
  const files = { get: (id) => db.prepare('SELECT * FROM files WHERE id = ?').get(id) ?? null };
  const previewRoot = path.join(ROOT, 'config/templates');
  const adapter = createMaxAdapter({ db, client: maxClient, files, log, previewRoot });
  adapters.set('max', adapter);

  const routers = [];
  const pollers = [];

  if (env.MAX_MODE === 'webhook') {
    routers.push(createMaxWebhookRouter({ secret: env.MAX_WEBHOOK_SECRET, dispatcher, adapter, log }));
  } else {
    pollers.push(createMaxPoller({
      client: maxClient,
      onEvent: async (raw) => {
        for (const event of toInboundEvents(raw)) {
          const accepted = dispatcher.accept(event, raw);
          if (accepted) await dispatcher.run(accepted, adapter);
        }
      },
      log,
    }));
  }

  // Start pollers
  for (const poller of pollers) void poller.start();

  // Recover stuck events
  dispatcher.recover(adapters).catch((err) => log.error({ err }, 'inbound events recovery failed'));

  // Start HTTP server for webhooks (if webhook mode)
  let server = null;
  if (routers.length > 0) {
    const express = (await import('express')).default;
    const app = express();
    app.use(express.json());
    for (const router of routers) app.use(router);
    
    const port = env.BOT_PORT;
    server = app.listen(port, () => {
      log.info({ port, mode: env.MAX_MODE, ai: provider.name ?? env.AI_PROVIDER }, 'MAX bot service started');
    });
  } else {
    log.info({ mode: env.MAX_MODE, ai: provider.name ?? env.AI_PROVIDER }, 'MAX bot service started (polling mode, no HTTP)');
  }

  const shutdown = async (signal) => {
    log.info({ signal }, 'Stopping MAX bot service…');
    if (server) server.close();
    notifier.stop();
    for (const poller of pollers) poller.stop();
    await worker.stop();
    db.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}