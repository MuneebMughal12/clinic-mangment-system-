import { useEffect, useState } from "react";
import { CalendarDays, Search, UserRound } from "lucide-react";
import AuthScreen from "./components/AuthScreen.jsx";
import Sidebar from "./components/Sidebar.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import PatientListPage from "./pages/PatientListPage.jsx";
import PatientFormPage from "./pages/PatientFormPage.jsx";
import PatientDetailPage from "./pages/PatientDetailPage.jsx";
import ModulePage from "./pages/ModulePage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import PrintPreviewPage from "./pages/PrintPreviewPage.jsx";
import TemplateLibraryPage from "./pages/TemplateLibraryPage.jsx";
import DoctorProfilePage from "./pages/DoctorProfilePage.jsx";
import DoctorAccountsPage from "./pages/DoctorAccountsPage.jsx";
import ChangePasswordPage from "./pages/ChangePasswordPage.jsx";
import BackupSettingsPage from "./pages/BackupSettingsPage.jsx";
import { clearNavigation, defaultNavigation, restoreNavigation, saveNavigation } from "./navigation-state.js";

export default function App() {
  const [boot, setBoot] = useState(null);
  const [account, setAccount] = useState(null);
  const doctor = account?.role === "clinic" ? account : null;
  const [screen, setScreen] = useState(defaultNavigation.screen);
  const [activeModule, setActiveModule] = useState(defaultNavigation.activeModule);
  const [summary, setSummary] = useState({
    totalPatients: 0,
    todayPatients: 0,
    physicianPatients: 0,
    ultrasoundPatients: 0,
    pendingReports: 0,
  });
  const [patients, setPatients] = useState([]);
  const [cases, setCases] = useState([]);
  const [recentCases, setRecentCases] = useState([]);
  const [search, setSearch] = useState("");
  const [topbarSearch, setTopbarSearch] = useState("");
  const [patientFilter, setPatientFilter] = useState("");
  const [visitPatientId, setVisitPatientId] = useState(null);
  const [visitCaseId, setVisitCaseId] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [error, setError] = useState("");

  function setNavigationState(route) {
    setScreen(route.screen);
    setActiveModule(route.activeModule);
    setPatientFilter(route.patientFilter);
    setSearch(route.search);
    setVisitPatientId(route.visitPatientId);
    setVisitCaseId(route.visitCaseId);
    setSelectedPatientId(route.selectedPatientId);
    setSelectedPatient(null);
  }

  useEffect(() => {
    window.clinic
      .bootstrap()
      .then((result) => {
        setNavigationState(restoreNavigation(window.sessionStorage, result.account));
        setAccount(result.account ?? null);
        setBoot(result);
      })
      .catch((err) => setError(err.message));
  }, []);
  useEffect(() => {
    if (!boot || !doctor) return;
    saveNavigation(window.sessionStorage, doctor, {
      screen, activeModule, patientFilter, search,
      visitPatientId, visitCaseId, selectedPatientId,
    });
  }, [boot, doctor, screen, activeModule, patientFilter, search, visitPatientId, visitCaseId, selectedPatientId]);
  useEffect(() => {
    if (!doctor || screen !== "patient" || !selectedPatientId || selectedPatient) return;
    let cancelled = false;
    window.clinic.getPatient(selectedPatientId)
      .then((patient) => {
        if (cancelled) return;
        if (patient) setSelectedPatient(patient);
        else {
          setSelectedPatientId(null);
          setScreen("patients");
          setError("Patient record could not be found.");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSelectedPatientId(null);
          setScreen("patients");
          setError(err.message);
        }
      });
    return () => { cancelled = true; };
  }, [doctor, screen, selectedPatientId, selectedPatient]);
  useEffect(() => {
    if (!doctor) return;
    window.clinic
      .summary()
      .then(setSummary)
      .catch((err) => setError(err.message));
  }, [doctor, screen]);
  useEffect(() => {
    if (!doctor || screen !== "patients") return;
    let cancelled = false;
    window.clinic
      .patients(search, patientFilter)
      .then((rows) => {
        if (!cancelled) setPatients(rows);
      })
      .catch((err) => setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [doctor, screen, search, patientFilter]);
  useEffect(() => {
    if (!doctor || screen !== "module") return;
    window.clinic
      .cases(activeModule)
      .then(setCases)
      .catch((err) => setError(err.message));
  }, [doctor, screen, activeModule]);
  useEffect(() => {
    if (!doctor || screen !== "dashboard") return;
    let cancelled = false;
    Promise.all([window.clinic.cases("physician"), window.clinic.cases("ultrasound")])
      .then(([physician, ultrasound]) => {
        if (!cancelled) setRecentCases([...physician, ...ultrasound]
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 5));
      })
      .catch((err) => setError(err.message));
    return () => { cancelled = true; };
  }, [doctor, screen]);

  function navigate(next, options = {}) {
    setError("");
    setScreen(next);
    if (options.module) setActiveModule(options.module);
    if (next === "visitForm") {
      setVisitPatientId(options.patientId ?? null);
      setVisitCaseId(options.caseId ?? null);
    } else {
      setVisitPatientId(null);
      setVisitCaseId(next === "printPreview" ? (options.caseId ?? null) : null);
    }
    if (next !== "patient") setSelectedPatientId(null);
    if (options.filter !== undefined) setPatientFilter(options.filter);
    if (next === "patients") setSearch(options.search ?? "");
  }

  async function openPatient(id) {
    try {
      const patient = await window.clinic.getPatient(id);
      if (!patient) throw new Error("Patient record could not be found.");
      setSelectedPatient(patient);
      setSelectedPatientId(id);
      navigate("patient");
    } catch (err) {
      setError(err.message);
    }
  }

  async function encounterSaved(encounter, { openPrintPreview = false } = {}) {
    setSelectedPatient(encounter.patient);
    setSummary(await window.clinic.summary());
    setCases(await window.clinic.cases(encounter.module));
    navigate(openPrintPreview ? "printPreview" : "module", {
      module: encounter.module,
      caseId: encounter.id,
    });
    if (encounter.backupWarning)
      setError(
        `Record saved, but automatic backup failed: ${encounter.backupWarning}`,
      );
  }

  async function logout() {
    await window.clinic.logout();
    clearNavigation(window.sessionStorage);
    setBoot(await window.clinic.bootstrap());
    setAccount(null);
    setNavigationState(defaultNavigation);
  }

  function signedIn(nextAccount) {
    clearNavigation(window.sessionStorage);
    setNavigationState(defaultNavigation);
    setAccount(nextAccount);
  }

  if (!boot)
    return <div className="loading">{error || "Opening Clinic Desk…"}</div>;
  if (!account) return <AuthScreen onSuccess={signedIn} needsAdminSetup={!boot.adminConfigured} />;
  if (account.role === "admin") return <AdminPage logout={logout} />;

  return (
    <div className="app-shell">
      <Sidebar
        doctor={doctor}
        screen={screen}
        activeModule={activeModule}
        navigate={navigate}
        logout={logout}
      />
      <main className="main">
        <header className="topbar">
          <form className="topbar-search" onSubmit={(event) => { event.preventDefault(); navigate("patients", { filter: "", search: topbarSearch.trim() }); }}>
            <Search size={18} />
            <input aria-label="Search patients" placeholder="Search patients, MR number or phone" value={topbarSearch} onChange={(event) => setTopbarSearch(event.target.value)} />
          </form>
          <div className="topbar-right">
            <span className="topbar-date">
            <CalendarDays size={16} />{" "}
            {new Date().toLocaleDateString("en-PK", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            </span>
            <span className="topbar-profile"><UserRound size={18} /></span>
          </div>
        </header>
        <div className="content">
          {error && (
            <div className="error floating">
              {error}
              <button onClick={() => setError("")}>×</button>
            </div>
          )}
          {screen === "dashboard" && (
            <DashboardPage
              doctor={doctor}
              summary={summary}
              recentCases={recentCases}
              navigate={navigate}
            />
          )}
          {screen === "patients" && (
            <PatientListPage
              patients={patients}
              search={search}
              setSearch={setSearch}
              filter={patientFilter}
              setFilter={setPatientFilter}
              navigate={navigate}
              openPatient={openPatient}
            />
          )}
          {screen === "visitForm" && (
            <PatientFormPage
              key={`${activeModule}-${visitCaseId || "new"}-${visitPatientId || "new"}`}
              module={activeModule}
              patientId={visitPatientId}
              caseId={visitCaseId}
              onSaved={encounterSaved}
              navigate={navigate}
            />
          )}
          {screen === "patient" && selectedPatient && (
            <PatientDetailPage patient={selectedPatient} navigate={navigate} />
          )}
          {screen === "module" && (
            <ModulePage
              module={activeModule}
              cases={cases}
              navigate={navigate}
            />
          )}
          {screen === "printPreview" && (
            <PrintPreviewPage
              caseId={visitCaseId}
              module={activeModule}
              account={doctor}
              navigate={navigate}
            />
          )}
          {screen === "templates" && <TemplateLibraryPage />}
          {screen === "doctorProfile" && (
            <DoctorProfilePage account={doctor} onSaved={setAccount} />
          )}
          {screen === "doctorAccounts" && doctor.isOwner && (
            <DoctorAccountsPage />
          )}
          {screen === "changePassword" && <ChangePasswordPage />}
          {screen === "backupSettings" && doctor.isOwner && <BackupSettingsPage />}
        </div>
      </main>
    </div>
  );
}
