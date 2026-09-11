import crypto from 'node:crypto';

/**
 * Idempotent file delivery by platform.
 *
 * Upload is called only once per file; send is called only if status is not 'sent'.
 * Uses idempotency key: `<platform>:<peerId>:<fileId>:<triggerEventId>`.
 *
 * DESIGN DECISIONS:
 * - INSERT OR IGNORE ensures idempotent delivery creation
 * - Upload + Send are separate steps with independent error handling
 * - Failed uploads don't create delivery records (can retry from scratch)
 * - Failed sends preserve the attachment for retry without re-upload
 * - Attempts counter tracks retry history for debugging
 *
 * @param {import('better-sqlite3').Database} db
 * @param {{ platform: string, peerId: string, fileId: string, triggerEventId: string,
 *           upload: () => Promise<string>, send: (attachment, idemKey) => Promise<void>,
 *           log: object }} params
 * @returns {Promise<{ status: 'sent', reused: boolean }>}
 */
export async function deliverFile(db, { platform, peerId, fileId, triggerEventId, upload, send, log }) {
  const idemKey = `${platform}:${peerId}:${fileId}:${triggerEventId}`;

  // Check if already sent — fast path for idempotent calls
  const existing = db.prepare('SELECT * FROM deliveries WHERE idem_key = ?').get(idemKey);
  if (existing?.status === 'sent') {
    log?.info({ idemKey }, 'delivery already sent — reusing');
    return { status: 'sent', reused: true };
  }

  const insertDelivery = db.prepare(`
    INSERT OR IGNORE INTO deliveries (id, idem_key, platform, peer_id, file_id, status, created_at, updated_at)
    VALUES (@id, @idemKey, @platform, @peerId, @fileId, 'pending', @now, @now)
  `);

  const updateDelivery = db.prepare(`
    UPDATE deliveries SET status = @status, attachment = @attachment, attempts = attempts + 1,
      last_error = @lastError, updated_at = @now
    WHERE idem_key = @idemKey
  `);

  const deliveryId = existing?.id || crypto.randomUUID();

  // Insert if new (INSERT OR IGNORE is idempotent)
  if (!existing) {
    insertDelivery.run({ id: deliveryId, idemKey, platform, peerId, fileId, now: new Date().toISOString() });
  }

  let attachment = existing?.attachment;

  // Step 1: Upload if not already uploaded
  if (!attachment) {
    try {
      log?.info({ idemKey }, 'uploading file');
      attachment = await upload();
      updateDelivery.run({
        idemKey, status: 'uploaded', attachment,
        lastError: null, now: new Date().toISOString(),
      });
      log?.info({ idemKey }, 'upload complete');
    } catch (err) {
      log?.error({ idemKey, err: err.message }, 'upload failed');
      updateDelivery.run({
        idemKey, status: 'failed', attachment: null,
        lastError: String(err).slice(0, 500), now: new Date().toISOString(),
      });
      throw err;
    }
  }

  // Step 2: Send if not already sent
  if (existing?.status !== 'sent') {
    try {
      log?.info({ idemKey }, 'sending file');
      await send(attachment, idemKey);
      updateDelivery.run({
        idemKey, status: 'sent', attachment,
        lastError: null, now: new Date().toISOString(),
      });
      log?.info({ idemKey }, 'send complete');
    } catch (err) {
      log?.error({ idemKey, err: err.message }, 'send failed');
      updateDelivery.run({
        idemKey, status: 'failed', attachment,
        lastError: String(err).slice(0, 500), now: new Date().toISOString(),
      });
      throw err;
    }
  }

  return { status: 'sent', reused: false };
}
