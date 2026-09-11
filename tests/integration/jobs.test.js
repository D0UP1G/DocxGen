import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openDb } from '../../src/db/index.js';
import { createQueue } from '../../src/jobs/queue.js';
import { startWorker } from '../../src/jobs/worker.js';
import { createProcessDocumentHandler } from '../../src/jobs/handlers/processDocument.js';
import { createCleanupHandler } from '../../src/jobs/handlers/cleanup.js';
import { events } from '../../src/core/events.js';
import { AiUnavailableError, AiInvalidResponseError } from '../../src/core/errors.js';
import pino from 'pino';

const silentLog = pino({ level: 'silent' });

describe('Job Queue', () => {
  let db;
  let queue;

  beforeEach(() => {
    db = openDb(':memory:');
    queue = createQueue(db);
  });

  it('enqueues a job successfully', () => {
    const { job, reused } = queue.enqueue({
      kind: 'process',
      key: 'doc:123:v1',
      documentId: 'doc-123',
      payload: { draftVersion: 1, docType: 'memo' },
    });

    expect(job).toBeTruthy();
    expect(job.kind).toBe('process');
    expect(job.status).toBe('queued');
    expect(reused).toBe(false);
  });

  it('returns reused=true for duplicate idem_key', () => {
    queue.enqueue({ kind: 'process', key: 'doc:123:v1', documentId: 'doc-123' });
    const { job: job2, reused } = queue.enqueue({
      kind: 'process',
      key: 'doc:123:v1',
      documentId: 'doc-123',
    });

    expect(reused).toBe(true);
    expect(job2).toBeTruthy();
  });

  it('dequeue marks job as running', () => {
    queue.enqueue({ kind: 'process', key: 'doc:123:v1', documentId: 'doc-123' });
    const running = queue.dequeue(1);

    expect(running).toHaveLength(1);
    expect(running[0].status).toBe('running');
  });

  it('marks job as done', () => {
    queue.enqueue({ kind: 'process', key: 'doc:123:v1', documentId: 'doc-123' });
    const running = queue.dequeue(1);
    queue.done(running[0].id);

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(running[0].id);
    expect(job.status).toBe('done');
  });

  it('fail with AiUnavailableError requeues if attempts remain', () => {
    queue.enqueue({ kind: 'process', key: 'doc:123:v1', documentId: 'doc-123', maxAttempts: 2 });
    const running = queue.dequeue(1);
    const job = running[0];

    const { failed, requeued } = queue.fail(job.id, new AiUnavailableError(), job);

    expect(failed).toBe(false);
    expect(requeued).toBe(true);

    const jobAfter = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job.id);
    expect(jobAfter.status).toBe('queued');
    expect(jobAfter.attempts).toBe(1);
  });

  it('fail twice marks job as failed (attempts exhausted)', () => {
    queue.enqueue({ kind: 'process', key: 'doc:123:v1', documentId: 'doc-123', maxAttempts: 2 });
    let running = queue.dequeue(1);
    queue.fail(running[0].id, new AiUnavailableError(), running[0]);

    // Requeue will put it back; dequeue again
    running = queue.dequeue(1);
    const { failed, requeued } = queue.fail(running[0].id, new AiUnavailableError(), running[0]);

    expect(failed).toBe(true);
    expect(requeued).toBe(false);

    const jobAfter = db.prepare('SELECT * FROM jobs WHERE id = ?').get(running[0].id);
    expect(jobAfter.status).toBe('failed');
  });

  it('marks job as stale', () => {
    queue.enqueue({ kind: 'process', key: 'doc:123:v1', documentId: 'doc-123' });
    const running = queue.dequeue(1);
    queue.stale(running[0].id);

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(running[0].id);
    expect(job.status).toBe('stale');
  });

  it('recover moves running jobs to queued', () => {
    queue.enqueue({ kind: 'process', key: 'doc:123:v1', documentId: 'doc-123' });
    queue.dequeue(1);

    const recovered = queue.recover();
    expect(recovered).toBe(1);

    const job = db.prepare('SELECT * FROM jobs WHERE idem_key = ?').get('doc:123:v1');
    expect(job.status).toBe('queued');
  });

  it('concurrent dequeue respects concurrency limit', () => {
    // Enqueue 4 jobs
    for (let i = 0; i < 4; i++) {
      queue.enqueue({ kind: 'process', key: `doc:${i}:v1`, documentId: `doc-${i}` });
    }

    // Dequeue with limit 2
    const batch1 = queue.dequeue(2);
    expect(batch1).toHaveLength(2);

    // Can't dequeue more — they're already running
    const batch2 = queue.dequeue(2);
    expect(batch2).toHaveLength(0);
  });
});

describe('Worker', () => {
  let db;
  let queue;
  let worker;

  beforeEach(() => {
    db = openDb(':memory:');
    queue = createQueue(db);
  });

  afterEach(async () => {
    if (worker) await worker.stop();
    events.removeAllListeners();
  });

  it('processes jobs automatically', async () => {
    const processed = [];
    const handlers = {
      test_kind: async (job) => {
        processed.push(job.id);
      },
    };

    worker = startWorker({
      db, queue, handlers, concurrency: 1, pollMs: 10, log: silentLog,
    });

    queue.enqueue({ kind: 'test_kind', key: 'test:1', documentId: null });

    // Wait for processing
    await new Promise(r => setTimeout(r, 100));

    expect(processed).toHaveLength(1);
  });

  it('stops gracefully', async () => {
    const processed = [];
    const handlers = {
      slow_kind: async (job) => {
        await new Promise(r => setTimeout(r, 50));
        processed.push(job.id);
      },
    };

    worker = startWorker({
      db, queue, handlers, concurrency: 1, pollMs: 10, log: silentLog,
    });

    queue.enqueue({ kind: 'slow_kind', key: 'slow:1', documentId: null });

    // Wait a bit, then stop
    await new Promise(r => setTimeout(r, 30));
    await worker.stop();

    // Job should have completed
    expect(processed).toHaveLength(1);
  });

  it('returns stale for missing document', async () => {
    const handler = createProcessDocumentHandler({
      documentService: { getInternal: () => null },
      processDraft: vi.fn(),
      log: silentLog,
    });

    worker = startWorker({
      db, queue, handlers: { process: handler }, concurrency: 1, pollMs: 10, log: silentLog,
    });

    queue.enqueue({
      kind: 'process',
      key: 'missing:1',
      documentId: 'nonexistent',
      payload: { documentId: 'nonexistent', draftVersion: 1, docType: 'memo' },
    });

    await new Promise(r => setTimeout(r, 100));

    const job = db.prepare('SELECT * FROM jobs WHERE idem_key = ?').get('missing:1');
    expect(job.status).toBe('stale');
  });

  it('retries on AiUnavailableError', async () => {
    let attempts = 0;
    const handler = async (job) => {
      attempts++;
      if (attempts === 1) throw new AiUnavailableError();
      return 'ok';
    };

    worker = startWorker({
      db, queue, handlers: { flaky: handler }, concurrency: 1, pollMs: 10, log: silentLog,
    });

    queue.enqueue({ kind: 'flaky', key: 'flaky:1', documentId: null, maxAttempts: 3 });

    // Wait for both attempts
    await new Promise(r => setTimeout(r, 200));

    expect(attempts).toBe(2);
  });
});

describe('ProcessDocument Handler', () => {
  it('processes document and emits event', async () => {
    const mockDoc = {
      id: 'doc-123',
      draft_version: 1,
      doc_type: 'memo',
      source_text: 'test text',
      doc_type_config: {},
      user_fields: '{}',
    };

    const documentService = {
      getInternal: vi.fn().mockReturnValue(mockDoc),
      saveVersion: vi.fn(),
      markProcessed: vi.fn(),
    };

    const processDraft = vi.fn().mockResolvedValue({
      title: 'Test',
      body: '[]',
      aiFields: {},
      changes: [],
      warnings: [],
    });

    const handler = createProcessDocumentHandler({ documentService, processDraft, log: silentLog });

    const eventSpy = vi.fn();
    events.on('document.processed', eventSpy);

    await handler({
      id: 'job-1',
      payload: JSON.stringify({ documentId: 'doc-123', draftVersion: 1, docType: 'memo' }),
    });

    expect(processDraft).toHaveBeenCalled();
    expect(documentService.saveVersion).toHaveBeenCalled();
    expect(documentService.markProcessed).toHaveBeenCalledWith('doc-123');
    expect(eventSpy).toHaveBeenCalledWith({ documentId: 'doc-123' });

    events.removeAllListeners();
  });

  it('returns stale if document not found', async () => {
    const documentService = { getInternal: vi.fn().mockReturnValue(null) };
    const handler = createProcessDocumentHandler({
      documentService, processDraft: vi.fn(), log: silentLog,
    });

    const result = await handler({
      id: 'job-1',
      payload: JSON.stringify({ documentId: 'gone', draftVersion: 1, docType: 'memo' }),
    });

    expect(result).toBe('stale');
  });
});

describe('Cleanup Handler', () => {
  let db;

  beforeEach(() => {
    db = openDb(':memory:');
  });

  it('removes old jobs', () => {
    // Insert an old job directly
    db.prepare(`
      INSERT INTO jobs (id, kind, idem_key, status, attempts, max_attempts, run_after, created_at, updated_at)
      VALUES ('old-job', 'test', 'key:old', 'done', 0, 2, datetime('now'), datetime('now', '-10 days'), datetime('now', '-10 days'))
    `).run();

    const cleanup = createCleanupHandler({
      db,
      dataDir: '/tmp',
      log: silentLog,
      env: { CLEANUP_ENABLED: '1' },
    });

    cleanup();

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get('old-job');
    expect(job).toBeUndefined();
  });

  it('does nothing when CLEANUP_ENABLED is not 1', () => {
    db.prepare(`
      INSERT INTO jobs (id, kind, idem_key, status, attempts, max_attempts, run_after, created_at, updated_at)
      VALUES ('old-job', 'test', 'key:old', 'done', 0, 2, datetime('now'), datetime('now', '-10 days'), datetime('now', '-10 days'))
    `).run();

    const cleanup = createCleanupHandler({
      db,
      dataDir: '/tmp',
      log: silentLog,
      env: { CLEANUP_ENABLED: '0' },
    });

    cleanup();

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get('old-job');
    expect(job).toBeTruthy();
  });
});
