import { useEffect, useState } from "react";
import { BookOpen, Plus } from "lucide-react";
import { femalePelvisTemplate } from "../reportTemplates.js";
import ultrasoundCatalog from "../ultrasoundCatalog.json";
import { structuredUltrasoundDraft } from "../ultrasoundSections.js";
import { medicineCatalog, physicianPlanCatalog, applyPhysicianPlanDraft } from "../physicianCatalog.js";

const ultrasoundPatientKeys = new Set([
  "referringPhysician",
  "examinationDate",
  "clinicalIndication",
  "transvaginalPerformed",
  "consentRecorded",
]);
const ultrasoundReportKeys = [
  ...Object.keys(femalePelvisTemplate),
  "reportStyle",
  "reportBody",
  "sections",
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
  const [selectedSuggestedMedicines, setSelectedSuggestedMedicines] = useState([]);
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
    const template = medicineId.startsWith("supplied-")
      ? medicineCatalog[Number(medicineId.slice(9))]
      : templates.find((item) => item.id === Number(medicineId) && item.type === "medicine");
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
      "Medicine added. Enter and review its dose, route and timing for this patient.",
    );
  }

  function applyDiagnosis() {
    const template = diagnosisId.startsWith("supplied-")
      ? physicianPlanCatalog[Number(diagnosisId.slice(9))]
      : templates.find((item) => item.id === Number(diagnosisId) && item.type === "diagnosis");
    if (!template) return;
    setDetails((current) => applyPhysicianPlanDraft(
      current, template.data, selectedSuggestedMedicines, templates,
    ));
    setNotice(
      "Physician plan applied. Complete and review every selected medicine before finalizing.",
    );
  }

  function applyUltrasound() {
    const template =
      ultrasoundId === "builtin"
        ? { data: { ...femalePelvisTemplate, reportStyle: "pelvis" } }
        : ultrasoundId.startsWith("supplied-")
          ? { data: structuredUltrasoundDraft(ultrasoundCatalog[Number(ultrasoundId.slice(9))]) }
          : templates.find(
              (item) =>
                item.id === Number(ultrasoundId) && item.type === "ultrasound",
            );
    if (!template) return;
    const source = template.data.reportBody && !template.data.sections
      ? structuredUltrasoundDraft(template.data)
      : template.data;
    const reportData = Object.fromEntries(
      Object.entries(source).filter(
        ([key]) => !ultrasoundPatientKeys.has(key),
      ),
    );
    setDetails((current) => ({
      ...current,
      ...Object.fromEntries(ultrasoundReportKeys.map((key) => [key, ""])),
      sections: [],
      ...structuredClone(reportData),
    }));
    setNotice(
      "Report wording applied. Review all findings and enter patient measurements.",
    );
  }

  const medicines = templates.filter((item) => item.type === "medicine");
  const plans = templates.filter((item) => item.type === "diagnosis");
  const reports = templates.filter((item) => item.type === "ultrasound");
  const selectedPlan = diagnosisId.startsWith("supplied-")
    ? physicianPlanCatalog[Number(diagnosisId.slice(9))]
    : plans.find((item) => item.id === Number(diagnosisId));
  const planSuggestions = selectedPlan?.data?.suggestedMedicines || [];
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
                {medicineCatalog.map((item, index) => (
                  <option key={item.name} value={`supplied-${index}`}>{item.name} — supplied draft</option>
                ))}
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
                onChange={(event) => {
                  setDiagnosisId(event.target.value);
                  setSelectedSuggestedMedicines([]);
                }}
              >
                <option value="">Choose a saved plan (e.g. Fever)</option>
                {physicianPlanCatalog.map((item, index) => (
                  <option key={item.name} value={`supplied-${index}`}>{item.name} — supplied draft</option>
                ))}
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
            {planSuggestions.length > 0 && (
              <div className="template-suggestions">
                <strong>Related medicines — choose only those prescribed for this patient</strong>
                <div>
                  {planSuggestions.map((name) => (
                    <label key={name}>
                      <input type="checkbox" checked={selectedSuggestedMedicines.includes(name)}
                        onChange={(event) => setSelectedSuggestedMedicines((current) =>
                          event.target.checked ? [...current, name] : current.filter((item) => item !== name))} />
                      <span>{name}</span>
                    </label>
                  ))}
                </div>
                <small>Dose, route and timing must be entered after applying the plan.</small>
              </div>
            )}
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
              {ultrasoundCatalog.map((item, index) => (
                <option key={item.name} value={`supplied-${index}`}>
                  {item.name}
                </option>
              ))}
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
