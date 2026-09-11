import fs from 'node:fs';
import path from 'node:path';

/**
 * Create cleanup handler for removing old data.
 *
 * DESIGN DECISIONS:
 * - Runs as a scheduled job (not a worker loop) — cleaner architecture.
 * - Removes: orphaned files (>24h), old jobs (>7d), old inbound_events (>7d), old processing_log (>30d).
 * - Configurable via env vars (CLEANUP_ENABLED, CLEANUP_FILE_MAX_AGE_HOURS, CLEANUP_LOG_MAX_AGE_DAYS).
 * - Idempotent: safe to run multiple times; removes what's old, leaves what's fresh.
 *
 * @param {{ db: object, dataDir: string, log: object, env: object }} deps
 * @returns {function} cleanup()
 */
export function createCleanupHandler({ db, dataDir, log, env }) {
  return function cleanup() {
    // Схема окружения отдаёт булево значение, но обработчик можно вызвать и с сырым process.env
    const enabled = env.CLEANUP_ENABLED === true || env.CLEANUP_ENABLED === '1' || env.CLEANUP_ENABLED === 'true';
    if (!enabled) return;

    const now = new Date();
    let totalRemoved = 0;

    // 1. Remove files without delivery (>24h)
    const fileMaxAge = env.CLEANUP_FILE_MAX_AGE_HOURS || 24;
    const staleFiles = db.prepare(`
      SELECT f.id, f.path FROM files f
      LEFT JOIN deliveries d ON d.file_id = f.id
      WHERE d.id IS NULL AND f.created_at < datetime('now', '-' || ? || ' hours')
    `).all(fileMaxAge);

    for (const file of staleFiles) {
      try {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        db.prepare('DELETE FROM files WHERE id = ?').run(file.id);
        totalRemoved++;
      } catch (err) {
        log?.warn({ fileId: file.id, error: err.message }, 'cleanup: failed to remove file');
      }
    }

    // 2. Remove old jobs (>7d)
    const jobsRemoved = db.prepare(`
      DELETE FROM jobs WHERE created_at < datetime('now', '-7 days')
    `).run();
    totalRemoved += jobsRemoved.changes;

    // 3. Remove old inbound_events (>7d)
    const eventsRemoved = db.prepare(`
      DELETE FROM inbound_events WHERE received_at < datetime('now', '-7 days')
    `).run();
    totalRemoved += eventsRemoved.changes;

    // 4. Remove old processing_log (>30d)
    const logMaxAge = env.CLEANUP_LOG_MAX_AGE_DAYS || 30;
    const logsRemoved = db.prepare(`
      DELETE FROM processing_log WHERE created_at < datetime('now', '-' || ? || ' days')
    `).run(logMaxAge);
    totalRemoved += logsRemoved.changes;

    log?.info({ totalRemoved }, 'cleanup completed');
  };
}
