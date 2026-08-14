#!/usr/bin/env node
import fs from "node:fs";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { createBackup, restoreBackup, verifyBackup } from "../lib/backup";
import { createDatabase } from "../lib/db/client";
import { applyDraft, createDraft, createRecord, getDraft, listDrafts, listRecords, logActivity, reviewDraft } from "../lib/db/records";
import { exportData, applyImport, previewImport, readImportFile } from "../lib/import-export";
import { resolveDataPaths } from "../lib/paths";
import type { DataPathEnv } from "../lib/paths";
import { aggregateReview } from "../lib/services/reviews";
import { getMigrationVersion } from "../lib/db/migrations";
import { SCHEMA_VERSION } from "../lib/types";
import type { CliFailure, CliResponse, CliSuccess, ImportFormat } from "../lib/types";

const VERSION = String(SCHEMA_VERSION);

const USAGE = `Northstar Life OS local CLI

Usage: northstar <command> [options] [--json]

Commands:
  doctor                                  Check data directory and database
  context [today|week]                    Show current context and open work
  list [type] [--status S] [--query Q]    List records
  capture <title> [--type TYPE]           Capture a low-risk inbox item
  log <kind> [text] [--record ID]        Log an activity
  review [daily|weekly|monthly]           Aggregate a review period
  draft create <type> [--title T]         Create a pending generative draft
  draft list [--status STATUS]            List drafts
  draft show <id>                         Show a draft
  draft approve|reject <id>               Review a draft
  draft apply <id>                        Apply an approved draft
  draft discard <id>                      Reject a draft
  import preview|apply <file>             Preview or transactionally import JSON/CSV/ICS
  export json|csv|ics [--output FILE]     Export data (vault is excluded)
  backup create|verify|restore [--path]   Create, verify, or restore a backup

All responses are JSON with schema_version, ok, command, and data or error.`;

interface CliOptions {
  env?: DataPathEnv;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
  db?: ReturnType<typeof createDatabase>;
}

interface ParsedArgs { positionals: string[]; options: Record<string, string | boolean>; }

function parseArgs(args: string[]): ParsedArgs {
  const positionals: string[] = [];
  const options: Record<string, string | boolean> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") { positionals.push(...args.slice(index + 1)); break; }
    if (arg.startsWith("--")) {
      const body = arg.slice(2);
      const equals = body.indexOf("=");
      if (equals >= 0) options[body.slice(0, equals)] = body.slice(equals + 1);
      else if (args[index + 1] && !args[index + 1].startsWith("-")) { options[body] = args[index + 1]; index += 1; }
      else options[body] = true;
    } else positionals.push(arg);
  }
  return { positionals, options };
}

const opt = (options: Record<string, string | boolean>, ...keys: string[]): string | undefined => {
  for (const key of keys) { const value = options[key]; if (typeof value === "string") return value; }
  return undefined;
};

function parseData(value: string | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : { value: parsed };
  } catch { return { text: value }; }
}

function success<T>(command: string, data: T): CliSuccess<T> { return { schema_version: VERSION, ok: true, command, data }; }
function failure(command: string | undefined, code: string, message: string, details?: unknown): CliFailure { return { schema_version: VERSION, ok: false, ...(command ? { command } : {}), error: { code, message, ...(details === undefined ? {} : { details }) } }; }

function printable(value: CliResponse): string { return `${JSON.stringify(value)}\n`; }

export async function executeCli(argv: string[], options: CliOptions = {}): Promise<CliResponse> {
  const parsed = parseArgs(argv.filter((arg) => arg !== "--json"));
  const command = parsed.positionals[0] ?? "help";
  if (["help", "--help", "-h"].includes(command)) return success("help", { usage: USAGE });
  const handle = options.db ?? createDatabase({ paths: resolveDataPaths(options.env ?? process.env) });
  const ownsHandle = !options.db;
  let handleClosed = false;
  try {
    const db = handle.db;
    if (command === "doctor") {
      const paths = handle.paths;
      const counts = db.prepare("SELECT type, COUNT(*) AS count FROM records GROUP BY type ORDER BY type").all() as Array<{ type: string; count: number }>;
      return success(command, { schema_version: VERSION, data_dir: paths.root, db_path: paths.dbPath, attachments_dir: paths.attachmentsDir, backups_dir: paths.backupsDir, migration_version: getMigrationVersion(db), record_count: counts.reduce((sum, row) => sum + Number(row.count), 0), by_type: Object.fromEntries(counts.map((row) => [row.type, Number(row.count)])) });
    }
    if (command === "context") {
      const period = (parsed.positionals[1] as "today" | "week" | undefined) ?? "today";
      const review = aggregateReview(db, period === "week" ? "weekly" : "daily");
      return success(command, { period, review, open: listRecords(db, { archived: false, limit: 100, order: "desc" }) });
    }
    if (command === "list") {
      return success(command, listRecords(db, { type: parsed.positionals[1], status: opt(parsed.options, "status"), query: opt(parsed.options, "query", "q"), limit: opt(parsed.options, "limit") ? Number(opt(parsed.options, "limit")) : 100, archived: parsed.options.archived === true ? true : parsed.options.all ? undefined : false }));
    }
    if (command === "capture") {
      const title = parsed.positionals.slice(1).join(" ").trim() || opt(parsed.options, "title");
      if (!title) return failure(command, "INVALID_ARGUMENT", "capture requires a title");
      const type = opt(parsed.options, "type") ?? "inbox";
      const tags = (opt(parsed.options, "tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
      return success(command, createRecord(db, { type, title, status: "inbox", data: parseData(opt(parsed.options, "data", "text")), tags }));
    }
    if (command === "log") {
      const kind = parsed.positionals[1] ?? opt(parsed.options, "kind") ?? "note";
      const text = parsed.positionals.slice(2).join(" ") || opt(parsed.options, "text", "value", "title");
      const content = parseData(opt(parsed.options, "data"));
      if (text) content.text = text;
      return success(command, logActivity(db, { kind, recordId: opt(parsed.options, "record", "record-id"), content }));
    }
    if (command === "review") {
      const period = (parsed.positionals[1] ?? "daily") as "daily" | "weekly" | "monthly";
      if (!["daily", "weekly", "monthly"].includes(period)) return failure(command, "INVALID_ARGUMENT", "review period must be daily, weekly, or monthly");
      return success(command, aggregateReview(db, period));
    }
    if (command === "draft") {
      const action = parsed.positionals[1] ?? "list";
      if (action === "create") {
        const entityType = parsed.positionals[2] ?? opt(parsed.options, "type") ?? "inbox";
        const operation = (opt(parsed.options, "operation") ?? "create") as "create" | "update" | "delete" | "link" | "unlink";
        const payload = parseData(opt(parsed.options, "data"));
        const title = opt(parsed.options, "title"); if (title) payload.title = title;
        const targetId = opt(parsed.options, "target", "id");
        return success(command, createDraft(db, { operation, entityType, targetId, payload, reason: opt(parsed.options, "reason") }));
      }
      if (action === "list") return success(command, listDrafts(db, opt(parsed.options, "status") as "pending" | "approved" | "rejected" | "applied" | undefined));
      const draftId = parsed.positionals[2] ?? opt(parsed.options, "id");
      if (!draftId) return failure(command, "INVALID_ARGUMENT", `draft ${action} requires an id`);
      if (action === "show") { const draft = getDraft(db, draftId); return draft ? success(command, draft) : failure(command, "NOT_FOUND", `draft not found: ${draftId}`); }
      if (action === "approve" || action === "reject" || action === "discard") return success(command, reviewDraft(db, draftId, action === "approve" ? "approve" : "reject", opt(parsed.options, "reason") ?? (action === "discard" ? "discarded" : undefined)));
      if (action === "apply") return success(command, applyDraft(db, draftId));
      return failure(command, "UNKNOWN_ACTION", `unknown draft action: ${action}`);
    }
    if (command === "import") {
      const action = parsed.positionals[1] ?? "preview";
      const filePath = parsed.positionals[2] ?? opt(parsed.options, "file", "path");
      if (!filePath) return failure(command, "INVALID_ARGUMENT", "import requires a file path");
      const source = readImportFile(filePath);
      const format = opt(parsed.options, "format") as ImportFormat | undefined;
      if (action === "preview") return success(command, previewImport(db, source.source, { format, sourceName: source.sourceName }));
      if (action === "apply") return success(command, applyImport(db, source.source, { format, sourceName: source.sourceName }));
      return failure(command, "UNKNOWN_ACTION", `unknown import action: ${action}`);
    }
    if (command === "export") {
      const format = (parsed.positionals[1] ?? "json") as "json" | "csv" | "ics";
      if (!["json", "csv", "ics"].includes(format)) return failure(command, "INVALID_ARGUMENT", "export format must be json, csv, or ics");
      const content = exportData(db, format);
      const output = opt(parsed.options, "output", "file");
      if (output) fs.writeFileSync(output, content, { mode: 0o600 });
      return success(command, { format, output: output ?? null, content: output ? undefined : content, bytes: Buffer.byteLength(content) });
    }
    if (command === "backup") {
      const action = parsed.positionals[1] ?? "create";
      const target = opt(parsed.options, "path", "output");
      if (action === "create") return success(command, createBackup(db, { paths: handle.paths, destination: target }));
      if (!target) return failure(command, "INVALID_ARGUMENT", `backup ${action} requires --path`);
      if (action === "verify") return success(command, verifyBackup(target));
      if (action === "restore") {
        if (parsed.options.confirm !== true && opt(parsed.options, "confirm") !== "true") return failure(command, "CONFIRMATION_REQUIRED", "backup restore requires --confirm");
        if (ownsHandle) { handle.close(); handleClosed = true; }
        return success(command, { paths: restoreBackup(target, { paths: handle.paths, overwrite: true }) });
      }
      return failure(command, "UNKNOWN_ACTION", `unknown backup action: ${action}`);
    }
    return failure(command, "UNKNOWN_COMMAND", `unknown command: ${command}`, { usage: USAGE });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failure(command, "COMMAND_FAILED", message);
  } finally {
    if (ownsHandle && !handleClosed) handle.close();
  }
}

export async function runCli(argv = process.argv.slice(2), options: CliOptions = {}): Promise<number> {
  const result = await executeCli(argv, options);
  const output = printable(result);
  (result.ok ? (options.stdout ?? console.log) : (options.stderr ?? console.error))(output.trim());
  return result.ok ? 0 : 1;
}

export function isDirectExecution(moduleUrl: string, argvEntry = process.argv[1]): boolean {
  return Boolean(argvEntry) && moduleUrl === pathToFileURL(argvEntry).href;
}

if (isDirectExecution(import.meta.url)) void runCli();

export { USAGE };
