import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const projectDir = resolve(import.meta.dirname, "..");
const port = process.env.CLINIC_PRINT_PORT || "9240";
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const targets = await (
  await fetch(`http://127.0.0.1:${port}/json/list`)
).json();
const target = targets.find(
  (item) => item.type === "page" && item.title === "Clinic Desk",
);
if (!target) throw new Error("Clinic Desk window not found.");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let nextId = 1;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const request = pending.get(message.id);
  if (!request) return;
  clearTimeout(request.timer);
  pending.delete(message.id);
  message.error
    ? request.reject(new Error(message.error.message))
    : request.resolve(message.result);
});
function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out`));
    }, 15000);
    pending.set(id, { resolve, reject, timer });
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
async function waitFor(expression) {
  for (let tries = 0; tries < 100; tries++) {
    try {
      if (await evaluate(expression)) return;
    } catch {
      // Navigation can replace the execution context while loading.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

try {
  await waitFor("Boolean(window.clinic)");
  const outputDir = join(projectDir, "output", "pdf");
  const tempDir = join(projectDir, "tmp", "print-qa");
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(tempDir, { recursive: true });
  const cssFile = readdirSync(
    join(projectDir, "out", "renderer", "assets"),
  ).find((name) => name.endsWith(".css"));
  const css = readFileSync(
    join(projectDir, "out", "renderer", "assets", cssFile),
    "utf8",
  );
  for (const [username, password, doctorName, registration, module, slug] of [
    [
      "demo",
      process.env.CLINIC_DEMO_PASSWORD,
      "Dr Demo",
      "DEMO-REG-01",
      "Physician",
      "demo-physician-prescription",
    ],
    [
      "demo",
      process.env.CLINIC_DEMO_PASSWORD,
      "Dr Demo",
      "DEMO-REG-01",
      "Ultrasound",
      "demo-ultrasound-report",
    ],
    [
      "demo-doctor2",
      process.env.CLINIC_SECOND_DOCTOR_PASSWORD,
      "Dr Demo 2",
      "DEMO-REG-02",
      "Physician",
      "demo-doctor2-physician-prescription",
    ],
    [
      "demo-doctor2",
      process.env.CLINIC_SECOND_DOCTOR_PASSWORD,
      "Dr Demo 2",
      "DEMO-REG-02",
      "Ultrasound",
      "demo-doctor2-ultrasound-report",
    ],
  ]) {
    if (!password) throw new Error(`Set a QA password for ${username}.`);
    const current = await evaluate("window.clinic.bootstrap()");
    if (current.account?.username !== username) {
      if (current.account) await evaluate("window.clinic.logout()");
      await evaluate(
        `window.clinic.login(${JSON.stringify(username)}, ${JSON.stringify(password)})`,
      );
      await send("Page.reload", { ignoreCache: true });
      await waitFor('Boolean(document.querySelector(".nav-item"))');
    }
    await evaluate(
      `[...document.querySelectorAll(".nav-item")].find(button => button.textContent.trim() === ${JSON.stringify(module)}).click()`,
    );
    await waitFor(
      `document.body.innerText.includes(${JSON.stringify(module === "Physician" ? "Recent visits" : "Recent examinations")})`,
    );
    const caseIndex = await evaluate(
      `window.clinic.cases(${JSON.stringify(module.toLowerCase())}).then(cases => cases.findIndex(item => item.doctorName === ${JSON.stringify(doctorName)} && item.status === "final"))`,
    );
    if (caseIndex < 0)
      throw new Error(`No final ${module} record for ${doctorName}.`);
    await evaluate(
      `document.querySelectorAll(".case-entry")[${caseIndex}].querySelector(".case-print").click()`,
    );
    await waitFor('Boolean(document.querySelector(".print-sheet"))');
    const printedDoctor = await evaluate(
      '({name:document.querySelector(".print-doctor strong, .ultrasound-letterhead-doctor strong")?.textContent, details:document.querySelector(".print-doctor-details, .ultrasound-letterhead-doctor")?.textContent})',
    );
    if (
      printedDoctor.name !== doctorName ||
      !printedDoctor.details.includes(registration)
    ) {
      throw new Error(
        `Wrong print identity for ${username}: ${JSON.stringify(printedDoctor)}`,
      );
    }
    if (module === "Ultrasound") {
      const notices = await evaluate(
        '[...document.querySelectorAll(".ultrasound-notices li")].map(item => item.textContent.trim())',
      );
      if (
        notices.length !== 3 ||
        !notices[0].includes("within 7 days") ||
        !notices[1].includes("clinical correlation") ||
        !notices[2].includes("errors or omissions")
      ) {
        throw new Error(`Ultrasound print notes are missing: ${notices}`);
      }
    }
    const sheet = await evaluate(
      'document.querySelector(".print-sheet").outerHTML',
    );
    const htmlPath = join(tempDir, `${slug}.html`);
    const pdfPath = join(outputDir, `${slug}.pdf`);
    writeFileSync(
      htmlPath,
      `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root"><div class="app-shell"><main class="main"><div class="content"><div class="print-preview-page">${sheet}</div></div></main></div></div></body></html>`,
    );
    const result = spawnSync(
      chrome,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-pdf-header-footer",
        `--user-data-dir=${join(tempDir, `chrome-${module.toLowerCase()}`)}`,
        `--print-to-pdf=${pdfPath}`,
        pathToFileURL(htmlPath).href,
      ],
      { timeout: 30000, encoding: "utf8" },
    );
    if (result.status !== 0)
      throw new Error(`Chrome PDF export failed: ${result.stderr}`);
    console.log(pdfPath);
  }
} finally {
  socket.close();
}
