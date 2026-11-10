import type { CSSProperties } from "react";
import Icon from "./Icon";

/** The microphone button. A soft ring follows the voice level; a thin arc spins while translating. */
export default function Orb({ mode, level, onTap, label }: { mode: string; level: number; onTap: () => void; label: string }) {
  const lvl = mode === "speech" || mode === "listening" ? level : 0;
  const icon = mode === "speaking" ? "speaker" : mode === "muted" || mode === "paused" ? "pause" : "mic";
  return (
    <button className={`orb ${mode}`} style={{ "--lvl": lvl, viewTransitionName: "mic-btn" } as CSSProperties} onClick={onTap} aria-label={label}>
      <span className="orb-ring" />
      <span className="orb-spin" />
      <span className="orb-core">
        <Icon name={icon} size={32} />
      </span>
    </button>
  );
}
