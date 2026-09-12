import { AiUnavailableError, AiInvalidResponseError } from '../core/errors.js';

/**
 * Start the background worker that polls for ready jobs.
 *
 * DESIGN DECISIONS:
 * - Polling every 500ms (configurable) — lightweight for SQLite backend.
 * - Concurrency limit prevents overwhelming the AI provider.
 * - Graceful shutdown: stops polling, waits up to 10s for active jobs.
 * - Retry logic: AiUnavailableError/AiInvalidResponseError → requeue with backoff.
 *   Other errors fail permanently (likely code bugs, not transient).
 *
 * @param {{ db: object, queue: object, handlers: object, concurrency?: number, pollMs?: number, log: object }} params
 * @returns {{ stop: () => Promise<void> }}
 */
export function startWorker({ db, queue, handlers, concurrency = 2, pollMs = 500, log }) {
  let running = true;
  let activeCount = 0;
  let pollTimer = null;

  async function poll() {
    if (!running || activeCount >= concurrency) return;

    const jobs = queue.dequeue(concurrency - activeCount, Object.keys(handlers));
    for (const job of jobs) {
      log.debug({ jobId: job.id, kind: job.kind, documentId: job.document_id, attempt: (job.attempts ?? 0) + 1, maxAttempts: job.max_attempts }, 'задача взята в работу');
      activeCount++;
      processJob(job).finally(() => {
        activeCount--;
        if (running) scheduleNext();
      });
    }

    // If no jobs picked up, schedule next poll
    if (running && activeCount === 0) {
      scheduleNext();
    }
  }

  async function processJob(job) {
    const handler = handlers[job.kind];
    if (!handler) {
      log.error({ kind: job.kind }, 'no handler for job kind');
      queue.done(job.id);
      return;
    }

    const startedAt = Date.now();
    try {
      const result = await handler(job);
      if (result === 'stale') {
        queue.stale(job.id);
        log.info({ jobId: job.id, kind: job.kind, documentId: job.document_id, ms: Date.now() - startedAt }, 'job stale');
      } else {
        queue.done(job.id);
        log.info({ jobId: job.id, kind: job.kind, documentId: job.document_id, ms: Date.now() - startedAt }, 'job done');
      }
    } catch (err) {
      if ((err instanceof AiUnavailableError || err instanceof AiInvalidResponseError) && err.retryable !== false) {
        const { failed, requeued } = queue.fail(job.id, err, job);
        if (failed) {
          log.error({ jobId: job.id, error: err.message }, 'job failed permanently');
        } else if (requeued) {
          log.info({ jobId: job.id }, 'job requeued');
        }
      } else {
        // Non-retryable error — fail permanently: exhaust the attempts so fail() does not requeue
        queue.fail(job.id, err, { ...job, attempts: job.max_attempts });
        log.error({ jobId: job.id, error: err.message }, 'job failed (non-retryable)');
      }
    }
  }

  function scheduleNext() {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = setTimeout(poll, pollMs);
  }

  // Start polling
  scheduleNext();

  return {
    async stop() {
      running = false;
      if (pollTimer) clearTimeout(pollTimer);

      // Wait for active jobs to complete (max 10s)
      const deadline = Date.now() + 10_000;
      while (activeCount > 0 && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 100));
      }

      if (activeCount > 0) {
        log.warn({ activeCount }, 'worker stopped with active jobs');
      }
    },
  };
}
