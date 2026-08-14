import type Database from "better-sqlite3";

/** Version of the on-disk contract.  Keep this value stable once data is released. */
export const SCHEMA_VERSION = 1;
export const SCHEMA_VERSION_STRING = String(SCHEMA_VERSION);

/** Canonical v1 record kinds. The generic record shape keeps new kinds forward-compatible. */
export const RECORD_TYPES = [
  "value", "life_area", "vision", "goal", "key_result",
  "inbox", "project", "venture_experiment", "milestone", "task", "event", "routine", "habit", "habit_log",
  "book", "course", "skill", "learning_note",
  "account", "ledger_entry", "budget", "subscription", "savings_goal", "holding_snapshot",
  "health_metric", "sleep_log", "workout", "mood_log",
  "contact", "interaction", "follow_up",
  "journal", "daily_review", "weekly_review", "monthly_review", "decision", "lesson",
] as const;

export type RecordType = (typeof RECORD_TYPES)[number];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type RecordStatus = "active" | "completed" | "archived" | "cancelled" | "inbox" | string;

export interface NorthstarRecord {
  id: string;
  type: string;
  title: string | null;
  status: string | null;
  data: Record<string, unknown>;
  dueAt: string | null;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  tags: string[];
}

export type DashboardPriority = "高" | "中" | "低";

export interface DashboardMetric {
  id: "open_tasks" | "completed_today" | "active_projects" | "habits_today";
  label: string;
  value: string;
  note: string;
}

export interface DashboardTaskSummary {
  id: string;
  title: string;
  status: string | null;
  done: boolean;
  priority: DashboardPriority;
  projectId: string | null;
  projectName: string;
  dueAt: string | null;
  updatedAt: string;
}

export interface DashboardProjectSummary {
  id: string;
  name: string;
  area: string;
  progress: number;
  totalTasks: number;
  openTasks: number;
  completedTasks: number;
}

export interface DashboardHabitSummary {
  id: string;
  name: string;
  currentStreak: number;
  longestStreak: number;
  completionRate: number;
  completedDates: string[];
  checkedToday: boolean;
}

export interface DashboardEventSummary {
  id: string;
  title: string;
  startAt: string;
  endAt: string | null;
  place: string;
}

export interface DashboardInboxSummary {
  id: string;
  title: string;
  createdAt: string;
}

export interface DashboardReviewSummary {
  id: string;
  title: string;
  copy: string;
  nextStep: string;
  createdAt: string;
}

export interface DashboardSnapshot {
  generatedAt: string;
  timezone: "Asia/Shanghai";
  focus: DashboardMetric[];
  tasks: DashboardTaskSummary[];
  projects: DashboardProjectSummary[];
  habits: DashboardHabitSummary[];
  schedule: DashboardEventSummary[];
  inbox: DashboardInboxSummary[];
  reviews: DashboardReviewSummary[];
}

export interface CreateRecordInput {
  id?: string;
  type: string;
  title?: string | null;
  status?: RecordStatus | null;
  data?: Record<string, unknown>;
  dueAt?: string | Date | null;
  startAt?: string | Date | null;
  endAt?: string | Date | null;
  tags?: string[];
  archived?: boolean;
}

export interface UpdateRecordInput {
  title?: string | null;
  status?: RecordStatus | null;
  data?: Record<string, unknown>;
  dueAt?: string | Date | null;
  startAt?: string | Date | null;
  endAt?: string | Date | null;
  tags?: string[];
  archived?: boolean;
}

export interface ListRecordsOptions {
  type?: string;
  status?: string;
  query?: string;
  archived?: boolean;
  limit?: number;
  offset?: number;
  order?: "asc" | "desc";
}

export interface Tag {
  id: string;
  name: string;
  createdAt: string;
}

export interface Link {
  id: string;
  fromId: string;
  toId: string;
  relation: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Activity {
  id: string;
  recordId: string | null;
  kind: string;
  content: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  recordId: string | null;
  originalName: string;
  storedName: string;
  mediaType: string | null;
  size: number;
  sha256: string;
  createdAt: string;
}

export type DraftStatus = "pending" | "approved" | "rejected" | "applied";

export interface Draft {
  id: string;
  operation: "create" | "update" | "delete" | "link" | "unlink" | string;
  entityType: string;
  targetId: string | null;
  payload: Record<string, unknown>;
  status: DraftStatus;
  reason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  appliedAt: string | null;
}

export interface ImportRow {
  id?: string;
  type: string;
  title?: string | null;
  status?: string | null;
  data?: Record<string, unknown>;
  dueAt?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  tags?: string[];
  /** Original source object, retained for diagnostics but never written to vault. */
  source?: Record<string, unknown>;
}

export type ImportFormat = "json" | "csv" | "ics";

export interface ImportPreview {
  format: ImportFormat;
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  rows: ImportRow[];
  errors: Array<{ index: number; message: string }>;
}

export interface ImportResult extends ImportPreview {
  importId: string;
  applied: number;
  skipped: number;
}

export interface DataPaths {
  root: string;
  dbDir: string;
  dbPath: string;
  attachmentsDir: string;
  backupsDir: string;
}

export interface DatabaseHandle {
  db: Database.Database;
  paths: DataPaths;
  close: () => void;
}

export interface BackupManifestFile {
  path: string;
  size: number;
  sha256: string;
}

export interface BackupManifest {
  schema_version: number | string;
  created_at: string;
  files: BackupManifestFile[];
}

export interface CliSuccess<T = unknown> {
  schema_version: number | string;
  ok: true;
  command: string;
  data: T;
}

export interface CliFailure {
  schema_version: number | string;
  ok: false;
  command?: string;
  error: { code: string; message: string; details?: unknown };
}

export type CliResponse<T = unknown> = CliSuccess<T> | CliFailure;
