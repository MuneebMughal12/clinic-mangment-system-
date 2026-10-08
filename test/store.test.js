import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { scryptSync } from "node:crypto";
import { openStore } from "../backend/store.js";
import { clinicPreset } from "../shared/clinic-preset.js";

test("fixed stationery preloads the owner and locks clinic identity while allowing one doctor override", () => {
  const directory = mkdtempSync(join(tmpdir(), "clinic-fixed-stationery-"));
  const file = join(directory, "clinic.sqlite");
  let store;
  try {
    store = openStore(file);
    const clinic = store.createClinicAccount({
      fixedStationery: true,
      username: "fixed-owner",
      password: "fixed-password-123",
      clinicName: "Ignored clinic",
      doctorName: "Ignored doctor",
    });
    const owner = store.clinicLogin("fixed-owner", "fixed-password-123");
    assert.equal(clinic.fixedStationery, 1);
    assert.equal(owner.clinicName, clinicPreset.clinicName);
    assert.equal(owner.doctorName, clinicPreset.doctorName);
    assert.equal(owner.doctorNameUrdu, clinicPreset.doctorNameUrdu);
    assert.equal(owner.doctorQualificationPhysician, clinicPreset.doctorQualificationPhysician);
    assert.equal(owner.doctorQualificationUltrasound, clinicPreset.doctorQualificationUltrasound);
    assert.equal(owner.phcRegistration, clinicPreset.phcRegistration);
    assert.throws(() => store.updateClinicProfile(clinic.id, { doctorName: "Changed" }), /fixed/i);
    store.updateClinicAccount(clinic.id, {
      username: "fixed-owner",
      password: "",
      clinicName: "Spoofed clinic",
      doctorName: "Spoofed doctor",
    });
    assert.equal(store.clinicLogin("fixed-owner", "fixed-password-123").clinicName, clinicPreset.clinicName);
    assert.equal(store.clinicLogin("fixed-owner", "fixed-password-123").doctorName, clinicPreset.doctorName);
    const extra = store.createDoctorAccount(clinic.id, {
      username: "other-doctor",
      password: "other-password-123",
      doctorName: "Dr Other",
      doctorQualificationPhysician: "MBBS",
      doctorQualificationUltrasound: "PGD Ultrasound",
      registration: "PMDC-OTHER",
      phcRegistrationOverride: "PHC-OTHER",
    });
    const updated = store.updateClinicProfile(clinic.id, {
      doctorName: "Dr Updated",
      doctorQualificationPhysician: "MBBS, RMP",
      doctorQualificationUltrasound: "PGD Ultrasound",
      registration: "PMDC-UPDATED",
      phcRegistrationOverride: "PHC-UPDATED",
      clinicName: "Spoofed clinic",
      phone: "0000",
    }, extra.userId);
    assert.equal(updated.doctorName, "Dr Updated");
    assert.equal(updated.phcRegistration, "PHC-UPDATED");
    assert.equal(updated.clinicName, clinicPreset.clinicName);
    assert.equal(updated.phone, clinicPreset.phone);
    assert.equal(store.clinicLogin("fixed-owner", "fixed-password-123").phcRegistration, clinicPreset.phcRegistration);
    const record = store.saveEncounter(clinic.id, {
      module: "physician",
      patient: { name: "Test Patient" },
      details: { diagnosis: "Test" },
      finalize: true,
      reviewConfirmed: true,
    }, extra.userId);
    assert.equal(record.printDoctor.doctorName, "Dr Updated");
    assert.equal(record.printDoctor.phcRegistration, "PHC-UPDATED");
    store.close();
    store = openStore(file);
    assert.equal(store.clinicLogin("fixed-owner", "fixed-password-123").clinicName, clinicPreset.clinicName);
    assert.equal(store.getEncounter(clinic.id, record.id).printDoctor.doctorName, "Dr Updated");
  } finally {
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("applying fixed stationery to an older account fills Urdu print details without losing records", () => {
  const directory = mkdtempSync(join(tmpdir(), "clinic-stationery-upgrade-"));
  const file = join(directory, "clinic.sqlite");
  let store;
  try {
    store = openStore(file);
    const clinic = store.createClinicAccount({
      clinicName: "Tahira Memorial Clinic",
      doctorName: "Dr Saadia Qureshi",
      doctorQualification: "Ultrasound only",
      username: "demo",
      password: "original-password-123",
    });
    const draft = store.saveEncounter(clinic.id, {
      module: "physician",
      patient: { name: "Existing Patient" },
      details: { complaints: "Existing draft" },
    });
    assert.equal(store.getEncounter(clinic.id, draft.id).printDoctor.doctorNameUrdu, "");
    store.applyFixedStationery(clinic.id);
    const upgraded = store.clinicLogin("demo", "original-password-123");
    assert.equal(upgraded.fixedStationery, true);
    assert.equal(upgraded.doctorNameUrdu, clinicPreset.doctorNameUrdu);
    assert.equal(upgraded.doctorQualificationPhysician, clinicPreset.doctorQualificationPhysician);
    assert.equal(upgraded.doctorQualificationUltrasound, clinicPreset.doctorQualificationUltrasound);
    assert.equal(store.getEncounter(clinic.id, draft.id).printDoctor.doctorNameUrdu, clinicPreset.doctorNameUrdu);
    assert.equal(store.getEncounter(clinic.id, draft.id).patient.name, "Existing Patient");
  } finally {
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("clinic accounts keep patients and cases separate across restarts", () => {
  const directory = mkdtempSync(join(tmpdir(), "clinic-desk-test-"));
  const file = join(directory, "clinic.sqlite");
  let store;
  try {
    store = openStore(file);
    const first = store.createClinicAccount({
      clinicName: "First Clinic",
      doctorName: "Dr One",
      username: "first",
      password: "pass-first-123",
    });
    const second = store.createClinicAccount({
      clinicName: "Second Clinic",
      doctorName: "Dr Two",
      username: "second",
      password: "pass-second-123",
    });
    assert.equal(store.clinicLogin("FIRST", "pass-first-123")?.id, first.id);
    assert.equal(store.clinicLogin("first", "wrong pass"), null);
    const patient = store.createPatient(first.id, {
      name: "Ayesha",
      ageYears: 30,
    });
    store.startCase(first.id, patient.id, "physician");
    assert.equal(store.getPatient(second.id, patient.id), null);
    assert.throws(() => store.startCase(second.id, patient.id, "ultrasound"));
    assert.equal(store.listPatients(second.id).length, 0);
    assert.equal(store.listCases(second.id, "physician").length, 0);
    assert.deepEqual(store.summary(first.id), {
      todayPatients: 1,
      totalPatients: 1,
      physicianPatients: 1,
      ultrasoundPatients: 0,
      pendingReports: 0,
    });
    assert.deepEqual(store.summary(second.id), {
      todayPatients: 0,
      totalPatients: 0,
      physicianPatients: 0,
      ultrasoundPatients: 0,
      pendingReports: 0,
    });
    store.updateClinicAccount(first.id, {
      clinicName: "Renamed Clinic",
      doctorName: "Dr One",
      username: "newfirst",
      password: "",
    });
    assert.equal(
      store.clinicLogin("newfirst", "pass-first-123")?.clinicName,
      "Renamed Clinic",
    );
    store.close();
    store = openStore(file);
    assert.equal(store.getPatient(first.id, patient.id)?.name, "Ayesha");
  } finally {
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("clinic user can update only its own printable profile", () => {
  const directory = mkdtempSync(join(tmpdir(), "clinic-profile-test-"));
  const file = join(directory, "clinic.sqlite");
  let store;
  try {
    store = openStore(file);
    const first = store.createClinicAccount({
      clinicName: "First Clinic",
      doctorName: "Doctor",
      username: "first",
      password: "password-first",
    });
    const second = store.createClinicAccount({
      clinicName: "Second Clinic",
      doctorName: "Dr Two",
      username: "second",
      password: "password-second",
    });
    const updated = store.updateClinicProfile(first.id, {
      clinicName: "First Clinic Updated",
      doctorName: "Dr One",
      address: "Clinic Road",
      phone: "0300-1234567",
      doctorQualification: "MBBS",
      registration: "PMDC-123",
      phcRegistration: "PHC-REG-123",
      phcLicense: "PHC-LIC-123",
      phcCategory: "Category III — GP clinic",
      username: "hijacked",
      password: "changed-password",
    });
    assert.equal(updated.clinicName, "First Clinic");
    assert.equal(updated.address, "");
    assert.equal(updated.phcCategory, "");
    assert.equal(updated.phcLicense, "");
    assert.equal(
      store.clinicLogin("first", "password-first")?.doctorName,
      "Dr One",
    );
    assert.equal(store.clinicLogin("hijacked", "changed-password"), null);
    assert.equal(
      store.clinicLogin("second", "password-second")?.doctorName,
      "Dr Two",
    );
    assert.throws(() => store.updateClinicProfile(9999, updated), /not found/i);
    const adminUpdated = store.updateClinicAccount(first.id, {
      ...store.listClinicAccounts().find((account) => account.id === first.id),
      clinicName: "First Clinic Updated",
      address: "Clinic Road",
      phone: "0300-1234567",
      phcRegistration: "PHC-REG-123",
      phcLicense: "PHC-LIC-123",
      phcCategory: "Category III — GP clinic",
    });
    assert.equal(adminUpdated.phcCategory, "Category III — GP clinic");
    store.close();
    store = openStore(file);
    assert.equal(
      store.clinicLogin("first", "password-first")?.phcRegistration,
      "PHC-REG-123",
    );
    assert.equal(
      store.clinicLogin("first", "password-first")?.clinicName,
      "First Clinic Updated",
    );
    assert.equal(
      store.listClinicAccounts().find((account) => account.id === second.id)
        .phcLicense,
      "",
    );
  } finally {
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("two doctor logins share one clinic library and keep distinct print identities", () => {
  const directory = mkdtempSync(join(tmpdir(), "clinic-doctors-test-"));
  const file = join(directory, "clinic.sqlite");
  let store;
  try {
    store = openStore(file);
    const clinic = store.createClinicAccount({
      clinicName: "Shared Clinic",
      doctorName: "Dr First",
      username: "first-doctor",
      password: "first-password",
    });
    const second = store.createDoctorAccount(clinic.id, {
      doctorName: "Dr Second",
      doctorQualification: "MBBS",
      registration: "PMDC-SECOND",
      username: "second-doctor",
      password: "second-password",
    });
    assert.throws(
      () =>
        store.createDoctorAccount(clinic.id, {
          doctorName: "Dr Third",
          username: "third-doctor",
          password: "third-password",
        }),
      /one extra doctor login/i,
    );
    assert.equal(
      store.clinicLogin("second-doctor", "second-password")?.clinicId,
      clinic.id,
    );
    assert.equal(store.listDoctorAccounts(clinic.id).length, 2);
    store.updateClinicProfile(
      clinic.id,
      {
        clinicName: "Should not replace shared name",
        doctorName: "Dr Second",
        doctorQualification: "MBBS\nDiagnostic ultrasound",
        doctorNameUrdu: "ڈاکٹر دوم",
        doctorQualificationUrdu: "ایم بی بی ایس\nالٹراساؤنڈ ماہر",
        registration: "PMDC-SECOND",
        phcLicense: "Should not replace shared licence",
      },
      second.userId,
    );
    assert.equal(
      store.clinicLogin("second-doctor", "second-password")?.doctorName,
      "Dr Second",
    );
    assert.equal(
      store.clinicLogin("first-doctor", "first-password")?.doctorName,
      "Dr First",
    );
    assert.equal(
      store.clinicLogin("second-doctor", "second-password")?.clinicName,
      "Shared Clinic",
    );
    store.saveTemplate(clinic.id, {
      type: "medicine",
      name: "Shared medicine",
      data: { name: "Sample medicine", dose: "Doctor review" },
    });
    assert.equal(store.listTemplates(clinic.id).length, 1);
    const visit = store.saveEncounter(
      clinic.id,
      {
        module: "physician",
        patient: { name: "Shared Patient" },
        details: { diagnosis: "Sample diagnosis" },
        finalize: true,
        reviewConfirmed: true,
      },
      second.userId,
    );
    assert.equal(
      store.getEncounter(clinic.id, visit.id).printDoctor.doctorName,
      "Dr Second",
    );
    assert.equal(
      store.getEncounter(clinic.id, visit.id).printDoctor.registration,
      "PMDC-SECOND",
    );
    assert.equal(store.getEncounter(clinic.id, visit.id).printDoctor.doctorNameUrdu, "ڈاکٹر دوم");
    assert.equal(store.getEncounter(clinic.id, visit.id).printDoctor.doctorQualificationUrdu, "ایم بی بی ایس\nالٹراساؤنڈ ماہر");
    assert.equal(store.listPatients(clinic.id).length, 1);
    store.updateClinicProfile(clinic.id, {
      clinicName: "Should not replace shared name",
      doctorName: "Dr First",
      address: "Should not replace address",
      phcLicense: "Should not replace licence",
    });
    assert.equal(
      store.clinicLogin("first-doctor", "first-password")?.phcLicense,
      "",
    );
    store.updateClinicAccount(clinic.id, {
      ...store.listClinicAccounts().find((account) => account.id === clinic.id),
      address: "Clinic Road",
      phcLicense: "PHC-SHARED",
    });
    assert.equal(
      store.clinicLogin("second-doctor", "second-password")?.phcLicense,
      "PHC-SHARED",
    );
    store.updateClinicProfile(
      clinic.id,
      {
        doctorName: "Dr Second Renamed",
        doctorQualification: "MBBS",
        doctorNameUrdu: "ڈاکٹر نیا",
        registration: "PMDC-NEW",
      },
      second.userId,
    );
    assert.equal(
      store.getEncounter(clinic.id, visit.id).printDoctor.doctorName,
      "Dr Second",
    );
    assert.equal(
      store.getEncounter(clinic.id, visit.id).printDoctor.registration,
      "PMDC-SECOND",
    );
    assert.equal(store.getEncounter(clinic.id, visit.id).printDoctor.doctorNameUrdu, "ڈاکٹر دوم");
    const oldHash = store.clinicPasswordHash(clinic.id, second.userId);
    assert.throws(
      () =>
        store.changeDoctorPassword(
          clinic.id,
          second.userId,
          "wrong-password",
          "new-second-password",
        ),
      /incorrect/i,
    );
    store.changeDoctorPassword(
      clinic.id,
      second.userId,
      "second-password",
      "new-second-password",
    );
    assert.equal(store.clinicLogin("second-doctor", "second-password"), null);
    assert.equal(store.clinicSession(clinic.id, oldHash, second.userId), null);
    assert.equal(
      store.clinicLogin("second-doctor", "new-second-password")?.doctorName,
      "Dr Second Renamed",
    );
    store.close();
    store = openStore(file);
    assert.equal(
      store.clinicLogin("second-doctor", "new-second-password")?.doctorName,
      "Dr Second Renamed",
    );
    assert.equal(store.listTemplates(clinic.id).length, 1);
  } finally {
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("owner can release one extra doctor slot without losing recorded identity", () => {
  const directory = mkdtempSync(join(tmpdir(), "clinic-doctor-slot-"));
  const file = join(directory, "clinic.sqlite");
  let store;
  try {
    store = openStore(file);
    const clinic = store.createClinicAccount({
      clinicName: "Shared Clinic",
      doctorName: "Dr Owner",
      username: "owner-slot",
      password: "owner-password",
    });
    const previous = store.createDoctorAccount(clinic.id, {
      doctorName: "Dr Previous",
      username: "previous-doctor",
      password: "previous-password",
    });
    const previousHash = store.clinicPasswordHash(clinic.id, previous.userId);
    const visit = store.saveEncounter(clinic.id, {
      module: "physician",
      patient: { name: "Patient One" },
      details: { diagnosis: "Reviewed" },
      finalize: true,
      reviewConfirmed: true,
    }, previous.userId);
    assert.deepEqual(store.deactivateDoctorAccount(clinic.id, previous.userId), {
      deactivated: true,
      userId: previous.userId,
    });
    assert.equal(store.listDoctorAccounts(clinic.id).length, 1);
    assert.equal(store.clinicLogin("previous-doctor", "previous-password"), null);
    assert.equal(store.clinicSession(clinic.id, previousHash, previous.userId), null);
    assert.equal(store.getEncounter(clinic.id, visit.id).printDoctor.doctorName, "Dr Previous");
    const replacement = store.createDoctorAccount(clinic.id, {
      doctorName: "Dr Replacement",
      username: "replacement-doctor",
      password: "replacement-password",
    });
    assert.equal(store.listDoctorAccounts(clinic.id).length, 2);
    assert.equal(store.clinicLogin("replacement-doctor", "replacement-password")?.userId, replacement.userId);
    assert.throws(() => store.createDoctorAccount(clinic.id, {
      doctorName: "Dr Third",
      username: "third-slot",
      password: "third-password",
    }), /one extra doctor login/i);
    assert.throws(() => store.deactivateDoctorAccount(clinic.id, previous.userId), /not found/i);
    store.close();
    store = openStore(file);
    assert.equal(store.getEncounter(clinic.id, visit.id).printDoctor.doctorName, "Dr Previous");
    assert.equal(store.clinicLogin("replacement-doctor", "replacement-password")?.doctorName, "Dr Replacement");
  } finally {
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("legacy doctor login and patients migrate without data loss", () => {
  const directory = mkdtempSync(join(tmpdir(), "clinic-desk-legacy-"));
  const file = join(directory, "clinic.sqlite");
  const db = new DatabaseSync(file);
  const salt = "legacy-salt";
  db.exec(`CREATE TABLE doctor_account (id INTEGER PRIMARY KEY, doctor_name TEXT, password_salt TEXT, password_hash TEXT, created_at TEXT);
    CREATE TABLE patients (id INTEGER PRIMARY KEY AUTOINCREMENT, mr_number TEXT UNIQUE, name TEXT NOT NULL,
    age_years INTEGER, date_of_birth TEXT, gender TEXT, relationship TEXT, phone TEXT, address TEXT,
    allergies TEXT, medical_history TEXT, current_medications TEXT, created_at TEXT NOT NULL);
    CREATE TABLE cases (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER, module TEXT, status TEXT, created_at TEXT);`);
  db.prepare("INSERT INTO doctor_account VALUES (1, ?, ?, ?, ?)").run(
    "Dr Legacy",
    salt,
    scryptSync("old-pass-123", salt, 64).toString("hex"),
    new Date().toISOString(),
  );
  db.prepare(
    "INSERT INTO patients (id, mr_number, name, created_at) VALUES (1, 'MR-00001', 'Old Patient', ?)",
  ).run(new Date().toISOString());
  db.prepare(
    "INSERT INTO cases (patient_id, module, status, created_at) VALUES (1, 'physician', 'draft', ?)",
  ).run(new Date().toISOString());
  db.close();
  let store;
  try {
    store = openStore(file);
    const clinic = store.clinicLogin("doctor", "old-pass-123");
    assert.equal(clinic.doctorName, "Dr Legacy");
    assert.equal(store.getPatient(clinic.id, 1)?.name, "Old Patient");
    assert.equal(store.summary(clinic.id).physicianPatients, 1);
    assert.deepEqual(store.getEncounter(clinic.id, 1)?.details, {});
    assert.equal(existsSync(`${file}.before-admin-migration.bak`), true);
  } finally {
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("one form save creates patient and visit together, and existing patient is reused", () => {
  const store = openStore(":memory:");
  try {
    const clinic = store.createClinicAccount({
      clinicName: "Test Clinic",
      doctorName: "Dr Test",
      username: "tester",
      password: "secure-pass-123",
    });
    const other = store.createClinicAccount({
      clinicName: "Other Clinic",
      doctorName: "Dr Other",
      username: "other",
      password: "secure-pass-456",
    });
    assert.throws(() =>
      store.saveEncounter(clinic.id, {
        module: "physician",
        patient: { name: "" },
        details: { complaints: "Pain" },
      }),
    );
    assert.equal(store.summary(clinic.id).totalPatients, 0);
    const physician = store.saveEncounter(clinic.id, {
      module: "physician",
      patient: { name: "Ayesha", ageYears: 30 },
      details: { complaints: "Pain", medicines: [] },
    });
    assert.equal(physician.patient.name, "Ayesha");
    assert.equal(physician.details.complaints, "Pain");
    const ultrasound = store.saveEncounter(clinic.id, {
      module: "ultrasound",
      patientId: physician.patientId,
      details: { reportType: "Female Pelvis", impression: "Entered by doctor" },
    });
    assert.equal(ultrasound.patientId, physician.patientId);
    assert.deepEqual(store.summary(clinic.id), {
      todayPatients: 1,
      totalPatients: 1,
      physicianPatients: 1,
      ultrasoundPatients: 1,
      pendingReports: 1,
    });
    assert.equal(store.getEncounter(clinic.id, physician.id)?.visitNumber, 1);
    const secondVisit = store.saveEncounter(clinic.id, {
      module: "physician",
      patientId: physician.patientId,
      details: { complaints: "Follow-up" },
    });
    assert.equal(secondVisit.visitNumber, 2);
    assert.equal(store.getEncounter(clinic.id, physician.id)?.visitNumber, 1);
    store.saveEncounter(clinic.id, {
      module: "physician",
      caseId: physician.id,
      details: { complaints: "Updated" },
    });
    assert.equal(
      store.getEncounter(clinic.id, physician.id)?.details.complaints,
      "Updated",
    );
    assert.equal(store.getEncounter(other.id, physician.id), null);
    assert.throws(() =>
      store.saveEncounter(other.id, {
        module: "physician",
        caseId: physician.id,
        details: { complaints: "No access" },
      }),
    );
    assert.throws(() =>
      store.saveEncounter(other.id, {
        module: "ultrasound",
        patientId: physician.patientId,
        details: { impression: "No access" },
      }),
    );
    assert.equal(store.summary(other.id).totalPatients, 0);
  } finally {
    store.close();
  }
});

test("saved templates are editable and private to each clinic", () => {
  const store = openStore(":memory:");
  try {
    const first = store.createClinicAccount({
      clinicName: "Clinic A",
      doctorName: "Dr A",
      username: "clinic-a",
      password: "password-a",
      address: "Main Road",
      phone: "123",
      doctorQualification: "MBBS",
      registration: "REG-1",
    });
    const second = store.createClinicAccount({
      clinicName: "Clinic B",
      doctorName: "Dr B",
      username: "clinic-b",
      password: "password-b",
    });
    assert.equal(
      store.clinicLogin("clinic-a", "password-a").address,
      "Main Road",
    );
    assert.equal(
      store.clinicLogin("clinic-a", "password-a").registration,
      "REG-1",
    );
    const saved = store.saveTemplate(first.id, {
      type: "medicine",
      name: "Tablet A",
      data: { name: "Tablet A", dose: "1 tablet", frequency: "Twice daily" },
    });
    assert.equal(
      store.listTemplates(first.id, "medicine")[0].data.frequency,
      "Twice daily",
    );
    assert.equal(store.listTemplates(second.id).length, 0);
    assert.throws(
      () =>
        store.saveTemplate(first.id, {
          type: "medicine",
          name: "tablet a",
          data: {},
        }),
      /already exists/i,
    );
    assert.throws(
      () => store.deleteTemplate(second.id, saved.id),
      /not found/i,
    );
    store.saveTemplate(first.id, {
      id: saved.id,
      type: "medicine",
      name: "Tablet A",
      data: { name: "Tablet A", dose: "2 tablets" },
    });
    assert.equal(store.listTemplates(first.id)[0].data.dose, "2 tablets");
    store.deleteTemplate(first.id, saved.id);
    assert.equal(store.listTemplates(first.id).length, 0);
  } finally {
    store.close();
  }
});

test("doctor finalization preserves an amendment history and enforces consent", () => {
  const store = openStore(":memory:");
  try {
    const clinic = store.createClinicAccount({
      clinicName: "Clinic A",
      doctorName: "Dr A",
      username: "clinic-a",
      password: "password-a",
    });
    const other = store.createClinicAccount({
      clinicName: "Clinic B",
      doctorName: "Dr B",
      username: "clinic-b",
      password: "password-b",
    });
    const input = {
      module: "physician",
      patient: { name: "Patient A" },
      details: { diagnosis: "Initial diagnosis", advice: "Initial advice" },
      finalize: true,
    };
    assert.throws(() => store.saveEncounter(clinic.id, input), /review/i);
    assert.equal(store.summary(clinic.id).totalPatients, 0);
    const final = store.saveEncounter(clinic.id, {
      ...input,
      reviewConfirmed: true,
    });
    assert.equal(final.status, "final");
    assert.equal(final.finalizedBy, "Dr A");
    assert.ok(final.finalizedAt);
    assert.throws(
      () =>
        store.saveEncounter(clinic.id, {
          module: "physician",
          caseId: final.id,
          details: { diagnosis: "Revised" },
        }),
      /amendment reason/i,
    );
    assert.equal(
      store.getEncounter(clinic.id, final.id).details.diagnosis,
      "Initial diagnosis",
    );
    const amended = store.saveEncounter(clinic.id, {
      module: "physician",
      caseId: final.id,
      details: { diagnosis: "Revised" },
      amendmentReason: "Correction after review",
    });
    assert.equal(amended.status, "final");
    assert.equal(amended.revision, 1);
    const history = store.listAmendments(clinic.id, final.id);
    assert.equal(history[0].previousDetails.diagnosis, "Initial diagnosis");
    assert.equal(history[0].newDetails.diagnosis, "Revised");
    assert.equal(history[0].amendedBy, "Dr A");
    assert.deepEqual(
      store.listCaseEvents(clinic.id, final.id).map((event) => event.eventType),
      ["amended", "created_final"],
    );
    assert.throws(() => store.listAmendments(other.id, final.id), /not found/i);
    assert.throws(() => store.listCaseEvents(other.id, final.id), /not found/i);
    assert.throws(
      () =>
        store.saveEncounter(clinic.id, {
          module: "ultrasound",
          patientId: final.patientId,
          details: {
            technique: "Transvaginal",
            impression: "Findings",
            transvaginalPerformed: true,
            consentRecorded: false,
          },
          finalize: true,
          reviewConfirmed: true,
        }),
      /consent/i,
    );
    assert.equal(store.summary(clinic.id).ultrasoundPatients, 0);
  } finally {
    store.close();
  }
});

test("SQLite backup can be reopened with patients and final records intact", () => {
  const directory = mkdtempSync(join(tmpdir(), "clinic-desk-backup-"));
  const source = join(directory, "source.sqlite");
  const snapshot = join(directory, "snapshot.sqlite");
  let store;
  let restored;
  try {
    store = openStore(source);
    const clinic = store.createClinicAccount({
      clinicName: "Backup Clinic",
      doctorName: "Dr Backup",
      username: "backup-clinic",
      password: "password-a",
      phcRegistration: "PHC-TEST",
    });
    const visit = store.saveEncounter(clinic.id, {
      module: "physician",
      patient: { name: "Patient A" },
      details: { diagnosis: "Reviewed" },
      finalize: true,
      reviewConfirmed: true,
    });
    store.backupTo(snapshot);
    assert.equal(existsSync(snapshot), true);
    restored = openStore(snapshot);
    assert.equal(
      restored.clinicLogin("backup-clinic", "password-a").phcRegistration,
      "PHC-TEST",
    );
    assert.equal(restored.getEncounter(clinic.id, visit.id).status, "final");
    assert.equal(
      restored.getEncounter(clinic.id, visit.id).patient.name,
      "Patient A",
    );
    assert.throws(() => store.backupTo(snapshot), /new backup/i);
  } finally {
    restored?.close();
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
