import { useMemo, memo } from 'react'
import { useStore } from '../store/useStore'
import { computeDivisionStandings, computeLeagueStandings, computeWildCardStandings } from '../engine/standings'
import type { TeamStanding } from '../engine/standings'
import { ALL_DIVISION_KEYS, DIVISION_LABELS } from '../data/seed'
import type { DivisionKey, League } from '../data/seed'
import TeamBadge from '../components/TeamBadge'

const fmt1 = (n: number) => n.toFixed(1)

function StandingsTable({ title, rows, highlightTop }: { title: string; rows: TeamStanding[]; highlightTop: number }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
      <div className="px-4 py-2.5" style={{ backgroundColor: 'var(--color-primary)' }}>
        <span className="font-black text-xl text-white">{title}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: '520px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <th className="text-left px-3 py-2 text-xs uppercase font-bold opacity-50 w-6" style={{ color: 'var(--color-gray-light)' }}>#</th>
              <th className="text-left px-3 py-2 text-xs uppercase font-bold opacity-50" style={{ color: 'var(--color-gray-light)' }}>Equipo</th>
              <th className="text-center px-2 py-2 text-xs uppercase font-bold opacity-50" style={{ color: 'var(--color-gray-light)' }}>G</th>
              <th className="text-center px-2 py-2 text-xs uppercase font-bold opacity-50" style={{ color: 'var(--color-gray-light)' }}>P</th>
              <th className="text-center px-2 py-2 text-xs uppercase font-bold opacity-50" style={{ color: 'var(--color-gray-light)' }}>Proy. G</th>
              <th className="text-center px-2 py-2 text-xs uppercase font-bold opacity-50" style={{ color: 'var(--color-gray-light)' }}>DifC</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={s.team.id} style={{
                borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                borderLeft: i < highlightTop ? '3px solid var(--color-positive)' : '3px solid transparent',
              }}>
                <td className="px-3 py-2.5 font-black text-base text-center" style={{ color: i < highlightTop ? 'var(--color-positive)' : 'var(--color-gray-dark)' }}>{i + 1}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <TeamBadge team={s.team} size="sm" />
                    <span className="font-bold" style={{ color: 'var(--color-gray-light)' }}>{s.team.name}</span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--color-gray-light)', opacity: 0.4 }}>Elo {s.team.elo}</div>
                </td>
                <td className="px-2 py-2.5 text-center font-bold" style={{ color: 'var(--color-gray-light)' }}>{s.wins}</td>
                <td className="px-2 py-2.5 text-center" style={{ color: 'var(--color-gray-light)', opacity: 0.7 }}>{s.losses}</td>
                <td className="px-2 py-2.5 text-center font-black" style={{ color: i < highlightTop ? 'var(--color-positive)' : 'var(--color-gray-light)' }}>{fmt1(s.projWins)}</td>
                <td className="px-2 py-2.5 text-center text-xs font-bold" style={{ color: s.runDiff >= 0 ? 'var(--color-positive)' : 'var(--color-accent)' }}>
                  {s.runDiff >= 0 ? '+' : ''}{fmt1(s.runDiff)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const LeagueBlock = memo(function LeagueBlock({ league }: { league: League }) {
  const teams = useStore((s) => s.teams)
  const games = useStore((s) => s.games)
  const predictions = useStore((s) => s.predictions)

  const divisions = ALL_DIVISION_KEYS.filter((d) => d.startsWith(league)) as DivisionKey[]

  const divisionStandings = useMemo(
    () => Object.fromEntries(divisions.map((d) => [d, computeDivisionStandings(d, games, teams, predictions)])),
    [divisions, games, teams, predictions],
  )

  const wildCard = useMemo(() => {
    const leagueStandings = computeLeagueStandings(league, games, teams, predictions)
    const winnerIds = new Set(Object.values(divisionStandings).map((s) => s[0]?.team.id).filter(Boolean) as string[])
    return computeWildCardStandings(leagueStandings, winnerIds)
  }, [league, games, teams, predictions, divisionStandings])

  return (
    <div className="space-y-4">
      <h2 className="font-black text-2xl uppercase" style={{ color: 'var(--color-gray-light)' }}>{league === 'AL' ? 'Liga Americana' : 'Liga Nacional'}</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {divisions.map((d) => (
          <StandingsTable key={d} title={DIVISION_LABELS[d]} rows={divisionStandings[d]} highlightTop={1} />
        ))}
      </div>
      <StandingsTable title="Carrera de Comodín" rows={wildCard} highlightTop={3} />
    </div>
  )
})

export default function Standings() {
  return (
    <div className="space-y-8">
      <LeagueBlock league="AL" />
      <LeagueBlock league="NL" />
      <div className="text-xs px-1" style={{ color: 'var(--color-gray-light)', opacity: 0.4 }}>
        Proy. G = victorias reales + esperadas (modelo Elo+Poisson) de juegos pendientes · Verde = clasifica a Postemporada
      </div>
    </div>
  )
}
