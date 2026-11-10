import { useState } from "react";
import type { DrugMention, Persona, Turn } from "../lib/types";
import { dir, langNative } from "../lib/langs";
import { Marked, StatusBadge, swapLabel } from "./bits";

type Props = { turn: Turn; persona: Persona; onDrug: (d: DrugMention) => void; onFlip: () => void; onReplay: () => void };

export default function TurnCard({ turn: t, persona, onDrug, onFlip, onReplay }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const who = t.speaker || t.forced;
  const spokenLang = t.language || (who === "clinician" ? persona.trip.doctorLanguage : who === "patient" ? persona.language : "");
  const listenerLang = t.listenerLang || (who === "clinician" ? persona.language : persona.trip.doctorLanguage);
  // In the speaker's own words, drug names turn into what the listener's side calls them.
  const swapToward = who === "clinician" ? "home" : "local";
  const cleanedDiffers = t.cleaned && t.raw && normSpace(t.cleaned) !== normSpace(t.raw);

  return (
    <article className={`turn ${who || "unknown"} ${t.status}`}>
      <div className="turn-head">
        <button className="who-pill" onClick={t.status === "done" ? onFlip : undefined} title={t.status === "done" ? "Wrong person? Tap to swap" : undefined}>
          {who === "clinician" ? "Doctor" : who === "patient" ? "Patient" : "Someone"}
          {spokenLang && <span className="lang"> · {langNative(spokenLang)}</span>}
          {t.status === "done" && <span className="flip" aria-hidden> ⇅</span>}
        </button>
        <span className="turn-status">
          {t.status === "transcribing" && (
            <>
              <span className="dots" /> listening back
            </>
          )}
          {t.status === "interpreting" && (
            <>
              <span className="dots" /> translating
            </>
          )}
          {t.status === "done" && t.timings.total ? <span className="timing">{(t.timings.total / 1000).toFixed(1)} s</span> : null}
          {t.status === "error" && <span className="error-text">couldn't translate</span>}
        </span>
      </div>

      {t.status === "transcribing" && <div className="skeleton" />}

      {t.raw && t.status !== "done" && (
        <p className="said raw-live" dir={dir(spokenLang)}>
          {t.raw}
        </p>
      )}

      {t.status === "done" && (
        <>
          <p className="said" dir={dir(spokenLang)}>
            <Marked text={t.cleaned} drugs={t.drugs} field="mentioned" swap={swapToward} onDrug={onDrug} />
          </p>
          {cleanedDiffers && (
            <button className="raw-toggle" onClick={() => setShowRaw((v) => !v)}>
              {showRaw ? "hide what was heard" : "✦ cleaned up · show what was heard"}
            </button>
          )}
          {showRaw && (
            <p className="raw" dir={dir(spokenLang)}>
              {t.raw}
            </p>
          )}
          <div className="translation" dir={dir(listenerLang)} lang={listenerLang}>
            <span className="to-lang">{langNative(listenerLang)}</span>
            <p>
              <Marked text={t.translation} drugs={t.drugs} field="translated" onDrug={onDrug} />
            </p>
            <button className="icon-btn replay" onClick={onReplay} aria-label="Play translation again">
              ▶
            </button>
          </div>
          {t.drugs.length > 0 && (
            <div className="drug-chips">
              {t.drugs.map((d) => (
                <button key={d.key} className={`drug-chip ${d.status}`} onClick={() => onDrug(d)}>
                  <StatusBadge status={d.status} compact />
                  <span className="chip-from">{d.mentioned || d.home_name}</span>
                  <span aria-hidden>→</span>
                  <strong>{d.status === "not_available_locally" && who !== "clinician" ? "not sold here" : swapLabel(d, swapToward)}</strong>
                  {d.cached && <span className="saved" title="Saved on this phone">✓</span>}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {t.status === "error" && <p className="error-text small">{t.error}</p>}
    </article>
  );
}

const normSpace = (s: string) => s.replace(/[\s.,!?¡¿;:"“”'’-]+/g, " ").trim().toLowerCase();
