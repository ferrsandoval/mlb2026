import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { computeDivisionStandings, computeLeagueStandings, computeWildCardStandings } from '../engine/standings'
import type { TeamStanding, WildCardStanding } from '../engine/standings'
import { ALL_DIVISION_KEYS, DIVISION_LABELS } from '../data/seed'
import type { DivisionKey, League } from '../data/seed'
import TeamBadge from '../components/TeamBadge'
import PageHeader from '../components/PageHeader'

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg,var(--surface-2),var(--surface))',
  border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--sh)',
}
const headStyle: React.CSSProperties = {
  padding: '12px 15px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
}

function DivisionCard({ name, rows }: { name: string; rows: TeamStanding[] }) {
  return (
    <div style={cardStyle}>
      <div style={headStyle}>
        <span style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 14 }}>{name}</span>
        <span style={{ fontFamily: 'var(--fm)', fontSize: 10, color: 'var(--faint)', letterSpacing: '.08em' }}>V · D · PROY · DIF</span>
      </div>
      <div style={{ padding: '4px 6px' }}>
        {rows.map((s, i) => {
          const rd = s.runDiff
          const rdColor = rd > 0 ? 'var(--green)' : rd < 0 ? 'var(--red-b)' : 'var(--muted)'
          return (
            <div key={s.team.id} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 30px 30px 44px 48px', alignItems: 'center', gap: 6, padding: '8px 9px', borderRadius: 9, borderLeft: i === 0 ? '2px solid var(--green)' : '2px solid transparent' }}>
              <span style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--faint)', textAlign: 'center' }}>{i + 1}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                <TeamBadge team={s.team} size={34} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 13.5, lineHeight: 1 }}>{s.team.id}</div>
                  <div style={{ fontFamily: 'var(--fm)', fontSize: 10, color: 'var(--faint)', marginTop: 2 }}>
                    Elo {Math.round(s.team.elo)}
                    {s.pythWinPct != null && <span title="% de victorias merecido según diferencial de carreras (Pythagenpat)"> · Pyth {s.pythWinPct.toFixed(3).replace(/^0/, '')}</span>}
                  </div>
                </div>
              </div>
              <span style={{ fontFamily: 'var(--fm)', fontSize: 13, textAlign: 'center', fontWeight: 700 }}>{s.wins}</span>
              <span style={{ fontFamily: 'var(--fm)', fontSize: 13, textAlign: 'center', color: 'var(--muted)' }}>{s.losses}</span>
              <span style={{ fontFamily: 'var(--fm)', fontSize: 13, textAlign: 'center', color: 'var(--blue)' }}>{Math.round(s.projWins)}</span>
              <span style={{ fontFamily: 'var(--fm)', fontSize: 12.5, textAlign: 'right', color: rdColor, fontWeight: 700 }}>{rd > 0 ? '+' : ''}{Math.round(rd)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WildcardCard({ name, rows }: { name: string; rows: WildCardStanding[] }) {
  return (
    <div style={cardStyle}>
      <div style={headStyle}>
        <span style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 14 }}>{name}</span>
        <span style={{ fontFamily: 'var(--fm)', fontSize: 10, color: 'var(--faint)', letterSpacing: '.08em' }}>GB · PROY</span>
      </div>
      <div style={{ padding: '4px 6px' }}>
        {rows.map((s, i) => {
          const inZone = i < 3
          return (
            <div key={s.team.id} style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto 44px', alignItems: 'center', gap: 8, padding: '8px 9px', borderRadius: 9 }}>
              <span style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--faint)', textAlign: 'center' }}>{i + 1}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                <TeamBadge team={s.team} size={34} />
                <span style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 13.5 }}>{s.team.id}</span>
                {inZone && <span style={{ fontFamily: 'var(--fm)', fontSize: 9, color: 'var(--green)', border: '1px solid rgba(52,199,123,.4)', borderRadius: 5, padding: '1px 5px' }}>WC</span>}
              </div>
              <span style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--muted)' }}>{s.gamesBackWC <= 0.05 ? '—' : s.gamesBackWC.toFixed(1)}</span>
              <span style={{ fontFamily: 'var(--fm)', fontSize: 13, textAlign: 'center', color: 'var(--blue)', fontWeight: 700 }}>{Math.round(s.projWins)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Standings() {
  const teams = useStore((s) => s.teams)
  const games = useStore((s) => s.games)
  const predictions = useStore((s) => s.predictions)

  const divisions = useMemo(
    () => ALL_DIVISION_KEYS.map((d) => ({ key: d, rows: computeDivisionStandings(d as DivisionKey, games, teams, predictions) })),
    [games, teams, predictions],
  )

  const wildcards = useMemo(() => (['AL', 'NL'] as League[]).map((league) => {
    const leagueStandings = computeLeagueStandings(league, games, teams, predictions)
    const winnerIds = new Set(
      ALL_DIVISION_KEYS.filter((d) => d.startsWith(league)).map((d) => computeDivisionStandings(d as DivisionKey, games, teams, predictions)[0]?.team.id).filter(Boolean) as string[],
    )
    return { league, rows: computeWildCardStandings(leagueStandings, winnerIds).slice(0, 8) }
  }), [games, teams, predictions])

  const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(330px,1fr))', gap: 14 }

  return (
    <section style={{ animation: 'fadein .3s ease' }}>
      <PageHeader
        eyebrow="Posiciones · Standings"
        title="División y carrera de comodín"
        subtitle="Victorias proyectadas = récord real + expectativa del modelo (Elo + ataque/defensa, marcador Binomial Negativa). «Pyth» es el % de victorias merecido según el diferencial de carreras (Pythagenpat)."
      />

      <div style={grid}>
        {divisions.map(({ key, rows }) => <DivisionCard key={key} name={DIVISION_LABELS[key]} rows={rows} />)}
      </div>

      <h2 style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 18, margin: '26px 0 12px', letterSpacing: '-.01em' }}>
        Carrera de comodín <span style={{ color: 'var(--faint)', fontSize: 13, fontWeight: 400, fontFamily: 'var(--fu)' }}>· 3 clasifican por liga</span>
      </h2>
      <div style={grid}>
        {wildcards.map(({ league, rows }) => (
          <WildcardCard key={league} name={`Comodín · Liga ${league === 'AL' ? 'Americana' : 'Nacional'}`} rows={rows} />
        ))}
      </div>
    </section>
  )
}
