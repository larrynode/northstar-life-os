import type Database from "better-sqlite3";
import { openDatabase } from "@/lib/db/client";

/** Keep route handlers thin: every Web API operation crosses the shared SQLite data layer. */
export function withDatabase<T>(callback: (db: Database.Database) => T): T {
  const db = openDatabase();
  try {
    return callback(db);
  } finally {
    db.close();
  }
}
