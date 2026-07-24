import { useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import TeamBadge from '../components/TeamBadge'
import PageHeader from '../components/PageHeader'

export default function Settings() {
  const {
    teams, games, setTeamElo, setTeamAttack, setTeamDefense, registerResult,
    exportJSON, importJSON, resetToSeed,
    pitchers, syncPitchers, calibrateFromHistory,
  } = useStore()

  const [resultGameId, setResultGameId] = useState('')
  const [homeRuns, setHomeRuns] = useState('')
  const [awayRuns, setAwayRuns] = useState('')
  const [resultMsg, setResultMsg] = useState('')
  const [msg, setMsg] = useState('')
  const [modelMsg, setModelMsg] = useState('')
  const [pitcherBusy, setPitcherBusy] = useState(false)
  const [calibBusy, setCalibBusy] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  const pendingGames = games.filter((g) => !g.played).slice(0, 500)

  const flash = (text: string, setter: (s: string) => void) => { setter(text); setTimeout(() => setter(''), 4000) }

  const handleRegister = () => {
    if (!resultGameId || homeRuns === '' || awayRuns === '') return
    const h = parseInt(homeRuns, 10), a = parseInt(awayRuns, 10)
    if (isNaN(h) || isNaN(a) || h === a) return
    registerResult(resultGameId, h, a)
    const g = games.find((x) => x.id === resultGameId)!
    flash(`✓ Resultado registrado: ${teams[g.homeId].id} ${h}–${a} ${teams[g.awayId].id}`, setResultMsg)
    setResultGameId(''); setHomeRuns(''); setAwayRuns('')
  }

  const handleExport = () => {
    const json = exportJSON()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mlb2026-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    flash('✓ Exportado correctamente', setMsg)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => { importJSON(ev.target?.result as string); flash('✓ Importado correctamente', setMsg) }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleSyncPitchers = async () => {
    setPitcherBusy(true); setModelMsg('')
    try {
      const r = await syncPitchers()
      if (r.errors.length) setModelMsg(`⚠ ${r.errors[0]}`)
      else setModelMsg(`✓ ${r.rated} abridor${r.rated !== 1 ? 'es' : ''} con rating FIP · ${r.patched} juego${r.patched !== 1 ? 's' : ''} actualizado${r.patched !== 1 ? 's' : ''}`)
    } catch { setModelMsg('⚠ Error al sincronizar abridores') }
    setPitcherBusy(false)
  }

  const handleCalibrate = async () => {
    setCalibBusy(true); setModelMsg('')
    try {
      const r = await calibrateFromHistory()
      if (r.errors.length) setModelMsg(`⚠ ${r.errors[0]}`)
      else {
        const brierTxt = r.brier != null ? ` · Brier ${r.brier.toFixed(4)} (volado = 0.25)` : ''
        setModelMsg(`✓ ${r.teamsUpdated} equipos calibrados con ${r.games.toLocaleString('es-MX')} juegos${brierTxt}`)
      }
    } catch { setModelMsg('⚠ Error al calibrar con historial') }
    setCalibBusy(false)
  }

  const handleReset = () => {
    if (confirm('¿Reiniciar todo al estado semilla? Se perderán los resultados registrados.')) {
      resetToSeed()
      flash('✓ Estado reiniciado', setMsg)
    }
  }

  const sortedTeams = Object.values(teams).sort((a, b) => a.league.localeCompare(b.league) || a.division.localeCompare(b.division) || a.name.localeCompare(b.name))

  return (
    <section className="space-y-8" style={{ animation: 'fadein .3s ease' }}>
      <PageHeader eyebrow="Ajustes · Configuración" title="Datos, ratings y resultados" />

      {/* Modelo estadístico (béisbol) */}
      <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--color-bg-card)', borderLeft: '3px solid var(--color-primary-light)' }}>
        <h2 className="font-black text-2xl uppercase mb-1" style={{ color: 'var(--color-gray-light)' }}>Modelo Estadístico</h2>
        <p className="text-xs mb-5" style={{ color: 'var(--color-gray-light)', opacity: 0.5 }}>
          Marcador con Binomial Negativa (colas de carreras reales), ajuste por abridor probable (FIP) y calibración
          de ataque/defensa con historial. <b>Sincroniza primero el calendario oficial</b> (pestaña Calendario) — eso
          ya descarga los abridores. Úsalo aquí para <b>refrescar</b> los probables, que MLB anuncia a diario y solo
          ~5 días antes de cada juego.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={handleSyncPitchers} disabled={pitcherBusy}
            className="font-bold text-sm px-5 py-3 rounded-lg transition-opacity disabled:opacity-40 text-left"
            style={{ backgroundColor: 'var(--color-bg-base)', color: 'var(--color-gray-light)', border: '1px solid var(--color-primary)' }}>
            <span className="block">{pitcherBusy ? 'Obteniendo abridores…' : 'Sincronizar abridores probables'}</span>
            <span className="block text-xs font-normal mt-1" style={{ opacity: 0.55 }}>
              Trae el FIP del abridor de cada juego pendiente ({Object.keys(pitchers).length} con rating)
            </span>
          </button>
          <button onClick={handleCalibrate} disabled={calibBusy}
            className="font-bold text-sm px-5 py-3 rounded-lg transition-opacity disabled:opacity-40 text-left"
            style={{ backgroundColor: 'var(--color-bg-base)', color: 'var(--color-gray-light)', border: '1px solid var(--color-primary)' }}>
            <span className="block">{calibBusy ? 'Calibrando…' : 'Calibrar ratings con historial'}</span>
            <span className="block text-xs font-normal mt-1" style={{ opacity: 0.55 }}>
              Ajusta ataque/defensa con /history.csv (Maher) y reporta el Brier
            </span>
          </button>
        </div>
        {modelMsg && <p className="mt-4 text-sm font-bold" style={{ color: modelMsg.startsWith('⚠') ? 'var(--color-accent)' : 'var(--color-positive)' }}>{modelMsg}</p>}
      </div>

      {/* Registrar resultado */}
      <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
        <h2 className="font-black text-2xl uppercase mb-5" style={{ color: 'var(--color-gray-light)' }}>Registrar Resultado</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <select value={resultGameId} onChange={(e) => setResultGameId(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm col-span-full sm:col-span-1"
            style={{ backgroundColor: 'var(--color-bg-base)', color: 'var(--color-gray-light)', border: '1px solid var(--color-primary)' }}>
            <option value="">Selecciona juego…</option>
            {pendingGames.map((g) => (
              <option key={g.id} value={g.id}>{teams[g.awayId]?.id} @ {teams[g.homeId]?.id} ({g.date})</option>
            ))}
          </select>
          <input type="number" min="0" max="30" placeholder="Carreras local" value={homeRuns} onChange={(e) => setHomeRuns(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm text-center font-bold" style={{ backgroundColor: 'var(--color-bg-base)', color: 'var(--color-gray-light)', border: '1px solid var(--color-primary)' }} />
          <input type="number" min="0" max="30" placeholder="Carreras visitante" value={awayRuns} onChange={(e) => setAwayRuns(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm text-center font-bold" style={{ backgroundColor: 'var(--color-bg-base)', color: 'var(--color-gray-light)', border: '1px solid var(--color-primary)' }} />
        </div>
        <button onClick={handleRegister} disabled={!resultGameId || homeRuns === '' || awayRuns === ''}
          className="font-bold text-sm px-5 py-2 rounded-lg transition-opacity disabled:opacity-40" style={{ backgroundColor: 'var(--color-positive)', color: 'white' }}>
          Registrar y Recalcular Elo
        </button>
        {resultMsg && <p className="mt-3 text-sm font-bold" style={{ color: 'var(--color-positive)' }}>{resultMsg}</p>}
      </div>

      {/* Ratings */}
      <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
        <h2 className="font-black text-2xl uppercase mb-1" style={{ color: 'var(--color-gray-light)' }}>Ratings</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--color-gray-light)', opacity: 0.45 }}>
          Ataque: &gt;1.0 = anota más carreras · Defensa: &lt;1.0 = mejor pitcheo/defensa.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-primary)', color: 'var(--color-gray-light)' }}>
                <th className="text-left py-2 px-3 font-bold text-xs uppercase opacity-60">Div.</th>
                <th className="text-left py-2 px-3 font-bold text-xs uppercase opacity-60">Equipo</th>
                <th className="text-right py-2 px-3 font-bold text-xs uppercase opacity-60">Elo</th>
                <th className="text-right py-2 px-3 font-bold text-xs uppercase opacity-60">Ataque</th>
                <th className="text-right py-2 px-3 font-bold text-xs uppercase opacity-60">Defensa</th>
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((team) => (
                <tr key={team.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td className="py-2 px-3 font-black text-xs" style={{ color: 'var(--color-accent)' }}>{team.league} {team.division}</td>
                  <td className="py-2 px-3 font-bold" style={{ color: 'var(--color-gray-light)' }}>
                    <div className="flex items-center gap-2"><TeamBadge team={team} size="sm" />{team.name}</div>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <input type="number" value={team.elo} onChange={(e) => setTeamElo(team.id, parseInt(e.target.value) || team.elo)}
                      className="w-20 rounded px-2 py-1 text-right text-sm font-bold" style={{ backgroundColor: 'var(--color-bg-base)', color: 'var(--color-gray-light)', border: '1px solid var(--color-primary)' }} />
                  </td>
                  <td className="py-2 px-3 text-right">
                    <input type="number" min="0.3" max="2.5" step="0.05" value={team.attack} onChange={(e) => setTeamAttack(team.id, parseFloat(e.target.value) || team.attack)}
                      className="w-16 rounded px-2 py-1 text-right text-sm font-bold"
                      style={{ backgroundColor: 'var(--color-bg-base)', color: team.attack >= 1.2 ? 'var(--color-positive)' : team.attack <= 0.8 ? 'var(--color-accent)' : 'var(--color-gray-light)', border: '1px solid var(--color-primary)' }} />
                  </td>
                  <td className="py-2 px-3 text-right">
                    <input type="number" min="0.3" max="2.0" step="0.05" value={team.defense} onChange={(e) => setTeamDefense(team.id, parseFloat(e.target.value) || team.defense)}
                      className="w-16 rounded px-2 py-1 text-right text-sm font-bold"
                      style={{ backgroundColor: 'var(--color-bg-base)', color: team.defense <= 0.8 ? 'var(--color-positive)' : team.defense >= 1.1 ? 'var(--color-accent)' : 'var(--color-gray-light)', border: '1px solid var(--color-primary)' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import/Export */}
      <div className="rounded-xl p-6 space-y-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
        <h2 className="font-black text-2xl uppercase" style={{ color: 'var(--color-gray-light)' }}>Import / Export</h2>
        <p className="text-sm" style={{ color: 'var(--color-gray-light)', opacity: 0.6 }}>
          Guarda y restaura el estado completo: equipos, Elos, resultados, cuotas y postemporada.
        </p>
        <button onClick={handleExport} className="w-full font-bold text-sm px-5 py-3 rounded-lg" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>↓ Exportar JSON</button>
        <button onClick={() => fileRef.current?.click()} className="w-full font-bold text-sm px-5 py-3 rounded-lg" style={{ backgroundColor: 'var(--color-positive)', color: 'white' }}>↑ Importar JSON</button>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      </div>

      {/* Reset */}
      <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
        <button onClick={handleReset} className="w-full font-bold text-sm px-5 py-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-base)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)' }}>
          ↺ Reiniciar al estado semilla
        </button>
      </div>

      {msg && <p className="text-sm font-bold text-center py-2" style={{ color: 'var(--color-positive)' }}>{msg}</p>}
    </section>
  )
}
