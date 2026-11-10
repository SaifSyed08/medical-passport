// Browser end-to-end: Chrome's fake microphone plays the demo lines (voiced by TTS, cached by api-check)
// into the real app; we wait for the turns and context cards and take screenshots.
//   npm run dev   (in another terminal)
//   node --experimental-strip-types scripts/api-check.mjs sofia   (creates .cache/voice/*.wav once)
//   node scripts/e2e-browser.mjs [sofia|jordan] [--speak] [--show]
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const args = process.argv.slice(2);
const persona = args.find((a) => !a.startsWith("--")) || "sofia";
const SPEAK = args.includes("--speak");
const BASE = process.env.BASE || "http://localhost:5173";
const OUT = path.resolve(".cache/e2e");
fs.mkdirSync(OUT, { recursive: true });

const CHROME = process.env.CHROME || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => fs.existsSync(p));

/** Read PCM16 mono samples from a WAV (TTS streams can carry a bogus data size, so read to the end). */
function readWav(file) {
  const b = fs.readFileSync(file);
  const rate = b.readUInt32LE(24);
  let o = 12;
  while (o < b.length - 8) {
    const id = b.toString("ascii", o, o + 4);
    const size = b.readUInt32LE(o + 4);
    if (id === "data") return { rate, pcm: new Int16Array(b.buffer.slice(b.byteOffset + o + 8, b.byteOffset + b.length - ((b.length - o - 8) % 2))) };
    o += 8 + size;
  }
  throw new Error(`no data chunk in ${file}`);
}

function buildTrack() {
  const files = fs.readdirSync(".cache/voice").filter((f) => f.startsWith(`${persona}-`) && f.endsWith(".wav")).sort();
  if (!files.length) throw new Error(`no voices for ${persona}; run api-check first`);
  const parts = files.map((f) => readWav(path.join(".cache/voice", f)));
  const rate = parts[0].rate;
  const gap = Math.round(rate * (SPEAK ? 9 : 3.5));
  const lead = Math.round(rate * 2.5);
  const total = lead + parts.reduce((n, p) => n + p.pcm.length + gap, 0);
  const pcm = new Int16Array(total);
  // Low room noise, so the detector has a floor to learn.
  for (let i = 0; i < total; i++) pcm[i] = Math.round((Math.random() - 0.5) * 60);
  let at = lead;
  for (const p of parts) {
    for (let i = 0; i < p.pcm.length; i++) pcm[at + i] = Math.max(-32768, Math.min(32767, pcm[at + i] + p.pcm[i]));
    at += p.pcm.length + gap;
  }
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + pcm.length * 2, 4);
  head.write("WAVEfmt ", 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(pcm.length * 2, 40);
  const file = path.join(OUT, `${persona}-mic.wav`);
  fs.writeFileSync(file, Buffer.concat([head, Buffer.from(pcm.buffer)]));
  return { file, lines: parts.length, seconds: total / rate };
}

const track = buildTrack();
console.log(`fake mic: ${track.lines} lines, ${track.seconds.toFixed(1)} s`);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: !args.includes("--show"),
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-audio-capture=${track.file.replace(/\\/g, "/")}%noloop`,
    "--autoplay-policy=no-user-gesture-required",
    "--window-size=430,900",
  ],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
page.on("console", (m) => (m.type() === "error" || m.type() === "warn") && console.log(`  [page ${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => console.log(`  [page error] ${e.message}`));

await page.goto(BASE, { waitUntil: "networkidle0" });
await page.evaluate((p, speak) => {
  localStorage.clear();
  localStorage.setItem("ti.settings.v1", JSON.stringify({ personaId: p, mode: "auto", speak, pairs: {} }));
}, persona, SPEAK);
await page.reload({ waitUntil: "networkidle0" });
await page.waitForFunction(() => /matched to local names/.test(document.body.innerText), { timeout: 30000 });
await page.screenshot({ path: path.join(OUT, `${persona}-home.png`) });

await page.click(".btn-primary");
await page.waitForSelector(".orb");
await new Promise((r) => setTimeout(r, 900)); // let the screen transition finish
await page.screenshot({ path: path.join(OUT, `${persona}-empty.png`) });
const t0 = Date.now();
await page.click(".orb");

const deadline = Date.now() + (track.seconds + 40) * 1000;
let last = -1;
// Only the current turn is a full card; earlier ones shrink into the history. Record each turn while it's on stage.
const seenTurns = new Map();
const captions = [];
const grab = () =>
  page.evaluate(() => {
    const all = document.querySelectorAll(".turn.done");
    const t = all[all.length - 1];
    return t
      ? {
          status: t.className,
          who: t.querySelector(".who-pill")?.textContent,
          said: t.querySelector(".original")?.textContent,
          translation: t.querySelector(".translation")?.textContent,
          marks: [...t.querySelectorAll(".original .drug")].map((d) => d.textContent),
          chips: [...t.querySelectorAll(".drug-chip")].map((d) => d.textContent),
          time: t.querySelector(".timing")?.textContent,
        }
      : null;
  });
for (;;) {
  const s = await page.evaluate(() => ({
    done: document.querySelectorAll(".turn.done").length,
    busy: document.querySelectorAll(".turn.transcribing, .turn.interpreting").length,
    errors: [...document.querySelectorAll(".turn.error")].map((e) => e.textContent),
    label: document.querySelector(".orb-label")?.textContent,
  }));
  const cur = await grab();
  if (cur?.translation) seenTurns.set(cur.translation, cur);
  const caption = await page.evaluate(() => document.querySelector(".turn.live .live-text")?.textContent || "");
  if (caption && !captions.includes(caption)) {
    captions.push(caption);
    console.log(`  live caption: ${caption}`);
  }
  if (s.done !== last) {
    console.log(`  t+${((Date.now() - t0) / 1000).toFixed(1)}s turns done ${s.done} (busy ${s.busy}) · ${s.label}`);
    last = s.done;
  }
  if (s.errors.length) console.log("  errors:", s.errors);
  // Wait for the whole fake-mic track to play out, then for in-flight turns to finish.
  const played = Date.now() - t0 > track.seconds * 1000 + 1500;
  if ((played && s.done >= track.lines && !s.busy) || Date.now() > deadline) break;
  await new Promise((r) => setTimeout(r, 400));
}
await new Promise((r) => setTimeout(r, 2500)); // let context cards and animations land
await page.screenshot({ path: path.join(OUT, `${persona}-talk.png`) });

{
  const cur = await grab();
  if (cur?.translation) seenTurns.set(cur.translation, cur);
}
const result = {
  turns: [...seenTurns.values()],
  history: await page.evaluate(() => document.querySelectorAll(".turn.done").length - 1),
  context: await page.evaluate(() => [...document.querySelectorAll(".ctx-row")].map((c) => c.className.replace("ctx-row ", "") + " | " + c.querySelector("strong")?.textContent)),
};
for (const t of result.turns) {
  console.log(`\n[${t.who}] ${t.time || ""} ${t.status}`);
  console.log(`  said: ${t.said}`);
  console.log(`  tr:   ${t.translation}`);
  if (t.marks.length) console.log(`  marks: ${t.marks.join(" | ")}`);
  if (t.chips.length) console.log(`  chips: ${t.chips.join(" | ")}`);
}
console.log(`\ncontext cards (${result.context.length}):\n  ${result.context.join("\n  ")}`);

// Open the first drug and the first alert so their sheets get screenshotted too.
const drug = await page.$(".original .drug");
if (drug) {
  await drug.click();
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(OUT, `${persona}-drug.png`) });
  await page.click(".sheet .icon-btn");
}
const alert = await page.$(".ctx-row.alert");
if (alert) {
  await alert.click();
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(OUT, `${persona}-alert.png`) });
}
await browser.close();

const failures = [];
const done = result.turns;
if (done.length !== track.lines || result.history + 1 !== track.lines) failures.push(`expected ${track.lines} turns, got ${done.length} (a line was split or merged)`);
if (done.some((t) => !t.translation?.trim())) failures.push("a turn has an empty translation");
if (!captions.some((c) => c.trim().split(/\s+/).length >= 3)) failures.push("no live captions appeared while lines were being spoken");
if (persona === "jordan") {
  if (!result.turns.some((t) => t.marks.some((m) => /サルブタモール/.test(m)))) failures.push("ProAir did not swap to サルブタモール");
  if (!result.context.some((c) => c.startsWith("alert"))) failures.push("no penicillin alert");
}
if (persona === "sofia") {
  if (!result.turns.some((t) => t.marks.some((m) => /metamizol/i.test(m)))) failures.push("Neo-Melubrina did not swap to metamizole");
  if (!result.turns.some((t) => t.marks.some((m) => /albuterol/i.test(m)))) failures.push("Ventolin did not swap to albuterol");
  if (!result.context.some((c) => c.startsWith("alert"))) failures.push("no alert card");
}
console.log(failures.length ? `\nFAIL: ${failures.join("; ")}` : "\nPASS");
console.log(`screenshots in ${OUT}`);
process.exitCode = failures.length ? 1 : 0;
