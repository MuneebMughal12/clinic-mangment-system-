import {
  ArrowRight,
  ChevronRight,
  FileText,
  Plus,
  Printer,
  UserRound,
} from "lucide-react";
import { moduleInfo, readableDate } from "../constants.js";
import ultrasoundRoom from "../assets/ultrasound-room.png";
import physicianConsultation from "../assets/physician-consultation.png";

export default function ModulePage({ module, cases, navigate }) {
  const info = moduleInfo[module];
  const Icon = info.icon;

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">DOCTOR WORKSPACE</span>
          <h1 className="module-title">
            <span className={`stat-icon ${info.color}`}>
              <Icon size={25} />
            </span>
            {info.title}
          </h1>
          <p>{info.subtitle}. Patient records are shared across modules.</p>
        </div>
        <div className="module-actions">
          <button
            className="primary"
            onClick={() => navigate("visitForm", { module })}
          >
            <Plus size={18} /> New {module === "physician" ? "visit" : "report"}
          </button>
        </div>
      </div>
      <div className={`module-banner ${module === "ultrasound" ? "ultrasound-banner" : "physician-banner"}`} style={{ backgroundImage: `linear-gradient(90deg, #111827 0%, rgba(17,24,39,.94) 45%, rgba(17,24,39,.3) 100%), url(${module === "ultrasound" ? ultrasoundRoom : physicianConsultation})` }}>
        <span className={`stat-icon ${info.color}`}>
          <Icon size={23} />
        </span>
        <div>
          <strong>
            Patient and {module === "physician" ? "visit" : "report"} in one
            form
          </strong>
          <p>
            Enter a new patient here, or select an existing patient in the form.
            Save both together.
          </p>
        </div>
      </div>
      <div className="section-heading">
        <div>
          <h2>Recent {module === "physician" ? "visits" : "examinations"}</h2>
          <p>Saved entries for patients in this module.</p>
        </div>
      </div>
      <div className="panel">
        {cases.length ? (
          <div className="case-list">
            {cases.map((item) => (
              <div className="case-entry" key={item.id}>
                <button
                  onClick={() =>
                    navigate("visitForm", { module, caseId: item.id })
                  }
                >
                  <span className="mini-avatar">
                    <UserRound size={18} />
                  </span>
                  <span>
                    <strong>{item.patientName}</strong>
                    <small>
                      {item.mrNumber} · {readableDate(item.createdAt)} ·{" "}
                      {item.doctorName}
                    </small>
                  </span>
                  <span
                    className={`badge ${item.status === "final" ? "final-badge" : "muted-badge"}`}
                  >
                    {item.status === "final"
                      ? `Final${item.revision ? ` · amended ${item.revision}×` : ""}`
                      : "Draft"}
                  </span>
                  <ChevronRight size={17} />
                </button>
                <button
                  className="case-print"
                  onClick={() =>
                    navigate("printPreview", { module, caseId: item.id })
                  }
                >
                  <Printer size={16} /> Print
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">
            <FileText size={34} />
            <h3>No {module === "physician" ? "visits" : "examinations"} yet</h3>
            <p>
              Start a {module === "physician" ? "visit" : "report"} and enter
              patient details in the same form.
            </p>
            <button
              className="secondary"
              onClick={() => navigate("visitForm", { module })}
            >
              Start {module === "physician" ? "visit" : "report"}{" "}
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
