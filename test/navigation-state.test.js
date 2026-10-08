import test from "node:test";
import assert from "node:assert/strict";
import {
  clearNavigation, defaultNavigation, restoreNavigation, saveNavigation,
} from "../frontend/src/navigation-state.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("refresh restores the same doctor page and selected record", () => {
  const storage = memoryStorage();
  const owner = { role: "clinic", id: 2, userId: null, isOwner: true };
  saveNavigation(storage, owner, {
    ...defaultNavigation,
    screen: "printPreview",
    activeModule: "ultrasound",
    visitCaseId: 42,
  });
  assert.equal(restoreNavigation(storage, owner).screen, "printPreview");
  assert.equal(restoreNavigation(storage, owner).visitCaseId, 42);
  assert.equal(restoreNavigation(storage, owner).activeModule, "ultrasound");
  assert.deepEqual(restoreNavigation(storage, { ...owner, userId: 9 }), defaultNavigation);
  assert.deepEqual(restoreNavigation(storage, { ...owner, id: 3 }), defaultNavigation);
  clearNavigation(storage);
  assert.deepEqual(restoreNavigation(storage, owner), defaultNavigation);
});

test("restored navigation rejects invalid or unauthorized pages", () => {
  const storage = memoryStorage();
  const doctor = { role: "clinic", id: 2, userId: 9, isOwner: false };
  saveNavigation(storage, doctor, { ...defaultNavigation, screen: "doctorAccounts" });
  assert.equal(restoreNavigation(storage, doctor).screen, "dashboard");
  saveNavigation(storage, doctor, { ...defaultNavigation, screen: "patient", selectedPatientId: 7 });
  assert.equal(restoreNavigation(storage, doctor).selectedPatientId, 7);
  saveNavigation(storage, doctor, { ...defaultNavigation, screen: "patient" });
  assert.equal(restoreNavigation(storage, doctor).screen, "patients");
  saveNavigation(storage, doctor, { ...defaultNavigation, screen: "printPreview" });
  assert.equal(restoreNavigation(storage, doctor).screen, "dashboard");
});
