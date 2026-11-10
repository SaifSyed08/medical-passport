// Line icons (24px grid, 1.8 stroke) so nothing depends on emoji fonts.
const PATHS: Record<string, string> = {
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z M5.5 11a6.5 6.5 0 0 0 13 0 M12 17.5V21",
  speaker: "M4 9.5h3.5L12 5.5v13l-4.5-4H4z M15.5 9a4 4 0 0 1 0 6 M18 6.5a7.5 7.5 0 0 1 0 11",
  mute: "M4 9.5h3.5L12 5.5v13l-4.5-4H4z M16 9.5l5 5 M21 9.5l-5 5",
  pause: "M8 5v14 M16 5v14",
  back: "M15 5l-7 7 7 7",
  more: "M5 12h.01 M12 12h.01 M19 12h.01",
  close: "M6 6l12 12 M18 6 6 18",
  keyboard: "M3 7h18v10H3z M7 11h.01 M11 11h.01 M15 11h.01 M8 14.5h8",
  play: "M8 5.5v13l10-6.5z",
  alert: "M12 4 2.8 19.5h18.4z M12 10v4 M12 17h.01",
  pill: "M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7z M8.5 8.5l7 7",
  heart: "M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7.5 4.5 4.5 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z",
  lab: "M9 3h6 M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3 M7.5 15h9",
  doc: "M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6 M9 16h6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  swap: "M4 8h13l-3-3 M20 16H7l3 3",
  settings: "M4 7h10 M18 7h2 M4 17h4 M12 17h8 M16 5v4 M10 15v4",
  sparkle: "M12 4v4 M12 16v4 M4 12h4 M16 12h4",
  chevron: "M9 6l6 6-6 6",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7 M20 5v6h-6",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4.5 20a7.5 7.5 0 0 1 15 0",
};

export default function Icon({ name, size = 20, className = "" }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  return (
    <svg className={`icon ${className}`} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name] || ""} />
    </svg>
  );
}

export const KIND_ICON_NAME: Record<string, string> = { allergy: "alert", medication: "pill", condition: "heart", lab: "lab", document: "doc" };
