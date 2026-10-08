import { useState } from "react";
import { Save } from "lucide-react";
import Field from "../components/Field.jsx";

function message(error) {
  return error.message.replace(
    /^Error invoking remote method '[^']+': Error: /,
    "",
  );
}

export default function DoctorProfilePage({ account, onSaved }) {
  const [form, setForm] = useState({
    doctorName: account.doctorName || "",
    doctorQualification: account.doctorQualification || "",
    doctorQualificationPhysician: account.doctorQualificationPhysician || account.doctorQualification || "",
    doctorQualificationUltrasound: account.doctorQualificationUltrasound || account.doctorQualification || "",
    doctorNameUrdu: account.doctorNameUrdu || "",
    doctorQualificationUrdu: account.doctorQualificationUrdu || "",
    registration: account.registration || "",
    phcRegistrationOverride: account.phcRegistrationOverride || account.phcRegistration || "",
  });
  const locked = account.fixedStationery && account.isOwner;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function save(event) {
    event.preventDefault();
    if (locked) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const updated = await window.clinic.updateProfile(form);
      onSaved(updated);
      setNotice(
        updated.backupWarning
          ? `Profile saved, but automatic backup failed: ${updated.backupWarning}`
          : "Doctor profile saved. New print previews will use these details.",
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
          <h1>Doctor profile</h1>
          <p>
            {locked
              ? "The main doctor's English and Urdu print details are fixed to the supplied stationery."
              : "Your English and Urdu professional details appear on your printouts; clinic branding stays fixed."}
          </p>
        </div>
      </div>
      <form className="panel clinic-profile-form" onSubmit={save}>
        <div className="form-section">
          <h2>Your professional details</h2>
          <p>
            {locked ? "Reference details are ready to use and cannot be edited from this account." : "Edit only your own doctor details and printed registration number."}
          </p>
        </div>
        <div className="form-grid">
          <Field label="Doctor name">
            <input
              value={form.doctorName}
              readOnly={locked}
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
              readOnly={locked}
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
            <textarea placeholder="One item per line" value={form.doctorQualificationUltrasound}
              readOnly={locked} maxLength={500}
              onChange={(event) => setForm((current) => ({ ...current, doctorQualificationUltrasound: event.target.value }))} />
          </Field>
          <Field label="Doctor name in Urdu (physician letterhead)">
            <input
              dir="rtl"
              readOnly={locked}
              value={form.doctorNameUrdu}
              maxLength={120}
              onChange={(event) => setForm((current) => ({ ...current, doctorNameUrdu: event.target.value }))}
            />
          </Field>
          <Field label="Urdu qualifications and experience (one line per item)">
            <textarea
              dir="rtl"
              readOnly={locked}
              value={form.doctorQualificationUrdu}
              maxLength={500}
              onChange={(event) => setForm((current) => ({ ...current, doctorQualificationUrdu: event.target.value }))}
            />
          </Field>
          <Field label="Doctor professional registration number">
            <input
              value={form.registration}
              readOnly={locked}
              maxLength={120}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  registration: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Printed PHC registration number">
            <input value={form.phcRegistrationOverride} readOnly={locked} maxLength={120}
              onChange={(event) => setForm((current) => ({ ...current, phcRegistrationOverride: event.target.value }))} />
          </Field>
        </div>
        {error && <div className="error">{error}</div>}
        {notice && <div className="admin-notice">{notice}</div>}
        {!locked && <div className="form-actions">
          <button className="primary" disabled={busy}>
            <Save size={16} /> {busy ? "Saving…" : "Save doctor profile"}
          </button>
        </div>}
      </form>
    </div>
  );
}
