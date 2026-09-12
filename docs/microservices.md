# Microservices Architecture

This document describes the DocxGen microservices architecture, how services communicate, how to create new services, and how to add platform adapters.

## 1. Architecture Overview

The system is split into four independent services, each running on its own port:

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  MAX Bot    │  │  VK Bot     │  │  Local Chat  │
│  (3002)     │  │  (3003)     │  │  (3004)     │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │    REST + X-API-Key             │
       └────────┬───────┴───────┬────────┘
                ▼               ▼
       ┌────────────────────────────────┐
       │   Document Service (3001)      │
       │  DOCX · AI · Validation · Files│
       └────────────────────────────────┘
```

- **Document Service** is the core. All document operations (CRUD, AI processing, DOCX rendering, file storage) happen here.
- **Bot services** are thin adapters. They handle platform-specific concerns (sending messages, uploading files, receiving webhooks) and delegate all document logic to the Document Service via REST.
- **Local Chat** is a development/testing adapter that emulates a messenger in the browser at `http://localhost:3004/dev/chat`.

### Why this split?

| Concern | Where it lives |
|---------|---------------|
| Document CRUD, AI, DOCX rendering | Document Service |
| Platform-specific message formatting | Adapters (inside each bot service) |
| Webhook/polling handling | Bot service entry points |
| File upload to platform | Adapter `sendFile()` methods |

Each bot service is **self-contained** — it imports only the modules it needs, runs its own worker queue, and communicates with the Document Service over HTTP. This means you can run only the services you need (e.g., just Document Service + MAX Bot for production, or all four for development).

## 2. Services

| Service | Port | Entry Point | Purpose |
|---------|------|-------------|---------|
| **Document Service** | 3001 | `src/document-service.js` | Core API — document CRUD, AI processing, DOCX rendering, file management |
| **MAX Bot** | 3002 | `src/max-bot-service.js` | MAX messenger adapter — webhooks or polling |
| **VK Bot** | 3003 | `src/vk-bot-service.js` | VK messenger adapter — callbacks or long-polling |
| **Local Chat** | 3004 | `src/local-bot-service.js` | Dev/testing adapter — browser-based messenger emulator |

### Document Service (port 3001)

The central service. All other services call it via REST. It owns:
- SQLite database (`data/app.sqlite`)
- Document lifecycle (create → collect → process → render → deliver)
- AI processing pipeline
- DOCX template rendering
- File storage

**Start it:**
```bash
pnpm start:doc-service
# or just:
pnpm dev
```

### MAX Bot (port 3002)

Connects to the MAX messenger platform. Runs its own worker for background jobs (cleanup, retry). Communicates with the Document Service via `documentServiceClient`.

**Start it:**
```bash
pnpm start:max-bot
```

Requires `MAX_ENABLED=1` and `MAX_TOKEN` in `.env`.

### VK Bot (port 3003)

Connects to VK messenger. Same pattern as MAX Bot — own worker, own adapter, REST calls to Document Service.

**Start it:**
```bash
pnpm start:vk-bot
```

Requires `VK_ENABLED=1`, `VK_GROUP_ID`, and `VK_TOKEN` in `.env`.

### Local Chat (port 3004)

Development adapter. No external API tokens needed. Opens a browser UI at `http://localhost:3004/dev/chat` that emulates a messenger conversation.

**Start it:**
```bash
pnpm start:local-bot
```

Requires `LOCAL_CHAT=1` in `.env`.

## 3. Communication

### REST API

All inter-service communication uses HTTP/REST. Bot services call the Document Service using `createDocumentServiceClient()`:

```javascript
import { createDocumentServiceClient } from './client/index.js';

const client = createDocumentServiceClient({
  baseUrl: 'http://localhost:3001',
  apiKey: process.env.API_KEY,
});

// Create a document for a specific user
const clientWithOwner = client.withOwner({ platform: 'max', id: '12345' });
const doc = await clientWithOwner.createDocument({ sourceText: 'Hello' });
```

### Authentication

| Header | Purpose | Set by |
|--------|---------|--------|
| `X-API-Key` | Authenticates the bot service to the Document Service | `documentServiceClient` automatically |
| `X-Owner-Platform` | Identifies the platform (e.g., `max`, `vk`, `local`) | `client.withOwner()` or manually |
| `X-Owner-Id` | Identifies the user on that platform | `client.withOwner()` or manually |

The Document Service extracts owner info from headers when API key auth is used (instead of session cookies, which bots don't send).

### Data Flow

```
User sends message
  → Bot platform (MAX/VK/Local) receives webhook/poll
  → Bot service normalizes to InboundEvent
  → Dispatcher routes to flow handler
  → Flow calls Document Service via REST client
  → Document Service processes, renders, returns file ID
  → Flow returns reply array to dispatcher
  → Dispatcher calls adapter.send()
  → Adapter uploads file to platform, sends message
```

## 4. How to Create a New Service

To add a new bot service (e.g., for Telegram):

### Step 1: Create the entry point file

Create `src/telegram-bot-service.js`:

```javascript
/**
 * Standalone Telegram bot service entry point.
 *
 * Runs as an independent service on BOT_PORT (default 3002).
 * Uses documentServiceClient for REST calls to Document Service (port 3001).
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
import { createTelegramAdapter } from './adapters/telegram/adapter.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!env.TELEGRAM_ENABLED) {
    log.error('TELEGRAM_ENABLED is not set. Cannot start Telegram bot service.');
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

  // Telegram adapter
  const adapter = createTelegramAdapter({ botToken: env.TELEGRAM_TOKEN, files: { get: (id) => db.prepare('SELECT * FROM files WHERE id = ?').get(id) ?? null }, log });
  adapters.set('telegram', adapter);

  // Recover stuck events
  dispatcher.recover(adapters).catch((err) => log.error({ err }, 'inbound events recovery failed'));

  // Start polling / webhook server
  // ...

  const shutdown = async (signal) => {
    log.info({ signal }, 'Stopping Telegram bot service…');
    notifier.stop();
    await worker.stop();
    db.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
```

### Step 2: Add env vars

Add to `src/config/env.js`:

```javascript
TELEGRAM_ENABLED: flag(false),
TELEGRAM_TOKEN: z.string().optional(),
```

Add to `.env.example`:

```
TELEGRAM_ENABLED=0
TELEGRAM_TOKEN=
```

### Step 3: Add to package.json scripts

```json
"start:telegram-bot": "node --env-file-if-exists=../../.env src/telegram-bot-service.js"
```

### Step 4: Run it

```bash
pnpm start:telegram-bot
```

## 5. How to Add a New Adapter

Adapters live in `src/adapters/<platform>/` and implement the **adapter interface** that the dispatcher expects.

### The Adapter Interface

Every adapter must export a factory function that returns an object with:

| Method | Signature | Purpose |
|--------|-----------|---------|
| `send()` | `send(peerId, replies, { event }?)` | Send replies to a user on the platform |
| `platform` | `string` (property) | Platform identifier (e.g., `'max'`, `'vk'`, `'local'`) |

Optional methods (depending on platform needs):
- `previewAttachment(templateId)` — upload and cache template preview images
- `getProfile(userId)` — fetch user profile info from the platform

### Step-by-step

1. **Create the adapter folder:**
   ```
   src/adapters/telegram/
   ├── adapter.js      # main adapter (send, preview, etc.)
   ├── client.js       # platform API client (sendMessage, uploadFile, etc.)
   ├── normalize.js    # convert platform webhook to InboundEvent
   └── webhook.js      # Express router for webhook endpoint
   ```

2. **Implement the adapter** (`adapter.js`):

```javascript
export function createTelegramAdapter({ botToken, files, log = console }) {
  return {
    platform: 'telegram',

    async send(peerId, replies, { event } = {}) {
      for (const reply of replies) {
        if (reply.file) {
          const file = files.get(reply.file.fileId);
          if (!file) throw new Error('File not found');
          // Upload and send file via Telegram Bot API
          // ...
        } else {
          // Send text message via Telegram Bot API
          // ...
        }
      }
    },
  };
}
```

3. **Register in the entry point** (`src/telegram-bot-service.js`):

```javascript
import { createTelegramAdapter } from './adapters/telegram/adapter.js';

const adapter = createTelegramAdapter({ botToken: env.TELEGRAM_TOKEN, files, log });
adapters.set('telegram', adapter);
```

4. **Create inbound event normalization** (`normalize.js`):

Convert platform-specific webhook payloads to the standard `InboundEvent` format:

```javascript
/**
 * @typedef {{ kind: 'text'|'command'|'action', text?: string, command?: string,
 *            action?: { a: string, v?: string }, platform: string, userId: string,
 *            peerId: string, eventId: string }} InboundEvent
 */
export function toInboundEvent(telegramUpdate) {
  // Convert Telegram update to InboundEvent
  // ...
}
```

5. **Create webhook/polling router** (`webhook.js`):

```javascript
import { Router } from 'express';

export function createTelegramWebhookRouter({ dispatcher, adapter, log }) {
  const router = Router();
  router.post('/integrations/telegram/webhook', (req, res) => {
    const event = toInboundEvent(req.body);
    const accepted = event ? dispatcher.accept(event, req.body) : null;
    res.sendStatus(200);
    if (accepted) setImmediate(() => void dispatcher.run(accepted, adapter));
  });
  return router;
}
```

## 6. Environment Variables

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Main server port |
| `DOCUMENT_SERVICE_PORT` | `3001` | Document Service port |
| `BOT_PORT` | `3002` | Bot service port (used by the active bot) |
| `PUBLIC_URL` | `https://doc3steps.example.ru` | Public URL for webhooks |
| `DATA_DIR` | `./data` | Directory for SQLite DB and files |
| `LOG_LEVEL` | `info` | Log level (`fatal`, `error`, `warn`, `info`, `debug`, `trace`) |
| `DEBUG_COMMANDS` | `false` | Enable debug commands (`/ai_fail`) |

### Local Chat

| Variable | Default | Description |
|----------|---------|-------------|
| `LOCAL_CHAT` | `false` | Enable local chat dev adapter at `/dev/chat` |

### AI

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_PROVIDER` | `openai-compat` | AI backend: `openai-compat`, `opencode`, or `mock` |
| `AI_BASE_URL` | `http://localhost:11434/v1` | OpenAI-compatible API URL |
| `AI_API_KEY` | `""` | API key for AI provider |
| `AI_MODEL` | `qwen2.5:7b-instruct` | Model name |
| `AI_TEMPERATURE` | `0.1` | Temperature (0–2) |
| `AI_TIMEOUT_MS` | `90000` | Request timeout in ms |
| `AI_FAULT` | `off` | Fault injection: `off` or `always` |

### OpenCode (when `AI_PROVIDER=opencode`)

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENCODE_RUNTIME` | `local` | Runtime: `local`, `docker`, or `podman` |
| `OPENCODE_BIN` | `opencode` | Path to opencode binary |
| `OPENCODE_IMAGE` | `doc3steps-opencode` | Docker image name |
| `OPENCODE_MODEL` | `""` | Model override (empty = use agent default) |
| `OPENCODE_AGENT` | `doc-editor` | Agent name to use |
| `OPENCODE_MAX_PARALLEL` | `1` | Max parallel requests (free models can't handle concurrency) |

### MAX Bot

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_ENABLED` | `false` | Enable MAX bot |
| `MAX_TOKEN` | — | MAX API token (required when enabled) |
| `MAX_API_URL` | `https://platform-api2.max.ru` | MAX API base URL |
| `MAX_MODE` | `webhook` | `webhook` (production) or `polling` (local dev) |
| `MAX_WEBHOOK_SECRET` | — | Webhook secret (required in webhook mode) |
| `MAX_CA_FILE` | `certs/russian_trusted_root_ca.pem` | CA cert for Russian government PKI |

### VK Bot

| Variable | Default | Description |
|----------|---------|-------------|
| `VK_ENABLED` | `false` | Enable VK bot |
| `VK_GROUP_ID` | — | VK community ID (required when enabled) |
| `VK_TOKEN` | — | VK API token (required when enabled) |
| `VK_API_VERSION` | `5.199` | VK API version |
| `VK_MODE` | `callback` | `callback` (production) or `longpoll` (local dev) |
| `VK_CALLBACK_SECRET` | — | Callback secret (required in callback mode) |
| `VK_CONFIRMATION_CODE` | — | Confirmation string (required in callback mode) |

### Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `API_KEY` | `""` | API key for inter-service auth |
| `DOCUMENT_SERVICE_URL` | `http://localhost:3001` | Document Service URL for bot services |

### Cleanup

| Variable | Default | Description |
|----------|---------|-------------|
| `CLEANUP_ENABLED` | `true` | Enable automatic file/log cleanup |
| `CLEANUP_FILE_MAX_AGE_HOURS` | `24` | Max file age in hours before cleanup |
| `CLEANUP_LOG_MAX_AGE_DAYS` | `30` | Max log age in days before cleanup |

## 7. API Endpoints

The Document Service exposes these REST endpoints. All `/api/*` routes require `X-API-Key` header (if `API_KEY` is set).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check (no auth required) |
| `GET` | `/api/catalog` | List available document types and templates |
| `POST` | `/api/documents` | Create a new document |
| `GET` | `/api/documents` | List documents (query: `status`, `limit`, `offset`) |
| `GET` | `/api/documents/:id` | Get document by ID |
| `PATCH` | `/api/documents/:id` | Update document (fields: `sourceText`, `docType`, `templateId`) |
| `DELETE` | `/api/documents/:id` | Delete document |
| `POST` | `/api/documents/:id/process` | Start AI processing |
| `PUT` | `/api/documents/:id/fields` | Set user-defined fields |
| `PUT` | `/api/documents/:id/text` | Set manual title and body |
| `POST` | `/api/documents/:id/render` | Render document to DOCX |
| `GET` | `/api/files/:fileId` | Download rendered file |
| `GET` | `/api/documents/:id/log` | Get processing logs |
| `GET` | `/templates/previews/:file` | Get template preview image |

### documentServiceClient Methods

The `createDocumentServiceClient()` factory returns a client with these methods:

| Method | Maps to Endpoint | Description |
|--------|------------------|-------------|
| `getCatalog()` | `GET /api/catalog` | Get doc types and templates |
| `getDocuments({ status, limit, offset })` | `GET /api/documents` | List documents |
| `getDocument(id)` | `GET /api/documents/:id` | Get single document |
| `createDocument({ sourceText, docType, templateId })` | `POST /api/documents` | Create document |
| `updateDocument(id, { sourceText, docType, templateId })` | `PATCH /api/documents/:id` | Update document |
| `setDraft(id, text, { mode })` | `GET` + `PATCH` | Set draft text (append or replace) |
| `deleteDocument(id)` | `DELETE /api/documents/:id` | Delete document |
| `processDocument(id)` | `POST /api/documents/:id/process` | Start AI processing |
| `retryProcessing(id)` | `POST /api/documents/:id/process` | Retry from ai_failed |
| `setFields(id, fields)` | `PUT /api/documents/:id/fields` | Set user fields |
| `setManualText(id, { title, body })` | `PUT /api/documents/:id/text` | Set manual text |
| `renderDocument(id)` | `POST /api/documents/:id/render` | Render to DOCX |
| `downloadFile(fileId)` | `GET /api/files/:fileId` | Download file as Buffer |
| `getProcessingLog(id)` | `GET /api/documents/:id/log` | Get processing log |
| `withOwner({ platform, id })` | — | Create new client bound to a specific user |

## 8. Example: Creating a Telegram Bot Adapter

Full working example showing the complete process of adding a Telegram adapter.

### File structure

```
src/adapters/telegram/
├── adapter.js      # send(), preview, platform property
├── client.js       # Telegram Bot API wrapper
├── normalize.js    # toInboundEvent() converter
└── webhook.js      # Express router for /integrations/telegram/webhook
```

### `src/adapters/telegram/client.js`

```javascript
/**
 * Telegram Bot API client.
 *
 * Wraps the Telegram Bot HTTP API with retry support.
 */
export function createTelegramClient({ botToken, log = console }) {
  const baseUrl = `https://api.telegram.org/bot${botToken}`;

  async function api(method, body = {}) {
    const res = await fetch(`${baseUrl}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) {
      const err = new Error(data.description || 'Telegram API error');
      err.error_code = data.error_code;
      throw err;
    }
    return data.result;
  }

  return {
    sendMessage(chatId, text, extra = {}) {
      return api('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });
    },

    sendDocument(chatId, file, filename, caption = '', extra = {}) {
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('document', file, filename);
      if (caption) form.append('caption', caption);
      return fetch(`${baseUrl}/sendDocument`, { method: 'POST', body: form })
        .then(r => r.json());
    },

    getUpdates(offset) {
      return api('getUpdates', { offset, timeout: 30 });
    },

    isRetryable(err) {
      return err.error_code === 429 || (err.error_code >= 500);
    },
  };
}
```

### `src/adapters/telegram/normalize.js`

```javascript
/**
 * Convert Telegram webhook updates to InboundEvent format.
 *
 * @typedef {{ kind: 'text'|'command'|'action', text?: string, command?: string,
 *            action?: { a: string, v?: string }, platform: string, userId: string,
 *            peerId: string, eventId: string }} InboundEvent
 */
export function toInboundEvent(update) {
  const msg = update.message || update.callback_query?.message;
  if (!msg) return null;

  const userId = String(update.callback_query?.from?.id ?? msg.from?.id);
  const peerId = String(msg.chat.id);
  const eventId = String(update.update_id);

  // Callback query (inline keyboard press)
  if (update.callback_query) {
    const data = update.callback_query.data;
    const [a, ...rest] = data.split(':');
    return {
      kind: 'action',
      action: { a, v: rest.join(':') || undefined },
      platform: 'telegram',
      userId,
      peerId,
      eventId,
      callbackId: update.callback_query.id,
      meta: {},
    };
  }

  // Text message
  const text = msg.text || '';
  if (text.startsWith('/')) {
    const command = text.split(/\s+/)[0].slice(1).split('@')[0];
    return { kind: 'command', command, platform: 'telegram', userId, peerId, eventId, meta: {} };
  }

  return { kind: 'text', text, platform: 'telegram', userId, peerId, eventId, meta: {} };
}
```

### `src/adapters/telegram/adapter.js`

```javascript
import { createPeerQueue } from '../common/peerQueue.js';
import { deliverFile } from '../../core/deliveries.js';

export function createTelegramAdapter({ client, files, log = console }) {
  const queue = createPeerQueue({ intervalMs: 350 });

  async function sendFile(peerId, reply, event) {
    const file = files.get(reply.file.fileId);
    if (!file) throw new Error('File not found');

    return deliverFile(db, {
      platform: 'telegram',
      peerId,
      fileId: file.id,
      triggerEventId: event?.eventId,
      log,
      upload: async () => {
        const buffer = await fs.readFile(file.path);
        return { buffer, filename: file.filename };
      },
      send: async ({ buffer, filename }) => {
        await client.sendDocument(peerId, buffer, filename, reply.file.caption);
      },
    });
  }

  return {
    platform: 'telegram',

    async send(peerId, replies, { event } = {}) {
      for (const reply of replies) {
        await queue.enqueue(peerId, async () => {
          if (reply.file) {
            return sendFile(peerId, reply, event);
          }

          const text = reply.text;
          await client.sendMessage(peerId, text);
        });
      }
    },
  };
}
```

### `src/adapters/telegram/webhook.js`

```javascript
import { Router } from 'express';
import { toInboundEvent } from './normalize.js';

export function createTelegramWebhookRouter({ dispatcher, adapter, log }) {
  const router = Router();

  router.post('/integrations/telegram/webhook', (req, res) => {
    const update = req.body;
    const event = toInboundEvent(update);

    if (!event) return res.sendStatus(200);

    const accepted = dispatcher.accept(event, update);
    res.sendStatus(200);

    if (accepted) {
      setImmediate(() => void dispatcher.run(accepted, adapter));
    }
  });

  return router;
}
```

### `src/telegram-bot-service.js`

Follow the pattern from section 4 above — import the adapter, wire it into `adapters.set('telegram', adapter)`, and start the HTTP server with the webhook router.

### Register in package.json

```json
"start:telegram-bot": "node --env-file-if-exists=../../.env src/telegram-bot-service.js"
```

### Add env vars

```bash
# .env
TELEGRAM_ENABLED=1
TELEGRAM_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
```

---

## Running All Services in Development

```bash
# Terminal 1: Document Service (core)
pnpm dev

# Terminal 2: MAX Bot (if needed)
pnpm start:max-bot

# Terminal 3: VK Bot (if needed)
pnpm start:vk-bot

# Terminal 4: Local Chat (for browser testing)
pnpm start:local-bot
```

Or run everything at once (not recommended for debugging):

```bash
pnpm start:services
```

## Key Source Files

| File | Purpose |
|------|---------|
| `src/document-service.js` | Document Service entry point |
| `src/max-bot-service.js` | MAX Bot entry point |
| `src/vk-bot-service.js` | VK Bot entry point |
| `src/local-bot-service.js` | Local Chat entry point |
| `src/client/documentServiceClient.js` | REST client for Document Service |
| `src/http/api.js` | Express router with all API endpoints |
| `src/config/env.js` | Environment variable schema and validation |
| `src/bot/flow.js` | Dialog flow state machine |
| `src/bot/dispatcher.js` | Inbound event dispatcher |
| `src/adapters/max/adapter.js` | MAX adapter example |
| `src/adapters/vk/adapter.js` | VK adapter example |
| `src/adapters/local/adapter.js` | Local chat adapter example |
