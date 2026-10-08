import { useState } from "react";
import PasswordField from "../components/PasswordField.jsx";

function message(error) {
  return error.message.replace(
    /^Error invoking remote method '[^']+': Error: /,
    "",
  );
}

export default function ChangePasswordPage() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function changePassword(event) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const result = await window.clinic.changePassword(form);
      setForm({ currentPassword: "", newPassword: "" });
      setNotice(
        result.backupWarning
          ? `Password changed, but automatic backup failed: ${result.backupWarning}`
          : "Password changed. Your login stays active.",
      );
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="clinic-profile-page">
      <div className="page-head compact">
        <div>
          <span className="eyebrow">SETTINGS</span>
          <h1>Change password</h1>
          <p>Change the password for your own doctor login.</p>
        </div>
      </div>
      <section className="panel clinic-doctors-panel">
        <div className="form-section">
          <h2>Login security</h2>
          <p>Your new password must contain at least 8 characters.</p>
        </div>
        <form onSubmit={changePassword}>
          <div className="form-grid">
            <PasswordField
              label="Current password"
              value={form.currentPassword}
              required
              autoComplete="current-password"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  currentPassword: event.target.value,
                }))
              }
            />
            <PasswordField
              label="New password"
              value={form.newPassword}
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  newPassword: event.target.value,
                }))
              }
            />
          </div>
          {error && <div className="error">{error}</div>}
          {notice && <div className="admin-notice">{notice}</div>}
          <div className="form-actions">
            <button className="secondary" disabled={busy}>
              {busy ? "Changing…" : "Change password"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
