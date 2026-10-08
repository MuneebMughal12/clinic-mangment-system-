import { useEffect, useState } from "react";
import { Plus, UserRoundX } from "lucide-react";
import Field from "../components/Field.jsx";
import PasswordField from "../components/PasswordField.jsx";

const emptyDoctor = {
  doctorName: "",
  doctorQualification: "",
  doctorQualificationPhysician: "",
  doctorQualificationUltrasound: "",
  doctorNameUrdu: "",
  doctorQualificationUrdu: "",
  registration: "",
  phcRegistrationOverride: "",
  username: "",
  password: "",
};

function message(error) {
  return error.message.replace(
    /^Error invoking remote method '[^']+': Error: /,
    "",
  );
}

export default function DoctorAccountsPage() {
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState(emptyDoctor);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pendingRelease, setPendingRelease] = useState(null);

  useEffect(() => {
    window.clinic
      .doctors()
      .then(setDoctors)
      .catch((err) => setError(message(err)));
  }, []);

  async function addDoctor(event) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const created = await window.clinic.createDoctor(form);
      setDoctors(await window.clinic.doctors());
      setForm(emptyDoctor);
      setNotice(
        created.backupWarning
          ? `Doctor login created, but automatic backup failed: ${created.backupWarning}`
          : `Doctor login created: ${created.username}. This clinic now has two doctor accounts.`,
      );
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  async function releaseDoctor() {
    if (pendingRelease == null) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const result = await window.clinic.deactivateDoctor(pendingRelease);
      setDoctors(await window.clinic.doctors());
      setPendingRelease(null);
      setNotice(result.backupWarning
        ? `Doctor login disabled, but automatic backup failed: ${result.backupWarning}`
        : "Additional doctor login disabled. You can now create a new one. Existing clinical records are preserved.");
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
          <h1>Doctor accounts</h1>
          <p>
            One owner login and one additional doctor login can share patients
            and templates.
          </p>
        </div>
      </div>
      <section className="panel clinic-doctors-panel doctor-logins-panel">
        <div className="form-section">
          <h2>Doctor logins</h2>
          <p>
            Each doctor has their own login and printed professional details.
          </p>
        </div>
        <div className="clinic-doctors-list">
          {doctors.map((doctor) => (
            <div className="doctor-login-row" key={doctor.userId ?? "owner"}>
              <div className="doctor-login-meta"><strong>{doctor.doctorName}</strong>
                <span>@{doctor.username}{doctor.isOwner ? " · Owner" : ""}</span></div>
              {!doctor.isOwner && <button type="button" className="secondary doctor-release-button" onClick={() => { setPendingRelease(doctor.userId); setNotice(""); setError(""); }}><UserRoundX size={15} /> Release slot</button>}
            </div>
          ))}
        </div>
        {pendingRelease != null && <div className="doctor-release-confirm">
          <strong>Disable this doctor login?</strong>
          <p>The doctor will no longer be able to sign in. Existing visits, reports and print details will stay in the clinic history.</p>
          <div><button type="button" className="secondary" onClick={() => setPendingRelease(null)} disabled={busy}>Keep login</button>
            <button type="button" className="danger-button" onClick={releaseDoctor} disabled={busy}>{busy ? "Disabling…" : "Disable login and release slot"}</button></div>
        </div>}
        {doctors.length >= 2 ? (
          <div className="admin-notice">
            One additional doctor login is active. Release its slot above before creating a different doctor login.
          </div>
        ) : (
          <form onSubmit={addDoctor}>
            <div className="form-grid">
              <Field label="Doctor name">
                <input
                  value={form.doctorName}
                  required
                  maxLength={120}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      doctorName: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Physician qualifications and experience">
                <textarea
                  placeholder="One qualification or experience item per line"
                  value={form.doctorQualificationPhysician}
                  maxLength={500}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      doctorQualification: event.target.value,
                      doctorQualificationPhysician: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Ultrasound qualifications and experience">
                <textarea value={form.doctorQualificationUltrasound} maxLength={500}
                  onChange={(event) => setForm((current) => ({ ...current, doctorQualificationUltrasound: event.target.value }))} />
              </Field>
              <Field label="Doctor name in Urdu">
                <input dir="rtl" value={form.doctorNameUrdu} maxLength={120}
                  onChange={(event) => setForm((current) => ({ ...current, doctorNameUrdu: event.target.value }))} />
              </Field>
              <Field label="Urdu qualifications and experience">
                <textarea dir="rtl" value={form.doctorQualificationUrdu} maxLength={500}
                  onChange={(event) => setForm((current) => ({ ...current, doctorQualificationUrdu: event.target.value }))} />
              </Field>
              <Field label="Doctor professional registration number">
                <input
                  value={form.registration}
                  maxLength={120}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      registration: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Printed PHC registration number (optional)">
                <input value={form.phcRegistrationOverride} maxLength={120}
                  onChange={(event) => setForm((current) => ({ ...current, phcRegistrationOverride: event.target.value }))} />
              </Field>
              <Field label="New doctor username">
                <input
                  value={form.username}
                  required
                  minLength={3}
                  maxLength={60}
                  autoComplete="off"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      username: event.target.value,
                    }))
                  }
                />
              </Field>
              <PasswordField
                label="Temporary password"
                value={form.password}
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
              />
            </div>
            {error && <div className="error">{error}</div>}
            {notice && <div className="admin-notice">{notice}</div>}
            <div className="form-actions">
              <button className="primary" disabled={busy}>
                <Plus size={16} /> {busy ? "Creating…" : "Add doctor login"}
              </button>
            </div>
          </form>
        )}
        {error && doctors.length >= 2 && <div className="error">{error}</div>}
        {notice && doctors.length >= 2 && (
          <div className="admin-notice">{notice}</div>
        )}
      </section>
    </div>
  );
}
