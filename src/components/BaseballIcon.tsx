// Icono de béisbol (SVG) — reemplaza el emoji ⚾ por un trazo consistente.
export default function BaseballIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M5.7 6.3c1.9 1.8 2.8 3.7 2.8 5.7s-.9 3.9-2.8 5.7M18.3 6.3c-1.9 1.8-2.8 3.7-2.8 5.7s.9 3.9 2.8 5.7" />
    </svg>
  )
}
