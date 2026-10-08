import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
import Field from "../components/Field.jsx";
import TemplatePanel from "../components/TemplatePanel.jsx";
import { emptyPatient, moduleInfo } from "../constants.js";
import { physicianTestOptions, readPhysicianTests, writePhysicianTests } from "../physicianTests.js";

const emptyMedicine = {
  name: "",
  strength: "",
  dose: "",
  route: "",
  frequency: "",
  food: "",
  duration: "",
};

const initialDetails = {
  physician: {
    complaints: "",
    symptoms: "",
    findings: "",
    diagnosis: "",
    bp: "",
    pulse: "",
    temperature: "",
    respiratoryRate: "",
    spo2: "",
    weight: "",
    triage: "",
    condition: "",
    medicines: [{ ...emptyMedicine }],
    tests: "",
    advice: "",
    followUp: "",
  },
  ultrasound: {
    reportType: "Female Pelvis",
    referringPhysician: "",
    examinationDate: "",
    clinicalIndication: "",
    technique: "",
    bladder: "",
    uterusPosition: "",
    uterusSize: "",
    myometrium: "",
    endometrialThickness: "",
    endometrialPattern: "",
    cervix: "",
    rightOvarySize: "",
    rightOvaryVolume: "",
    rightOvaryFindings: "",
    leftOvarySize: "",
    leftOvaryVolume: "",
    leftOvaryFindings: "",
    adnexa: "",
    pouchOfDouglas: "",
    impression: "",
    transvaginalPerformed: false,
    consentRecorded: false,
  },
};

function FieldInput({
  label,
  value,
  onChange,
  wide,
  placeholder,
  type = "text",
}) {
  return (
    <Field label={label} wide={wide}>
      <input
        type={type}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </Field>
  );
}

function FieldText({ label, value, onChange, placeholder }) {
  return (
    <Field label={label} wide>
      <textarea
        rows="3"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </Field>
  );
}

export default function PatientFormPage({
  module,
  patientId,
  caseId,
  onSaved,
  navigate,
}) {
  const [patient, setPatient] = useState({ ...emptyPatient });
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [details, setDetails] = useState({ ...initialDetails[module] });
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [caseStatus, setCaseStatus] = useState("draft");
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [amendmentReason, setAmendmentReason] = useState("");
  const title = moduleInfo[module].title;
  const selectedTests = module === "physician" ? readPhysicianTests(details.tests) : null;
  const updatePatient = (key, value) =>
    setPatient((current) => ({ ...current, [key]: value }));
  const updateDetail = (key, value) =>
    setDetails((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (caseId) {
          const encounter = await window.clinic.getEncounter(caseId);
          if (!encounter) throw new Error("Visit not found.");
          if (!cancelled) {
            setSelectedPatient(encounter.patient);
            setDetails({ ...initialDetails[module], ...encounter.details });
            setCaseStatus(encounter.status);
          }
        } else if (patientId) {
          const record = await window.clinic.getPatient(patientId);
          if (!record) throw new Error("Patient not found.");
          if (!cancelled) setSelectedPatient(record);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [caseId, patientId, module]);

  useEffect(() => {
    if (selectedPatient || search.trim().length < 2) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      window.clinic
        .patients(search, "")
        .then((rows) => {
          if (!cancelled) setMatches(rows.slice(0, 8));
        })
        .catch((err) => {
          if (!cancelled) setError(err.message);
        });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, selectedPatient]);

  async function save(event) {
    event.preventDefault();
    const finalize = event.nativeEvent.submitter?.value === "finalize";
    setBusy(true);
    setError("");
    try {
      const encounter = await window.clinic.saveEncounter({
        module,
        caseId: caseId || undefined,
        patientId: selectedPatient?.id,
        patient: selectedPatient ? undefined : patient,
        details,
        finalize,
        reviewConfirmed,
        amendmentReason,
      });
      await onSaved(encounter, { openPrintPreview: finalize && encounter.status === "final" });
    } catch (err) {
      setError(
        err.message.replace(
          /^Error invoking remote method '[^']+': Error: /,
          "",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  function updateMedicine(index, key, value) {
    setDetails((current) => ({
      ...current,
      medicines: current.medicines.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    }));
  }

  return (
    <>
      <button className="back" onClick={() => navigate("module", { module })}>
        <ArrowLeft size={17} /> {title}
      </button>
      <div className="page-head compact">
        <div>
          <span className="eyebrow">{title.toUpperCase()} ENTRY</span>
          <h1>
            {caseId
              ? `Edit ${title} ${module === "physician" ? "visit" : "report"}`
              : `New ${title} ${module === "physician" ? "visit" : "report"}`}
          </h1>
          <p>
            Enter patient and{" "}
            {module === "physician" ? "consultation" : "examination"} details
            together. One save creates both records.
          </p>
          {caseId && (
            <span className="record-status">
              {caseStatus === "final" ? "Final record" : "Draft"}
            </span>
          )}
        </div>
        {caseId && (
          <button
            className="secondary"
            onClick={() => navigate("printPreview", { module, caseId })}
          >
            Print preview
          </button>
        )}
      </div>
      <form className="panel patient-form encounter-form" onSubmit={save}>
        <div className="form-section">
          <h2>Patient</h2>
          <p>
            {selectedPatient
              ? "Existing patient record selected."
              : "A new patient record will be created when this form is saved."}
          </p>
        </div>
        {selectedPatient ? (
          <div className="selected-patient">
            <div>
              <strong>{selectedPatient.name}</strong>
              <span>
                {selectedPatient.mrNumber} ·{" "}
                {selectedPatient.ageYears ?? "Age not recorded"} ·{" "}
                {selectedPatient.phone || "No phone"}
              </span>
            </div>
            {!caseId && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setSelectedPatient(null);
                  setSearch("");
                }}
              >
                Change patient
              </button>
            )}
          </div>
        ) : (
          <>
            <Field label="Search existing patient by name, MR number or phone">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Type at least 2 characters"
              />
            </Field>
            {matches.length > 0 && (
              <div className="patient-matches">
                {matches.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={async () => {
                      setSelectedPatient(
                        await window.clinic.getPatient(item.id),
                      );
                      setSearch("");
                    }}
                  >
                    <strong>{item.name}</strong>
                    <span>
                      {item.mrNumber} · {item.phone || "No phone"}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="form-section second">
              <h2>New patient details</h2>
              <p>
                Fill these only if this patient is not already in the directory.
              </p>
            </div>
            <div className="form-grid">
              <Field label="Patient name *">
                <input
                  value={patient.name}
                  required
                  maxLength={150}
                  onChange={(event) =>
                    updatePatient("name", event.target.value)
                  }
                />
              </Field>
              <Field label="Age (years)">
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={patient.ageYears}
                  onChange={(event) =>
                    updatePatient("ageYears", event.target.value)
                  }
                />
              </Field>
              <Field label="Gender">
                <select
                  value={patient.gender}
                  onChange={(event) =>
                    updatePatient("gender", event.target.value)
                  }
                >
                  <option value="">Select</option>
                  <option>Female</option>
                  <option>Male</option>
                  <option>Other</option>
                </select>
              </Field>
              <FieldInput
                label="Guardian / relationship"
                value={patient.relationship}
                onChange={(value) => updatePatient("relationship", value)}
              />
              <FieldInput
                label="Phone"
                value={patient.phone}
                onChange={(value) => updatePatient("phone", value)}
              />
              <FieldInput
                label="Address"
                wide
                value={patient.address}
                onChange={(value) => updatePatient("address", value)}
              />
              <FieldText
                label="Allergies"
                value={patient.allergies}
                onChange={(value) => updatePatient("allergies", value)}
              />
              <FieldText
                label="Medical history"
                value={patient.medicalHistory}
                onChange={(value) => updatePatient("medicalHistory", value)}
              />
              <FieldText
                label="Current medications"
                value={patient.currentMedications}
                onChange={(value) => updatePatient("currentMedications", value)}
              />
            </div>
          </>
        )}

        <TemplatePanel module={module} setDetails={setDetails} />

        {module === "physician" ? (
          <>
            <div className="form-section second">
              <h2>Physician assessment</h2>
              <p>Record the findings for this visit. MR number, visit number and date/time appear automatically after saving.</p>
            </div>
            <div className="form-grid">
              <FieldText
                label="Presenting complaints"
                value={details.complaints}
                onChange={(value) => updateDetail("complaints", value)}
              />
              <FieldText
                label="Symptoms"
                value={details.symptoms}
                onChange={(value) => updateDetail("symptoms", value)}
              />
              <FieldText
                label="Findings"
                value={details.findings}
                onChange={(value) => updateDetail("findings", value)}
              />
              <FieldText
                label="Provisional diagnosis"
                value={details.diagnosis}
                onChange={(value) => updateDetail("diagnosis", value)}
              />
            </div>
            <div className="form-section second">
              <h2>Vitals and triage</h2>
            </div>
            <div className="form-grid">
              {[
                ["Blood pressure (mmHg)", "bp"],
                ["Pulse (bpm)", "pulse"],
                ["Temperature (°F)", "temperature"],
                ["Respiratory rate (bpm)", "respiratoryRate"],
                ["SpO₂ (%)", "spo2"],
                ["Weight (kg)", "weight"],
              ].map(([label, key]) => (
                <FieldInput
                  key={key}
                  label={label}
                  value={details[key]}
                  onChange={(value) => updateDetail(key, value)}
                />
              ))}
              <Field label="Triage">
                <select
                  value={details.triage}
                  onChange={(event) =>
                    updateDetail("triage", event.target.value)
                  }
                >
                  <option value="">Select</option>
                  <option>Urgent</option>
                  <option>Semi urgent</option>
                  <option>Non urgent</option>
                </select>
              </Field>
              <Field label="Present condition">
                <select
                  value={details.condition}
                  onChange={(event) =>
                    updateDetail("condition", event.target.value)
                  }
                >
                  <option value="">Select</option>
                  <option>Alert</option>
                  <option>Stable</option>
                  <option>Unstable</option>
                  <option>Critical</option>
                </select>
              </Field>
            </div>
            <div className="form-section second">
              <h2>Prescription</h2>
              <p>
                Enter each medicine and its instructions as decided by the
                doctor.
              </p>
            </div>
            {(details.medicines || []).map((medicine, index) => (
              <div className="medicine-card" key={index}>
                <div className="medicine-heading">
                  <strong>Medicine {index + 1}</strong>
                  <button
                    type="button"
                    title="Remove medicine"
                    onClick={() =>
                      updateDetail(
                        "medicines",
                        details.medicines.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="form-grid">
                  {[
                    ["Medicine name", "name"],
                    ["Strength", "strength"],
                    ["Dose", "dose"],
                    ["Route", "route"],
                    ["Frequency / timing", "frequency"],
                    ["Food instruction", "food"],
                    ["Duration", "duration"],
                  ].map(([label, key]) => (
                    <FieldInput
                      key={key}
                      label={label}
                      value={medicine[key]}
                      onChange={(value) => updateMedicine(index, key, value)}
                    />
                  ))}
                </div>
              </div>
            ))}
            <button
              type="button"
              className="secondary add-medicine"
              onClick={() =>
                updateDetail("medicines", [
                  ...details.medicines,
                  { ...emptyMedicine },
                ])
              }
            >
              <Plus size={16} /> Add medicine
            </button>
            <div className="form-section second">
              <h2>Plan</h2>
            </div>
            <div className="form-grid">
              <div className="physician-tests-picker">
                <strong>Tests advised</strong>
                <span>Select tests to tick their boxes on the printed prescription.</span>
                <div className="physician-tests-options">
                  {physicianTestOptions.map(option => <label key={option}>
                    <input type="checkbox" checked={selectedTests.selected.includes(option)}
                      onChange={(event) => updateDetail("tests", writePhysicianTests(
                        event.target.checked
                          ? [...selectedTests.selected, option]
                          : selectedTests.selected.filter(item => item !== option),
                        selectedTests.other,
                      ))} />
                    {option}
                  </label>)}
                </div>
                <FieldText label="Other tests / notes" value={selectedTests.other}
                  onChange={(value) => updateDetail("tests", writePhysicianTests(selectedTests.selected, value))} />
              </div>
              <FieldText
                label="Advice"
                value={details.advice}
                onChange={(value) => updateDetail("advice", value)}
              />
              <FieldInput
                label="Follow-up date / interval"
                value={details.followUp}
                onChange={(value) => updateDetail("followUp", value)}
              />
            </div>
          </>
        ) : (
          <>
            <div className="form-section second">
              <h2>{details.reportType || "Ultrasound"} report</h2>
              <p>
                Enter examination findings and review every statement before
                saving.
              </p>
            </div>
            <div className="form-grid">
              <FieldInput
                label="Report type"
                value={details.reportType}
                onChange={(value) => updateDetail("reportType", value)}
              />
              <FieldInput
                label="Referring physician"
                value={details.referringPhysician}
                onChange={(value) => updateDetail("referringPhysician", value)}
              />
              <FieldInput
                label="Date of examination"
                type="date"
                value={details.examinationDate}
                onChange={(value) => updateDetail("examinationDate", value)}
              />
              <FieldText
                label="Clinical indication"
                value={details.clinicalIndication}
                onChange={(value) => updateDetail("clinicalIndication", value)}
              />
              <FieldText
                label="Technique"
                value={details.technique}
                onChange={(value) => updateDetail("technique", value)}
              />
              <FieldText
                label="Urinary bladder"
                value={details.bladder}
                onChange={(value) => updateDetail("bladder", value)}
              />
              <Field label="Uterus position">
                <select
                  value={details.uterusPosition}
                  onChange={(event) =>
                    updateDetail("uterusPosition", event.target.value)
                  }
                >
                  <option value="">Select</option>
                  <option>Anteverted</option>
                  <option>Retroverted</option>
                  <option>Midline</option>
                  <option>Other</option>
                </select>
              </Field>
              <FieldInput
                label="Uterus size (cm)"
                value={details.uterusSize}
                onChange={(value) => updateDetail("uterusSize", value)}
                placeholder="Length × width × height"
              />
              <FieldText
                label="Myometrium / fibroids"
                value={details.myometrium}
                onChange={(value) => updateDetail("myometrium", value)}
              />
              <FieldInput
                label="Endometrial thickness (mm)"
                value={details.endometrialThickness}
                onChange={(value) =>
                  updateDetail("endometrialThickness", value)
                }
              />
              <FieldText
                label="Endometrial pattern"
                value={details.endometrialPattern}
                onChange={(value) => updateDetail("endometrialPattern", value)}
              />
              <FieldText
                label="Cervix"
                value={details.cervix}
                onChange={(value) => updateDetail("cervix", value)}
              />
              <FieldInput
                label="Right ovary size (cm)"
                value={details.rightOvarySize}
                onChange={(value) => updateDetail("rightOvarySize", value)}
              />
              <FieldInput
                label="Right ovary volume (mL)"
                value={details.rightOvaryVolume}
                onChange={(value) => updateDetail("rightOvaryVolume", value)}
              />
              <FieldText
                label="Right ovary findings"
                value={details.rightOvaryFindings}
                onChange={(value) => updateDetail("rightOvaryFindings", value)}
              />
              <FieldInput
                label="Left ovary size (cm)"
                value={details.leftOvarySize}
                onChange={(value) => updateDetail("leftOvarySize", value)}
              />
              <FieldInput
                label="Left ovary volume (mL)"
                value={details.leftOvaryVolume}
                onChange={(value) => updateDetail("leftOvaryVolume", value)}
              />
              <FieldText
                label="Left ovary findings"
                value={details.leftOvaryFindings}
                onChange={(value) => updateDetail("leftOvaryFindings", value)}
              />
              <FieldText
                label="Adnexa"
                value={details.adnexa}
                onChange={(value) => updateDetail("adnexa", value)}
              />
              <FieldText
                label="Pouch of Douglas"
                value={details.pouchOfDouglas}
                onChange={(value) => updateDetail("pouchOfDouglas", value)}
              />
              <FieldText
                label="Impression"
                value={details.impression}
                onChange={(value) => updateDetail("impression", value)}
              />
              <div className="clinical-checks">
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(details.transvaginalPerformed)}
                    onChange={(event) =>
                      updateDetail(
                        "transvaginalPerformed",
                        event.target.checked,
                      )
                    }
                  />{" "}
                  Transvaginal examination performed
                </label>
                {details.transvaginalPerformed && (
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(details.consentRecorded)}
                      onChange={(event) =>
                        updateDetail("consentRecorded", event.target.checked)
                      }
                    />{" "}
                    Patient consent recorded
                  </label>
                )}
              </div>
            </div>
          </>
        )}
        {error && <div className="error">{error}</div>}
        {caseStatus === "final" && (
          <div className="record-workflow">
            <strong>Amending a final record</strong>
            <p>
              Changes will be kept in the amendment history. Enter why this
              record is being changed.
            </p>
            <label>
              Amendment reason{" "}
              <input
                value={amendmentReason}
                onChange={(event) => setAmendmentReason(event.target.value)}
                maxLength={500}
              />
            </label>
          </div>
        )}
        {caseStatus !== "final" && (
          <label className="review-confirmation">
            <input
              type="checkbox"
              checked={reviewConfirmed}
              onChange={(event) => setReviewConfirmed(event.target.checked)}
            />
            I have reviewed the patient details, findings, and instructions for
            this case.
          </label>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="secondary"
            onClick={() => navigate("module", { module })}
          >
            Cancel
          </button>
          <button className="primary" disabled={busy} value="draft">
            {busy
              ? "Saving…"
              : caseStatus === "final"
                ? "Save amendment"
                : caseId
                  ? "Save draft"
                  : "Save visit and patient"}
            <ArrowRight size={17} />
          </button>
          {caseStatus !== "final" && (
            <button
              className="primary finalize-button"
              value="finalize"
              disabled={busy || !reviewConfirmed}
            >
              Finalize {module === "physician" ? "prescription" : "report"}
            </button>
          )}
        </div>
      </form>
    </>
  );
}
