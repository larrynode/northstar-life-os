import { NextResponse } from "next/server";
import { listRecords } from "@/lib/db/records";
import { withDatabase } from "../_db";

/** Browser export intentionally contains only ordinary records; vault ciphertext has a separate boundary. */
export async function GET() {
  try {
    const payload = withDatabase((db) => ({ schema_version: 1, exported_at: new Date().toISOString(), timezone: "Asia/Shanghai", week_starts_on: 1, currency: "CNY", records: listRecords(db, { archived: false, limit: 1000 }).filter((record) => record.type !== "private_vault") }));
    return new NextResponse(`${JSON.stringify(payload, null, 2)}\n`, { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="northstar-backup.json"`, "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "backup unavailable" }, { status: 503 });
  }
}
