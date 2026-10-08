import { useEffect, useState } from "react";
import { BookOpen, Plus, Save, Trash2 } from "lucide-react";
import { femalePelvisTemplate } from "../reportTemplates.js";

const medicineFields = [
  ["Medicine name", "name"],
  ["Strength", "strength"],
  ["Dose / quantity", "dose"],
  ["Route", "route"],
  ["Frequency / timing", "frequency"],
  ["Before / after food", "food"],
  ["Duration", "duration"],
];

const ultrasoundFields = [
  ["Report type", "reportType"],
  ["Technique", "technique", true],
  ["Urinary bladder", "bladder", true],
  ["Uterus position", "uterusPosition"],
  ["Uterus size (cm)", "uterusSize"],
  ["Myometrium / fibroids", "myometrium", true],
  ["Endometrial thickness (mm)", "endometrialThickness"],
  ["Endometrial pattern", "endometrialPattern", true],
  ["Cervix", "cervix", true],
  ["Right ovary size (cm)", "rightOvarySize"],
  ["Right ovary volume (mL)", "rightOvaryVolume"],
  ["Right ovary findings", "rightOvaryFindings", true],
  ["Left ovary size (cm)", "leftOvarySize"],
  ["Left ovary volume (mL)", "leftOvaryVolume"],
  ["Left ovary findings", "leftOvaryFindings", true],
  ["Adnexa", "adnexa", true],
  ["Pouch of Douglas", "pouchOfDouglas", true],
  ["Impression", "impression", true],
];

const blankMedicine = () =>
  Object.fromEntries(medicineFields.map(([, key]) => [key, ""]));
const blankReport = () => ({
  ...Object.fromEntries(ultrasoundFields.map(([, key]) => [key, ""])),
  reportType: "Female Pelvis",
});
const blankPlan = () => ({
  complaints: "",
  symptoms: "",
  findings: "",
  diagnosis: "",
  medicines: [blankMedicine()],
  tests: "",
  advice: "",
  followUp: "",
});
const emptyData = (type) =>
  type === "medicine"
    ? blankMedicine()
    : type === "diagnosis"
      ? blankPlan()
      : blankReport();
function normalizeData(type, source = {}) {
  if (type === "medicine")
    return Object.fromEntries(
      medicineFields.map(([, key]) => [key, source[key] ?? ""]),
    );
  if (type === "diagnosis")
    return {
      complaints: source.complaints ?? "",
      symptoms: source.symptoms ?? "",
      findings: source.findings ?? "",
      diagnosis: source.diagnosis ?? "",
      medicines: Array.isArray(source.medicines)
        ? source.medicines.map((row) => normalizeData("medicine", row))
        : [blankMedicine()],
      tests: source.tests ?? "",
      advice: source.advice ?? "",
      followUp: source.followUp ?? "",
    };
  return Object.fromEntries(
    ultrasoundFields.map(([, key]) => [
      key,
      source[key] ?? (key === "reportType" ? "Female Pelvis" : ""),
    ]),
  );
}

function message(error) {
  return error.message.replace(
    /^Error invoking remote method '[^']+': Error: /,
    "",
  );
}

function TextField({ label, value, onChange, multiline = false }) {
  return (
    <label className="library-field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          rows={3}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

export default function TemplateLibraryPage() {
  const [type, setType] = useState("diagnosis");
  const [templates, setTemplates] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [data, setData] = useState(blankPlan);
  const [medicineToAdd, setMedicineToAdd] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    window.clinic
      .templates()
      .then((rows) => {
        if (!cancelled) setTemplates(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(message(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function chooseType(next) {
    setType(next);
    setEditingId(null);
    setName("");
    setData(emptyData(next));
    setMedicineToAdd("");
    setNotice("");
    setError("");
  }

  function selectTemplate(template) {
    setEditingId(template.id);
    setName(template.name);
    setData(normalizeData(template.type, structuredClone(template.data)));
    setNotice("");
    setError("");
  }

  function update(key, value) {
    setData((current) => ({ ...current, [key]: value }));
  }
  function updateMedicine(index, key, value) {
    setData((current) => ({
      ...current,
      medicines: current.medicines.map((row, i) =>
        i === index ? { ...row, [key]: value } : row,
      ),
    }));
  }

  function addSavedMedicine() {
    const template = templates.find(
      (item) => item.id === Number(medicineToAdd) && item.type === "medicine",
    );
    if (!template) return;
    setData((current) => {
      const existing = current.medicines || [];
      const firstBlank =
        existing.length === 1 && !Object.values(existing[0]).some(Boolean);
      return {
        ...current,
        medicines: firstBlank
          ? [structuredClone(template.data)]
          : [...existing, structuredClone(template.data)],
      };
    });
    setMedicineToAdd("");
  }

  async function save(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!name.trim()) {
      setError("Enter a template name.");
      return;
    }
    if (type === "medicine" && !data.name?.trim()) {
      setError("Enter the medicine name.");
      return;
    }
    if (type === "diagnosis" && !data.diagnosis?.trim()) {
      setError("Enter the diagnosis for this plan.");
      return;
    }
    if (type === "ultrasound" && !data.reportType?.trim()) {
      setError("Enter the report type.");
      return;
    }
    setBusy(true);
    try {
      const saved = await window.clinic.saveTemplate({
        id: editingId || undefined,
        type,
        name,
        data: normalizeData(type, data),
      });
      setTemplates(await window.clinic.templates());
      setEditingId(saved.id);
      setNotice(
        saved.backupWarning
          ? `Template saved, but automatic backup failed: ${saved.backupWarning}`
          : `Template saved: ${saved.name}. It is available in the patient form.`,
      );
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(template) {
    if (
      !window.confirm(
        `Delete template "${template.name}"? Existing patient records will stay unchanged.`,
      )
    )
      return;
    try {
      const result = await window.clinic.deleteTemplate(template.id);
      setTemplates(await window.clinic.templates());
      if (editingId === template.id) {
        setEditingId(null);
        setName("");
        setData(emptyData(type));
      }
      setNotice(
        result.backupWarning
          ? `Template deleted, but automatic backup failed: ${result.backupWarning}`
          : "Template deleted.",
      );
      setError("");
    } catch (err) {
      setError(message(err));
    }
  }

  const currentTemplates = templates.filter((item) => item.type === type);
  const savedMedicines = templates.filter((item) => item.type === "medicine");
  return (
    <div className="library-page">
      <div className="page-head compact">
        <div>
          <span className="eyebrow">DOCTOR WORKSPACE</span>
          <h1>
            <BookOpen size={26} /> Template Library
          </h1>
          <p>
            Create reusable instructions here before opening a patient. Applying
            one copies it into the visit, where it can be edited.
          </p>
        </div>
      </div>
      <div className="library-tabs">
        {[
          ["diagnosis", "Physician plans"],
          ["medicine", "Medicines"],
          ["ultrasound", "Ultrasound reports"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={type === key ? "active" : ""}
            onClick={() => chooseType(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="library-layout">
        <aside className="panel library-list">
          <div className="library-list-head">
            <h2>
              Saved{" "}
              {type === "diagnosis"
                ? "plans"
                : type === "medicine"
                  ? "medicines"
                  : "reports"}
            </h2>
            <button
              className="secondary"
              onClick={() => {
                setEditingId(null);
                setName("");
                setData(emptyData(type));
                setNotice("");
                setError("");
              }}
            >
              <Plus size={15} /> New
            </button>
          </div>
          {currentTemplates.length ? (
            currentTemplates.map((item) => (
              <div
                className={`library-item ${editingId === item.id ? "selected" : ""}`}
                key={item.id}
              >
                <button onClick={() => selectTemplate(item)}>
                  <strong>{item.name}</strong>
                  <small>
                    {type === "diagnosis"
                      ? item.data.diagnosis
                      : type === "medicine"
                        ? [item.data.name, item.data.strength]
                            .filter(Boolean)
                            .join(" · ")
                        : item.data.reportType}
                  </small>
                </button>
                <button
                  className="library-delete"
                  title={`Delete ${item.name}`}
                  onClick={() => remove(item)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          ) : (
            <p className="library-empty">
              No saved templates yet. Create the first one on the right.
            </p>
          )}
        </aside>
        <form className="panel library-editor" onSubmit={save}>
          <div className="library-editor-head">
            <div>
              <h2>{editingId ? "Edit template" : "New template"}</h2>
              <p>
                {type === "diagnosis"
                  ? "Example: Fever — add usual complaints, symptoms, findings, diagnosis, medicines, tests, advice and follow-up. Review each field for the patient."
                  : type === "medicine"
                    ? "Save the doctor's usual starting instructions for one medicine."
                    : "Build report wording before entering a patient's examination."}
              </p>
            </div>
            {type === "ultrasound" && (
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setData({ ...blankReport(), ...femalePelvisTemplate })
                }
              >
                Load Female Pelvis sample
              </button>
            )}
          </div>
          <TextField label="Template name" value={name} onChange={setName} />
          {type === "medicine" && (
            <div className="library-fields">
              {medicineFields.map(([label, key]) => (
                <TextField
                  key={key}
                  label={label}
                  value={data[key]}
                  onChange={(value) => update(key, value)}
                />
              ))}
            </div>
          )}
          {type === "diagnosis" && (
            <>
              <div className="library-fields library-plan-fields">
                <TextField label="Presenting complaints" value={data.complaints}
                  onChange={(value) => update("complaints", value)} multiline />
                <TextField label="Symptoms" value={data.symptoms}
                  onChange={(value) => update("symptoms", value)} multiline />
                <TextField label="Findings" value={data.findings}
                  onChange={(value) => update("findings", value)} multiline />
              </div>
              <TextField
                label="Diagnosis"
                value={data.diagnosis}
                onChange={(value) => update("diagnosis", value)}
                multiline
              />
              <div className="library-subhead">
                <h3>Medicines in this plan</h3>
                <p>
                  These are starting instructions. Review each dose for the
                  patient.
                </p>
              </div>
              <div className="library-add-medicine">
                <select
                  value={medicineToAdd}
                  onChange={(event) => setMedicineToAdd(event.target.value)}
                >
                  <option value="">Choose a saved medicine</option>
                  {savedMedicines.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="secondary"
                  disabled={!medicineToAdd}
                  onClick={addSavedMedicine}
                >
                  Add saved medicine
                </button>
              </div>
              {(data.medicines || []).map((medicine, index) => (
                <section className="library-medicine" key={index}>
                  <div className="library-medicine-head">
                    <strong>Medicine {index + 1}</strong>
                    <button
                      type="button"
                      title="Remove medicine"
                      onClick={() =>
                        update(
                          "medicines",
                          data.medicines.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="library-fields">
                    {medicineFields.map(([label, key]) => (
                      <TextField
                        key={key}
                        label={label}
                        value={medicine[key]}
                        onChange={(value) => updateMedicine(index, key, value)}
                      />
                    ))}
                  </div>
                </section>
              ))}
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  update("medicines", [
                    ...(data.medicines || []),
                    blankMedicine(),
                  ])
                }
              >
                <Plus size={15} /> Add medicine manually
              </button>
              <div className="library-fields library-plan-fields">
                <TextField
                  label="Tests"
                  value={data.tests}
                  onChange={(value) => update("tests", value)}
                  multiline
                />
                <TextField
                  label="Advice"
                  value={data.advice}
                  onChange={(value) => update("advice", value)}
                  multiline
                />
                <TextField
                  label="Follow-up interval"
                  value={data.followUp}
                  onChange={(value) => update("followUp", value)}
                />
              </div>
            </>
          )}
          {type === "ultrasound" && (
            <>
              <p className="library-caution">
                Patient name, exam date, indication and consent are entered in
                the patient form. Leave patient-specific measurements blank in
                reusable templates.
              </p>
              <div className="library-fields">
                {ultrasoundFields.map(([label, key, multiline]) => (
                  <TextField
                    key={key}
                    label={label}
                    value={data[key]}
                    onChange={(value) => update(key, value)}
                    multiline={multiline}
                  />
                ))}
              </div>
            </>
          )}
          {error && <div className="error">{error}</div>}
          {notice && <div className="admin-notice">{notice}</div>}
          <div className="library-actions">
            <button className="primary" disabled={busy}>
              <Save size={16} />{" "}
              {busy ? "Saving…" : editingId ? "Save changes" : "Save template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
