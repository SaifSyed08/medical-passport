import type { CSSProperties } from "react";

/**
 * The logo as a loading loop. Tessera: the bright tile runs round the 2x2 grid with a fading trail behind it.
 * Tandem: a light runs round each ring, the two chasing each other in opposite directions with a tail.
 * Both marks are drawn; the page's brand shows the right one (CSS). `mono` draws it all in currentColor, for
 * use on a coloured button.
 */
export default function LogoLoader({ size = 26, mono = false, label, className = "" }: { size?: number; mono?: boolean; label?: string; className?: string }) {
  return (
    <span className={`logo-loader ${mono ? "mono" : ""} ${className}`} style={{ "--ll": `${size}px` } as CSSProperties} role={label ? "status" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg className="ll-tessera" viewBox="0 0 28 28">
        <rect className="t0" x="1" y="1" width="12" height="12" rx="3.5" />
        <rect className="t1" x="15" y="1" width="12" height="12" rx="3.5" />
        <rect className="t2" x="15" y="15" width="12" height="12" rx="6" />
        <rect className="t3" x="1" y="15" width="12" height="12" rx="3.5" />
      </svg>
      <svg className="ll-tandem" viewBox="0 0 48 48">
        <circle className="base a" cx="30" cy="18" r="11.5" />
        <circle className="base b" cx="18" cy="30" r="11.5" />
        <circle className="tail a" cx="30" cy="18" r="11.5" pathLength="100" />
        <circle className="tail b" cx="18" cy="30" r="11.5" pathLength="100" />
        <circle className="head a" cx="30" cy="18" r="11.5" pathLength="100" />
        <circle className="head b" cx="18" cy="30" r="11.5" pathLength="100" />
      </svg>
    </span>
  );
}
