import { ipcMain, dialog, BrowserWindow } from "electron";
import { copyFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { validateClinicBackup } from "./backup-service.js";

export function registerHandlers(store, admin, backups, authSession) {
  let session = null;
  let account = null;
  const adminFingerprint = () => admin.fingerprint();
  const saved = authSession.load();
  if (saved?.role === "admin" && saved.fingerprint === adminFingerprint()) {
    session = { role: "admin" };
    account = { role: "admin" };
  } else if (saved?.role === "clinic") {
    const clinic = store.clinicSession(
      saved.clinicId,
      saved.passwordHash,
      saved.userId ?? null,
    );
    if (clinic) {
      session = { role: "clinic", clinicId: clinic.id, userId: clinic.userId };
      account = { ...clinic, role: "clinic" };
    }
  }
  if (saved && !session) authSession.clear();
  const requireAdmin = () => {
    if (session?.role !== "admin") throw new Error("Admin login is required.");
  };
  const clinicId = () => {
    if (session?.role !== "clinic")
      throw new Error("Clinic login is required.");
    if (session.userId != null && !store.clinicPasswordHash(session.clinicId, session.userId))
      throw new Error("This doctor login is no longer active. Sign in again.");
    return session.clinicId;
  };
  const requireOwner = () => {
    clinicId();
    if (session.userId != null)
      throw new Error("Only the clinic owner can create doctor logins.");
  };

  ipcMain.handle("clinic:bootstrap", () => ({
    adminConfigured: admin.configured(),
    account,
  }));
  ipcMain.handle("clinic:admin:setup", (_event, input) => {
    const result = admin.setup(input);
    session = { role: "admin" };
    account = { role: "admin" };
    authSession.save({ role: "admin", fingerprint: adminFingerprint() });
    return { ...result, account };
  });
  ipcMain.handle("clinic:admin:accounts", () => {
    requireAdmin();
    return store.listClinicAccounts();
  });
  ipcMain.handle("clinic:admin:create", (_event, input) => {
    requireAdmin();
    if (
      String(input?.username ?? "")
        .trim()
        .toLowerCase() === admin.username().toLowerCase()
    ) {
      throw new Error("This username is reserved for the admin account.");
    }
    const created = store.createClinicAccount({
      fixedStationery: true,
      username: input?.username,
      password: input?.password,
    });
    const backupWarning = backups.automaticBackup();
    return backupWarning ? { ...created, backupWarning } : created;
  });
  ipcMain.handle("clinic:admin:update", (_event, id, input) => {
    requireAdmin();
    if (
      String(input?.username ?? "")
        .trim()
        .toLowerCase() === admin.username().toLowerCase()
    ) {
      throw new Error("This username is reserved for the admin account.");
    }
    const existing = store
      .listClinicAccounts()
      .find((item) => item.id === Number(id));
    if (!existing) throw new Error("Clinic account not found.");
    const updated = store.updateClinicAccount(id, {
      ...existing,
      username: input?.username,
      password: input?.password,
    });
    const backupWarning = backups.automaticBackup();
    return backupWarning ? { ...updated, backupWarning } : updated;
  });
  ipcMain.handle("clinic:admin:apply-stationery", (_event, id) => {
    requireAdmin();
    const updated = store.applyFixedStationery(id);
    const backupWarning = backups.automaticBackup();
    return backupWarning ? { ...updated, backupWarning } : updated;
  });
  ipcMain.handle("clinic:login", (_event, username, password) => {
    if (
      admin.configured() &&
      String(username ?? "")
        .trim()
        .toLowerCase() === admin.username().toLowerCase()
    ) {
      if (!admin.verify(username, password)) {
        throw new Error("Incorrect username or password.");
      }
      session = { role: "admin" };
      account = { role: "admin" };
      authSession.save({ role: "admin", fingerprint: adminFingerprint() });
      return account;
    }
    const clinicAccount = store.clinicLogin(username, password);
    if (!clinicAccount) throw new Error("Incorrect username or password.");
    session = {
      role: "clinic",
      clinicId: clinicAccount.id,
      userId: clinicAccount.userId,
    };
    authSession.save({
      role: "clinic",
      clinicId: clinicAccount.id,
      userId: clinicAccount.userId,
      passwordHash: store.clinicPasswordHash(
        clinicAccount.id,
        clinicAccount.userId,
      ),
    });
    account = { ...clinicAccount, role: "clinic" };
    return account;
  });
  ipcMain.handle("clinic:logout", () => {
    session = null;
    account = null;
    authSession.clear();
    return true;
  });
  ipcMain.handle("clinic:profile:update", (_event, input) => {
    const updated = store.updateClinicProfile(
      clinicId(),
      input,
      session.userId,
    );
    account = { ...updated, role: "clinic" };
    const backupWarning = backups.automaticBackup();
    return backupWarning ? { ...account, backupWarning } : account;
  });
  ipcMain.handle("clinic:doctors", () => {
    requireOwner();
    return store.listDoctorAccounts(clinicId());
  });
  ipcMain.handle("clinic:doctor:create", (_event, input) => {
    requireOwner();
    if (
      String(input?.username ?? "")
        .trim()
        .toLowerCase() === admin.username().toLowerCase()
    )
      throw new Error("This username is reserved for the admin account.");
    const doctor = store.createDoctorAccount(clinicId(), input);
    const backupWarning = backups.automaticBackup();
    return backupWarning ? { ...doctor, backupWarning } : doctor;
  });
  ipcMain.handle("clinic:doctor:deactivate", (_event, userId) => {
    requireOwner();
    const result = store.deactivateDoctorAccount(clinicId(), userId);
    return { ...result, backupWarning: backups.automaticBackup() };
  });
  ipcMain.handle("clinic:doctor:password", (_event, input) => {
    const id = clinicId();
    store.changeDoctorPassword(
      id,
      session.userId,
      input?.currentPassword,
      input?.newPassword,
    );
    authSession.save({
      role: "clinic",
      clinicId: id,
      userId: session.userId,
      passwordHash: store.clinicPasswordHash(id, session.userId),
    });
    return { changed: true, backupWarning: backups.automaticBackup() };
  });
  ipcMain.handle("clinic:backup:settings", () => {
    requireOwner();
    return backups.backupStatus();
  });
  ipcMain.handle("clinic:backup:choose-folder", async (event) => {
    requireOwner();
    const window = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(window, {
      title: "Choose an automatic backup folder",
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return backups.setExternalFolder(result.filePaths[0]);
  });
  ipcMain.handle("clinic:backup:use-default", () => {
    requireOwner();
    return backups.setExternalFolder(null);
  });
  ipcMain.handle("clinic:backup:create", () => {
    requireOwner();
    return backups.createBackup();
  });
  ipcMain.handle("clinic:backup:choose-upload", async (event) => {
    requireOwner();
    const window = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(window, {
      title: "Choose a Clinic Desk backup file",
      properties: ["openFile"],
      filters: [{ name: "SQLite backup", extensions: ["sqlite"] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const path = result.filePaths[0];
    validateClinicBackup(path);
    return path;
  });
  ipcMain.handle("clinic:backup:restore-upload", (_event, input) => {
    requireOwner();
    if (!admin.verify(input?.adminUsername, input?.adminPassword))
      throw new Error("Incorrect admin username or password.");
    const result = backups.restoreFrom(input?.path);
    session = null;
    account = null;
    authSession.clear();
    return result;
  });
  ipcMain.handle("clinic:summary", () => store.summary(clinicId()));
  ipcMain.handle("clinic:patients", (_event, search, module) =>
    store.listPatients(clinicId(), search, module),
  );
  ipcMain.handle("clinic:patient:create", (_event, input) => {
    const patient = store.createPatient(clinicId(), input);
    const backupWarning = backups.automaticBackup();
    return backupWarning ? { ...patient, backupWarning } : patient;
  });
  ipcMain.handle("clinic:patient:get", (_event, id) =>
    store.getPatient(clinicId(), id),
  );
  ipcMain.handle("clinic:case:start", (_event, patientId, module) => {
    const encounter = store.startCase(clinicId(), patientId, module, session.userId);
    const backupWarning = backups.automaticBackup();
    return backupWarning ? { ...encounter, backupWarning } : encounter;
  });
  ipcMain.handle("clinic:cases", (_event, module) =>
    store.listCases(clinicId(), module),
  );
  ipcMain.handle("clinic:encounter:get", (_event, id) =>
    store.getEncounter(clinicId(), id),
  );
  ipcMain.handle("clinic:encounter:save", (_event, input) => {
    const saved = store.saveEncounter(clinicId(), input, session.userId);
    const backupWarning = backups.automaticBackup();
    return backupWarning ? { ...saved, backupWarning } : saved;
  });
  ipcMain.handle("clinic:encounter:amendments", (_event, id) =>
    store.listAmendments(clinicId(), id),
  );
  ipcMain.handle("clinic:encounter:events", (_event, id) =>
    store.listCaseEvents(clinicId(), id),
  );
  ipcMain.handle("clinic:templates", (_event, type) =>
    store.listTemplates(clinicId(), type),
  );
  ipcMain.handle("clinic:template:save", (_event, input) => {
    const saved = store.saveTemplate(clinicId(), input);
    const backupWarning = backups.automaticBackup();
    return backupWarning ? { ...saved, backupWarning } : saved;
  });
  ipcMain.handle("clinic:template:delete", (_event, id) => {
    store.deleteTemplate(clinicId(), id);
    return { deleted: true, backupWarning: backups.automaticBackup() };
  });
  ipcMain.handle("clinic:admin:backup-status", () => {
    requireAdmin();
    return backups.backupStatus();
  });
  ipcMain.handle("clinic:admin:export-backup", async (event) => {
    requireAdmin();
    const window = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(window, {
      title: "Export clinic database backup",
      defaultPath: `clinic-backup-${new Date().toISOString().slice(0, 10)}.sqlite`,
      filters: [{ name: "SQLite backup", extensions: ["sqlite"] }],
    });
    if (result.canceled || !result.filePath) return null;
    const destination = resolve(result.filePath);
    const managed = resolve(backups.dataDir);
    if (destination === managed || destination.startsWith(managed + sep))
      throw new Error(
        "Choose a location outside the application's data folder.",
      );
    const snapshot = backups.createBackup();
    copyFileSync(snapshot.path, destination);
    return destination;
  });
  ipcMain.handle("clinic:admin:choose-restore", async (event) => {
    requireAdmin();
    const window = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(window, {
      title: "Choose a Clinic Desk backup to restore",
      properties: ["openFile"],
      filters: [{ name: "SQLite backup", extensions: ["sqlite"] }],
    });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle("clinic:admin:restore-backup", (_event, path) => {
    requireAdmin();
    const result = backups.restoreFrom(path);
    session = null;
    account = null;
    authSession.clear();
    return result;
  });
}
