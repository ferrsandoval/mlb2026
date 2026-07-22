import { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import GameCard from '../components/GameCard'
import GameDetail from './GameDetail'
import { TEAMS } from '../data/seed'

type FilterMode = 'date' | 'team'

export default function Schedule() {
  const { teams, games, predictions, personalPicks, scheduleSource, syncSchedule, syncScores } = useStore()
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)
  const [filterMode, setFilterMode] = useState<FilterMode>('date')
  const [selectedTeam, setSelectedTeam] = useState<string>(TEAMS[0].id)
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

  const shown = filterMode === 'date' ? dateGames : teamGames

  const handleSyncSchedule = async () => {
    setSyncing(true)
    setSyncMsg('')
    try {
      const r = await syncSchedule()
      setSyncMsg(`✓ Calendario oficial cargado (${r.added} juegos${r.unmatched.length ? `, ${r.unmatched.length} sin coincidencia` : ''})`)
    } catch {
      setSyncMsg('✗ Error al sincronizar calendario')
    }
    setSyncing(false)
  }

  const handleSyncScores = async () => {
    setSyncing(true)
    setSyncMsg('')
    try {
      const r = await syncScores()
      setSyncMsg(r.errors.length ? '✗ ' + r.errors[0] : `✓ ${r.updated} resultado${r.updated !== 1 ? 's' : ''} actualizado${r.updated !== 1 ? 's' : ''}`)
    } catch {
      setSyncMsg('✗ Error al sincronizar resultados')
    }
    setSyncing(false)
  }

  if (selectedGameId) {
    const game = games.find((g) => g.id === selectedGameId)!
    return (
      <GameDetail
        game={game}
        homeTeam={teams[game.homeId]}
        awayTeam={teams[game.awayId]}
        prediction={predictions[game.id]}
        onBack={() => setSelectedGameId(null)}
      />
    )
  }

  return (
    <div>
      {/* Barra de sincronización */}
      <div className="mb-4 rounded-xl p-3 flex flex-wrap items-center gap-2" style={{ backgroundColor: 'var(--color-bg-card)' }}>
        <span className="text-xs" style={{ color: 'var(--color-gray-light)', opacity: 0.5 }}>
          Calendario: {scheduleSource === 'synthetic' ? 'sintético (placeholder)' : 'oficial MLB Stats API'}
        </span>
        <div className="flex-1" />
        <button onClick={handleSyncSchedule} disabled={syncing}
          className="text-xs font-bold px-3 py-1.5 rounded-full"
          style={{ backgroundColor: 'var(--color-primary)', color: 'white', opacity: syncing ? 0.6 : 1 }}>
          Sincronizar calendario oficial
        </button>
        <button onClick={handleSyncScores} disabled={syncing}
          className="text-xs font-bold px-3 py-1.5 rounded-full"
          style={{ backgroundColor: 'var(--color-positive)', color: 'white', opacity: syncing ? 0.6 : 1 }}>
          Sincronizar resultados
        </button>
        {syncMsg && <span className="text-xs" style={{ color: 'var(--color-gray-light)' }}>{syncMsg}</span>}
      </div>

      {/* Controles de filtro */}
      <div className="mb-5 space-y-2">
        <div className="flex gap-2 flex-wrap">
          {([['date', 'Por Fecha'], ['team', 'Por Equipo']] as [FilterMode, string][]).map(([mode, label]) => (
            <button key={mode} onClick={() => setFilterMode(mode)}
              className="text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide transition-colors"
              style={{ backgroundColor: filterMode === mode ? 'var(--color-primary)' : 'var(--color-bg-card)', color: 'var(--color-gray-light)' }}>
              {label}
            </button>
          ))}
        </div>

        {filterMode === 'date' ? (
          <div className="flex items-center gap-3">
            <button onClick={() => setDateIdx((i) => Math.max(0, i - 1))}
              className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: 'var(--color-bg-card)', color: 'var(--color-gray-light)' }}>←</button>
            <span className="text-sm font-bold" style={{ color: 'var(--color-gray-light)' }}>
              {activeDate ? new Date(activeDate + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }) : '—'}
            </span>
            <button onClick={() => setDateIdx((i) => Math.min(allDates.length - 1, i + 1))}
              className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: 'var(--color-bg-card)', color: 'var(--color-gray-light)' }}>→</button>
          </div>
        ) : (
          <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--color-bg-card)', color: 'var(--color-gray-light)', border: '1px solid var(--color-primary)' }}>
            {TEAMS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>

      <div className="space-y-3">
        {shown.length === 0 && (
          <p className="text-center py-10 text-sm" style={{ color: 'var(--color-gray-light)', opacity: 0.4 }}>Sin juegos para mostrar.</p>
        )}
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
              personalPick={personalPicks[game.id]}
              onClick={() => setSelectedGameId(game.id)}
            />
          )
        })}
      </div>
    </div>
  )
}
