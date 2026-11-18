// Editable profile, end to end in headless Chrome: swipe a row to delete it (and undo), local names with the local
// flag on medicines, and "Add a document": a photo of a printed note is read by Tesseract on the page, the rules
// find the allergy, medicine and condition, and the saved document survives a reload.
//   npm run dev   then   node scripts/profile-check.mjs
// Makes no paid calls except the home screen's medicine matching (curated for Sita, so usually none).
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE || "http://localhost:5173";
const CHROME = process.env.CHROME || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => fs.existsSync(p));
const OUT = path.resolve(".cache/profile");
fs.mkdirSync(OUT, { recursive: true });
const brand = process.argv.includes("--tandem") ? "tandem" : "parity";

let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${what}`);
  if (!ok) failed++;
};

const NOTE = `<html><body style="margin:0;background:#fff;font:22px/1.5 Arial;color:#111;padding:40px 46px;width:760px">
<div style="font-size:30px;font-weight:bold">Mount Sinai Urgent Care</div>
<div style="font-size:26px;margin-bottom:18px">Visit Summary</div>
<div>Date: 11/02/2026</div><div style="margin-bottom:18px">Patient: Sita Gurung</div>
<div style="font-weight:bold">Allergies</div><div style="margin-bottom:14px">- Sulfa drugs (rash and hives)</div>
<div style="font-weight:bold">Medications</div><div style="margin-bottom:14px">- Montelukast 10 mg every night</div>
<div style="font-weight:bold">Diagnoses</div><div>- Allergic rhinitis</div>
</body></html>`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--disable-audio-output", "--window-size=430,932"] });
try {
  // 1. A photo of a printed note.
  const art = await browser.newPage();
  await art.setViewport({ width: 852, height: 640 });
  await art.setContent(NOTE);
  const notePng = path.join(OUT, "note.png");
  await art.screenshot({ path: notePng });
  await art.close();

  const page = await browser.newPage();
  await page.setViewport({ width: 400, height: 860, deviceScaleFactor: 2 });
  // Seed before the app loads (its own mount would otherwise save its settings over these).
  await page.evaluateOnNewDocument((brand) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.clear();
    localStorage.setItem("ti.settings.v1", JSON.stringify({ tab: "talk", personaId: "sita", mode: "auto", speak: true, pairs: {}, brand }));
  }, brand);
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await page.waitForSelector(".patient-card");
  // Let the home screen match medicine names for New York first.
  await page.waitForFunction(() => !/Matching/.test(document.querySelector(".patient-card")?.textContent || ""), { timeout: 60000 });

  const openRecord = async () => {
    await page.click(".pc-open");
    await page.waitForSelector(".record .swipe-row");
    await new Promise((r) => setTimeout(r, 500));
  };
  await openRecord();

  check(!/fictional|Swipe left/i.test(await page.$eval(".sheet", (e) => e.textContent)), "no '(fictional)' labels or swipe hint in the record");

  // 2. Local names carry the local flag.
  const locals = await page.$$eval(".rec-section.medication .local-name", (els) => els.map((e) => ({ text: e.textContent, flag: !!e.querySelector("svg, img") })));
  check(locals.length >= 2 && locals.every((l) => l.flag), `medicines show local name + flag (${locals.map((l) => l.text).join(" | ")})`);
  check(locals.some((l) => /acetaminophen/i.test(l.text)), "Flexon shows its US name");

  // 3. Swipe the first allergy left, delete, undo, delete again.
  const rowSel = '.rec-section.allergy .swipe-row[data-id="alg_contrast"] > .list-row';
  const swipeLeft = async (sel, by) => {
    await page.$eval(sel, (e) => e.scrollIntoView({ block: "center" }));
    await new Promise((r) => setTimeout(r, 300));
    const box = await (await page.$(sel)).boundingBox();
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width - 20, y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width - 20 - (by * i) / 8, y + i * 0.3);
    await page.mouse.up();
    await new Promise((r) => setTimeout(r, 450));
  };
  await swipeLeft(rowSel, 110);
  check(await page.$('.swipe-row.open[data-id="alg_contrast"]'), "swipe left reveals Delete");
  await page.screenshot({ path: path.join(OUT, `swipe-${brand}.png`) });
  await page.click('.swipe-row.open[data-id="alg_contrast"] .swipe-delete');
  await new Promise((r) => setTimeout(r, 300));
  check(!(await page.$('[data-id="alg_contrast"]')), "deleted row is gone");
  check(await page.$(".undo-bar"), "undo bar shows");
  await page.screenshot({ path: path.join(OUT, `undo-${brand}.png`) });
  await page.click(".undo-bar button");
  await new Promise((r) => setTimeout(r, 300));
  check(await page.$('[data-id="alg_contrast"]'), "undo brings it back");

  // A long swipe deletes outright.
  await swipeLeft('.swipe-row[data-id="con_gita"] > .list-row', 372);
  await new Promise((r) => setTimeout(r, 400));
  check(!(await page.$('[data-id="con_gita"]')), "long swipe deletes outright");

  // 4. Add a document by photo.
  const input = await page.$('[data-testid="scan-input"]');
  await input.uploadFile(notePng);
  await page.waitForSelector(".scan.reading");
  await new Promise((r) => setTimeout(r, 900)); // let the sheet finish sliding in
  await page.screenshot({ path: path.join(OUT, `scan-reading-${brand}.png`) });
  await page.waitForSelector(".scan.review", { timeout: 120000 });
  const title = await page.$eval(".scan-field input", (e) => e.value);
  const date = await page.$eval('.scan-field input[type="date"]', (e) => e.value);
  const findings = await page.$$eval(".finding", (els) => els.map((e) => e.textContent));
  console.log("  scanned:", title, date, findings);
  check(/summary/i.test(title), `title read: ${title}`);
  check(date === "2026-11-02", `date read: ${date}`);
  check(findings.some((f) => /sulfa/i.test(f)), "found the sulfa allergy");
  check(findings.some((f) => /montelukast/i.test(f)), "found montelukast");
  check(findings.some((f) => /rhinitis/i.test(f)), "found allergic rhinitis");
  await new Promise((r) => setTimeout(r, 900)); // let the sheet finish sliding in
  await page.screenshot({ path: path.join(OUT, `scan-review-${brand}.png`), fullPage: false });
  await page.click(".scan-actions .btn-primary");
  await page.waitForSelector(".record .swipe-row");
  const docs = await page.$$eval(".rec-section.document .swipe-row", (els) => els.map((e) => e.textContent));
  check(docs.some((d) => /summary/i.test(d)), "document added to the record");
  check(await page.$$eval(".rec-section.allergy .swipe-row", (els) => els.some((e) => /sulfa/i.test(e.textContent))), "sulfa allergy added");
  await new Promise((r) => setTimeout(r, 900)); // let the sheet finish sliding in
  await page.screenshot({ path: path.join(OUT, `record-after-${brand}.png`) });

  // The scanned page keeps its photo: a thumbnail in the list, the photo and the page when tapped.
  const scannedRow = '.rec-section.document .swipe-row:first-child > .list-row';
  check(await page.$(`${scannedRow} .doc-thumb img`), "scanned document shows a photo thumbnail");
  await page.$eval(scannedRow, (e) => e.scrollIntoView({ block: "center" }));
  await page.click(scannedRow);
  await page.waitForSelector(".paper", { timeout: 5000 }).catch(() => {});
  check(await page.$(".doc-photo"), "tapping it opens the photo");
  check(await page.$(".paper"), "and the page of the note");
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: path.join(OUT, `preview-${brand}.png`) });
  await page.click(".sheet-head .icon-btn");
  await page.waitForSelector(".record .swipe-row");

  // Typing an entry in: Add on any section, then "Type it in".
  check(await page.$(".rec-section.contact .add-btn"), "an emptied section keeps its Add button");
  await page.$eval(".rec-section.medication .add-btn", (e) => e.scrollIntoView({ block: "center" }));
  await page.click(".rec-section.medication .add-btn");
  await page.waitForSelector(".rec-section.medication .add-menu");
  check((await page.$$(".rec-section.medication .add-menu button")).length === 2, "Add offers Type it in and Upload");
  await page.click(".rec-section.medication .add-menu button");
  await page.waitForSelector(".manual input");
  await page.type(".manual input", "Metformin");
  await page.click(".manual .btn-primary");
  await page.waitForSelector(".record .swipe-row");
  check(await page.$$eval(".rec-section.medication .swipe-row", (els) => els.some((e) => /Metformin/.test(e.textContent))), "typed-in medicine is in the record");

  // 5. It persists, and the deletion too.
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector(".pc-open");
  await openRecord();
  check(await page.$$eval(".rec-section.medication .swipe-row", (els) => els.some((e) => /Metformin/.test(e.textContent))), "typed-in medicine still there after reload");
  check(await page.$$eval(".rec-section.document .swipe-row", (els) => els.some((e) => /summary/i.test(e.textContent))), "document still there after reload");
  check(!(await page.$('[data-id="con_gita"]')), "deletion still there after reload");
  await page.evaluate(() => localStorage.removeItem("ti.edits.sita"));
} finally {
  await browser.close();
}
console.log(failed ? `${failed} check(s) failed` : "all passed");
process.exit(failed ? 1 : 0);
