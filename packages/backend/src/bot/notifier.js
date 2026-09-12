/**
 * Notifier — bridges document lifecycle events to dialog conversations.
 *
 * Uses polling to check document status through the document-service client.
 * Maintains a Set of document IDs to poll and checks their status periodically.
 *
 * Dependencies are injected (Dependency Inversion):
 *   dispatcher — for findByDocumentId
 *   flow — for onDocumentEvent
 *   adapters — Map<string, Adapter>
 *   docServiceClient — owner-bound document-service client (for polling)
 *   log — pino-compatible logger
 */

import { sendReplies } from './sendReplies.js';

/** Synthetic event for adapters: file delivery is idempotent per trigger event id. */
const systemEvent = (conv, kind, documentId) => ({
  platform: conv.platform, peerId: conv.peerId, userId: conv.userId ?? conv.peerId,
  eventId: `document:${documentId}:${kind}:${Date.now()}`, kind: 'system', meta: {},
});

/**
 * Create the notifier.
 * @param {{ dispatcher: object, flow: object, adapters: Map, docServiceClient: object, log: object, pollIntervalMs?: number }} deps
 * @returns {{ stop: function, trackDocument: function }}
 */
export function createNotifier({ dispatcher, flow, adapters, docServiceClient, log, pollIntervalMs = 5_000 }) {
  // ── Document tracking for polling ──────────────────────────────────
  const trackedDocs = new Map(); // documentId → { owner, status: string, lastCheck: number }

  /**
   * Track a document for polling. Called by flow when processing starts.
   *
   * Владелец хранится рядом с идентификатором: сервис документов отдаёт документ
   * только его владельцу, поэтому опрашивать надо от его имени.
   * @param {string} documentId
   * @param {{ platform: string, id: string }} owner
   * @param {string} initialStatus — e.g. 'processing'
   */
  function trackDocument(documentId, owner, initialStatus = 'processing') {
    trackedDocs.set(documentId, { owner, status: initialStatus, lastCheck: Date.now() });
    log.debug({ documentId, owner }, 'tracking document for polling');
  }

  /**
   * Process a document status change.
   * @param {string} documentId
   * @param {'processed'|'failed'} type
   * @param {string} [reason]
   */
  async function handleDocumentEvent(documentId, type, reason) {
    try {
      const conv = dispatcher.findByDocumentId(documentId);
      if (!conv) {
        log.warn({ documentId }, `document ${type} but no conversation found`);
        return;
      }

      const replies = await flow.onDocumentEvent(conv, { type, documentId });
      if (replies.length > 0) {
        const adapter = adapters.get(conv.platform);
        if (adapter) {
          await sendReplies({ adapter, flow, conversation: conv, replies, event: systemEvent(conv, type, documentId) });
        } else {
          log.warn({ platform: conv.platform }, 'no adapter for platform');
        }
      }

      log.info({ documentId }, `document ${type} notification sent`);
    } catch (err) {
      log.error({ documentId, error: err.message }, `failed to notify about ${type} document`);
    }
  }

  // ── Polling loop ────────────────────────────────────────────────────
  let pollTimer = null;

  async function pollTrackedDocuments() {
    if (trackedDocs.size === 0) return;

    for (const [documentId, info] of trackedDocs) {
      try {
        const client = info.owner ? docServiceClient.withOwner(info.owner) : docServiceClient;
        const doc = await client.getDocument(documentId);
        if (!doc) {
          // Document deleted or not found — stop tracking
          trackedDocs.delete(documentId);
          continue;
        }

        // Status changed from 'processing' to something else
        if (doc.status !== 'processing' && doc.status !== info.status) {
          trackedDocs.delete(documentId);
          const type = doc.status === 'processed' ? 'processed' : 'failed';
          const reason = doc.status === 'ai_failed' ? doc.error : undefined;
          await handleDocumentEvent(documentId, type, reason);
        } else {
          // Update last check time
          info.lastCheck = Date.now();
        }
      } catch (err) {
        log.error({ documentId, error: err.message }, 'poll failed for document');
      }
    }
  }

  pollTimer = setInterval(pollTrackedDocuments, pollIntervalMs);
  // Don't block the event loop
  if (pollTimer.unref) pollTimer.unref();
  log.info({ pollIntervalMs }, 'document polling started');

  return {
    /** Track a document for polling (called by flow when processing starts). */
    trackDocument,

    /** Stop polling (for cleanup in tests). */
    stop() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    },
  };
}
