import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { structuredUltrasoundDraft } from "../frontend/src/ultrasoundSections.js";

const catalog = JSON.parse(
  readFileSync(new URL("../frontend/src/ultrasoundCatalog.json", import.meta.url), "utf8"),
);

test("supplied ultrasound drafts omit source patient identity and measurements", () => {
  assert.equal(catalog.length, 29);
  assert.equal(new Set(catalog.map((item) => item.name)).size, catalog.length);
  for (const draft of catalog) {
    assert.ok(draft.name && draft.reportType && draft.reportBody && draft.impression);
    const text = `${draft.reportBody}\n${draft.impression}`;
    assert.doesNotMatch(text, /PATIENT NAME\s*:|ADDRESS\s*:|DATE\s*:/i, draft.name);
    assert.doesNotMatch(text, /\d|\ufffd/, draft.name);
    const structured = structuredUltrasoundDraft(draft);
    assert.equal(structured.reportStyle, "sections");
    assert.ok(structured.sections.length >= 3, draft.name);
    assert.ok(structured.sections.every((section) => section.label && section.text), draft.name);
  }
  const abdomen = structuredUltrasoundDraft(catalog.find((item) => item.name === "Abdomen — Normal"));
  assert.ok(abdomen.sections.some((section) => section.label === "Liver"));
  assert.ok(abdomen.sections.some((section) => section.label === "Right Kidney"));
  const obstetric = structuredUltrasoundDraft(catalog.find((item) => item.name === "Obstetric — Fetal Wellbeing"));
  assert.ok(obstetric.sections.some((section) => section.label === "Biparietal diameter (BPD)"));
});
