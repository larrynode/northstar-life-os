import { NextResponse } from "next/server";
import { getVaultCiphertext, setVaultCiphertext } from "@/lib/vault";
import { withDatabase } from "../_db";

/** The server only receives opaque ciphertext/salt/iv. It never receives a password or plaintext. */
export async function GET() {
  try {
    const stored = withDatabase((db) => getVaultCiphertext(db));
    let ciphertext: unknown = null;
    if (stored?.ciphertext) {
      try { ciphertext = JSON.parse(stored.ciphertext); } catch { ciphertext = null; }
    }
    return NextResponse.json({ ok: true, ciphertext });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "vault unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { ciphertext?: { data?: unknown; salt?: unknown; iv?: unknown } };
    const value = body.ciphertext;
    if (!value || typeof value.data !== "string" || typeof value.salt !== "string" || typeof value.iv !== "string") return NextResponse.json({ ok: false, error: "ciphertext, salt and iv are required" }, { status: 400 });
    const iv = value.iv;
    const stored = withDatabase((db) => setVaultCiphertext(db, { ciphertext: JSON.stringify(value), nonce: iv, algorithm: "AES-256-GCM" }));
    return NextResponse.json({ ok: true, id: stored.id, updatedAt: stored.updatedAt });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "could not save vault" }, { status: 400 });
  }
}
