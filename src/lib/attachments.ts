import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import type { Attachment, DataPaths } from "./types";
import { ensureDataDirs, resolveDataPaths } from "./paths";

function fileHash(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function mapAttachment(row: Record<string, unknown>): Attachment {
  return {
    id: String(row.id),
    recordId: row.record_id == null ? null : String(row.record_id),
    originalName: String(row.original_name),
    storedName: String(row.stored_name),
    mediaType: row.media_type == null ? null : String(row.media_type),
    size: Number(row.size),
    sha256: String(row.sha256),
    createdAt: String(row.created_at),
  };
}

/** Copy an explicitly selected file into Northstar's owner-only attachment store. */
export function attachFile(
  db: Database.Database,
  sourcePath: string,
  input: { recordId?: string | null; originalName?: string; mediaType?: string | null; paths?: DataPaths } = {},
): Attachment {
  const source = path.resolve(sourcePath);
  const stat = fs.statSync(source);
  if (!stat.isFile()) throw new Error("attachment source must be a file");
  if (input.recordId) {
    const exists = db.prepare("SELECT 1 FROM records WHERE id = ?").get(input.recordId);
    if (!exists) throw new Error(`record not found: ${input.recordId}`);
  }
  const paths = ensureDataDirs(input.paths ?? resolveDataPaths());
  const id = crypto.randomUUID();
  const extension = path.extname(source).slice(0, 16).replace(/[^.a-zA-Z0-9_-]/g, "");
  const storedName = `${id}${extension}`;
  const destination = path.join(paths.attachmentsDir, storedName);
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(destination, 0o600);
  try {
    db.prepare("INSERT INTO attachments(id,record_id,original_name,stored_name,media_type,size,sha256,created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
      id,
      input.recordId ?? null,
      path.basename(input.originalName ?? source),
      storedName,
      input.mediaType ?? null,
      stat.size,
      fileHash(destination),
      new Date().toISOString(),
    );
  } catch (error) {
    fs.rmSync(destination, { force: true });
    throw error;
  }
  return getAttachment(db, id)!;
}

export function getAttachment(db: Database.Database, id: string): Attachment | null {
  const row = db.prepare("SELECT * FROM attachments WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? mapAttachment(row) : null;
}

export function listAttachments(db: Database.Database, recordId?: string): Attachment[] {
  const rows = recordId
    ? db.prepare("SELECT * FROM attachments WHERE record_id = ? ORDER BY created_at DESC").all(recordId)
    : db.prepare("SELECT * FROM attachments ORDER BY created_at DESC").all();
  return (rows as Array<Record<string, unknown>>).map(mapAttachment);
}

export function attachmentPath(attachment: Attachment, paths: DataPaths = resolveDataPaths()): string {
  if (path.basename(attachment.storedName) !== attachment.storedName) throw new Error("unsafe stored attachment name");
  return path.join(paths.attachmentsDir, attachment.storedName);
}
