import crypto from 'node:crypto';

/**
 * Create an idempotent job queue backed by SQLite.
 *
 * DESIGN DECISIONS:
 * - INSERT OR IGNORE with unique idem_key ensures enqueue is idempotent.
 * - dequeue marks jobs 'running' atomically (SELECT + UPDATE in one prepare)
 *   so concurrent workers don't pick the same job.
 * - fail() uses exponential backoff: 5s, 10s, 15s... based on attempt count.
 * - recover() handles crash recovery: all 'running' → 'queued' on startup.
 *
 * @param {import('better-sqlite3').Database} db
 */
export function createQueue(db) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO jobs (id, kind, idem_key, document_id, payload, max_attempts, run_after, created_at, updated_at)
    VALUES (@id, @kind, @key, @documentId, @payload, @maxAttempts, @now, @now, @now)
  `);

  const byKey = db.prepare('SELECT * FROM jobs WHERE idem_key = ?');

  const readyJobs = db.prepare(`
    SELECT * FROM jobs
    WHERE status = 'queued' AND run_after <= datetime('now')
    ORDER BY created_at ASC
    LIMIT ?
  `);

  const markRunning = db.prepare(`
    UPDATE jobs SET status = 'running', updated_at = datetime('now')
    WHERE id = ? AND status = 'queued'
  `);

  const markDone = db.prepare(`
    UPDATE jobs SET status = 'done', updated_at = datetime('now')
    WHERE id = ?
  `);

  const markFailed = db.prepare(`
    UPDATE jobs SET status = 'failed', last_error = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  const requeue = db.prepare(`
    UPDATE jobs SET status = 'queued', attempts = attempts + 1,
      run_after = datetime('now', '+' || ? * 5 || ' seconds'),
      updated_at = datetime('now')
    WHERE id = ?
  `);

  const markStale = db.prepare(`
    UPDATE jobs SET status = 'stale', updated_at = datetime('now')
    WHERE id = ?
  `);

  const recoverRunning = db.prepare(`
    UPDATE jobs SET status = 'queued', updated_at = datetime('now')
    WHERE status = 'running'
  `);

  return {
    /**
     * Enqueue a job idempotently. Repeated call with same key returns existing job.
     * @returns {{ job: object|null, reused: boolean }}
     */
    enqueue({ kind, key, documentId, payload = {}, maxAttempts = 2 }) {
      // Use SQLite datetime('now') format — NOT ISO with 'T' —
      // so run_after <= datetime('now') comparisons work correctly.
      const now = db.prepare("SELECT datetime('now') as now").get().now;
      const id = crypto.randomUUID();
      const { changes } = insert.run({
        id, kind, key, documentId,
        payload: JSON.stringify(payload),
        maxAttempts, now,
      });
      return { job: byKey.get(key), reused: changes === 0 };
    },

    /**
     * Dequeue up to `limit` ready jobs and mark them running.
     * @param {number} limit
     * @returns {object[]}
     */
    dequeue(limit = 2) {
      const jobs = readyJobs.all(limit);
      const running = [];
      for (const job of jobs) {
        const result = markRunning.run(job.id);
        if (result.changes > 0) {
          running.push({ ...job, status: 'running' });
        }
      }
      return running;
    },

    /**
     * Mark a job as done.
     */
    done(jobId) {
      markDone.run(jobId);
    },

    /**
     * Mark a job as failed. If attempts remain, requeue with backoff.
     * @returns {{ failed: boolean, requeued: boolean }}
     */
    fail(jobId, error, job) {
      if (job.attempts + 1 < job.max_attempts) {
        requeue.run(job.attempts + 1, jobId);
        return { failed: false, requeued: true };
      }
      markFailed.run(String(error).slice(0, 500), jobId);
      return { failed: true, requeued: false };
    },

    /**
     * Mark a job as stale (result no longer needed).
     */
    stale(jobId) {
      markStale.run(jobId);
    },

    /**
     * Recover jobs stuck in 'running' (after server crash).
     */
    recover() {
      const { changes } = recoverRunning.run();
      return changes;
    },
  };
}
