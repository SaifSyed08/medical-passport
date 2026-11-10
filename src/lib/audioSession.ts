// One audio session for the whole app: the translation player and the demo's voice element live here,
// so they survive screen changes and can be unlocked by the tap or key press that starts things.
// iOS Safari only lets audio play (and AudioContexts run) after one has been started inside a user gesture.
import { Player } from "./player";

const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

let player: Player | null = null;
let onBusy: (busy: boolean) => void = () => {};

export function sharedPlayer(): Player {
  if (!player) player = new Player((busy) => onBusy(busy));
  return player;
}

/** The conversation screen that is currently mounted gets the player's busy signal. */
export function setPlayerBusyHandler(fn: (busy: boolean) => void) {
  onBusy = fn;
}

type Meter = { ctx: AudioContext; analyser: AnalyserNode };
let voice: HTMLAudioElement | null = null;
let meter: Meter | null = null;

export function demoVoice(): { el: HTMLAudioElement; meter: Meter | null } {
  if (!voice) {
    voice = new Audio();
    voice.setAttribute("playsinline", "");
    voice.preload = "auto";
  }
  return { el: voice, meter };
}

/**
 * Call synchronously inside a tap/key handler. Unlocks the translation player and the demo voice, and creates
 * the level meter's AudioContext while it is allowed to run (a context created outside a gesture starts
 * suspended, and routing the voice through it would make the demo silent).
 */
export function unlockAudio() {
  sharedPlayer().unlock();
  const { el } = demoVoice();
  if (!meter) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaElementSource(el).connect(analyser).connect(ctx.destination);
      meter = { ctx, analyser };
    } catch {
      meter = null;
    }
  }
  void meter?.ctx.resume().catch(() => {});
  if (el.paused) {
    el.src = SILENT_WAV;
    el.play().catch(() => {});
  }
}
