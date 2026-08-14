import { NextResponse } from "next/server";
import { checkInHabit } from "@/lib/services/habits";
import { withDatabase } from "../../../_db";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({})) as { occurredAt?: unknown };
    let occurredAt = new Date();
    if (body.occurredAt !== undefined) {
      if (typeof body.occurredAt !== "string") return NextResponse.json({ ok: false, error: "occurredAt must be an ISO date string" }, { status: 400 });
      occurredAt = new Date(body.occurredAt);
      if (Number.isNaN(occurredAt.getTime())) return NextResponse.json({ ok: false, error: "occurredAt must be an ISO date string" }, { status: 400 });
    }
    const result = withDatabase((db) => checkInHabit(db, id, occurredAt));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "could not check in habit";
    return NextResponse.json({ ok: false, error: message }, { status: /not found/.test(message) ? 404 : 400 });
  }
}
