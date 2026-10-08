import assert from "node:assert/strict";
import test from "node:test";
import { readPhysicianTests, writePhysicianTests } from "../frontend/src/physicianTests.js";

test("selected prescription tests round-trip and other notes remain separate", () => {
  const saved = writePhysicianTests(["RFTs", "CBC"], "ESR");
  assert.deepEqual(readPhysicianTests(saved), {
    selected: ["CBC", "RFTs"],
    other: "ESR",
  });
  assert.deepEqual(readPhysicianTests("No CBC required"), {
    selected: [],
    other: "No CBC required",
  });
});
