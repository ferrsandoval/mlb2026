import { memo } from 'react'
import type { Game, Team } from '../data/seed'
import type { GamePrediction } from '../types'
import { useStore } from '../store/useStore'
import { analyzeValue } from '../engine/value'
import ProbBar from './ProbBar'
import TeamBadge from './TeamBadge'
import BaseballIcon from './BaseballIcon'

interface Props {
  game: Game
  homeTeam: Team
  awayTeam: Team
  prediction: GamePrediction
  onClick: () => void
}

// Béisbol = mercado binario (moneyline): el pronóstico es GANADOR, no marcador.
type MLResult = 'hit' | 'miss'

const ML: Record<MLResult, { label: string; color: string; border: string; bg: string }> = {
  hit:  { label: 'Acierto', color: 'var(--green)', border: 'rgba(52,199,123,.4)', bg: 'rgba(52,199,123,.1)' },
  miss: { label: 'Fallo',   color: 'var(--red-b)', border: 'rgba(232,66,89,.4)',  bg: 'rgba(232,66,89,.1)' },
}

/** Momio americano → texto con signo. */
const fmtAm = (n: number): string => (n > 0 ? `+${n}` : `${n}`)
/** Momio americano → cuota decimal (para el comparador de valor). */
const amToDec = (n: number): number => (n > 0 ? 1 + n / 100 : 1 + 100 / -n)

/** Prob (0..1) del favorito → cuota americana justa del modelo. */
function americanFair(probHome: number): { code: 'home' | 'away'; txt: string } {
  const favHome = probHome >= 0.5
  const p = favHome ? probHome : 1 - probHome
  const q = 1 - p
  const txt = p > 0.5 ? '-' + Math.round((p / q) * 100) : '+' + Math.round((q / p) * 100)
  return { code: favHome ? 'home' : 'away', txt }
}

const GameCard = memo(function GameCard({ game, homeTeam, awayTeam, prediction, onClick }: Props) {
  const odds = useStore((s) => s.odds[game.id])
  const valueThreshold = useStore((s) => s.valueThreshold)
  const kellyFraction = useStore((s) => s.kellyFraction)
  const homePitcher = useStore((s) => (game.homePitcherId ? s.pitchers[game.homePitcherId] : undefined))
  const awayPitcher = useStore((s) => (game.awayPitcherId ? s.pitchers[game.awayPitcherId] : undefined))

  const has = !!(game.played && game.homeRuns != null && game.awayRuns != null)
  const realHome = game.homeRuns ?? 0
  const realAway = game.awayRuns ?? 0
  const winHome = has && realHome > realAway
  const winAway = has && realAway > realHome

  // Pronóstico del modelo = ganador (moneyline): el equipo con mayor probabilidad.
  const realHomeWon = has && realHome > realAway
  const modelPickHome = prediction.probHome >= prediction.probAway
  const modelPickId = modelPickHome ? homeTeam.id : awayTeam.id
  const modelPickProb = modelPickHome ? prediction.probHome : prediction.probAway
  const modelResult: MLResult | null = has ? (modelPickHome === realHomeWon ? 'hit' : 'miss') : null

  // Total más probable (over/under) según el modelo, con su acierto/fallo.
  const overMore = prediction.probOver >= prediction.probUnder
  const totalLabel = overMore ? 'Over' : 'Under'
  const totalProb = overMore ? prediction.probOver : prediction.probUnder
  const realOver = has && realHome + realAway > prediction.runLine
  const totalResult: MLResult | null = has ? (overMore === realOver ? 'hit' : 'miss') : null
  const rsTotal = totalResult ? ML[totalResult] : null

  const fair = americanFair(prediction.probHome)
  const fairCode = fair.code === 'home' ? homeTeam.id : awayTeam.id

  // Valor: usa las cuotas del usuario si las hay; si no, las reales de ESPN.
  const realOdds = game.mlHome != null && game.mlAway != null ? { home: amToDec(game.mlHome), away: amToDec(game.mlAway) } : null
  const effOdds = odds ?? realOdds
  const va = effOdds ? analyzeValue(effOdds, { home: prediction.probHome, away: prediction.probAway }, valueThreshold, kellyFraction) : null
  let valueTxt: string | null = null
  if (va) {
    const h = va.markets.home, a = va.markets.away
    const best = h.hasValue && (!a.hasValue || h.edge >= a.edge)
      ? { side: homeTeam.id, edge: h.edge }
      : a.hasValue ? { side: awayTeam.id, edge: a.edge } : null
    if (best) valueTxt = `${best.side} ${(best.edge * 100).toFixed(0)}%`
  }

  const pct = (p: number) => Math.round(p * 100)
  const rs = modelResult ? ML[modelResult] : null

  const teamRow = (team: Team, role: string, score: number | string, win: boolean, dim: boolean, pitcher?: { name: string; fip: number }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <TeamBadge team={team} size={44} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 15, lineHeight: 1 }}>{team.id}</div>
          {pitcher ? (
            <div style={{ fontSize: 11, color: 'var(--faint)', display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
              <BaseballIcon size={11} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pitcher.name} <span style={{ opacity: 0.7 }}>· FIP {pitcher.fip.toFixed(2)}</span></span>
            </div>
          ) : !has ? (
            <div style={{ fontSize: 11, color: 'var(--faint)', opacity: 0.7, display: 'flex', alignItems: 'center', gap: 5 }}><BaseballIcon size={11} /> Abridor por confirmar</div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--faint)' }}>{role}</div>
          )}
        </div>
      </div>
      <div style={{ fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 22, color: dim ? 'var(--faint)' : win ? 'var(--text)' : has ? 'var(--faint)' : 'var(--faint)' }}>{score}</div>
    </div>
  )

  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
        background: 'linear-gradient(180deg,var(--surface-2),var(--surface))',
        border: '1px solid var(--border)', borderRadius: 'var(--r3)', padding: '15px 16px',
        boxShadow: 'var(--sh)', position: 'relative', overflow: 'hidden', transition: 'border-color .15s, transform .15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--fm)', fontSize: 11, letterSpacing: '.06em', color: has ? 'var(--red-b)' : 'var(--faint)' }}>
          {has ? 'FINAL' : 'PROGRAMADO'}
        </span>
        {valueTxt && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(52,199,123,.13)', border: '1px solid rgba(52,199,123,.35)', color: 'var(--green)', fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>
            ▲ VALOR {valueTxt}
          </span>
        )}
      </div>

      {teamRow(awayTeam, 'Visitante', has ? realAway : '–', winAway, !has, awayPitcher)}
      <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
      {teamRow(homeTeam, 'Local', has ? realHome : '–', winHome, !has, homePitcher)}

      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>
          <span>{awayTeam.id} {pct(prediction.probAway)}%{game.mlAway != null && <span style={{ color: 'var(--faint)' }}> · {fmtAm(game.mlAway)}</span>}</span>
          <span>{game.mlHome != null && <span style={{ color: 'var(--faint)' }}>{fmtAm(game.mlHome)} · </span>}{homeTeam.id} {pct(prediction.probHome)}%</span>
        </div>
        <ProbBar probHome={prediction.probHome} probAway={prediction.probAway} homeColor={homeTeam.primaryColor} awayColor={awayTeam.primaryColor} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        <div style={{ flex: '1 1 92px', minWidth: 0, background: rs ? rs.bg : 'rgba(255,255,255,.03)', border: `1px solid ${rs ? rs.border : 'var(--border)'}`, borderRadius: 9, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: rs ? rs.color : 'var(--faint)', fontFamily: 'var(--fm)', letterSpacing: '.05em', display: 'flex', justifyContent: 'space-between', gap: 6 }}>
            <span>PRONÓSTICO</span>{rs && <span style={{ fontWeight: 700 }}>{rs.label}</span>}
          </div>
          <div style={{ fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 15, marginTop: 2 }}>
            {modelPickId} <span style={{ color: 'var(--faint)', fontWeight: 400, fontSize: 12 }}>{pct(modelPickProb)}%</span>
          </div>
        </div>
        <div style={{ flex: '1 1 92px', minWidth: 0, background: rsTotal ? rsTotal.bg : 'rgba(245,184,65,.06)', border: `1px solid ${rsTotal ? rsTotal.border : 'rgba(245,184,65,.22)'}`, borderRadius: 9, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--fm)', letterSpacing: '.05em', color: rsTotal ? rsTotal.color : 'var(--amber)', display: 'flex', justifyContent: 'space-between', gap: 6 }}>
            <span>TOTAL</span>{rsTotal && <span style={{ fontWeight: 700 }}>{rsTotal.label}</span>}
          </div>
          <div style={{ fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 15, marginTop: 2 }}>
            {totalLabel} {prediction.runLine} <span style={{ color: 'var(--faint)', fontWeight: 400, fontSize: 12 }}>{pct(totalProb)}%</span>
          </div>
        </div>
        <div style={{ flex: '1 1 92px', minWidth: 0, background: 'rgba(76,154,255,.06)', border: '1px solid rgba(76,154,255,.22)', borderRadius: 9, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--fm)', letterSpacing: '.05em', color: 'var(--blue)' }}>CUOTA JUSTA</div>
          <div style={{ fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 15, marginTop: 2 }}>{fairCode} {fair.txt}</div>
        </div>
      </div>
    </button>
  )
})

export default GameCard
