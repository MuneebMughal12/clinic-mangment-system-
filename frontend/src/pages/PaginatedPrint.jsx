import { useLayoutEffect, useMemo, useRef, useState } from "react";
import tahiraLocationQr from "../assets/tahira-location-qr.jpg";
import ultrasoundStationery from "../assets/ultrasound-stationery-reference.jpeg";
import { clinicPreset } from "../../../shared/clinic-preset.js";
import { readPhysicianTests, writePhysicianTests } from "../physicianTests.js";

function splitText(value, limit) {
  const text = String(value || "");
  if (text.length <= limit) return [text, ""];
  const boundary = text.lastIndexOf(" ", limit);
  const cut = boundary > limit / 2 ? boundary : limit;
  return [text.slice(0, cut).trimEnd(), text.slice(cut).trimStart()];
}

function chunks(value, limit = 220) {
  const parts = [];
  let rest = String(value || "");
  while (rest) {
    const [part, next] = splitText(rest, limit);
    if (!part) break;
    parts.push(part);
    rest = next;
  }
  return parts;
}

function textBlocks(key, title, content) {
  return chunks(content).map((part, index) => ({
    key: `${key}-${index}`,
    title: index && !title.endsWith("(continued)") ? `${title} (continued)` : title,
    content: part,
  }));
}

function splitPhysician(encounter, medicineCount, compactLevel) {
  const original = encounter.details;
  const first = { ...original };
  const continuation = [];
  for (const [key, title, limit] of [
    ["diagnosis", "Provisional diagnosis", 100],
    ["complaints", "Presenting complaints", 80],
    ["symptoms", "Symptoms", 80],
    ["findings", "Findings", 80],
    ["advice", "Advice / instructions", 180],
    ["followUp", "Follow-up", 100],
  ]) {
    const [head, tail] = splitText(original[key], Math.max(35, Math.floor(limit * (1 - compactLevel * 0.3))));
    first[key] = head;
    continuation.push(...textBlocks(key, `${title} (continued)`, tail));
  }
  const tests = readPhysicianTests(original.tests);
  const [firstOtherTests, extraOtherTests] = splitText(tests.other, Math.max(35, 100 - compactLevel * 30));
  first.tests = writePhysicianTests(tests.selected, firstOtherTests);
  continuation.push(...textBlocks("tests", "Other tests (continued)", extraOtherTests));
  const medicines = (original.medicines || []).filter(item => item.name?.trim());
  first.medicines = medicines.slice(0, medicineCount);
  const remainingMedicines = [];
  for (const [index, medicine] of medicines.slice(medicineCount).entries()) {
    remainingMedicines.push(...textBlocks(`medicine-${index}`, `Medicine ${index + medicineCount + 1}: ${medicine.name}`,
      [medicine.strength, medicine.dose, medicine.route, medicine.frequency,
        medicine.food, medicine.duration].filter(Boolean).join(" · ") || "—"));
  }
  return { firstEncounter: { ...encounter, details: first }, blocks: [...remainingMedicines, ...continuation] };
}

function splitUltrasound(encounter) {
  const original = encounter.details;
  const first = { ...original };
  const continuation = [];
  for (const [key, title] of [
    ["clinicalIndication", "Clinical indication"],
    ["technique", "Technique"],
    ["bladder", "Urinary bladder"],
    ["myometrium", "Uterus (continued)"],
  ]) {
    const [head, tail] = splitText(original[key], 100);
    first[key] = head;
    continuation.push(...textBlocks(key, `${title} (continued)`, tail));
  }
  for (const key of ["endometrialThickness", "endometrialPattern", "cervix",
    "rightOvarySize", "rightOvaryVolume", "rightOvaryFindings", "leftOvarySize",
    "leftOvaryVolume", "leftOvaryFindings", "adnexa", "pouchOfDouglas", "impression"])
    first[key] = "";
  const section = (key, title, items) => continuation.push(...textBlocks(key, title,
    items.filter(Boolean).join(". ") || "—"));
  section("endometrium", "Endometrium", [
    original.endometrialThickness && `Thickness: ${original.endometrialThickness} mm`,
    original.endometrialPattern,
  ]);
  section("cervix", "Cervix", [original.cervix]);
  section("right-ovary", "Right ovary", [
    original.rightOvarySize && `Size: ${original.rightOvarySize} cm`,
    original.rightOvaryVolume && `Volume: ${original.rightOvaryVolume} mL`,
    original.rightOvaryFindings,
  ]);
  section("left-ovary", "Left ovary", [
    original.leftOvarySize && `Size: ${original.leftOvarySize} cm`,
    original.leftOvaryVolume && `Volume: ${original.leftOvaryVolume} mL`,
    original.leftOvaryFindings,
  ]);
  section("adnexa", "Adnexa", [original.adnexa]);
  section("pouch", "Pouch of Douglas", [original.pouchOfDouglas]);
  section("impression", "Impression", [original.impression]);
  continuation.push({ key: "signature", title: "Doctor signature / stamp", content: "______________________" });
  return { firstEncounter: { ...encounter, details: first }, blocks: continuation };
}

function Block({ block }) {
  return <section className="paged-block">
    <h3>{block.title}</h3>
    <p>{block.content}</p>
  </section>;
}

function ContinuationPage({ module, account, blocks, index, total, bodyRef }) {
  const hasQr = account.clinicName?.trim().toLowerCase() === "tahira memorial clinic";
  const ultrasound = module === "ultrasound";
  return <article className={`print-sheet paginated-sheet continuation-sheet ${ultrasound
    ? "ultrasound-sheet continuation-ultrasound"
    : `physician-sheet continuation-physician${hasQr ? " has-location-qr" : ""}`}`}>
    {ultrasound && <div className="ultrasound-stationery continuation-stationery" aria-hidden="true">
      <img src={ultrasoundStationery} alt="" />
    </div>}
    <div className="paged-content" ref={bodyRef}>
      {blocks.map(block => <Block block={block} key={block.key} />)}
    </div>
    {ultrasound ? <footer className="continuation-ultrasound-footer">
      <span>Page {index + 1} of {total}</span>
      {hasQr && <img className="location-qr ultrasound-location-qr" src={tahiraLocationQr} alt="Clinic location QR" />}
    </footer> : <footer className={`physician-footer${hasQr ? " has-location-qr" : ""}`}>
      <span>For Appointment: {account.fixedStationery ? clinicPreset.physicianAppointmentPhone : account.phone}</span>
      <span>Page {index + 1} of {total} · Not Valid for Court</span>
      {hasQr && <><span lang="ur" dir="rtl">اوقات مریض: شام 4 تا 7 بجے</span>
        <img className="location-qr" src={tahiraLocationQr} alt="Clinic location QR" /></>}
    </footer>}
  </article>;
}

function firstPhysicianPageOverflow() {
  const firstSheet = document.querySelector(".print-preview-page > .print-sheet");
  const body = firstSheet?.querySelector(".physician-body");
  const treatment = firstSheet?.querySelector(".physician-treatment");
  if (!firstSheet || !body || !treatment) return Infinity;
  const bodyBottom = body.getBoundingClientRect().bottom;
  const contentBottom = Math.max(...[
    ".physician-clinical > div:last-child",
    ".physician-treatment > :last-child",
    ".physician-side-condition",
  ].map(selector => firstSheet.querySelector(selector)?.getBoundingClientRect().bottom || 0));
  return Math.max(
    firstSheet.scrollHeight - firstSheet.clientHeight,
    body.scrollHeight - body.clientHeight,
    treatment.scrollHeight - treatment.clientHeight,
    contentBottom - bodyBottom,
  );
}

export default function PaginatedPrint({ module, encounter, account, onReady, renderFirstPage }) {
  const medicineTotal = (encounter.details.medicines || []).filter(item => item.name?.trim()).length;
  const [medicineCount, setMedicineCount] = useState(medicineTotal);
  const [compactLevel, setCompactLevel] = useState(0);
  const { firstEncounter, blocks } = useMemo(() => module === "ultrasound"
    ? splitUltrasound(encounter) : splitPhysician(encounter, medicineCount, compactLevel),
  [module, encounter, medicineCount, compactLevel]);
  const [pages, setPages] = useState(null);
  const [layoutError, setLayoutError] = useState("");
  const capacityRef = useRef(null);
  const blocksRef = useRef(null);
  useLayoutEffect(() => {
    if (module !== "physician") return;
    const overflow = firstPhysicianPageOverflow();
    if (overflow <= 2) {
      setLayoutError("");
      return;
    }
    if (medicineCount) {
      // Remove one row at a time so the first page keeps every medicine that fits.
      setMedicineCount(current => current - 1);
    } else if (compactLevel < 2) {
      setCompactLevel(current => current + 1);
    } else {
      setLayoutError("The first prescription page is too full. Shorten a long section before printing.");
    }
  }, [module, medicineCount, compactLevel, firstEncounter]);
  useLayoutEffect(() => {
    const body = capacityRef.current;
    const style = body && getComputedStyle(body);
    const capacity = body ? body.clientHeight - parseFloat(style.paddingTop || "0") -
      parseFloat(style.paddingBottom || "0") : 0;
    const nodes = [...(blocksRef.current?.querySelectorAll(".paged-block") || [])];
    if (!capacity || nodes.length !== blocks.length) return;
    const groups = [[]];
    let used = 0;
    for (const [index, node] of nodes.entries()) {
      const height = node.getBoundingClientRect().height +
        parseFloat(getComputedStyle(node).marginBottom || "0");
      if (height > capacity - 12) {
        setLayoutError("One section is too long for an A4 page. Shorten that section before printing.");
        setPages(null);
        return;
      }
      if (used + height > capacity - 12 && groups.at(-1).length) {
        groups.push([]);
        used = 0;
      }
      groups.at(-1).push(blocks[index]);
      used += height;
    }
    setLayoutError("");
    setPages(blocks.length ? groups : []);
  }, [blocks]);
  useLayoutEffect(() => {
    onReady?.(Boolean(pages && !layoutError &&
      (module !== "physician" || firstPhysicianPageOverflow() <= 2)));
  }, [pages, layoutError, module, medicineCount, compactLevel, onReady]);
  return <>
    <div className="pagination-measure" aria-hidden="true">
      <ContinuationPage module={module} account={account} blocks={[]} index={1} total={2} bodyRef={capacityRef} />
      <div className={`pagination-measure-blocks ${module}`} ref={blocksRef}>
        {blocks.map(block => <Block block={block} key={block.key} />)}
      </div>
    </div>
    {renderFirstPage(firstEncounter, { continuationMedicineCount: medicineTotal - medicineCount })}
    {layoutError && <div className="error">{layoutError}</div>}
    {!pages && !layoutError && <p>Preparing print pages…</p>}
    {pages?.map((pageBlocks, index) => <ContinuationPage key={index} module={module}
      account={account} blocks={pageBlocks} index={index + 1} total={pages.length + 1} />)}
  </>;
}
