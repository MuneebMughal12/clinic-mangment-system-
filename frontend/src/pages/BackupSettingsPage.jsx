import { useEffect, useState } from "react";
import { FolderOpen, HardDriveDownload, Upload } from "lucide-react";
import PasswordField from "../components/PasswordField.jsx";

function message(error) {
  return error.message.replace(/^Error invoking remote method '[^']+': Error: /, "");
}

export default function BackupSettingsPage() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadPath, setUploadPath] = useState(null);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  useEffect(() => {
    window.clinic.backupSettings().then(setStatus).catch((err) => setError(message(err)));
  }, []);

  async function run(action, success) {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const result = await action();
      if (!result) return;
      setStatus(result);
      if (result.error) setError(result.error);
      else setNotice(success);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  async function chooseUpload() {
    setUploadError("");
    setNotice("");
    try {
      const path = await window.clinic.chooseBackupUpload();
      if (path) setUploadPath(path);
    } catch (err) {
      setUploadError(message(err));
    }
  }

  async function restoreUpload(event) {
    event.preventDefault();
    setBusy(true);
    setUploadError("");
    try {
      await window.clinic.restoreBackupFromSettings({ path: uploadPath, adminUsername, adminPassword });
      setAdminPassword("");
      window.location.reload();
    } catch (err) {
      setUploadError(message(err));
      setBusy(false);
    }
  }

  return (
    <div className="clinic-profile-page backup-settings-page">
      <div className="page-head compact">
        <div>
          <span className="eyebrow">SETTINGS</span>
          <h1>Backup</h1>
          <p>Choose where automatic copies of the clinic database are saved.</p>
        </div>
      </div>
      <section className="panel">
        <div className="form-section">
          <h2>Automatic backup folder</h2>
          <p>Local backups are always saved. Choose another drive or USB folder for an additional copy.</p>
        </div>
        <div className="backup-location-list">
          <div><strong>Local folder</strong><span>{status?.localFolder || "Loading…"}</span></div>
          <div><strong>Additional folder</strong><span>{status?.externalFolder || "Not selected"}</span></div>
          <div><strong>Latest backup</strong><span>{status?.createdAt ? new Date(status.createdAt).toLocaleString("en-PK") : "None yet"}</span></div>
        </div>
        {status?.error && !error && <div className="error">{status.error}</div>}
        {error && <div className="error">{error}</div>}
        {notice && <div className="admin-notice">{notice}</div>}
        <div className="form-actions backup-settings-actions">
          <button type="button" className="secondary" disabled={busy} onClick={() => run(() => window.clinic.createBackupNow(), "Backup created in the configured folders.")}>
            <HardDriveDownload size={16} /> Back up now
          </button>
          {status?.externalFolder && <button type="button" className="secondary" disabled={busy} onClick={() => run(() => window.clinic.useDefaultBackupFolder(), "Additional backup folder removed. Local backups continue.")}>Use local only</button>}
          <button type="button" className="primary" disabled={busy} onClick={() => run(() => window.clinic.chooseBackupFolder(), "Additional backup folder saved and an initial copy created.")}>
            <FolderOpen size={16} /> Choose folder
          </button>
        </div>
      </section>
      <section className="panel backup-upload-panel">
        <div className="form-section">
          <h2>Upload a backup</h2>
          <p>Select a Clinic Desk .sqlite backup from this computer or a USB drive. This works offline.</p>
        </div>
        <button type="button" className="secondary" disabled={busy} onClick={chooseUpload}>
          <Upload size={16} /> Select backup file
        </button>
        {uploadError && <div className="error">{uploadError}</div>}
        {uploadPath && <form className="backup-restore-form" onSubmit={restoreUpload}>
          <div className="backup-selected-file"><strong>Selected file</strong><span>{uploadPath}</span></div>
          <p>Restoring replaces all clinic accounts, patients, visits and templates on this computer. A safety backup of the current data is created first. Admin login is required because this affects every clinic.</p>
          <div className="form-grid">
            <label className="field"><span>Admin username</span><input value={adminUsername} required autoComplete="off" onChange={(event) => setAdminUsername(event.target.value)} /></label>
            <PasswordField label="Admin password" value={adminPassword} required autoComplete="off" onChange={(event) => setAdminPassword(event.target.value)} />
          </div>
          <div className="form-actions backup-settings-actions">
            <button type="button" className="secondary" disabled={busy} onClick={() => { setUploadPath(null); setAdminPassword(""); }}>Cancel</button>
            <button type="submit" className="danger-button" disabled={busy}>{busy ? "Restoring…" : "Replace data and restore"}</button>
          </div>
        </form>}
      </section>
    </div>
  );
}
