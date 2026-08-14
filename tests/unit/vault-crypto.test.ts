import { describe, expect, it } from "vitest";
import { decryptVaultEntry, deriveVaultKey, encryptVaultEntry } from "../../src/lib/vault-crypto";

describe("browser-compatible private vault cryptography", () => {
  it("round-trips AES-256-GCM content with a PBKDF2 key", async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveVaultKey("a long local-only test passphrase", salt, 10_000);
    const encrypted = await encryptVaultEntry("private plaintext that must never reach SQLite", key);
    expect(new TextDecoder().decode(encrypted.ciphertext)).not.toContain("private plaintext");
    await expect(decryptVaultEntry(encrypted.ciphertext, key, encrypted.iv)).resolves.toBe("private plaintext that must never reach SQLite");
  });

  it("rejects a different passphrase", async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const encrypted = await encryptVaultEntry("secret", await deriveVaultKey("correct password", salt, 10_000));
    const wrongKey = await deriveVaultKey("wrong password", salt, 10_000);
    await expect(decryptVaultEntry(encrypted.ciphertext, wrongKey, encrypted.iv)).rejects.toBeDefined();
  });
});
