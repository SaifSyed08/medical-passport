// The Parity logo: an equals sign, two people on equal footing. Drawn in currentColor, so it takes the colour of the text around it.
export function ParityMark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 28 28" fill="currentColor" aria-hidden="true" focusable="false">
      <rect x="2" y="7" width="24" height="5.5" rx="2.75" />
      <rect x="2" y="15.5" width="24" height="5.5" rx="2.75" opacity=".55" />
    </svg>
  );
}
