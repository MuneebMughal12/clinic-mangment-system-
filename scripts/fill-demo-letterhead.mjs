import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openStore } from "../backend/store.js";

// The values below are transcribed from the clinic artwork supplied for QA.
// This script changes only the known demo account and its original demo report.
const dataDir =
  process.env.CLINIC_DESK_DATA_DIR || join(process.env.APPDATA, "clinic-desk");
const dbPath = join(dataDir, "clinic.sqlite");
const store = openStore(dbPath);
const details = {
  clinicName: "Tahira Memorial Clinic",
  doctorName: "Dr Saadia Qureshi",
  username: "demo",
  address: "Sohawa, Distt. Jhelum",
  phone: "0335 0222122",
  doctorQualification:
    "MBBS, PGD in Medical Diagnostic Ultrasound\nEx Senior Specialist Registrar\nDepartment of Clinical and Diagnostic Radiology, CMH Kharian",
  registration: "102625-P",
  phcRegistration: "R-694949",
  phcLicense: "",
  phcCategory: "",
};

try {
  const account = store.listClinicAccounts().find((row) => row.username === "demo");
  if (!account || !["Demo Clinic — Print Test", details.clinicName].includes(account.clinicName))
    throw new Error("Expected demo account not found. No letterhead data changed.");
  if (account.clinicName === details.clinicName) {
    console.log("Demo letterhead is already filled.");
    process.exitCode = 0;
  } else {
    const originalReport = store.getEncounter(account.id, 6);
    if (!originalReport || originalReport.module !== "ultrasound" || originalReport.printDoctor?.doctorName !== "Dr Demo")
      throw new Error("Original demo report was changed. No letterhead data changed.");
    const backupDir = join(dataDir, "backups");
    mkdirSync(backupDir, { recursive: true });
    const backup = join(backupDir, `before-demo-letterhead-${Date.now()}.sqlite`);
    store.backupTo(backup);
    store.updateClinicAccount(account.id, details);
    // The original final report is a fictional fixture. Refresh its frozen
    // print identity so every demo preview uses the reference letterhead.
    const db = new DatabaseSync(dbPath);
    try {
      const result = db.prepare(`UPDATE cases SET doctor_snapshot_json = ?, finalized_by = ?
        WHERE id = ? AND patient_id IN (SELECT id FROM patients WHERE clinic_id = ?)
        AND doctor_snapshot_json = ?`).run(
          JSON.stringify({ doctorName: details.doctorName, doctorQualification: details.doctorQualification, registration: details.registration }),
          details.doctorName,
          6,
          account.id,
          JSON.stringify(originalReport.printDoctor),
        );
      if (result.changes !== 1) throw new Error("Could not refresh original demo report identity.");
    } finally {
      db.close();
    }
    console.log(JSON.stringify({ clinic: details.clinicName, doctor: details.doctorName, phone: details.phone, backup, note: "Demo records remain fictional samples." }, null, 2));
  }
} finally {
  store.close();
}
