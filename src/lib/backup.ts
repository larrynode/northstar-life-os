import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import type { BackupManifest, DataPaths } from "./types";
import { SCHEMA_VERSION } from "./types";
import { ensureDataDirs, resolveDataPaths } from "./paths";

function sha256(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function filesUnder(root: string, relative = ""): string[] {
  const directory = path.join(root, relative);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryRelative = path.join(relative, entry.name);
    return entry.isDirectory() ? filesUnder(root, entryRelative) : [entryRelative];
  });
}

function copyTree(source: string, target: string): void {
  if (!fs.existsSync(source)) return;
  for (const relative of filesUnder(source)) {
    const destination = path.join(target, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
    fs.copyFileSync(path.join(source, relative), destination);
  }
}

export interface BackupOptions { destination?: string; paths?: DataPaths; includeAttachments?: boolean; }

/** Create a timestamped, self-verifying backup. Vault is copied only as the opaque DB ciphertext. */
export function createBackup(db: Database.Database, options: BackupOptions = {}): { directory: string; manifest: BackupManifest } {
  const paths = options.paths ?? resolveDataPaths();
  ensureDataDirs(paths);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const directory = path.resolve(options.destination ?? path.join(paths.backupsDir, timestamp));
  if (fs.existsSync(directory)) throw new Error(`backup destination already exists: ${directory}`);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  // Ensure WAL changes are in the main DB before taking a byte-for-byte copy.
  try { db.pragma("wal_checkpoint(TRUNCATE)"); } catch { /* read-only/alternative drivers may not support this */ }
  const dbTarget = path.join(directory, "db", "northstar.sqlite");
  fs.mkdirSync(path.dirname(dbTarget), { recursive: true, mode: 0o700 });
  fs.copyFileSync(paths.dbPath, dbTarget);
  if (options.includeAttachments !== false) copyTree(paths.attachmentsDir, path.join(directory, "attachments"));
  const files = filesUnder(directory).filter((file) => file !== "manifest.json").sort().map((file) => {
    const full = path.join(directory, file);
    return { path: file, size: fs.statSync(full).size, sha256: sha256(full) };
  });
  const manifest: BackupManifest = { schema_version: SCHEMA_VERSION, created_at: new Date().toISOString(), files };
  fs.writeFileSync(path.join(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  return { directory, manifest };
}

export function readBackupManifest(directory: string): BackupManifest {
  const manifestPath = path.join(path.resolve(directory), "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new Error("backup manifest.json is missing");
  const value: unknown = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!value || typeof value !== "object" || !Array.isArray((value as { files?: unknown }).files)) throw new Error("invalid backup manifest");
  const manifest = value as BackupManifest;
  if (String(manifest.schema_version) !== String(SCHEMA_VERSION)) throw new Error(`unsupported backup schema version: ${String(manifest.schema_version)}`);
  for (const file of manifest.files) {
    if (!file || typeof file.path !== "string" || !isSafeRelativePath(file.path)) throw new Error(`unsafe backup manifest path: ${String(file?.path)}`);
    if (typeof file.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(file.sha256)) throw new Error(`invalid backup checksum for: ${file.path}`);
  }
  return manifest;
}

function isSafeRelativePath(value: string): boolean {
  if (!value || path.isAbsolute(value) || value.includes("\\") || value.includes("\0")) return false;
  const normalized = path.posix.normalize(value);
  if (normalized === "." || normalized.startsWith("../") || normalized.includes("/../") || normalized === "..") return false;
  return path.resolve("/backup-root", normalized).startsWith("/backup-root/");
}

export function verifyBackup(directory: string): { valid: boolean; manifest: BackupManifest; errors: string[] } {
  const manifest = readBackupManifest(directory);
  const errors: string[] = [];
  for (const file of manifest.files) {
    const fullPath = path.join(path.resolve(directory), file.path);
    if (!fs.existsSync(fullPath)) { errors.push(`missing file: ${file.path}`); continue; }
    const stat = fs.statSync(fullPath);
    if (stat.size !== file.size) errors.push(`size mismatch: ${file.path}`);
    if (sha256(fullPath) !== file.sha256) errors.push(`checksum mismatch: ${file.path}`);
  }
  return { valid: errors.length === 0, manifest, errors };
}

export interface RestoreOptions { paths?: DataPaths; overwrite?: boolean; }

export function restoreBackup(directory: string, options: RestoreOptions = {}): DataPaths {
  const verification = verifyBackup(directory);
  if (!verification.valid) throw new Error(`backup verification failed: ${verification.errors.join("; ")}`);
  const paths = options.paths ?? resolveDataPaths();
  ensureDataDirs(paths);
  const backupDb = path.join(path.resolve(directory), "db", "northstar.sqlite");
  if (!fs.existsSync(backupDb)) throw new Error("backup database is missing");
  if (fs.existsSync(paths.dbPath) && !options.overwrite) throw new Error(`target database exists: ${paths.dbPath}; pass overwrite`);
  for (const sidecar of [`${paths.dbPath}-wal`, `${paths.dbPath}-shm`]) {
    if (fs.existsSync(sidecar)) fs.rmSync(sidecar, { force: true });
  }
  fs.copyFileSync(backupDb, paths.dbPath);
  if (fs.existsSync(path.join(path.resolve(directory), "attachments"))) copyTree(path.join(path.resolve(directory), "attachments"), paths.attachmentsDir);
  return paths;
}

export const backupDatabase = createBackup;
