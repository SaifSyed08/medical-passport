import { useEffect, useRef, useState } from "react";
import type { DrugMention, Persona, Turn } from "../lib/types";
import { dir, langName } from "../lib/langs";
import { Reveal, StatusBadge, swapLabel } from "./bits";
import Icon from "./Icon";
import Flag from "./Flag";

const SPEAK_IN: Record<string, string> = {
  es: "Hable en español", en: "Speak in English", ja: "日本語で話してください", fr: "Parlez en français", de: "Sprechen Sie Deutsch",
  it: "Parli in italiano", pt: "Fale em português", zh: "请说中文", ko: "한국어로 말씀하세요", hi: "हिंदी में बोलिए", ur: "اردو میں بولیں",
  ar: "تحدث بالعربية", vi: "Hãy nói tiếng Việt", ru: "Говорите по-русски", tl: "Magsalita sa Tagalog", tr: "Türkçe konuşun", fa: "فارسی صحبت کنید",
};

/** Before anyone talks: two people in conversation (an illustration, not a button), one line per language. */
export function IdleHero({ persona, live }: { persona: Persona; live: boolean }) {
  return (
    <div className={`idle ${live ? "live" : ""}`}>
      <div className="talkers" aria-hidden>
        <Person side="patient" code={persona.home} />
        <Person side="clinician" code={persona.trip.country} />
      </div>
      <p className="idle-line patient" lang={persona.language} dir={dir(persona.language)}>
        {SPEAK_IN[persona.language] || "Speak"}
      </p>
      <p className="idle-line clinician" lang={persona.trip.doctorLanguage} dir={dir(persona.trip.doctorLanguage)}>
        {SPEAK_IN[persona.trip.doctorLanguage] || "Speak"}
      </p>
      <p className="idle-hint">
        {live ? (
          "Listening. Go ahead."
        ) : (
          <>
            Tap the microphone below to begin
            <span className="hint-arrow">
              <Icon name="chevron" size={18} />
            </span>
          </>
        )}
      </p>
    </div>
  );
}

function Person({ side, code }: { side: "patient" | "clinician"; code: string }) {
  return (
    <div className={`person ${side}`}>
      <div className="bubble">
        <Flag code={code} size={22} />
        <span className="typing">
          <i />
          <i />
          <i />
        </span>
      </div>
      <svg viewBox="0 0 80 84" className="figure">
        <circle cx="40" cy="24" r="16" />
        <path d="M8 84c0-24 14-36 32-36s32 12 32 36z" />
      </svg>
    </div>
  );
}

/**
 * Live caption: new words drift in softly as the recogniser catches up (no dictation caret),
 * and a small voice wave trails the text while the person is still talking.
 */
function LiveCaption({ text, lang }: { text: string; lang: string }) {
  const words = text ? (/\s/.test(text) ? text.split(/(\s+)/) : [...text]) : [];
  const prev = useRef(0);
  const firstNew = Math.min(prev.current, words.length);
  useEffect(() => {
    prev.current = words.length;
  });
  let n = 0;
  return (
    <p className="live-text" dir={dir(lang)} lang={lang}>
      {words.map((w, i) => {
        if (/^\s+$/.test(w)) return w;
        const isNew = i >= firstNew;
        const delay = isNew ? n++ * 70 : 0;
        return (
          <span key={`${i}:${w}`} className={isNew ? "cw new" : "cw"} style={isNew ? { animationDelay: `${delay}ms` } : undefined}>
            {w}
          </span>
        );
      })}
      <span className="voice-wave" aria-hidden>
        <i />
        <i />
        <i />
        <i />
      </span>
    </p>
  );
}

function sizeFor(text: string) {
  // A CJK character takes about two Latin letters of width.
  const n = [...text].reduce((w, ch) => w + (/[　-鿿가-힯＀-￯]/.test(ch) ? 1.9 : 1), 0);
  if (n < 60) return "lg";
  if (n < 130) return "md";
  return "sm";
}

const normSpace = (s: string) => s.replace(/[\s.,!?¡¿;:"“”'’、。！？-]+/g, " ").trim().toLowerCase();

export function TurnBlock({
  turn: t,
  persona,
  current,
  onDrug,
  onFlip,
  onReplay,
}: {
  turn: Turn;
  persona: Persona;
  current: boolean;
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
  const name = who === "clinician" ? "Clinician" : who === "patient" ? persona.name.split(" ")[0] : "";
  const done = t.status === "done";
  // Renames already show inline (the word flips to the local name), so only real warnings get a note.
  const notable = t.drugs.filter((d) => d.status === "not_available_locally" || d.status === "different_strength" || d.status === "uncertain");

  return (
    <article className={`turn ${who || "unknown"} ${t.status} ${current ? "current" : ""}`}>
      <header className="turn-meta">
        {who ? <Flag code={who === "clinician" ? persona.trip.country : persona.home} size={22} className="turn-flag" /> : <span className="dot" />}
        {name ? <span className="who">{name}</span> : t.status === "live" || t.status === "transcribing" ? <span className="who muted">Listening</span> : null}
        {spokenLang && <span className="lang">{langName(spokenLang)}</span>}
        <span className="spacer" />
        {done && current && t.timings.total ? <span className="timing">{(t.timings.total / 1000).toFixed(1)} s</span> : null}
        {done && (
          <button className="mini" onClick={onFlip} title="Wrong speaker? Swap" aria-label="Swap speaker">
            <Icon name="swap" size={18} />
          </button>
        )}
        {done && current && (
          <button className="mini" onClick={onReplay} aria-label="Play again">
            <Icon name="speaker" size={18} />
          </button>
        )}
      </header>

      {(t.status === "live" || t.status === "transcribing") && (
        <LiveCaption text={t.raw} lang={spokenLang} />
      )}

      {t.status === "interpreting" && (
        <>
          <p className="original" dir={dir(spokenLang)}>
            {t.raw}
          </p>
          <div className="pending" dir={dir(listenerLang)}>
            <span className="pending-orb" aria-hidden />
            <span className="pending-text">Translating to {langName(listenerLang)}</span>
          </div>
        </>
      )}

      {done && (
        <>
          <p className="original" dir={dir(spokenLang)} lang={spokenLang}>
            {current ? <Reveal key={t.cleaned} text={t.cleaned} lang={spokenLang} drugs={t.drugs} field="mentioned" swap={swapToward} onDrug={onDrug} step={30} budget={500} /> : t.cleaned}
          </p>
          <p className={`translation ${current ? sizeFor(t.translation) : "past"}`} dir={dir(listenerLang)} lang={listenerLang}>
            {current ? (
              <Reveal key={t.translation} text={t.translation} lang={listenerLang} drugs={t.drugs} field="translated" onDrug={onDrug} start={250} step={70} budget={1400} />
            ) : (
              <Reveal text={t.translation} lang={listenerLang} drugs={t.drugs} field="translated" onDrug={onDrug} step={0} budget={0} />
            )}
          </p>
          {current && notable.length > 0 && (
            <ul className="med-notes">
              {notable.map((d) => (
                <li key={d.key}>
                  <button onClick={() => onDrug(d)}>
                    <StatusBadge status={d.status} compact />
                    <span>
                      <b>{d.mentioned || d.home_name}</b>
                      {d.status === "not_available_locally" && who !== "clinician" ? " is not sold here" : ` → ${swapLabel(d, swapToward)}`}
                    </span>
                    <Icon name="chevron" size={18} className="muted" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {current && cleanedDiffers && (
            <button className="link small" onClick={() => setShowRaw((v) => !v)}>
              {showRaw ? "Hide original speech" : "Cleaned up · show original speech"}
            </button>
          )}
          {showRaw && (
            <p className="raw" dir={dir(spokenLang)}>
              {t.raw}
            </p>
          )}
        </>
      )}

      {t.status === "error" && <p className="error-text small">Couldn't translate this. {t.error}</p>}
    </article>
  );
}
