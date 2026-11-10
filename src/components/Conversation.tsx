import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ContextItem, DrugMention, Equivalent, Persona, Speaker, Turn } from "../lib/types";
import { Mic, type MicState } from "../lib/mic";
import type { Player } from "../lib/player";
import { demoVoice, setPlayerBusyHandler, sharedPlayer, unlockAudio } from "../lib/audioSession";
import { PERSONAS } from "../data/personas";
import { halfDuplex } from "../lib/duplex";
import { mergeContext } from "../lib/contextMerge";
import * as api from "../lib/api";
import { recordForContext, sttTerms } from "../lib/record";
import { isCached, loadTrip, rememberMentions, saveEquivalents, uniqueEquivalents, type Settings } from "../lib/store";
import { dir, langName } from "../lib/langs";
import { TurnBlock, IdleHero } from "./Stage";
import ContextTiles from "./ContextDock";
import Orb from "./Orb";
import DrugSheet from "./DrugSheet";
import RecordSheet from "./RecordSheet";
import ContextSheet from "./ContextSheet";
import { Sheet } from "./bits";
import Icon from "./Icon";
import Flag from "./Flag";

type Props = {
  persona: Persona;
  settings: Settings;
  setSettings: (f: (s: Settings) => Settings) => void;
  onBack: () => void;
  /** Bumped by the app (D key / "Watch the demo") to start the recorded demo. */
  demoRequest: number;
};

type Line = { text: string; lang: string; voice: string } | null;
type DemoLine = {
  speaker: Speaker;
  audio: string;
  audioMs: number;
  speech: string;
  stt: { text: string; ms?: number };
  interpret: api.InterpretResult;
  context: api.ContextResult["items"];
};

const uid = () => Math.random().toString(36).slice(2, 10);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Conversation({ persona, settings, setSettings, onBack, demoRequest }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [ctx, setCtx] = useState<ContextItem[]>([]);
  const [micState, setMicState] = useState<MicState>("off");
  const [level, setLevel] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [micError, setMicError] = useState("");
  const [forced, setForced] = useState<Speaker | null>(null);
  const [drug, setDrug] = useState<{ d: DrugMention; speaker: Speaker | null } | null>(null);
  const [openCtx, setOpenCtx] = useState<ContextItem | null>(null);
  const [sheet, setSheet] = useState<"none" | "menu" | "record">("none");
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState<ContextItem | null>(null);
  const [demo, setDemo] = useState<"off" | "loading" | "voice" | "working">("off");

  const pair = useMemo<api.Pair>(
    () => ({ patientLang: persona.language, doctorLang: persona.trip.doctorLanguage, home: persona.home, local: persona.trip.country }),
    [persona],
  );
  const terms = useMemo(() => sttTerms(persona), [persona]);
  const record = useMemo(() => recordForContext(persona), [persona]);

  // Refs so the long-lived mic/player callbacks always see current values.
  const turnsRef = useRef<Turn[]>([]);
  turnsRef.current = turns;
  const ctxRef = useRef<ContextItem[]>([]);
  ctxRef.current = ctx;
  const forcedRef = useRef<Speaker | null>(null);
  forcedRef.current = forced;
  const pairRef = useRef(pair);
  pairRef.current = pair;
  const speakRef = useRef(settings.speak);
  speakRef.current = settings.speak;
  const speechChain = useRef<Promise<void>>(Promise.resolve());
  const stageRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const demoToken = useRef<{ cancelled: boolean } | null>(null);

  const patch = useCallback((id: string, p: Partial<Turn> | ((t: Turn) => Partial<Turn>)) => {
    setTurns((all) => all.map((t) => (t.id === id ? { ...t, ...(typeof p === "function" ? p(t) : p) } : t)));
  }, []);

  const playerRef = useRef<Player | null>(null);
  const micRef = useRef<Mic | null>(null);
  const duplexRef = useRef<ReturnType<typeof halfDuplex> | null>(null);
  const alive = useRef(true);
  // Bumped when the demo starts or a new conversation begins: work started before that drops itself.
  const epoch = useRef(0);
  const fresh = (e: number) => alive.current && epoch.current === e;
  const onPlayerBusy = useRef((busy: boolean) => {
    setSpeaking(busy);
    duplexRef.current?.onBusy(busy);
  }).current;
  if (!playerRef.current) {
    duplexRef.current = halfDuplex(() => micRef.current);
    playerRef.current = sharedPlayer();
  }
  // The player's busy handler is registered in the mount effect below, on every mount: React's dev double-mount
  // runs the unmount cleanup in between, and a cleared handler means the mic keeps listening while the phone speaks.

  /** Take a place in the speaking queue now (when the person stops talking), fill it in when the translation lands. */
  const reserveSpeech = () => {
    const e = epoch.current;
    let release: (v: Line) => void = () => {};
    const ready = new Promise<Line>((r) => (release = r));
    speechChain.current = speechChain.current.then(async () => {
      const line = await ready;
      if (line && speakRef.current && fresh(e)) await playerRef.current!.say(line.text, line.lang, line.voice);
    });
    return release;
  };

  const history = () =>
    turnsRef.current
      .filter((t) => t.status === "done" && t.speaker)
      .slice(-4)
      .map((t) => ({ speaker: t.speaker as string, text: t.cleaned }));

  const addContext = useCallback((turnId: string, items: api.ContextResult["items"], said = "") => {
    if (!items.length) return;
    const cur = ctxRef.current;
    const { next, flash: newAlert } = mergeContext(cur, items, turnId, Date.now(), said);
    setCtx(next);
    if (newAlert) {
      setToast(newAlert);
      navigator.vibrate?.([70, 50, 70]);
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), 5200);
    }
  }, []);

  /** Runs one utterance (already transcribed, or typed) through interpretation, context and speech. */
  const runText = useCallback(
    async (turnId: string, text: string, forcedSpeaker: Speaker | null, release: (v: Line) => void, opts: { context: boolean }) => {
      const p = pairRef.current;
      const e = epoch.current;
      const hist = history();
      const trip = loadTrip(p.home, p.local);
      const t0 = performance.now();
      if (opts.context) {
        api
          .context({
            text,
            speaker: forcedSpeaker || "unknown (patient or clinician)",
            record,
            doctorLang: p.doctorLang,
            local: p.local,
            history: hist,
            shown: ctxRef.current.map((c) => c.id),
          })
          .then((r) => fresh(e) && addContext(turnId, r.items, text))
          .catch((e) => console.warn("context failed", e));
      }
      try {
        const r = await api.interpret({
          ...p,
          text,
          forced: forcedSpeaker,
          meds: persona.medications.map(({ id, name, generic, dose, schedule }) => ({ id, name, generic, dose, schedule })),
          equivalents: uniqueEquivalents(trip).slice(0, 30),
          history: hist,
        });
        if (!fresh(e)) {
          release(null);
          return;
        }
        if (r.empty) {
          setTurns((all) => all.filter((t) => t.id !== turnId));
          release(null);
          return;
        }
        const drugs = r.drugs.map((d) => ({ ...d, cached: isCached(trip, d) }));
        rememberMentions(p.home, p.local, r.drugs);
        patch(turnId, (t) => ({
          status: "done",
          raw: t.raw || r.raw,
          cleaned: r.cleaned,
          translation: r.translation,
          language: r.language,
          speaker: r.speaker,
          listenerLang: r.listenerLang,
          drugs,
          timings: { ...t.timings, llm: r.ms, total: Math.round((t.timings.total || 0) + performance.now() - t0) },
        }));
        release({ text: r.translation, lang: r.listenerLang, voice: r.speaker === "patient" ? "coral" : "sage" });
      } catch (err) {
        if (fresh(e)) patch(turnId, { status: "error", error: (err as Error).message });
        release(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addContext, patch, persona.medications, record],
  );

  /* ---------------------------------------------------------------- live captions */

  // Mic segment id → turn id, so captions shown while someone talks become that utterance's turn.
  const segTurns = useRef(new Map<number, string>());
  const segFinal = useRef(new Set<number>());
  const segInFlight = useRef(new Set<number>());

  const newTurn = (status: Turn["status"], forcedNow: Speaker | null, raw = ""): string => {
    const id = uid();
    setTurns((all) => [
      ...all,
      { id, at: Date.now(), status, raw, cleaned: "", translation: "", language: "", speaker: forcedNow, listenerLang: "", forced: forcedNow, drugs: [], timings: {} },
    ]);
    return id;
  };

  const onPartial = useCallback(
    async (seg: number, wav: Blob) => {
      // One caption request per utterance at a time; drop snapshots while one is out.
      if (segInFlight.current.has(seg) || segFinal.current.has(seg)) return;
      const e = epoch.current;
      segInFlight.current.add(seg);
      try {
        const r = await api.transcribe(wav, pairRef.current, terms, { fast: true });
        if (!r.text || segFinal.current.has(seg) || !fresh(e)) return;
        const existing = segTurns.current.get(seg);
        if (existing) patch(existing, (t) => (t.status === "live" ? { raw: r.text } : {}));
        else segTurns.current.set(seg, newTurn("live", forcedRef.current, r.text));
      } catch {
        /* captions are best effort */
      } finally {
        segInFlight.current.delete(seg);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patch, terms],
  );

  const onDiscard = useCallback((seg: number) => {
    const id = segTurns.current.get(seg);
    segFinal.current.add(seg);
    if (id) setTurns((all) => all.filter((t) => !(t.id === id && t.status === "live")));
  }, []);

  const onUtterance = useCallback(
    async (wav: Blob, _ms?: number, seg?: number) => {
      const forcedNow = forcedRef.current;
      const t0 = performance.now();
      const e = epoch.current;
      let id = seg !== undefined ? segTurns.current.get(seg) : undefined;
      if (seg !== undefined) segFinal.current.add(seg);
      if (id) patch(id, { status: "transcribing" });
      else id = newTurn("transcribing", forcedNow);
      // Speak translations in the order people talked, even if a later one finishes first.
      const release = reserveSpeech();
      try {
        const stt = await api.transcribe(wav, pairRef.current, terms);
        if (!fresh(e)) {
          release(null);
          return;
        }
        if (!stt.text) {
          setTurns((all) => all.filter((t) => t.id !== id));
          release(null);
          return;
        }
        patch(id, { raw: stt.text, status: "interpreting", timings: { stt: stt.ms, total: Math.round(performance.now() - t0) } });
        await runText(id, stt.text, forcedNow, release, { context: true });
      } catch (err) {
        if (fresh(e)) patch(id, { status: "error", error: (err as Error).message });
        release(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patch, runText, terms],
  );

  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;
  const onPartialRef = useRef(onPartial);
  onPartialRef.current = onPartial;
  if (!micRef.current) {
    micRef.current = new Mic({
      onState: setMicState,
      onLevel: setLevel,
      onUtterance: (wav, ms, seg) => void onUtteranceRef.current(wav, ms, seg),
      onPartial: (seg, wav) => void onPartialRef.current(seg, wav),
      onDiscard: (seg) => onDiscard(seg),
      onError: setMicError,
    });
    micRef.current.mode = settings.mode;
  }

  useEffect(() => {
    micRef.current!.setMode(settings.mode);
  }, [settings.mode]);

  useEffect(() => {
    playerRef.current!.enabled = settings.speak;
    if (!settings.speak) playerRef.current!.stop();
  }, [settings.speak]);

  useEffect(() => {
    alive.current = true;
    setPlayerBusyHandler(onPlayerBusy);
    return () => {
      // Translations still in flight must not start talking on the home screen.
      alive.current = false;
      if (demoToken.current) demoToken.current.cancelled = true;
      duplexRef.current?.cancel();
      window.clearTimeout(toastTimer.current);
      micRef.current?.stop();
      playerRef.current?.stop();
      setPlayerBusyHandler(() => {});
      demoVoice().el.pause();
    };
  }, []);

  // Keep the screen awake while the conversation is open.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const get = () => navigator.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    void get();
    const vis = () => document.visibilityState === "visible" && void get();
    document.addEventListener("visibilitychange", vis);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      lock?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns]);
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => el.scrollTo({ top: el.scrollHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---------------------------------------------------------------- recorded demo */

  /** Play one recorded voice clip, driving the orb from its real loudness. */
  const playVoice = (url: string, token: { cancelled: boolean }, onProgress?: (fraction: number) => void) =>
    new Promise<void>((resolve) => {
      const { el, meter } = demoVoice();
      void meter?.ctx.resume().catch(() => {});
      const buf = new Float32Array(1024);
      let raf = 0;
      const tick = () => {
        if (meter) {
          meter.analyser.getFloatTimeDomainData(buf);
          let s = 0;
          for (const v of buf) s += v * v;
          const rms = Math.sqrt(s / buf.length);
          setLevel(Math.min(1, Math.max(0, (20 * Math.log10(rms + 1e-9) + 62) / 46)));
        } else setLevel(0.35 + Math.random() * 0.4);
        if (onProgress && el.duration > 0) onProgress(el.currentTime / el.duration);
        raf = requestAnimationFrame(tick);
      };
      const done = () => {
        cancelAnimationFrame(raf);
        setLevel(0);
        el.onended = el.onerror = null;
        resolve();
      };
      el.onended = done;
      el.onerror = done;
      el.src = url;
      el.play().then(() => (raf = requestAnimationFrame(tick)), done);
      const guard = setInterval(() => {
        if (token.cancelled) {
          clearInterval(guard);
          el.pause();
          done();
        }
      }, 100);
      el.addEventListener("ended", () => clearInterval(guard), { once: true });
    });

  const stopDemo = useCallback(() => {
    if (demoToken.current) demoToken.current.cancelled = true;
    demoToken.current = null;
    demoVoice().el.pause();
    playerRef.current?.stop();
    setLevel(0);
    setDemo("off");
  }, []);

  /** Forget the current conversation. Anything still in flight from it is ignored when it lands. */
  const resetConversation = () => {
    epoch.current++;
    segTurns.current.clear();
    segFinal.current.clear();
    segInFlight.current.clear();
    speechChain.current = Promise.resolve();
    playerRef.current!.stop();
    setTurns([]);
    setCtx([]);
    setToast(null);
    setDrug(null);
    setOpenCtx(null);
  };

  const runDemo = useCallback(async () => {
    stopDemo();
    const token = { cancelled: false };
    demoToken.current = token;
    // "loading" right away, so a tap or Space during the fetch stops the demo instead of starting the mic.
    setDemo("loading");
    micRef.current?.stop();
    resetConversation();
    setTyping(false);
    setSheet("none");
    setMicError("");
    let data: { equivalents: Equivalent[]; lines: DemoLine[] };
    try {
      const r = await fetch(`/demo/${persona.id}.json`);
      if (!r.ok) throw new Error();
      data = await r.json();
    } catch {
      if (demoToken.current === token) {
        demoToken.current = null;
        setDemo("off");
        setMicError(`No recorded demo for ${persona.name}.`);
      }
      return;
    }
    if (token.cancelled) return;
    playerRef.current!.enabled = true;
    // The recording was made for the persona's own language pair; file its medicine names there.
    const base = PERSONAS.find((p) => p.id === persona.id) || persona;
    saveEquivalents(base.home, base.trip.country, data.equivalents);
    const trip = loadTrip(base.home, base.trip.country);
    await sleep(700);
    for (const line of data.lines) {
      if (token.cancelled) break;
      const id = uid();
      setTurns((all) => [
        ...all,
        { id, at: Date.now(), status: "live", raw: "", cleaned: "", translation: "", language: "", speaker: line.speaker, listenerLang: "", forced: null, drugs: [], timings: {} },
      ]);
      setDemo("voice");
      // Live captions: words appear in step with the recording, trailing it slightly like real captions do.
      // Spaced languages reveal by word; Japanese/Chinese (no spaces) by character.
      const words = /\s/.test(line.stt.text) ? line.stt.text.split(/(\s+)/) : [...line.stt.text];
      const wordCount = words.filter((w) => w.trim()).length;
      let shownWords = 0;
      await playVoice(line.audio, token, (f) => {
        const n = Math.max(0, Math.floor((f - 0.08) * wordCount * 1.05));
        if (n <= shownWords) return;
        shownWords = Math.min(n, wordCount);
        let seen = 0;
        const partial = words.filter((w) => (w.trim() ? ++seen <= shownWords : seen < shownWords)).join("");
        patch(id, { raw: partial });
      });
      if (token.cancelled) break;
      setDemo("working");
      patch(id, { raw: line.stt.text, status: "transcribing" });
      await sleep(450);
      if (token.cancelled) break;
      patch(id, { raw: line.stt.text, status: "interpreting" });
      await sleep(Math.min(1400, 500 + line.stt.text.length * 9));
      if (token.cancelled) break;
      const r = line.interpret;
      patch(id, {
        status: "done",
        cleaned: r.cleaned,
        translation: r.translation,
        language: r.language,
        speaker: r.speaker,
        listenerLang: r.listenerLang,
        drugs: r.drugs.map((d) => ({ ...d, cached: isCached(trip, d) })),
        timings: { total: (line.stt.ms || 500) + r.ms },
      });
      window.setTimeout(() => !token.cancelled && addContext(id, line.context, line.interpret.cleaned), 900);
      await sleep(500);
      // Stopped while the words were landing: don't start this line's speech after the stop.
      if (token.cancelled) break;
      if (speakRef.current) await playerRef.current!.play(line.speech);
      else await sleep(2600);
      if (token.cancelled) break;
      await sleep(1100);
    }
    if (demoToken.current === token) {
      demoToken.current = null;
      setDemo("off");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addContext, patch, persona, stopDemo]);

  useEffect(() => {
    if (demoRequest > 0) void runDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoRequest]);

  /* ---------------------------------------------------------------- the orb */

  const mic = micRef.current!;
  const muted = mic.isPaused("muted");
  const busy = turns.some((t) => t.status === "transcribing" || t.status === "interpreting");

  const orbTap = async () => {
    setMicError("");
    if (demo !== "off" || demoToken.current) return stopDemo();
    if (micState === "off" || micState === "error") {
      unlockAudio();
      await mic.start();
      return;
    }
    if (speaking) return playerRef.current!.stop();
    if (muted) return mic.resume("muted");
    if (settings.mode === "push") return micState === "speech" ? mic.endPush() : mic.beginPush();
    if (micState === "speech") mic.flush();
    else mic.pause("muted");
  };

  const orbLabel = (() => {
    // The demo reads exactly like a real conversation.
    if (demo === "voice") return "Hearing you…";
    if (demo === "loading") return "Listening";
    if (demo === "working") return speaking ? "Speaking · tap to skip" : "Translating…";
    if (micState === "off") return "Tap to start listening";
    if (micState === "starting") return "Starting the mic…";
    if (micState === "error") return "Mic problem · tap to retry";
    if (speaking) return "Speaking · tap to skip";
    if (muted) return "Paused · tap to listen";
    if (settings.mode === "push") return micState === "speech" ? "Recording · tap to send" : "Tap, then talk";
    if (micState === "speech") return "Hearing you…";
    if (busy) return "Translating…";
    return "Listening";
  })();

  const orbMode = demo === "voice" ? "speech" : demo === "working" || demo === "loading" ? (speaking ? "speaking" : "busy") : speaking ? "speaking" : muted ? "muted" : micState === "speech" ? "speech" : busy ? "busy" : micState;

  // Keyboard: D = demo, Space = the orb, Esc = stop the demo.
  const orbTapRef = useRef(orbTap);
  orbTapRef.current = orbTap;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA")) return;
      if (e.key === " ") {
        e.preventDefault();
        void orbTapRef.current();
      } else if (e.key === "Escape") stopDemo();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [stopDemo]);

  const sendTyped = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    unlockAudio();
    const id = uid();
    setTurns((all) => [
      ...all,
      { id, at: Date.now(), status: "interpreting", raw: text, cleaned: "", translation: "", language: "", speaker: forced, listenerLang: "", forced, drugs: [], timings: {} },
    ]);
    void runText(id, text, forced, reserveSpeech(), { context: true });
  };

  const flipSpeaker = (t: Turn) => {
    const next: Speaker = t.speaker === "patient" ? "clinician" : "patient";
    patch(t.id, { status: "interpreting", forced: next, speaker: next });
    void runText(t.id, t.raw, next, reserveSpeech(), { context: false });
  };

  const replay = (t: Turn) => {
    if (!t.translation) return;
    unlockAudio();
    playerRef.current!.enabled = true;
    void playerRef.current!.say(t.translation, t.listenerLang, t.speaker === "patient" ? "coral" : "sage").then(() => {
      playerRef.current!.enabled = speakRef.current;
    });
  };

  const newConversation = () => {
    stopDemo();
    resetConversation();
    setSheet("none");
  };


  const live = micState === "listening" || micState === "speech";
  const lastSpeaker = [...turns].reverse().find((t) => t.speaker)?.speaker;
  // The latest finished turn stays large while the next person's live caption builds below it.
  const lastDone = turns.map((t) => t.status).lastIndexOf("done");
  const mood = toast ? "alert" : lastSpeaker || "idle";
  const first = persona.name.split(" ")[0];

  return (
    <main className="talk" data-mood={mood}>
      <div className="backdrop" aria-hidden>
        <span className="tint patient" />
        <span className="tint clinician" />
        <span className="tint alert" />
      </div>

      <header className="talk-bar panel">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <Icon name="back" />
        </button>
        <button className="talk-title" onClick={() => setSheet("record")}>
          <strong>{persona.name}</strong>
          <span>
            <Flag code={persona.home} size={20} className="pt" /> {langName(persona.language)}
            <span className="sep">↔</span>
            <Flag code={persona.trip.country} size={20} className="dr" /> {langName(persona.trip.doctorLanguage)}
          </span>
        </button>
        <button className="icon-btn" onClick={() => setSheet("menu")} aria-label="Options">
          <Icon name="more" />
        </button>
      </header>


      <div className="transcript" ref={stageRef}>
        {turns.length === 0 ? (
          <IdleHero persona={persona} live={live} />
        ) : (
          turns.map((t, i) => (
            <TurnBlock
              key={t.id}
              turn={t}
              persona={persona}
              current={i === lastDone || (i === turns.length - 1 && t.status !== "done")}
              onDrug={(d) => setDrug({ d, speaker: t.speaker })}
              onFlip={() => flipSpeaker(t)}
              onReplay={() => replay(t)}
            />
          ))
        )}
      </div>

      <div className="bottom">
        <footer className="controls panel">
          {/* The record lives inside the bottom bar: one panel, so the translation keeps the screen. */}
          <ContextTiles items={ctx} persona={persona} flashId={toast?.id} onOpen={setOpenCtx} onOpenRecord={() => setSheet("record")} />
          {micError && <div className="mic-error">{micError}</div>}
          {typing && (
            <form
              className="typer"
              onSubmit={(e) => {
                e.preventDefault();
                sendTyped();
              }}
            >
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type what was said"
                aria-label="Type an utterance"
                dir={dir(forced === "clinician" ? persona.trip.doctorLanguage : persona.language)}
              />
              <button className="send" type="submit" disabled={!draft.trim()} aria-label="Send">
                <Icon name="chevron" size={18} />
              </button>
            </form>
          )}
          <div className="control-row">
            <button className={`tool ${typing ? "on" : ""}`} onClick={() => setTyping((v) => !v)} aria-label="Type instead">
              <span className="tool-icon">
                <Icon name="keyboard" />
              </span>
              <span className="tool-label">Type</span>
            </button>
            <div className="mic-wrap">
              <Orb mode={orbMode} level={level} onTap={orbTap} label={orbLabel} />
            </div>
            <button
              className={`tool ${settings.speak ? "" : "off"}`}
              onClick={() => setSettings((s) => ({ ...s, speak: !s.speak }))}
              aria-label={settings.speak ? "Mute spoken translation" : "Speak translations aloud"}
            >
              <span className="tool-icon">
                <Icon name={settings.speak ? "speaker" : "mute"} />
              </span>
              <span className="tool-label">{settings.speak ? "Voice on" : "Voice off"}</span>
            </button>
          </div>
          <div className="orb-label" aria-live="polite">
            {orbLabel}
            {forced && demo === "off" && <span className="forced"> · {forced === "patient" ? first : "clinician"}</span>}
          </div>
        </footer>
      </div>

      {sheet === "menu" && (
        <Sheet title="Options" onClose={() => setSheet("none")}>
          <div className="group">
            <div className="group-title">Who is speaking</div>
            <div className="seg">
              {([null, "patient", "clinician"] as const).map((s) => (
                <button key={s || "auto"} className={forced === s ? "on" : ""} onClick={() => setForced(s)}>
                  {s === null ? "Detect" : s === "patient" ? first : "Clinician"}
                </button>
              ))}
            </div>
          </div>
          <div className="group">
            <div className="group-title">Microphone</div>
            <div className="seg">
              <button className={settings.mode === "auto" ? "on" : ""} onClick={() => setSettings((s) => ({ ...s, mode: "auto" }))}>
                Hands-free
              </button>
              <button className={settings.mode === "push" ? "on" : ""} onClick={() => setSettings((s) => ({ ...s, mode: "push" }))}>
                Tap to talk
              </button>
            </div>
          </div>
          <div className="group">
            <button className="row" onClick={() => void runDemo()}>
              <Icon name="play" />
              <span className="row-main">
                <strong>Play demo conversation</strong>
              </span>
              <kbd>D</kbd>
            </button>
            <button className="row" onClick={() => setSheet("record")}>
              <Icon name="doc" />
              <span className="row-main">
                <strong>{first}'s health record</strong>
              </span>
              <Icon name="chevron" size={16} className="muted" />
            </button>
            <button className="row" onClick={newConversation}>
              <Icon name="refresh" />
              <span className="row-main">
                <strong>New conversation</strong>
              </span>
            </button>
          </div>
          <p className="fine">Space starts and pauses the microphone. Esc stops the demo.</p>
        </Sheet>
      )}
      {drug && <DrugSheet drug={drug.d} speaker={drug.speaker} persona={persona} onClose={() => setDrug(null)} />}
      {openCtx && <ContextSheet item={openCtx} persona={persona} onClose={() => setOpenCtx(null)} />}
      {sheet === "record" && <RecordSheet persona={persona} onClose={() => setSheet("none")} />}
    </main>
  );
}
