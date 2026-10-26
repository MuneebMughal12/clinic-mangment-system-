// Transcribed from the supplied photographs as editable starting points.
// No dose, route, frequency or duration is inferred from a generic photograph.
const medicineNames = [
  "Amoxicillin + clavulanic acid",
  "Azithromycin",
  "Baclofen",
  "Beclomethasone inhaler",
  "Bisacodyl",
  "Cetirizine",
  "Cefuroxime",
  "Chlorhexidine mouthwash",
  "Ciprofloxacin",
  "Clomiphene citrate",
  "Coenzyme Q10",
  "Glimepiride",
  "Hydrochlorothiazide",
  "Ibuprofen",
  "Lactulose",
  "Levocetirizine",
  "Metformin",
  "Metoclopramide",
  "Metronidazole",
  "Miconazole oral gel",
  "Montelukast",
  "Naproxen",
  "Nystatin oral drops",
  "Omeprazole",
  "Oral rehydration salts (ORS)",
  "Pantoprazole",
  "Paracetamol",
  "Probiotic supplement",
  "Psyllium husk",
  "Salbutamol inhaler/nebulizer",
  "Sodium citrate solution",
  "Sucralfate",
  "Sumatriptan",
  "Telmisartan",
  "Amlodipine",
  "Zinc + vitamin supplement",
];

export const medicineCatalog = medicineNames
  .sort((a, b) => a.localeCompare(b))
  .map((name) => ({
    name,
    data: { name, strength: "", dose: "", route: "", frequency: "", food: "", duration: "" },
  }));

function plan(name, medicines, extras = {}) {
  return {
    name,
    data: {
      complaints: "",
      symptoms: "",
      findings: "",
      diagnosis: name,
      medicines: [],
      suggestedMedicines: medicines,
      tests: "",
      advice: "",
      followUp: "",
      ...extras,
    },
  };
}

export const physicianPlanCatalog = [
  plan("Asthma", ["Salbutamol inhaler/nebulizer", "Beclomethasone inhaler", "Montelukast"]),
  plan("Common cold", ["Cetirizine", "Levocetirizine", "Paracetamol"]),
  plan("Constipation", ["Psyllium husk", "Lactulose", "Bisacodyl"], {
    advice: "Increase water intake and dietary fibre as appropriate for this patient.",
  }),
  plan("Diarrhea / gastroenteritis", ["Oral rehydration salts (ORS)", "Probiotic supplement"]),
  plan("Gastritis / acidity / GERD", ["Pantoprazole", "Omeprazole", "Sucralfate"], {
    advice: "Choose the treatment appropriate to this patient's assessment.",
  }),
  plan("Headache", ["Paracetamol", "Ibuprofen", "Naproxen", "Sumatriptan"]),
  plan("Hiccups", ["Metoclopramide", "Baclofen"]),
  plan("Human bite wound", ["Amoxicillin + clavulanic acid", "Metronidazole"], {
    advice: "Assess the wound and immunisation status; document wound care and follow-up for this patient.",
  }),
  plan("Hypertension", ["Amlodipine", "Telmisartan", "Hydrochlorothiazide"]),
  plan("Low sperm count", ["Clomiphene citrate", "Zinc + vitamin supplement", "Coenzyme Q10"], {
    followUp: "Review interval to be confirmed by the doctor",
  }),
  plan("Migraine headache", ["Paracetamol", "Sumatriptan"]),
  plan("Oral thrush", ["Miconazole oral gel", "Nystatin oral drops"]),
  plan("Sore throat / tonsillitis", ["Paracetamol", "Chlorhexidine mouthwash", "Azithromycin"], {
    advice: "The source note includes salt-water gargles. Confirm the cause before choosing any antibiotic.",
  }),
  plan("Type 2 diabetes", ["Metformin", "Glimepiride"]),
  plan("Urinary tract infection", ["Ciprofloxacin", "Cefuroxime", "Sodium citrate solution"]),
];

export function applyPhysicianPlanDraft(current, planData, selectedMedicineNames, savedTemplates = []) {
  const plan = structuredClone(planData);
  delete plan.suggestedMedicines;
  for (const key of ["complaints", "symptoms", "findings"])
    if (!plan[key]) delete plan[key];
  const selected = selectedMedicineNames.map((name) => {
    const saved = savedTemplates.find((item) => item.type === "medicine" && item.data.name === name);
    const supplied = medicineCatalog.find((item) => item.name === name);
    return saved?.data || supplied?.data;
  }).filter(Boolean).map((item) => structuredClone(item));
  const planned = (plan.medicines || []).filter((item) => item.name?.trim());
  const existing = (current.medicines || []).filter((item) => item.name?.trim());
  return { ...current, ...plan, medicines: [...existing, ...planned, ...selected] };
}
