import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import TeamBadge from '../components/TeamBadge'
import PageHeader from '../components/PageHeader'
import type { Team } from '../data/seed'

// Se rastrean los dos mercados de béisbol: GANADOR (moneyline) y TOTAL (over/under).
// El pronóstico del modelo es el lado con mayor probabilidad en cada mercado.

const RES = {
  hit:  { label: 'Acierto', color: 'var(--green)', bg: 'rgba(52,199,123,.13)', bd: 'rgba(52,199,123,.35)' },
  miss: { label: 'Fallo',   color: 'var(--red-b)', bg: 'rgba(232,66,89,.13)', bd: 'rgba(232,66,89,.35)' },
}

const COLS = '74px 1fr 124px 124px'

interface Row {
  id: string; date: string; homeTeam: Team; awayTeam: Team
  realHome: number; realAway: number
  modelWinnerId: string; winnerProb: number; winnerHit: boolean
  totalLabel: 'Over' | 'Under'; totalProb: number; runLine: number; totalHit: boolean
}

function Tile({ label, value, color, border }: { label: string; value: React.ReactNode; color: string; border: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${border}`, borderRadius: 12, padding: '14px 15px' }}>
      <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color }}>{label}</div>
      <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 26, marginTop: 2 }}>{value}</div>
    </div>
  )
}

function Pill({ hit }: { hit: boolean }) {
  const r = hit ? RES.hit : RES.miss
  return (
    <span style={{ display: 'inline-block', fontFamily: 'var(--fm)', fontSize: 9.5, fontWeight: 700, color: r.color, background: r.bg, border: `1px solid ${r.bd}`, padding: '2px 7px', borderRadius: 20, marginTop: 3 }}>
      {r.label}
    </span>
  )
}

export default function Aciertos() {
  const { games, teams, predictions } = useStore()

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    for (const g of games) {
      if (!g.played || g.homeRuns == null || g.awayRuns == null) continue
      const pred = predictions[g.id]
      if (!pred) continue

      const realHomeWon = g.homeRuns > g.awayRuns
      const realOver = g.homeRuns + g.awayRuns > pred.runLine
      const modelPickHome = pred.probHome >= pred.probAway
      const modelOver = pred.probOver >= pred.probUnder

      out.push({
        id: g.id,
        date: new Date(g.date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
        homeTeam: teams[g.homeId], awayTeam: teams[g.awayId],
        realHome: g.homeRuns, realAway: g.awayRuns,
        modelWinnerId: modelPickHome ? g.homeId : g.awayId,
        winnerProb: modelPickHome ? pred.probHome : pred.probAway,
        winnerHit: modelPickHome === realHomeWon,
        totalLabel: modelOver ? 'Over' : 'Under',
        totalProb: modelOver ? pred.probOver : pred.probUnder,
        runLine: pred.runLine,
        totalHit: modelOver === realOver,
      })
    }
    return out
  }, [games, teams, predictions])

  const tally = useMemo(() => {
    const total = rows.length
    const w = rows.filter((r) => r.winnerHit).length
    const t = rows.filter((r) => r.totalHit).length
    const both = rows.filter((r) => r.winnerHit && r.totalHit).length
    const rate = (n: number) => (total ? Math.round((n / total) * 100) : 0)
    return { total, w, t, both, wPct: rate(w), tPct: rate(t), bothPct: rate(both) }
  }, [rows])

  if (rows.length === 0) {
    return (
      <section style={{ animation: 'fadein .3s ease' }}>
        <PageHeader eyebrow="Aciertos · Moneyline + Total" title="Pronóstico vs. resultado" />
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--faint)' }}>
          <p style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 18, color: 'var(--muted)' }}>Sin juegos jugados</p>
          <p style={{ fontSize: 13, marginTop: 6 }}>Los aciertos aparecerán aquí cuando se registren resultados.</p>
        </div>
      </section>
    )
  }

  return (
    <section style={{ animation: 'fadein .3s ease' }}>
      <PageHeader eyebrow="Aciertos · Moneyline + Total" title="Pronóstico vs. resultado" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 18 }}>
        <Tile label={`Ganador · ${tally.w}/${tally.total}`} value={`${tally.wPct}%`} color="var(--green)" border="rgba(52,199,123,.3)" />
        <Tile label={`Total O/U · ${tally.t}/${tally.total}`} value={`${tally.tPct}%`} color="var(--amber)" border="rgba(245,184,65,.3)" />
        <Tile label={`Ambos · ${tally.both}/${tally.total}`} value={`${tally.bothPct}%`} color="var(--blue)" border="rgba(76,154,255,.3)" />
        <Tile label="Juegos" value={tally.total} color="var(--muted)" border="var(--border-2)" />
      </div>

      <div style={{ background: 'linear-gradient(180deg,var(--surface-2),var(--surface))', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--sh)' }}>
        <div className="pn-noscroll" style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 560 }}>
            <div style={{ display: 'grid', gridTemplateColumns: COLS, padding: '11px 16px', fontFamily: 'var(--fm)', fontSize: 10, color: 'var(--faint)', letterSpacing: '.06em', borderBottom: '1px solid var(--border)' }}>
              <span>FECHA</span><span>JUEGO</span><span style={{ textAlign: 'center' }}>GANADOR</span><span style={{ textAlign: 'center' }}>TOTAL (O/U)</span>
            </div>
            <div style={{ padding: '2px 8px' }}>
              {rows.map((r) => (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', padding: '10px 8px', borderRadius: 9 }}>
                  <span style={{ fontFamily: 'var(--fm)', fontSize: 11.5, color: 'var(--faint)' }}>{r.date}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <TeamBadge team={r.awayTeam} size={26} />
                    <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--faint)' }}>@</span>
                    <TeamBadge team={r.homeTeam} size={26} />
                    <span style={{ fontFamily: 'var(--fm)', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginLeft: 4 }}>{r.realAway}–{r.realHome}</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--fm)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                      {r.modelWinnerId} <span style={{ color: 'var(--faint)', fontWeight: 400 }}>{Math.round(r.winnerProb * 100)}%</span>
                    </div>
                    <Pill hit={r.winnerHit} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--fm)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                      {r.totalLabel} {r.runLine} <span style={{ color: 'var(--faint)', fontWeight: 400 }}>{Math.round(r.totalProb * 100)}%</span>
                    </div>
                    <Pill hit={r.totalHit} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
