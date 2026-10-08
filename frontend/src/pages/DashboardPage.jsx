import { ArrowRight, Clock3, FileText, Plus, Stethoscope, UsersRound, Waves } from "lucide-react";
import physicianConsultation from "../assets/physician-consultation.png";
import { readableDate } from "../constants.js";

export default function DashboardPage({ doctor, summary, recentCases, navigate }) {
  const stats = [
    { title: "Today's Patients", count: summary.todayPatients, icon: UsersRound, filter: "" },
    { title: "Physician Patients", count: summary.physicianPatients, icon: Stethoscope, filter: "physician" },
    { title: "Ultrasound Patients", count: summary.ultrasoundPatients, icon: Waves, filter: "ultrasound" },
    { title: "Pending Reports", count: summary.pendingReports, icon: FileText, module: "ultrasound" },
  ];
  return <div className="dashboard-page">
    <div className="page-head dashboard-head">
      <div><span className="eyebrow">CLINIC OVERVIEW</span><h1>Good day, {doctor.doctorName}</h1><p>Here is your clinic overview.</p></div>
      <button className="primary" onClick={() => navigate("visitForm", { module: "physician" })}><Plus size={18} /> New patient</button>
    </div>
    <div className="stats">{stats.map((item) => {
      const Icon = item.icon;
      return <button className="stat-card" key={item.title} onClick={() => item.module ? navigate("module", { module: item.module }) : navigate("patients", { filter: item.filter })}>
        <span className="stat-icon blue"><Icon size={19} /></span><span className="stat-label">{item.title}</span><strong>{item.count ?? 0}</strong>
      </button>;
    })}</div>
    <div className="dashboard-grid">
      <section className="dashboard-recent">
        <div className="dashboard-panel-head"><h2>Recent clinical records</h2><button onClick={() => navigate("patients", { filter: "" })}>All patients <ArrowRight size={14} /></button></div>
        {recentCases.length ? <div className="dashboard-recent-list">{recentCases.map((item) => <button key={`${item.module}-${item.id}`} className="dashboard-recent-row" onClick={() => navigate("visitForm", { module: item.module, caseId: item.id })}>
          <span className="recent-time"><Clock3 size={14} />{readableDate(item.createdAt)}</span>
          <span className="recent-person"><strong>{item.patientName}</strong><small>{item.module === "physician" ? "Physician visit" : "Ultrasound report"} · {item.mrNumber}</small></span>
          <span className={`badge ${item.status === "final" ? "green" : "muted-badge"}`}>{item.status === "final" ? "Final" : "Draft"}</span>
        </button>)}</div> : <div className="dashboard-recent-empty"><FileText size={30} /><strong>No records yet</strong><span>Start a Physician visit or Ultrasound report to see it here.</span></div>}
      </section>
      <div className="dashboard-side">
        <button className="dashboard-photo" onClick={() => navigate("module", { module: "physician" })} style={{ backgroundImage: `linear-gradient(0deg, rgba(15,23,42,.93), rgba(15,23,42,0) 74%), url(${physicianConsultation})` }}>
          <span>PHYSICIAN WORKSPACE</span><strong>Care starts with a conversation.</strong><small>Open Physician <ArrowRight size={15} /></small>
        </button>
        <div className="dashboard-shortcuts"><button onClick={() => navigate("visitForm", { module: "ultrasound" })}><Waves size={20} /><strong>New ultrasound</strong><small>Start examination</small></button><button onClick={() => navigate("templates")}><FileText size={20} /><strong>Template Library</strong><small>Use a saved template</small></button></div>
      </div>
    </div>
  </div>;
}
