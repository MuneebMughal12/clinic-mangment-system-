import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("clinic", {
  bootstrap: () => ipcRenderer.invoke("clinic:bootstrap"),
  setupAdmin: (input) => ipcRenderer.invoke("clinic:admin:setup", input),
  accounts: () => ipcRenderer.invoke("clinic:admin:accounts"),
  createAccount: (input) => ipcRenderer.invoke("clinic:admin:create", input),
  updateAccount: (id, input) =>
    ipcRenderer.invoke("clinic:admin:update", id, input),
  applyFixedStationery: (id) => ipcRenderer.invoke("clinic:admin:apply-stationery", id),
  login: (username, password) =>
    ipcRenderer.invoke("clinic:login", username, password),
  logout: () => ipcRenderer.invoke("clinic:logout"),
  updateProfile: (input) => ipcRenderer.invoke("clinic:profile:update", input),
  doctors: () => ipcRenderer.invoke("clinic:doctors"),
  createDoctor: (input) => ipcRenderer.invoke("clinic:doctor:create", input),
  deactivateDoctor: (userId) => ipcRenderer.invoke("clinic:doctor:deactivate", userId),
  changePassword: (input) =>
    ipcRenderer.invoke("clinic:doctor:password", input),
  backupSettings: () => ipcRenderer.invoke("clinic:backup:settings"),
  chooseBackupFolder: () => ipcRenderer.invoke("clinic:backup:choose-folder"),
  useDefaultBackupFolder: () => ipcRenderer.invoke("clinic:backup:use-default"),
  createBackupNow: () => ipcRenderer.invoke("clinic:backup:create"),
  chooseBackupUpload: () => ipcRenderer.invoke("clinic:backup:choose-upload"),
  restoreBackupFromSettings: (input) => ipcRenderer.invoke("clinic:backup:restore-upload", input),
  summary: () => ipcRenderer.invoke("clinic:summary"),
  patients: (search = "", module = "") =>
    ipcRenderer.invoke("clinic:patients", search, module),
  createPatient: (input) => ipcRenderer.invoke("clinic:patient:create", input),
  getPatient: (id) => ipcRenderer.invoke("clinic:patient:get", id),
  startCase: (patientId, module) =>
    ipcRenderer.invoke("clinic:case:start", patientId, module),
  cases: (module) => ipcRenderer.invoke("clinic:cases", module),
  getEncounter: (id) => ipcRenderer.invoke("clinic:encounter:get", id),
  saveEncounter: (input) => ipcRenderer.invoke("clinic:encounter:save", input),
  amendments: (id) => ipcRenderer.invoke("clinic:encounter:amendments", id),
  caseEvents: (id) => ipcRenderer.invoke("clinic:encounter:events", id),
  templates: (type) => ipcRenderer.invoke("clinic:templates", type),
  saveTemplate: (input) => ipcRenderer.invoke("clinic:template:save", input),
  deleteTemplate: (id) => ipcRenderer.invoke("clinic:template:delete", id),
  backupStatus: () => ipcRenderer.invoke("clinic:admin:backup-status"),
  exportBackup: () => ipcRenderer.invoke("clinic:admin:export-backup"),
  chooseRestoreBackup: () => ipcRenderer.invoke("clinic:admin:choose-restore"),
  restoreBackup: (path) => ipcRenderer.invoke("clinic:admin:restore-backup", path),
});
