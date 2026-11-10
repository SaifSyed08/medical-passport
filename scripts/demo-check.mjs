// Plays the recorded demo (the D key) in headless Chrome, checks it reaches the end, and screenshots key moments.
//   npm run dev   then   node scripts/demo-check.mjs [sofia|jordan]
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const persona = process.argv[2] || "sofia";
const BASE = process.env.BASE || "http://localhost:5173";
const OUT = path.resolve(".cache/demo-shots");
fs.mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => fs.existsSync(p));
const data = JSON.parse(fs.readFileSync(`public/demo/${persona}.json`, "utf8"));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--window-size=430,900"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(BASE, { waitUntil: "networkidle0" });
await page.evaluate((p) => {
  localStorage.clear();
  localStorage.setItem("ti.settings.v1", JSON.stringify({ personaId: p, mode: "auto", speak: true, pairs: {} }));
}, persona);
await page.reload({ waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: path.join(OUT, `${persona}-0-home.png`) });

const t0 = Date.now();
await page.keyboard.press("d");
let shot = 1;
const seen = new Set();
const deadline = Date.now() + 120_000;
let toastShot = false;
let captionShot = "";
for (;;) {
  const s = await page.evaluate(() => ({
    done: document.querySelectorAll(".turn.done").length,
    statuses: [...document.querySelectorAll(".turn")].map((t) => t.className),
    toast: Boolean(document.querySelector(".ctx-tile.flash")),
    label: document.querySelector(".orb-label")?.textContent || "",
    caption: document.querySelector(".turn.live .live-text")?.textContent || "",
  }));
  if (!captionShot && s.caption.length > 18) {
    captionShot = s.caption;
    await page.screenshot({ path: path.join(OUT, `${persona}-${shot++}-live-caption.png`) });
  }
  const key = `${s.done}`;
  if (!seen.has(key) && s.statuses.some((c) => c.includes("done"))) {
    seen.add(key);
    await new Promise((r) => setTimeout(r, 2600)); // let the words and the drug flip land
    await page.screenshot({ path: path.join(OUT, `${persona}-${shot++}-turn${s.done}.png`) });
  }
  if (s.toast && !toastShot) {
    toastShot = true;
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: path.join(OUT, `${persona}-${shot++}-alert.png`) });
  }
  if ((s.done >= data.lines.length && /Tap to start/.test(s.label)) || Date.now() > deadline) break;
  await new Promise((r) => setTimeout(r, 300));
}
const seconds = ((Date.now() - t0) / 1000).toFixed(1);
const final = await page.evaluate(() => ({
  history: document.querySelectorAll(".turn.done").length - 1,
  current: document.querySelector(".turn.current .translation")?.textContent,
  cards: [...document.querySelectorAll(".ctx-tile")].map((c) => c.className.replace("ctx-tile ", "")),
  label: document.querySelector(".orb-label")?.textContent,
}));
await page.screenshot({ path: path.join(OUT, `${persona}-${shot++}-end.png`) });
await browser.close();

const fails = [];
if (final.history + 1 !== data.lines.length) fails.push(`expected ${data.lines.length} turns, saw ${final.history + 1}`);
if (!final.cards.length) fails.push("no context cards");
if (!captionShot) fails.push("no live caption while the recording played");
if (persona === "sofia" && !toastShot) fails.push("no alert toast");
if (errors.length) fails.push(`page errors: ${errors.join(" | ")}`);
console.log(`demo ran ${seconds}s · ${final.history + 1} turns · ${final.cards.length} cards · alert toast ${toastShot} · last: ${final.current}`);
console.log(fails.length ? `FAIL: ${fails.join("; ")}` : "PASS");
console.log(`screenshots in ${OUT}`);
process.exitCode = fails.length ? 1 : 0;
