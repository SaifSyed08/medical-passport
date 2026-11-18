// Plays the recorded demo (the D key) in headless Chrome, checks it reaches the end, and screenshots key moments.
//   npm run dev   then   node scripts/demo-check.mjs [sofia|jordan] [--fast] [--stall]
// --stall tests the failsafe: the script's first request fails, and one voice clip and one spoken translation
// hang forever. The demo must still play every line (the stuck ones without sound).
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const persona = process.argv[2] || "sofia";
const BASE = process.env.BASE || "http://localhost:5173";
const OUT = path.resolve(".cache/demo-shots");
fs.mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => fs.existsSync(p));
const data = JSON.parse(fs.readFileSync(`public/demo/${persona}.json`, "utf8"));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--disable-audio-output", "--window-size=430,900"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(BASE, { waitUntil: "networkidle0" });
await page.evaluate((p) => {
  localStorage.clear();
  localStorage.setItem("ti.settings.v1", JSON.stringify({ tab: "talk", personaId: p, mode: "auto", speak: true, pairs: {} }));
}, persona);
await page.reload({ waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1200));
const stall = process.argv.includes("--stall");
if (stall) {
  await page.setRequestInterception(true);
  let failedJson = false;
  page.on("request", (req) => {
    const u = req.url();
    if (u.endsWith(`/demo/${persona}.json`) && !failedJson) {
      failedJson = true;
      return req.abort("connectionreset");
    }
    if (u.endsWith(`/demo/${persona}-0.wav`) || u.endsWith(`/demo/${persona}-1-tr.mp3`)) return; // never answered
    req.continue();
  });
}
await page.screenshot({ path: path.join(OUT, `${persona}-0-home.png`) });

const t0 = Date.now();
if (process.argv.includes("--fast")) await page.keyboard.press("f"); // secret fast demo
await page.keyboard.press("d");
let shot = 1;
const seen = new Set();
// Scaled to the recording: its speech, about as much again for the spoken translations, plus pauses.
const speechMs = data.lines.reduce((n, l) => n + (l.audioMs || 6000), 0);
const deadline = Date.now() + Math.max(stall ? 150_000 : 120_000, 60_000 + speechMs * 2.5);
let toastShot = false;
let captionShot = "";
let bannerSeen = false;
let flashSeen = false;
for (;;) {
  const s = await page.evaluate(() => ({
    done: document.querySelectorAll(".turn.done").length,
    statuses: [...document.querySelectorAll(".turn")].map((t) => t.className),
    toast: Boolean(document.querySelector(".ctx-tile.flash")),
    label: document.querySelector(".orb-label")?.textContent || "",
    caption: document.querySelector(".turn.live .live-text")?.textContent || "",
    banner: Boolean(document.querySelector(".toast")),
  }));
  if (s.banner) bannerSeen = true;
  if (s.toast) flashSeen = true;
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
// Expanding "All N" grows the bottom panel; the latest translation must stay fully visible above it.
let hiddenAfterAll = null;
const allBtn = await page.$$eval(".tiles-link", (bs) => bs.findIndex((b) => /^All/.test(b.textContent || "")));
if (allBtn >= 0) {
  await page.evaluate((i) => document.querySelectorAll(".tiles-link")[i].click(), allBtn);
  await new Promise((r) => setTimeout(r, 900));
  hiddenAfterAll = await page.evaluate(() => {
    const tr = document.querySelector(".turn.current .translation")?.getBoundingClientRect();
    const bottom = document.querySelector(".bottom")?.getBoundingClientRect();
    return tr && bottom ? Math.round(tr.bottom - bottom.top) : null;
  });
  await page.screenshot({ path: path.join(OUT, `${persona}-${shot++}-all-open.png`) });
}
await browser.close();

const fails = [];
if (final.history + 1 !== data.lines.length) fails.push(`expected ${data.lines.length} turns, saw ${final.history + 1}`);
if (!final.cards.length) fails.push("no context cards");
if (!captionShot) fails.push("no live caption while the recording played");
// A new alert flashes its tile in the dock; no banner covers the transcript (removed 2026-11-17).
if (!flashSeen) fails.push("no alert tile flashed (every demo raises an allergy alert)");
if (bannerSeen) fails.push("an alert banner covered the transcript");
if (hiddenAfterAll !== null && hiddenAfterAll > 2) fails.push(`after "All", the latest translation is ${hiddenAfterAll}px under the bottom panel`);
if (persona === "sofia" && !toastShot) fails.push("no alert toast");
if (errors.length) fails.push(`page errors: ${errors.join(" | ")}`);
console.log(`demo ran ${seconds}s · ${final.history + 1} turns · ${final.cards.length} cards · alert toast ${toastShot} · last: ${final.current}`);
console.log(fails.length ? `FAIL: ${fails.join("; ")}` : "PASS");
console.log(`screenshots in ${OUT}`);
process.exitCode = fails.length ? 1 : 0;
