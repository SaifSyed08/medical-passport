import type { CSSProperties } from "react";
import Icon from "./Icon";

/**
 * The microphone button. Listening: a soft ring follows the voice level. Translating: a light orbits it.
 * Speaking a translation: the icon becomes moving voice bars and waves roll outward.
 */
export default function Orb({ mode, level, onTap, label }: { mode: string; level: number; onTap: () => void; label: string }) {
  const lvl = mode === "speech" || mode === "listening" ? level : 0;
  return (
    <button className={`orb ${mode}`} style={{ "--lvl": lvl } as CSSProperties} onClick={onTap} aria-label={label}>
      <span className="orb-wave w1" />
      <span className="orb-wave w2" />
      <span className="orb-ring" />
      <span className="orb-orbit">
        <i />
      </span>
      <span className="orb-core">
        {mode === "speaking" ? (
          <span className="eq" aria-hidden>
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        ) : (
          <Icon name={mode === "muted" || mode === "paused" ? "pause" : "mic"} size={32} />
        )}
      </span>
    </button>
  );
}
