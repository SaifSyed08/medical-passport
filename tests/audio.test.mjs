// Mic / Player / half-duplex behaviour with fake browser audio. Regression tests for the 2026-11-10 audit.
import { test } from "node:test";
import assert from "node:assert/strict";

class FakeAudio {
  constructor() {
    this.listeners = {};
    this.src = "";
    this.preload = "";
    this.plays = [];
  }
  setAttribute() {}
  addEventListener(k, f) {
    (this.listeners[k] ||= []).push(f);
  }
  fire(k) {
    (this.listeners[k] || []).forEach((f) => f());
  }
  play() {
    this.plays.push(this.src);
    return Promise.resolve();
  }
  pause() {}
}
globalThis.Audio = FakeAudio;

const { Mic } = await import("../src/lib/mic.ts");
const { Player } = await import("../src/lib/player.ts");
const { halfDuplex } = await import("../src/lib/duplex.ts");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LOUD = () => new Float32Array(320).fill(0.2);

function fakeMic({ ios = false, getUserMedia } = {}) {
  const events = { states: [], utterances: 0, errors: [] };
  const mic = new Mic({
    onState: (s) => events.states.push(s),
    onLevel() {},
    onUtterance: () => events.utterances++,
    onError: (m) => events.errors.push(m),
  });
  mic.releaseWhilePaused = ios;
  // Pretend start() already ran: an audio graph with an open mic stream.
  mic.ctx = { resume: async () => {}, close: async () => {}, sampleRate: 16000, createMediaStreamSource: () => ({ connect() {}, disconnect() {} }) };
  mic.node = { disconnect() {} };
  mic.stream = { getTracks: () => [] };
  mic.state = "listening";
  globalThis.navigator.mediaDevices = { getUserMedia: getUserMedia || (async () => ({ getTracks: () => [] })) };
  return { mic, events };
}

test("back-to-back spoken lines keep the mic paused for the whole second line", async () => {
  const { mic, events } = fakeMic();
  const duplex = halfDuplex(() => mic, 50);
  const player = new Player((busy) => duplex.onBusy(busy));
  // Same shape as Conversation's speech chain: line two is queued only once line one has finished,
  // so the player goes idle (onBusy false) and busy again (onBusy true) in the same tick.
  let b;
  const a = player.say("line one", "en").then(() => {
    b = player.say("line two", "en");
  });
  await sleep(10);
  assert.equal(mic.isPaused("speaking"), true);
  player.audio.fire("ended");
  await a;
  await sleep(120); // well past the resume tail
  assert.equal(mic.isPaused("speaking"), true, "mic reopened during line two");
  for (let i = 0; i < 120; i++) mic.frame(LOUD()); // the phone's own voice reaching the mic
  assert.equal(events.utterances, 0, "the app heard its own translation");
  player.audio.fire("ended");
  await b;
  await sleep(120);
  assert.equal(mic.isPaused(), false, "mic should listen again after the last line");
  duplex.cancel();
});

test("a tap after a failed mic reopen really reopens the mic", async () => {
  let calls = 0;
  let failNext = true;
  const { mic, events } = fakeMic({
    ios: true,
    getUserMedia: async () => {
      calls++;
      if (failNext) {
        failNext = false;
        throw new Error("Microphone lost");
      }
      return { getTracks: () => [] };
    },
  });
  mic.pause("speaking"); // iOS releases the stream while the phone talks
  assert.equal(mic.stream, null);
  mic.resume("speaking"); // reopen fails
  await sleep(10);
  assert.equal(mic.current, "error");
  assert.ok(events.errors.length >= 1);
  // The orb's retry tap. start() needs a real AudioContext when the graph was torn down, so stub it.
  globalThis.window = { isSecureContext: true, AudioContext: class { constructor() { this.sampleRate = 16000; this.audioWorklet = { addModule: async () => {} }; this.destination = {}; } createGain() { return { gain: {}, connect: (x) => x }; } createMediaStreamSource() { return { connect() {} }; } resume() { return Promise.resolve(); } close() { return Promise.resolve(); } } };
  globalThis.AudioWorkletNode = class { constructor() { this.port = {}; } connect(x) { return x; } disconnect() {} };
  await mic.start();
  assert.equal(calls, 2, "retry must call getUserMedia again");
  assert.ok(mic.stream, "retry left no mic stream");
  assert.equal(mic.current, "listening");
});

test("start() on a live graph whose stream is gone reopens the stream", async () => {
  let calls = 0;
  const { mic } = fakeMic({ getUserMedia: async () => (calls++, { getTracks: () => [] }) });
  mic.stream = null;
  await mic.start();
  assert.equal(calls, 1);
  assert.ok(mic.stream);
});

test("live caption snapshots arrive while talking and share the final utterance's id", () => {
  const { mic } = fakeMic();
  const partials = [];
  const finals = [];
  const discards = [];
  mic.h.onPartial = (seg, wav) => partials.push({ seg, size: wav.size });
  mic.h.onUtterance = (_wav, _ms, seg) => finals.push(seg);
  mic.h.onDiscard = (seg) => discards.push(seg);
  for (let i = 0; i < 20; i++) mic.frame(new Float32Array(320)); // room noise floor
  for (let i = 0; i < 150; i++) mic.frame(LOUD()); // 3 s of speech
  assert.ok(partials.length >= 2, `expected live snapshots, got ${partials.length}`);
  assert.ok(partials[1].size > partials[0].size, "each snapshot should hold more audio");
  for (let i = 0; i < 60; i++) mic.frame(new Float32Array(320)); // 1.2 s quiet ends it
  assert.deepEqual(finals, [partials[0].seg]);
  assert.equal(discards.length, 0);
  // A blip too short to be speech is discarded, so its caption can be removed.
  for (let i = 0; i < 5; i++) mic.frame(LOUD());
  for (let i = 0; i < 60; i++) mic.frame(new Float32Array(320));
  assert.equal(discards.length, 1);
});

test("unlock() does not cut off a line that is playing", async () => {
  const player = new Player(() => {});
  player.unlock();
  const done = player.say("a long line", "es");
  await sleep(5);
  const playing = player.audio.src;
  assert.match(playing, /api\/tts/);
  player.unlock(); // e.g. sending a typed line or tapping replay mid-line
  assert.equal(player.audio.src, playing, "unlock swapped the source mid-line");
  player.audio.fire("ended");
  await done;
});
