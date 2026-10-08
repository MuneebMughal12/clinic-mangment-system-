import { useEffect, useState } from "react";
import {
  Activity,
  BookOpen,
  ChevronDown,
  DatabaseBackup,
  HeartPulse,
  LockKeyhole,
  LogOut,
  Settings,
  Stethoscope,
  UserRound,
  UsersRound,
  Waves,
} from "lucide-react";

export default function Sidebar({
  doctor,
  screen,
  activeModule,
  navigate,
  logout,
}) {
  const patientsSelected = ["patients", "patient"].includes(screen);
  const settingsSelected = [
    "doctorProfile",
    "doctorAccounts",
    "changePassword",
    "backupSettings",
  ].includes(screen);
  const [settingsOpen, setSettingsOpen] = useState(settingsSelected);
  useEffect(() => {
    setSettingsOpen(settingsSelected);
  }, [screen]);

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-icon">
          <HeartPulse size={25} />
        </span>
        <span>
          Clinic<span className="brand-light">Desk</span>
          <small>DOCTOR WORKSPACE</small>
        </span>
      </div>
      <div className="nav-label">WORKSPACE</div>
      <button
        className={`nav-item ${screen === "dashboard" ? "selected" : ""}`}
        onClick={() => navigate("dashboard")}
      >
        <Activity size={19} /> Dashboard
      </button>
      <button
        className={`nav-item ${patientsSelected ? "selected" : ""}`}
        onClick={() => navigate("patients", { filter: "" })}
      >
        <UsersRound size={19} /> All patients
      </button>
      <button
        className={`nav-item ${screen === "templates" ? "selected" : ""}`}
        onClick={() => navigate("templates")}
      >
        <BookOpen size={19} /> Template Library
      </button>
      <div className="nav-label section-gap">MODULES</div>
      <button
        className={`nav-item ${screen === "module" && activeModule === "physician" ? "selected" : ""}`}
        onClick={() => navigate("module", { module: "physician" })}
      >
        <Stethoscope size={19} /> Physician
      </button>
      <button
        className={`nav-item ${screen === "module" && activeModule === "ultrasound" ? "selected" : ""}`}
        onClick={() => navigate("module", { module: "ultrasound" })}
      >
        <Waves size={19} /> Ultrasound
      </button>
      <div className="nav-label section-gap">PREFERENCES</div>
      <button
        className={`nav-item ${settingsSelected ? "selected" : ""}`}
        aria-expanded={settingsOpen}
        onClick={() => setSettingsOpen((open) => !open)}
      >
        <Settings size={19} /> Settings{" "}
        <ChevronDown
          className={`settings-chevron ${settingsOpen ? "open" : ""}`}
          size={15}
        />
      </button>
      {settingsOpen && (
        <div className="settings-subnav">
          <button
            className={`settings-subitem ${screen === "doctorProfile" ? "selected" : ""}`}
            onClick={() => navigate("doctorProfile")}
          >
            <UserRound size={16} /> Doctor profile
          </button>
          {doctor.isOwner && (
            <button
              className={`settings-subitem ${screen === "doctorAccounts" ? "selected" : ""}`}
              onClick={() => navigate("doctorAccounts")}
            >
              <UsersRound size={16} /> Doctor accounts
            </button>
          )}
          {doctor.isOwner && (
            <button
              className={`settings-subitem ${screen === "backupSettings" ? "selected" : ""}`}
              onClick={() => navigate("backupSettings")}
            >
              <DatabaseBackup size={16} /> Backup
            </button>
          )}
          <button
            className={`settings-subitem ${screen === "changePassword" ? "selected" : ""}`}
            onClick={() => navigate("changePassword")}
          >
            <LockKeyhole size={16} /> Change password
          </button>
        </div>
      )}
      <div className="sidebar-bottom">
        <div className="offline">
          <span className="status-dot" /> Offline · Local data
        </div>
        <div className="profile">
          <span className="avatar">
            <UserRound size={19} />
          </span>
          <span>
            <strong>{doctor.doctorName}</strong>
            <small>{doctor.clinicName}</small>
          </span>
          <button title="Sign out" onClick={logout}>
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
