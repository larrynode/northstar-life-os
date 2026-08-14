import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { createRecord, listActivity, listLinks, listRecords, listTags, parseObject } from "./db/records";
import type { ImportFormat, ImportPreview, ImportResult, ImportRow, NorthstarRecord } from "./types";
import { SCHEMA_VERSION } from "./types";

export interface ImportOptions { format?: ImportFormat; sourceName?: string; }

function detectFormat(sourceName = ""): ImportFormat {
  const ext = path.extname(sourceName).toLowerCase();
  if (ext === ".csv") return "csv";
  if (ext === ".ics" || ext === ".ical") return "ics";
  return "json";
}

function sourceText(source: string | Buffer): string { return Buffer.isBuffer(source) ? source.toString("utf8") : source; }

function normalizeRow(value: unknown): { row?: ImportRow; error?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "row must be an object" };
  const source = value as Record<string, unknown>;
  const type = String(source.type ?? source.kind ?? source.entityType ?? "inbox").trim();
  if (!type) return { error: "type is required" };
  if (type === "private_vault") return { error: "private vault content cannot be imported as an ordinary record" };
  const known = new Set(["id", "type", "kind", "entityType", "title", "name", "status", "data", "data_json", "dueAt", "due_at", "startAt", "start_at", "endAt", "end_at", "tags", "tag"]);
  let data: Record<string, unknown> = {};
  if (source.data && typeof source.data === "object" && !Array.isArray(source.data)) data = { ...(source.data as Record<string, unknown>) };
  else if (typeof source.data_json === "string") data = parseObject(source.data_json);
  for (const [key, value] of Object.entries(source)) if (!known.has(key)) data[key] = value;
  const tags = source.tags ?? source.tag;
  const parsedTags = Array.isArray(tags) ? tags.map(String).filter(Boolean) : typeof tags === "string" ? tags.split(/[;,]/).map((tag) => tag.trim()).filter(Boolean) : [];
  const title = source.title ?? source.name;
  return { row: { id: source.id == null ? undefined : String(source.id), type, title: title == null ? null : String(title), status: source.status == null ? null : String(source.status), data, dueAt: source.dueAt == null ? (source.due_at == null ? null : String(source.due_at)) : String(source.dueAt), startAt: source.startAt == null ? (source.start_at == null ? null : String(source.start_at)) : String(source.startAt), endAt: source.endAt == null ? (source.end_at == null ? null : String(source.end_at)) : String(source.endAt), tags: parsedTags, source } };
}

function parseJsonRows(text: string): unknown[] {
  const parsed: unknown = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const object = parsed as Record<string, unknown>;
    for (const key of ["records", "items", "data", "events"]) if (Array.isArray(object[key])) return object[key] as unknown[];
    return [parsed];
  }
  throw new Error("JSON import must contain an object or array");
}

/** RFC-4180-ish CSV parser supporting quoted commas, escaped quotes and newlines. */
function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift()!.map((header) => header.trim());
  return rows.filter((entry) => entry.some((value) => value !== "")).map((entry) => Object.fromEntries(headers.map((header, index) => [header, entry[index] ?? ""])));
}

function icsDate(value: string | undefined): string | null {
  if (!value) return null;
  const clean = value.replace(/^.*:/, "").trim();
  if (/^\d{8}T\d{6}Z$/.test(clean)) {
    const date = new Date(`${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}Z`);
    return date.toISOString();
  }
  if (/^\d{8}T\d{6}$/.test(clean)) {
    const date = new Date(`${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}Z`);
    return date.toISOString();
  }
  if (/^\d{8}$/.test(clean)) return new Date(`${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T00:00:00.000Z`).toISOString();
  return null;
}

function parseIcs(text: string): unknown[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const events: Array<Record<string, unknown>> = [];
  let event: Record<string, unknown> | null = null;
  for (const line of unfolded) {
    if (line.toUpperCase() === "BEGIN:VEVENT") { event = {}; continue; }
    if (line.toUpperCase() === "END:VEVENT") { if (event) events.push(event); event = null; continue; }
    if (!event) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const property = line.slice(0, separator).split(";")[0].toUpperCase();
    const value = line.slice(separator + 1).replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";");
    if (property === "UID") event.id = value;
    else if (property === "SUMMARY") event.title = value;
    else if (property === "DESCRIPTION") event.description = value;
    else if (property === "DTSTART") event.startAt = icsDate(line.slice(separator + 1));
    else if (property === "DTEND") event.endAt = icsDate(line.slice(separator + 1));
    else if (property === "LOCATION") event.location = value;
  }
  return events.map((event) => ({ ...event, type: "event", data: { description: event.description, location: event.location } }));
}

export function parseImport(source: string | Buffer, options: ImportOptions = {}): ImportPreview {
  const format = options.format ?? detectFormat(options.sourceName);
  const text = sourceText(source);
  let raw: unknown[];
  try {
    raw = format === "json" ? parseJsonRows(text) : format === "csv" ? parseCsv(text) : parseIcs(text);
  } catch (error) {
    return { format, total: 0, valid: 0, invalid: 1, duplicates: 0, rows: [], errors: [{ index: 0, message: error instanceof Error ? error.message : String(error) }] };
  }
  const rows: ImportRow[] = [];
  const errors: Array<{ index: number; message: string }> = [];
  raw.forEach((item, index) => {
    const result = normalizeRow(item);
    if (result.row) rows.push(result.row); else errors.push({ index, message: result.error ?? "invalid row" });
  });
  return { format, total: raw.length, valid: rows.length, invalid: errors.length, duplicates: 0, rows, errors };
}

function fingerprint(row: ImportRow): string {
  // IDs are checked separately; ignoring them here catches duplicate content
  // from sources that do not provide stable IDs (e.g. hand-edited CSV).
  return crypto.createHash("sha256").update(JSON.stringify([row.type, row.title ?? "", row.startAt ?? "", row.endAt ?? "", canonical(row.data), [...(row.tags ?? [])].sort()])).digest("hex");
}

function existingFingerprint(record: NorthstarRecord): string {
  return crypto.createHash("sha256").update(JSON.stringify([record.type, record.title ?? "", record.startAt ?? "", record.endAt ?? "", canonical(record.data), [...record.tags].sort()])).digest("hex");
}

function canonical(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return JSON.stringify(value ?? null);
  return JSON.stringify(Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))));
}

export function previewImport(sourceOrDb: string | Buffer | Database.Database, maybeSource?: string | Buffer, options: ImportOptions = {}): ImportPreview {
  // Overload convenience: previewImport(source) or previewImport(db, source).
  if (typeof sourceOrDb === "string" || Buffer.isBuffer(sourceOrDb)) return parseImport(sourceOrDb, options);
  const preview = parseImport(maybeSource ?? "", options);
  const fingerprints = new Set(listRecords(sourceOrDb, { limit: 10000 }).map(existingFingerprint));
  const seen = new Set<string>();
  let duplicates = 0;
  for (const row of preview.rows) {
    const hash = fingerprint(row);
    if (fingerprints.has(hash) || seen.has(hash)) duplicates += 1;
    seen.add(hash);
  }
  return { ...preview, duplicates };
}

export function applyImport(db: Database.Database, source: string | Buffer, options: ImportOptions = {}): ImportResult {
  const preview = previewImport(db, source, options);
  if (preview.invalid) throw new Error(`import contains ${preview.invalid} invalid row(s)`);
  const importId = crypto.randomUUID();
  const checksum = crypto.createHash("sha256").update(sourceText(source)).digest("hex");
  const existingIds = new Set(listRecords(db, { limit: 10000 }).map((record) => record.id));
  const existingHashes = new Set(listRecords(db, { limit: 10000 }).map(existingFingerprint));
  let applied = 0;
  let skipped = 0;
  const apply = db.transaction(() => {
    db.prepare("INSERT INTO imports(id,source_name,source_type,checksum,status,preview_json,stats_json,created_at) VALUES (?, ?, ?, ?, 'applying', ?, ?, ?)").run(importId, options.sourceName ?? null, preview.format, checksum, JSON.stringify(preview), "{}", new Date().toISOString());
    for (const row of preview.rows) {
      const hash = fingerprint(row);
      if ((row.id && existingIds.has(row.id)) || existingHashes.has(hash)) { skipped += 1; continue; }
      createRecord(db, { id: row.id, type: row.type, title: row.title, status: row.status, data: row.data, dueAt: row.dueAt, startAt: row.startAt, endAt: row.endAt, tags: row.tags });
      applied += 1;
      if (row.id) existingIds.add(row.id);
      existingHashes.add(hash);
    }
    db.prepare("UPDATE imports SET status = 'applied', stats_json = ? WHERE id = ?").run(JSON.stringify({ applied, skipped, invalid: 0 }), importId);
  });
  apply();
  return { ...preview, importId, applied, skipped };
}

function csvEscape(value: unknown): string { const text = typeof value === "string" ? value : JSON.stringify(value ?? ""); return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }

export interface ExportOptions { format?: "json" | "csv" | "ics"; }

/** Ordinary export. Vault rows are intentionally never queried or serialized. */
export function exportData(db: Database.Database, options: ExportOptions | "json" | "csv" | "ics" = "json"): string {
  const format = typeof options === "string" ? options : options.format ?? "json";
  const records = listRecords(db, { limit: 10000 });
  if (format === "json") {
    const payload = {
      schema_version: String(SCHEMA_VERSION),
      exported_at: new Date().toISOString(),
      records,
      tags: listTags(db),
      links: listLinks(db),
      activity: listActivity(db, { limit: 10000 }),
      drafts: (db.prepare("SELECT id,operation,entity_type,target_id,payload_json,status,reason,created_at,reviewed_at,applied_at FROM drafts ORDER BY created_at").all() as Array<Record<string, unknown>>).map((row) => ({ ...row, payload: parseObject(String(row.payload_json ?? "{}")), payload_json: undefined })),
    };
    return JSON.stringify(payload, null, 2);
  }
  if (format === "csv") {
    const header = ["id", "type", "title", "status", "dueAt", "startAt", "endAt", "archived", "tags", "data_json"];
    const lines = [header.join(",")];
    for (const record of records) lines.push([record.id, record.type, record.title ?? "", record.status ?? "", record.dueAt ?? "", record.startAt ?? "", record.endAt ?? "", record.archived ? "true" : "false", record.tags.join(";"), JSON.stringify(record.data)].map(csvEscape).join(","));
    return `${lines.join("\n")}\n`;
  }
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Northstar Life OS//EN"];
  for (const record of records.filter((entry) => ["event", "calendar", "appointment"].includes(entry.type))) {
    lines.push("BEGIN:VEVENT", `UID:${record.id}`, `SUMMARY:${String(record.title ?? "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n")}`);
    if (record.startAt) lines.push(`DTSTART:${record.startAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`);
    if (record.endAt) lines.push(`DTEND:${record.endAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export function exportRecords(db: Database.Database, format: "json" | "csv" | "ics" = "json"): string { return exportData(db, format); }

export function readImportFile(filePath: string): { source: Buffer; sourceName: string } {
  return { source: fs.readFileSync(filePath), sourceName: path.basename(filePath) };
}
