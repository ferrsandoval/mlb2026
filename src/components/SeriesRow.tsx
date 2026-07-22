import type { Series } from '../data/postseason'
import type { Team } from '../data/seed'
import TeamBadge from './TeamBadge'

interface Props {
  series: Series
  teams: Record<string, Team>
  onClick?: () => void
}

function seriesWins(series: Series): { higher: number; lower: number; played: number } {
  let higher = 0, played = 0
  for (const g of series.games ?? []) {
    if (g.homeRuns == null || g.awayRuns == null) continue
    played++
    const homeIsHigher = g.homeId === series.higherSeedId
    if ((g.homeRuns > g.awayRuns) === homeIsHigher) higher++
  }
  return { higher, lower: played - higher, played }
}

// Fila de serie estilo PENNANT usada en el bracket de postemporada.
export default function SeriesRow({ series, teams, onClick }: Props) {
  const a = teams[series.higherSeedId]
  const b = teams[series.lowerSeedId]

  if (!a || !b) {
    return (
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 6, fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--faint)' }}>
        Por definir
      </div>
    )
  }

  const { higher, lower, played } = seriesWins(series)

  const decided = !!series.winnerId
  const live = !decided && played > 0
  const aWon = decided && series.winnerId === series.higherSeedId
  const bWon = decided && series.winnerId === series.lowerSeedId

  const accent = live ? 'var(--green)' : decided ? 'var(--border-2)' : 'var(--faint)'
  const note = decided ? `Avanza ${teams[series.winnerId!]?.id ?? ''}` : live ? '● Serie en curso' : 'Por definir'
  const noteColor = decided ? 'var(--muted)' : live ? 'var(--green)' : 'var(--faint)'

  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left', cursor: onClick ? 'pointer' : 'default',
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10,
        padding: '8px 10px', marginBottom: 6, position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <TeamBadge team={a} size={30} />
          <span style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 12, lineHeight: 1, color: decided && !aWon ? 'var(--faint)' : 'var(--text)' }}>
            <span style={{ color: 'var(--faint)', fontFamily: 'var(--fm)', marginRight: 3 }}>#{series.higherSeedNum}</span>{a.id}
          </span>
        </div>
        <span style={{ fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{higher}–{lower}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, justifyContent: 'flex-end' }}>
          <span style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 12, lineHeight: 1, textAlign: 'right', color: decided && !bWon ? 'var(--faint)' : 'var(--text)' }}>
            {b.id}<span style={{ color: 'var(--faint)', fontFamily: 'var(--fm)', marginLeft: 3 }}>#{series.lowerSeedNum}</span>
          </span>
          <TeamBadge team={b} size={30} />
        </div>
      </div>
      <div style={{ fontFamily: 'var(--fm)', fontSize: 9, color: noteColor, marginTop: 5, letterSpacing: '.04em' }}>{note}</div>
    </button>
  )
}
