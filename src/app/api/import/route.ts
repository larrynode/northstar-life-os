import { NextResponse } from "next/server";
import { applyImport, previewImport } from "@/lib/import-export";
import type { ImportPreview, ImportResult } from "@/lib/types";
import { withDatabase } from "../_db";

function summary(preview: ImportPreview | ImportResult) {
  return {
    format: preview.format,
    total: preview.total,
    valid: preview.valid,
    invalid: preview.invalid,
    duplicates: preview.duplicates,
    additions: Math.max(0, preview.valid - preview.duplicates),
    errors: preview.errors,
    rows: preview.rows.slice(0, 50).map((row) => ({ id: row.id ?? null, type: row.type, title: row.title ?? null })),
    ...(Object.prototype.hasOwnProperty.call(preview, "importId") ? {
      importId: (preview as ImportResult).importId,
      applied: (preview as ImportResult).applied,
      skipped: (preview as ImportResult).skipped,
    } : {}),
  };
}

export async function POST(request: Request) {
  const action = new URL(request.url).searchParams.get("action") ?? "preview";
  if (!["preview", "apply"].includes(action)) return NextResponse.json({ ok: false, error: "action must be preview or apply" }, { status: 400 });
  try {
    const body = await request.json() as { sourceName?: unknown; content?: unknown };
    if (typeof body.content !== "string") return NextResponse.json({ ok: false, error: "content must be a JSON string" }, { status: 400 });
    const sourceName = typeof body.sourceName === "string" && body.sourceName.trim() ? body.sourceName.trim() : "web-import.json";
    if (action === "preview") {
      const preview = withDatabase((db) => previewImport(db, body.content as string, { format: "json", sourceName }));
      return NextResponse.json({ ok: true, preview: summary(preview) });
    }
    const result = withDatabase((db) => applyImport(db, body.content as string, { format: "json", sourceName }));
    return NextResponse.json({ ok: true, result: summary(result) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "invalid import" }, { status: 400 });
  }
}
