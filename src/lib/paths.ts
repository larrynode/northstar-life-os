import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import type { DataPaths } from "./types";

export interface DataPathEnv {
  NORTHSTAR_DATA_DIR?: string;
  [key: string]: string | undefined;
}

/**
 * Resolve the local data layout.  No directories are created by this function;
 * call ensureDataDirs when opening a database or writing an attachment.
 */
export function resolveDataPaths(env: DataPathEnv = process.env, home = os.homedir()): DataPaths {
  const configured = (env.NORTHSTAR_DATA_DIR ?? "").trim();
  const root = path.resolve(expandHome(configured || path.join(home, "Library", "Application Support", "NorthstarLifeOS"), home));
  const dbDir = path.join(root, "db");
  return {
    root,
    dbDir,
    dbPath: path.join(dbDir, "northstar.sqlite"),
    attachmentsDir: path.join(root, "attachments"),
    backupsDir: path.join(root, "backups"),
  };
}

function expandHome(value: string, home: string): string {
  if (value === "~") return home;
  if (value.startsWith("~/")) return path.join(home, value.slice(2));
  return value;
}

export function ensureDataDirs(paths: DataPaths): DataPaths {
  for (const dir of [paths.root, paths.dbDir, paths.attachmentsDir, paths.backupsDir]) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.chmodSync(dir, 0o700);
  }
  return paths;
}

export function dataPathFromEnv(env: DataPathEnv = process.env): string {
  return resolveDataPaths(env).root;
}
