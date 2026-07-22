import { memo } from 'react'
import type { Game, Team } from '../data/seed'
import type { GamePrediction } from '../types'
import type { PersonalPick } from '../engine/personalPicks'
import { useStore } from '../store/useStore'
import { analyzeValue } from '../engine/value'
import ProbBar from './ProbBar'
import TeamBadge from './TeamBadge'

interface Props {
  game: Game
  homeTeam: Team
  awayTeam: Team
  prediction: GamePrediction
  personalPick?: PersonalPick
  onClick: () => void
}

type ResultCheck = 'exact' | 'outcome' | 'miss'

function checkResult(ph: number, pa: number, realHome: number, realAway: number): ResultCheck {
  if (ph === realHome && pa === realAway) return 'exact'
  const realOut = realHome > realAway ? 'home' : 'away'
  const pickOut = ph >= pa ? 'home' : 'away'
  return realOut === pickOut ? 'outcome' : 'miss'
}

const RES: Record<ResultCheck, { label: string; color: string; border: string; bg: string }> = {
  exact:   { label: 'Exacto',  color: 'var(--green)', border: 'rgba(52,199,123,.4)',  bg: 'rgba(52,199,123,.1)' },
  outcome: { label: 'Ganador', color: 'var(--amber)', border: 'rgba(245,184,65,.4)',  bg: 'rgba(245,184,65,.1)' },
  miss:    { label: 'Fallo',   color: 'var(--red-b)', border: 'rgba(232,66,89,.4)',   bg: 'rgba(232,66,89,.1)' },
}

/** Prob (0..1) del favorito → cuota americana justa del modelo. */
function americanFair(probHome: number): { code: 'home' | 'away'; txt: string } {
  const favHome = probHome >= 0.5
  const p = favHome ? probHome : 1 - probHome
  const q = 1 - p
  const txt = p > 0.5 ? '-' + Math.round((p / q) * 100) : '+' + Math.round((q / p) * 100)
  return { code: favHome ? 'home' : 'away', txt }
}

const GameCard = memo(function GameCard({ game, homeTeam, awayTeam, prediction, personalPick, onClick }: Props) {
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

  const top = prediction.topScorelines[0]
  const predSide = top.home > top.away ? homeTeam.id : top.away > top.home ? awayTeam.id : ''
  const modelCheck = has ? checkResult(top.home, top.away, realHome, realAway) : null

  const fair = americanFair(prediction.probHome)
  const fairCode = fair.code === 'home' ? homeTeam.id : awayTeam.id

  // Valor (requiere cuotas ingresadas por el usuario)
  const va = odds ? analyzeValue(odds, { home: prediction.probHome, away: prediction.probAway }, valueThreshold, kellyFraction) : null
  let valueTxt: string | null = null
  if (va) {
    const h = va.markets.home, a = va.markets.away
    const best = h.hasValue && (!a.hasValue || h.edge >= a.edge)
      ? { side: homeTeam.id, edge: h.edge }
      : a.hasValue ? { side: awayTeam.id, edge: a.edge } : null
    if (best) valueTxt = `${best.side} ${(best.edge * 100).toFixed(0)}%`
  }

  const pct = (p: number) => Math.round(p * 100)
  const rs = modelCheck ? RES[modelCheck] : null

  const teamRow = (team: Team, role: string, score: number | string, win: boolean, dim: boolean, pitcher?: { name: string; fip: number }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <TeamBadge team={team} size={44} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 15, lineHeight: 1 }}>{team.id}</div>
          {pitcher ? (
            <div style={{ fontSize: 11, color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              ⚾ {pitcher.name} <span style={{ opacity: 0.7 }}>· FIP {pitcher.fip.toFixed(2)}</span>
            </div>
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
        background: 'linear-gradient(180deg,#20304a,#1a293f)',
        border: '1px solid var(--border-2)', borderRadius: 14, padding: '15px 16px',
        boxShadow: 'var(--sh)', position: 'relative', overflow: 'hidden', transition: 'border-color .15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,.28)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-2)')}
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
          <span>{awayTeam.id} {pct(prediction.probAway)}%</span>
          <span>ML · sin empate</span>
          <span>{homeTeam.id} {pct(prediction.probHome)}%</span>
        </div>
        <ProbBar probHome={prediction.probHome} probAway={prediction.probAway} homeColor={homeTeam.primaryColor} awayColor={awayTeam.primaryColor} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <div style={{ flex: 1, background: rs ? rs.bg : 'rgba(255,255,255,.03)', border: `1px solid ${rs ? rs.border : 'var(--border)'}`, borderRadius: 9, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: rs ? rs.color : 'var(--faint)', fontFamily: 'var(--fm)', letterSpacing: '.05em', display: 'flex', justifyContent: 'space-between', gap: 6 }}>
            <span>MARCADOR PROBABLE</span>{rs && <span style={{ fontWeight: 700 }}>{rs.label}</span>}
          </div>
          <div style={{ fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 15, marginTop: 2 }}>
            {top.away}–{top.home} <span style={{ color: 'var(--faint)', fontWeight: 400, fontSize: 12 }}>{predSide}</span>
          </div>
        </div>
        <div style={{ flex: 1, background: 'rgba(76,154,255,.06)', border: '1px solid rgba(76,154,255,.22)', borderRadius: 9, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--fm)', letterSpacing: '.05em', color: 'var(--blue)' }}>CUOTA JUSTA</div>
          <div style={{ fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 15, marginTop: 2 }}>{fairCode} {fair.txt}</div>
        </div>
      </div>

      {personalPick && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--muted)' }}>
          <span style={{ color: 'var(--red-b)', fontWeight: 700 }}>TU PICK</span>
          <span style={{ fontWeight: 700, color: 'var(--text)' }}>{personalPick.awayRuns}–{personalPick.homeRuns}</span>
          {has && (() => {
            const c = checkResult(personalPick.homeRuns, personalPick.awayRuns, realHome, realAway)
            return <span style={{ color: RES[c].color, fontWeight: 700 }}>· {RES[c].label}</span>
          })()}
        </div>
      )}
    </button>
  )
})

export default GameCard
