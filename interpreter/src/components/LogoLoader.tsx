import type { CSSProperties } from "react";

/**
 * The logo as a loading loop. Parity: the two bars of the equals sign take turns, each drawing out as the other fades.
 * Tandem: a light runs round each ring, the two chasing each other in opposite directions with a tail.
 * Both marks are drawn; the page's brand shows the right one (CSS). `mono` draws it all in currentColor, for
 * use on a coloured button.
 */
export default function LogoLoader({ size = 26, mono = false, label, className = "" }: { size?: number; mono?: boolean; label?: string; className?: string }) {
  return (
    <span className={`logo-loader ${mono ? "mono" : ""} ${className}`} style={{ "--ll": `${size}px` } as CSSProperties} role={label ? "status" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg className="ll-parity" viewBox="0 0 28 28">
        <rect className="p0" x="2" y="7" width="24" height="5.5" rx="2.75" />
        <rect className="p1" x="2" y="15.5" width="24" height="5.5" rx="2.75" />
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
