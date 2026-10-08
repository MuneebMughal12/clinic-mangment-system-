export const physicianTestOptions = [
  "CBC", "Cholesterol", "RFTs", "Triglyceride", "U.Acid", "Urine/R/E",
  "LFTs", "USG", "HBsAg", "CXR", "HCV", "ECG", "BSR", "CT Scan",
  "BSF", "T3 T4 TSH",
];

export function readPhysicianTests(value) {
  const parts = String(value || "").split(/[,;\n]+/).map(part => part.trim()).filter(Boolean);
  const options = new Map(physicianTestOptions.map(option => [option.toLowerCase(), option]));
  const selected = physicianTestOptions.filter(option =>
    parts.some(part => part.toLowerCase() === option.toLowerCase()));
  const other = parts.filter(part => !options.has(part.toLowerCase())).join(", ");
  return { selected, other };
}

export function writePhysicianTests(selected, other = "") {
  const known = physicianTestOptions.filter(option => selected.includes(option));
  return [...known, String(other).trim()].filter(Boolean).join(", ");
}
