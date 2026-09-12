/**
 * Standalone Document Service entry point.
 *
 * Runs as an independent HTTP server on DOCUMENT_SERVICE_PORT (default 3001).
 * Wires only doc-related modules — no bot adapters, no dispatcher, no flow.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { env } from './config/env.js';
import { log } from './logger.js';
import { createDocumentServiceRuntime } from './services/documentServiceRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── Entry point ──────────────────────────────────────────────────────────────

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runtime = createDocumentServiceRuntime(env, { log });

  const port = env.DOCUMENT_SERVICE_PORT;
  const server = runtime.app.listen(port, () => {
    log.info({ port, ai: runtime.provider.name ?? env.AI_PROVIDER }, 'Document service started');
  });

  const shutdown = async (signal) => {
    log.info({ signal }, 'Stopping document service…');
    server.close();
    await runtime.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
