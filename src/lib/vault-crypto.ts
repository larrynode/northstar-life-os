export const VAULT_KDF_ITERATIONS = 310_000;

function bufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Derive a non-exportable AES-256 key. Callers must keep the returned key in memory only. */
export async function deriveVaultKey(passphrase: string, salt: Uint8Array, iterations = VAULT_KDF_ITERATIONS): Promise<CryptoKey> {
  if (!passphrase) throw new Error("vault passphrase is required");
  if (salt.byteLength < 16) throw new Error("vault salt must be at least 16 bytes");
  const material = await globalThis.crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return globalThis.crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", iterations, salt: bufferSource(salt) },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptVaultEntry(plaintext: string, key: CryptoKey, iv = globalThis.crypto.getRandomValues(new Uint8Array(12))): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  if (iv.byteLength !== 12) throw new Error("AES-GCM IV must be 12 bytes");
  const encrypted = await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv: bufferSource(iv) }, key, new TextEncoder().encode(plaintext));
  return { ciphertext: new Uint8Array(encrypted), iv: Uint8Array.from(iv) };
}

export async function decryptVaultEntry(ciphertext: Uint8Array, key: CryptoKey, iv: Uint8Array): Promise<string> {
  const decrypted = await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv: bufferSource(iv) }, key, bufferSource(ciphertext));
  return new TextDecoder().decode(decrypted);
}
