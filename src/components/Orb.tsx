import type { CSSProperties } from "react";
import { MicGlyph } from "./Home";

/** The one control: a glowing orb that breathes with the voice in the room. */
export default function Orb({ mode, level, onTap, label }: { mode: string; level: number; onTap: () => void; label: string }) {
  const lvl = mode === "speech" || mode === "listening" ? level : 0;
  return (
    <button className={`orb ${mode}`} style={{ "--lvl": lvl } as CSSProperties} onClick={onTap} aria-label={label}>
      <span className="orb-ring r3" />
      <span className="orb-ring r2" />
      <span className="orb-ring r1" />
      <span className="orb-spin" />
      <span className="orb-core">{mode === "speaking" ? <SpeakerGlyph /> : mode === "muted" ? <PauseGlyph /> : <MicGlyph />}</span>
    </button>
  );
}

function SpeakerGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}
function PauseGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden>
      <rect x="7" y="5" width="3.5" height="14" rx="1.5" fill="currentColor" />
      <rect x="13.5" y="5" width="3.5" height="14" rx="1.5" fill="currentColor" />
    </svg>
  );
}
