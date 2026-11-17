// Plays translated speech one line at a time through a single <audio> element
// (one element, unlocked by a tap, is what iOS Safari needs for later programmatic playback).

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

type Item = { url: string; text: string; done: () => void };

export class Player {
  enabled = true;
  /** How long a line may take to start, and how long it may stand still once started, before it is given up on. */
  startTimeoutMs = 15000; // live speech can take a while to arrive from the server
  stallTimeoutMs = 6000;
  private audio: HTMLAudioElement;
  private queue: Item[] = [];
  private current: Item | null = null;
  private unlocked = false;
  private progressAt = 0;
  private lastTime = -1;
  private started = false;
  private nudges = 0;
  private guard: ReturnType<typeof setInterval> | undefined;
  private rate = 1;
  private onBusy: (busy: boolean, text?: string) => void;

  constructor(onBusy: (busy: boolean, text?: string) => void) {
    this.onBusy = onBusy;
    this.audio = new Audio();
    this.audio.preload = "auto";
    this.audio.setAttribute("playsinline", "");
    const next = () => this.finish();
    this.audio.addEventListener("ended", next);
    this.audio.addEventListener("error", next);
    this.audio.addEventListener("playing", () => (this.started = true));
    // iOS can pause the element by itself (the audio route changes when the mic is released, a call comes in).
    // No "ended" follows, so without this the app would wait forever with the mic held closed.
    this.audio.addEventListener("pause", () => {
      const item = this.current;
      if (!item || this.audio.ended) return;
      setTimeout(() => {
        if (this.current !== item || !this.audio.paused) return;
        if (this.nudges++ < 2) this.audio.play().catch(() => this.finish());
        else this.finish();
      }, 200);
    });
  }

  /** A line that doesn't start within 15 s, or stops advancing for 6 s, is given up on so the mic comes back. */
  private watch() {
    clearInterval(this.guard);
    this.progressAt = performance.now();
    this.lastTime = -1;
    this.started = false;
    this.nudges = 0;
    this.guard = setInterval(() => {
      if (!this.current) return clearInterval(this.guard);
      const now = performance.now();
      if (this.audio.currentTime !== this.lastTime) {
        this.lastTime = this.audio.currentTime;
        this.progressAt = now;
        return;
      }
      if (now - this.progressAt > (this.started ? this.stallTimeoutMs : this.startTimeoutMs)) this.finish();
    }, 500);
    (this.guard as { unref?: () => void }).unref?.();
  }

  /** Call inside a tap handler once. */
  unlock() {
    // Swapping the source mid-line would cut off whatever is playing (and its "ended" would skip it).
    if (this.current || this.unlocked) return;
    this.unlocked = true;
    this.audio.src = SILENT_WAV;
    this.audio.play().catch(() => {});
  }

  /** Speak a translation. Resolves when the line has finished playing (or was skipped). */
  say(text: string, lang: string, voice = "coral"): Promise<void> {
    if (!text.trim()) return Promise.resolve();
    return this.play(`/api/tts?${new URLSearchParams({ text, lang, voice })}`, text);
  }

  /** Play a recorded clip (demo mode). */
  play(url: string, text = ""): Promise<void> {
    if (!this.enabled) return Promise.resolve();
    return new Promise((done) => {
      this.queue.push({ url, text, done });
      if (!this.current) this.playNext();
    });
  }

  stop() {
    const pending = this.queue.splice(0);
    pending.forEach((i) => i.done());
    if (this.current) {
      this.audio.pause();
      this.finish();
    }
  }

  /** Playback speed for every line (the secret fast demo). */
  setRate(rate: number) {
    this.rate = rate;
    this.audio.playbackRate = rate;
  }

  get busy() {
    return Boolean(this.current);
  }

  private playNext() {
    const item = this.queue.shift();
    if (!item) {
      this.current = null;
      clearInterval(this.guard);
      this.onBusy(false);
      return;
    }
    this.current = item;
    this.onBusy(true, item.text);
    this.watch();
    this.audio.src = item.url;
    this.audio.defaultPlaybackRate = this.audio.playbackRate = this.rate;
    this.audio.play().catch(() => this.finish());
  }

  private finish() {
    const item = this.current;
    if (!item) return;
    this.current = null;
    // A line given up on mid-way must not keep sounding under the next one.
    if (!this.audio.paused && !this.audio.ended) this.audio.pause();
    item.done();
    this.playNext();
  }
}
