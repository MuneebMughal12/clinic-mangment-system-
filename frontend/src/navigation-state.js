const key = "clinic-desk-navigation-v1";
const screens = new Set([
  "dashboard", "patients", "patient", "module", "visitForm", "printPreview",
  "templates", "doctorProfile", "doctorAccounts", "changePassword", "backupSettings",
]);
const modules = new Set(["physician", "ultrasound"]);

export const defaultNavigation = {
  screen: "dashboard",
  activeModule: "physician",
  patientFilter: "",
  search: "",
  visitPatientId: null,
  visitCaseId: null,
  selectedPatientId: null,
};

function id(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function restoreNavigation(storage, account) {
  if (account?.role !== "clinic") return { ...defaultNavigation };
  try {
    const saved = JSON.parse(storage.getItem(key));
    if (saved?.clinicId !== account.id || saved.userId !== (account.userId ?? null))
      return { ...defaultNavigation };
    const screen = screens.has(saved.screen) ? saved.screen : "dashboard";
    const route = {
      screen: ["doctorAccounts", "backupSettings"].includes(screen) && !account.isOwner ? "dashboard" : screen,
      activeModule: modules.has(saved.activeModule) ? saved.activeModule : "physician",
      patientFilter: ["", "physician", "ultrasound"].includes(saved.patientFilter) ? saved.patientFilter : "",
      search: typeof saved.search === "string" ? saved.search.slice(0, 100) : "",
      visitPatientId: id(saved.visitPatientId),
      visitCaseId: id(saved.visitCaseId),
      selectedPatientId: id(saved.selectedPatientId),
    };
    if (route.screen === "patient" && !route.selectedPatientId) route.screen = "patients";
    if (route.screen === "printPreview" && !route.visitCaseId) route.screen = "dashboard";
    return route;
  } catch {
    return { ...defaultNavigation };
  }
}

export function saveNavigation(storage, account, route) {
  if (account?.role !== "clinic") return;
  try {
    storage.setItem(key, JSON.stringify({
      clinicId: account.id,
      userId: account.userId ?? null,
      screen: route.screen,
      activeModule: route.activeModule,
      patientFilter: route.patientFilter,
      search: route.search,
      visitPatientId: route.visitPatientId,
      visitCaseId: route.visitCaseId,
      selectedPatientId: route.selectedPatientId,
    }));
  } catch {
    // Navigation remains usable if browser session storage is unavailable.
  }
}

export function clearNavigation(storage) {
  try { storage.removeItem(key); } catch { /* Storage is optional. */ }
}
