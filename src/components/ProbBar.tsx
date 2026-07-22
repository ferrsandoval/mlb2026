interface Props {
  /** Probabilidad del local (0..1) */
  probHome: number
  /** Probabilidad del visitante (0..1) */
  probAway: number
  homeColor?: string
  awayColor?: string
  height?: number
}

function lighten(hex: string): string {
  const c = hex.replace('#', '')
  const n = parseInt(c, 16)
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  r = Math.round(r + (255 - r) * 0.45)
  g = Math.round(g + (255 - g) * 0.45)
  b = Math.round(b + (255 - b) * 0.45)
  return `rgb(${r},${g},${b})`
}

// Barra moneyline bicolor estilo PENNANT: visitante a la izquierda, local a la
// derecha, teñidas con el color primario de cada equipo.
export default function ProbBar({ probHome, probAway, homeColor = '#0C2340', awayColor = '#C8102E', height = 8 }: Props) {
  const homePct = (probHome / (probHome + probAway || 1)) * 100
  const awayPct = 100 - homePct
  return (
    <div style={{ display: 'flex', height, borderRadius: 99, overflow: 'hidden', background: '#0a141f' }}>
      <div style={{ width: `${awayPct}%`, background: `linear-gradient(90deg,${awayColor},${lighten(awayColor)})` }} />
      <div style={{ width: 2, background: '#060d16' }} />
      <div style={{ width: `${homePct}%`, background: `linear-gradient(90deg,${lighten(homeColor)},${homeColor})` }} />
    </div>
  )
}
