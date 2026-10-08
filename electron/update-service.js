import updater from "electron-updater";
import { app, dialog } from "electron";

export function startUpdateChecks() {
  if (!app.isPackaged) return;
  const { autoUpdater } = updater;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("error", (error) => console.error("Update check failed:", error));
  autoUpdater.on("update-downloaded", async (info) => {
    const { response } = await dialog.showMessageBox({
      type: "info",
      title: "Clinic Desk update ready",
      message: `Version ${info.version} has been downloaded. Restart Clinic Desk to install it?`,
      detail: "Your clinic accounts and patient records stay on this computer.",
      buttons: ["Restart now", "Later"],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });
  const check = () => autoUpdater.checkForUpdates().catch((error) => {
    console.error("Update check failed:", error);
  });
  setTimeout(check, 15000).unref();
  setInterval(check, 6 * 60 * 60 * 1000).unref();
}
