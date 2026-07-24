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
        <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--red-b)', letterSpacing: '.16em', textTransform: 'uppercase' }}>{eyebrow}</div>
        <h1 className="pn-serif" style={{ fontWeight: 600, fontSize: 32, margin: '4px 0 0', letterSpacing: '-.015em', lineHeight: 1.06 }}>{title}</h1>
        {subtitle && <p style={{ color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.5, margin: '10px 0 0', maxWidth: 580 }}>{subtitle}</p>}
      </div>
      {right && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{right}</div>}
    </div>
  )
}
