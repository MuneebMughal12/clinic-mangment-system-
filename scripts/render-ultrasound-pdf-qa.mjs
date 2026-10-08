import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const port = process.env.CLINIC_PRINT_PORT || "9225";
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((item) => item.type === "page" && item.title === "Clinic Desk");
if (!target) throw new Error("Clinic Desk print preview is not open.");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolveOpen, reject) => {
  socket.addEventListener("open", resolveOpen, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let sheet;
try {
  sheet = await new Promise((done, fail) => {
    socket.addEventListener("message", (event) => {
      const response = JSON.parse(event.data);
      if (response.id !== 1) return;
      response.exceptionDetails ? fail(new Error(response.exceptionDetails.text)) : done(response.result.result.value);
    });
    socket.send(JSON.stringify({
      id: 1, method: "Runtime.evaluate",
      params: { expression: 'document.querySelector(".ultrasound-sheet")?.outerHTML', returnByValue: true },
    }));
  });
} finally {
  socket.close();
}
if (!sheet) throw new Error("Open an ultrasound print preview first.");
const root = resolve(import.meta.dirname, "..");
const temp = join(root, "tmp", "pdfs");
mkdirSync(temp, { recursive: true });
const cssName = readdirSync(join(root, "out", "renderer", "assets")).find((name) => /^index-.*\.css$/.test(name));
const css = readFileSync(join(root, "out", "renderer", "assets", cssName), "utf8");
const htmlPath = join(temp, "ultrasound-stationery-qa.html");
const pdfPath = join(temp, "ultrasound-stationery-qa.pdf");
writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root"><div class="app-shell"><main class="main"><div class="content"><div class="print-preview-page">${sheet}</div></div></main></div></div></body></html>`);
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const result = spawnSync(chrome, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-pdf-header-footer",
  `--user-data-dir=${join(temp, "chrome-ultrasound-qa")}`,
  `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href,
], { timeout: 30000, encoding: "utf8" });
if (result.status !== 0) throw new Error(result.stderr || "Chrome PDF export failed.");
console.log(pdfPath);
