export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="Pulso">
      <rect width="64" height="64" rx="18" fill="#0f3b4c" />
      <path d="M8 34h12l5-12 8 22 6-14 4 4h13" fill="none" stroke="#7ee0c8" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
