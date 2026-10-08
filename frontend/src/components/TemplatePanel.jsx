import { useEffect, useState } from "react";
import { BookOpen, Plus } from "lucide-react";
import { femalePelvisTemplate } from "../reportTemplates.js";

const ultrasoundPatientKeys = new Set([
  "referringPhysician",
  "examinationDate",
  "clinicalIndication",
  "transvaginalPerformed",
  "consentRecorded",
]);
const ultrasoundReportKeys = [
  ...Object.keys(femalePelvisTemplate),
  "uterusSize",
  "endometrialThickness",
  "rightOvarySize",
  "rightOvaryVolume",
  "leftOvarySize",
  "leftOvaryVolume",
];

export default function TemplatePanel({ module, setDetails }) {
  const [templates, setTemplates] = useState([]);
  const [medicineId, setMedicineId] = useState("");
  const [diagnosisId, setDiagnosisId] = useState("");
  const [ultrasoundId, setUltrasoundId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    window.clinic
      .templates()
      .then((rows) => {
        if (!cancelled) setTemplates(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function applyMedicine() {
    const template = templates.find(
      (item) => item.id === Number(medicineId) && item.type === "medicine",
    );
    if (!template) return;
    setDetails((current) => {
      const rows = current.medicines || [];
      const firstBlank =
        rows.length === 1 && !Object.values(rows[0]).some(Boolean);
      return {
        ...current,
        medicines: firstBlank
          ? [structuredClone(template.data)]
          : [...rows, structuredClone(template.data)],
      };
    });
    setNotice(
      "Medicine added. Review the dose and instructions for this patient.",
    );
  }

  function applyDiagnosis() {
    const template = templates.find(
      (item) => item.id === Number(diagnosisId) && item.type === "diagnosis",
    );
    if (!template) return;
    setDetails((current) => {
      const plan = structuredClone(template.data);
      for (const key of ["complaints", "symptoms", "findings"])
        if (!plan[key]) delete plan[key];
      return { ...current, ...plan };
    });
    setNotice(
      "Physician plan applied. Review every medicine and instruction for this patient.",
    );
  }

  function applyUltrasound() {
    const template =
      ultrasoundId === "builtin"
        ? { data: femalePelvisTemplate }
        : templates.find(
            (item) =>
              item.id === Number(ultrasoundId) && item.type === "ultrasound",
          );
    if (!template) return;
    const reportData = Object.fromEntries(
      Object.entries(template.data).filter(
        ([key]) => !ultrasoundPatientKeys.has(key),
      ),
    );
    setDetails((current) => ({
      ...current,
      ...Object.fromEntries(ultrasoundReportKeys.map((key) => [key, ""])),
      ...structuredClone(reportData),
    }));
    setNotice(
      "Report wording applied. Review all findings and enter patient measurements.",
    );
  }

  const medicines = templates.filter((item) => item.type === "medicine");
  const plans = templates.filter((item) => item.type === "diagnosis");
  const reports = templates.filter((item) => item.type === "ultrasound");
  return (
    <section className="template-panel">
      <div className="template-heading">
        <BookOpen size={19} />
        <div>
          <h2>Apply a template</h2>
          <p>
            Templates are prepared in Template Library. Apply one here, then
            edit it for this patient.
          </p>
        </div>
      </div>
      <div className="template-rows">
        {module === "physician" ? (
          <>
            <div className="template-row">
              <label>Medicine</label>
              <select
                value={medicineId}
                onChange={(event) => setMedicineId(event.target.value)}
              >
                <option value="">Choose a saved medicine</option>
                {medicines.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="secondary"
                disabled={!medicineId}
                onClick={applyMedicine}
              >
                <Plus size={15} /> Add
              </button>
            </div>
            <div className="template-row">
              <label>Physician plan</label>
              <select
                value={diagnosisId}
                onChange={(event) => setDiagnosisId(event.target.value)}
              >
                <option value="">Choose a saved plan (e.g. Fever)</option>
                {plans.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="secondary"
                disabled={!diagnosisId}
                onClick={applyDiagnosis}
              >
                Apply plan
              </button>
            </div>
          </>
        ) : (
          <div className="template-row">
            <label>Report</label>
            <select
              value={ultrasoundId}
              onChange={(event) => setUltrasoundId(event.target.value)}
            >
              <option value="">Choose a report template</option>
              <option value="builtin">Female Pelvis — sample</option>
              {reports.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="secondary"
              disabled={!ultrasoundId}
              onClick={applyUltrasound}
            >
              Apply report
            </button>
          </div>
        )}
      </div>
      {notice && <p className="template-notice">{notice}</p>}
      {error && <div className="error">{error}</div>}
    </section>
  );
}
