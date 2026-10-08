import { useEffect, useState } from "react";
import { Download, LogOut, Plus, RotateCcw, Save } from "lucide-react";
import appIcon from "../assets/app-icon.png";
import Field from "../components/Field.jsx";
import PasswordField from "../components/PasswordField.jsx";
import { clinicPreset } from "../../../shared/clinic-preset.js";

const empty = {
  username: "",
  password: "",
};

function message(error) {
  return error.message.replace(
    /^Error invoking remote method '[^']+': Error: /,
    "",
  );
}

export default function AdminPage({ logout }) {
  const [accounts, setAccounts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [backup, setBackup] = useState(null);
  const [backupNotice, setBackupNotice] = useState("");
  const [backupError, setBackupError] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);
  const [restorePath, setRestorePath] = useState(null);

  useEffect(() => {
    window.clinic
      .accounts()
      .then(setAccounts)
      .catch((err) => setError(message(err)));
    window.clinic
      .backupStatus()
      .then(setBackup)
      .catch((err) => setBackupError(message(err)));
  }, []);

  async function exportBackup() {
    setBackupError("");
    setBackupNotice("");
    setBackupBusy(true);
    try {
      const path = await window.clinic.exportBackup();
      if (path) {
        setBackup(await window.clinic.backupStatus());
        setBackupNotice(`Backup exported to ${path}`);
      }
    } catch (err) {
      setBackupError(message(err));
    } finally {
      setBackupBusy(false);
    }
  }

  async function chooseRestore() {
    setBackupError("");
    setBackupNotice("");
    try {
      const path = await window.clinic.chooseRestoreBackup();
      if (path) setRestorePath(path);
    } catch (err) {
      setBackupError(message(err));
    }
  }

  async function restoreBackup() {
    setBackupBusy(true);
    setBackupError("");
    try {
      await window.clinic.restoreBackup(restorePath);
      window.location.reload();
    } catch (err) {
      setBackupError(message(err));
      setBackupBusy(false);
    }
  }

  function select(account) {
    setEditing(account.id);
    setForm({
      username: account.username,
      password: "",
    });
    setError("");
    setNotice("");
  }

  async function applyReference() {
    if (!editing) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await window.clinic.applyFixedStationery(editing);
      setAccounts(await window.clinic.accounts());
      setNotice(updated.backupWarning
        ? `Reference stationery applied, but backup failed: ${updated.backupWarning}`
        : "Reference clinic and main doctor details are now fixed for this account.");
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const account = editing
        ? await window.clinic.updateAccount(editing, form)
        : await window.clinic.createAccount(form);
      setAccounts(await window.clinic.accounts());
      setEditing(account.id);
      setForm({ ...form, password: "" });
      setNotice(
        account.backupWarning
          ? `Account saved, but automatic backup failed: ${account.backupWarning}`
          : editing
            ? "Clinic account updated."
            : "Clinic account created. You can now sign in with its username and password.",
      );
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-brand">
          <span className="brand-icon">
            <img src={appIcon} alt="" width="37" height="37" />
          </span>
          <strong>
            ClinicDesk <small>ADMIN</small>
          </strong>
        </div>
        <button className="secondary" onClick={logout}>
          <LogOut size={16} /> Sign out
        </button>
      </header>
      <main className="admin-content">
        <span className="eyebrow">ACCOUNT MANAGEMENT</span>
        <h1>Clinic accounts</h1>
        <p>
          Create a login for the supplied Tahira Memorial Clinic stationery.
          Clinic branding and the main doctor profile are fixed.
        </p>
        <section className="admin-backup panel">
          <div>
            <strong>Database backup</strong>
            <p>
              Automatic local snapshots are kept on this computer. Export a
              copy to another drive so records survive computer failure.
            </p>
            <small>
              {backup?.createdAt
                ? `Latest snapshot: ${new Date(backup.createdAt).toLocaleString("en-PK")}`
                : "No snapshot is available yet."}
            </small>
          </div>
          <div className="admin-backup-actions">
            <button className="secondary" onClick={exportBackup} disabled={backupBusy}>
              <Download size={16} /> Export backup
            </button>
            <button className="secondary" onClick={chooseRestore} disabled={backupBusy}>
              <RotateCcw size={16} /> Restore backup
            </button>
          </div>
        </section>
        {restorePath && <section className="admin-restore-confirm panel">
          <strong>Replace all clinic data with this backup?</strong>
          <p>{restorePath}</p>
          <p>This replaces every clinic account, patient, visit and template in this installation. A safety backup of the current database will be saved first. You will need to sign in again.</p>
          <div className="admin-backup-actions">
            <button className="secondary" onClick={() => setRestorePath(null)} disabled={backupBusy}>Cancel</button>
            <button className="danger-button" onClick={restoreBackup} disabled={backupBusy}>{backupBusy ? "Restoring…" : "Replace data and restore"}</button>
          </div>
        </section>}
        {backupNotice && <div className="admin-notice">{backupNotice}</div>}
        {backupError && <div className="error">{backupError}</div>}
        <div className="admin-grid">
          <section className="panel admin-list">
            <div className="admin-panel-head">
              <h2>Saved clinics</h2>
              <button
                className="secondary"
                onClick={() => {
                  setEditing(null);
                  setForm(empty);
                  setError("");
                  setNotice("");
                }}
              >
                <Plus size={15} /> New clinic
              </button>
            </div>
            {accounts.length === 0 && (
              <div className="admin-empty">
                No clinic account yet. Create the first one.
              </div>
            )}
            {accounts.map((account) => (
              <button
                key={account.id}
                className={`admin-account ${editing === account.id ? "selected" : ""}`}
                onClick={() => select(account)}
              >
                <strong>{account.clinicName}</strong>
                <span>@{account.username}</span>
              </button>
            ))}
          </section>
          <section className="panel admin-form-panel">
            <h2>{editing ? "Edit clinic account" : "Create clinic account"}</h2>
            <p>
              {editing
                ? "Change only the login credentials. Leave password blank to keep the current one."
                : "Enter only a username and password. The clinic and main doctor details are ready to print."}
            </p>
            <div className="admin-notice">
              <strong>Fixed print identity:</strong> {clinicPreset.clinicName} · {clinicPreset.address} · {clinicPreset.phone}<br />
              <strong>Main doctor:</strong> {clinicPreset.doctorName} · PMDC {clinicPreset.registration} · PHC {clinicPreset.phcRegistration}
            </div>
            {editing && !accounts.find((account) => account.id === editing)?.fixedStationery && (
              <button type="button" className="secondary" onClick={applyReference} disabled={busy}>
                Apply fixed reference to this existing account
              </button>
            )}
            <form onSubmit={save}>
              <Field label="Username">
                <input
                  value={form.username}
                  required
                  maxLength={60}
                  autoComplete="off"
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                />
              </Field>
              <PasswordField
                label={editing ? "New password (optional)" : "Password"}
                value={form.password}
                minLength={8}
                maxLength={128}
                required={!editing}
                autoComplete="new-password"
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              {error && <div className="error">{error}</div>}
              {notice && <div className="admin-notice">{notice}</div>}
              <button className="primary" disabled={busy}>
                <Save size={16} />
                {busy ? "Saving…" : editing ? "Save changes" : "Create account"}
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
