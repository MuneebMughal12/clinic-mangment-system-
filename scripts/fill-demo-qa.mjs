import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openStore } from "../backend/store.js";

// Populates only the original, untouched demo fixtures. Never target a client clinic.
const dataDir =
  process.env.CLINIC_DESK_DATA_DIR || join(process.env.APPDATA, "clinic-desk");
const dbPath = join(dataDir, "clinic.sqlite");
const store = openStore(dbPath);
const originals = [
  "DEMO Patient 01 — Physician",
  "DEMO Patient 02 — Ultrasound",
  "DEMO Patient 03 — Both",
  "DEMO Patient 04 — Physician",
  "DEMO Patient 05 — Ultrasound",
];
const people = [
  { name: "SAMPLE Ayesha Malik — Physician", age: 34, dob: "1992-04-12", gender: "Female", relation: "D/o Rashid Malik", phone: "0300-0000101", address: "Sample address, Sohawa", allergies: "None recorded (sample)", history: "No prior surgery recorded (sample)", current: "None recorded (sample)" },
  { name: "SAMPLE Sana Ahmed — Ultrasound", age: 29, dob: "1997-02-16", gender: "Female", relation: "D/o Imran Ahmed", phone: "0300-0000102", address: "Sample address, Jhelum", allergies: "None recorded (sample)", history: "No relevant history recorded (sample)", current: "None recorded (sample)" },
  { name: "SAMPLE Hina Farooq — Both", age: 42, dob: "1984-05-09", gender: "Female", relation: "W/o Usman Farooq", phone: "0300-0000103", address: "Sample address, Dina", allergies: "None recorded (sample)", history: "Previous clinic visit recorded (sample)", current: "None recorded (sample)" },
  { name: "SAMPLE Bilal Raza — Physician", age: 51, dob: "1975-03-21", gender: "Male", relation: "S/o Akram Raza", phone: "0300-0000104", address: "Sample address, Gujar Khan", allergies: "None recorded (sample)", history: "No relevant history recorded (sample)", current: "None recorded (sample)" },
  { name: "SAMPLE Rabia Noor — Ultrasound", age: 37, dob: "1989-01-27", gender: "Female", relation: "W/o Kamran Noor", phone: "0300-0000105", address: "Sample address, Sohawa", allergies: "None recorded (sample)", history: "No relevant history recorded (sample)", current: "None recorded (sample)" },
];
const tablet = {
  name: "SAMPLE Tablet A", strength: "Example strength",
  dose: "1 tablet (example)", route: "Oral", frequency: "Morning and evening (example)",
  food: "After food (example)", duration: "3 days (example)",
};
const syrup = {
  name: "SAMPLE Syrup B", strength: "Example strength",
  dose: "5 mL (example)", route: "Oral", frequency: "At night (example)",
  food: "After food (example)", duration: "3 days (example)",
};
const physician = [
  {
    complaints: "Fever and tiredness for two days (sample history).",
    symptoms: "Intermittent fever and reduced appetite (sample).",
    findings: "Alert; no acute distress described (sample examination).",
    diagnosis: "Sample febrile illness — doctor to confirm",
    bp: "118/76", pulse: "82", temperature: "37.8 °C", respiratoryRate: "18", spo2: "98", weight: "61",
    triage: "Non urgent (sample)", condition: "Stable (sample)",
    medicines: [tablet, syrup], tests: "CBC (example request; doctor to confirm)",
    advice: "Sample instructions only. Doctor must verify all clinical content before use.",
    followUp: "After 3 days (example)",
  },
  {
    complaints: "Lower abdominal discomfort (sample history).",
    symptoms: "Intermittent discomfort; no additional symptoms recorded (sample).",
    findings: "General condition stable (sample examination).",
    diagnosis: "Lower abdominal pain — sample entry, pending review",
    bp: "112/72", pulse: "78", temperature: "36.8 °C", respiratoryRate: "17", spo2: "99", weight: "66",
    triage: "Non urgent (sample)", condition: "Stable (sample)",
    medicines: [tablet], tests: "Pelvic ultrasound (example request)",
    advice: "Sample advice; review symptoms and test findings before clinical decisions.",
    followUp: "After report review (example)",
  },
  {
    complaints: "Routine check-up and headache (sample history).",
    symptoms: "Occasional headache (sample).",
    findings: "Comfortable at rest (sample examination).",
    diagnosis: "Headache — sample entry, doctor to assess",
    bp: "126/82", pulse: "76", temperature: "36.7 °C", respiratoryRate: "16", spo2: "98", weight: "75",
    triage: "Non urgent (sample)", condition: "Stable (sample)",
    medicines: [syrup], tests: "No test selected (sample)",
    advice: "Sample patient advice only; replace after doctor review.",
    followUp: "After 1 week (example)",
  },
];
const ultrasoundBase = {
  reportType: "Female Pelvis",
  referringPhysician: "Dr Sample Referrer",
  examinationDate: new Date().toISOString().slice(0, 10),
  clinicalIndication: "Pelvic assessment (sample indication).",
  technique: "Transabdominal pelvic ultrasound with a distended urinary bladder (sample technique).",
  bladder: "Well distended with smooth walls; no focal lesion seen (sample finding).",
  uterusPosition: "Anteverted", uterusSize: "7.2 × 3.8 × 4.4",
  myometrium: "Homogeneous; no focal lesion seen (sample finding).",
  endometrialThickness: "7", endometrialPattern: "Uniform appearance (sample finding).",
  cervix: "Unremarkable (sample finding).",
  rightOvarySize: "3.1 × 2.0 × 2.2", rightOvaryVolume: "7.1",
  rightOvaryFindings: "Follicles seen; no mass (sample finding).",
  leftOvarySize: "3.0 × 1.9 × 2.1", leftOvaryVolume: "6.3",
  leftOvaryFindings: "Follicles seen; no mass (sample finding).",
  adnexa: "No adnexal mass identified (sample finding).",
  pouchOfDouglas: "No free fluid seen (sample finding).",
  impression: "Illustrative normal pelvis report. All observations and measurements are fictional and require doctor review.",
  transvaginalPerformed: false, consentRecorded: false,
};
const ultrasound = [
  { ...ultrasoundBase, clinicalIndication: "Cycle-related pelvic pain (sample indication)." },
  { ...ultrasoundBase, clinicalIndication: "Lower abdominal discomfort (sample indication).", uterusSize: "7.4 × 3.9 × 4.3", endometrialThickness: "8" },
  { ...ultrasoundBase, clinicalIndication: "Follow-up pelvic assessment (sample indication).", technique: "Transabdominal and consented transvaginal pelvic ultrasound (sample technique).", transvaginalPerformed: true, consentRecorded: true },
];
const caseDetails = new Map([[1, physician[0]], [2, ultrasound[0]], [3, physician[1]], [4, ultrasound[1]], [5, physician[2]], [6, ultrasound[2]]]);

try {
  const account = store.listClinicAccounts().find((row) => row.username.toLowerCase() === "demo");
  if (!account || !["Demo Clinic — Print Test", "Tahira Memorial Clinic"].includes(account.clinicName))
    throw new Error("The original demo clinic was not found; no data changed.");
  const rows = store.listPatients(account.id);
  if (rows.length !== 5 || originals.some((name, i) => !rows.some((row) => row.name === name || row.name === people[i].name)))
    throw new Error("Demo patients have changed; no data changed.");
  for (const [id, details] of caseDetails) {
    const encounter = store.getEncounter(account.id, id);
    if (!encounter || (encounter.module === "physician") !== (id % 2 === 1))
      throw new Error("Demo case layout has changed; no data changed.");
    if (!encounter.details.diagnosis?.includes("Demo fever") && !encounter.details.technique?.startsWith("DEMO technique") && JSON.stringify(encounter.details) !== JSON.stringify(details) && !(id === 6 && encounter.details.clinicalIndication === details.clinicalIndication && encounter.details.impression === details.impression))
      throw new Error(`Case ${id} has been edited; no data changed.`);
  }
  const backupDir = join(dataDir, "backups");
  mkdirSync(backupDir, { recursive: true });
  const backup = join(backupDir, `before-demo-qa-${Date.now()}.sqlite`);
  store.backupTo(backup);

  const db = new DatabaseSync(dbPath);
  try {
    const update = db.prepare(`UPDATE patients SET name=?, age_years=?, date_of_birth=?, gender=?, relationship=?, phone=?, address=?, allergies=?, medical_history=?, current_medications=? WHERE id=? AND clinic_id=? AND name=?`);
    for (const [index, original] of originals.entries()) {
      const person = people[index];
      const row = rows.find((patient) => patient.name === original);
      if (!row) continue;
      const result = update.run(person.name, person.age, person.dob, person.gender, person.relation, person.phone, person.address, person.allergies, person.history, person.current, row.id, account.id, original);
      if (result.changes !== 1) throw new Error(`Could not update sample patient ${index + 1}.`);
    }
  } finally {
    db.close();
  }

  for (const [id, details] of caseDetails) {
    const existing = store.getEncounter(account.id, id);
    if (JSON.stringify(existing.details) === JSON.stringify(details)) continue;
    store.saveEncounter(account.id, {
      caseId: id,
      module: existing.module,
      details,
      ...(existing.status === "final" ? { amendmentReason: "Replace original demo placeholder with fictional QA sample" } : {}),
    });
  }
  for (const [module, patientName, details] of [
    ["physician", people[0].name, { ...physician[0], complaints: "SAMPLE TODAY: fever follow-up for dashboard and print testing." }],
    ["ultrasound", people[1].name, { ...ultrasound[0], clinicalIndication: "SAMPLE TODAY: pelvic assessment for dashboard and print testing." }],
  ]) {
    const patient = store.listPatients(account.id).find((row) => row.name === patientName);
    const marker = module === "physician" ? details.complaints : details.clinicalIndication;
    const alreadyPresent = store.listCases(account.id, module).some((row) => {
      if (row.patientId !== patient.id) return false;
      const saved = store.getEncounter(account.id, row.id).details;
      return (module === "physician" ? saved.complaints : saved.clinicalIndication) === marker;
    });
    if (!alreadyPresent) store.saveEncounter(account.id, { module, patientId: patient.id, details });
  }
  const templates = store.listTemplates(account.id);
  for (const [type, oldName, name, data] of [
    ["medicine", "DEMO Tablet A — print test", "SAMPLE Tablet A — example directions", tablet],
    ["medicine", "DEMO Syrup B — print test", "SAMPLE Syrup B — example directions", syrup],
    ["diagnosis", "Demo Fever Plan — print test", "SAMPLE Fever Plan — doctor review required", { diagnosis: physician[0].diagnosis, medicines: [tablet, syrup], tests: physician[0].tests, advice: physician[0].advice, followUp: physician[0].followUp }],
    ["ultrasound", "Female Pelvis — demo print test", "SAMPLE Female Pelvis — full report", ultrasoundBase],
  ]) {
    const existing = templates.find((row) => row.type === type && row.name === name);
    if (existing) continue;
    const original = templates.find((row) => row.type === type && row.name === oldName);
    if (original) store.saveTemplate(account.id, { id: original.id, type, name, data });
    else store.saveTemplate(account.id, { type, name, data });
  }
  console.log(JSON.stringify({ account: account.username, backup, summary: store.summary(account.id), templates: store.listTemplates(account.id).length, note: "All inserted clinical findings and measurements are fictional QA samples." }, null, 2));
} finally {
  store.close();
}
