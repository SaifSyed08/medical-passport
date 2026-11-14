// Tandem's mark: two interlocking rings (gold and cream), drawn so each passes over the other once.
export function TandemMark({ size = 30 }: { size?: number }) {
  return (
    <svg className="tandem-mark" viewBox="0 0 48 48" width={size} height={size} aria-hidden>
      <circle cx="30" cy="18" r="11.5" fill="none" stroke="var(--t-gold)" strokeWidth="7" />
      <circle cx="18" cy="30" r="11.5" fill="none" stroke="var(--t-cream)" strokeWidth="7" />
      {/* Gold crosses back over the cream ring at the lower crossing: that's what makes them interlock. */}
      <path d="M34.3 28.6 A11.5 11.5 0 0 1 25.7 28.6" fill="none" stroke="var(--t-gold)" strokeWidth="7" strokeLinecap="butt" />
    </svg>
  );
}

export function TandemWordmark() {
  return (
    <span className="wordmark tandem">
      <TandemMark size={30} />
      <span className="tandem-word">Tandem</span>
    </span>
  );
}

/** The same mark as an SVG data URL, for the browser tab icon. */
export const TANDEM_ICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#0b2452"/><circle cx="30" cy="18" r="11.5" fill="none" stroke="#f3b23c" stroke-width="7"/><circle cx="18" cy="30" r="11.5" fill="none" stroke="#f7f1e3" stroke-width="7"/><path d="M34.3 28.6 A11.5 11.5 0 0 1 25.7 28.6" fill="none" stroke="#f3b23c" stroke-width="7"/></svg>',
  );
