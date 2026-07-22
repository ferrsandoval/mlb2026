import { useState, useMemo } from 'react'
import { useStore, currentWinsByTeam } from '../store/useStore'
import TeamBadge from '../components/TeamBadge'
import SeriesRow from '../components/SeriesRow'
import PageHeader from '../components/PageHeader'
import SeriesDetail from './SeriesDetail'
import type { Series } from '../data/postseason'
import type { Team, League } from '../data/seed'
import { runMonteCarlo } from '../engine/montecarlo'
import type { MCResult } from '../engine/montecarlo'

const ctrlBtn = (bg: string): React.CSSProperties => ({
  padding: '8px 14px', background: bg, border: 0, borderRadius: 10, color: '#fff',
  fontFamily: 'var(--fu)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer',
})

function seriesWins(s: Series): { higher: number; lower: number } {
  let higher = 0, played = 0
  for (const g of s.games) {
    if (g.homeRuns == null || g.awayRuns == null) continue
    played++
    if ((g.homeRuns > g.awayRuns) === (g.homeId === s.higherSeedId)) higher++
  }
  return { higher, lower: played - higher }
}

function RoundLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: 'var(--fm)', fontSize: 9, color: 'var(--faint)', letterSpacing: '.1em', margin: '12px 0 6px 2px' }}>{children}</div>
}

function BracketColumn({ league, series, teams, onSelect }: { league: League; series: Series[]; teams: Record<string, Team>; onSelect: (id: string) => void }) {
  const round = (r: string) => series.filter((s) => s.round === r)
  const color = league === 'AL' ? 'var(--red-b)' : 'var(--blue)'
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 12, color, letterSpacing: '.08em', textAlign: 'center', marginBottom: 10 }}>
        {league === 'AL' ? 'LIGA AMERICANA' : 'LIGA NACIONAL'}
      </div>
      <RoundLabel>WILD CARD · BO3</RoundLabel>
      {round('WC').length ? round('WC').map((s) => <SeriesRow key={s.id} series={s} teams={teams} onClick={() => onSelect(s.id)} />) : <SeriesRow series={{} as Series} teams={{}} />}
      <RoundLabel>DIVISIONAL · BO5</RoundLabel>
      {round('LDS').length ? round('LDS').map((s) => <SeriesRow key={s.id} series={s} teams={teams} onClick={() => onSelect(s.id)} />) : <SeriesRow series={{} as Series} teams={{}} />}
      <RoundLabel>CAMPEONATO · BO7</RoundLabel>
      {round('LCS').length ? round('LCS').map((s) => <SeriesRow key={s.id} series={s} teams={teams} onClick={() => onSelect(s.id)} />) : <SeriesRow series={{} as Series} teams={{}} />}
    </div>
  )
}

function WorldSeriesCenter({ ws, teams, onSelect }: { ws?: Series; teams: Record<string, Team>; onSelect: (id: string) => void }) {
  const higher = ws ? teams[ws.higherSeedId] : undefined
  const lower = ws ? teams[ws.lowerSeedId] : undefined
  const wins = ws ? seriesWins(ws) : { higher: 0, lower: 0 }
  return (
    <div style={{ width: 118, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <div style={{ fontFamily: 'var(--fm)', fontSize: 9, color: 'var(--amber)', letterSpacing: '.12em', textAlign: 'center' }}>SERIE MUNDIAL</div>
      <div
        onClick={ws ? () => onSelect(ws.id) : undefined}
        style={{ width: '100%', cursor: ws ? 'pointer' : 'default', background: 'radial-gradient(circle at 50% 0%,rgba(245,184,65,.14),transparent 70%)', border: '1px solid rgba(245,184,65,.3)', borderRadius: 14, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
          {higher ? <TeamBadge team={higher} size={40} /> : <div style={{ width: 40, height: 40, borderRadius: 10, border: '1px dashed var(--border-2)' }} />}
          <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--muted)' }}>{wins.higher}</span>
        </div>
        <span style={{ fontFamily: 'var(--fd)', fontSize: 10, color: 'var(--faint)' }}>BO7</span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
          {lower ? <TeamBadge team={lower} size={40} /> : <div style={{ width: 40, height: 40, borderRadius: 10, border: '1px dashed var(--border-2)' }} />}
          <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--muted)' }}>{wins.lower}</span>
        </div>
      </div>
      <div style={{ fontFamily: 'var(--fm)', fontSize: 9, color: 'var(--faint)', textAlign: 'center' }}>Ganador de cada liga</div>
    </div>
  )
}

function MonteCarloPanel() {
  const teams = useStore((s) => s.teams)
  const games = useStore((s) => s.games)
  const [result, setResult] = useState<MCResult | null>(null)
  const [running, setRunning] = useState(false)

  const handleRun = () => {
    setRunning(true)
    setTimeout(() => {
      const remaining = games.filter((g) => !g.played).map((g) => ({ homeId: g.homeId, awayId: g.awayId }))
      const wins = currentWinsByTeam(teams, games)
      setResult(runMonteCarlo(teams, remaining, wins, { n: 1500 }))
      setRunning(false)
    }, 10)
  }

  const rows = result
    ? Object.keys(teams)
        .map((id) => ({
          team: teams[id],
          po: result.madePlayoffs[id] ?? 0,
          dv: result.divisionWinner[id] ?? 0,
          pn: result.wonPennant[id] ?? 0,
          ti: result.champion[id] ?? 0,
        }))
        .sort((a, b) => b.ti - a.ti || b.po - a.po)
        .slice(0, 12)
    : []

  const p = (n: number) => (n * 100).toFixed(n >= 0.995 ? 0 : 1)

  return (
    <div style={{ background: 'linear-gradient(180deg,var(--surface-2),var(--surface))', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--sh)' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 14 }}>Probabilidades Monte Carlo</div>
          <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>1 500 simulaciones · resto de temporada + playoffs</div>
        </div>
        <button onClick={handleRun} disabled={running} style={{ ...ctrlBtn('var(--navy)'), border: '1px solid var(--border-2)', opacity: running ? 0.6 : 1 }}>
          {running ? 'Calculando…' : 'Simular'}
        </button>
      </div>
      {result ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 46px 46px 46px 52px', padding: '9px 16px', fontFamily: 'var(--fm)', fontSize: 9.5, color: 'var(--faint)', letterSpacing: '.05em', borderBottom: '1px solid var(--border)' }}>
            <span>EQUIPO</span><span style={{ textAlign: 'center' }}>PO</span><span style={{ textAlign: 'center' }}>DIV</span><span style={{ textAlign: 'center' }}>LIGA</span><span style={{ textAlign: 'right' }}>TÍTULO</span>
          </div>
          <div style={{ padding: '2px 8px' }}>
            {rows.map((m) => (
              <div key={m.team.id} style={{ display: 'grid', gridTemplateColumns: '1fr 46px 46px 46px 52px', alignItems: 'center', padding: '9px 8px', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><TeamBadge team={m.team} size={30} /><span style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 13 }}>{m.team.id}</span></div>
                <span style={{ fontFamily: 'var(--fm)', fontSize: 12, textAlign: 'center', color: 'var(--muted)' }}>{p(m.po)}</span>
                <span style={{ fontFamily: 'var(--fm)', fontSize: 12, textAlign: 'center', color: 'var(--muted)' }}>{p(m.dv)}</span>
                <span style={{ fontFamily: 'var(--fm)', fontSize: 12, textAlign: 'center', color: 'var(--text)' }}>{p(m.pn)}</span>
                <span style={{ fontFamily: 'var(--fm)', fontSize: 13, textAlign: 'right', fontWeight: 700, color: 'var(--amber)' }}>{p(m.ti)}%</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p style={{ padding: '28px 16px', textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>
          Simula el resto de la temporada y la postemporada completa para estimar % de cada equipo.
        </p>
      )}
    </div>
  )
}

export default function Postseason() {
  const teams = useStore((s) => s.teams)
  const postseasonSeries = useStore((s) => s.postseasonSeries)
  const generatePostseason = useStore((s) => s.generatePostseason)
  const autoAdvancePostseason = useStore((s) => s.autoAdvancePostseason)
  const resetPostseason = useStore((s) => s.resetPostseason)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const ws = useMemo(() => postseasonSeries.find((s) => s.round === 'WS'), [postseasonSeries])

  if (selectedId) {
    const series = postseasonSeries.find((s) => s.id === selectedId)
    if (series) return <SeriesDetail series={series} teams={teams} onBack={() => setSelectedId(null)} />
  }

  const byLeague = (league: League) => postseasonSeries.filter((s) => s.league === league)
  const hasBracket = postseasonSeries.length > 0

  return (
    <section style={{ animation: 'fadein .3s ease' }}>
      <PageHeader
        eyebrow="Postemporada · Bracket"
        title="Camino a la Serie Mundial"
        right={
          <>
            <button onClick={() => generatePostseason()} style={ctrlBtn('var(--navy)')}>Generar</button>
            <button onClick={() => autoAdvancePostseason()} style={ctrlBtn('var(--green-d)')}>Avanzar favoritos</button>
            {!confirmReset ? (
              <button onClick={() => setConfirmReset(true)} style={{ padding: '8px 12px', background: 'transparent', border: '1px solid rgba(232,66,89,.3)', borderRadius: 10, color: 'var(--red-b)', fontFamily: 'var(--fu)', fontSize: 12.5, cursor: 'pointer' }}>Reiniciar</button>
            ) : (
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button onClick={() => { resetPostseason(); setConfirmReset(false) }} style={{ ...ctrlBtn('var(--red)'), fontSize: 12 }}>Confirmar</button>
                <button onClick={() => setConfirmReset(false)} style={{ padding: '8px 12px', background: 'var(--surface-2)', border: 0, borderRadius: 10, color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
              </span>
            )}
          </>
        }
      />

      <div className="pn-two-col">
        <div style={{ background: 'linear-gradient(180deg,var(--surface-2),var(--surface))', border: '1px solid var(--border)', borderRadius: 16, padding: 18, boxShadow: 'var(--sh)', overflowX: 'auto' }} className="pn-noscroll">
          {hasBracket ? (
            <div style={{ display: 'flex', gap: 10, minWidth: 520 }}>
              <BracketColumn league="AL" series={byLeague('AL')} teams={teams} onSelect={setSelectedId} />
              <WorldSeriesCenter ws={ws} teams={teams} onSelect={setSelectedId} />
              <BracketColumn league="NL" series={byLeague('NL')} teams={teams} onSelect={setSelectedId} />
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 10px' }}>
              <p style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Sin postemporada generada</p>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>Presiona <strong>Generar</strong> para armar la ronda de Comodín con los 6 clasificados de cada liga.</p>
            </div>
          )}
        </div>

        <MonteCarloPanel />
      </div>
    </section>
  )
}
