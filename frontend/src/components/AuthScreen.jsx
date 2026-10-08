import { useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import appIcon from "../assets/app-icon.png";
import Field from "./Field.jsx";
import PasswordField from "./PasswordField.jsx";

function message(error) {
  return error.message.replace(
    /^Error invoking remote method '[^']+': Error: /,
    "",
  );
}

export default function AuthScreen({ onSuccess, needsAdminSetup = false }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (needsAdminSetup && password !== confirmation) throw new Error("Passwords do not match.");
      const account = needsAdminSetup
        ? (await window.clinic.setupAdmin({ username, password })).account
        : await window.clinic.login(username, password);
      onSuccess(account);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-visual">
        <div className="auth-visual-brand"><span className="auth-visual-icon"><img src={appIcon} alt="" width="40" height="40" /></span> ClinicDesk</div>
        <div className="auth-visual-copy"><span>YOUR OFFLINE CLINIC WORKSPACE</span><h2>Care you can trust.</h2><p>Patient records, prescriptions and reports, all in one place.</p></div>
        <span className="auth-visual-footer">PRIVATE · LOCAL · RELIABLE</span>
      </div>
      <div className="auth-main"><div className="auth-card">
        <div className="auth-mark"><img src={appIcon} alt="Clinic Desk" width="58" height="58" /></div>
        <span className="eyebrow">OFFLINE CLINIC SOFTWARE</span>
        <h1>{needsAdminSetup ? "Set up admin access" : "Welcome back"}</h1>
        <p>{needsAdminSetup ? "Create the admin login for this computer. Keep these credentials safe; they are needed to create clinic accounts and restore backups." : "Enter your username and password to open your workspace."}</p>
        <form onSubmit={submit}>
          <Field label="Username">
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              maxLength={60}
            />
          </Field>
          <PasswordField
            label={needsAdminSetup ? "Admin password (at least 12 characters)" : "Password"}
            autoComplete={needsAdminSetup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {needsAdminSetup && <PasswordField
            label="Confirm admin password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            required
          />}
          {error && <div className="error">{error}</div>}
          <button className="primary full" disabled={busy}>
            {busy ? "Please wait…" : needsAdminSetup ? "Create admin login" : "Sign in"}
            <ArrowRight size={17} />
          </button>
        </form>
        <div className="auth-foot">
          <LockKeyhole size={15} /> Data stays on this computer
        </div>
      </div></div>
    </div>
  );
}
