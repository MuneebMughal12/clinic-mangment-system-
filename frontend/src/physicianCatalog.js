// Transcribed from the supplied photographs as editable starting points.
// Only legible details from the supplied photographs are used. Directions are
// examples for doctor review, never a patient-specific prescription.
const photographedDirections = {
  "Amlodipine": { strength: "5 mg", frequency: "Once daily (OD)", sourceNote: "Hypertension photograph: 5 mg OD. Doctor to confirm patient directions." },
  "Telmisartan": { strength: "40 mg", frequency: "Once daily (OD)", sourceNote: "Hypertension photograph: 40 mg OD. Doctor to confirm patient directions." },
  "Hydrochlorothiazide": { strength: "12.5 mg", frequency: "Once daily (OD)", sourceNote: "Hypertension photograph: 12.5 mg OD. Doctor to confirm patient directions." },
  "Metformin": { strength: "500 mg", frequency: "Twice daily (BD)", sourceNote: "Diabetes photograph: 500 mg BD. Doctor to confirm patient directions." },
  "Glimepiride": { strength: "1 mg", frequency: "Once daily (OD)", food: "Before breakfast", sourceNote: "Diabetes photograph: 1 mg OD before breakfast. Doctor to confirm patient directions." },
  "Azithromycin": { strength: "500 mg", frequency: "Once daily (OD)", duration: "3 days", sourceNote: "Sore throat photograph: 500 mg OD for 3 days if bacterial cause suspected. Doctor must confirm diagnosis and treatment." },
  "Cetirizine": { strength: "10 mg", sourceNote: "Common cold photograph: 10 mg. Doctor to set dose and timing." },
  "Levocetirizine": { strength: "5 mg", sourceNote: "Common cold photograph: 5 mg. Doctor to set dose and timing." },
  "Ibuprofen": { strength: "400 mg", sourceNote: "Headache photograph: 400 mg. Doctor to set dose and timing." },
  "Naproxen": { strength: "250 mg", sourceNote: "Headache photograph: 250 mg. Doctor to set dose and timing." },
  "Metronidazole": { strength: "400 mg", frequency: "Three times daily (TDS)", food: "After food", duration: "5 days", sourceNote: "Human bite photograph: 400 mg TDS for 5 days after food. Doctor to confirm patient directions." },
  "Amoxicillin + clavulanic acid": { strength: "625 mg", frequency: "Three times daily (TDS)", food: "After food", duration: "5 days", sourceNote: "Human bite photograph: 625 mg TDS for 5 days after food. Other supplied notes use different directions; doctor must choose for this patient." },
  "Baclofen": { strength: "5 mg", frequency: "Twice daily (BD)", duration: "3 days", sourceNote: "Hiccups photograph: 5 mg BD for 3 days. Doctor to confirm patient directions." },
  "Metoclopramide": { strength: "10 mg", frequency: "Twice daily (BD)", duration: "5 days", sourceNote: "Hiccups photograph: 10 mg BD for 5 days. Doctor to confirm patient directions." },
  "Coenzyme Q10": { strength: "100 mg", frequency: "Once daily (OD)", duration: "3 months", sourceNote: "Low sperm count photograph: 100 mg OD for 3 months. Doctor to confirm patient directions." },
  "Lactulose": { dose: "10–15 mL", frequency: "At night", sourceNote: "Constipation photograph: 10–15 mL at night. Doctor to confirm patient directions." },
  "Paracetamol": { strength: "500 mg", sourceNote: "Multiple supplied photographs list paracetamol with varying directions. Doctor to choose dose and timing." },
};
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
    data: { name, strength: "", dose: "", route: "", frequency: "", food: "", duration: "", sourceNote: "Supplied photograph identified this medicine; directions must be entered by the doctor.", ...photographedDirections[name] },
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
