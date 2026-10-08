import { DatabaseSync } from "node:sqlite";
import { existsSync, unlinkSync } from "node:fs";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { clinicPreset } from "../shared/clinic-preset.js";

const patientColumns = `
  id, mr_number AS mrNumber, name, age_years AS ageYears,
  date_of_birth AS dateOfBirth, gender, relationship, phone, address,
  allergies, medical_history AS medicalHistory,
  current_medications AS currentMedications, created_at AS createdAt
`;

function clean(value, max = 500) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function validatePassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  ) {
    throw new Error("Password must be 8 to 128 characters long.");
  }
}

function passwordFields(password) {
  validatePassword(password);
  const salt = randomBytes(32).toString("hex");
  return { salt, hash: scryptSync(password, salt, 64).toString("hex") };
}

function checkPassword(password, salt, hash) {
  if (typeof password !== "string" || password.length > 128) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function validateAccount(input, updating = false) {
  const clinicName = clean(input?.clinicName, 150);
  const doctorName = clean(input?.doctorName, 120);
  const username = clean(input?.username, 60);
  if (!clinicName || !doctorName || !username) {
    throw new Error("Clinic name, doctor name, and username are required.");
  }
  if (!/^[a-zA-Z0-9._-]{3,60}$/.test(username)) {
    throw new Error(
      "Username must be 3–60 characters using letters, numbers, dots, dashes, or underscores.",
    );
  }
  if (!updating || input?.password) validatePassword(input?.password);
  return {
    clinicName,
    doctorName,
    username,
    address: clean(input?.address, 300),
    phone: clean(input?.phone, 60),
    doctorQualification: clean(input?.doctorQualification, 250),
    registration: clean(input?.registration, 120),
    phcRegistration: clean(input?.phcRegistration, 120),
    phcLicense: clean(input?.phcLicense, 120),
    phcCategory: clean(input?.phcCategory, 120),
  };
}

export function openStore(filePath) {
  const db = new DatabaseSync(filePath);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS doctor_account (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      doctor_name TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS clinics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_name TEXT NOT NULL,
      doctor_name TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      doctor_qualification TEXT NOT NULL DEFAULT '',
      doctor_qualification_physician TEXT NOT NULL DEFAULT '',
      doctor_qualification_ultrasound TEXT NOT NULL DEFAULT '',
      doctor_name_urdu TEXT NOT NULL DEFAULT '',
      doctor_qualification_urdu TEXT NOT NULL DEFAULT '',
      registration TEXT NOT NULL DEFAULT '',
      fixed_stationery INTEGER NOT NULL DEFAULT 0,
    phc_registration TEXT NOT NULL DEFAULT '',
    phc_license TEXT NOT NULL DEFAULT '',
    phc_category TEXT NOT NULL DEFAULT '',
      username TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS clinic_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER NOT NULL REFERENCES clinics(id),
      username TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      doctor_name TEXT NOT NULL DEFAULT 'Doctor',
      doctor_qualification TEXT NOT NULL DEFAULT '',
      doctor_qualification_physician TEXT NOT NULL DEFAULT '',
      doctor_qualification_ultrasound TEXT NOT NULL DEFAULT '',
      doctor_name_urdu TEXT NOT NULL DEFAULT '',
      doctor_qualification_urdu TEXT NOT NULL DEFAULT '',
      registration TEXT NOT NULL DEFAULT '',
      phc_registration_override TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS clinic_users_clinic_idx ON clinic_users(clinic_id);
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER NOT NULL REFERENCES clinics(id),
      mr_number TEXT UNIQUE,
      name TEXT NOT NULL,
      age_years INTEGER,
      date_of_birth TEXT,
      gender TEXT,
      relationship TEXT,
      phone TEXT,
      address TEXT,
      allergies TEXT,
      medical_history TEXT,
      current_medications TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      module TEXT NOT NULL CHECK (module IN ('physician', 'ultrasound')),
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
      details_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT,
      finalized_at TEXT,
      finalized_by TEXT,
      doctor_user_id INTEGER REFERENCES clinic_users(id),
      finalized_by_user_id INTEGER REFERENCES clinic_users(id),
      doctor_snapshot_json TEXT,
      revision INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS cases_patient_module_idx ON cases(patient_id, module);
    CREATE TABLE IF NOT EXISTS case_amendments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(id),
      previous_details_json TEXT NOT NULL,
      new_details_json TEXT NOT NULL,
      reason TEXT NOT NULL,
      amended_by TEXT NOT NULL,
      amended_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS case_amendments_case_idx ON case_amendments(case_id, id);
    CREATE TABLE IF NOT EXISTS case_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(id),
      event_type TEXT NOT NULL,
      actor TEXT NOT NULL,
      occurred_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS case_events_case_idx ON case_events(case_id, id);
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER NOT NULL REFERENCES clinics(id),
      type TEXT NOT NULL CHECK (type IN ('medicine', 'diagnosis', 'ultrasound')),
      name TEXT NOT NULL COLLATE NOCASE,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(clinic_id, type, name)
    );
  `);

  const clinicColumns = new Set(
    db
      .prepare("PRAGMA table_info(clinics)")
      .all()
      .map((column) => column.name),
  );
  for (const [column, definition] of [
    ["address", "TEXT NOT NULL DEFAULT ''"],
    ["phone", "TEXT NOT NULL DEFAULT ''"],
    ["doctor_qualification", "TEXT NOT NULL DEFAULT ''"],
    ["doctor_qualification_physician", "TEXT NOT NULL DEFAULT ''"],
    ["doctor_qualification_ultrasound", "TEXT NOT NULL DEFAULT ''"],
    ["doctor_name_urdu", "TEXT NOT NULL DEFAULT ''"],
    ["doctor_qualification_urdu", "TEXT NOT NULL DEFAULT ''"],
    ["registration", "TEXT NOT NULL DEFAULT ''"],
    ["fixed_stationery", "INTEGER NOT NULL DEFAULT 0"],
    ["phc_registration", "TEXT NOT NULL DEFAULT ''"],
    ["phc_license", "TEXT NOT NULL DEFAULT ''"],
    ["phc_category", "TEXT NOT NULL DEFAULT ''"],
  ]) {
    if (!clinicColumns.has(column))
      db.exec(`ALTER TABLE clinics ADD COLUMN ${column} ${definition}`);
  }

  const userColumns = new Set(
    db.prepare("PRAGMA table_info(clinic_users)").all().map((column) => column.name),
  );
  for (const column of ["doctor_name_urdu", "doctor_qualification_urdu", "doctor_qualification_physician", "doctor_qualification_ultrasound", "phc_registration_override"]) {
    if (!userColumns.has(column))
      db.exec(`ALTER TABLE clinic_users ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
  }
  if (!userColumns.has("is_active"))
    db.exec("ALTER TABLE clinic_users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1");

  const hasClinicColumn = db
    .prepare("PRAGMA table_info(patients)")
    .all()
    .some((column) => column.name === "clinic_id");
  const hasCaseDetails = db
    .prepare("PRAGMA table_info(cases)")
    .all()
    .some((column) => column.name === "details_json");
  if (!hasCaseDetails) {
    db.exec(
      "ALTER TABLE cases ADD COLUMN details_json TEXT NOT NULL DEFAULT '{}'",
    );
  }
  const caseColumns = new Set(
    db
      .prepare("PRAGMA table_info(cases)")
      .all()
      .map((column) => column.name),
  );
  for (const [column, definition] of [
    ["updated_at", "TEXT"],
    ["finalized_at", "TEXT"],
    ["finalized_by", "TEXT"],
    ["doctor_user_id", "INTEGER REFERENCES clinic_users(id)"],
    ["finalized_by_user_id", "INTEGER REFERENCES clinic_users(id)"],
    ["doctor_snapshot_json", "TEXT"],
    ["revision", "INTEGER NOT NULL DEFAULT 0"],
  ]) {
    if (!caseColumns.has(column))
      db.exec(`ALTER TABLE cases ADD COLUMN ${column} ${definition}`);
  }
  const legacy = db.prepare("SELECT * FROM doctor_account WHERE id = 1").get();
  const existingClinics = db
    .prepare("SELECT COUNT(*) AS count FROM clinics")
    .get().count;

  if (!hasClinicColumn && filePath !== ":memory:") {
    const backupPath = `${filePath}.before-admin-migration.bak`;
    if (!existsSync(backupPath)) {
      db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      db.exec(`VACUUM INTO '${backupPath.replaceAll("'", "''")}'`);
    }
  }

  if (!hasClinicColumn || (legacy && existingClinics === 0)) {
    db.exec("BEGIN IMMEDIATE");
    try {
      if (existingClinics === 0) {
        if (legacy) {
          db.prepare(
            `INSERT INTO clinics
            (id, clinic_name, doctor_name, username, password_salt, password_hash, created_at)
            VALUES (1, ?, ?, 'doctor', ?, ?, ?)`,
          ).run(
            "Existing Clinic",
            legacy.doctor_name,
            legacy.password_salt,
            legacy.password_hash,
            legacy.created_at,
          );
        } else if (
          !hasClinicColumn &&
          db.prepare("SELECT COUNT(*) AS count FROM patients").get().count > 0
        ) {
          const recovery = passwordFields(
            randomBytes(24).toString("base64url"),
          );
          db.prepare(
            `INSERT INTO clinics
            (id, clinic_name, doctor_name, username, password_salt, password_hash, created_at)
            VALUES (1, 'Existing Clinic', 'Doctor', 'doctor', ?, ?, ?)`,
          ).run(recovery.salt, recovery.hash, new Date().toISOString());
        }
      }
      if (!hasClinicColumn) {
        db.exec(
          "ALTER TABLE patients ADD COLUMN clinic_id INTEGER NOT NULL DEFAULT 1",
        );
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  function listClinicAccounts() {
    return db
      .prepare(
        `SELECT id, clinic_name AS clinicName, doctor_name AS doctorName,
      address, phone, doctor_qualification AS doctorQualification,
      registration, phc_registration AS phcRegistration,
      phc_license AS phcLicense, phc_category AS phcCategory,
      fixed_stationery AS fixedStationery,
      username, created_at AS createdAt FROM clinics ORDER BY id`,
      )
      .all();
  }

  function createClinicAccount(input) {
    const fixed = input?.fixedStationery === true;
    const source = fixed
      ? { ...clinicPreset, doctorQualification: clinicPreset.doctorQualificationPhysician, username: input.username, password: input.password }
      : input;
    const {
      clinicName,
      doctorName,
      username,
      address,
      phone,
      doctorQualification,
      registration,
      phcRegistration,
      phcLicense,
      phcCategory,
    } = validateAccount(source);
    const { salt, hash } = passwordFields(source.password);
    if (
      db.prepare("SELECT id FROM clinic_users WHERE username = ?").get(username)
    )
      throw new Error("This username is already in use.");
    try {
      db.exec("BEGIN IMMEDIATE");
      const result = db
        .prepare(
          `INSERT INTO clinics
        (clinic_name, doctor_name, address, phone, doctor_qualification,
         doctor_qualification_physician, doctor_qualification_ultrasound,
         doctor_name_urdu, doctor_qualification_urdu, fixed_stationery,
         registration, phc_registration, phc_license, phc_category,
         username, password_salt, password_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          clinicName,
          doctorName,
          address,
          phone,
          doctorQualification,
          fixed ? clinicPreset.doctorQualificationPhysician : "",
          fixed ? clinicPreset.doctorQualificationUltrasound : "",
          fixed ? clinicPreset.doctorNameUrdu : "",
          fixed ? clinicPreset.doctorQualificationUrdu : "",
          fixed ? 1 : 0,
          registration,
          phcRegistration,
          phcLicense,
          phcCategory,
          username,
          salt,
          hash,
          new Date().toISOString(),
        );
      db.exec("COMMIT");
      return listClinicAccounts().find(
        (item) => item.id === Number(result.lastInsertRowid),
      );
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch { /* Transaction may not have started. */ }
      if (String(error.message).includes("UNIQUE"))
        throw new Error("This username is already in use.");
      throw error;
    }
  }

  function updateClinicAccount(id, input) {
    const existing = db.prepare("SELECT fixed_stationery FROM clinics WHERE id = ?").get(Number(id));
    if (existing?.fixed_stationery) {
      const username = clean(input?.username, 60);
      if (!/^[a-zA-Z0-9._-]{3,60}$/.test(username))
        throw new Error("Username must be 3–60 characters using letters, numbers, dots, dashes, or underscores.");
      if (db.prepare("SELECT id FROM clinics WHERE username = ? AND id != ?").get(username, Number(id)) ||
          db.prepare("SELECT id FROM clinic_users WHERE username = ?").get(username))
        throw new Error("This username is already in use.");
      if (input?.password) {
        const { salt, hash } = passwordFields(input.password);
        db.prepare("UPDATE clinics SET username = ?, password_salt = ?, password_hash = ? WHERE id = ?")
          .run(username, salt, hash, Number(id));
      } else {
        db.prepare("UPDATE clinics SET username = ? WHERE id = ?").run(username, Number(id));
      }
      return listClinicAccounts().find((item) => item.id === Number(id));
    }
    const {
      clinicName,
      doctorName,
      username,
      address,
      phone,
      doctorQualification,
      registration,
      phcRegistration,
      phcLicense,
      phcCategory,
    } = validateAccount(input, true);
    if (!db.prepare("SELECT id FROM clinics WHERE id = ?").get(Number(id))) {
      throw new Error("Clinic account not found.");
    }
    if (
      db.prepare("SELECT id FROM clinic_users WHERE username = ?").get(username)
    )
      throw new Error("This username is already in use.");
    try {
      if (input.password) {
        const { salt, hash } = passwordFields(input.password);
        db.prepare(
          `UPDATE clinics SET clinic_name = ?, doctor_name = ?, address = ?, phone = ?,
          doctor_qualification = ?, registration = ?, phc_registration = ?,
          phc_license = ?, phc_category = ?, username = ?,
          password_salt = ?, password_hash = ? WHERE id = ?`,
        ).run(
          clinicName,
          doctorName,
          address,
          phone,
          doctorQualification,
          registration,
          phcRegistration,
          phcLicense,
          phcCategory,
          username,
          salt,
          hash,
          Number(id),
        );
      } else {
        db.prepare(
          `UPDATE clinics SET clinic_name = ?, doctor_name = ?, address = ?, phone = ?,
          doctor_qualification = ?, registration = ?, phc_registration = ?,
          phc_license = ?, phc_category = ?, username = ?
          WHERE id = ?`,
        ).run(
          clinicName,
          doctorName,
          address,
          phone,
          doctorQualification,
          registration,
          phcRegistration,
          phcLicense,
          phcCategory,
          username,
          Number(id),
        );
      }
      return listClinicAccounts().find((item) => item.id === Number(id));
    } catch (error) {
      if (String(error.message).includes("UNIQUE"))
        throw new Error("This username is already in use.");
      throw error;
    }
  }

  function applyFixedStationery(id) {
    const clinic = db.prepare("SELECT id FROM clinics WHERE id = ?").get(Number(id));
    if (!clinic) throw new Error("Clinic account not found.");
    db.prepare(`UPDATE clinics SET clinic_name = ?, address = ?, phone = ?, phc_registration = ?,
      doctor_name = ?, doctor_qualification = ?, doctor_qualification_physician = ?,
      doctor_qualification_ultrasound = ?, doctor_name_urdu = ?, doctor_qualification_urdu = ?,
      registration = ?, fixed_stationery = 1 WHERE id = ?`).run(
      clinicPreset.clinicName, clinicPreset.address, clinicPreset.phone, clinicPreset.phcRegistration,
      clinicPreset.doctorName, clinicPreset.doctorQualificationPhysician,
      clinicPreset.doctorQualificationPhysician, clinicPreset.doctorQualificationUltrasound,
      clinicPreset.doctorNameUrdu, clinicPreset.doctorQualificationUrdu,
      clinicPreset.registration, Number(id),
    );
    return listClinicAccounts().find((item) => item.id === Number(id));
  }

  function doctorAccount(clinicId, userId = null) {
    if (userId == null) {
      const owner = db
        .prepare("SELECT * FROM clinics WHERE id = ?")
        .get(Number(clinicId));
      return owner
        ? {
            userId: null,
            username: owner.username,
            doctorName: owner.doctor_name,
            doctorQualification: owner.doctor_qualification,
            doctorQualificationPhysician: owner.doctor_qualification_physician,
            doctorQualificationUltrasound: owner.doctor_qualification_ultrasound,
            doctorNameUrdu: owner.doctor_name_urdu,
            doctorQualificationUrdu: owner.doctor_qualification_urdu,
            registration: owner.registration,
            phcRegistrationOverride: "",
            isOwner: true,
          }
        : null;
    }
    const doctor = db
      .prepare("SELECT * FROM clinic_users WHERE id = ? AND clinic_id = ?")
      .get(Number(userId), Number(clinicId));
    return doctor
      ? {
          userId: doctor.id,
          username: doctor.username,
          doctorName: doctor.doctor_name,
          doctorQualification: doctor.doctor_qualification,
          doctorQualificationPhysician: doctor.doctor_qualification_physician,
          doctorQualificationUltrasound: doctor.doctor_qualification_ultrasound,
          doctorNameUrdu: doctor.doctor_name_urdu,
          doctorQualificationUrdu: doctor.doctor_qualification_urdu,
          registration: doctor.registration,
          phcRegistrationOverride: doctor.phc_registration_override,
          isOwner: false,
        }
      : null;
  }

  function clinicView(clinicId, userId = null) {
    const clinic = db
      .prepare("SELECT * FROM clinics WHERE id = ?")
      .get(Number(clinicId));
    const doctor = doctorAccount(clinicId, userId);
    if (!clinic || !doctor) return null;
    return {
      id: clinic.id,
      clinicId: clinic.id,
      ...doctor,
      clinicName: clinic.clinic_name,
      address: clinic.address,
      phone: clinic.phone,
      phcRegistration: doctor.phcRegistrationOverride || clinic.phc_registration,
      fixedStationery: Boolean(clinic.fixed_stationery),
      phcLicense: clinic.phc_license,
      phcCategory: clinic.phc_category,
    };
  }

  function listDoctorAccounts(clinicId) {
    const owner = doctorAccount(clinicId);
    if (!owner) throw new Error("Clinic account not found.");
    return [
      owner,
      ...db
        .prepare(
          `SELECT id AS userId, username,
      doctor_name AS doctorName, doctor_qualification AS doctorQualification,
      doctor_qualification_physician AS doctorQualificationPhysician,
      doctor_qualification_ultrasound AS doctorQualificationUltrasound,
      doctor_name_urdu AS doctorNameUrdu, doctor_qualification_urdu AS doctorQualificationUrdu,
      registration, phc_registration_override AS phcRegistrationOverride
      FROM clinic_users WHERE clinic_id = ? AND is_active = 1 ORDER BY id`,
        )
        .all(Number(clinicId))
        .map((doctor) => ({ ...doctor, isOwner: false })),
    ];
  }

  function createDoctorAccount(clinicId, input) {
    if (!doctorAccount(clinicId)) throw new Error("Clinic account not found.");
    const username = clean(input?.username, 60);
    const doctorName = clean(input?.doctorName, 120);
    if (!doctorName) throw new Error("Doctor name is required.");
    if (!/^[a-zA-Z0-9._-]{3,60}$/.test(username))
      throw new Error(
        "Username must be 3–60 characters using letters, numbers, dots, dashes, or underscores.",
      );
    const { salt, hash } = passwordFields(input?.password);
    db.exec("BEGIN IMMEDIATE");
    try {
      if (
        db
          .prepare(
            "SELECT COUNT(*) AS total FROM clinic_users WHERE clinic_id = ? AND is_active = 1",
          )
          .get(Number(clinicId)).total >= 1
      )
        throw new Error("This clinic already has its one extra doctor login.");
      if (
        db.prepare("SELECT id FROM clinics WHERE username = ?").get(username) ||
        db
          .prepare("SELECT id FROM clinic_users WHERE username = ?")
          .get(username)
      )
        throw new Error("This username is already in use.");
      const result = db
        .prepare(
          `INSERT INTO clinic_users
      (clinic_id, username, password_salt, password_hash, doctor_name,
       doctor_qualification, doctor_qualification_physician, doctor_qualification_ultrasound,
       doctor_name_urdu, doctor_qualification_urdu, registration, phc_registration_override, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          Number(clinicId),
          username,
          salt,
          hash,
          doctorName,
          clean(input?.doctorQualification, 250),
          clean(input?.doctorQualificationPhysician || input?.doctorQualification, 500),
          clean(input?.doctorQualificationUltrasound || input?.doctorQualification, 500),
          clean(input?.doctorNameUrdu, 120),
          clean(input?.doctorQualificationUrdu, 500),
          clean(input?.registration, 120),
          clean(input?.phcRegistrationOverride, 120),
          new Date().toISOString(),
        );
      db.exec("COMMIT");
      return doctorAccount(clinicId, Number(result.lastInsertRowid));
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  function deactivateDoctorAccount(clinicId, userId) {
    const id = Number(userId);
    if (!Number.isSafeInteger(id) || id < 1)
      throw new Error("Select an additional doctor account.");
    const result = db
      .prepare(
        "UPDATE clinic_users SET is_active = 0 WHERE clinic_id = ? AND id = ? AND is_active = 1",
      )
      .run(Number(clinicId), id);
    if (result.changes !== 1)
      throw new Error("Active additional doctor account not found.");
    return { deactivated: true, userId: id };
  }

  function updateClinicProfile(id, input, userId = null) {
    const clinic = db.prepare("SELECT fixed_stationery FROM clinics WHERE id = ?").get(Number(id));
    if (userId == null && clinic?.fixed_stationery)
      throw new Error("The main doctor's reference profile is fixed for this clinic.");
    const doctorName = clean(input?.doctorName, 120);
    if (!doctorName) throw new Error("Doctor name is required.");
    if (userId != null) {
      const result = db
        .prepare(
          `UPDATE clinic_users SET doctor_name = ?,
        doctor_qualification = ?, doctor_name_urdu = ?, doctor_qualification_urdu = ?,
        doctor_qualification_physician = ?, doctor_qualification_ultrasound = ?,
        registration = ?, phc_registration_override = ? WHERE id = ? AND clinic_id = ?`,
        )
        .run(
          doctorName,
          clean(input?.doctorQualification, 250),
          clean(input?.doctorNameUrdu, 120),
          clean(input?.doctorQualificationUrdu, 500),
          clean(input?.doctorQualificationPhysician || input?.doctorQualification, 500),
          clean(input?.doctorQualificationUltrasound || input?.doctorQualification, 500),
          clean(input?.registration, 120),
          clean(input?.phcRegistrationOverride, 120),
          Number(userId),
          Number(id),
        );
      if (result.changes === 0) throw new Error("Doctor account not found.");
      return clinicView(id, userId);
    }
    const result = db
      .prepare(
        `UPDATE clinics SET doctor_name = ?,
      doctor_qualification = ?, doctor_name_urdu = ?, doctor_qualification_urdu = ?,
      doctor_qualification_physician = ?, doctor_qualification_ultrasound = ?,
      registration = ? WHERE id = ?`,
      )
      .run(
        doctorName,
        clean(input?.doctorQualification, 250),
        clean(input?.doctorNameUrdu, 120),
        clean(input?.doctorQualificationUrdu, 500),
        clean(input?.doctorQualificationPhysician || input?.doctorQualification, 500),
        clean(input?.doctorQualificationUltrasound || input?.doctorQualification, 500),
        clean(input?.registration, 120),
        Number(id),
      );
    if (result.changes === 0) throw new Error("Clinic account not found.");
    return clinicView(id);
  }

  function clinicLogin(username, password) {
    const login = clean(username, 60);
    const owner = db
      .prepare("SELECT * FROM clinics WHERE username = ?")
      .get(login);
    if (owner)
      return checkPassword(password, owner.password_salt, owner.password_hash)
        ? clinicView(owner.id)
        : null;
    const doctor = db
      .prepare("SELECT * FROM clinic_users WHERE username = ? AND is_active = 1")
      .get(login);
    return doctor &&
      checkPassword(password, doctor.password_salt, doctor.password_hash)
      ? clinicView(doctor.clinic_id, doctor.id)
      : null;
  }

  function clinicSession(id, passwordHash, userId = null) {
    return typeof passwordHash === "string" &&
      clinicPasswordHash(id, userId) === passwordHash
      ? clinicView(id, userId)
      : null;
  }

  function clinicPasswordHash(id, userId = null) {
    return userId == null
      ? (db
          .prepare("SELECT password_hash AS hash FROM clinics WHERE id = ?")
          .get(Number(id))?.hash ?? null)
      : (db
          .prepare(
            "SELECT password_hash AS hash FROM clinic_users WHERE id = ? AND clinic_id = ? AND is_active = 1",
          )
          .get(Number(userId), Number(id))?.hash ?? null);
  }

  function changeDoctorPassword(
    clinicId,
    userId,
    currentPassword,
    newPassword,
  ) {
    validatePassword(newPassword);
    const doctor = doctorAccount(clinicId, userId);
    if (!doctor || !clinicLogin(doctor.username, currentPassword))
      throw new Error("Current password is incorrect.");
    const { salt, hash } = passwordFields(newPassword);
    if (userId == null)
      db.prepare(
        "UPDATE clinics SET password_salt = ?, password_hash = ? WHERE id = ?",
      ).run(salt, hash, Number(clinicId));
    else
      db.prepare(
        "UPDATE clinic_users SET password_salt = ?, password_hash = ? WHERE id = ? AND clinic_id = ?",
      ).run(salt, hash, Number(userId), Number(clinicId));
    return true;
  }

  function getPatient(clinicId, id) {
    return (
      db
        .prepare(
          `SELECT ${patientColumns} FROM patients
      WHERE clinic_id = ? AND id = ?`,
        )
        .get(Number(clinicId), Number(id)) ?? null
    );
  }

  function insertPatient(clinicId, input) {
    const name = clean(input?.name, 150);
    if (!name) throw new Error("Patient name is required.");
    const ageRaw = input?.ageYears;
    const ageYears = ageRaw === "" || ageRaw == null ? null : Number(ageRaw);
    if (
      ageYears != null &&
      (!Number.isInteger(ageYears) || ageYears < 0 || ageYears > 120)
    ) {
      throw new Error("Age must be between 0 and 120 years.");
    }
    const dateOfBirth = clean(input?.dateOfBirth, 10);
    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      throw new Error("Invalid date of birth format.");
    }
    if (
      !db.prepare("SELECT id FROM clinics WHERE id = ?").get(Number(clinicId))
    ) {
      throw new Error("Clinic account not found.");
    }

    const result = db
      .prepare(
        `INSERT INTO patients
        (clinic_id, name, age_years, date_of_birth, gender, relationship, phone,
         address, allergies, medical_history, current_medications, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        Number(clinicId),
        name,
        ageYears,
        dateOfBirth || null,
        clean(input?.gender, 30),
        clean(input?.relationship, 100),
        clean(input?.phone, 40),
        clean(input?.address, 400),
        clean(input?.allergies, 500),
        clean(input?.medicalHistory, 1000),
        clean(input?.currentMedications, 1000),
        new Date().toISOString(),
      );
    const id = Number(result.lastInsertRowid);
    db.prepare("UPDATE patients SET mr_number = ? WHERE id = ?").run(
      `MR-${String(id).padStart(5, "0")}`,
      id,
    );
    return getPatient(clinicId, id);
  }

  function createPatient(clinicId, input) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const patient = insertPatient(clinicId, input);
      db.exec("COMMIT");
      return patient;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  function listPatients(clinicId, search = "", module = "") {
    const query = clean(search, 100);
    if (module && !["physician", "ultrasound"].includes(module))
      throw new Error("Invalid module.");
    const conditions = ["p.clinic_id = ?"];
    const params = [Number(clinicId)];
    if (query) {
      conditions.push(
        "(p.name LIKE ? OR p.mr_number LIKE ? OR p.phone LIKE ?)",
      );
      params.push(`%${query}%`, `%${query}%`, `%${query}%`);
    }
    if (module) {
      conditions.push(
        "EXISTS (SELECT 1 FROM cases c WHERE c.patient_id = p.id AND c.module = ?)",
      );
      params.push(module);
    }
    return db
      .prepare(
        `
      SELECT p.id, p.mr_number AS mrNumber, p.name, p.age_years AS ageYears,
        p.phone, p.created_at AS createdAt,
        (SELECT MAX(c.created_at) FROM cases c WHERE c.patient_id = p.id) AS lastVisit,
        (SELECT c.status FROM cases c WHERE c.patient_id = p.id ORDER BY c.created_at DESC, c.id DESC LIMIT 1) AS lastStatus,
        EXISTS (SELECT 1 FROM cases c WHERE c.patient_id = p.id AND c.module = 'physician') AS hasPhysician,
        EXISTS (SELECT 1 FROM cases c WHERE c.patient_id = p.id AND c.module = 'ultrasound') AS hasUltrasound
      FROM patients p WHERE ${conditions.join(" AND ")}
      ORDER BY p.id DESC LIMIT 500
    `,
      )
      .all(...params);
  }

  function summary(clinicId) {
    return {
      todayPatients: db
        .prepare(`SELECT COUNT(DISTINCT c.patient_id) AS value FROM cases c
          JOIN patients p ON p.id = c.patient_id
          WHERE p.clinic_id = ? AND date(c.created_at, 'localtime') = date('now', 'localtime')`)
        .get(Number(clinicId)).value,
      totalPatients: db
        .prepare("SELECT COUNT(*) AS value FROM patients WHERE clinic_id = ?")
        .get(Number(clinicId)).value,
      physicianPatients: db
        .prepare(
          `SELECT COUNT(DISTINCT c.patient_id) AS value FROM cases c
        JOIN patients p ON p.id = c.patient_id WHERE p.clinic_id = ? AND c.module = 'physician'`,
        )
        .get(Number(clinicId)).value,
      ultrasoundPatients: db
        .prepare(
          `SELECT COUNT(DISTINCT c.patient_id) AS value FROM cases c
        JOIN patients p ON p.id = c.patient_id WHERE p.clinic_id = ? AND c.module = 'ultrasound'`,
        )
        .get(Number(clinicId)).value,
      pendingReports: db
        .prepare(`SELECT COUNT(*) AS value FROM cases c
          JOIN patients p ON p.id = c.patient_id
          WHERE p.clinic_id = ? AND c.module = 'ultrasound' AND c.status = 'draft'`)
        .get(Number(clinicId)).value,
    };
  }

  function startCase(clinicId, patientId, module, userId = null) {
    if (!["physician", "ultrasound"].includes(module))
      throw new Error("Invalid module.");
    if (!getPatient(clinicId, patientId)) throw new Error("Patient not found.");
    if (!doctorAccount(clinicId, userId))
      throw new Error("Doctor account not found.");
    const result = db
      .prepare(
        "INSERT INTO cases (patient_id, module, created_at, doctor_user_id) VALUES (?, ?, ?, ?)",
      )
      .run(Number(patientId), module, new Date().toISOString(), userId);
    return db
      .prepare(
        `SELECT id, patient_id AS patientId, module, status,
      created_at AS createdAt FROM cases WHERE id = ?`,
      )
      .get(result.lastInsertRowid);
  }

  function getEncounter(clinicId, caseId) {
    const row = db
      .prepare(
        `SELECT c.id, c.patient_id AS patientId, c.module,
      c.status, c.details_json AS detailsJson, c.created_at AS createdAt,
      c.updated_at AS updatedAt, c.finalized_at AS finalizedAt,
      c.finalized_by AS finalizedBy, c.doctor_user_id AS doctorUserId,
      c.finalized_by_user_id AS finalizedByUserId,
      c.doctor_snapshot_json AS doctorSnapshotJson, c.revision
      FROM cases c JOIN patients p ON p.id = c.patient_id
      WHERE c.id = ? AND p.clinic_id = ?`,
      )
      .get(Number(caseId), Number(clinicId));
    if (!row) return null;
    const { detailsJson, doctorSnapshotJson, ...encounter } = row;
    const recordDoctor = doctorAccount(
      clinicId,
      row.status === "final" ? row.finalizedByUserId : row.doctorUserId,
    );
    return {
      ...encounter,
      visitNumber: row.module === "physician"
        ? db.prepare("SELECT COUNT(*) AS value FROM cases WHERE patient_id = ? AND module = 'physician' AND id <= ?")
          .get(row.patientId, row.id).value
        : null,
      details: JSON.parse(detailsJson || "{}"),
      patient: getPatient(clinicId, row.patientId),
      printDoctor: doctorSnapshotJson
        ? JSON.parse(doctorSnapshotJson)
        : {
            doctorName:
              row.status === "final" && row.finalizedBy
                ? row.finalizedBy
                : recordDoctor?.doctorName,
            doctorQualification: recordDoctor?.doctorQualification || "",
            doctorQualificationPhysician: recordDoctor?.doctorQualificationPhysician || "",
            doctorQualificationUltrasound: recordDoctor?.doctorQualificationUltrasound || "",
            doctorNameUrdu: recordDoctor?.doctorNameUrdu || "",
            doctorQualificationUrdu: recordDoctor?.doctorQualificationUrdu || "",
            registration: recordDoctor?.registration || "",
            phcRegistration: recordDoctor?.phcRegistrationOverride || clinicView(clinicId)?.phcRegistration || "",
          },
    };
  }

  function saveEncounter(clinicId, input, userId = null) {
    const { module, caseId, patientId } = input ?? {};
    if (!["physician", "ultrasound"].includes(module)) {
      throw new Error("Invalid module.");
    }
    if (
      !input.details ||
      typeof input.details !== "object" ||
      Array.isArray(input.details)
    ) {
      throw new Error("Visit details are required.");
    }
    const detailsJson = JSON.stringify(input.details);
    if (detailsJson.length > 100000)
      throw new Error("Visit details are too long.");
    const finalize = input.finalize === true;
    if (finalize) {
      if (input.reviewConfirmed !== true)
        throw new Error("Confirm the doctor's review before finalizing.");
      if (module === "physician" && !clean(input.details.diagnosis, 10000))
        throw new Error("Enter a diagnosis before finalizing.");
      if (module === "ultrasound" && !clean(input.details.impression, 10000))
        throw new Error("Enter an impression before finalizing.");
      if (module === "ultrasound" && !clean(input.details.technique, 10000))
        throw new Error("Enter the examination technique before finalizing.");
      if (input.details.transvaginalPerformed && !input.details.consentRecorded)
        throw new Error(
          "Record consent for a transvaginal examination before finalizing.",
        );
    }
    const now = new Date().toISOString();
    const doctor = doctorAccount(clinicId, userId);
    if (!doctor) throw new Error("Doctor account not found.");
    const doctorName = doctor.doctorName;
    const doctorSnapshotJson = finalize
      ? JSON.stringify({
          doctorName,
          doctorQualification: doctor.doctorQualification,
          doctorQualificationPhysician: doctor.doctorQualificationPhysician,
          doctorQualificationUltrasound: doctor.doctorQualificationUltrasound,
          doctorNameUrdu: doctor.doctorNameUrdu,
          doctorQualificationUrdu: doctor.doctorQualificationUrdu,
          registration: doctor.registration,
          phcRegistration: clinicView(clinicId, userId)?.phcRegistration || "",
        })
      : null;

    db.exec("BEGIN IMMEDIATE");
    try {
      let id;
      let eventType = null;
      if (caseId) {
        const existing = getEncounter(clinicId, caseId);
        if (!existing || existing.module !== module)
          throw new Error("Visit not found.");
        if (existing.status === "final") {
          if (finalize) throw new Error("This record is already final.");
          const previousJson = JSON.stringify(existing.details);
          if (detailsJson !== previousJson) {
            const reason = clean(input.amendmentReason, 500);
            if (reason.length < 5)
              throw new Error(
                "Enter an amendment reason of at least 5 characters.",
              );
            db.prepare(
              `INSERT INTO case_amendments
              (case_id, previous_details_json, new_details_json, reason, amended_by, amended_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
            ).run(
              Number(caseId),
              previousJson,
              detailsJson,
              reason,
              doctorName,
              now,
            );
            db.prepare(
              "UPDATE cases SET details_json = ?, updated_at = ?, revision = revision + 1 WHERE id = ?",
            ).run(detailsJson, now, Number(caseId));
            eventType = "amended";
          }
        } else {
          db.prepare(
            `UPDATE cases SET details_json = ?, updated_at = ?, status = ?,
            finalized_at = ?, finalized_by = ?, finalized_by_user_id = ?,
            doctor_snapshot_json = ? WHERE id = ?`,
          ).run(
            detailsJson,
            now,
            finalize ? "final" : "draft",
            finalize ? now : null,
            finalize ? doctorName : null,
            finalize ? userId : null,
            doctorSnapshotJson,
            Number(caseId),
          );
          eventType = finalize ? "finalized" : "draft_saved";
        }
        id = Number(caseId);
      } else {
        const patient = patientId
          ? getPatient(clinicId, patientId)
          : insertPatient(clinicId, input.patient);
        if (!patient) throw new Error("Patient not found.");
        const result = db
          .prepare(
            `INSERT INTO cases
            (patient_id, module, status, details_json, created_at, updated_at,
             finalized_at, finalized_by, doctor_user_id, finalized_by_user_id,
             doctor_snapshot_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            patient.id,
            module,
            finalize ? "final" : "draft",
            detailsJson,
            now,
            now,
            finalize ? now : null,
            finalize ? doctorName : null,
            userId,
            finalize ? userId : null,
            doctorSnapshotJson,
          );
        id = Number(result.lastInsertRowid);
        eventType = finalize ? "created_final" : "created_draft";
      }
      if (eventType)
        db.prepare(
          "INSERT INTO case_events (case_id, event_type, actor, occurred_at) VALUES (?, ?, ?, ?)",
        ).run(id, eventType, doctorName, now);
      db.exec("COMMIT");
      return getEncounter(clinicId, id);
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  function listAmendments(clinicId, caseId) {
    if (!getEncounter(clinicId, caseId)) throw new Error("Visit not found.");
    return db
      .prepare(
        `SELECT id, reason, amended_by AS amendedBy, amended_at AS amendedAt,
       previous_details_json AS previousJson, new_details_json AS newJson
       FROM case_amendments WHERE case_id = ? ORDER BY id DESC`,
      )
      .all(Number(caseId))
      .map(({ previousJson, newJson, ...row }) => ({
        ...row,
        previousDetails: JSON.parse(previousJson),
        newDetails: JSON.parse(newJson),
      }));
  }

  function listCaseEvents(clinicId, caseId) {
    if (!getEncounter(clinicId, caseId)) throw new Error("Visit not found.");
    return db
      .prepare(
        `SELECT id, event_type AS eventType, actor, occurred_at AS occurredAt
       FROM case_events WHERE case_id = ? ORDER BY id DESC`,
      )
      .all(Number(caseId));
  }

  function listCases(clinicId, module) {
    if (!["physician", "ultrasound"].includes(module))
      throw new Error("Invalid module.");
    return db
      .prepare(
        `SELECT c.id, c.patient_id AS patientId, c.module, c.status,
      c.created_at AS createdAt, c.finalized_at AS finalizedAt,
      c.revision, p.name AS patientName, p.mr_number AS mrNumber,
      CASE WHEN c.status = 'final' THEN COALESCE(c.finalized_by, final_user.doctor_name, cl.doctor_name)
           ELSE COALESCE(creator.doctor_name, cl.doctor_name) END AS doctorName
      FROM cases c JOIN patients p ON p.id = c.patient_id
      JOIN clinics cl ON cl.id = p.clinic_id
      LEFT JOIN clinic_users creator ON creator.id = c.doctor_user_id
      LEFT JOIN clinic_users final_user ON final_user.id = c.finalized_by_user_id
      WHERE p.clinic_id = ? AND c.module = ? ORDER BY c.id DESC LIMIT 200`,
      )
      .all(Number(clinicId), module);
  }

  function listTemplates(clinicId, type) {
    if (type && !["medicine", "diagnosis", "ultrasound"].includes(type)) {
      throw new Error("Invalid template type.");
    }
    const rows = type
      ? db
          .prepare(
            `SELECT id, type, name, data_json AS dataJson, updated_at AS updatedAt
          FROM templates WHERE clinic_id = ? AND type = ? ORDER BY name COLLATE NOCASE`,
          )
          .all(Number(clinicId), type)
      : db
          .prepare(
            `SELECT id, type, name, data_json AS dataJson, updated_at AS updatedAt
          FROM templates WHERE clinic_id = ? ORDER BY type, name COLLATE NOCASE`,
          )
          .all(Number(clinicId));
    return rows.map(({ dataJson, ...row }) => ({
      ...row,
      data: JSON.parse(dataJson),
    }));
  }

  function saveTemplate(clinicId, input) {
    const type = input?.type;
    const name = clean(input?.name, 120);
    if (!["medicine", "diagnosis", "ultrasound"].includes(type)) {
      throw new Error("Invalid template type.");
    }
    if (!name) throw new Error("Template name is required.");
    if (
      !input.data ||
      typeof input.data !== "object" ||
      Array.isArray(input.data)
    ) {
      throw new Error("Template details are required.");
    }
    const dataJson = JSON.stringify(input.data);
    if (dataJson.length > 100000) throw new Error("Template is too large.");
    if (
      !db.prepare("SELECT id FROM clinics WHERE id = ?").get(Number(clinicId))
    ) {
      throw new Error("Clinic account not found.");
    }
    const now = new Date().toISOString();
    try {
      let id;
      if (input.id) {
        const existing = db
          .prepare(
            "SELECT id, type FROM templates WHERE id = ? AND clinic_id = ?",
          )
          .get(Number(input.id), Number(clinicId));
        if (!existing || existing.type !== type)
          throw new Error("Template not found.");
        db.prepare(
          "UPDATE templates SET name = ?, data_json = ?, updated_at = ? WHERE id = ?",
        ).run(name, dataJson, now, Number(input.id));
        id = Number(input.id);
      } else {
        const result = db
          .prepare(
            `INSERT INTO templates
          (clinic_id, type, name, data_json, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(Number(clinicId), type, name, dataJson, now, now);
        id = Number(result.lastInsertRowid);
      }
      return listTemplates(clinicId, type).find(
        (template) => template.id === id,
      );
    } catch (error) {
      if (String(error.message).includes("UNIQUE"))
        throw new Error("A template with this name already exists.");
      throw error;
    }
  }

  function deleteTemplate(clinicId, id) {
    const result = db
      .prepare("DELETE FROM templates WHERE id = ? AND clinic_id = ?")
      .run(Number(id), Number(clinicId));
    if (result.changes === 0) throw new Error("Template not found.");
    return true;
  }

  function backupTo(targetPath) {
    if (!targetPath || existsSync(targetPath))
      throw new Error("Choose a new backup file path.");
    try {
      db.exec(`VACUUM INTO '${String(targetPath).replaceAll("'", "''")}'`);
    } catch (error) {
      if (existsSync(targetPath)) unlinkSync(targetPath);
      throw error;
    }
    return targetPath;
  }

  return {
    listClinicAccounts,
    createClinicAccount,
    updateClinicAccount,
    applyFixedStationery,
    updateClinicProfile,
    listDoctorAccounts,
    createDoctorAccount,
    deactivateDoctorAccount,
    clinicLogin,
    clinicSession,
    clinicPasswordHash,
    changeDoctorPassword,
    createPatient,
    getPatient,
    listPatients,
    summary,
    startCase,
    getEncounter,
    saveEncounter,
    listAmendments,
    listCaseEvents,
    listCases,
    listTemplates,
    saveTemplate,
    deleteTemplate,
    backupTo,
    close: () => db.close(),
  };
}
