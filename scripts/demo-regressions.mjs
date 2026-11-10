// Browser regressions for the 2026-11-11 demo audit. /api is mocked, so this makes no paid calls.
// Each check reproduces one finding and fails if the bug comes back.
//   npm run dev   then   node scripts/demo-regressions.mjs
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE || "http://localhost:5173";
const CHROME = process.env.CHROME || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => fs.existsSync(p));
const OUT = path.resolve(".cache/regressions");
fs.mkdirSync(OUT, { recursive: true });
const demo = JSON.parse(fs.readFileSync("public/demo/sofia.json", "utf8"));
const mp3 = fs.readFileSync("public/demo/sofia-0-tr.mp3");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A fake-mic track: the first three demo lines with gaps (from the recorded demo clips).
function micTrack() {
  const read = (f) => {
    const b = fs.readFileSync(f);
    const rate = b.readUInt32LE(24);
    return { rate, pcm: new Int16Array(b.buffer.slice(b.byteOffset + 44, b.byteOffset + b.length - ((b.length - 44) % 2))) };
  };
  const parts = [0, 1, 2].map((i) => read(`public/demo/sofia-${i}.wav`));
  const rate = parts[0].rate;
  const total = rate * 3 + parts.reduce((n, p) => n + p.pcm.length + rate * 4, 0);
  const pcm = new Int16Array(total);
  for (let i = 0; i < total; i++) pcm[i] = Math.round((Math.random() - 0.5) * 60);
  let at = rate * 3;
  for (const p of parts) {
    for (let i = 0; i < p.pcm.length; i++) pcm[at + i] += p.pcm[i];
    at += p.pcm.length + rate * 4;
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length * 2, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length * 2, 40);
  const f = path.join(OUT, "mic.wav");
  fs.writeFileSync(f, Buffer.concat([h, Buffer.from(pcm.buffer)]));
  return f.replace(/\\/g, "/");
}

async function launch({ fakeMic = false } = {}) {
  const args = ["--autoplay-policy=no-user-gesture-required", "--window-size=430,900"];
  if (fakeMic) args.push("--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${micTrack()}%noloop`);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  // Log which media actually starts playing, and count AudioContexts.
  await page.evaluateOnNewDocument(() => {
    window.__playing = [];
    window.__acs = 0;
    window.__gum = 0;
    const md = navigator.mediaDevices;
    if (md?.getUserMedia) {
      const gum = md.getUserMedia.bind(md);
      md.getUserMedia = (...a) => (window.__gum++, gum(...a));
    }
    const AC = window.AudioContext;
    window.AudioContext = class extends AC { constructor(...a) { super(...a); window.__acs++; } };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!this.__hooked) {
        this.__hooked = true;
        this.addEventListener("playing", () => window.__playing.push({ t: performance.now(), src: this.currentSrc }));
      }
      return play.call(this);
    };
  });
  // Mocked API: slow enough that work is still in flight when the demo starts.
  page.reqs = [];
  await page.setRequestInterception(true);
  let stt = 0;
  page.on("request", async (req) => {
    const u = new URL(req.url());
    if (!u.pathname.startsWith("/api/") || u.pathname === "/api/health") return req.continue();
    page.reqs.push({ t: Date.now(), path: u.pathname });
    const json = (o, ms) => sleep(ms).then(() => req.respond({ status: 200, contentType: "application/json", body: JSON.stringify(o) }).catch(() => {}));
    if (u.pathname === "/api/transcribe") {
      const body = JSON.parse(req.postData());
      if (body.fast) {
        page.onFast?.();
        return json({ text: "LIVE caption words here" }, 700);
      }
      return json({ text: demo.lines[stt++ % 3].stt.text, ms: 500 }, 500);
    }
    if (u.pathname === "/api/interpret") {
      const body = JSON.parse(req.postData());
      const line = demo.lines.find((l) => l.stt.text === body.text) || demo.lines[0];
      return json({ ...line.interpret, translation: "LIVE " + line.interpret.translation }, 2500);
    }
    if (u.pathname === "/api/context") return json({ items: [{ ...demo.lines[0].context[0], title: "LIVE-CTX" }], ms: 1 }, 1500);
    if (u.pathname === "/api/tts") return req.respond({ status: 200, contentType: "audio/mpeg", body: mp3 });
    if (u.pathname === "/api/equivalents") return json({ items: demo.equivalents }, 50);
    req.respond({ status: 404, body: "{}" });
  });
  await page.goto(BASE, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("ti.settings.v1", JSON.stringify({ personaId: "sofia", mode: "auto", speak: true, pairs: {} }));
  });
  await page.reload({ waitUntil: "networkidle0" });
  return { browser, page };
}

const waitFor = async (page, fn, ms = 30000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await page.evaluate(fn)) return true;
    await sleep(40);
  }
  return false;
};
const now = (page) => page.evaluate(() => performance.now());
// Start → conversation runs a 0.6 s screen transition; taps during it land on the transition overlay.
const openTalk = async (page) => {
  await page.click(".btn-primary");
  await page.waitForSelector(".orb");
  await sleep(900);
};
const playedSince = (page, t) => page.evaluate((t) => window.__playing.filter((p) => p.t > t).map((p) => p.src.replace(location.origin, "")), t);

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `  (${detail})` : ""}`);
};

// 1. Stopping the demo just after a turn lands must not let that turn's translation start speaking.
for (const how of ["esc", "back", "dd"]) {
  const { browser, page } = await launch();
  await page.keyboard.press("d");
  await waitFor(page, () => !!document.querySelector(".turn.done"));
  await sleep(150);
  const t = await now(page);
  if (how === "esc") await page.keyboard.press("Escape");
  if (how === "back") await page.click('button[aria-label="Back"]');
  if (how === "dd") await page.keyboard.press("d");
  await sleep(3500);
  const played = await playedSince(page, t);
  check(`stop via ${how} right after a turn lands: no stale translation speech`, !played.some((s) => s.includes("-tr.mp3")), played.join(", "));
  await browser.close();
}

// 2. Pressing D while live work is in flight: none of it may leak into the demo.
{
  const { browser, page } = await launch({ fakeMic: true });
  await openTalk(page);
  await page.waitForSelector(".orb");
  await page.click(".orb");
  // Wait until a live turn is translating (and a caption exists for the next), then press D.
  await waitFor(page, () => !!document.querySelector(".turn.interpreting"), 40000);
  const tD = Date.now();
  await page.keyboard.press("d");
  await sleep(9000);
  const dom = await page.evaluate(() => ({
    text: document.querySelector(".transcript")?.textContent || "",
    cards: [...document.querySelectorAll(".ctx-row strong")].map((s) => s.textContent),
    mic: document.querySelector(".orb")?.className,
  }));
  const ttsAfter = page.reqs.filter((r) => r.path === "/api/tts" && r.t > tD).length;
  check("D during live: no live translation spoken over the demo", ttsAfter === 0, `${ttsAfter} tts requests`);
  check("D during live: no live turn or caption left in the demo transcript", !/LIVE/.test(dom.text), dom.text.slice(0, 80));
  check("D during live: no live record card in the demo", !dom.cards.some((c) => /LIVE/.test(c)), dom.cards.join(", "));
  await browser.close();
}

// 2b. Pressing D while the first live caption request is out must not leave a stray caption turn.
{
  const { browser, page } = await launch({ fakeMic: true });
  let pressed = false;
  page.onFast = () => {
    if (pressed) return;
    pressed = true;
    setTimeout(() => page.keyboard.press("d").catch(() => {}), 120);
  };
  await openTalk(page);
  await page.waitForSelector(".orb");
  await page.click(".orb");
  const end = Date.now() + 30000;
  while (!pressed && Date.now() < end) await sleep(100);
  await sleep(4000);
  const text = await page.evaluate(() => document.querySelector(".transcript")?.textContent || "");
  check("D while a caption is in flight: no stray caption turn", pressed && !/LIVE caption/.test(text), pressed ? text.slice(0, 80) : "no caption request seen");
  await browser.close();
}

// 3. A tap on the mic right after D must stop the demo, not start the mic underneath it.
{
  const { browser, page } = await launch({ fakeMic: true });
  await openTalk(page);
  await page.waitForSelector(".orb");
  await page.keyboard.press("d");
  await sleep(200);
  await page.click(".orb");
  await sleep(3000);
  const gum = await page.evaluate(() => window.__gum);
  check("tap right after D: mic stays off", gum === 0, `${gum} getUserMedia calls`);
  await browser.close();
}

// 3b. Half-duplex in a live conversation: the mic sends nothing while the phone is speaking a translation
// (React's dev double-mount once left the player with no busy handler, so the app heard itself).
for (const round of ["first visit", "after Back and Start"]) {
  const { browser, page } = await launch({ fakeMic: true });
  if (round !== "first visit") {
    await openTalk(page);
    await page.click('button[aria-label="Back"]');
    await sleep(900);
  }
  await openTalk(page);
  await page.click(".orb");
  const speaking = [];
  let was = false;
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    const is = await page.evaluate(() => /\bspeaking\b/.test(document.querySelector(".orb")?.className || ""));
    if (is && !was) speaking.push([Date.now(), Infinity]);
    if (!is && was) speaking[speaking.length - 1][1] = Date.now();
    was = is;
    if (speaking.length >= 1 && !is && Date.now() - speaking[0][1] > 1500) break;
    await sleep(80);
  }
  const during = page.reqs.filter((r) => r.path === "/api/transcribe" && speaking.some(([a, b]) => r.t > a + 200 && r.t < b - 200)).length;
  check(`half-duplex (${round}): phone speaks and the mic stays quiet meanwhile`, speaking.length > 0 && during === 0, speaking.length ? `${during} transcribe requests while speaking` : "never showed speaking");
  await browser.close();
}

// 4. Rehearsing (D, Back, repeat) must not pile up AudioContexts.
{
  const { browser, page } = await launch();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("d");
    await sleep(1800);
    await page.click('button[aria-label="Back"]');
    await sleep(250);
  }
  const acs = await page.evaluate(() => window.__acs);
  check("6 demo rehearsals: one shared AudioContext", acs <= 1, `${acs} contexts`);
  if (page.errors.length) check("no page errors", false, page.errors.join(" | "));
  await browser.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} regression(s) failed` : "\nall regressions pass");
process.exitCode = failed ? 1 : 0;
