import type { ReactNode } from 'react'

interface Props {
  eyebrow: string
  title: string
  subtitle?: string
  right?: ReactNode
}

// Encabezado de sección estilo PENNANT: antetítulo mono + título display.
export default function PageHeader({ eyebrow, title, subtitle, right }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--red-b)', letterSpacing: '.12em', textTransform: 'uppercase' }}>{eyebrow}</div>
        <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 26, margin: '6px 0 0', letterSpacing: '-.02em' }}>{title}</h1>
        {subtitle && <p style={{ color: 'var(--muted)', fontSize: 13, margin: '8px 0 0', maxWidth: 560 }}>{subtitle}</p>}
      </div>
      {right && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{right}</div>}
    </div>
  )
}
