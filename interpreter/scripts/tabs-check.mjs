// The four parts, headless: health card, documents, medicine converter, interpreter. Needs a running server.
//   node scripts/tabs-check.mjs [--tandem]
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE || "http://localhost:5173";
const brand = process.argv.includes("--tandem") ? "tandem" : "parity";
const OUT = path.resolve(".cache/tabs");
fs.mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => fs.existsSync(p));

let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${what}`);
  if (!ok) failed++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--disable-audio-output"] });
const errors = [];
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.goto(BASE, { waitUntil: "networkidle0" });
  // An old phone still remembers the look as "tessera": it must come up as Parity.
  await page.evaluate((brand) => {
    localStorage.clear();
    localStorage.setItem("ti.settings.v1", JSON.stringify({ personaId: "sofia", mode: "auto", speak: true, pairs: {}, brand: brand === "tandem" ? "tandem" : "tessera", layout: "classic" }));
  }, brand);
  await page.reload({ waitUntil: "networkidle0" });
  const text = () => page.evaluate(() => document.body.innerText);

  check((await page.$$(".tabbar button")).length === 4, "four tabs");
  if (brand === "parity") check((await page.title()) === "Parity" && /Parity/.test(await text()), "the original look is called Parity");
  check(await page.$(".tabbar [data-tab=card].on"), "opens on the health card");
  const card = await text();
  check(/Penicilina|Penicillin/.test(card) && /Sofía Hernández/.test(card), "card: name and allergy");
  check(/albuterol/i.test(card), "card: her Ventolin shows its US name");
  check(!/Visits and documents/.test(card), "card: documents live in their own tab");
  await page.screenshot({ path: path.join(OUT, `${brand}-card.png`) });

  await page.click(".tabbar [data-tab=docs]");
  await sleep(500);
  check(await page.$(".add-bar"), "documents: scan or type buttons");
  check((await page.$$(".doc-row")).length > 0, "documents: her documents are listed");
  await page.click(".doc-row");
  await sleep(500);
  check(await page.$(".paper"), "documents: tapping one opens it");
  await page.keyboard.press("Escape");
  await sleep(400);
  await page.click(".add-bar .btn-outline");
  await sleep(400);
  check(await page.$("form.manual"), "documents: Type it in opens a form");
  await page.keyboard.press("Escape");
  await sleep(400);
  await page.screenshot({ path: path.join(OUT, `${brand}-docs.png`) });

  await page.click(".tabbar [data-tab=meds]");
  await sleep(500);
  await page.type("#conv-name", "Ventolin");
  await page.click(".conv-go");
  await page.waitForSelector(".conv-result, .conv-msg", { timeout: 30000 });
  const res = await page.$eval(".conv-result, .conv-msg", (e) => e.textContent);
  check(/albuterol/i.test(res), `medicines: Ventolin from Mexico is albuterol in the US (${res.replace(/\s+/g, " ").slice(0, 60)}…)`);
  check(await page.$(".conv-recent button"), "medicines: the lookup is kept as a recent one");
  check((await page.$$(".med-row")).length > 0, "medicines: her own medicines are listed");
  await page.screenshot({ path: path.join(OUT, `${brand}-meds.png`) });

  await page.click(".tabbar [data-tab=talk]");
  await sleep(500);
  check(await page.$(".btn-start"), "interpret: Start interpreting");
  await page.reload({ waitUntil: "networkidle0" });
  check(await page.$(".tabbar [data-tab=talk].on"), "the open tab is remembered");
  // D works from any tab and comes back to the same tab.
  await page.click(".tabbar [data-tab=meds]");
  await sleep(300);
  await page.keyboard.press("d");
  await page.waitForSelector(".talk-bar, .f-top", { timeout: 15000 });
  check(true, "D starts the demo from another tab");
  await page.keyboard.press("Escape");
  await sleep(300);
  await page.click(".talk-bar .icon-btn, .f-top .icon-btn");
  await page.waitForSelector(".tabbar", { timeout: 10000 });
  check(await page.$(".tabbar [data-tab=meds].on"), "Back returns to the tab it left");
  check(errors.length === 0, `no page errors ${errors.join(" | ")}`);
} finally {
  await browser.close();
}
console.log(failed ? `${failed} check(s) failed` : "all passed");
process.exit(failed ? 1 : 0);
