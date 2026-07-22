import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import TeamBadge from '../components/TeamBadge'
import PageHeader from '../components/PageHeader'
import type { GamePrediction } from '../types'
import type { Team } from '../data/seed'

type ResultCheck = 'exact' | 'outcome' | 'miss' | 'none'

function checkResult(pick: { homeRuns: number; awayRuns: number } | undefined, realHome: number, realAway: number): ResultCheck {
  if (!pick) return 'none'
  if (pick.homeRuns === realHome && pick.awayRuns === realAway) return 'exact'
  const realOut = realHome > realAway ? 'home' : 'away'
  const pickOut = pick.homeRuns >= pick.awayRuns ? 'home' : 'away'
  return realOut === pickOut ? 'outcome' : 'miss'
}

const RES: Record<Exclude<ResultCheck, 'none'>, { label: string; color: string; bg: string; bd: string }> = {
  exact:   { label: 'Exacto',  color: 'var(--green)', bg: 'rgba(52,199,123,.13)', bd: 'rgba(52,199,123,.35)' },
  outcome: { label: 'Ganador', color: 'var(--amber)', bg: 'rgba(245,184,65,.13)', bd: 'rgba(245,184,65,.35)' },
  miss:    { label: 'Fallo',   color: 'var(--red-b)', bg: 'rgba(232,66,89,.13)', bd: 'rgba(232,66,89,.35)' },
}

const COLS = '92px 1fr 88px 88px 104px'

interface Row {
  id: string; date: string; homeTeam: Team; awayTeam: Team
  realHome: number; realAway: number
  model?: { homeRuns: number; awayRuns: number }
  pick?: { homeRuns: number; awayRuns: number }
  result: ResultCheck
}

function Tile({ label, value, color, border }: { label: string; value: React.ReactNode; color: string; border: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${border}`, borderRadius: 12, padding: '14px 15px' }}>
      <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color }}>{label}</div>
      <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 26, marginTop: 2 }}>{value}</div>
    </div>
  )
}

export default function Aciertos() {
  const { games, teams, predictions, personalPicks } = useStore()

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    for (const g of games) {
      if (!g.played || g.homeRuns == null || g.awayRuns == null) continue
      const pred = predictions[g.id] as GamePrediction | undefined
      const top = pred?.topScorelines[0]
      const model = top ? { homeRuns: top.home, awayRuns: top.away } : undefined
      out.push({
        id: g.id,
        date: new Date(g.date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
        homeTeam: teams[g.homeId], awayTeam: teams[g.awayId],
        realHome: g.homeRuns, realAway: g.awayRuns,
        model, pick: personalPicks[g.id],
        result: checkResult(model, g.homeRuns, g.awayRuns),
      })
    }
    return out
  }, [games, teams, predictions, personalPicks])

  const tally = useMemo(() => {
    const exact = rows.filter((r) => r.result === 'exact').length
    const winner = rows.filter((r) => r.result === 'outcome').length
    const miss = rows.filter((r) => r.result === 'miss').length
    const total = rows.length
    const pct = total ? Math.round(((exact + winner) / total) * 100) : 0
    return { exact, winner, miss, pct }
  }, [rows])

  if (rows.length === 0) {
    return (
      <section style={{ animation: 'fadein .3s ease' }}>
        <PageHeader eyebrow="Aciertos · Historial" title="Modelo vs. resultado real" />
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--faint)' }}>
          <p style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 18, color: 'var(--muted)' }}>Sin juegos jugados</p>
          <p style={{ fontSize: 13, marginTop: 6 }}>Los aciertos aparecerán aquí cuando se registren resultados.</p>
        </div>
      </section>
    )
  }

  return (
    <section style={{ animation: 'fadein .3s ease' }}>
      <PageHeader eyebrow="Aciertos · Historial" title="Modelo vs. resultado real" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 18 }}>
        <Tile label="Exactos" value={tally.exact} color="var(--green)" border="rgba(52,199,123,.3)" />
        <Tile label="Ganador acertado" value={tally.winner} color="var(--amber)" border="rgba(245,184,65,.3)" />
        <Tile label="Fallos" value={tally.miss} color="var(--red-b)" border="rgba(232,66,89,.3)" />
        <Tile label="Tasa de acierto" value={`${tally.pct}%`} color="var(--muted)" border="var(--border-2)" />
      </div>

      <div style={{ background: 'linear-gradient(180deg,var(--surface-2),var(--surface))', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--sh)' }}>
        <div className="pn-noscroll" style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 520 }}>
            <div style={{ display: 'grid', gridTemplateColumns: COLS, padding: '11px 16px', fontFamily: 'var(--fm)', fontSize: 10, color: 'var(--faint)', letterSpacing: '.06em', borderBottom: '1px solid var(--border)' }}>
              <span>FECHA</span><span>JUEGO</span><span style={{ textAlign: 'center' }}>MODELO</span><span style={{ textAlign: 'center' }}>REAL</span><span style={{ textAlign: 'right' }}>RESULTADO</span>
            </div>
            <div style={{ padding: '2px 8px' }}>
              {rows.map((r) => {
                const res = r.result === 'none' ? null : RES[r.result]
                return (
                  <div key={r.id} style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', padding: '11px 8px', borderRadius: 9 }}>
                    <span style={{ fontFamily: 'var(--fm)', fontSize: 11.5, color: 'var(--faint)' }}>{r.date}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <TeamBadge team={r.awayTeam} size={26} />
                      <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--faint)' }}>@</span>
                      <TeamBadge team={r.homeTeam} size={26} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--muted)' }}>{r.model ? `${r.model.awayRuns}–${r.model.homeRuns}` : '—'}</div>
                      {r.pick && <div style={{ fontFamily: 'var(--fm)', fontSize: 9.5, color: 'var(--red-b)', marginTop: 1 }}>tú {r.pick.awayRuns}–{r.pick.homeRuns}</div>}
                    </div>
                    <span style={{ fontFamily: 'var(--fm)', fontSize: 13, textAlign: 'center', fontWeight: 700 }}>{r.realAway}–{r.realHome}</span>
                    <span style={{ justifySelf: 'end', fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, color: res ? res.color : 'var(--faint)', background: res ? res.bg : 'transparent', border: `1px solid ${res ? res.bd : 'var(--border)'}`, padding: '3px 9px', borderRadius: 20 }}>
                      {res ? res.label : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
