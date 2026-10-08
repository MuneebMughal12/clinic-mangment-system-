import { ChevronRight, Plus, Search, UsersRound } from "lucide-react";
import { moduleInfo, readableDate } from "../constants.js";

export default function PatientListPage({
  patients,
  search,
  setSearch,
  filter,
  setFilter,
  navigate,
  openPatient,
}) {
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">PATIENT DIRECTORY</span>
          <h1>
            {filter ? `${moduleInfo[filter].title} patients` : "All patients"}
          </h1>
          <p>Search once and use the same record in both modules.</p>
        </div>
        <button
          className="primary cta"
          onClick={() => navigate("visitForm", { module: "physician" })}
        >
          <Plus size={18} /> Add patient
        </button>
      </div>
      <div className="panel">
        <div className="list-toolbar">
          <div className="searchbox">
            <Search size={18} />
            <input
              placeholder="Search name, MR number or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="filters">
            {[
              ["", "All"],
              ["physician", "Physician"],
              ["ultrasound", "Ultrasound"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={filter === key ? "active" : ""}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {patients.length ? (
          <div className="patient-list">
            <div className="table-head">
              <span>MR NUMBER</span>
              <span>PATIENT</span>
              <span>PHONE</span>
              <span>LAST VISIT</span>
              <span>STATUS</span>
              <span>MODULES</span>
              <span></span>
            </div>
            {patients.map((patient) => (
              <button
                className="patient-row"
                key={patient.id}
                onClick={() => openPatient(patient.id)}
              >
                <span className="mono">{patient.mrNumber}</span>
                <span className="patient-name">
                  <span className="mini-avatar">
                    {patient.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="patient-identity"><strong>{patient.name}</strong><small>{patient.ageYears == null ? "Age not entered" : `${patient.ageYears} years`}</small></span>
                </span>
                <span>{patient.phone || "—"}</span>
                <span>{readableDate(patient.lastVisit)}</span>
                <span><span className={`badge ${patient.lastStatus === "final" ? "green" : "muted-badge"}`}>{patient.lastStatus === "final" ? "Completed" : patient.lastStatus === "draft" ? "Pending" : "New"}</span></span>
                <span className="badges">
                  {patient.hasPhysician ? (
                    <span className="badge green">Physician</span>
                  ) : null}
                  {patient.hasUltrasound ? (
                    <span className="badge blue">Ultrasound</span>
                  ) : null}
                  {!patient.hasPhysician && !patient.hasUltrasound ? (
                    <span className="muted">New</span>
                  ) : null}
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
        ) : (
          <div className="empty">
            <UsersRound size={34} />
            <h3>No patients found</h3>
            <p>
              {search
                ? "Try a different name, MR number or phone."
                : filter
                  ? "No patients have started a case in this module yet."
                  : "Start a physician visit or ultrasound report to add a patient."}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
