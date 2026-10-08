import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../backend/store.js";
import { createBackupService, validateClinicBackup } from "../electron/backup-service.js";

test("automatic backup and restore recover records while preserving a pre-restore copy", () => {
  const directory = mkdtempSync(join(tmpdir(), "clinic-backup-service-"));
  let store;
  try {
    store = openStore(join(directory, "clinic.sqlite"));
    const backups = createBackupService(directory, () => store, (next) => { store = next; });
    const clinic = store.createClinicAccount({
      clinicName: "Test Clinic", doctorName: "Dr Test", username: "test-clinic", password: "password-a",
    });
    const original = store.saveEncounter(clinic.id, {
      module: "physician", patient: { name: "Original Patient" },
      details: { diagnosis: "Reviewed" }, finalize: true, reviewConfirmed: true,
    });
    assert.equal(backups.ensureDailyBackup(), null);
    assert.match(backups.backupStatus().path, /daily-\d{4}-\d{2}-\d{2}\.sqlite$/);
    assert.equal(backups.backupStatus().path.endsWith(".sqlite"), true);
    const snapshot = join(directory, "external-backup.sqlite");
    store.backupTo(snapshot);
    assert.equal(validateClinicBackup(snapshot), true);
    store.saveEncounter(clinic.id, {
      module: "ultrasound", patient: { name: "Later Patient" }, details: { impression: "Reviewed" },
    });
    const restored = backups.restoreFrom(snapshot);
    assert.equal(restored.restored, true);
    assert.equal(store.getEncounter(clinic.id, original.id).patient.name, "Original Patient");
    assert.equal(store.listPatients(clinic.id).length, 1);
    const safety = openStore(restored.safetyBackup);
    try {
      assert.equal(safety.listPatients(clinic.id).length, 2);
    } finally {
      safety.close();
    }
  } finally {
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("invalid backup is refused without changing the live database", () => {
  const directory = mkdtempSync(join(tmpdir(), "clinic-backup-invalid-"));
  let store;
  try {
    store = openStore(join(directory, "clinic.sqlite"));
    const clinic = store.createClinicAccount({
      clinicName: "Keep Clinic", doctorName: "Dr Keep", username: "keep-clinic", password: "password-a",
    });
    const backups = createBackupService(directory, () => store, (next) => { store = next; });
    const invalid = join(directory, "invalid.sqlite");
    writeFileSync(invalid, "not a SQLite database");
    assert.throws(() => backups.restoreFrom(invalid), /Invalid clinic backup/);
    assert.equal(store.clinicLogin("keep-clinic", "password-a").id, clinic.id);
    assert.equal(readFileSync(invalid, "utf8"), "not a SQLite database");
  } finally {
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("chosen backup folder receives copies and survives app restart", () => {
  const directory = mkdtempSync(join(tmpdir(), "clinic-backup-folder-"));
  let store;
  try {
    store = openStore(join(directory, "clinic.sqlite"));
    const external = join(directory, "USB drive");
    let backups = createBackupService(directory, () => store, (next) => { store = next; });
    const settings = backups.setExternalFolder(external);
    assert.equal(settings.externalFolder, join(external, "ClinicDesk Backups"));
    assert.equal(readdirSync(settings.externalFolder).some((name) => /^daily-\d{4}-\d{2}-\d{2}\.sqlite$/.test(name)), true);
    const snapshot = backups.createBackup();
    assert.equal(snapshot.error, null);
    assert.equal(existsSync(join(settings.externalFolder, snapshot.path.split(/[\\/]/).at(-1))), true);
    backups = createBackupService(directory, () => store, (next) => { store = next; });
    assert.equal(backups.backupStatus().externalFolder, settings.externalFolder);
    assert.equal(backups.setExternalFolder(null).externalFolder, null);
  } finally {
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
