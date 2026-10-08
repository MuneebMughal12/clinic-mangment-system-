import { app, BrowserWindow, session } from "electron";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { openStore } from "../backend/store.js";
import { registerHandlers } from "./ipc.js";
import { createAuthSession } from "./auth-session.js";
import { createBackupService } from "./backup-service.js";
import { createAdminCredentials } from "./admin-credentials.js";
import { startUpdateChecks } from "./update-service.js";

const here = dirname(fileURLToPath(import.meta.url));
const windowIcon = app.isPackaged
  ? join(process.resourcesPath, "app-icon.ico")
  : join(here, "../../build/icon.ico");
const testDataDir = !app.isPackaged && process.env.CLINIC_DESK_TEST_DATA_DIR;
app.setName("clinic-desk");
const dataDir = testDataDir || join(app.getPath("appData"), "clinic-desk");
mkdirSync(dataDir, { recursive: true });
app.setPath("userData", dataDir);
const browserDataDir = join(dataDir, "browser-session-v2");
mkdirSync(browserDataDir, { recursive: true });
app.setPath("sessionData", browserDataDir);
app.commandLine.appendSwitch("disable-http-cache");

let mainWindow;
let openingWindow;
let store;
const startupStartedAt = Date.now();
const storeProxy = new Proxy({}, { get: (_target, key) => store[key] });
const backups = createBackupService(dataDir, () => store, (next) => { store = next; });

function showOpeningWindow() {
  if (openingWindow && !openingWindow.isDestroyed()) return;
  openingWindow = new BrowserWindow({
    icon: windowIcon,
    width: 460,
    height: 260,
    resizable: false,
    minimizable: false,
    frame: false,
    backgroundColor: "#0F172A",
    title: "Opening Clinic Desk",
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  openingWindow.loadURL(`data:text/html,${encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#0F172A;color:#fff;font:15px Arial,sans-serif;display:grid;place-items:center;height:100vh}.box{text-align:center}h1{font-size:24px;margin:0 0 12px}p{color:#93c5fd;margin:0}</style></head><body><div class="box"><h1>Clinic Desk</h1><p>Opening your workspace…</p></div></body></html>`)}`);
}

function finishOpening() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  if (openingWindow && !openingWindow.isDestroyed()) openingWindow.close();
  openingWindow = null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    icon: windowIcon,
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#F1F5F9",
    title: "Clinic Desk",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(here, "../preload/index.mjs"),
      session: session.fromPartition("clinic-window", { cache: false }),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  const window = mainWindow;

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  const rendererFile = join(here, "../renderer/index.html");
  let attempt = 0;
  let loadTimer;
  let finished = false;
  let crashCount = 0;
  let backupScheduled = false;
  const maxAttempts = 3;

  function scheduleDailyBackup() {
    if (backupScheduled) return;
    backupScheduled = true;
    setTimeout(() => backups.ensureDailyBackup(), 1500);
  }

  function loadRenderer() {
    const currentAttempt = ++attempt;
    const timeout = new Promise((_, reject) => {
      loadTimer = setTimeout(() => {
        if (!window.isDestroyed()) window.webContents.stop();
        reject(new Error("Renderer load timed out"));
      }, 12000);
    });
    const load = rendererUrl
      ? window.loadURL(rendererUrl)
      : window.loadFile(rendererFile);
    Promise.race([load, timeout]).then(() => {
      if (currentAttempt !== attempt || window.isDestroyed()) return;
      clearTimeout(loadTimer);
      finished = true;
      finishOpening();
      console.info(`Clinic Desk ready in ${Date.now() - startupStartedAt} ms`);
      scheduleDailyBackup();
    }).catch((error) => {
      if (currentAttempt !== attempt || window.isDestroyed()) return;
      clearTimeout(loadTimer);
      console.error(`Clinic Desk renderer load ${currentAttempt}/${maxAttempts} failed:`, error);
      if (currentAttempt < maxAttempts) {
        setTimeout(loadRenderer, 750 * currentAttempt);
      } else {
        const message = rendererUrl
          ? "The local development server did not respond. Restart npm run dev."
          : "The app screen could not load. Please restart Clinic Desk.";
        window.loadURL(`data:text/html,${encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"><style>body{font:16px Arial,sans-serif;background:#0F172A;color:#fff;display:grid;place-items:center;height:100vh;margin:0}.box{max-width:480px;text-align:center}p{color:#93c5fd;line-height:1.5}</style></head><body><div class="box"><h1>Clinic Desk could not open</h1><p>${message}</p></div></body></html>`)}`).then(finishOpening).catch((loadError) => {
          console.error("Clinic Desk error screen failed to load:", loadError);
          finishOpening();
        });
      }
    });
  }

  window.webContents.on("render-process-gone", (_event, details) => {
    console.error("Clinic Desk renderer stopped:", details.reason);
    if (!finished || window.isDestroyed()) return;
    if (++crashCount > 2) {
      app.quit();
      return;
    }
    finished = false;
    window.hide();
    showOpeningWindow();
    attempt = 0;
    loadRenderer();
  });
  window.on("closed", () => {
    clearTimeout(loadTimer);
    if (mainWindow === window) mainWindow = null;
  });
  loadRenderer();
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.focus();
  });
  app.whenReady().then(() => {
    showOpeningWindow();
    const envPath = app.isPackaged
      ? join(app.getPath("userData"), ".env")
      : join(here, "../../.env");
    loadEnv({ path: envPath, quiet: true, override: true });
    mkdirSync(dataDir, { recursive: true });
    store = openStore(join(dataDir, "clinic.sqlite"));
    const dailyBackupTimer = setInterval(() => backups.ensureDailyBackup(), 60 * 60 * 1000);
    dailyBackupTimer.unref();
    registerHandlers(
      storeProxy,
      createAdminCredentials(dataDir, {
        username: process.env.CLINIC_ADMIN_USERNAME,
        password: process.env.CLINIC_ADMIN_PASSWORD,
      }),
      backups,
      createAuthSession(dataDir),
    );
    createWindow();
    startUpdateChecks();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  store?.close();
});
