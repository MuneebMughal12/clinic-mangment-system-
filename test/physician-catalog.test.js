import test from "node:test";
import assert from "node:assert/strict";
import { medicineCatalog, physicianPlanCatalog, applyPhysicianPlanDraft } from "../frontend/src/physicianCatalog.js";

test("supplied physician drafts link to medicines without prescribing source-photo doses", () => {
  const names = new Set(medicineCatalog.map((item) => item.name));
  assert.equal(names.size, medicineCatalog.length);
  assert.ok(names.has("Paracetamol"));
  assert.ok(names.has("Oral rehydration salts (ORS)"));
  for (const medicine of medicineCatalog) {
    assert.equal(medicine.data.name, medicine.name);
    assert.equal(medicine.data.dose, "");
    assert.equal(medicine.data.frequency, "");
    assert.equal(medicine.data.duration, "");
  }
  assert.ok(physicianPlanCatalog.length >= 10);
  for (const plan of physicianPlanCatalog) {
    assert.equal(plan.data.diagnosis, plan.name);
    assert.deepEqual(plan.data.medicines, []);
    assert.ok(plan.data.suggestedMedicines.length > 0);
    assert.ok(plan.data.suggestedMedicines.every((name) => names.has(name)), plan.name);
  }
});

test("a plan adds only medicines selected for the visit and uses the clinic's edited version", () => {
  const plan = physicianPlanCatalog.find((item) => item.name === "Common cold");
  const savedMedicine = { type: "medicine", data: {
    name: "Paracetamol", strength: "Clinic-selected strength", dose: "", frequency: "",
  } };
  const result = applyPhysicianPlanDraft(
    { complaints: "Patient complaint", medicines: [{ name: "Existing medicine" }] },
    plan.data, ["Paracetamol"], [savedMedicine],
  );
  assert.equal(result.complaints, "Patient complaint");
  assert.deepEqual(result.medicines.map((item) => item.name), ["Existing medicine", "Paracetamol"]);
  assert.equal(result.medicines[1].strength, "Clinic-selected strength");
  assert.equal(result.suggestedMedicines, undefined);
});
