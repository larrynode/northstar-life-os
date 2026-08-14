import { NextResponse } from "next/server";
import { listRecords } from "@/lib/db/records";
import { withDatabase } from "../_db";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query) return NextResponse.json({ ok: true, results: [] });
  try {
    const results = withDatabase((db) => listRecords(db, { query, archived: false, limit: 50 })
      // Private ciphertext is deliberately excluded from every ordinary search surface.
      .filter((record) => record.type !== "private_vault")
      .map((record) => ({ title: record.title ?? "未命名记录", type: record.type, copy: String(record.data.copy ?? record.data.project ?? record.status ?? "") })));
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "search unavailable" }, { status: 503 });
  }
}
