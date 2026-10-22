const measurementLabels = [
  [/^GS\s*:/i, "Gestational sac (GS)"],
  [/^CRL\s*:/i, "Crown-rump length (CRL)"],
  [/^BPD\s*=/i, "Biparietal diameter (BPD)"],
  [/^HC\s*=/i, "Head circumference (HC)"],
  [/^AC\s*=/i, "Abdominal circumference (AC)"],
  [/^FL\s*=/i, "Femur length (FL)"],
  [/^Average\s*:/i, "Average gestational age"],
  [/^Estimated fetal weight/i, "Estimated fetal weight (EFW)"],
  [/^Expected date of delivery/i, "Expected date of delivery (EDD)"],
  [/^Gestational age calculated by LMP/i, "Gestational age by LMP"],
  [/^Gestational age calculated by ultrasound/i, "Gestational age by ultrasound"],
  [/^Age of gestation assessed/i, "Gestational age by measurements"],
  [/^Fetal heart rate/i, "Fetal heart rate"],
  [/^Cardiac activity/i, "Cardiac activity"],
  [/^(?:No )?flicker like fetal cardiac activity/i, "Cardiac activity"],
  [/^Umbilical arterial Doppler/i, "Umbilical artery Doppler"],
  [/^Placenta is/i, "Placenta"],
  [/^Amniotic fluid is/i, "Amniotic fluid / AFI"],
  [/^Single.{0,35}gestational sac/i, "Gestational sac and embryo"],
  [/^Single,? alive fetus/i, "Fetus and presentation"],
  [/^It shows (?:no )?flow on CDI/i, "Color Doppler flow"],
  [/^Cervix appears/i, "Cervix"],
  [/^Portal vein measures/i, "Portal vein"],
  [/^It was scanned with/i, "Scan technique"],
  [/^These were scanned with/i, "Scan technique"],
  [/^Right .?t? breast show/i, "Right breast tissue"],
  [/^Left breast show/i, "Left breast tissue"],
  [/^No architechtural distortion/i, "Breast architecture"],
  [/^two well defined oval shaped/i, "Breast lesion and measurements"],
  [/^Lactiferous ducts/i, "Lactiferous ducts"],
  [/^Visualized pectoralis/i, "Pectoralis muscle"],
  [/^Overlying skin/i, "Skin and subcutaneous tissue"],
  [/^No solid or cystic mass detected in axillae/i, "Axillae"],
];

function namedLine(line) {
  for (const [pattern, label] of measurementLabels) {
    if (pattern.test(line)) return label;
  }
  const heading = line.match(/^([A-Za-z][A-Za-z /&()-]{1,48})\s*:\s*$/);
  if (heading) return heading[1].trim();
  if (/^[A-Z][A-Z /&()-]{2,48}$/.test(line)) return line;
  const inline = line.match(/^([A-Za-z][A-Za-z /&()-]{1,32}):\s+.+/);
  if (inline) return inline[1].trim();
  return "";
}

function titleCase(label) {
  if (label !== label.toUpperCase()) return label;
  return label.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function sectionsFromReportBody(body) {
  const sections = [];
  let current = null;
  let breastSide = "";
  const flush = () => {
    if (current?.text.trim()) sections.push(current);
    current = null;
  };
  for (const raw of String(body || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^Fetal measurements are\s*:/i.test(line)) continue;
    if (/^RIGHT BREAST\s*:/i.test(line)) breastSide = "Right";
    if (/^LEFT BREAST\s*:/i.test(line)) breastSide = "Left";
    let label = namedLine(line);
    if (breastSide && /^(Breast architecture|Lactiferous ducts|Pectoralis muscle|Skin and subcutaneous tissue|Axillae)$/.test(label))
      label = `${breastSide} ${label.toLowerCase()}`;
    if (label) {
      flush();
      current = { label: titleCase(label), text: line };
      if (line.replace(/\s*:\s*$/, "") === line && !/^[A-Z][A-Z /&()-]{2,48}$/.test(line)) {
        // A named measurement sentence already carries its own wording.
        continue;
      }
      if (/^\s*[A-Za-z /&()-]+\s*:\s*$/.test(line) || /^[A-Z][A-Z /&()-]{2,48}$/.test(line)) {
        current.text = "";
      }
    } else if (current) {
      current.text += `${current.text ? "\n" : ""}${line}`;
    } else {
      current = { label: "Findings", text: line };
    }
  }
  flush();
  return sections.length ? sections : [{ label: "Findings", text: "" }];
}

export function structuredUltrasoundDraft(draft) {
  return {
    ...draft,
    reportStyle: "sections",
    sections: sectionsFromReportBody(draft.reportBody),
    reportBody: "",
  };
}
