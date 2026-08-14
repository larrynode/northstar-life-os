import { NextResponse } from "next/server";
import { getRecord, updateRecord } from "@/lib/db/records";
import { withDatabase } from "../../_db";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json() as { title?: string; status?: string; done?: boolean; data?: Record<string, unknown>; tags?: string[]; dueAt?: string | null; archived?: boolean };
    const record = withDatabase((db) => {
      const current = getRecord(db, id);
      if (!current) return null;
      const data = { ...current.data, ...(body.data ?? {}), ...(body.done !== undefined ? { done: body.done } : {}) };
      const patch: Parameters<typeof updateRecord>[2] = { data };
      if (body.title !== undefined) patch.title = body.title;
      if (body.status !== undefined || body.done !== undefined) patch.status = body.done === true ? "completed" : body.done === false ? "active" : body.status;
      if (body.tags !== undefined) patch.tags = body.tags;
      if (body.dueAt !== undefined) patch.dueAt = body.dueAt;
      if (body.archived !== undefined) patch.archived = body.archived;
      return updateRecord(db, id, patch);
    });
    if (!record) return NextResponse.json({ ok: false, error: "record not found" }, { status: 404 });
    return NextResponse.json({ ok: true, record });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "could not update item" }, { status: 400 });
  }
}
