import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { deliverFile } from '../../src/core/deliveries.js';

// ── Test helpers ──────────────────────────────────────────────────────────────

function createTestDb() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deliveries-test-'));
  const dbPath = path.join(tmpDir, 'test.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run migrations
  const migration = fs.readFileSync(
    path.resolve(import.meta.dirname, '../../src/db/migrations/001_init.sql'),
    'utf8'
  );
  db.exec(migration);

  return { db, tmpDir };
}

function createMockLogger() {
  return { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('deliverFile', () => {
  let db, tmpDir, testFileId;

  beforeAll(() => {
    ({ db, tmpDir } = createTestDb());
    // Create a test document and file for foreign key references
    const docId = 'test-doc-id';
    db.prepare(`INSERT INTO documents (id, owner_platform, owner_id, status, created_at, updated_at)
      VALUES (?, 'test', 'user', 'draft', datetime('now'), datetime('now'))`).run(docId);
    const versionId = 'test-version-id';
    db.prepare(`INSERT INTO versions (id, document_id, draft_version, doc_type, kind, body, created_at)
      VALUES (?, ?, 1, 'memo', 'ai', '[]', datetime('now'))`).run(versionId, docId);
    testFileId = 'test-file-id';
    db.prepare(`INSERT INTO files (id, document_id, version_id, template_id, fields_hash, path, filename, created_at)
      VALUES (?, ?, ?, 'classic', 'hash123', '/tmp/test.docx', 'test.docx', datetime('now'))`).run(testFileId, docId, versionId);
  });

  afterAll(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Clean deliveries table between tests
    db.exec('DELETE FROM deliveries');
  });

  // ── First delivery ──────────────────────────────────────────────────────────

  describe('first delivery', () => {
    it('calls upload + send, status sent', async () => {
      const upload = vi.fn().mockResolvedValue('attachment-token-123');
      const send = vi.fn().mockResolvedValue(undefined);

      const result = await deliverFile(db, {
        platform: 'max',
        peerId: 'peer-1',
        fileId: testFileId,
        triggerEventId: 'event-1',
        upload,
        send,
        log: createMockLogger(),
      });

      expect(result.status).toBe('sent');
      expect(result.reused).toBe(false);
      expect(upload).toHaveBeenCalledOnce();
      expect(send).toHaveBeenCalledWith('attachment-token-123', `max:peer-1:${testFileId}:event-1`);

      // Verify database state
      const delivery = db.prepare('SELECT * FROM deliveries WHERE idem_key = ?')
        .get(`max:peer-1:${testFileId}:event-1`);
      expect(delivery).toBeDefined();
      expect(delivery.status).toBe('sent');
      expect(delivery.attachment).toBe('attachment-token-123');
      expect(delivery.attempts).toBe(1);
    });
  });

  // ── Idempotent reuse ────────────────────────────────────────────────────────

  describe('idempotent reuse', () => {
    it('same triggerEventId returns reused without upload/send', async () => {
      const upload = vi.fn().mockResolvedValue('attachment-token');
      const send = vi.fn().mockResolvedValue(undefined);

      // First call
      await deliverFile(db, {
        platform: 'vk',
        peerId: 'peer-2',
        fileId: testFileId,
        triggerEventId: 'event-2',
        upload,
        send,
        log: createMockLogger(),
      });

      // Second call with same triggerEventId
      const result = await deliverFile(db, {
        platform: 'vk',
        peerId: 'peer-2',
        fileId: testFileId,
        triggerEventId: 'event-2',
        upload,
        send,
        log: createMockLogger(),
      });

      expect(result.status).toBe('sent');
      expect(result.reused).toBe(true);
      expect(upload).toHaveBeenCalledOnce(); // Only called once
      expect(send).toHaveBeenCalledOnce(); // Only called once
    });
  });

  // ── Upload failure ──────────────────────────────────────────────────────────

  describe('upload failure', () => {
    it('stores error, status failed', async () => {
      const upload = vi.fn().mockRejectedValue(new Error('Network error'));
      const send = vi.fn();

      await expect(deliverFile(db, {
        platform: 'max',
        peerId: 'peer-3',
        fileId: testFileId,
        triggerEventId: 'event-3',
        upload,
        send,
        log: createMockLogger(),
      })).rejects.toThrow('Network error');

      expect(send).not.toHaveBeenCalled();

      // Verify database state
      const delivery = db.prepare('SELECT * FROM deliveries WHERE idem_key = ?')
        .get(`max:peer-3:${testFileId}:event-3`);
      expect(delivery).toBeDefined();
      expect(delivery.status).toBe('failed');
      expect(delivery.attachment).toBeNull();
      expect(delivery.last_error).toContain('Network error');
    });
  });

  // ── Send failure after upload ───────────────────────────────────────────────

  describe('send failure after upload', () => {
    it('preserves attachment, status failed', async () => {
      const upload = vi.fn().mockResolvedValue('attachment-token');
      const send = vi.fn().mockRejectedValue(new Error('Send timeout'));

      await expect(deliverFile(db, {
        platform: 'max',
        peerId: 'peer-4',
        fileId: testFileId,
        triggerEventId: 'event-4',
        upload,
        send,
        log: createMockLogger(),
      })).rejects.toThrow('Send timeout');

      expect(upload).toHaveBeenCalledOnce();

      // Verify database state
      const delivery = db.prepare('SELECT * FROM deliveries WHERE idem_key = ?')
        .get(`max:peer-4:${testFileId}:event-4`);
      expect(delivery).toBeDefined();
      expect(delivery.status).toBe('failed');
      expect(delivery.attachment).toBe('attachment-token'); // Preserved
      expect(delivery.last_error).toContain('Send timeout');
    });
  });

  // ── Retry after send failure ────────────────────────────────────────────────

  describe('retry after send failure', () => {
    it('uses existing attachment, no re-upload', async () => {
      const upload = vi.fn().mockResolvedValue('attachment-token');
      const sendFail = vi.fn().mockRejectedValue(new Error('Temporary error'));
      const sendSuccess = vi.fn().mockResolvedValue(undefined);

      // First call — send fails
      await expect(deliverFile(db, {
        platform: 'max',
        peerId: 'peer-5',
        fileId: testFileId,
        triggerEventId: 'event-5',
        upload,
        send: sendFail,
        log: createMockLogger(),
      })).rejects.toThrow('Temporary error');

      expect(upload).toHaveBeenCalledOnce();

      // Second call — send succeeds
      const result = await deliverFile(db, {
        platform: 'max',
        peerId: 'peer-5',
        fileId: testFileId,
        triggerEventId: 'event-5',
        upload,
        send: sendSuccess,
        log: createMockLogger(),
      });

      expect(result.status).toBe('sent');
      expect(result.reused).toBe(false);
      expect(upload).toHaveBeenCalledOnce(); // Still only once — reused attachment
      expect(sendSuccess).toHaveBeenCalledWith('attachment-token', `max:peer-5:${testFileId}:event-5`);

      // Verify attempts counter
      const delivery = db.prepare('SELECT * FROM deliveries WHERE idem_key = ?')
        .get(`max:peer-5:${testFileId}:event-5`);
      expect(delivery.attempts).toBe(2);
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles upload returning empty string', async () => {
      const upload = vi.fn().mockResolvedValue('');
      const send = vi.fn().mockResolvedValue(undefined);

      const result = await deliverFile(db, {
        platform: 'max',
        peerId: 'peer-6',
        fileId: testFileId,
        triggerEventId: 'event-6',
        upload,
        send,
        log: createMockLogger(),
      });

      expect(result.status).toBe('sent');
    });

    it('generates unique idempotency keys', async () => {
      const upload = vi.fn().mockResolvedValue('token');
      const send = vi.fn().mockResolvedValue(undefined);

      await deliverFile(db, {
        platform: 'max',
        peerId: 'peer-7',
        fileId: testFileId,
        triggerEventId: 'event-7a',
        upload,
        send,
        log: createMockLogger(),
      });

      await deliverFile(db, {
        platform: 'max',
        peerId: 'peer-7',
        fileId: testFileId,
        triggerEventId: 'event-7b',
        upload,
        send,
        log: createMockLogger(),
      });

      expect(upload).toHaveBeenCalledTimes(2);
      expect(send).toHaveBeenCalledTimes(2);
    });
  });
});
