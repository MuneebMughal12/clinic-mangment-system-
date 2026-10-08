import { Stethoscope, Waves } from "lucide-react";

export const emptyPatient = {
  name: "",
  ageYears: "",
  gender: "",
  relationship: "",
  phone: "",
  address: "",
  allergies: "",
  medicalHistory: "",
  currentMedications: "",
};

export const moduleInfo = {
  physician: {
    title: "Physician",
    subtitle: "Consultations and prescriptions",
    icon: Stethoscope,
    color: "green",
  },
  ultrasound: {
    title: "Ultrasound",
    subtitle: "Examinations and reports",
    icon: Waves,
    color: "blue",
  },
};

export function readableDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
