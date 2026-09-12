#!/usr/bin/env node
// migrate-field-keys.js — Convert English field keys to Russian labels in SQLite
// Usage:
//   node scripts/migrate-field-keys.js [--dry-run] [--db <path>]
//   --dry-run   Show what would be changed without writing
//   --db        Path to SQLite database (default: ./data/app.sqlite)
//   --verbose   Show detailed information about each row

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Key mapping: English → Russian
const KEY_MAP = {
  addressee: 'Адресат',
  authorPosition: 'Должность автора',
  authorName: 'ФИО автора',
  title: 'Тема',
  date: 'Дата',
  number: 'Номер',
  signerPosition: 'Должность подписывающего',
  signerName: 'ФИО подписывающего',
  addresseeOrg: 'Организация адресата',
  addresseePerson: 'Лицо адресата',
  addresseeAddress: 'Адрес адресата',
  salutation: 'Обращение',
  executor: 'Исполнитель',
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    dbPath: null,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      options.dryRun = true;
    } else if (args[i] === '--verbose') {
      options.verbose = true;
    } else if (args[i] === '--db' && args[i + 1]) {
      options.dbPath = args[++i];
    }
  }

  return options;
}

// Remap keys in a JSON object
function remapKeys(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { remapped: {}, changed: false };
  }

  const remapped = {};
  let changed = false;

  for (const [key, value] of Object.entries(obj)) {
    const newKey = KEY_MAP[key] || key;
    remapped[newKey] = value;

    if (newKey !== key) {
      changed = true;
    }
  }

  return { remapped, changed };
}

// Main migration function
async function migrate() {
  const options = parseArgs();
  // Determine database path
  let dbPath = options.dbPath;
  if (!dbPath) {
    // Try to find the database in the default location
    const rootDir = path.resolve(__dirname, '..');
    dbPath = path.join(rootDir, 'data', 'app.sqlite');
    // If not found, try current directory
    if (!fs.existsSync(dbPath)) {
      dbPath = path.join(process.cwd(), 'data', 'app.sqlite');
    }
  }

  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Database not found at: ${dbPath}`);
    console.error('Use --db <path> to specify the database location');
    process.exit(1);
  }

  console.log(`📁 Database: ${dbPath}`);
  console.log(`🔍 Mode: ${options.dryRun ? 'DRY RUN (no changes will be written)' : 'LIVE RUN'}`);
  console.log('');

  // Connect to database
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  try {
    // Start transaction for live runs
    const migrateTransaction = db.transaction(() => {
      // 1. Migrate documents.user_fields
      console.log('📋 Migrating documents.user_fields...');
      const docs = db.prepare('SELECT id, user_fields FROM documents WHERE user_fields != \'{}\'').all();
      let docsMigrated = 0;
      let docsSkipped = 0;
      let docsChanged = 0;

      const updateDoc = db.prepare('UPDATE documents SET user_fields = ? WHERE id = ?');

      for (const doc of docs) {
        try {
          const original = JSON.parse(doc.user_fields);
          const { remapped, changed } = remapKeys(original);

          if (changed) {
            docsChanged++;
            if (options.verbose) {
              console.log(`  📄 Document ${doc.id}:`);
              console.log(`    Before: ${JSON.stringify(original)}`);
              console.log(`    After:  ${JSON.stringify(remapped)}`);
            }

            if (!options.dryRun) {
              updateDoc.run(JSON.stringify(remapped), doc.id);
            }
            docsMigrated++;
          } else {
            docsSkipped++;
          }
        } catch (error) {
          console.error(`  ⚠️  Error processing document ${doc.id}: ${error.message}`);
        }
      }

      console.log(`  ✅ Documents: ${docsChanged} changed, ${docsSkipped} already migrated, ${docsMigrated} updated`);

      // 2. Migrate versions.ai_fields
      console.log('📋 Migrating versions.ai_fields...');
      const versions = db.prepare('SELECT id, document_id, ai_fields FROM versions WHERE ai_fields != \'{}\'').all();
      let versionsMigrated = 0;
      let versionsSkipped = 0;
      let versionsChanged = 0;

      const updateVersion = db.prepare('UPDATE versions SET ai_fields = ? WHERE id = ?');

      for (const version of versions) {
        try {
          const original = JSON.parse(version.ai_fields);
          const { remapped, changed } = remapKeys(original);

          if (changed) {
            versionsChanged++;
            if (options.verbose) {
              console.log(`  📄 Version ${version.id} (doc: ${version.document_id}):`);
              console.log(`    Before: ${JSON.stringify(original)}`);
              console.log(`    After:  ${JSON.stringify(remapped)}`);
            }

            if (!options.dryRun) {
              updateVersion.run(JSON.stringify(remapped), version.id);
            }
            versionsMigrated++;
          } else {
            versionsSkipped++;
          }
        } catch (error) {
          console.error(`  ⚠️  Error processing version ${version.id}: ${error.message}`);
        }
      }

      console.log(`  ✅ Versions: ${versionsChanged} changed, ${versionsSkipped} already migrated, ${versionsMigrated} updated`);

      // Return summary
      return {
        documents: { total: docs.length, changed: docsChanged, migrated: docsMigrated, skipped: docsSkipped },
        versions: { total: versions.length, changed: versionsChanged, migrated: versionsMigrated, skipped: versionsSkipped },
      };
    });

    // Execute migration
    const summary = options.dryRun ? migrateTransaction() : migrateTransaction();

    console.log('');
    console.log('📊 Migration Summary:');
    console.log(`  Documents: ${summary.documents.total} total, ${summary.documents.changed} with English keys, ${summary.documents.migrated} updated`);
    console.log(`  Versions:  ${summary.versions.total} total, ${summary.versions.changed} with English keys, ${summary.versions.migrated} updated`);

    if (options.dryRun) {
      console.log('');
      console.log('⚠️  This was a DRY RUN. No changes were written to the database.');
      console.log('   Run without --dry-run to apply changes.');
    } else {
      console.log('');
      console.log('✅ Migration completed successfully!');
    }

    // Verify idempotency - run again to check
    if (!options.dryRun) {
      console.log('');
      console.log('🔍 Verifying idempotency (checking if running again would change anything)...');
      const verifyDocs = db.prepare('SELECT id, user_fields FROM documents WHERE user_fields != \'{}\'').all();
      const verifyVersions = db.prepare('SELECT id, ai_fields FROM versions WHERE ai_fields != \'{}\'').all();
      let docsWouldChange = 0;
      let versionsWouldChange = 0;

      for (const doc of verifyDocs) {
        try {
          const original = JSON.parse(doc.user_fields);
          const { changed } = remapKeys(original);
          if (changed) docsWouldChange++;
        } catch (error) {
          // Ignore parse errors
        }
      }

      for (const version of verifyVersions) {
        try {
          const original = JSON.parse(version.ai_fields);
          const { changed } = remapKeys(original);
          if (changed) versionsWouldChange++;
        } catch (error) {
          // Ignore parse errors
        }
      }

      if (docsWouldChange === 0 && versionsWouldChange === 0) {
        console.log('✅ Idempotency verified: running again would not change anything.');
      } else {
        console.log(`⚠️  Warning: ${docsWouldChange} documents and ${versionsWouldChange} versions would still be changed.`);
        console.log('   This suggests the migration is not fully idempotent.');
      }
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run the migration
migrate().catch(console.error);
