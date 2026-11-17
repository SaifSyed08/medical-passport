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
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 11v5 M12 7.5h.01",
  chevron: "M9 6l6 6-6 6",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7 M20 5v6h-6",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4.5 20a7.5 7.5 0 0 1 15 0",
  plus: "M12 5v14 M5 12h14",
  trash: "M4 7h16 M9.5 7V4.5h5V7 M6.5 7l1 13h9l1-13 M10 11v5.5 M14 11v5.5",
  camera: "M4 8h3.5L9 5.5h6L16.5 8H20v11H4z M12 16.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z",
  undo: "M9 14 4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  micOff: "M15 9.5V6a3 3 0 0 0-5.7-1.3 M9 9v3a3 3 0 0 0 4.8 2.4 M5.5 11a6.5 6.5 0 0 0 10.9 4.8 M18.5 11c0 .8-.1 1.5-.4 2.2 M12 17.5V21 M4 4l16 16",
  pin: "M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z M12 12.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Z",
  pencil: "M4 20h4L19.5 8.5a2.1 2.1 0 0 0-4-4L4 16z M13.5 6.5l4 4",
  upload: "M12 15V4 M7.5 8.5 12 4l4.5 4.5 M5 14.5v4A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-4",
  lock: "M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5 M6.5 10.5h11A1.5 1.5 0 0 1 19 12v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19v-7a1.5 1.5 0 0 1 1.5-1.5Z M12 14.2v2.6",
  phone: "M6.6 3.5h2.6l1.5 4-2 1.3a11 11 0 0 0 6.5 6.5l1.3-2 4 1.5v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z",
};

export default function Icon({ name, size = 20, className = "" }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  return (
    <svg className={`icon ${className}`} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name] || ""} />
    </svg>
  );
}

export const KIND_ICON_NAME: Record<string, string> = { allergy: "alert", medication: "pill", condition: "heart", lab: "lab", document: "doc" };
