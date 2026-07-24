import { useState, useCallback, useEffect, useRef } from 'react'
import { useStore } from './store/useStore'
import Schedule from './pages/Schedule'
import Standings from './pages/Standings'
import Postseason from './pages/Postseason'
import Parlay from './pages/Parlay'
import Aciertos from './pages/Aciertos'
import Settings from './pages/Settings'

type Tab = 'calendario' | 'posiciones' | 'postemporada' | 'parlay' | 'aciertos' | 'ajustes'

// Iconos de línea propios (SVG) — trazo consistente, currentColor, escala con em.
const svg = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, width: '1.35em', height: '1.35em',
}
const ICONS: Record<Tab, React.ReactNode> = {
  calendario: <svg {...svg}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" /></svg>,
  posiciones: <svg {...svg}><circle cx="5" cy="6" r="1.3" /><circle cx="5" cy="12" r="1.3" /><circle cx="5" cy="18" r="1.3" /><path d="M9.5 6h11M9.5 12h11M9.5 18h7" /></svg>,
  postemporada: <svg {...svg}><path d="M4 6h3.5a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h1.5M4 18h3.5a2 2 0 0 0 2-2v-2a2 2 0 0 1 2-2M13 12h4" /><circle cx="19" cy="12" r="1.6" /></svg>,
  parlay: <svg {...svg}><rect x="3.5" y="3.5" width="11" height="11" rx="2.5" /><rect x="9.5" y="9.5" width="11" height="11" rx="2.5" /></svg>,
  aciertos: <svg {...svg}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.2" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></svg>,
  ajustes: <svg {...svg}><path d="M5 8h8M16 8h3M5 16h3M11 16h8" /><circle cx="14.5" cy="8" r="2" /><circle cx="9" cy="16" r="2" /></svg>,
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'calendario',   label: 'Calendario' },
  { id: 'posiciones',   label: 'Posiciones' },
  { id: 'postemporada', label: 'Postemporada' },
  { id: 'parlay',       label: 'Parlay' },
  { id: 'aciertos',     label: 'Aciertos' },
  { id: 'ajustes',      label: 'Ajustes' },
]

type SyncState = 'idle' | 'loading' | 'ok' | 'error'

function PennantLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ flexShrink: 0, filter: 'drop-shadow(0 6px 16px rgba(0,0,0,.5))' }}>
      <defs>
        <linearGradient id="pnTile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#15385f" />
          <stop offset="1" stopColor="#0C2340" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#pnTile)" />
      <rect width="40" height="40" rx="11" fill="none" stroke="rgba(255,255,255,.12)" />
      <rect x="12.4" y="8.5" width="2.6" height="23" rx="1.3" fill="#EAF1FA" />
      <circle cx="13.7" cy="8.4" r="1.9" fill="#EAF1FA" />
      <path d="M15 10 L31.5 15.4 L15 20.8 Z" fill="#C8102E" />
      <path d="M17.6 12.9 Q23 14.3 28.4 15.1" stroke="#fff" strokeWidth="1.1" fill="none" strokeDasharray="1.5 1.6" strokeLinecap="round" opacity=".9" />
    </svg>
  )
}

function SyncButton({ state, msg, onClick }: { state: SyncState; msg: string; onClick: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
      <button
        onClick={onClick}
        disabled={state === 'loading'}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 11px', borderRadius: 8, fontSize: 11, fontWeight: 700, fontFamily: 'var(--fu)',
          backgroundColor: state === 'error' ? 'rgba(232,66,89,.2)' : state === 'ok' ? 'rgba(52,199,123,.2)' : 'rgba(255,255,255,.08)',
          border: `1px solid ${state === 'error' ? 'rgba(232,66,89,.4)' : state === 'ok' ? 'rgba(52,199,123,.4)' : 'var(--border)'}`,
          color: state === 'error' ? 'var(--red-b)' : state === 'ok' ? 'var(--green)' : 'var(--text)',
          cursor: state === 'loading' ? 'wait' : 'pointer', transition: 'all .2s',
        }}
      >
        <span style={{ display: 'inline-block', animation: state === 'loading' ? 'spin 1s linear infinite' : 'none' }}>
          {state === 'loading' ? '⟳' : state === 'ok' ? '✓' : state === 'error' ? '⚠' : '⟳'}
        </span>
        {state === 'loading' ? 'Sincronizando…' : 'MLB Live'}
      </button>
      {msg && <span style={{ fontSize: 9, fontFamily: 'var(--fm)', color: state === 'error' ? 'var(--red-b)' : 'var(--green)', opacity: 0.85 }}>{msg}</span>}
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('calendario')
  const syncSchedule = useStore((s) => s.syncSchedule)
  const syncScores = useStore((s) => s.syncScores)
  const syncPitchers = useStore((s) => s.syncPitchers)
  const syncLines = useStore((s) => s.syncLines)
  const calibrateFromHistory = useStore((s) => s.calibrateFromHistory)
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [syncMsg, setSyncMsg] = useState('')

  // ── Sincronización automática con MLB Stats API (sin clicks) ────────────────
  // Al abrir: si aún hay calendario sintético, carga el oficial (que ya baja los
  // ratings FIP de abridores) y calibra con historial si existe. Luego, en
  // segundo plano: resultados cada 5 min y abridores probables cada 30 min.

  const flash = useCallback((state: SyncState, msg: string) => {
    setSyncState(state)
    setSyncMsg(msg)
    if (state === 'ok') setTimeout(() => { setSyncState('idle'); setSyncMsg('') }, 4000)
  }, [])

  const refreshLive = useCallback(async (opts: { silent?: boolean } = {}) => {
    const { silent = true } = opts
    if (!silent) setSyncState('loading')
    try {
      const r = await syncScores()
      let rated = 0
      if (useStore.getState().scheduleSource === 'mlb-stats-api') {
        try { rated = (await syncPitchers()).rated } catch { /* ignora abridores */ }
        try { await syncLines() } catch { /* ignora líneas de total */ }
      }

      if (r.errors.length) { flash('idle', ''); return }
      const parts: string[] = []
      if (r.updated) parts.push(`${r.updated} resultado${r.updated > 1 ? 's' : ''}`)
      if (rated) parts.push(`${rated} abridores`)
      flash('ok', parts.join(' · '))
    } catch {
      flash(silent ? 'idle' : 'error', silent ? '' : 'Error de red')
    }
  }, [syncScores, syncPitchers, syncLines, flash])

  // Disparo manual desde el botón "MLB Live": fuerza refresco completo.
  const handleManualSync = useCallback(async () => {
    setSyncState('loading'); setSyncMsg('')
    try {
      if (useStore.getState().scheduleSource === 'synthetic') {
        try { await syncSchedule() } catch { /* seguirá con resultados */ }
      }
      await refreshLive({ silent: false })
    } catch { flash('error', 'Sin conexión con MLB Stats API') }
  }, [syncSchedule, refreshLive, flash])

  const autoSyncStarted = useRef(false)
  useEffect(() => {
    if (autoSyncStarted.current) return
    autoSyncStarted.current = true

    ;(async () => {
      setSyncState('loading')
      // 1) Bootstrap único: calendario oficial + abridores. Solo en instalación
      //    nueva (sintético y sin resultados registrados), para no pisar trabajo manual.
      const st = useStore.getState()
      if (st.scheduleSource === 'synthetic' && !st.games.some((g) => g.played)) {
        try { await syncSchedule() } catch { /* sin conexión: se queda sintético */ }
      }
      // 2) Calibración con historial (no-op silencioso si no hay /history.csv).
      try { await calibrateFromHistory() } catch { /* opcional */ }
      // 3) Primer refresco de resultados + abridores.
      await refreshLive({ silent: true })
    })()

    const scores = setInterval(() => refreshLive({ silent: true }), 5 * 60 * 1000)
    const pitchers = setInterval(() => {
      if (useStore.getState().scheduleSource === 'mlb-stats-api') syncPitchers().catch(() => {})
    }, 30 * 60 * 1000)
    return () => { clearInterval(scores); clearInterval(pitchers) }
  }, [syncSchedule, calibrateFromHistory, refreshLive, syncPitchers])

  const navButtons = TABS.map(({ id, label }) => (
    <button key={id} onClick={() => setTab(id)} className={`pn-navbtn${tab === id ? ' is-active' : ''}`}>
      <span className="pn-navico">{ICONS[id]}</span>
      <span className="pn-navlbl">{label}</span>
    </button>
  ))

  return (
    <div className="pn-shell">
      {/* Barra superior (sólo móvil) */}
      <div className="pn-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <PennantLogo size={30} />
          <div style={{ fontFamily: 'var(--fh)', fontWeight: 600, fontSize: 18, letterSpacing: '0' }}>Pennant</div>
        </div>
        <SyncButton state={syncState} msg={syncMsg} onClick={handleManualSync} />
      </div>

      {/* Sidebar / barra inferior */}
      <nav className="pn-nav">
        <div className="pn-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <PennantLogo size={40} />
            <div>
              <div style={{ fontFamily: 'var(--fh)', fontWeight: 600, fontSize: 20, lineHeight: 1, letterSpacing: '0' }}>Pennant</div>
              <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 4, fontFamily: 'var(--fm)' }}>MLB Analytics · 2026</div>
            </div>
          </div>
        </div>

        <div className="pn-navlist">{navButtons}</div>

        <div className="pn-navfoot">
          <SyncButton state={syncState} msg={syncMsg} onClick={handleManualSync} />
          <div style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'var(--fm)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }} />
            modelo activo
          </div>
        </div>
      </nav>

      {/* Contenido */}
      <main className="pn-main">
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
