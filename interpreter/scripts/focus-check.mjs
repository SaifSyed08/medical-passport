// The Focus layout (press L) through a recorded demo: one dot per line in the ribbon, record notes under the line
// that raised them (alerts in red, no banner over the line), and tapping a dot or scrolling goes back in time.
//   npm run dev   then   node scripts/focus-check.mjs [sofia|sita] [--tandem]
// No paid calls: the demo is a recording.
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE || "http://localhost:5173";
const CHROME = process.env.CHROME || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => fs.existsSync(p));
// Any patient with a recorded demo (public/demo/<id>.json).
const persona = process.argv.slice(2).find((a) => !a.startsWith("--") && fs.existsSync(`public/demo/${a}.json`)) || "sofia";
const brand = process.argv.includes("--tandem") ? "tandem" : "parity";
const OUT = path.resolve(".cache/focus");
fs.mkdirSync(OUT, { recursive: true });
const demo = JSON.parse(fs.readFileSync(`public/demo/${persona}.json`, "utf8"));
const lines = (demo.lines || demo).length;

let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${what}`);
  if (!ok) failed++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--disable-audio-output", "--autoplay-policy=no-user-gesture-required"] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: 400, height: 860, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument((persona, brand) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.clear();
    localStorage.setItem("ti.settings.v1", JSON.stringify({ tab: "talk", personaId: persona, mode: "auto", speak: true, pairs: {}, brand, layout: "focus" }));
  }, persona, brand);
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await page.keyboard.press("f"); // fast demo
  await page.keyboard.press("d");
  await page.waitForSelector(".f-top", { timeout: 15000 });

  let bannerOk = false; // an alert note showed under its line
  let sawBanner = false;
  let sawNotes = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    await sleep(600);
    const s = await page.evaluate(() => {
      const toast = document.querySelector(".toast")?.getBoundingClientRect();
      const line = document.querySelector(".f-line")?.getBoundingClientRect();
      return {
        toast: toast ? toast.bottom : null,
        line: line ? line.top : null,
        notes: document.querySelectorAll(".f-note").length,
        alertNotes: document.querySelectorAll(".f-note.alert").length,
        done: /Tap to start|Tap to resume/.test(document.querySelector(".orb-label")?.textContent || ""),
        dots: document.querySelectorAll(".f-dot").length,
      };
    });
    if (s.toast !== null) sawBanner = true;
    if (s.alertNotes) bannerOk = true;
    if (s.notes) sawNotes = true;
    if (s.done && s.dots >= lines) break;
  }
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, `${persona}-${brand}-end.png`) });
  const dots = await page.$$(".f-dot");
  check(dots.length === lines, `one ribbon dot per line (${dots.length}/${lines})`);
  check(sawNotes, "record notes appear under a line");
  check(bannerOk, "the allergy shows as a red note under its line");
  check(!sawBanner, "no alert banner over the line");
  check(await page.$(".f-dot.alert"), "the line that raised an alert is ringed in the ribbon");

  await dots[0].click();
  await sleep(900);
  const first = await page.$eval(".f-translation", (e) => e.textContent);
  // Spaces and brackets aside: a medicine shows as a stack ("albuterol" over "Ventolin") where the text says "albuterol (Ventolin)".
  const squash = (x) => String(x || "").replace(/[\s()（）]+/g, "");
  check(squash(first) === squash(demo.lines[0].interpret.translation), `tapping the first dot shows line 1 (${first.slice(0, 40)}…)`);
  check(await page.$(".f-live"), "a Back to now button appears");
  await page.screenshot({ path: path.join(OUT, `${persona}-${brand}-back.png`) });
  await page.click(".f-live");
  await sleep(600);
  check(!(await page.$(".f-live")), "Back to now returns to the latest line");

  // Scrolling up pages back one line, scrolling down comes forward again.
  const onIdx = () => page.evaluate(() => [...document.querySelectorAll(".f-dot")].findIndex((d) => d.classList.contains("on")));
  const before = await onIdx();
  const box = await (await page.$(".f-stage-wrap")).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel({ deltaY: -150 });
  await sleep(700);
  check((await onIdx()) === before - 1, `scrolling up shows the line before (${before} -> ${await onIdx()})`);
  await page.mouse.wheel({ deltaY: 150 });
  await sleep(700);
  check((await onIdx()) === before, "scrolling down comes back");

  await page.click(".f-chip.clinician");
  await sleep(300);
  check(await page.$(".f-chip.clinician.pinned"), "tapping a person's chip sets who talks next");
  await page.click(".f-chip.clinician");
  check(errors.length === 0, `no page errors ${errors.join(" | ")}`);
} finally {
  await browser.close();
}
console.log(failed ? `${failed} check(s) failed` : "all passed");
process.exit(failed ? 1 : 0);
