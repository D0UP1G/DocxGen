/**
 * Document Service runtime — wires only doc-related modules.
 *
 * This is a subset of server.js's createRuntime: no bot adapters, no dispatcher,
 * no notifier, no flow. The standalone document-service entry point uses this
 * instead of the full monolith composition root.
 *
 * SOLID — Single Responsibility: one runtime, one concern (documents).
 * SOLID — Dependency Inversion: all dependencies injected, never imported.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { openDb } from '../db/index.js';
import { loadDocTypes } from '../catalog/docTypes.js';
import { loadTemplates } from '../catalog/templates.js';
import { createQueue } from '../jobs/queue.js';
import { startWorker } from '../jobs/worker.js';
import { createProcessDocumentHandler } from '../jobs/handlers/processDocument.js';
import { createCleanupHandler } from '../jobs/handlers/cleanup.js';
import { createFileStorage } from '../storage/files.js';
import { createDocumentService } from '../core/documentService.js';
import { renderDocx } from '../docx/render.js';
import { createAiProvider } from '../ai/provider.js';
import { AiFaultManager } from '../ai/faults.js';
import { processDraft } from '../ai/processDraft.js';
import { createApp } from '../app.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Build the document-only runtime without listening on a port.
 *
 * @param {object} [config] — env overrides (defaults to env)
 * @param {{ db?: object, log?: object }} [options]
 * @returns {{ app, db, documentService, docTypes, templates, queue, worker, provider, close }}
 */
export function createDocumentServiceRuntime(config, { db: passedDb, log } = {}) {
  const db = passedDb ?? openDb(path.resolve(config.DATA_DIR, 'app.sqlite'), { log });

  const docTypes = loadDocTypes(path.join(ROOT, 'config/doc-types'), log);
  const templates = loadTemplates(path.join(ROOT, 'config/templates'), log);
  const queue = createQueue(db);
  const fileStorage = createFileStorage(config.DATA_DIR);
  const documentService = createDocumentService({ db, queue, fileStorage, docTypes, templates, renderDocx, log });

  const provider = createAiProvider(config);
  const faultManager = new AiFaultManager(config);

  const handlers = {
    process: createProcessDocumentHandler({ documentService, processDraft, docTypes, provider, faultManager, log }),
    cleanup: createCleanupHandler({ db, dataDir: config.DATA_DIR, log, env: config }),
  };
  const worker = startWorker({ db, queue, handlers, log });

  // No bot routers — only the REST API.
  const app = createApp({ log, deps: { documentService, docTypes, templates, fileStorage, db, log, routers: [] } });

  return {
    app,
    db,
    documentService,
    docTypes,
    templates,
    queue,
    worker,
    provider,
    async close() {
      await worker.stop();
      db.close();
    },
  };
}
