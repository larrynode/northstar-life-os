import { NextResponse } from "next/server";
import { buildDashboardSnapshot } from "@/lib/services/overview";
import { withDatabase } from "../_db";

export async function GET() {
  try {
    const snapshot = withDatabase((db) => buildDashboardSnapshot(db));
    return NextResponse.json({ ok: true, snapshot, timezone: "Asia/Shanghai", weekStartsOn: 1, currency: "CNY" });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "overview unavailable" }, { status: 503 });
  }
}
