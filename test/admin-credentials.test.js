import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAdminCredentials } from "../electron/admin-credentials.js";

test("first-run admin login survives restart without storing the password", () => {
  const dir = mkdtempSync(join(tmpdir(), "clinic-admin-"));
  try {
    const admin = createAdminCredentials(dir);
    assert.equal(admin.configured(), false);
    assert.throws(() => admin.setup({ username: "admin", password: "short" }), /12 characters/);
    admin.setup({ username: "admin", password: "a private passphrase" });
    assert.equal(admin.verify("admin", "a private passphrase"), true);
    assert.equal(admin.verify("admin", "wrong password"), false);
    assert.throws(() => admin.setup({ username: "other", password: "another private passphrase" }), /already configured/);
    assert.doesNotMatch(readFileSync(join(dir, "admin-credentials.json"), "utf8"), /a private passphrase/);
    const reopened = createAdminCredentials(dir);
    assert.equal(reopened.verify("ADMIN", "a private passphrase"), true);
    assert.equal(reopened.fingerprint(), admin.fingerprint());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("existing local .env credentials still work on upgrade", () => {
  const dir = mkdtempSync(join(tmpdir(), "clinic-admin-"));
  try {
    const admin = createAdminCredentials(dir, { username: "old-admin", password: "old-password" });
    assert.equal(admin.configured(), true);
    assert.equal(admin.verify("old-admin", "old-password"), true);
    assert.throws(() => admin.setup({ username: "new-admin", password: "new private password" }), /already configured/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
