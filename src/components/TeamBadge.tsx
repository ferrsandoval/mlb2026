import { useState } from 'react'
import { LOGOS } from '../data/logos'

interface Props {
  team: { id: string; primaryColor: string; secondaryColor: string }
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
  className?: string
}

const NAMED: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number> = {
  xs: 22, sm: 26, md: 34, lg: 42, xl: 64,
}

// Badge estilo PENNANT: el logo es el elemento héroe sobre una placa blanca;
// si no hay logo (o falla la carga) cae al código del equipo en su color.
//
// La imagen se posiciona en ABSOLUTO con un inset = padding, de modo que su caja
// es siempre un cuadrado de lado (s - 2·pad) definido. Así `object-fit: contain`
// escala cualquier logo (cuadrado o vertical, p.ej. Cleveland/Seattle) dentro de
// ese cuadrado y jamás se desborda. (Con display:grid + width/height 100% el
// navegador caía en el tamaño intrínseco del SVG y los logos altos se salían.)
export default function TeamBadge({ team, size = 'md', className = '' }: Props) {
  const s = typeof size === 'number' ? size : NAMED[size]
  const url = LOGOS[team.id]
  const [broken, setBroken] = useState(false)
  const showLogo = !!url && !broken
  const pad = Math.max(4, Math.round(s * 0.18))
  const radius = Math.round(s * 0.26)
  const inner = `calc(100% - ${2 * pad}px)`

  return (
    <div
      className={className}
      title={team.id}
      style={{
        position: 'relative',
        width: s,
        height: s,
        minWidth: s,
        boxSizing: 'border-box',
        flexShrink: 0,
        borderRadius: radius,
        background: 'linear-gradient(180deg,#ffffff,#eef3fa)',
        boxShadow: '0 0 0 1px rgba(255,255,255,.85) inset, 0 1px 0 rgba(255,255,255,.6) inset, 0 3px 8px -3px rgba(0,0,0,.5)',
      }}
    >
      {showLogo ? (
        <img
          src={url}
          alt={team.id}
          loading="lazy"
          onError={() => setBroken(true)}
          style={{
            position: 'absolute',
            top: pad,
            left: pad,
            width: inner,
            height: inner,
            objectFit: 'contain',
            display: 'block',
          }}
        />
      ) : (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--fm)',
            fontWeight: 700,
            fontSize: s * 0.3,
            color: team.primaryColor,
            letterSpacing: '.2px',
          }}
        >
          {team.id}
        </span>
      )}
    </div>
  )
}
