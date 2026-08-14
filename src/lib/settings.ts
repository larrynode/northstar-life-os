import type Database from "better-sqlite3";

export function setSetting<T>(db: Database.Database, key: string, value: T): T {
  if (!key.trim()) throw new Error("setting key is required");
  db.prepare(`INSERT INTO settings(key,value_json,updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at`).run(key, JSON.stringify(value), new Date().toISOString());
  return value;
}

export function getSetting<T = unknown>(db: Database.Database, key: string, fallback?: T): T | undefined {
  const row = db.prepare("SELECT value_json FROM settings WHERE key = ?").get(key) as { value_json: string } | undefined;
  if (!row) return fallback;
  try { return JSON.parse(row.value_json) as T; } catch { return fallback; }
}

export function listSettings(db: Database.Database): Record<string, unknown> {
  const rows = db.prepare("SELECT key,value_json FROM settings ORDER BY key").all() as Array<{ key: string; value_json: string }>;
  return Object.fromEntries(rows.map((row) => { try { return [row.key, JSON.parse(row.value_json)]; } catch { return [row.key, row.value_json]; } }));
}
