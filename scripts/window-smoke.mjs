import { mkdirSync, writeFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";

loadEnv({ quiet: true });

const port = process.env.CLINIC_SMOKE_PORT || "9223";
const targets = await (
  await fetch(`http://127.0.0.1:${port}/json/list`)
).json();
const target = targets.find(
  (item) =>
    item.type === "page" &&
    (item.title === "Clinic Desk" ||
      item.url?.endsWith("/out/renderer/index.html")),
);
if (!target) throw new Error("Clinic Desk window not found");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 1;
const pending = new Map();
mkdirSync("tmp/print-qa", { recursive: true });
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    message.error
      ? reject(new Error(message.error.message))
      : resolve(message.result);
  }
});

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await evaluate(expression)) return;
    } catch {
      /* navigation may replace the execution context */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

try {
  await waitFor(
    'Boolean(window.clinic && document.body && document.body.innerText.includes("Welcome back"))',
  );
  writeFileSync(
    "tmp/print-qa/login-theme.png",
    Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"),
  );
  await evaluate(`(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const fields = document.querySelectorAll('.auth-card form input');
    setter.call(fields[0], ${JSON.stringify(process.env.CLINIC_ADMIN_USERNAME)});
    fields[0].dispatchEvent(new Event('input', {bubbles:true}));
    setter.call(fields[1], 'wrong-password');
    fields[1].dispatchEvent(new Event('input', {bubbles:true}));
    document.querySelector('.auth-card form button.primary').click(); return true;
  })()`);
  await waitFor(
    'document.body.innerText.includes("Incorrect username or password.")',
  );
  await evaluate(`(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const fields = document.querySelectorAll('.auth-card form input');
    setter.call(fields[0], ${JSON.stringify(process.env.CLINIC_ADMIN_USERNAME)});
    fields[0].dispatchEvent(new Event('input', {bubbles:true}));
    setter.call(fields[1], ${JSON.stringify(process.env.CLINIC_ADMIN_PASSWORD)});
    fields[1].dispatchEvent(new Event('input', {bubbles:true}));
    document.querySelector('.auth-card form button.primary').click(); return true;
  })()`);
  await waitFor('document.body.innerText.includes("Clinic accounts")');
  await waitFor('document.body.innerText.includes("Export backup") && document.body.innerText.includes("Restore backup") && document.body.innerText.includes("Latest snapshot:")');
  const restoredBackup = await evaluate('window.clinic.backupStatus().then(({ path }) => window.clinic.restoreBackup(path))');
  if (!restoredBackup?.restored || !restoredBackup.safetyBackup)
    throw new Error("Admin backup restore did not create a safety copy");
  await send("Page.reload");
  await waitFor('document.body.innerText.includes("Welcome back")');
  await evaluate(`(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const fields = document.querySelectorAll('.auth-card form input');
    setter.call(fields[0], ${JSON.stringify(process.env.CLINIC_ADMIN_USERNAME)});
    fields[0].dispatchEvent(new Event('input', {bubbles:true}));
    setter.call(fields[1], ${JSON.stringify(process.env.CLINIC_ADMIN_PASSWORD)});
    fields[1].dispatchEvent(new Event('input', {bubbles:true}));
    document.querySelector('.auth-card form button.primary').click(); return true;
  })()`);
  await waitFor('document.body.innerText.includes("Clinic accounts")');
  writeFileSync("tmp/print-qa/admin-theme.png", Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  await evaluate(`(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    for (const [label, value] of [['Username','demo'],['Password','temporary-password-123']]) {
      const field = [...document.querySelectorAll('.admin-form-panel .field')].find(item => item.querySelector('span')?.textContent === label);
      const input = field.querySelector('input, textarea');
      const inputSetter = Object.getOwnPropertyDescriptor(input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set;
      inputSetter.call(input, value);
      input.dispatchEvent(new Event('input', {bubbles:true}));
    }
    document.querySelector('.admin-form-panel form button.primary').click(); return true;
  })()`);
  await waitFor('document.body.innerText.includes("Clinic account created")');
  await evaluate('document.querySelector(".admin-topbar button").click()');
  await waitFor('document.body.innerText.includes("Welcome back")');
  await evaluate(`(() => { const input = document.querySelector('input[type="password"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const username = document.querySelector('input[autocomplete="username"]');
    setter.call(username, 'demo');
    username.dispatchEvent(new Event('input', {bubbles:true}));
    setter.call(input, 'temporary-password-123');
    input.dispatchEvent(new Event('input', {bubbles:true}));
    document.querySelector('.auth-card form button.primary').click(); return true })()`);
  await waitFor('document.body.innerText.includes("Recent clinical records")');
  const dashboardText = await evaluate("document.body.innerText");
  if (
    !dashboardText.includes("Physician Patients") ||
    !dashboardText.includes("Ultrasound Patients")
  ) {
    throw new Error("Dashboard module counts not visible");
  }
  await evaluate(
    `[...document.querySelectorAll('.nav-item')].find(button => button.innerText.trim() === 'Settings').click()`,
  );
  await waitFor('document.body.innerText.includes("Doctor profile")');
  if (!(await evaluate('document.body.innerText.includes("Recent clinical records")')))
    throw new Error("Opening Settings changed the current page");
  await evaluate(`[...document.querySelectorAll('.settings-subitem')].find(button => button.innerText.trim() === 'Doctor profile').click()`);
  await waitFor(
    'document.body.innerText.includes("Your professional details")',
  );
  writeFileSync(
    "tmp/print-qa/settings-doctor-profile.png",
    Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"),
  );
  if (
    await evaluate(
      '[...document.querySelectorAll(".clinic-profile-form .field span")].some(item => item.textContent === "Clinic name")',
    )
  )
    throw new Error("Clinic branding is editable from the doctor profile");
  if (await evaluate('Boolean(document.querySelector(".clinic-profile-form .form-actions button"))'))
    throw new Error("Fixed main doctor profile is editable");
  if (
    !(await evaluate(
      'window.clinic.bootstrap().then(result => result.account.fixedStationery && result.account.clinicName === "Tahira Memorial Clinic" && result.account.phcRegistration === "R-694949")',
    ))
  )
    throw new Error("Admin-managed clinic print details did not persist");
  await evaluate(`[...document.querySelectorAll('.settings-subitem')].find(button => button.innerText.trim() === 'Backup').click()`);
  await waitFor('document.querySelector(".backup-settings-page") && document.body.innerText.includes("Automatic backup folder")');
  await waitFor('document.body.innerText.includes("Latest backup") && document.body.innerText.includes("Local folder")');
  await evaluate(`[...document.querySelectorAll('.backup-settings-actions button')].find(button => button.innerText.includes('Back up now')).click()`);
  await waitFor('document.body.innerText.includes("Backup created in the configured folders.")');
  await send("Page.reload");
  await waitFor('document.querySelector(".backup-settings-page") && document.body.innerText.includes("Automatic backup folder")');
  await evaluate(
    `[...document.querySelectorAll('.nav-item')].find(button => button.innerText.includes('Dashboard')).click()`,
  );
  await waitFor('document.body.innerText.includes("Recent clinical records")');
  const capture = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync("smoke-dashboard.png", Buffer.from(capture.data, "base64"));

  const before = await evaluate("window.clinic.summary()");
  await evaluate(
    `[...document.querySelectorAll('.nav-item')].find(button => button.innerText.includes('Template Library')).click()`,
  );
  await waitFor('document.body.innerText.includes("Saved plans")');
  await evaluate(
    `[...document.querySelectorAll('.library-tabs button')].find(button => button.innerText.includes('Medicines')).click()`,
  );
  await waitFor('document.body.innerText.includes("Saved medicines")');
  await evaluate(`(() => {
    const set = (label, value) => {
      const field = [...document.querySelectorAll('.library-field')].find(item => item.querySelector('span')?.textContent === label);
      const input = field.querySelector('input,textarea');
      Object.getOwnPropertyDescriptor(input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', {bubbles:true}));
    };
    [['Template name','Smoke medicine'],['Medicine name','Medicine from template'],['Strength','10 mg'],['Dose / quantity','1 tablet'],['Route','Oral'],['Frequency / timing','Twice daily'],['Before / after food','After food'],['Duration','5 days']].forEach(([label,value]) => set(label,value));
    return true;
  })()`);
  await evaluate('document.querySelector(".library-actions .primary").click()');
  await waitFor(
    'document.body.innerText.includes("Template saved: Smoke medicine")',
  );
  await evaluate(
    `[...document.querySelectorAll('.library-tabs button')].find(button => button.innerText.includes('Physician plans')).click()`,
  );
  await waitFor('document.body.innerText.includes("Saved plans")');
  await evaluate(`(() => {
    const set = (label, value) => {
      const field = [...document.querySelectorAll('.library-field')].find(item => item.querySelector('span')?.textContent === label);
      const input = field.querySelector('input,textarea');
      Object.getOwnPropertyDescriptor(input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', {bubbles:true}));
    };
    [['Template name','Smoke plan'],['Diagnosis','Review diagnosis'],['Tests','CBC'],['Advice','Review advice'],['Follow-up interval','1 week']].forEach(([label,value]) => set(label,value));
    const select = document.querySelector('.library-add-medicine select');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,select.options[1].value);
    select.dispatchEvent(new Event('change',{bubbles:true})); return true;
  })()`);
  await waitFor(
    '!document.querySelector(".library-add-medicine .secondary").disabled',
  );
  await evaluate(
    'document.querySelector(".library-add-medicine .secondary").click()',
  );
  await waitFor(
    'Boolean([...document.querySelectorAll(".library-medicine input")].find(input => input.value === "Medicine from template"))',
  );
  await evaluate('document.querySelector(".library-actions .primary").click()');
  await waitFor(
    'document.body.innerText.includes("Template saved: Smoke plan")',
  );
  const libraryCapture = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(
    "tmp/print-qa/template-library.png",
    Buffer.from(libraryCapture.data, "base64"),
  );
  await evaluate(
    `[...document.querySelectorAll('.library-tabs button')].find(button => button.innerText.includes('Ultrasound reports')).click()`,
  );
  await waitFor('document.body.innerText.includes("Saved reports")');
  await evaluate(
    `[...document.querySelectorAll('.library-editor-head button')].find(button => button.innerText.includes('Female Pelvis')).click()`,
  );
  await evaluate(`(() => { const input = [...document.querySelectorAll('.library-field')].find(item => item.querySelector('span')?.textContent === 'Template name').querySelector('input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Demo Pelvis');
    input.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
  await evaluate('document.querySelector(".library-actions .primary").click()');
  await waitFor(
    'document.body.innerText.includes("Template saved: Demo Pelvis")',
  );
  await evaluate(
    `[...document.querySelectorAll('.nav-item')].find(button => button.innerText.includes('Dashboard')).click()`,
  );
  await waitFor('document.body.innerText.includes("Recent clinical records")');
  await evaluate(`[...document.querySelectorAll('.nav-item')].find(button => button.innerText.trim() === 'Physician').click()`);
  await waitFor(
    'document.body.innerText.includes("Patient and visit in one form")',
  );
  writeFileSync(
    "tmp/print-qa/physician-workspace-theme.png",
    Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"),
  );
  await evaluate("document.querySelector('.module-actions .primary').click()");
  await waitFor(
    'document.body.innerText.includes("New Physician visit") && document.querySelectorAll(".template-row select option").length > 3',
  );
  writeFileSync("tmp/print-qa/physician-form-theme.png", Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  await evaluate(`(() => {
    const selects = document.querySelectorAll('.template-row select');
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(selects[0], selects[0].options[1].value); selects[0].dispatchEvent(new Event('change',{bubbles:true}));
    document.querySelector('.template-row .secondary').click(); return true;
  })()`);
  await waitFor(
    'Boolean([...document.querySelectorAll(".encounter-form input")].find(input => input.value === "Medicine from template"))',
  );
  await evaluate(`(() => {
    const row = document.querySelectorAll('.template-row')[1];
    const select = row.querySelector('select');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select, select.options[1].value);
    select.dispatchEvent(new Event('change',{bubbles:true})); return true;
  })()`);
  await evaluate(
    'document.querySelectorAll(".template-row")[1].querySelector("button").click()',
  );
  await waitFor(
    'Boolean([...document.querySelectorAll(".encounter-form textarea")].find(input => input.value === "Review diagnosis"))',
  );
  await evaluate(`(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const input = [...document.querySelectorAll('.encounter-form label')].find(label => label.innerText.includes('Patient name')).querySelector('input');
    setter.call(input, 'Demo Patient');
    input.dispatchEvent(new Event('input', {bubbles:true}));
    const complaints = [...document.querySelectorAll('.encounter-form label')].find(label => label.innerText.includes('Presenting complaints')).querySelector('textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(complaints, 'Test complaint');
    complaints.dispatchEvent(new Event('input', {bubbles:true}));
    document.querySelector('.encounter-form .form-actions button.primary').click(); return true })()`);
  await waitFor(
    'document.body.innerText.includes("Recent visits") && document.body.innerText.includes("Demo Patient")',
  );
  await evaluate('document.querySelector(".case-entry .case-print").click()');
  await waitFor(
    'document.body.innerText.includes("Prescription preview") && document.body.innerText.includes("Medicine from template")',
  );
  if (
    !(await evaluate(
      'document.querySelector(".print-sheet").getBoundingClientRect().width > 700',
    ))
  )
    throw new Error("Physician A4 preview missing");
  if (!(await evaluate('document.querySelector(".physician-footer .location-qr").getBoundingClientRect().bottom <= document.querySelector(".physician-sheet").getBoundingClientRect().bottom - 2')))
    throw new Error("Physician location QR extends beyond the A4 sheet");
  if (await evaluate('document.querySelector(".physician-body").scrollHeight > document.querySelector(".physician-body").clientHeight + 2'))
    throw new Error("Physician content overlaps the footer");
  if (
    !(await evaluate(
      'document.querySelector(".physician-phc-center")?.innerText.includes("R-694949") && document.querySelector(".physician-doctor-english")?.innerText.includes("Dr. Saadia Qureshi")',
    ))
  )
    throw new Error(
      "Physician print header is missing clinic-entered PHC details",
    );
  await send("Emulation.setEmulatedMedia", { media: "print" });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 800,
    height: 1200,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const physicianCapture = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  writeFileSync(
    "tmp/print-qa/physician.png",
    Buffer.from(physicianCapture.data, "base64"),
  );
  await send("Emulation.setEmulatedMedia", { media: "screen" });
  await send("Emulation.clearDeviceMetricsOverride");
  await evaluate('document.querySelector(".print-toolbar button").click()');
  const patient = await evaluate(
    'window.clinic.patients("Demo Patient", "").then(rows => rows[0])',
  );
  const physicianDetails = await evaluate(
    'window.clinic.cases("physician").then(rows => window.clinic.getEncounter(rows[0].id)).then(row => row.details)',
  );
  if (physicianDetails.complaints !== "Test complaint")
    throw new Error("Physician details did not persist");
  await evaluate(
    'document.querySelector(".case-entry > button:first-child").click()',
  );
  await waitFor('document.body.innerText.includes("Edit Physician visit")');
  await evaluate(`(() => {
    const diagnosis = [...document.querySelectorAll('.encounter-form label')].find(label => label.innerText.includes('Provisional diagnosis')).querySelector('textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(diagnosis, 'Reviewed diagnosis');
    diagnosis.dispatchEvent(new Event('input', {bubbles:true}));
    document.querySelector('.review-confirmation input').click();
    return true;
  })()`);
  await waitFor('!document.querySelector(".finalize-button").disabled');
  await evaluate('document.querySelector(".finalize-button").click()');
  await waitFor(
    'document.body.innerText.includes("Prescription preview") && Boolean(document.querySelector(".print-toolbar button.primary:not(:disabled)"))',
  );
  if (!(await evaluate('document.body.innerText.includes("Finalized by")')))
    throw new Error("Physician finalization did not open the final print preview");
  await evaluate('document.querySelector(".print-toolbar button").click()');
  await waitFor('document.body.innerText.includes("Recent visits") && document.body.innerText.includes("Final")');
  await evaluate(
    'document.querySelector(".case-entry > button:first-child").click()',
  );
  await waitFor('document.body.innerText.includes("Amending a final record")');
  await evaluate(`(() => {
    const diagnosis = [...document.querySelectorAll('.encounter-form label')].find(label => label.innerText.includes('Provisional diagnosis')).querySelector('textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(diagnosis, 'Corrected diagnosis');
    diagnosis.dispatchEvent(new Event('input', {bubbles:true}));
    const reason = document.querySelector('.record-workflow input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(reason, 'Correction after review');
    reason.dispatchEvent(new Event('input', {bubbles:true}));
    return true;
  })()`);
  await evaluate(
    'document.querySelector(".encounter-form .form-actions button.primary").click()',
  );
  await waitFor(
    'document.body.innerText.includes("Recent visits") && document.body.innerText.includes("amended 1")',
  );
  await evaluate('document.querySelector(".case-entry .case-print").click()');
  await waitFor(
    'document.body.innerText.includes("Amendment history") && document.body.innerText.includes("Corrected diagnosis") && document.body.innerText.includes("Record activity")',
  );
  await evaluate('document.querySelector(".print-toolbar button").click()');
  await evaluate(
    `[...document.querySelectorAll('.nav-item')].find(button => button.innerText.includes('Ultrasound')).click()`,
  );
  await waitFor(
    'document.body.innerText.includes("Patient and report in one form")',
  );
  await evaluate("document.querySelector('.module-actions .primary').click()");
  await waitFor('document.body.innerText.includes("New Ultrasound report")');
  writeFileSync("tmp/print-qa/ultrasound-form-theme.png", Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  await evaluate(`(() => {
    const select = document.querySelector('.template-row select');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, select.options[2].value);
    select.dispatchEvent(new Event('change',{bubbles:true}));
    document.querySelector('.template-row .secondary').click(); return true;
  })()`);
  await waitFor(
    'Boolean([...document.querySelectorAll("textarea")].find(input => input.value.includes("No significant sonographic abnormality")))',
  );
  await evaluate(`(() => {
    const input = [...document.querySelectorAll('.encounter-form label')].find(label => label.innerText.includes('Search existing patient')).querySelector('input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Demo Patient');
    input.dispatchEvent(new Event('input', {bubbles:true})); return true;
  })()`);
  await waitFor('Boolean(document.querySelector(".patient-matches button"))');
  await evaluate('document.querySelector(".patient-matches button").click()');
  await waitFor(
    'document.body.innerText.includes("Existing patient record selected")',
  );
  await evaluate(`(() => {
    const impression = [...document.querySelectorAll('.encounter-form label')].find(label => label.innerText === 'Impression').querySelector('textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(impression, 'Test impression');
    impression.dispatchEvent(new Event('input', {bubbles:true}));
    document.querySelector('.encounter-form .form-actions button.primary').click(); return true;
  })()`);
  await waitFor(
    'document.body.innerText.includes("Recent examinations") && document.body.innerText.includes("Demo Patient")',
  );
  await evaluate('document.querySelector(".case-entry .case-print").click()');
  await waitFor(
    'document.body.innerText.includes("Ultrasound report preview") && document.body.innerText.includes("Test impression")',
  );
  if (
    !(await evaluate(
      'document.querySelector(".print-sheet").getBoundingClientRect().width > 700',
    ))
  )
    throw new Error("Ultrasound A4 preview missing");
  if (!(await evaluate('document.querySelector(".ultrasound-location-qr").getBoundingClientRect().bottom <= document.querySelector(".ultrasound-sheet").getBoundingClientRect().bottom - 2')))
    throw new Error("Ultrasound location QR extends beyond the A4 sheet");
  await waitFor('document.querySelector(".ultrasound-stationery img")?.naturalWidth > 0');
  if (await evaluate('document.querySelector(".ultrasound-content").scrollHeight > document.querySelector(".ultrasound-content").clientHeight + 2'))
    throw new Error("Standard ultrasound report overflows the reference stationery");
  if (
    !(await evaluate(
      'document.querySelector(".ultrasound-letterhead-contact")?.innerText.includes("R-694949") && document.querySelector(".ultrasound-letterhead-doctor")?.innerText.includes("Dr. Saadia Qureshi")',
    ))
  )
    throw new Error(
      "Ultrasound print header is missing clinic-entered PHC details",
    );
  await send("Emulation.setEmulatedMedia", { media: "print" });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 800,
    height: 1200,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const ultrasoundCapture = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  writeFileSync(
    "tmp/print-qa/ultrasound.png",
    Buffer.from(ultrasoundCapture.data, "base64"),
  );
  await send("Emulation.setEmulatedMedia", { media: "screen" });
  await send("Emulation.clearDeviceMetricsOverride");
  await evaluate('[...document.querySelectorAll(".print-toolbar button")].find(button => button.innerText.includes("Edit")).click()');
  await waitFor('document.body.innerText.includes("Edit Ultrasound report")');
  await evaluate('document.querySelector(".review-confirmation input").click()');
  await waitFor('!document.querySelector(".finalize-button").disabled');
  await evaluate('document.querySelector(".finalize-button").click()');
  await waitFor('document.body.innerText.includes("Ultrasound report preview") && Boolean(document.querySelector(".print-toolbar button.primary:not(:disabled)"))');
  if (!(await evaluate('document.body.innerText.includes("Finalized by")')))
    throw new Error("Ultrasound finalization did not open the final print preview");
  const summary = await evaluate("window.clinic.summary()");
  if (
    summary.totalPatients !== before.totalPatients + 1 ||
    summary.physicianPatients !== before.physicianPatients + 1 ||
    summary.ultrasoundPatients !== before.ultrasoundPatients + 1
  ) {
    throw new Error(`Unexpected dashboard counts: ${JSON.stringify(summary)}`);
  }
  const ultrasoundDetails = await evaluate(
    'window.clinic.cases("ultrasound").then(rows => window.clinic.getEncounter(rows[0].id)).then(row => row.details)',
  );
  if (ultrasoundDetails.impression !== "Test impression")
    throw new Error("Ultrasound details did not persist");
  await evaluate(
    `[...document.querySelectorAll('.nav-item')].find(button => button.innerText.trim() === 'Settings').click()`,
  );
  await waitFor('Boolean(document.querySelector(".settings-subitem"))');
  await evaluate(`[...document.querySelectorAll('.settings-subitem')].find(button => button.innerText.trim() === 'Doctor profile').click()`);
  await waitFor(
    'document.body.innerText.includes("Your professional details")',
  );
  await evaluate(
    `[...document.querySelectorAll('.settings-subitem')].find(button => button.innerText.trim() === 'Doctor accounts').click()`,
  );
  await waitFor('document.body.innerText.includes("Doctor logins")');
  await send("Page.reload", { ignoreCache: true });
  await waitFor('document.body.innerText.includes("Doctor logins")');
  if (!(await evaluate('document.querySelector(".nav-item[aria-expanded]")?.getAttribute("aria-expanded") === "true"')))
    throw new Error("Settings dropdown did not reopen on the restored page");
  writeFileSync(
    "tmp/print-qa/settings-doctor-accounts.png",
    Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"),
  );
  await evaluate(`(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    for (const [label, value] of [['Doctor name','Dr New'],['Physician qualifications and experience','MBBS'],['Doctor professional registration number','PMDC-SECOND'],['Printed PHC registration number (optional)','PHC-SECOND'],['New doctor username','second-doctor'],['Temporary password','second-password-123']]) {
      const field = [...document.querySelectorAll('.doctor-logins-panel .field')].find(item => item.querySelector('span')?.textContent === label);
      const input = field.querySelector('input, textarea');
      Object.getOwnPropertyDescriptor(input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', {bubbles:true}));
    }
    document.querySelector('.clinic-doctors-panel form button.primary').click();
    return true;
  })()`);
  await waitFor(
    'document.body.innerText.includes("Doctor login created: second-doctor")',
  );
  if (
    await evaluate(
      'Boolean(document.querySelector(".doctor-logins-panel form"))',
    )
  )
    throw new Error("A third doctor login can still be created");
  const thirdDoctorError = await evaluate(
    'window.clinic.createDoctor({doctorName:"Dr Third",username:"third-doctor",password:"third-password-123"}).then(() => "accepted", error => error.message)',
  );
  if (!thirdDoctorError.includes("one extra doctor login"))
    throw new Error(
      `Backend did not enforce two-doctor limit: ${thirdDoctorError}`,
    );
  await evaluate('document.querySelector(".profile button").click()');
  await waitFor('document.body.innerText.includes("Welcome back")');
  await evaluate(`(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const username = document.querySelector('input[autocomplete="username"]');
    const password = document.querySelector('input[type="password"]');
    setter.call(username, 'second-doctor');
    username.dispatchEvent(new Event('input', {bubbles:true}));
    setter.call(password, 'second-password-123');
    password.dispatchEvent(new Event('input', {bubbles:true}));
    document.querySelector('.auth-card form button.primary').click();
    return true;
  })()`);
  await waitFor('document.body.innerText.includes("Recent clinical records")');
  const shared = await evaluate(
    'Promise.all([window.clinic.templates(), window.clinic.patients("Demo Patient", "")]).then(([templates, patients]) => ({templates: templates.length, patients: patients.length}))',
  );
  if (shared.templates < 3 || shared.patients !== 1)
    throw new Error(
      `Second doctor cannot see shared clinic records: ${JSON.stringify(shared)}`,
    );
  await evaluate(
    `[...document.querySelectorAll('.nav-item')].find(button => button.innerText.trim() === 'Settings').click()`,
  );
  await waitFor('Boolean(document.querySelector(".settings-subitem"))');
  await evaluate(`[...document.querySelectorAll('.settings-subitem')].find(button => button.innerText.trim() === 'Doctor profile').click()`);
  await waitFor(
    'document.body.innerText.includes("Your professional details")',
  );
  if (
    await evaluate(
      '[...document.querySelectorAll(".settings-subitem")].some(button => button.innerText.trim() === "Doctor accounts")',
    )
  )
    throw new Error("Second doctor can manage owner-only logins");
  const doctorListError = await evaluate(
    'window.clinic.doctors().then(() => "accepted", error => error.message)',
  );
  if (!doctorListError.includes("Only the clinic owner"))
    throw new Error(
      `Second doctor could list doctor accounts: ${doctorListError}`,
    );
  if (
    await evaluate(
      '[...document.querySelectorAll(".clinic-profile-form .field span")].some(item => item.textContent === "Clinic name")',
    )
  )
    throw new Error("Second doctor can edit clinic branding");
  await evaluate(`(() => {
    const field = [...document.querySelectorAll('.clinic-profile-form .field')].find(item => item.querySelector('span')?.textContent === 'Doctor name');
    const input = field.querySelector('input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Dr Second');
    input.dispatchEvent(new Event('input', {bubbles:true}));
    document.querySelector('.clinic-profile-form .form-actions button').click();
    return true;
  })()`);
  await waitFor(
    'document.body.innerText.includes("Doctor profile saved. New print previews")',
  );
  await evaluate(
    `[...document.querySelectorAll('.settings-subitem')].find(button => button.innerText.trim() === 'Change password').click()`,
  );
  await waitFor('document.body.innerText.includes("Login security")');
  writeFileSync(
    "tmp/print-qa/settings-change-password.png",
    Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"),
  );
  const secondVisit = await evaluate(
    `window.clinic.saveEncounter({module:"physician",patientId:${patient.id},details:{diagnosis:"Second doctor print test"},finalize:true,reviewConfirmed:true})`,
  );
  if (secondVisit.printDoctor?.doctorName !== "Dr Second")
    throw new Error("Second doctor identity was not saved with the record");
  await evaluate(
    `[...document.querySelectorAll('.nav-item')].find(button => button.innerText.trim() === 'Physician').click()`,
  );
  await waitFor('document.body.innerText.includes("Recent visits")');
  await evaluate('document.querySelector(".case-entry .case-print").click()');
  await waitFor(
    'document.querySelector(".physician-doctor-english strong")?.innerText === "Dr Second"',
  );
  await send("Page.reload", { ignoreCache: true });
  await waitFor('document.querySelector(".physician-doctor-english strong")?.innerText === "Dr Second"');
  if (
    !(await evaluate(
      'window.clinic.bootstrap().then(result => result.account?.username === "second-doctor")',
    ))
  )
    throw new Error("Second doctor session was not restored after refresh");
  await evaluate('document.querySelector(".profile button").click()');
  await waitFor('document.body.innerText.includes("Welcome back")');
  await send("Page.reload", { ignoreCache: true });
  await waitFor('document.body.innerText.includes("Welcome back")');
  await evaluate(`(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const username = document.querySelector('input[autocomplete="username"]');
    const password = document.querySelector('input[autocomplete="current-password"]');
    setter.call(username, 'demo'); username.dispatchEvent(new Event('input', {bubbles:true}));
    setter.call(password, 'temporary-password-123'); password.dispatchEvent(new Event('input', {bubbles:true}));
    document.querySelector('.auth-card form button.primary').click(); return true;
  })()`);
  await waitFor('document.body.innerText.includes("Recent clinical records")');
  await evaluate(`[...document.querySelectorAll('.nav-item')].find(button => button.innerText.trim() === 'Settings').click()`);
  await waitFor('Boolean(document.querySelector(".settings-subitem"))');
  await evaluate(`[...document.querySelectorAll('.settings-subitem')].find(button => button.innerText.trim() === 'Doctor profile').click()`);
  await waitFor('document.body.innerText.includes("Your professional details")');
  await evaluate(`[...document.querySelectorAll('.settings-subitem')].find(button => button.innerText.trim() === 'Doctor accounts').click()`);
  await waitFor('document.body.innerText.includes("Release slot")');
  writeFileSync("tmp/print-qa/doctor-accounts-full.png", Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  await evaluate(`[...document.querySelectorAll('.doctor-release-button')][0].click()`);
  await waitFor('document.body.innerText.includes("Disable this doctor login?")');
  await evaluate('document.querySelector(".doctor-release-confirm .danger-button").click()');
  await waitFor('document.body.innerText.includes("Additional doctor login disabled")');
  if (await evaluate('window.clinic.doctors().then(rows => rows.length)') !== 1)
    throw new Error("Doctor slot was not released");
  await evaluate(`(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    for (const [label, value] of [['Doctor name','Dr Replacement'],['New doctor username','replacement-doctor'],['Temporary password','replacement-password']]) {
      const field = [...document.querySelectorAll('.doctor-logins-panel .field')].find(item => item.querySelector('span')?.textContent === label);
      const input = field.querySelector('input'); setter.call(input, value); input.dispatchEvent(new Event('input', {bubbles:true}));
    }
    document.querySelector('.doctor-logins-panel form .form-actions button').click(); return true;
  })()`);
  await waitFor('document.body.innerText.includes("Doctor login created: replacement-doctor")');
  if (await evaluate('window.clinic.doctors().then(rows => rows.length)') !== 2)
    throw new Error("Replacement doctor was not created");
  writeFileSync("tmp/print-qa/doctor-accounts-replaced.png", Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  await evaluate(`[...document.querySelectorAll('.settings-subitem')].find(button => button.innerText.trim() === 'Backup').click()`);
  await waitFor('document.querySelector(".backup-upload-panel") && document.body.innerText.includes("Select backup file")');
  const blocked = await evaluate(`window.clinic.backupSettings().then(({path}) => window.clinic.restoreBackupFromSettings({path,adminUsername:${JSON.stringify(process.env.CLINIC_ADMIN_USERNAME)},adminPassword:'incorrect'})).then(() => false, error => error.message.includes('Incorrect admin username or password'))`);
  if (!blocked) throw new Error("Settings restore accepted the wrong admin password");
  const restoredFromSettings = await evaluate(`window.clinic.backupSettings().then(({path}) => window.clinic.restoreBackupFromSettings({path,adminUsername:${JSON.stringify(process.env.CLINIC_ADMIN_USERNAME)},adminPassword:${JSON.stringify(process.env.CLINIC_ADMIN_PASSWORD)}}))`);
  if (!restoredFromSettings?.restored || !restoredFromSettings.safetyBackup)
    throw new Error("Settings restore did not preserve a safety backup");
  await send("Page.reload");
  await waitFor('document.body.innerText.includes("Welcome back")');
  process.stdout.write(
    `UI smoke passed. Patient ${patient.mrNumber}; counts ${JSON.stringify(summary)}\n`,
  );
  socket.send(JSON.stringify({
    id: nextId++,
    method: "Runtime.evaluate",
    params: { expression: "window.close()" },
  }));
} finally {
  socket.close();
}
