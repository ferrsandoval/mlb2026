import { useState, useCallback, useEffect, useRef } from 'react'
import { useStore } from './store/useStore'
import Schedule from './pages/Schedule'
import Standings from './pages/Standings'
import Postseason from './pages/Postseason'
import Parlay from './pages/Parlay'
import Aciertos from './pages/Aciertos'
import Settings from './pages/Settings'

type Tab = 'calendario' | 'posiciones' | 'postemporada' | 'parlay' | 'aciertos' | 'ajustes'

const TABS: { id: Tab; label: string }[] = [
  { id: 'calendario',   label: 'Calendario'   },
  { id: 'posiciones',   label: 'Posiciones'   },
  { id: 'postemporada', label: 'Postemporada' },
  { id: 'parlay',       label: 'Parlay'       },
  { id: 'aciertos',     label: 'Aciertos'     },
  { id: 'ajustes',      label: 'Ajustes'      },
]

type SyncState = 'idle' | 'loading' | 'ok' | 'error'

export default function App() {
  const [tab, setTab] = useState<Tab>('calendario')
  const syncScores = useStore((s) => s.syncScores)
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [syncMsg, setSyncMsg] = useState('')

  const handleSync = useCallback(async (silent = false) => {
    setSyncState('loading')
    if (!silent) setSyncMsg('')
    try {
      const r = await syncScores()
      if (r.errors.length) {
        setSyncState(silent ? 'idle' : 'error')
        if (!silent) setSyncMsg('Sin conexión con MLB Stats API')
      } else {
        setSyncState('ok')
        setSyncMsg(r.updated > 0 ? `${r.updated} resultado${r.updated > 1 ? 's' : ''} nuevo${r.updated > 1 ? 's' : ''}` : (silent ? '' : 'Sin novedades'))
        setTimeout(() => { setSyncState('idle'); if (!silent || r.updated === 0) setSyncMsg('') }, 4000)
      }
    } catch {
      setSyncState(silent ? 'idle' : 'error')
      if (!silent) setSyncMsg('Error de red')
    }
  }, [syncScores])

  const autoSyncStarted = useRef(false)
  useEffect(() => {
    if (autoSyncStarted.current) return
    autoSyncStarted.current = true
    handleSync(true)
    const interval = setInterval(() => handleSync(true), 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [handleSync])

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      {/* Header */}
      <header style={{ backgroundColor: 'var(--color-primary)', borderBottom: '3px solid var(--color-accent)' }}>
        <div className="max-w-5xl mx-auto px-3 py-2 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-black text-2xl sm:text-3xl uppercase tracking-wide leading-none truncate" style={{ color: 'white', fontFamily: 'var(--font-display)' }}>
              MLB 2026
            </h1>
            <p className="text-xs mt-0.5 hidden sm:block" style={{ color: 'white', opacity: 0.65 }}>
              Análisis Estadístico · Uso privado
            </p>
          </div>

          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
            <button
              onClick={() => handleSync()}
              disabled={syncState === 'loading'}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                backgroundColor: syncState === 'error' ? 'rgba(239,68,68,0.25)' : syncState === 'ok' ? 'rgba(46,139,87,0.25)' : 'rgba(255,255,255,0.12)',
                border: `1px solid ${syncState === 'error' ? 'rgba(239,68,68,0.4)' : syncState === 'ok' ? 'rgba(46,139,87,0.4)' : 'rgba(255,255,255,0.2)'}`,
                color: syncState === 'error' ? '#f87171' : syncState === 'ok' ? '#4ade80' : 'white',
                cursor: syncState === 'loading' ? 'wait' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ display: 'inline-block', animation: syncState === 'loading' ? 'spin 1s linear infinite' : 'none' }}>
                {syncState === 'loading' ? '⟳' : syncState === 'ok' ? '✓' : syncState === 'error' ? '⚠' : '⟳'}
              </span>
              <span className="hidden sm:inline">{syncState === 'loading' ? 'Sincronizando…' : 'MLB Live'}</span>
            </button>
            {syncMsg && <span style={{ fontSize: 9, color: syncState === 'error' ? '#f87171' : '#4ade80', opacity: 0.85 }}>{syncMsg}</span>}
          </div>
        </div>
      </header>

      {/* Nav */}
      <nav style={{ backgroundColor: 'var(--color-bg-card)', borderBottom: '1px solid rgba(12,35,64,0.5)' }}>
        <div className="max-w-5xl mx-auto px-2 py-1" style={{ overflowX: 'auto', display: 'flex', gap: 2, scrollbarWidth: 'none' }}>
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="text-xs sm:text-sm rounded-md transition-colors"
              style={{
                padding: '6px 10px', whiteSpace: 'nowrap', flexShrink: 0,
                backgroundColor: tab === id ? 'var(--color-primary)' : 'transparent',
                color: tab === id ? 'white' : 'var(--color-gray-light)',
                opacity: tab === id ? 1 : 0.65,
                fontWeight: 600,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {tab === 'calendario'   && <Schedule />}
        {tab === 'posiciones'   && <Standings />}
        {tab === 'postemporada' && <Postseason />}
        {tab === 'parlay'       && <Parlay />}
        {tab === 'aciertos'     && <Aciertos />}
        {tab === 'ajustes'      && <Settings />}
      </main>
    </div>
  )
}
