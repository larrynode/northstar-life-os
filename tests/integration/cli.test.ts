import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createBackup, restoreBackup, verifyBackup } from "../../src/lib/backup";
import { createDatabase } from "../../src/lib/db/client";
import { createRecord } from "../../src/lib/db/records";
import { applyImport, exportData, previewImport } from "../../src/lib/import-export";
import { resolveDataPaths } from "../../src/lib/paths";
import { getVaultCiphertext, setVaultCiphertext } from "../../src/lib/vault";
import { executeCli, isDirectExecution } from "../../src/cli/index";

const roots: string[] = [];
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "northstar-cli-"));
  roots.push(root);
  const paths = resolveDataPaths({ NORTHSTAR_DATA_DIR: root });
  return { root, paths, handle: createDatabase({ paths }) };
}
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

describe("CLI and import/backup boundaries", () => {
  it("recognizes a packaged entry point when its filesystem path contains spaces", () => {
    expect(isDirectExecution("file:///tmp/Northstar%20Life%20OS/index.js", "/tmp/Northstar Life OS/index.js")).toBe(true);
  });

  it("returns predictable JSON envelopes and keeps generative writes pending", async () => {
    const fixtureData = fixture();
    const doctor = await executeCli(["doctor", "--json"], { db: fixtureData.handle });
    expect(doctor).toMatchObject({ schema_version: "1", ok: true, command: "doctor" });
    const draft = await executeCli(["draft", "create", "note", "--title", "Idea"], { db: fixtureData.handle });
    expect(draft).toMatchObject({ ok: true, data: { status: "pending" } });
    const apply = await executeCli(["draft", "apply", (draft as { data: { id: string } }).data.id], { db: fixtureData.handle });
    expect(apply).toMatchObject({ ok: false, error: { code: "COMMAND_FAILED" } });
    fixtureData.handle.close();
  });

  it("previews, deduplicates, applies imports and excludes vault from ordinary export", () => {
    const fixtureData = fixture();
    createRecord(fixtureData.handle.db, { type: "note", id: "same", title: "Existing" });
    const source = JSON.stringify([{ id: "same", type: "note", title: "Existing" }, { type: "note", title: "New" }]);
    expect(previewImport(fixtureData.handle.db, source, { format: "json" })).toMatchObject({ total: 2, duplicates: 1 });
    expect(applyImport(fixtureData.handle.db, source, { format: "json" })).toMatchObject({ applied: 1, skipped: 1 });
    setVaultCiphertext(fixtureData.handle.db, { ciphertext: "encrypted-only" });
    expect(getVaultCiphertext(fixtureData.handle.db)?.ciphertext).toBe("encrypted-only");
    const exported = exportData(fixtureData.handle.db, "json");
    expect(exported).not.toContain("encrypted-only");
    expect(exported).not.toContain('"vault"');
    fixtureData.handle.close();
  });

  it("rejects private-vault rows and keeps an invalid import atomic", () => {
    const fixtureData = fixture();
    const source = JSON.stringify([
      { type: "note", title: "Would otherwise be valid" },
      { type: "private_vault", title: "Must never cross the ordinary boundary", data: { ciphertext: "opaque" } },
    ]);
    expect(previewImport(fixtureData.handle.db, source, { format: "json" })).toMatchObject({ total: 2, valid: 1, invalid: 1 });
    expect(() => applyImport(fixtureData.handle.db, source, { format: "json" })).toThrow(/invalid row/);
    expect(fixtureData.handle.db.prepare("SELECT COUNT(*) AS count FROM records").get()).toEqual({ count: 0 });
    fixtureData.handle.close();
  });

  it("verifies manifest checksums and restores a complete backup", () => {
    const fixtureData = fixture();
    createRecord(fixtureData.handle.db, { type: "note", title: "Keep" });
    const backup = createBackup(fixtureData.handle.db, { paths: fixtureData.paths });
    expect(verifyBackup(backup.directory).valid).toBe(true);
    const target = fs.mkdtempSync(path.join(os.tmpdir(), "northstar-restore-"));
    roots.push(target);
    const targetPaths = resolveDataPaths({ NORTHSTAR_DATA_DIR: target });
    restoreBackup(backup.directory, { paths: targetPaths });
    const restored = createDatabase({ paths: targetPaths });
    expect(restored.db.prepare("SELECT COUNT(*) AS count FROM records").get()).toEqual({ count: 1 });
    restored.close();
    fixtureData.handle.close();
  });
});
