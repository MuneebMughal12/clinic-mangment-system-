import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { openStore } from "../backend/store.js";

const requiredTables = ["clinics", "clinic_users", "patients", "cases", "templates"];

function stamp() {
  return `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(3).toString("hex")}`;
}

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function validateClinicBackup(path) {
  let db;
  try {
    db = new DatabaseSync(path, { readOnly: true });
    if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
      throw new Error("Database integrity check failed.");
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name));
    if (requiredTables.some((name) => !tables.has(name)))
      throw new Error("Required clinic tables are missing.");
    const clinicColumns = new Set(db.prepare("PRAGMA table_info(clinics)").all().map((row) => row.name));
    const caseColumns = new Set(db.prepare("PRAGMA table_info(cases)").all().map((row) => row.name));
    if (!["id", "username", "password_hash"].every((name) => clinicColumns.has(name)) ||
        !["id", "patient_id", "module"].every((name) => caseColumns.has(name)))
      throw new Error("Clinic backup has an incompatible schema.");
    if (db.prepare("PRAGMA foreign_key_check").get())
      throw new Error("Clinic backup contains broken record links.");
    return true;
  } catch (error) {
    throw new Error(`Invalid clinic backup: ${error.message}`);
  } finally {
    db?.close();
  }
}

export function createBackupService(dataDir, getStore, setStore) {
  const databasePath = join(dataDir, "clinic.sqlite");
  const backupDir = join(dataDir, "backups");
  const settingsPath = join(dataDir, "backup-settings.json");
  mkdirSync(backupDir, { recursive: true });
  let lastBackup = null;
  let externalFolder = null;
  try {
    const saved = JSON.parse(readFileSync(settingsPath, "utf8"));
    if (typeof saved.folder === "string" && isAbsolute(saved.folder))
      externalFolder = saved.folder;
  } catch { /* The default local backup folder needs no settings file. */ }

  function destinationFolder() {
    return externalFolder ? join(externalFolder, "ClinicDesk Backups") : null;
  }

  function mirror(path) {
    const destination = destinationFolder();
    if (!destination) return;
    mkdirSync(destination, { recursive: true });
    copyFileSync(path, join(destination, basename(path)));
  }

  function prune(folder, prefix, limit) {
    const files = readdirSync(folder).filter((name) => prefix.test(name)).sort().reverse();
    for (const old of files.slice(limit)) unlinkSync(join(folder, old));
  }

  function backupStatus() {
    return { ...lastBackup, localFolder: backupDir, externalFolder: destinationFolder() };
  }

  function createBackup() {
    const createdAt = new Date().toISOString();
    const path = getStore().backupTo(join(backupDir, `clinic-${stamp()}.sqlite`));
    lastBackup = { createdAt, path, error: null };
    prune(backupDir, /^clinic-.*\.sqlite$/, 20);
    try {
      mirror(path);
      if (destinationFolder()) prune(destinationFolder(), /^clinic-.*\.sqlite$/, 20);
    } catch (error) {
      lastBackup.error = `Local backup saved, but selected folder failed: ${error.message}`;
    }
    return backupStatus();
  }

  function automaticBackup() {
    try {
      return createBackup().error;
    } catch (error) {
      lastBackup = { ...lastBackup, error: error.message };
      return error.message;
    }
  }

  function ensureDailyBackup() {
    const dailyPath = join(backupDir, `daily-${localDate()}.sqlite`);
    try {
      if (!existsSync(dailyPath)) getStore().backupTo(dailyPath);
      mirror(dailyPath);
      if (destinationFolder()) prune(destinationFolder(), /^daily-\d{4}-\d{2}-\d{2}\.sqlite$/, 30);
    } catch (error) {
      lastBackup = { ...lastBackup, error: error.message };
      return error.message;
    }
    prune(backupDir, /^daily-\d{4}-\d{2}-\d{2}\.sqlite$/, 30);
    const recentFiles = readdirSync(backupDir).filter((name) => /^clinic-.*\.sqlite$/.test(name));
    const latest = [dailyPath, ...recentFiles.map((name) => join(backupDir, name))]
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
    lastBackup = { createdAt: statSync(latest).mtime.toISOString(), path: latest, error: null };
    return null;
  }

  function restoreFrom(sourcePath) {
    const source = resolve(sourcePath);
    if (source.toLowerCase() === resolve(databasePath).toLowerCase())
      throw new Error("Choose a backup file, not the live database.");
    if (!existsSync(source) || !statSync(source).isFile())
      throw new Error("Backup file was not found.");

    const token = stamp();
    const staged = join(dataDir, `restore-${token}.sqlite`);
    const previous = join(dataDir, `before-restore-${token}.sqlite`);
    let closed = false;
    let moved = false;
    let reopened = false;
    try {
      copyFileSync(source, staged);
      validateClinicBackup(staged);
      const safetyBackup = getStore().backupTo(join(backupDir, `before-restore-${token}.sqlite`));
      mirror(safetyBackup);
      getStore().close();
      closed = true;
      if (existsSync(`${databasePath}-wal`) || existsSync(`${databasePath}-shm`))
        throw new Error("The clinic database is still in use. Close other Clinic Desk windows and try again.");
      renameSync(databasePath, previous);
      moved = true;
      renameSync(staged, databasePath);
      setStore(openStore(databasePath));
      reopened = true;
      try { unlinkSync(previous); } catch { /* The safety backup already exists. */ }
      lastBackup = { createdAt: new Date().toISOString(), path: safetyBackup, error: null };
      return { restored: true, safetyBackup };
    } catch (error) {
      if (moved && !reopened) {
        if (existsSync(databasePath)) unlinkSync(databasePath);
        renameSync(previous, databasePath);
        setStore(openStore(databasePath));
      } else if (closed && !reopened) {
        setStore(openStore(databasePath));
      }
      throw error;
    } finally {
      if (existsSync(staged)) unlinkSync(staged);
    }
  }

  function setExternalFolder(folder) {
    if (folder !== null && (typeof folder !== "string" || !isAbsolute(folder)))
      throw new Error("Choose an absolute backup folder.");
    const previous = externalFolder;
    const next = folder ? resolve(folder) : null;
    if (next) {
      const destination = join(next, "ClinicDesk Backups");
      mkdirSync(destination, { recursive: true });
      const probe = join(destination, `.write-check-${randomBytes(4).toString("hex")}`);
      writeFileSync(probe, "ok");
      unlinkSync(probe);
    }
    externalFolder = next;
    try {
      const pending = `${settingsPath}.tmp`;
      writeFileSync(pending, JSON.stringify({ folder: externalFolder }));
      renameSync(pending, settingsPath);
      if (next) {
        const warning = automaticBackup();
        if (warning) throw new Error(warning);
        const dailyWarning = ensureDailyBackup();
        if (dailyWarning) throw new Error(dailyWarning);
      }
    } catch (error) {
      externalFolder = previous;
      writeFileSync(settingsPath, JSON.stringify({ folder: previous }));
      throw error;
    }
    return backupStatus();
  }

  return {
    createBackup,
    automaticBackup,
    ensureDailyBackup,
    restoreFrom,
    backupStatus,
    setExternalFolder,
    dataDir,
  };
}
