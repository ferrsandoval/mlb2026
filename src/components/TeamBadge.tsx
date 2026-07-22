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
export default function TeamBadge({ team, size = 'md', className = '' }: Props) {
  const s = typeof size === 'number' ? size : NAMED[size]
  const url = LOGOS[team.id]
  const [broken, setBroken] = useState(false)
  const showLogo = !!url && !broken
  const pad = Math.max(2, s * 0.14)

  return (
    <div
      className={className}
      title={team.id}
      style={{
        position: 'relative',
        width: s,
        height: s,
        flexShrink: 0,
        borderRadius: s * 0.26,
        padding: pad,
        background: 'linear-gradient(180deg,#ffffff,#eef3fa)',
        boxShadow: '0 0 0 1px rgba(255,255,255,.85) inset, 0 1px 0 rgba(255,255,255,.6) inset, 0 3px 8px -3px rgba(0,0,0,.5)',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <span
        style={{
          position: 'absolute',
          fontFamily: 'var(--fm)',
          fontWeight: 700,
          fontSize: s * 0.3,
          color: team.primaryColor,
          letterSpacing: '.2px',
          visibility: showLogo ? 'hidden' : 'visible',
        }}
      >
        {team.id}
      </span>
      {showLogo && (
        <img
          src={url}
          alt={team.id}
          loading="lazy"
          onError={() => setBroken(true)}
          style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'contain' }}
        />
      )}
    </div>
  )
}
