import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { openStore } from "../backend/store.js";

const dataDir =
  process.env.CLINIC_DESK_DATA_DIR || join(process.env.APPDATA, "clinic-desk");
const store = openStore(join(dataDir, "clinic.sqlite"));
const sample = "DEMO ONLY — replace after doctor review";
const medicineA = {
  name: "DEMO Tablet A",
  strength: "Sample strength",
  dose: "Doctor to enter",
  route: "Oral",
  frequency: "Doctor to enter timing",
  food: "Doctor to enter food instruction",
  duration: "Doctor to enter duration",
};
const medicineB = {
  name: "DEMO Syrup B",
  strength: "Sample strength",
  dose: "Doctor to enter",
  route: "Oral",
  frequency: "Doctor to enter timing",
  food: "Doctor to enter food instruction",
  duration: "Doctor to enter duration",
};
const physicianPlan = {
  diagnosis: "Demo fever entry — confirm diagnosis",
  medicines: [medicineA, medicineB],
  tests: "DEMO test request — doctor to confirm",
  advice: "Sample advice for print layout. Doctor must replace this text.",
  followUp: "Doctor to enter follow-up",
};
const ultrasoundReport = {
  reportType: "Female Pelvis",
  technique: "DEMO technique — confirm how the examination was performed.",
  bladder: "DEMO bladder finding — replace after examination.",
  uterusPosition: "Doctor to enter",
  uterusSize: "",
  myometrium: "DEMO myometrium finding — replace after examination.",
  endometrialThickness: "",
  endometrialPattern: "DEMO endometrial finding — replace after examination.",
  cervix: "DEMO cervix finding — replace after examination.",
  rightOvarySize: "",
  rightOvaryVolume: "",
  rightOvaryFindings: "DEMO right ovary finding — replace after examination.",
  leftOvarySize: "",
  leftOvaryVolume: "",
  leftOvaryFindings: "DEMO left ovary finding — replace after examination.",
  adnexa: "DEMO adnexa finding — replace after examination.",
  pouchOfDouglas: "DEMO finding — replace after examination.",
  impression: "DEMO impression only. Doctor must review and replace.",
};
const patients = [
  {
    name: "DEMO Patient 01 — Physician",
    ageYears: 34,
    gender: "Female",
    modules: ["physician"],
  },
  {
    name: "DEMO Patient 02 — Ultrasound",
    ageYears: 29,
    gender: "Female",
    modules: ["ultrasound"],
  },
  {
    name: "DEMO Patient 03 — Both",
    ageYears: 42,
    gender: "Female",
    modules: ["physician", "ultrasound"],
  },
  {
    name: "DEMO Patient 04 — Physician",
    ageYears: 51,
    gender: "Male",
    modules: ["physician"],
  },
  {
    name: "DEMO Patient 05 — Ultrasound",
    ageYears: 37,
    gender: "Female",
    modules: ["ultrasound"],
  },
];

try {
  const existing = store
    .listClinicAccounts()
    .find((account) => account.username.toLowerCase() === "demo");
  if (existing && store.summary(existing.id).totalPatients > 0) {
    throw new Error(
      "Demo account already has records; no sample data was changed.",
    );
  }
  const backupDir = join(dataDir, "backups");
  mkdirSync(backupDir, { recursive: true });
  const backup = join(backupDir, `before-demo-seed-${Date.now()}.sqlite`);
  store.backupTo(backup);
  let password = null;
  let account = existing;
  if (!account) {
    password = randomBytes(18).toString("base64url");
    account = store.createClinicAccount({
      clinicName: "Demo Clinic — Print Test",
      doctorName: "Dr Demo",
      username: "demo",
      password,
      address: "Sample clinic address — print layout test",
      doctorQualification: "Demo record",
    });
  }
  for (const [type, name, data] of [
    ["medicine", "DEMO Tablet A — print test", medicineA],
    ["medicine", "DEMO Syrup B — print test", medicineB],
    ["diagnosis", "Demo Fever Plan — print test", physicianPlan],
    ["ultrasound", "Female Pelvis — demo print test", ultrasoundReport],
  ]) {
    if (
      !store.listTemplates(account.id, type).some((item) => item.name === name)
    )
      store.saveTemplate(account.id, { type, name, data });
  }
  for (const [index, item] of patients.entries()) {
    for (const module of item.modules) {
      store.saveEncounter(account.id, {
        module,
        patient:
          module === item.modules[0]
            ? {
                name: item.name,
                ageYears: item.ageYears,
                gender: item.gender,
                phone: `0300-00000${String(index + 1).padStart(2, "0")}`,
                address: "Demo address for print layout",
              }
            : undefined,
        patientId:
          module === item.modules[0]
            ? undefined
            : store.listPatients(account.id, item.name)[0].id,
        details:
          module === "physician"
            ? {
                complaints:
                  "Sample complaint text to check spacing and wrapping.",
                symptoms: "DEMO symptoms — doctor to replace.",
                findings: "DEMO examination findings — doctor to replace.",
                diagnosis: physicianPlan.diagnosis,
                bp: "—",
                pulse: "—",
                temperature: "—",
                respiratoryRate: "—",
                spo2: "—",
                weight: "—",
                triage: "Not assessed — demo",
                condition: "Demo only",
                medicines: structuredClone(physicianPlan.medicines),
                tests: physicianPlan.tests,
                advice: physicianPlan.advice,
                followUp: physicianPlan.followUp,
              }
            : {
                ...structuredClone(ultrasoundReport),
                referringPhysician: "DEMO referring physician",
                examinationDate: new Date().toISOString().slice(0, 10),
                clinicalIndication: "DEMO indication — doctor to replace.",
                transvaginalPerformed: false,
                consentRecorded: false,
              },
      });
    }
  }
  console.log(
    JSON.stringify(
      {
        username: account.username,
        password,
        summary: store.summary(account.id),
        templates: store
          .listTemplates(account.id)
          .map(({ type, name }) => ({ type, name })),
        backup,
        note: sample,
      },
      null,
      2,
    ),
  );
} finally {
  store.close();
}
