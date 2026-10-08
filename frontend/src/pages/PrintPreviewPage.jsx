import { useEffect, useState } from "react";
import { ArrowLeft, Pencil, Printer } from "lucide-react";
import PaginatedPrint from "./PaginatedPrint.jsx";
import ultrasoundStationery from "../assets/ultrasound-stationery-reference.jpeg";
import tahiraLocationQr from "../assets/tahira-location-qr.jpg";
import { clinicPreset } from "../../../shared/clinic-preset.js";
import { physicianTestOptions, readPhysicianTests } from "../physicianTests.js";

function value(text) {
  return text === undefined || text === null || text === ""
    ? "—"
    : String(text);
}

function dateTime(text) {
  if (!text) return "—";
  const date = new Date(text);
  return Number.isNaN(date.getTime())
    ? text
    : date.toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" });
}

function Line({ label, children }) {
  return (
    <div className="print-line">
      <strong>{label}</strong>
      <span>{value(children)}</span>
    </div>
  );
}

function ClinicHeading({ account }) {
  return (
    <header className="print-clinic">
      <div className="print-clinic-title">{account.clinicName || "Clinic"}</div>
      <div className="print-clinic-address">{account.address || " "}</div>
      <div className="physician-letterhead-details">
        <div className="physician-doctor-english">
          <strong>{account.doctorName || "Doctor"}</strong>
          <span>{account.doctorQualification}</span>
          {account.registration && <small>PMDC #: {account.registration}</small>}
        </div>
        <div className="physician-phc-center">
          <span className="physician-crescent" aria-hidden="true">☪</span>
          {account.phcRegistration && <b>PHC #: {account.phcRegistration}</b>}
        </div>
        <div className="physician-doctor-urdu" lang="ur" dir="rtl">
          <strong>{account.doctorNameUrdu}</strong>
          <span>{account.doctorQualificationUrdu}</span>
        </div>
      </div>
    </header>
  );
}

function RecordMark({ encounter }) {
  return (
    <div
      className={`print-record-mark ${encounter.status === "final" ? "is-final" : "is-draft"}`}
    >
      {encounter.status === "final"
        ? `Finalized by ${value(encounter.finalizedBy)} · ${dateTime(encounter.finalizedAt)}${encounter.revision ? ` · Amended ${encounter.revision}×` : ""}`
        : "DRAFT — doctor review pending"}
    </div>
  );
}

function DemoMark({ account }) {
  return account.username?.toLowerCase().startsWith("demo") ? (
    <div className="print-demo-mark">SAMPLE DATA · NOT FOR CLINICAL USE</div>
  ) : null;
}

function hasLocationQr(account) {
  return account.clinicName?.trim().toLowerCase() === "tahira memorial clinic";
}

function LocationQr({ account, className = "" }) {
  return hasLocationQr(account) ? (
    <img
      className={`location-qr ${className}`}
      src={tahiraLocationQr}
      alt="Tahira Memorial Clinic location QR code"
    />
  ) : null;
}

function PhysicianSheet({ encounter, account, paginated = false, continuationMedicineCount = 0 }) {
  const { patient, details: d } = encounter;
  const printAccount = { ...account, ...encounter.printDoctor };
  printAccount.doctorQualification = printAccount.doctorQualificationPhysician || printAccount.doctorQualification;
  const medicines = (d.medicines || []).filter((medicine) =>
    medicine.name?.trim(),
  );
  const triage = String(d.triage || "").toLowerCase();
  const condition = String(d.condition || "").toLowerCase();
  const tests = readPhysicianTests(d.tests);
  return (
    <article className={`print-sheet physician-sheet${hasLocationQr(account) ? " has-location-qr" : ""}${medicines.length > 4 ? " medicine-dense" : ""}${paginated ? " paginated-first" : ""}`}>
      <ClinicHeading account={printAccount} />
      <DemoMark account={account} />
      <RecordMark encounter={encounter} />
      <div className="physician-identification">
        <Line label="MR No.">{patient.mrNumber}</Line>
        <Line label="Date / time">{dateTime(encounter.createdAt)}</Line>
        <Line label="Visit no.">{encounter.visitNumber}</Line>
        <Line label="Patient">{patient.name}</Line>
        <Line label="Age">
          {patient.ageYears == null ? "" : `${patient.ageYears} years`}
        </Line>
        {patient.relationship && (
          <Line label="Guardian / relation">{patient.relationship}</Line>
        )}
        <Line label="Gender">{patient.gender}</Line>
        <Line label="Contact">{patient.phone}</Line>
        <Line label="Address">{patient.address}</Line>
      </div>
      <div className="physician-vitals">
        <strong>Vitals</strong>
        <span>BP {value(d.bp)} mmHg</span>
        <span>Pulse {value(d.pulse)} bpm</span>
        <span>Temp {value(d.temperature)}</span>
        <span>R/R {value(d.respiratoryRate)} /min</span>
        <span>SpO₂ {value(d.spo2)}%</span>
        <span>Weight {value(d.weight)} kg</span>
      </div>
      <div className="physician-diagnosis">
        <strong>Provisional diagnosis</strong>
        <span>{value(d.diagnosis)}</span>
      </div>
      <div className="physician-body">
        <div className="physician-clinical">
          <div>
            <h3>Presenting complaints</h3>
            <p>{value(d.complaints)}</p>
          </div>
          <div>
            <h3>Symptoms</h3>
            <p>{value(d.symptoms)}</p>
          </div>
          <div>
            <h3>Findings</h3>
            <p>{value(d.findings)}</p>
          </div>
          <div className="physician-triage-tests">
            <h3>Triage Emergency:</h3>
            {["Urgent", "Semi Urgent", "Non Urgent"].map((item) => <div className="physician-check" key={item}><span className="physician-box">{triage === item.toLowerCase() ? "✓" : ""}</span>{item}</div>)}
            <div className="physician-test-grid">
              {physicianTestOptions.map((item) => <div className="physician-check" key={item}><span className="physician-box">{tests.selected.includes(item) ? "✓" : ""}</span>{item}</div>)}
            </div>
            {tests.other && <p>{tests.other}</p>}
          </div>
        </div>
        <div className="physician-treatment">
          <h2>Treatment advised</h2>
          <table>
            <thead>
              <tr>
                <th>Medicine<br /><span lang="ur">ادویات</span></th>
                <th>Strength<br /><span lang="ur">طاقت</span></th>
                <th>Dose Instruction<br /><span lang="ur">ہدایات خوراک</span></th>
                <th>Treatment Course<br /><span lang="ur">دورانیہ علاج</span></th>
              </tr>
            </thead>
            <tbody>
              {medicines.length ? (
                medicines.map((medicine, index) => (
                  <tr key={index}>
                    <td>
                      <strong>{medicine.name}</strong>
                    </td>
                    <td>{medicine.strength}</td>
                    <td>
                      {[medicine.dose, medicine.route, medicine.frequency, medicine.food]
                        .filter(Boolean)
                        .join(" · ")}
                    </td>
                    <td>{medicine.duration}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="no-medicine">
                    {continuationMedicineCount ? "Medicines continue on the next page" : "No medicines recorded"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="physician-advice">
            <h3>Advice / instructions</h3>
            <p>{value(d.advice)}</p>
          </div>
          <div className="physician-follow">
            <strong>Follow-up:</strong> {value(d.followUp)}
          </div>
          <div className="physician-signature">
            {account.phcRegistration && <span lang="ur" dir="rtl">پنجاب ہیلتھ کیئر کمیشن سے رجسٹرڈ شفاء خانہ</span>}
          </div>
        </div>
        <aside className="physician-side">
          <div lang="ur" dir="rtl" className="physician-side-urdu">عمومی ہدایات:</div>
          <div className="physician-side-condition">
            <strong>Present Condition:</strong>
            {["Alert", "Stable", "Unstable", "Critical"].map((item) => <div className="physician-check" key={item}><span className="physician-box">{condition === item.toLowerCase() ? "✓" : ""}</span>{item}</div>)}
          </div>
        </aside>
      </div>
      <footer className={`physician-footer${hasLocationQr(account) ? " has-location-qr" : ""}`}>
        <span>{account.phone ? `For Appointment: ${account.fixedStationery ? clinicPreset.physicianAppointmentPhone : account.phone}` : ""}</span>
        <span className="physician-footer-center">Not Valid for Court</span>
        {hasLocationQr(account) && <span lang="ur" dir="rtl">اوقات مریض: شام 4 تا 7 بجے</span>}
        <LocationQr account={account} />
      </footer>
    </article>
  );
}

function ReportSection({ title, children }) {
  return (
    <section className="report-section">
      <h3>{title}</h3>
      <div>{value(children)}</div>
    </section>
  );
}

function UltrasoundSheet({ encounter, account, firstPageOnly = false }) {
  const { patient, details: d } = encounter;
  const printAccount = { ...account, ...encounter.printDoctor };
  printAccount.doctorQualification = printAccount.doctorQualificationUltrasound || printAccount.doctorQualification;
  return (
    <article className="print-sheet ultrasound-sheet">
      <div className="ultrasound-stationery" aria-hidden="true">
        <img src={ultrasoundStationery} alt="" />
      </div>
      <header className="ultrasound-letterhead">
        <div className="ultrasound-letterhead-doctor">
          <strong>{printAccount.doctorName || "Doctor"}</strong>
          <span>{printAccount.doctorQualification}</span>
        </div>
        <div className="ultrasound-letterhead-contact">
          <span>{account.phone || "Clinic phone"}</span>
          <span><strong>{account.clinicName || "Clinic"}</strong><small>{account.address}</small></span>
          <span className="ultrasound-letterhead-registration">
            {printAccount.registration && <span>PMDC: {printAccount.registration}</span>}
            {printAccount.phcRegistration && <span>PHC Registration No. {printAccount.phcRegistration}</span>}
          </span>
        </div>
      </header>
      <DemoMark account={account} />
      <RecordMark encounter={encounter} />
      <div className="ultrasound-content">
        <h1>Ultrasound {value(d.reportType)} Report</h1>
        <div className="report-identity">
          <Line label="Patient">{patient.name}</Line>
          <Line label="Clinic ID">{patient.mrNumber}</Line>
          <Line label="Age">
            {patient.ageYears == null ? "" : `${patient.ageYears} years`}
          </Line>
          <Line label="Gender">{patient.gender}</Line>
          <Line label="Exam date">
            {d.examinationDate || dateTime(encounter.createdAt)}
          </Line>
          <Line label="Referring physician">{d.referringPhysician}</Line>
        </div>
        <ReportSection title="Clinical indication">
          {d.clinicalIndication}
        </ReportSection>
        <ReportSection title="Technique">{d.technique}</ReportSection>
        {d.transvaginalPerformed && (
          <ReportSection title="Transvaginal examination">
            Performed; patient consent recorded:{" "}
            {d.consentRecorded ? "Yes" : "No"}
          </ReportSection>
        )}
        <h2>Findings</h2>
        <ReportSection title="Urinary bladder">{d.bladder}</ReportSection>
        <ReportSection title="Uterus">
          {[
            d.uterusPosition && `Position: ${d.uterusPosition}`,
            d.uterusSize && `Size: ${d.uterusSize} cm`,
            d.myometrium,
          ]
            .filter(Boolean)
            .join(". ")}
        </ReportSection>
        {!firstPageOnly && <><ReportSection title="Endometrium">
          {[
            d.endometrialThickness && `Thickness: ${d.endometrialThickness} mm`,
            d.endometrialPattern,
          ]
            .filter(Boolean)
            .join(". ")}
        </ReportSection>
        <ReportSection title="Cervix">{d.cervix}</ReportSection>
        <ReportSection title="Right ovary">
          {[
            d.rightOvarySize && `Size: ${d.rightOvarySize} cm`,
            d.rightOvaryVolume && `Volume: ${d.rightOvaryVolume} mL`,
            d.rightOvaryFindings,
          ]
            .filter(Boolean)
            .join(". ")}
        </ReportSection>
        <ReportSection title="Left ovary">
          {[
            d.leftOvarySize && `Size: ${d.leftOvarySize} cm`,
            d.leftOvaryVolume && `Volume: ${d.leftOvaryVolume} mL`,
            d.leftOvaryFindings,
          ]
            .filter(Boolean)
            .join(". ")}
        </ReportSection>
        <ReportSection title="Adnexa">{d.adnexa}</ReportSection>
        <ReportSection title="Pouch of Douglas">
          {d.pouchOfDouglas}
        </ReportSection>
        <section className="report-impression">
          <h2>Impression</h2>
          <p>{value(d.impression)}</p>
        </section>
        <div className="report-signature">
          Doctor signature / stamp: ______________________
        </div></>}
      </div>
      <div className="ultrasound-notices" aria-label="Ultrasound report notes">
        <ul>
          <li>
            Please inform us of any typing mistake and send the report for
            correction within 7 days.
          </li>
          <li>
            Ultrasound findings should be interpreted alongside clinical
            findings and other diagnostic procedures. Further investigations
            and clinical correlation may be needed for the final diagnosis.
          </li>
          <li>
            No legal responsibility or financial liability is accepted for
            errors or omissions.
          </li>
        </ul>
      </div>
      <LocationQr account={account} className="ultrasound-location-qr" />
    </article>
  );
}

export default function PrintPreviewPage({
  caseId,
  module,
  account,
  navigate,
}) {
  const [encounter, setEncounter] = useState(null);
  const [amendments, setAmendments] = useState([]);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [printOverflow, setPrintOverflow] = useState(false);
  const [paginationReady, setPaginationReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      window.clinic.getEncounter(caseId),
      window.clinic.amendments(caseId),
      window.clinic.caseEvents(caseId),
    ])
      .then(([row, history, activity]) => {
        if (!row || row.module !== module)
          throw new Error("Saved record not found.");
        if (!cancelled) {
          setEncounter(row);
          setAmendments(history);
          setEvents(activity);
          setPrintOverflow(false);
          setPaginationReady(false);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, module]);
  useEffect(() => {
    if (!encounter) return;
    const check = () => {
      const body = document.querySelector(
        module === "ultrasound" ? ".ultrasound-content" : ".physician-body",
      );
      const sheet = document.querySelector(".print-preview-page > .print-sheet");
      const bodyBottom = body?.getBoundingClientRect().bottom ?? 0;
      const physicianContents = module === "physician" && sheet ? [
        ".physician-triage-tests",
        ".physician-treatment > :last-child",
        ".physician-side-condition",
      ].map(selector => sheet.querySelector(selector)?.getBoundingClientRect().bottom ?? 0) : [];
      if ((body && body.scrollHeight > body.clientHeight + 2) ||
          (sheet && sheet.scrollHeight > sheet.clientHeight + 2) ||
          physicianContents.some(bottom => bottom > bodyBottom + 2))
        setPrintOverflow(true);
    };
    const frame = requestAnimationFrame(check);
    const retry = setTimeout(check, 300);
    document.fonts.ready.then(check);
    window.addEventListener("resize", check);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(retry);
      window.removeEventListener("resize", check);
    };
  }, [encounter, module]);
  return (
    <div className="print-preview-page">
      <div className="print-toolbar">
        <button
          className="secondary"
          onClick={() => navigate("module", { module })}
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div>
          <strong>
            {module === "physician" ? "Prescription" : "Ultrasound report"}{" "}
            preview
          </strong>
          <span>Review the saved record before printing on A4 paper.</span>
        </div>
        <button
          className="secondary"
          onClick={() => navigate("visitForm", { module, caseId })}
        >
          <Pencil size={16} /> Edit
        </button>
        <button
          className="primary"
          disabled={!encounter || (printOverflow && !paginationReady)}
          onClick={() => window.print()}
        >
          <Printer size={16} /> Print
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      {printOverflow && <div className="admin-notice">This record is longer than one A4 page. The print preview has arranged it across multiple pages.</div>}
      {!encounter && !error && <p>Loading preview…</p>}
      {encounter &&
        (printOverflow ? <PaginatedPrint module={module} encounter={encounter} account={account}
          onReady={setPaginationReady}
          renderFirstPage={(firstEncounter, options) => module === "physician"
            ? <PhysicianSheet encounter={firstEncounter} account={account} paginated continuationMedicineCount={options.continuationMedicineCount} />
            : <UltrasoundSheet encounter={firstEncounter} account={account} firstPageOnly />} /> : module === "physician" ? (
          <PhysicianSheet encounter={encounter} account={account} />
        ) : (
          <UltrasoundSheet encounter={encounter} account={account} />
        ))}
      {amendments.length > 0 && (
        <section className="amendment-history">
          <h2>Amendment history</h2>
          <p>Earlier versions are kept with the reason for each change.</p>
          {amendments.map((entry) => {
            const keys = [
              ...new Set([
                ...Object.keys(entry.previousDetails),
                ...Object.keys(entry.newDetails),
              ]),
            ].filter(
              (key) =>
                JSON.stringify(entry.previousDetails[key]) !==
                JSON.stringify(entry.newDetails[key]),
            );
            return (
              <details key={entry.id}>
                <summary>
                  {dateTime(entry.amendedAt)} · {entry.amendedBy} ·{" "}
                  {entry.reason}
                </summary>
                {keys.map((key) => (
                  <div className="amendment-change" key={key}>
                    <strong>{key.replace(/([A-Z])/g, " $1")}</strong>
                    <span>
                      Before:{" "}
                      {value(
                        typeof entry.previousDetails[key] === "object"
                          ? JSON.stringify(entry.previousDetails[key])
                          : entry.previousDetails[key],
                      )}
                    </span>
                    <span>
                      After:{" "}
                      {value(
                        typeof entry.newDetails[key] === "object"
                          ? JSON.stringify(entry.newDetails[key])
                          : entry.newDetails[key],
                      )}
                    </span>
                  </div>
                ))}
              </details>
            );
          })}
        </section>
      )}
      {events.length > 0 && (
        <section className="case-activity">
          <h2>Record activity</h2>
          {events.map((item) => (
            <div key={item.id}>
              <strong>
                {{
                  created_draft: "Draft created",
                  created_final: "Record finalized",
                  draft_saved: "Draft saved",
                  finalized: "Record finalized",
                  amended: "Final record amended",
                }[item.eventType] || item.eventType}
              </strong>
              <span>
                {dateTime(item.occurredAt)} · {item.actor}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
