// Microphone capture with a small adaptive voice-activity detector.
// "auto": hands-free; an utterance ends after ~0.8 s of quiet (or a tap).
// "push": tap to start, tap to send.
// Audio is cut into utterances on the phone and sent as 16 kHz mono WAV.

export type MicMode = "auto" | "push";
export type MicState = "off" | "starting" | "listening" | "speech" | "paused" | "error";

type Handlers = {
  onState: (s: MicState) => void;
  onLevel: (level: number) => void;
  /** A finished utterance. `seg` matches the onPartial calls made while it was being spoken. */
  onUtterance: (wav: Blob, ms: number, seg: number) => void;
  onError: (message: string) => void;
  /** Audio so far, about once a second while someone is still talking: for live captions. */
  onPartial?: (seg: number, wav: Blob) => void;
  /** The utterance in progress was dropped (too short, paused, mode change). */
  onDiscard?: (seg: number) => void;
};

const PARTIAL_FIRST = 40; // first live caption after 0.8 s of speech
const PARTIAL_EVERY = 50; // then every 1 s

const FRAME_MS = 20;
const PREROLL = 15; // 300 ms kept from before speech starts
const START_FRAMES = 3; // 60 ms above threshold starts an utterance
const END_SILENCE = 55; // 1.1 s of quiet ends it (shorter splits sentences at "um…" pauses)
const MIN_VOICED = 12; // ignore blips shorter than ~240 ms of voice
const MAX_FRAMES = 1500; // 30 s cap
const TARGET_RATE = 16000;

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export class Mic {
  mode: MicMode = "auto";
  /** iOS plays speech quietly (or through the earpiece) while a mic stream is open, so release it during playback. */
  releaseWhilePaused = isIOS();

  private h: Handlers;
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private src: MediaStreamAudioSourceNode | null = null;
  private node: AudioWorkletNode | null = null;
  private state: MicState = "off";
  private pauses = new Set<string>();
  private floorHist: number[] = [];
  private floor = 0.004;
  private pre: Float32Array[] = [];
  private seg: Float32Array[] = [];
  private loud = 0;
  private silent = 0;
  private voiced = 0;
  private pushing = false;
  private segId = 0;
  private partialAt = 0;
  private lastLevelAt = 0;
  private restoring: Promise<void> | null = null;

  constructor(h: Handlers) {
    this.h = h;
  }

  get current() {
    return this.state;
  }
  get isPushing() {
    return this.pushing;
  }

  private set(s: MicState) {
    if (s === this.state) return;
    this.state = s;
    this.h.onState(s);
  }

  /** Must be called from a user gesture (tap) the first time. */
  async start() {
    if (this.ctx) {
      // Retry after a failed reopen: the audio graph is alive but the mic stream is gone.
      if (!this.stream) {
        try {
          await this.openInput();
        } catch (err) {
          this.fail(err);
          return;
        }
      }
      await this.ctx.resume().catch(() => {});
      this.set(this.pauses.size ? "paused" : "listening");
      return;
    }
    this.set("starting");
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("The microphone needs HTTPS. Open the https:// address (or localhost).");
      }
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      await this.ctx.audioWorklet.addModule("/capture-worklet.js");
      this.node = new AudioWorkletNode(this.ctx, "capture-processor");
      this.node.port.onmessage = (e: MessageEvent<Float32Array>) => this.frame(e.data);
      // Keep the graph pulling without making any sound.
      const mute = this.ctx.createGain();
      mute.gain.value = 0;
      this.node.connect(mute).connect(this.ctx.destination);
      await this.openInput();
      await this.ctx.resume();
      this.set(this.pauses.size ? "paused" : "listening");
    } catch (err) {
      this.fail(err);
    }
  }

  /** Any mic failure: release everything so the next tap starts from scratch. */
  private fail(err: unknown) {
    const msg =
      (err as DOMException)?.name === "NotAllowedError"
        ? "Microphone permission was denied. Allow it in the browser's site settings."
        : (err as Error)?.message || "Could not start the microphone";
    this.reset();
    this.teardown();
    this.pauses.clear();
    this.set("error");
    this.h.onError(msg);
  }

  private async openInput() {
    if (!this.ctx || !this.node) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    this.src = this.ctx.createMediaStreamSource(this.stream);
    this.src.connect(this.node);
  }

  private closeInput() {
    this.src?.disconnect();
    this.src = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  private teardown() {
    this.closeInput();
    this.node?.disconnect();
    this.node = null;
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

  stop() {
    // An utterance in progress is dropped, so its live caption doesn't linger.
    this.drop();
    this.teardown();
    this.pauses.clear();
    this.set("off");
  }

  pause(reason: string) {
    const was = this.pauses.size;
    this.pauses.add(reason);
    if (was) return;
    // A tap-to-talk recording in progress is sent rather than lost.
    if (this.pushing) this.endPush();
    else this.drop();
    if (this.state !== "off" && this.state !== "error") this.set("paused");
    if (this.releaseWhilePaused && reason === "speaking") this.closeInput();
  }

  resume(reason: string) {
    if (!this.pauses.delete(reason) || this.pauses.size) return;
    if (!this.ctx) return;
    const go = async () => {
      if (!this.stream) {
        try {
          await this.openInput();
        } catch (e) {
          this.fail(e);
          return;
        }
      }
      await this.ctx?.resume().catch(() => {});
      if (!this.pauses.size) this.set("listening");
    };
    this.restoring = (this.restoring || Promise.resolve()).then(go);
  }

  isPaused(reason?: string) {
    return reason ? this.pauses.has(reason) : this.pauses.size > 0;
  }

  setMode(m: MicMode) {
    this.mode = m;
    this.drop();
    if (this.state === "speech") this.set("listening");
  }

  beginPush() {
    if (this.pauses.size || !this.ctx) return;
    this.reset();
    this.pushing = true;
    this.segId++;
    this.set("speech");
  }

  /** Throw away an utterance in progress, telling the app so its live caption goes away. */
  private drop() {
    const had = this.state === "speech" && this.seg.length > 0;
    this.reset();
    if (had) this.h.onDiscard?.(this.segId);
  }

  endPush() {
    if (!this.pushing) return;
    this.pushing = false;
    this.emit(this.seg, this.seg.length >= 10);
    this.reset();
    if (!this.pauses.size && this.ctx) this.set("listening");
  }

  /** In auto mode, end the current utterance now (tap while talking). */
  flush() {
    if (this.state !== "speech") return;
    if (this.pushing) return this.endPush();
    this.emit(this.seg, this.voiced >= 4);
    this.reset();
    this.set("listening");
  }

  private reset() {
    this.seg = [];
    this.pre = [];
    this.loud = 0;
    this.silent = 0;
    this.voiced = 0;
    this.pushing = false;
    this.partialAt = 0;
  }

  private maybePartial() {
    if (!this.h.onPartial) return;
    const due = this.partialAt ? this.partialAt + PARTIAL_EVERY : PARTIAL_FIRST;
    if (this.seg.length < due) return;
    this.partialAt = this.seg.length;
    const wav = this.encode(this.seg);
    if (wav) this.h.onPartial(this.segId, wav);
  }

  private frame(f: Float32Array) {
    if (this.pauses.size || !this.ctx) return;
    let sum = 0;
    for (let i = 0; i < f.length; i++) sum += f[i] * f[i];
    const rms = Math.sqrt(sum / f.length);
    const now = performance.now();
    if (now - this.lastLevelAt > 50) {
      this.lastLevelAt = now;
      this.h.onLevel(Math.min(1, Math.max(0, (20 * Math.log10(rms + 1e-9) + 62) / 46)));
    }

    if (this.mode === "push") {
      if (this.pushing) {
        this.seg.push(f);
        if (this.seg.length >= MAX_FRAMES) this.endPush();
        else this.maybePartial();
      }
      return;
    }

    if (this.state !== "speech") {
      this.pre.push(f);
      if (this.pre.length > PREROLL) this.pre.shift();
      this.floorHist.push(rms);
      if (this.floorHist.length > 150) this.floorHist.shift();
      // 10th percentile of the last 3 s: robust to speech bursts, follows room noise.
      const sorted = [...this.floorHist].sort((a, b) => a - b);
      this.floor = Math.min(0.06, Math.max(0.002, sorted[Math.floor(sorted.length * 0.1)] ?? 0.004));
      const startAt = Math.max(0.012, this.floor * 3.2);
      this.loud = rms > startAt ? this.loud + 1 : 0;
      if (this.loud >= START_FRAMES) {
        this.seg = [...this.pre];
        this.voiced = this.loud;
        this.silent = 0;
        this.partialAt = 0;
        this.segId++;
        this.set("speech");
      }
      return;
    }

    this.seg.push(f);
    const endAt = Math.max(0.008, this.floor * 2);
    if (rms > endAt) {
      this.voiced++;
      this.silent = 0;
    } else this.silent++;
    if (this.silent >= END_SILENCE || this.seg.length >= MAX_FRAMES) {
      const keep = this.seg.slice(0, this.seg.length - Math.max(0, this.silent - 20));
      this.emit(keep, this.voiced >= MIN_VOICED);
      this.reset();
      this.set("listening");
    } else if (this.voiced >= MIN_VOICED) this.maybePartial();
  }

  private encode(frames: Float32Array[]): Blob | null {
    if (!frames.length || !this.ctx) return null;
    const rate = this.ctx.sampleRate;
    const total = frames.reduce((n, f) => n + f.length, 0);
    const all = new Float32Array(total);
    let o = 0;
    for (const f of frames) {
      all.set(f, o);
      o += f.length;
    }
    return encodeWav(downsample(all, rate, TARGET_RATE), TARGET_RATE);
  }

  private emit(frames: Float32Array[], ok: boolean) {
    const wav = ok ? this.encode(frames) : null;
    if (!wav || !this.ctx) {
      this.h.onDiscard?.(this.segId);
      return;
    }
    const total = frames.reduce((n, f) => n + f.length, 0);
    this.h.onUtterance(wav, Math.round((total / this.ctx.sampleRate) * 1000), this.segId);
  }
}

export function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const a = Math.floor(i * ratio);
    const b = Math.min(input.length, Math.floor((i + 1) * ratio));
    let s = 0;
    for (let j = a; j < b; j++) s += input[j];
    out[i] = b > a ? s / (b - a) : input[a] || 0;
  }
  return out;
}

export function encodeWav(samples: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

export { FRAME_MS };
