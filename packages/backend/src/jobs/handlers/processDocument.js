import { events } from '../../core/events.js';

/**
 * Create the processDocument handler.
 *
 * DESIGN DECISIONS:
 * - Loads document from documentService, checks if draft/version changed since job was queued.
 * - If stale (document modified after job enqueue), returns 'stale' — worker marks job stale.
 * - On success: saves version, marks document processed, emits event.
 * - On failure: emits document.failed event, re-throws for worker retry logic.
 * - Handler returns 'stale' or void; worker decides what to do with the return value.
 *
 * @param {{ documentService: object, processDraft: function, log: object }} deps
 * @returns {function} handler(job) → 'stale' | void
 */
export function createProcessDocumentHandler({ documentService, processDraft, log }) {
  return async function processDocument(job) {
    const payload = job.payload ? JSON.parse(job.payload) : {};
    const { documentId, draftVersion, docType } = payload;

    // Load document
    const doc = documentService.getInternal(documentId);
    if (!doc) {
      log.warn({ documentId }, 'document not found, skipping');
      return 'stale';
    }

    // Check if draft or type changed since job was queued
    if (doc.draft_version !== draftVersion || doc.doc_type !== docType) {
      return 'stale';
    }

    try {
      // Process through AI
      const result = await processDraft({
        draft: doc.source_text,
        docType: doc.doc_type_config,
        userFields: JSON.parse(doc.user_fields || '{}'),
        log,
      });

      // Save version
      documentService.saveVersion({
        documentId,
        draftVersion,
        docType: doc.doc_type,
        kind: 'ai',
        title: result.title,
        body: result.body,
        aiFields: result.aiFields,
        changes: result.changes,
        warnings: result.warnings,
      });

      // Update document status
      documentService.markProcessed(documentId);

      events.emit('document.processed', { documentId });
    } catch (err) {
      log.error({ documentId, error: err.message }, 'processDocument failed');
      events.emit('document.failed', { documentId, reason: err.message });
      throw err; // Let worker handle retry/fail
    }
  };
}
