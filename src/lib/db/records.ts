import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type {
  Activity,
  CreateRecordInput,
  Draft,
  DraftStatus,
  Link,
  ListRecordsOptions,
  NorthstarRecord,
  Tag,
  UpdateRecordInput,
} from "../types";

const now = (): string => new Date().toISOString();
const id = (): string => crypto.randomUUID();

function json<T>(value: T): string {
  return JSON.stringify(value ?? {});
}

function parseObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function dateValue(value: string | Date | null | undefined): string | null {
  if (value == null || value === "") return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRecord(db: Database.Database, row: Record<string, unknown>): NorthstarRecord {
  const tagRows = db.prepare(`SELECT t.name FROM tags t JOIN record_tags rt ON rt.tag_id = t.id WHERE rt.record_id = ? ORDER BY t.name`).all(row.id as string) as Array<{ name: string }>;
  return {
    id: String(row.id),
    type: String(row.type),
    title: row.title == null ? null : String(row.title),
    status: row.status == null ? null : String(row.status),
    data: parseObject(row.data_json as string),
    dueAt: row.due_at == null ? null : String(row.due_at),
    startAt: row.start_at == null ? null : String(row.start_at),
    endAt: row.end_at == null ? null : String(row.end_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    archived: Boolean(row.archived),
    tags: tagRows.map((tag) => tag.name),
  };
}

export function getRecord(db: Database.Database, recordId: string): NorthstarRecord | null {
  const row = db.prepare("SELECT * FROM records WHERE id = ?").get(recordId) as Record<string, unknown> | undefined;
  return row ? mapRecord(db, row) : null;
}

export function listRecords(db: Database.Database, options: ListRecordsOptions = {}): NorthstarRecord[] {
  const where: string[] = [];
  const args: unknown[] = [];
  if (options.type) { where.push("r.type = ?"); args.push(options.type); }
  if (options.status) { where.push("r.status = ?"); args.push(options.status); }
  if (options.archived !== undefined) { where.push("r.archived = ?"); args.push(options.archived ? 1 : 0); }
  if (options.query) {
    where.push("(LOWER(COALESCE(r.title, '')) LIKE LOWER(?) OR LOWER(r.data_json) LIKE LOWER(?))");
    const query = `%${options.query}%`;
    args.push(query, query);
  }
  const order = options.order === "asc" ? "ASC" : "DESC";
  const limit = Math.max(1, Math.min(1000, Math.floor(options.limit ?? 100)));
  const offset = Math.max(0, Math.floor(options.offset ?? 0));
  args.push(limit, offset);
  const rows = db.prepare(`SELECT r.* FROM records r ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY r.updated_at ${order}, r.id ${order} LIMIT ? OFFSET ?`).all(...args) as Array<Record<string, unknown>>;
  return rows.map((row) => mapRecord(db, row));
}

export function countRecords(db: Database.Database, type?: string): number {
  if (type) return Number((db.prepare("SELECT COUNT(*) AS count FROM records WHERE type = ?").get(type) as { count: number }).count);
  return Number((db.prepare("SELECT COUNT(*) AS count FROM records").get() as { count: number }).count);
}

export function createRecord(db: Database.Database, input: CreateRecordInput): NorthstarRecord {
  if (!input.type?.trim()) throw new Error("record type is required");
  const recordId = input.id ?? id();
  const timestamp = now();
  const insert = db.transaction(() => {
    db.prepare(`INSERT INTO records(id,type,title,status,data_json,due_at,start_at,end_at,archived,created_at,updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      recordId,
      input.type.trim(),
      input.title ?? null,
      input.status ?? null,
      json(input.data ?? {}),
      dateValue(input.dueAt),
      dateValue(input.startAt),
      dateValue(input.endAt),
      input.archived ? 1 : 0,
      timestamp,
      timestamp,
    );
    if (input.tags) setRecordTags(db, recordId, input.tags);
  });
  insert();
  return getRecord(db, recordId)!;
}

export function updateRecord(db: Database.Database, recordId: string, input: UpdateRecordInput): NorthstarRecord {
  const current = getRecord(db, recordId);
  if (!current) throw new Error(`record not found: ${recordId}`);
  const columns: string[] = [];
  const args: unknown[] = [];
  if (Object.prototype.hasOwnProperty.call(input, "title")) { columns.push("title = ?"); args.push(input.title ?? null); }
  if (Object.prototype.hasOwnProperty.call(input, "status")) { columns.push("status = ?"); args.push(input.status ?? null); }
  if (Object.prototype.hasOwnProperty.call(input, "data")) { columns.push("data_json = ?"); args.push(json(input.data ?? {})); }
  if (Object.prototype.hasOwnProperty.call(input, "dueAt")) { columns.push("due_at = ?"); args.push(dateValue(input.dueAt)); }
  if (Object.prototype.hasOwnProperty.call(input, "startAt")) { columns.push("start_at = ?"); args.push(dateValue(input.startAt)); }
  if (Object.prototype.hasOwnProperty.call(input, "endAt")) { columns.push("end_at = ?"); args.push(dateValue(input.endAt)); }
  if (Object.prototype.hasOwnProperty.call(input, "archived")) { columns.push("archived = ?"); args.push(input.archived ? 1 : 0); }
  const update = db.transaction(() => {
    if (columns.length) {
      columns.push("updated_at = ?"); args.push(now(), recordId);
      db.prepare(`UPDATE records SET ${columns.join(", ")} WHERE id = ?`).run(...args);
    }
    if (input.tags) setRecordTags(db, recordId, input.tags);
  });
  update();
  return getRecord(db, recordId)!;
}

export function deleteRecord(db: Database.Database, recordId: string): boolean {
  return db.prepare("DELETE FROM records WHERE id = ?").run(recordId).changes > 0;
}

export function ensureTag(db: Database.Database, name: string): Tag {
  const normalized = name.trim().replace(/^#/, "");
  if (!normalized) throw new Error("tag name is required");
  const found = db.prepare("SELECT * FROM tags WHERE name = ? COLLATE NOCASE").get(normalized) as Record<string, unknown> | undefined;
  if (found) return { id: String(found.id), name: String(found.name), createdAt: String(found.created_at) };
  const tagId = id();
  const timestamp = now();
  try {
    db.prepare("INSERT INTO tags(id,name,created_at) VALUES (?, ?, ?)").run(tagId, normalized, timestamp);
  } catch {
    const raced = db.prepare("SELECT * FROM tags WHERE name = ? COLLATE NOCASE").get(normalized) as Record<string, unknown> | undefined;
    if (raced) return { id: String(raced.id), name: String(raced.name), createdAt: String(raced.created_at) };
    throw new Error(`could not create tag: ${normalized}`);
  }
  return { id: tagId, name: normalized, createdAt: timestamp };
}

export function listTags(db: Database.Database): Tag[] {
  const rows = db.prepare("SELECT * FROM tags ORDER BY name COLLATE NOCASE").all() as Array<Record<string, unknown>>;
  return rows.map((row) => ({ id: String(row.id), name: String(row.name), createdAt: String(row.created_at) }));
}

export function setRecordTags(db: Database.Database, recordId: string, names: string[]): string[] {
  db.prepare("DELETE FROM record_tags WHERE record_id = ?").run(recordId);
  const unique = [...new Set(names.map((name) => name.trim().replace(/^#/, "")).filter(Boolean))];
  const insert = db.prepare("INSERT OR IGNORE INTO record_tags(record_id,tag_id) VALUES (?, ?)");
  for (const name of unique) insert.run(recordId, ensureTag(db, name).id);
  return unique;
}

export function createLink(db: Database.Database, fromId: string, toId: string, relation = "related", metadata: Record<string, unknown> = {}): Link {
  if (fromId === toId) throw new Error("a record cannot link to itself");
  if (!getRecord(db, fromId) || !getRecord(db, toId)) throw new Error("both linked records must exist");
  const existing = db.prepare("SELECT * FROM links WHERE from_id = ? AND to_id = ? AND relation = ?").get(fromId, toId, relation) as Record<string, unknown> | undefined;
  if (existing) return mapLink(existing);
  const linkId = id();
  const timestamp = now();
  db.prepare("INSERT INTO links(id,from_id,to_id,relation,metadata_json,created_at) VALUES (?, ?, ?, ?, ?, ?)").run(linkId, fromId, toId, relation, json(metadata), timestamp);
  return { id: linkId, fromId, toId, relation, metadata, createdAt: timestamp };
}

function mapLink(row: Record<string, unknown>): Link {
  return { id: String(row.id), fromId: String(row.from_id), toId: String(row.to_id), relation: String(row.relation), metadata: parseObject(row.metadata_json as string), createdAt: String(row.created_at) };
}

export function listLinks(db: Database.Database, recordId?: string): Link[] {
  const rows = recordId
    ? db.prepare("SELECT * FROM links WHERE from_id = ? OR to_id = ? ORDER BY created_at DESC").all(recordId, recordId)
    : db.prepare("SELECT * FROM links ORDER BY created_at DESC").all();
  return (rows as Array<Record<string, unknown>>).map(mapLink);
}

export function getLinkedRecords(db: Database.Database, recordId: string, relation?: string): NorthstarRecord[] {
  const args: unknown[] = [recordId, recordId];
  const relationClause = relation ? " AND l.relation = ?" : "";
  if (relation) args.push(relation);
  const rows = db.prepare(`SELECT r.* FROM records r JOIN links l ON ((l.from_id = ? AND l.to_id = r.id) OR (l.to_id = ? AND l.from_id = r.id))${relationClause} ORDER BY r.updated_at DESC`).all(...args) as Array<Record<string, unknown>>;
  return rows.map((row) => mapRecord(db, row));
}

export function removeLink(db: Database.Database, linkId: string): boolean {
  return db.prepare("DELETE FROM links WHERE id = ?").run(linkId).changes > 0;
}

export function logActivity(db: Database.Database, input: { recordId?: string | null; kind: string; content?: Record<string, unknown>; occurredAt?: string | Date }): Activity {
  if (!input.kind?.trim()) throw new Error("activity kind is required");
  if (input.recordId && !getRecord(db, input.recordId)) throw new Error(`record not found: ${input.recordId}`);
  const activityId = id();
  const createdAt = now();
  const occurredAt = dateValue(input.occurredAt) ?? createdAt;
  db.prepare("INSERT INTO activity(id,record_id,kind,content_json,occurred_at,created_at) VALUES (?, ?, ?, ?, ?, ?)").run(activityId, input.recordId ?? null, input.kind.trim(), json(input.content ?? {}), occurredAt, createdAt);
  return { id: activityId, recordId: input.recordId ?? null, kind: input.kind.trim(), content: input.content ?? {}, occurredAt, createdAt };
}

export function listActivity(db: Database.Database, options: { recordId?: string; kind?: string; since?: string; until?: string; limit?: number } = {}): Activity[] {
  const where: string[] = [];
  const args: unknown[] = [];
  if (options.recordId) { where.push("record_id = ?"); args.push(options.recordId); }
  if (options.kind) { where.push("kind = ?"); args.push(options.kind); }
  if (options.since) { where.push("occurred_at >= ?"); args.push(dateValue(options.since)); }
  if (options.until) { where.push("occurred_at <= ?"); args.push(dateValue(options.until)); }
  args.push(Math.max(1, Math.min(5000, Math.floor(options.limit ?? 500))));
  const rows = db.prepare(`SELECT * FROM activity ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY occurred_at DESC LIMIT ?`).all(...args) as Array<Record<string, unknown>>;
  return rows.map((row) => ({ id: String(row.id), recordId: row.record_id == null ? null : String(row.record_id), kind: String(row.kind), content: parseObject(row.content_json as string), occurredAt: String(row.occurred_at), createdAt: String(row.created_at) }));
}

export function createDraft(db: Database.Database, input: { operation: Draft["operation"]; entityType: string; targetId?: string | null; payload?: Record<string, unknown>; reason?: string | null }): Draft {
  const draftId = id();
  const createdAt = now();
  db.prepare("INSERT INTO drafts(id,operation,entity_type,target_id,payload_json,status,reason,created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)").run(draftId, input.operation, input.entityType, input.targetId ?? null, json(input.payload ?? {}), input.reason ?? null, createdAt);
  return getDraft(db, draftId)!;
}

export function getDraft(db: Database.Database, draftId: string): Draft | null {
  const row = db.prepare("SELECT * FROM drafts WHERE id = ?").get(draftId) as Record<string, unknown> | undefined;
  return row ? mapDraft(row) : null;
}

function mapDraft(row: Record<string, unknown>): Draft {
  return { id: String(row.id), operation: String(row.operation), entityType: String(row.entity_type), targetId: row.target_id == null ? null : String(row.target_id), payload: parseObject(row.payload_json as string), status: String(row.status) as DraftStatus, reason: row.reason == null ? null : String(row.reason), createdAt: String(row.created_at), reviewedAt: row.reviewed_at == null ? null : String(row.reviewed_at), appliedAt: row.applied_at == null ? null : String(row.applied_at) };
}

export function listDrafts(db: Database.Database, status?: DraftStatus): Draft[] {
  const rows = status ? db.prepare("SELECT * FROM drafts WHERE status = ? ORDER BY created_at DESC").all(status) : db.prepare("SELECT * FROM drafts ORDER BY created_at DESC").all();
  return (rows as Array<Record<string, unknown>>).map(mapDraft);
}

export function reviewDraft(db: Database.Database, draftId: string, decision: "approve" | "reject", reason?: string): Draft {
  const draft = getDraft(db, draftId);
  if (!draft) throw new Error(`draft not found: ${draftId}`);
  if (draft.status !== "pending") throw new Error(`draft is already ${draft.status}`);
  const status: DraftStatus = decision === "approve" ? "approved" : "rejected";
  db.prepare("UPDATE drafts SET status = ?, reason = COALESCE(?, reason), reviewed_at = ? WHERE id = ?").run(status, reason ?? null, now(), draftId);
  return getDraft(db, draftId)!;
}

export function applyDraft(db: Database.Database, draftId: string): NorthstarRecord | Link | null {
  const draft = getDraft(db, draftId);
  if (!draft) throw new Error(`draft not found: ${draftId}`);
  if (draft.status !== "approved") throw new Error(`draft must be approved before applying (currently ${draft.status})`);
  const result = db.transaction(() => {
    let value: NorthstarRecord | Link | null = null;
    if (draft.operation === "create") value = createRecord(db, { id: draft.targetId ?? undefined, type: draft.entityType, ...(draft.payload as Partial<CreateRecordInput>) });
    else if (draft.operation === "update") value = updateRecord(db, draft.targetId ?? "", draft.payload as UpdateRecordInput);
    else if (draft.operation === "delete") { deleteRecord(db, draft.targetId ?? ""); value = null; }
    else if (draft.operation === "link") value = createLink(db, String(draft.payload.fromId ?? draft.targetId), String(draft.payload.toId), String(draft.payload.relation ?? "related"), (draft.payload.metadata as Record<string, unknown>) ?? {});
    else if (draft.operation === "unlink") { if (draft.targetId) removeLink(db, draft.targetId); value = null; }
    else throw new Error(`unsupported draft operation: ${draft.operation}`);
    db.prepare("UPDATE drafts SET status = 'applied', applied_at = ? WHERE id = ?").run(now(), draftId);
    return value;
  });
  return result();
}

export { parseObject };
