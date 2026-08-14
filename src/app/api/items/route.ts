import { NextResponse } from "next/server";
import { createRecord, getRecord, listRecords } from "@/lib/db/records";
import type { CreateRecordInput } from "@/lib/types";
import { withDatabase } from "../_db";

const WEB_RECORD_TYPES = new Set(["task", "project", "habit", "event", "inbox", "journal"]);

type WebRecordInput = Partial<CreateRecordInput> & {
  type?: string;
  title?: string;
  priority?: string;
  projectId?: string | null;
  area?: string;
  location?: string;
  copy?: string;
  nextStep?: string;
  done?: boolean;
};

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalIso(value: unknown, field: string): string | null | undefined {
  if (value === null || value === undefined || value === "") return value === null ? null : undefined;
  if (typeof value !== "string") throw new Error(`${field} must be an ISO date string`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${field} must be an ISO date string`);
  return date.toISOString();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? undefined;
  const query = url.searchParams.get("q") ?? undefined;
  try {
    const records = withDatabase((db) => listRecords(db, { type, query, archived: false, limit: 100 }).filter((record) => record.type !== "private_vault"));
    return NextResponse.json({ ok: true, records });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "items unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as WebRecordInput;
    const type = optionalText(body.type);
    const title = optionalText(body.title);
    if (!type || !WEB_RECORD_TYPES.has(type)) return NextResponse.json({ ok: false, error: "unsupported web record type" }, { status: 400 });
    if (!title) return NextResponse.json({ ok: false, error: "title is required" }, { status: 400 });
    const dueAt = optionalIso(body.dueAt, "dueAt");
    const startAt = optionalIso(body.startAt, "startAt");
    const endAt = optionalIso(body.endAt, "endAt");
    if (type === "event" && !startAt) return NextResponse.json({ ok: false, error: "event startAt is required" }, { status: 400 });
    if (type === "event" && startAt && endAt && endAt < startAt) return NextResponse.json({ ok: false, error: "event endAt must not be before startAt" }, { status: 400 });
    if (type === "task" && body.priority !== undefined && !["高", "中", "低"].includes(String(body.priority))) return NextResponse.json({ ok: false, error: "priority must be 高, 中, or 低" }, { status: 400 });

    const record = withDatabase((db) => {
      const projectId = optionalText(body.projectId);
      if (projectId) {
        const project = getRecord(db, projectId);
        if (!project || project.type !== "project") throw new Error(`project not found: ${projectId}`);
      }
      const data: Record<string, unknown> = { ...(body.data ?? {}) };
      if (type === "task") {
        data.priority = body.priority ?? "中";
        if (projectId) data.projectId = projectId;
        if (body.done !== undefined) data.done = body.done;
      } else if (type === "project") {
        data.area = optionalText(body.area) ?? "其他";
      } else if (type === "habit") {
        data.periodDays = 7;
      } else if (type === "event") {
        const location = optionalText(body.location);
        if (location) data.location = location;
      } else if (type === "journal") {
        data.copy = optionalText(body.copy) ?? optionalText(body.data?.copy) ?? "";
        data.nextStep = optionalText(body.nextStep) ?? optionalText(body.data?.nextStep) ?? "";
      }
      return createRecord(db, {
        id: body.id,
        type,
        title,
        status: type === "inbox" ? "inbox" : body.done ? "completed" : body.status ?? "active",
        dueAt: dueAt ?? null,
        startAt: startAt ?? null,
        endAt: endAt ?? null,
        tags: body.tags ?? [],
        data,
      });
    });
    return NextResponse.json({ ok: true, record }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "could not create item" }, { status: 400 });
  }
}
