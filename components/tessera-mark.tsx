// The Tessera logo: four mosaic tiles. Drawn in currentColor, so it takes the colour of the text around it.
export function TesseraMark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 28 28" fill="currentColor" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="12" height="12" rx="3.5" />
      <rect x="15" y="1" width="12" height="12" rx="3.5" opacity=".35" />
      <rect x="1" y="15" width="12" height="12" rx="3.5" opacity=".35" />
      <rect x="15" y="15" width="12" height="12" rx="6" />
    </svg>
  );
}
