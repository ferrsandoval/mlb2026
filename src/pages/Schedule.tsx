import { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import GameCard from '../components/GameCard'
import GameDetail from './GameDetail'
import PageHeader from '../components/PageHeader'
import { TEAMS } from '../data/seed'
import { analyzeValue } from '../engine/value'

const chipBtn: React.CSSProperties = {
  padding: '8px 12px', background: 'transparent', border: 0, color: 'var(--muted)',
  fontFamily: 'var(--fu)', fontSize: 13, cursor: 'pointer',
}

function StatChip({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
      <div style={{ color: 'var(--faint)', fontFamily: 'var(--fm)', fontSize: 11 }}>{label}</div>
      <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 18, marginTop: 2, color: color ?? 'var(--text)' }}>{value}</div>
    </div>
  )
}

export default function Schedule() {
  const { teams, games, predictions, odds, valueThreshold, kellyFraction, scheduleSource, syncSchedule } = useStore()
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<string>('')
  const [syncMsg, setSyncMsg] = useState('')
  const [syncing, setSyncing] = useState(false)

  const allDates = useMemo(() => [...new Set(games.map((g) => g.date))].sort(), [games])
  const [dateIdx, setDateIdx] = useState(() => {
    const today = new Date().toISOString().slice(0, 10)
    const idx = allDates.findIndex((d) => d >= today)
    return idx === -1 ? 0 : idx
  })
  const activeDate = allDates[dateIdx] ?? allDates[0]

  const dateGames = useMemo(() => games.filter((g) => g.date === activeDate), [games, activeDate])
  const teamGames = useMemo(
    () => games.filter((g) => g.homeId === selectedTeam || g.awayId === selectedTeam).sort((a, b) => a.date.localeCompare(b.date)),
    [games, selectedTeam],
  )
  const byTeam = selectedTeam !== ''
  const shown = byTeam ? teamGames : dateGames

  const valueCount = useMemo(() => shown.filter((g) => {
    const o = odds[g.id]; const p = predictions[g.id]
    if (!o || !p) return false
    const va = analyzeValue(o, { home: p.probHome, away: p.probAway }, valueThreshold, kellyFraction)
    return !!va && (va.markets.home.hasValue || va.markets.away.hasValue)
  }).length, [shown, odds, predictions, valueThreshold, kellyFraction])

  const doneCount = shown.filter((g) => g.played).length

  // Aciertos/fallos del día (juegos terminados): ganador y total (over/under).
  const dayTally = useMemo(() => {
    let wHit = 0, wMiss = 0, tHit = 0, tMiss = 0
    for (const g of shown) {
      if (!g.played || g.homeRuns == null || g.awayRuns == null) continue
      const p = predictions[g.id]
      if (!p) continue
      const realHomeWon = g.homeRuns > g.awayRuns
      const realOver = g.homeRuns + g.awayRuns > p.runLine
      if ((p.probHome >= p.probAway) === realHomeWon) wHit++; else wMiss++
      if ((p.probOver >= p.probUnder) === realOver) tHit++; else tMiss++
    }
    return { wHit, wMiss, tHit, tMiss }
  }, [shown, predictions])

  const handleSyncSchedule = async () => {
    setSyncing(true); setSyncMsg('')
    try {
      const r = await syncSchedule()
      const pitcherTxt = r.rated > 0 ? ` · ${r.rated} abridores con rating FIP` : ''
      setSyncMsg(`✓ Calendario oficial cargado (${r.added} juegos${r.unmatched.length ? `, ${r.unmatched.length} sin coincidencia` : ''})${pitcherTxt}`)
    } catch { setSyncMsg('✗ Error al sincronizar calendario') }
    setSyncing(false)
  }

  if (selectedGameId) {
    const game = games.find((g) => g.id === selectedGameId)
    const pred = game && predictions[game.id]
    if (game && pred) {
      return (
        <GameDetail
          game={game}
          homeTeam={teams[game.homeId]}
          awayTeam={teams[game.awayId]}
          prediction={pred}
          onBack={() => setSelectedGameId(null)}
        />
      )
    }
  }

  const title = byTeam
    ? teams[selectedTeam]?.name ?? 'Equipo'
    : activeDate
      ? new Date(activeDate + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : '—'

  return (
    <section style={{ animation: 'fadein .3s ease' }}>
      <PageHeader
        eyebrow="Calendario · Schedule"
        title={title.charAt(0).toUpperCase() + title.slice(1)}
        right={
          <>
            {!byTeam && (
              <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <button style={chipBtn} onClick={() => setDateIdx((i) => Math.max(0, i - 1))}>‹</button>
                <button style={{ ...chipBtn, background: 'var(--surface-2)', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--fm)', fontSize: 12 }}
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10)
                    const idx = allDates.findIndex((d) => d >= today)
                    setDateIdx(idx === -1 ? 0 : idx)
                  }}>Hoy</button>
                <button style={chipBtn} onClick={() => setDateIdx((i) => Math.min(allDates.length - 1, i + 1))}>›</button>
              </div>
            )}
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              style={{ padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontFamily: 'var(--fu)', fontSize: 13, cursor: 'pointer' }}
            >
              <option value="">Todos los equipos</option>
              {TEAMS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </>
        }
      />

      {/* Sincronización con MLB Stats API */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16, fontFamily: 'var(--fm)', fontSize: 11 }}>
        <span style={{ color: 'var(--faint)' }}>Fuente: {scheduleSource === 'synthetic' ? 'calendario sintético' : 'oficial MLB Stats API'}</span>
        <button onClick={handleSyncSchedule} disabled={syncing}
          style={{ padding: '5px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', cursor: syncing ? 'wait' : 'pointer', fontSize: 11 }}>
          Sincronizar calendario oficial
        </button>
        {syncMsg && <span style={{ color: 'var(--muted)' }}>{syncMsg}</span>}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <StatChip label="Juegos" value={shown.length} />
        <StatChip label="Con valor" value={valueCount} color="var(--green)" />
        <StatChip label="Finalizados" value={doneCount} />
        {doneCount > 0 && (
          <StatChip label="Ganador (día)" value={<><span style={{ color: 'var(--green)' }}>{dayTally.wHit}✓</span> <span style={{ color: 'var(--red-b)' }}>{dayTally.wMiss}✗</span></>} />
        )}
        {doneCount > 0 && (
          <StatChip label="Total O/U (día)" value={<><span style={{ color: 'var(--green)' }}>{dayTally.tHit}✓</span> <span style={{ color: 'var(--red-b)' }}>{dayTally.tMiss}✗</span></>} />
        )}
      </div>

      {shown.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'var(--faint)' }}>Sin juegos para mostrar.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 12 }}>
          {shown.map((game) => {
            const pred = predictions[game.id]
            if (!pred) return null
            return (
              <GameCard
                key={game.id}
                game={game}
                homeTeam={teams[game.homeId]}
                awayTeam={teams[game.awayId]}
                prediction={pred}
                onClick={() => setSelectedGameId(game.id)}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
