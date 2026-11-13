// Plays translated speech one line at a time through a single <audio> element
// (one element, unlocked by a tap, is what iOS Safari needs for later programmatic playback).

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

type Item = { url: string; text: string; done: () => void };

export class Player {
  enabled = true;
  private audio: HTMLAudioElement;
  private queue: Item[] = [];
  private current: Item | null = null;
  private unlocked = false;
  private onBusy: (busy: boolean, text?: string) => void;

  constructor(onBusy: (busy: boolean, text?: string) => void) {
    this.onBusy = onBusy;
    this.audio = new Audio();
    this.audio.preload = "auto";
    this.audio.setAttribute("playsinline", "");
    const next = () => this.finish();
    this.audio.addEventListener("ended", next);
    this.audio.addEventListener("error", next);
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

  get busy() {
    return Boolean(this.current);
  }

  private playNext() {
    const item = this.queue.shift();
    if (!item) {
      this.current = null;
      this.onBusy(false);
      return;
    }
    this.current = item;
    this.onBusy(true, item.text);
    this.audio.src = item.url;
    this.audio.play().catch(() => this.finish());
  }

  private finish() {
    const item = this.current;
    if (!item) return;
    this.current = null;
    item.done();
    this.playNext();
  }
}
