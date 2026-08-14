import type Database from "better-sqlite3";

export interface VaultCiphertext { id: string; ciphertext: string; nonce: string | null; algorithm: string; updatedAt: string; }

/** Persist an already encrypted payload; this module never accepts/decrypts plaintext. */
export function setVaultCiphertext(db: Database.Database, value: { ciphertext: string; nonce?: string | null; algorithm?: string; id?: string }): VaultCiphertext {
  if (!value.ciphertext || typeof value.ciphertext !== "string") throw new Error("vault ciphertext is required");
  const id = value.id ?? "default";
  const updatedAt = new Date().toISOString();
  db.prepare(`INSERT INTO vault(id,ciphertext,nonce,algorithm,updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET ciphertext=excluded.ciphertext, nonce=excluded.nonce, algorithm=excluded.algorithm, updated_at=excluded.updated_at`).run(id, value.ciphertext, value.nonce ?? null, value.algorithm ?? "AES-GCM", updatedAt);
  return getVaultCiphertext(db, id)!;
}

export function getVaultCiphertext(db: Database.Database, id = "default"): VaultCiphertext | null {
  const row = db.prepare("SELECT id,ciphertext,nonce,algorithm,updated_at FROM vault WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? { id: String(row.id), ciphertext: String(row.ciphertext), nonce: row.nonce == null ? null : String(row.nonce), algorithm: String(row.algorithm), updatedAt: String(row.updated_at) } : null;
}

export function setVaultSetting(db: Database.Database, key: string, value: string): void {
  if (!key.trim()) throw new Error("vault setting key is required");
  db.prepare(`INSERT INTO vault_settings(key,value,updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).run(key, value, new Date().toISOString());
}

export function getVaultSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare("SELECT value FROM vault_settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}
