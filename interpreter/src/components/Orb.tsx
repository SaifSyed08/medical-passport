import type { CSSProperties } from "react";
import type { Speaker } from "../lib/types";
import Icon from "./Icon";
import LogoLoader from "./LogoLoader";
import Flag from "./Flag";

/**
 * The microphone button. It says what it's doing without a caption:
 *  off       dark, breathing, a halo rippling out (tap me)
 *  listening the brand colour, a ring that follows the room's level
 *  speech    grows, takes the speaker's colour, the ring follows their voice
 *  busy      shrinks a little, the logo runs its loop inside (translating)
 *  speaking  voice bars and waves rolling outward (tap to skip)
 *  muted     an empty outline with a pause sign
 *  error     red with a crossed-out mic, and a shake
 * `who` colours it for the person being heard; `next` pins a small flag on it for "who talks next".
 */
export default function Orb({ mode, level, onTap, label, who, next }: { mode: string; level: number; onTap: () => void; label: string; who?: Speaker | null; next?: { code: string } | null }) {
  const lvl = mode === "speech" || mode === "listening" ? level : 0;
  return (
    <button className={`orb ${mode} ${who ? `who-${who}` : ""}`} style={{ "--lvl": lvl } as CSSProperties} onClick={onTap} aria-label={label} title={label}>
      <span className="orb-wave w1" />
      <span className="orb-wave w2" />
      <span className="orb-ring" />
      <span className="orb-core">
        {mode === "speaking" ? (
          <span className="eq" aria-hidden>
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        ) : mode === "busy" || mode === "starting" ? (
          <LogoLoader size={34} mono />
        ) : (
          <Icon name={mode === "muted" || mode === "paused" ? "pause" : mode === "error" ? "micOff" : "mic"} size={32} />
        )}
      </span>
      {next && (
        <span className="orb-next" aria-hidden>
          <Flag code={next.code} size={18} />
        </span>
      )}
    </button>
  );
}
