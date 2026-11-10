import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ContextItem, DrugMention, Equivalent, Persona, Speaker, Turn } from "../lib/types";
import { Mic, type MicState } from "../lib/mic";
import { Player } from "../lib/player";
import { halfDuplex } from "../lib/duplex";
import * as api from "../lib/api";
import { recordForContext, sttTerms } from "../lib/record";
import { isCached, loadTrip, rememberMentions, saveEquivalents, uniqueEquivalents, type Settings } from "../lib/store";
import { dir, langNative } from "../lib/langs";
import { TurnView, HistoryLine, IdleHero } from "./Stage";
import ContextDock, { AlertToast } from "./ContextDock";
import Orb from "./Orb";
import DrugSheet from "./DrugSheet";
import RecordSheet from "./RecordSheet";
import ContextSheet from "./ContextSheet";
import { Sheet } from "./bits";

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
  const [demo, setDemo] = useState<"off" | "voice" | "working">("off");

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
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const meterRef = useRef<{ ctx: AudioContext; analyser: AnalyserNode } | null>(null);

  const patch = useCallback((id: string, p: Partial<Turn> | ((t: Turn) => Partial<Turn>)) => {
    setTurns((all) => all.map((t) => (t.id === id ? { ...t, ...(typeof p === "function" ? p(t) : p) } : t)));
  }, []);

  const playerRef = useRef<Player | null>(null);
  const micRef = useRef<Mic | null>(null);
  const duplexRef = useRef<ReturnType<typeof halfDuplex> | null>(null);
  const alive = useRef(true);
  if (!playerRef.current) {
    duplexRef.current = halfDuplex(() => micRef.current);
    playerRef.current = new Player((busy) => {
      setSpeaking(busy);
      duplexRef.current!.onBusy(busy);
    });
  }

  /** Take a place in the speaking queue now (when the person stops talking), fill it in when the translation lands. */
  const reserveSpeech = () => {
    let release: (v: Line) => void = () => {};
    const ready = new Promise<Line>((r) => (release = r));
    speechChain.current = speechChain.current.then(async () => {
      const line = await ready;
      if (line && speakRef.current && alive.current) await playerRef.current!.say(line.text, line.lang, line.voice);
    });
    return release;
  };

  const history = () =>
    turnsRef.current
      .filter((t) => t.status === "done" && t.speaker)
      .slice(-4)
      .map((t) => ({ speaker: t.speaker as string, text: t.cleaned }));

  const addContext = useCallback((turnId: string, items: api.ContextResult["items"]) => {
    if (!items.length) return;
    const cur = ctxRef.current;
    const now = Date.now();
    const fresh = items.map((i, n) => {
      const prev = cur.find((c) => c.id === i.id);
      return { ...i, level: prev?.level === "alert" ? "alert" : i.level, turnId, at: now - n } as ContextItem;
    });
    const newAlert = fresh.find((f) => f.level === "alert" && cur.find((c) => c.id === f.id)?.level !== "alert");
    const ids = new Set(fresh.map((f) => f.id));
    setCtx([...fresh, ...cur.filter((c) => !ids.has(c.id))]);
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
          .then((r) => alive.current && addContext(turnId, r.items))
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
      } catch (e) {
        patch(turnId, { status: "error", error: (e as Error).message });
        release(null);
      }
    },
    [addContext, patch, persona.medications, record],
  );

  const onUtterance = useCallback(
    async (wav: Blob) => {
      const id = uid();
      const forcedNow = forcedRef.current;
      const t0 = performance.now();
      setTurns((all) => [
        ...all,
        { id, at: Date.now(), status: "transcribing", raw: "", cleaned: "", translation: "", language: "", speaker: forcedNow, listenerLang: "", forced: forcedNow, drugs: [], timings: {} },
      ]);
      // Speak translations in the order people talked, even if a later one finishes first.
      const release = reserveSpeech();
      try {
        const stt = await api.transcribe(wav, pairRef.current, terms);
        if (!stt.text) {
          setTurns((all) => all.filter((t) => t.id !== id));
          release(null);
          return;
        }
        patch(id, { raw: stt.text, status: "interpreting", timings: { stt: stt.ms, total: Math.round(performance.now() - t0) } });
        await runText(id, stt.text, forcedNow, release, { context: true });
      } catch (e) {
        patch(id, { status: "error", error: (e as Error).message });
        release(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patch, runText, terms],
  );

  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;
  if (!micRef.current) {
    micRef.current = new Mic({
      onState: setMicState,
      onLevel: setLevel,
      onUtterance: (wav) => void onUtteranceRef.current(wav),
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
    return () => {
      // Translations still in flight must not start talking on the home screen.
      alive.current = false;
      if (demoToken.current) demoToken.current.cancelled = true;
      duplexRef.current?.cancel();
      window.clearTimeout(toastTimer.current);
      micRef.current?.stop();
      playerRef.current?.stop();
      voiceRef.current?.pause();
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

  /* ---------------------------------------------------------------- recorded demo */

  /** Play one recorded voice clip, driving the orb from its real loudness. */
  const playVoice = (url: string, token: { cancelled: boolean }) =>
    new Promise<void>((resolve) => {
      if (!voiceRef.current) {
        voiceRef.current = new Audio();
        voiceRef.current.setAttribute("playsinline", "");
        try {
          const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const ctx = new AC();
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          ctx.createMediaElementSource(voiceRef.current).connect(analyser).connect(ctx.destination);
          meterRef.current = { ctx, analyser };
        } catch {
          meterRef.current = null;
        }
      }
      const el = voiceRef.current;
      void meterRef.current?.ctx.resume();
      const buf = new Float32Array(1024);
      let raf = 0;
      const tick = () => {
        if (meterRef.current) {
          meterRef.current.analyser.getFloatTimeDomainData(buf);
          let s = 0;
          for (const v of buf) s += v * v;
          const rms = Math.sqrt(s / buf.length);
          setLevel(Math.min(1, Math.max(0, (20 * Math.log10(rms + 1e-9) + 62) / 46)));
        } else setLevel(0.35 + Math.random() * 0.4);
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
    voiceRef.current?.pause();
    playerRef.current?.stop();
    setLevel(0);
    setDemo("off");
  }, []);

  const runDemo = useCallback(async () => {
    stopDemo();
    micRef.current?.stop();
    setTyping(false);
    setSheet("none");
    setMicError("");
    const token = { cancelled: false };
    demoToken.current = token;
    let data: { equivalents: Equivalent[]; lines: DemoLine[] };
    try {
      const r = await fetch(`/demo/${persona.id}.json`);
      if (!r.ok) throw new Error();
      data = await r.json();
    } catch {
      setMicError(`No recorded demo for ${persona.name}.`);
      return;
    }
    setTurns([]);
    setCtx([]);
    setToast(null);
    playerRef.current!.enabled = true;
    saveEquivalents(persona.home, persona.trip.country, data.equivalents);
    const trip = loadTrip(persona.home, persona.trip.country);
    await sleep(700);
    for (const line of data.lines) {
      if (token.cancelled) break;
      const id = uid();
      setTurns((all) => [
        ...all,
        { id, at: Date.now(), status: "transcribing", raw: "", cleaned: "", translation: "", language: "", speaker: line.speaker, listenerLang: "", forced: null, drugs: [], timings: {} },
      ]);
      setDemo("voice");
      await playVoice(line.audio, token);
      if (token.cancelled) break;
      setDemo("working");
      await sleep(450);
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
      window.setTimeout(() => !token.cancelled && addContext(id, line.context), 900);
      await sleep(500);
      if (speakRef.current) await playerRef.current!.play(line.speech);
      else await sleep(2600);
      await sleep(1100);
    }
    if (demoToken.current === token) {
      demoToken.current = null;
      setDemo("off");
    }
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
    if (demo !== "off") return stopDemo();
    if (micState === "off" || micState === "error") {
      playerRef.current!.unlock();
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
    if (demo === "voice") return "Demo · listening";
    if (demo === "working") return speaking ? "Demo · speaking the translation" : "Demo · translating";
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

  const orbMode = demo === "voice" ? "speech" : demo === "working" ? (speaking ? "speaking" : "busy") : speaking ? "speaking" : muted ? "muted" : micState === "speech" ? "speech" : busy ? "busy" : micState;

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
    playerRef.current!.unlock();
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
    playerRef.current!.unlock();
    playerRef.current!.enabled = true;
    void playerRef.current!.say(t.translation, t.listenerLang, t.speaker === "patient" ? "coral" : "sage").then(() => {
      playerRef.current!.enabled = speakRef.current;
    });
  };

  const newConversation = () => {
    stopDemo();
    playerRef.current!.stop();
    setTurns([]);
    setCtx([]);
    setToast(null);
    setSheet("none");
  };

  const current = turns[turns.length - 1];
  const older = turns.slice(0, -1);
  const mood = toast ? "alert" : current?.speaker || (micState === "speech" || demo === "voice" ? "hearing" : "idle");
  const first = persona.name.split(" ")[0];

  return (
    <main className="talk" data-mood={mood}>
      <div className="aura" aria-hidden>
        <span className="aura-layer idle" />
        <span className="aura-layer patient" />
        <span className="aura-layer clinician" />
        <span className="aura-layer alert" />
        <span className="grain" />
      </div>

      <header className="talk-bar">
        <button className="icon-btn glass" onClick={onBack} aria-label="Back">
          ‹
        </button>
        <button className="who-chip" onClick={() => setSheet("record")}>
          <span className="avatar xs">{persona.initials}</span>
          <span className="who-name">{first}</span>
          <span className="who-langs">
            <b className="pt">{persona.language.toUpperCase()}</b>
            <i>⇄</i>
            <b className="dr">{persona.trip.doctorLanguage.toUpperCase()}</b>
          </span>
        </button>
        <button className="icon-btn glass" onClick={() => setSheet("menu")} aria-label="Options">
          ⋯
        </button>
      </header>

      {toast && <AlertToast item={toast} onOpen={() => setOpenCtx(toast)} onClose={() => setToast(null)} />}

      <div className="stage" ref={stageRef}>
        {older.length > 0 && (
          <div className="history">
            {older.slice(-6).map((t) => (
              <HistoryLine key={t.id} turn={t} />
            ))}
          </div>
        )}
        {current ? (
          <TurnView
            key={current.id}
            turn={current}
            persona={persona}
            onDrug={(d) => setDrug({ d, speaker: current.speaker })}
            onFlip={() => flipSpeaker(current)}
            onReplay={() => replay(current)}
          />
        ) : (
          <IdleHero persona={persona} live={micState === "listening" || micState === "speech"} />
        )}
      </div>

      <ContextDock items={ctx} persona={persona} onOpen={setOpenCtx} />

      <footer className="controls">
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
              placeholder="Type what was said…"
              aria-label="Type an utterance"
              dir={dir(forced === "clinician" ? persona.trip.doctorLanguage : persona.language)}
            />
            <button className="send" type="submit" disabled={!draft.trim()} aria-label="Send">
              ↑
            </button>
          </form>
        )}
        <Orb mode={orbMode} level={level} onTap={orbTap} label={orbLabel} />
        <div className="orb-label" aria-live="polite">
          {orbLabel}
          {forced && demo === "off" && <span className="forced"> · {forced === "patient" ? "patient" : "doctor"} talking</span>}
        </div>
      </footer>

      {sheet === "menu" && (
        <Sheet title="Options" onClose={() => setSheet("none")}>
          <div className="field">
            <div className="eyebrow">Who's talking</div>
            <div className="seg">
              {([null, "patient", "clinician"] as const).map((s) => (
                <button key={s || "auto"} className={forced === s ? "on" : ""} onClick={() => setForced(s)}>
                  {s === null ? "Auto-detect" : s === "patient" ? first : "Doctor"}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <div className="eyebrow">Listening</div>
            <div className="seg">
              <button className={settings.mode === "auto" ? "on" : ""} onClick={() => setSettings((s) => ({ ...s, mode: "auto" }))}>
                Hands-free
              </button>
              <button className={settings.mode === "push" ? "on" : ""} onClick={() => setSettings((s) => ({ ...s, mode: "push" }))}>
                Tap to talk
              </button>
            </div>
          </div>
          <div className="field">
            <div className="eyebrow">Read translations aloud</div>
            <div className="seg">
              <button className={settings.speak ? "on" : ""} onClick={() => setSettings((s) => ({ ...s, speak: true }))}>
                On
              </button>
              <button className={!settings.speak ? "on" : ""} onClick={() => setSettings((s) => ({ ...s, speak: false }))}>
                Off
              </button>
            </div>
          </div>
          <div className="menu-actions">
            <button
              onClick={() => {
                setTyping((v) => !v);
                setSheet("none");
              }}
            >
              ⌨ {typing ? "Hide keyboard" : "Type instead"}
            </button>
            <button onClick={() => void runDemo()}>▶ Play the demo</button>
            <button onClick={() => setSheet("record")}>▤ {first}'s record</button>
            <button onClick={newConversation}>↺ New conversation</button>
          </div>
          <p className="fine">
            {langNative(persona.language)} ⇄ {langNative(persona.trip.doctorLanguage)} · keys: Space = mic, D = demo, Esc = stop
          </p>
        </Sheet>
      )}
      {drug && <DrugSheet drug={drug.d} speaker={drug.speaker} persona={persona} onClose={() => setDrug(null)} />}
      {openCtx && <ContextSheet item={openCtx} persona={persona} onClose={() => setOpenCtx(null)} />}
      {sheet === "record" && <RecordSheet persona={persona} onClose={() => setSheet("none")} />}
    </main>
  );
}
