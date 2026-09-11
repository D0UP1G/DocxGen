/**
 * Notifier — bridges document lifecycle events to dialog conversations.
 *
 * When the AI worker finishes processing a document (success or failure),
 * it emits events on the global event bus. The notifier listens for these
 * events, finds the conversation that owns the document, and calls
 * flow.onDocumentEvent() to generate the appropriate replies.
 *
 * Why a separate module: the flow handler is synchronous from the user's
 * perspective (handle event → return replies). But document processing is
 * async (queued job). The notifier closes this gap by converting async
 * document events into synchronous flow transitions.
 *
 * Why it's simple: the notifier does ONE thing — bridge events. It doesn't
 * manage state, doesn't handle retries, doesn't know about adapters. It
 * finds the conversation, calls the flow, and lets the dispatcher handle
 * sending replies.
 *
 * Dependencies are injected (Dependency Inversion):
 *   dispatcher — for findByDocumentId
 *   flow — for onDocumentEvent
 *   adapters — Map<string, Adapter>
 *   log — pino-compatible logger
 */

import { events } from '../core/events.js';
import { sendReplies } from './sendReplies.js';

/** Synthetic event for adapters: file delivery is idempotent per trigger event id. */
const systemEvent = (conv, kind, documentId) => ({
  platform: conv.platform, peerId: conv.peerId, userId: conv.userId ?? conv.peerId,
  eventId: `document:${documentId}:${kind}:${Date.now()}`, kind: 'system', meta: {},
});

/**
 * Create the notifier.
 * @param {{ dispatcher: object, flow: object, adapters: Map, log: object }} deps
 * @returns {{ stop: function }}
 */
export function createNotifier({ dispatcher, flow, adapters, log }) {
  const onProcessed = async ({ documentId }) => {
    try {
      const conv = dispatcher.findByDocumentId(documentId);
      if (!conv) {
        log.warn({ documentId }, 'document processed but no conversation found');
        return;
      }

      const replies = await flow.onDocumentEvent(conv, { type: 'processed', documentId });
      if (replies.length > 0) {
        const adapter = adapters.get(conv.platform);
        if (adapter) {
          await sendReplies({ adapter, flow, conversation: conv, replies, event: systemEvent(conv, 'processed', documentId) });
        } else {
          log.warn({ platform: conv.platform }, 'no adapter for platform');
        }
      }

      log.info({ documentId }, 'document processed notification sent');
    } catch (err) {
      log.error({ documentId, error: err.message }, 'failed to notify about processed document');
    }
  };

  const onFailed = async ({ documentId, reason }) => {
    try {
      const conv = dispatcher.findByDocumentId(documentId);
      if (!conv) {
        log.warn({ documentId }, 'document failed but no conversation found');
        return;
      }

      const replies = await flow.onDocumentEvent(conv, { type: 'failed', documentId });
      if (replies.length > 0) {
        const adapter = adapters.get(conv.platform);
        if (adapter) {
          await sendReplies({ adapter, flow, conversation: conv, replies, event: systemEvent(conv, 'failed', documentId) });
        } else {
          log.warn({ platform: conv.platform }, 'no adapter for platform');
        }
      }

      log.info({ documentId, reason }, 'document failure notification sent');
    } catch (err) {
      log.error({ documentId, error: err.message }, 'failed to notify about failed document');
    }
  };

  events.on('document.processed', onProcessed);
  events.on('document.failed', onFailed);

  return {
    /** Remove event listeners (for cleanup in tests). */
    stop() {
      events.removeListener('document.processed', onProcessed);
      events.removeListener('document.failed', onFailed);
    },
  };
}
