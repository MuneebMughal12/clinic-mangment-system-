import { ArrowLeft, ArrowRight, Stethoscope, Waves } from "lucide-react";
import { readableDate } from "../constants.js";

export default function PatientDetailPage({ patient, navigate }) {
  const details = [
    ["MR number", patient.mrNumber],
    ["Age", patient.ageYears == null ? "—" : `${patient.ageYears} years`],
    ["Gender", patient.gender || "—"],
    ["Phone", patient.phone || "—"],
    ["Guardian / relationship", patient.relationship || "—"],
    ["Address", patient.address || "—"],
    ["Allergies", patient.allergies || "—"],
    ["Medical history", patient.medicalHistory || "—"],
    ["Current medications", patient.currentMedications || "—"],
  ];

  return (
    <>
      <button
        className="back"
        onClick={() => navigate("patients", { filter: "" })}
      >
        <ArrowLeft size={17} /> Patients
      </button>
      <div className="page-head compact">
        <div>
          <span className="eyebrow">{patient.mrNumber}</span>
          <h1>{patient.name}</h1>
          <p>
            Registered {readableDate(patient.createdAt)} · Shared patient record
          </p>
        </div>
      </div>
      <div className="detail-grid">
        <div className="panel detail-panel">
          <h2>Patient information</h2>
          <div className="detail-rows">
            {details.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="panel action-panel">
          <h2>Start a new visit</h2>
          <p>
            Choose where this patient is being seen. Both modules use this same
            MR number.
          </p>
          <button
            onClick={() =>
              navigate("visitForm", {
                module: "physician",
                patientId: patient.id,
              })
            }
          >
            <span className="stat-icon green">
              <Stethoscope size={22} />
            </span>
            <span>
              <strong>Physician visit</strong>
              <small>Open the physician form</small>
            </span>
            <ArrowRight size={17} />
          </button>
          <button
            onClick={() =>
              navigate("visitForm", {
                module: "ultrasound",
                patientId: patient.id,
              })
            }
          >
            <span className="stat-icon blue">
              <Waves size={22} />
            </span>
            <span>
              <strong>Ultrasound exam</strong>
              <small>Open the ultrasound form</small>
            </span>
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </>
  );
}
