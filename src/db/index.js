import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Open (or create) the SQLite database, apply pending migrations, and return the handle.
 *
 * @param {string} dbPath - File path or ':memory:' for in-memory databases.
 * @param {{ log?: { info: (...args: any[]) => void } }} [opts]
 * @returns {import('better-sqlite3').Database}
 */
export function openDb(dbPath, { log } = {}) {
  const db = new Database(dbPath);

  // WAL mode for concurrent reads; foreign keys enforced globally.
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  applyMigrations(db, log);

  return db;
}

/**
 * Read every *.sql file from src/db/migrations/, sort by filename prefix,
 * and apply any that haven't been recorded in schema_migrations yet.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {{ info: (...args: any[]) => void }} [log]
 */
function applyMigrations(db, log) {
  // Ensure the migration tracking table exists.
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const migrationsDir = path.join(__dirname, 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied = db
    .prepare('SELECT version FROM schema_migrations')
    .all()
    .map((r) => r.version);

  const insert = db.prepare(
    'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
  );

  for (const file of files) {
    const version = parseInt(file.split('_')[0], 10);

    if (Number.isNaN(version) || applied.includes(version)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    // Run migration inside a transaction so partial failures roll back.
    db.transaction(() => {
      db.exec(sql);
      insert.run(version, new Date().toISOString());
    })();

    log?.info({ migration: file }, 'applied');
  }
}
