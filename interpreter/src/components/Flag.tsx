// Small SVG flags (Windows has no flag emoji). Simplified, recognisable at 16-28 px.
import type { ReactNode } from "react";

const W = 30;
const H = 20;

const FLAGS: Record<string, ReactNode> = {
  US: (
    <>
      <rect width={W} height={H} fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} y={(i * H) / 13} width={W} height={H / 13} fill="#b22234" />
      ))}
      <rect width={12.5} height={(7 * H) / 13} fill="#3c3b6e" />
      {[2, 5, 8, 11].flatMap((x) => [2.2, 5.4, 8.6].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={0.7} fill="#fff" />))}
    </>
  ),
  MX: (
    <>
      <rect width={10} height={H} fill="#006847" />
      <rect x={10} width={10} height={H} fill="#fff" />
      <rect x={20} width={10} height={H} fill="#ce1126" />
      <circle cx={15} cy={10} r={2.6} fill="#8c5a2b" />
      <path d="M12.6 11.6q2.4 2.6 4.8 0" stroke="#006847" strokeWidth={0.9} fill="none" />
    </>
  ),
  JP: (
    <>
      <rect width={W} height={H} fill="#fff" />
      <circle cx={15} cy={10} r={6} fill="#bc002d" />
    </>
  ),
  GB: (
    <>
      <rect width={W} height={H} fill="#012169" />
      <path d="M0 0L30 20M30 0L0 20" stroke="#fff" strokeWidth={4} />
      <path d="M0 0L30 20M30 0L0 20" stroke="#c8102e" strokeWidth={1.6} />
      <path d="M15 0v20M0 10h30" stroke="#fff" strokeWidth={6} />
      <path d="M15 0v20M0 10h30" stroke="#c8102e" strokeWidth={3.4} />
    </>
  ),
  FR: (
    <>
      <rect width={10} height={H} fill="#0055a4" />
      <rect x={10} width={10} height={H} fill="#fff" />
      <rect x={20} width={10} height={H} fill="#ef4135" />
    </>
  ),
  IT: (
    <>
      <rect width={10} height={H} fill="#009246" />
      <rect x={10} width={10} height={H} fill="#fff" />
      <rect x={20} width={10} height={H} fill="#ce2b37" />
    </>
  ),
  DE: (
    <>
      <rect width={W} height={7} fill="#000" />
      <rect y={6.67} width={W} height={6.7} fill="#dd0000" />
      <rect y={13.33} width={W} height={6.7} fill="#ffce00" />
    </>
  ),
  ES: (
    <>
      <rect width={W} height={H} fill="#aa151b" />
      <rect y={5} width={W} height={10} fill="#f1bf00" />
    </>
  ),
  IN: (
    <>
      <rect width={W} height={7} fill="#ff9933" />
      <rect y={6.67} width={W} height={6.7} fill="#fff" />
      <rect y={13.33} width={W} height={6.7} fill="#138808" />
      <circle cx={15} cy={10} r={2.4} fill="none" stroke="#000080" strokeWidth={0.8} />
    </>
  ),
  PK: (
    <>
      <rect width={W} height={H} fill="#01411c" />
      <rect width={7.5} height={H} fill="#fff" />
      <circle cx={19} cy={10} r={5} fill="#fff" />
      <circle cx={20.6} cy={8.8} r={4.3} fill="#01411c" />
    </>
  ),
  CN: (
    <>
      <rect width={W} height={H} fill="#de2910" />
      <path d="M6 2.5l1.2 3.6h3.8l-3.1 2.2 1.2 3.6L6 9.7l-3.1 2.2 1.2-3.6L1 6.1h3.8z" fill="#ffde00" />
    </>
  ),
  KR: (
    <>
      <rect width={W} height={H} fill="#fff" />
      <path d="M10 10a5 5 0 0 1 10 0z" fill="#cd2e3a" />
      <path d="M10 10a5 5 0 0 0 10 0z" fill="#0047a0" />
    </>
  ),
  BR: (
    <>
      <rect width={W} height={H} fill="#009c3b" />
      <path d="M15 2.5L27 10 15 17.5 3 10z" fill="#ffdf00" />
      <circle cx={15} cy={10} r={4.2} fill="#002776" />
    </>
  ),
  CA: (
    <>
      <rect width={W} height={H} fill="#fff" />
      <rect width={7.5} height={H} fill="#d52b1e" />
      <rect x={22.5} width={7.5} height={H} fill="#d52b1e" />
      <path d="M15 4.5l1.3 2.6 1.8-.6-.6 3 1.8.3-2.5 2 .4 1.6H15.6v2.2h-1.2v-2.2h-1.6l.4-1.6-2.5-2 1.8-.3-.6-3 1.8.6z" fill="#d52b1e" />
    </>
  ),
  PH: (
    <>
      <rect width={W} height={10} fill="#0038a8" />
      <rect y={10} width={W} height={10} fill="#ce1126" />
      <path d="M0 0L13 10 0 20z" fill="#fff" />
      <circle cx={4.5} cy={10} r={1.8} fill="#fcd116" />
    </>
  ),
  VN: (
    <>
      <rect width={W} height={H} fill="#da251d" />
      <path d="M15 4l1.5 4.5h4.7l-3.8 2.8 1.5 4.5L15 13l-3.9 2.8 1.5-4.5-3.8-2.8h4.7z" fill="#ff0" />
    </>
  ),
  TR: (
    <>
      <rect width={W} height={H} fill="#e30a17" />
      <circle cx={11.5} cy={10} r={5} fill="#fff" />
      <circle cx={12.8} cy={10} r={4} fill="#e30a17" />
      <circle cx={19} cy={10} r={1.6} fill="#fff" />
    </>
  ),
  AU: (
    <>
      <rect width={W} height={H} fill="#012169" />
      <path d="M0 0L15 10M15 0L0 10" stroke="#fff" strokeWidth={2} />
      <path d="M7.5 0v10M0 5h15" stroke="#fff" strokeWidth={3} />
      <path d="M7.5 0v10M0 5h15" stroke="#c8102e" strokeWidth={1.6} />
      <circle cx={22} cy={6} r={1} fill="#fff" />
      <circle cx={25} cy={11} r={1} fill="#fff" />
      <circle cx={21} cy={15} r={1} fill="#fff" />
      <circle cx={7.5} cy={15} r={1.6} fill="#fff" />
    </>
  ),
};

export default function Flag({ code, size = 20, className = "" }: { code: string; size?: number; className?: string }) {
  const art = FLAGS[code];
  const h = Math.round((size * H) / W);
  if (!art)
    return (
      <span className={`flag flag-code ${className}`} style={{ width: size, height: h, fontSize: Math.max(8, h * 0.55) }}>
        {code}
      </span>
    );
  return (
    <svg className={`flag ${className}`} viewBox={`0 0 ${W} ${H}`} width={size} height={h} aria-hidden>
      {art}
    </svg>
  );
}
