import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

/**
 * Drizzle declarations mirror the SQL created by migrate().  The runtime data
 * API intentionally uses a small synchronous adapter so it can be used by the
 * CLI and by server actions without an ORM connection pool.
 */
export const records = sqliteTable(
  "records",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    title: text("title"),
    status: text("status"),
    dataJson: text("data_json").notNull().default("{}"),
    dueAt: text("due_at"),
    startAt: text("start_at"),
    endAt: text("end_at"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({ typeIndex: index("records_type_idx").on(table.type), statusIndex: index("records_status_idx").on(table.status) }),
);

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => ({ nameUnique: uniqueIndex("tags_name_unique").on(table.name) }));

export const recordTags = sqliteTable("record_tags", {
  recordId: text("record_id").notNull().references(() => records.id, { onDelete: "cascade" }),
  tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => ({ recordTagUnique: uniqueIndex("record_tags_unique").on(table.recordId, table.tagId) }));

export const links = sqliteTable("links", {
  id: text("id").primaryKey(),
  fromId: text("from_id").notNull().references(() => records.id, { onDelete: "cascade" }),
  toId: text("to_id").notNull().references(() => records.id, { onDelete: "cascade" }),
  relation: text("relation").notNull(),
  metadataJson: text("metadata_json").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
}, (table) => ({ linkUnique: uniqueIndex("links_unique").on(table.fromId, table.toId, table.relation) }));

export const activity = sqliteTable("activity", {
  id: text("id").primaryKey(),
  recordId: text("record_id").references(() => records.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  contentJson: text("content_json").notNull().default("{}"),
  occurredAt: text("occurred_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => ({ recordIndex: index("activity_record_idx").on(table.recordId), occurredIndex: index("activity_occurred_idx").on(table.occurredAt) }));

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  recordId: text("record_id").references(() => records.id, { onDelete: "set null" }),
  originalName: text("original_name").notNull(),
  storedName: text("stored_name").notNull(),
  mediaType: text("media_type"),
  size: integer("size").notNull(),
  sha256: text("sha256").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => ({ storedNameUnique: uniqueIndex("attachments_stored_name_unique").on(table.storedName), recordIndex: index("attachments_record_idx").on(table.recordId) }));

export const drafts = sqliteTable("drafts", {
  id: text("id").primaryKey(),
  operation: text("operation").notNull(),
  entityType: text("entity_type").notNull(),
  targetId: text("target_id"),
  payloadJson: text("payload_json").notNull().default("{}"),
  status: text("status").notNull().default("pending"),
  reason: text("reason"),
  createdAt: text("created_at").notNull(),
  reviewedAt: text("reviewed_at"),
  appliedAt: text("applied_at"),
});

export const imports = sqliteTable("imports", {
  id: text("id").primaryKey(),
  sourceName: text("source_name"),
  sourceType: text("source_type").notNull(),
  checksum: text("checksum"),
  status: text("status").notNull().default("preview"),
  previewJson: text("preview_json").notNull().default("{}"),
  statsJson: text("stats_json").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull().default("null"),
  updatedAt: text("updated_at").notNull(),
});

/** Vault data is deliberately opaque: ciphertext is the only payload persisted. */
export const vault = sqliteTable("vault", {
  id: text("id").primaryKey(),
  ciphertext: text("ciphertext").notNull(),
  nonce: text("nonce"),
  algorithm: text("algorithm").notNull().default("AES-GCM"),
  updatedAt: text("updated_at").notNull(),
});

export const vaultSettings = sqliteTable("vault_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const schemaMigrations = sqliteTable("schema_migrations", {
  version: integer("version").primaryKey(),
  appliedAt: text("applied_at").notNull(),
});
