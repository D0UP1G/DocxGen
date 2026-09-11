-- 001_init.sql — Initial schema for DocxGen

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS documents (
  id                 TEXT PRIMARY KEY,
  owner_platform     TEXT NOT NULL,             -- max | vk | web
  owner_id           TEXT NOT NULL,
  doc_type           TEXT,                      -- memo | report | reference | letter
  template_id        TEXT,
  source_text        TEXT NOT NULL DEFAULT '',
  draft_version      INTEGER NOT NULL DEFAULT 0,
  user_fields        TEXT NOT NULL DEFAULT '{}', -- {key: "значение" | null}; null = «оставить незаполненным»
  status             TEXT NOT NULL DEFAULT 'draft', -- draft | processing | ai_failed | processed
  current_version_id TEXT,
  last_error         TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_platform, owner_id);

CREATE TABLE IF NOT EXISTS versions (
  id            TEXT PRIMARY KEY,
  document_id   TEXT NOT NULL REFERENCES documents(id),
  draft_version INTEGER NOT NULL,
  doc_type      TEXT NOT NULL,
  kind          TEXT NOT NULL,                  -- ai | manual
  title         TEXT,                           -- заголовок к тексту «О …»
  body          TEXT NOT NULL,                  -- JSON: массив абзацев
  ai_fields     TEXT NOT NULL DEFAULT '{}',     -- JSON: {key: {value, quote}} — только прошедшие проверку
  changes       TEXT NOT NULL DEFAULT '[]',     -- JSON: что исправил ИИ (для пользователя)
  warnings      TEXT NOT NULL DEFAULT '[]',     -- JSON: предупреждения проверки фактов
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL,                   -- process
  idem_key     TEXT NOT NULL UNIQUE,
  document_id  TEXT,
  payload      TEXT NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'queued',  -- queued | running | done | failed | stale
  attempts     INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 2,
  run_after    TEXT NOT NULL,
  last_error   TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_ready ON jobs(status, run_after);

CREATE TABLE IF NOT EXISTS files (
  id          TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id),
  version_id  TEXT NOT NULL REFERENCES versions(id),
  template_id TEXT NOT NULL,                    -- фактически использованный (может быть fallback)
  fields_hash TEXT NOT NULL,
  path        TEXT NOT NULL,
  filename    TEXT NOT NULL,
  placeholders TEXT NOT NULL DEFAULT '[]',      -- JSON: подписи незаполненных реквизитов
  created_at  TEXT NOT NULL,
  UNIQUE (version_id, template_id, fields_hash)
);

CREATE TABLE IF NOT EXISTS deliveries (
  id         TEXT PRIMARY KEY,
  idem_key   TEXT NOT NULL UNIQUE,              -- <platform>:<peerId>:<fileId>:<triggerEventId>
  platform   TEXT NOT NULL,
  peer_id    TEXT NOT NULL,
  file_id    TEXT NOT NULL REFERENCES files(id),
  status     TEXT NOT NULL DEFAULT 'pending',   -- pending | uploaded | sent | failed
  attachment TEXT,                              -- токен MAX / строка docXXX_YYY ВК после загрузки
  attempts   INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  platform      TEXT NOT NULL,
  peer_id       TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  state         TEXT NOT NULL DEFAULT 'idle',
  state_version INTEGER NOT NULL DEFAULT 0,     -- входит в payload кнопок; старые кнопки отклоняются
  document_id   TEXT,
  pending_field TEXT,
  ctx           TEXT NOT NULL DEFAULT '{}',     -- JSON: inputMode, templateMode, fieldQueue и т. п.
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (platform, peer_id)
);

CREATE TABLE IF NOT EXISTS inbound_events (
  platform    TEXT NOT NULL,
  event_id    TEXT NOT NULL,
  payload     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'received', -- received | handled | failed
  received_at TEXT NOT NULL,
  PRIMARY KEY (platform, event_id)
);

CREATE TABLE IF NOT EXISTS processing_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT NOT NULL,
  job_id      TEXT,
  stage       TEXT NOT NULL,                    -- prompt | ai_raw | ai_parsed | grounding | facts | merge | render | error
  data        TEXT NOT NULL,                    -- JSON
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS template_assets (
  platform    TEXT NOT NULL,
  template_id TEXT NOT NULL,
  attachment  TEXT NOT NULL,
  PRIMARY KEY (platform, template_id)
);
