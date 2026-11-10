import { useEffect, useState } from "react";
import type { DrugMention, Persona, Turn } from "../lib/types";
import { dir, langNative } from "../lib/langs";
import { Reveal, StatusBadge, swapLabel } from "./bits";

const SPEAK: Record<string, string> = {
  es: "Hable.", en: "Speak.", ja: "話してください。", fr: "Parlez.", de: "Sprechen Sie.", it: "Parli.", pt: "Fale.",
  zh: "请说。", ko: "말씀하세요.", hi: "बोलिए।", ur: "بولیے۔", ar: "تكلم.", vi: "Hãy nói.", ru: "Говорите.",
  tl: "Magsalita.", tr: "Konuşun.", fa: "صحبت کنید.",
};

/** Before anyone talks: "Hable. / Speak." trading places, big. */
export function IdleHero({ persona, live }: { persona: Persona; live: boolean }) {
  const langs = [persona.language, persona.trip.doctorLanguage];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => n + 1), 2200);
    return () => clearInterval(t);
  }, []);
  const lang = langs[i % 2];
  return (
    <div className="idle">
      <div className="idle-word" key={i} lang={lang} dir={dir(lang)} data-who={i % 2 ? "clinician" : "patient"}>
        {SPEAK[lang] || "Speak."}
      </div>
      <p className="idle-sub">
        {live ? "Listening. " : ""}Either of you can talk. It knows who from the language, and the doctor sees what matters from {persona.name.split(" ")[0]}'s record.
      </p>
    </div>
  );
}

function sizeFor(text: string) {
  // A CJK character takes about two Latin letters of width.
  const n = [...text].reduce((w, ch) => w + (/[　-鿿가-힯＀-￯]/.test(ch) ? 1.9 : 1), 0);
  if (n < 48) return "xl";
  if (n < 95) return "lg";
  if (n < 160) return "md";
  return "sm";
}

const normSpace = (s: string) => s.replace(/[\s.,!?¡¿;:"“”'’、。！？-]+/g, " ").trim().toLowerCase();

export function TurnView({
  turn: t,
  persona,
  onDrug,
  onFlip,
  onReplay,
}: {
  turn: Turn;
  persona: Persona;
  onDrug: (d: DrugMention) => void;
  onFlip: () => void;
  onReplay: () => void;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const who = t.speaker || t.forced;
  const spokenLang = t.language || (who === "clinician" ? persona.trip.doctorLanguage : who === "patient" ? persona.language : "");
  const listenerLang = t.listenerLang || (who === "clinician" ? persona.language : persona.trip.doctorLanguage);
  // In the speaker's own words, drug names turn into what the listener's side calls them.
  const swapToward = who === "clinician" ? "home" : "local";
  const cleanedDiffers = t.status === "done" && t.raw && normSpace(t.cleaned) !== normSpace(t.raw);
  const whoLabel = who === "clinician" ? "Doctor" : who === "patient" ? persona.name.split(" ")[0] : "Listening";

  return (
    <article className={`turn ${who || "unknown"} ${t.status}`}>
      <div className="turn-label">
        <button className="who-pill" onClick={t.status === "done" ? onFlip : undefined} title={t.status === "done" ? "Wrong person? Tap to swap" : undefined}>
          <span className="dot" />
          {whoLabel}
          {spokenLang && <span className="lang"> · {langNative(spokenLang)}</span>}
        </button>
        {t.status === "done" && t.timings.total ? <span className="timing">{(t.timings.total / 1000).toFixed(1)}s</span> : null}
      </div>

      {t.status === "transcribing" && (
        <div className="hearing" aria-label="Hearing">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />
          ))}
        </div>
      )}

      {t.raw && t.status !== "done" && t.status !== "error" && (
        <p className="said raw-live" dir={dir(spokenLang)} lang={spokenLang}>
          <Reveal text={t.raw} lang={spokenLang} step={60} />
        </p>
      )}

      {t.status === "interpreting" && (
        <div className="translating">
          <span className="shimmer-bar" />
          <span className="shimmer-bar short" />
        </div>
      )}

      {t.status === "done" && (
        <>
          <p className="said" dir={dir(spokenLang)} lang={spokenLang}>
            <Reveal key={t.cleaned} text={t.cleaned} lang={spokenLang} drugs={t.drugs} field="mentioned" swap={swapToward} onDrug={onDrug} step={45} budget={900} />
          </p>
          {cleanedDiffers && (
            <button className="cleaned-tag" onClick={() => setShowRaw((v) => !v)}>
              ✦ cleaned up{showRaw ? "" : " · see what was said"}
            </button>
          )}
          {showRaw && (
            <p className="raw" dir={dir(spokenLang)}>
              {t.raw}
            </p>
          )}
          <div className="to-line">
            <span className="to-arrow" />
            <span className="to-lang">{langNative(listenerLang)}</span>
            <button className="replay" onClick={onReplay} aria-label="Say it again">
              ▶
            </button>
          </div>
          <div className={`translation ${sizeFor(t.translation)}`} dir={dir(listenerLang)} lang={listenerLang}>
            <p>
              <Reveal key={t.translation} text={t.translation} lang={listenerLang} drugs={t.drugs} field="translated" onDrug={onDrug} start={500} step={95} budget={2200} />
            </p>
          </div>
          {t.drugs.length > 0 && (
            <div className="drug-chips">
              {t.drugs.map((d, i) => (
                <button key={d.key} className={`drug-chip ${d.status}`} onClick={() => onDrug(d)} style={{ animationDelay: `${1600 + i * 140}ms` }}>
                  <StatusBadge status={d.status} compact />
                  <span className="chip-from">{d.mentioned || d.home_name}</span>
                  <span aria-hidden>→</span>
                  <strong>{d.status === "not_available_locally" && who !== "clinician" ? "not sold here" : swapLabel(d, swapToward)}</strong>
                  {d.cached && (
                    <span className="saved" title="Saved on this phone">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {t.status === "error" && (
        <p className="error-text">
          Couldn't translate that. <small>{t.error}</small>
        </p>
      )}
    </article>
  );
}

/** An earlier turn, shrunk to one line of its translation. */
export function HistoryLine({ turn: t }: { turn: Turn }) {
  if (t.status !== "done") return null;
  return (
    <div className={`history-line ${t.speaker}`} dir={dir(t.listenerLang)}>
      <span className="dot" />
      <span>{t.translation}</span>
    </div>
  );
}
