import Database from "better-sqlite3";
import fs from "node:fs";
import type { DatabaseHandle } from "../types";
import { ensureDataDirs, resolveDataPaths } from "../paths";
import type { DataPaths } from "../types";
import { migrate } from "./migrations";

export interface OpenDatabaseOptions {
  paths?: DataPaths;
  filename?: string;
  readonly?: boolean;
}

/** Open (and migrate) a local SQLite database. */
export function openDatabase(options: OpenDatabaseOptions = {}): Database.Database {
  const paths = options.paths ?? resolveDataPaths();
  const filename = options.filename ?? paths.dbPath;
  if (!options.readonly && filename !== ":memory:") ensureDataDirs(paths);
  const db = new Database(filename, options.readonly ? { readonly: true, fileMustExist: true } : undefined);
  if (!options.readonly && filename !== ":memory:") fs.chmodSync(filename, 0o600);
  db.pragma("foreign_keys = ON");
  if (!options.readonly) {
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");
    migrate(db);
  }
  return db;
}

/** Convenience wrapper carrying path information for service/API consumers. */
export function createDatabase(options: OpenDatabaseOptions = {}): DatabaseHandle {
  const paths = options.paths ?? resolveDataPaths();
  const db = openDatabase({ ...options, paths });
  return { db, paths, close: () => db.close() };
}

export function withTransaction<T>(db: Database.Database, fn: () => T): T {
  return db.transaction(fn)();
}

export { migrate } from "./migrations";
