import { useState } from "react";
import type { DrugMention, Persona, Turn } from "../lib/types";
import { dir, langName } from "../lib/langs";
import { Reveal, StatusBadge, swapLabel } from "./bits";
import Icon from "./Icon";

const SPEAK_IN: Record<string, string> = {
  es: "Hable en español", en: "Speak in English", ja: "日本語で話してください", fr: "Parlez en français", de: "Sprechen Sie Deutsch",
  it: "Parli in italiano", pt: "Fale em português", zh: "请说中文", ko: "한국어로 말씀하세요", hi: "हिंदी में बोलिए", ur: "اردو میں بولیں",
  ar: "تحدث بالعربية", vi: "Hãy nói tiếng Việt", ru: "Говорите по-русски", tl: "Magsalita sa Tagalog", tr: "Türkçe konuşun", fa: "فارسی صحبت کنید",
};

/** Before anyone talks: one line per language, nothing else. */
export function IdleHero({ persona, live }: { persona: Persona; live: boolean }) {
  return (
    <div className="idle">
      <div className={`idle-mark ${live ? "live" : ""}`}>
        <Icon name="mic" size={26} />
      </div>
      <p className="idle-line patient" lang={persona.language} dir={dir(persona.language)}>
        {SPEAK_IN[persona.language] || "Speak"}
      </p>
      <p className="idle-line clinician" lang={persona.trip.doctorLanguage} dir={dir(persona.trip.doctorLanguage)}>
        {SPEAK_IN[persona.trip.doctorLanguage] || "Speak"}
      </p>
      <p className="idle-hint">{live ? "Listening" : "Tap the microphone to begin"}</p>
    </div>
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

  return (
    <article className={`turn ${who || "unknown"} ${t.status} ${current ? "current" : ""}`}>
      <header className="turn-meta">
        <span className="dot" />
        {name ? <span className="who">{name}</span> : <span className="who muted">Listening</span>}
        {spokenLang && <span className="lang">{langName(spokenLang)}</span>}
        <span className="spacer" />
        {done && current && t.timings.total ? <span className="timing">{(t.timings.total / 1000).toFixed(1)} s</span> : null}
        {done && (
          <button className="mini" onClick={onFlip} title="Wrong speaker? Swap" aria-label="Swap speaker">
            <Icon name="swap" size={15} />
          </button>
        )}
        {done && current && (
          <button className="mini" onClick={onReplay} aria-label="Play again">
            <Icon name="speaker" size={15} />
          </button>
        )}
      </header>

      {(t.status === "live" || t.status === "transcribing") && (
        <p className="live-text" dir={dir(spokenLang)} lang={spokenLang}>
          {t.raw || <span className="muted">…</span>}
          <span className="caret" />
        </p>
      )}

      {t.status === "interpreting" && (
        <>
          <p className="original" dir={dir(spokenLang)}>
            {t.raw}
          </p>
          <div className="pending">
            <span />
            <span />
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
          {current && t.drugs.length > 0 && (
            <ul className="med-notes">
              {t.drugs.map((d) => (
                <li key={d.key}>
                  <button onClick={() => onDrug(d)}>
                    <StatusBadge status={d.status} compact />
                    <span>
                      <b>{d.mentioned || d.home_name}</b>
                      {d.status === "not_available_locally" && who !== "clinician" ? " is not sold here" : ` → ${swapLabel(d, swapToward)}`}
                    </span>
                    <Icon name="chevron" size={14} className="muted" />
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
