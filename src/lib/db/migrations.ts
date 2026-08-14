import type Database from "better-sqlite3";
import { SCHEMA_VERSION } from "../types";

/** Idempotent migrations.  A migration is applied atomically and can safely be run on every open. */
export function migrate(db: Database.Database): void {
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );`);
  const current = Number((db.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations").get() as { version: number }).version);
  if (current >= SCHEMA_VERSION) return;

  const migration = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        title TEXT,
        status TEXT,
        data_json TEXT NOT NULL DEFAULT '{}',
        due_at TEXT,
        start_at TEXT,
        end_at TEXT,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS records_type_idx ON records(type);
      CREATE INDEX IF NOT EXISTS records_status_idx ON records(status);

      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS record_tags (
        record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
        tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY(record_id, tag_id)
      );

      CREATE TABLE IF NOT EXISTS links (
        id TEXT PRIMARY KEY NOT NULL,
        from_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
        to_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
        relation TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        UNIQUE(from_id, to_id, relation)
      );
      CREATE INDEX IF NOT EXISTS links_from_idx ON links(from_id);
      CREATE INDEX IF NOT EXISTS links_to_idx ON links(to_id);

      CREATE TABLE IF NOT EXISTS activity (
        id TEXT PRIMARY KEY NOT NULL,
        record_id TEXT REFERENCES records(id) ON DELETE SET NULL,
        kind TEXT NOT NULL,
        content_json TEXT NOT NULL DEFAULT '{}',
        occurred_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS activity_record_idx ON activity(record_id);
      CREATE INDEX IF NOT EXISTS activity_occurred_idx ON activity(occurred_at);

      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY NOT NULL,
        record_id TEXT REFERENCES records(id) ON DELETE SET NULL,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL UNIQUE,
        media_type TEXT,
        size INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS attachments_record_idx ON attachments(record_id);

      CREATE TABLE IF NOT EXISTS drafts (
        id TEXT PRIMARY KEY NOT NULL,
        operation TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        target_id TEXT,
        payload_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending',
        reason TEXT,
        created_at TEXT NOT NULL,
        reviewed_at TEXT,
        applied_at TEXT
      );
      CREATE INDEX IF NOT EXISTS drafts_status_idx ON drafts(status);

      CREATE TABLE IF NOT EXISTS imports (
        id TEXT PRIMARY KEY NOT NULL,
        source_name TEXT,
        source_type TEXT NOT NULL,
        checksum TEXT,
        status TEXT NOT NULL DEFAULT 'preview',
        preview_json TEXT NOT NULL DEFAULT '{}',
        stats_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value_json TEXT NOT NULL DEFAULT 'null',
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS vault (
        id TEXT PRIMARY KEY NOT NULL,
        ciphertext TEXT NOT NULL,
        nonce TEXT,
        algorithm TEXT NOT NULL DEFAULT 'AES-GCM',
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS vault_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(SCHEMA_VERSION, new Date().toISOString());
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
  });
  migration();
}

export function getMigrationVersion(db: Database.Database): number {
  try {
    return Number((db.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations").get() as { version: number }).version);
  } catch {
    return 0;
  }
}
