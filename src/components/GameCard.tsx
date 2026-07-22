import { memo, useMemo } from 'react'
import type { Game, Team } from '../data/seed'
import type { GamePrediction } from '../types'
import type { PersonalPick } from '../engine/personalPicks'
import { pExactScore, pCorrectOutcome } from '../engine/personalPicks'
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

function checkResult(pick: PersonalPick, realHome: number, realAway: number): ResultCheck {
  if (pick.homeRuns === realHome && pick.awayRuns === realAway) return 'exact'
  const realOut = realHome > realAway ? 'home' : 'away'
  const pickOut = pick.homeRuns >= pick.awayRuns ? 'home' : 'away'
  return realOut === pickOut ? 'outcome' : 'miss'
}

const resultStyle: Record<ResultCheck, { bg: string; border: string; label: string; labelColor: string }> = {
  exact:   { bg: 'rgba(46,139,87,0.15)',  border: 'var(--color-positive)', label: '✓ Marcador Exacto', labelColor: 'var(--color-positive)' },
  outcome: { bg: 'rgba(232,163,23,0.12)', border: 'var(--color-warning)',  label: '~ Acertó Ganador',  labelColor: 'var(--color-warning)' },
  miss:    { bg: 'rgba(200,16,46,0.10)',  border: 'var(--color-accent)',   label: '✗ Falló',           labelColor: 'var(--color-accent)' },
}

const GameCard = memo(function GameCard({ game, homeTeam, awayTeam, prediction, personalPick, onClick }: Props) {
  const top = prediction.topScorelines[0]
  const played = game.played
  const realHome = game.homeRuns ?? 0
  const realAway = game.awayRuns ?? 0

  const pickStats = useMemo(
    () => personalPick ? {
      pExacto:    pExactScore(personalPick.homeRuns, personalPick.awayRuns, prediction.lambdaHome, prediction.lambdaAway),
      pResultado: pCorrectOutcome(personalPick, prediction.probHome, prediction.probAway),
    } : null,
    [personalPick, prediction],
  )

  const topCheck  = played ? checkResult({ homeRuns: top.home, awayRuns: top.away }, realHome, realAway) : null
  const pickCheck = played && personalPick ? checkResult(personalPick, realHome, realAway) : null

  const gridCols = personalPick ? 'grid-cols-2' : 'grid-cols-1'

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-4 transition-colors cursor-pointer"
      style={{ backgroundColor: 'var(--color-bg-card)' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-card)')}
    >
      <div className="flex justify-between text-xs mb-3" style={{ color: 'var(--color-gray-light)', opacity: 0.45 }}>
        <span>{game.date}</span>
        <span>{homeTeam.venue}, {homeTeam.city}</span>
      </div>

      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex-1 flex items-center justify-end gap-2">
          <span className="font-black text-xl leading-tight uppercase text-right" style={{ color: 'var(--color-gray-light)' }}>
            {awayTeam.id} @ {homeTeam.name}
          </span>
          <TeamBadge team={homeTeam} size="md" />
        </div>

        <div className="text-center shrink-0 w-20">
          {played ? (
            <div>
              <div className="font-black text-3xl leading-none" style={{ color: 'var(--color-accent)' }}>
                {realHome}–{realAway}
              </div>
              <div className="text-xs mt-0.5 font-bold" style={{ color: 'var(--color-accent)', opacity: 0.7 }}>Final</div>
            </div>
          ) : (
            <div className="font-black text-2xl" style={{ color: 'var(--color-warning)' }}>vs</div>
          )}
        </div>

        <div className="flex-1 flex items-center gap-2">
          <TeamBadge team={awayTeam} size="md" />
          <span className="font-black text-xl leading-tight uppercase" style={{ color: 'var(--color-gray-light)' }}>
            {awayTeam.name}
          </span>
        </div>
      </div>

      <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--color-gray-light)', opacity: 0.5 }}>
        Probabilidad moneyline
      </p>
      <ProbBar probHome={prediction.probHome} probAway={prediction.probAway} homeName={homeTeam.id} awayName={awayTeam.id} />

      <div className={`grid ${gridCols} gap-2 mt-3`}>
        <PickBox
          label="Más probable"
          scoreline={`${top.home}–${top.away}`}
          sublabel={played ? undefined : `${(top.prob * 100).toFixed(1)}% de probabilidad`}
          check={topCheck}
          accentColor="var(--color-primary-light)"
          bgColor="var(--color-bg-base)"
        />
        {personalPick && pickStats && (
          <PickBox
            label="Tu predicción"
            scoreline={`${personalPick.homeRuns}–${personalPick.awayRuns}`}
            sublabel={played ? undefined : `Exacto ${(pickStats.pExacto * 100).toFixed(1)}%`}
            check={pickCheck}
            accentColor="var(--color-accent)"
            bgColor="rgba(200,16,46,0.10)"
          />
        )}
      </div>
    </button>
  )
})

function PickBox({ label, scoreline, sublabel, check, accentColor, bgColor }: {
  label: string
  scoreline: string
  sublabel?: string
  check: ResultCheck | null
  accentColor: string
  bgColor: string
}) {
  const rs = check ? resultStyle[check] : null
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: rs ? rs.bg : bgColor, border: `1px solid ${rs ? rs.border : 'transparent'}` }}>
      <div className="flex items-center justify-between gap-1 mb-1">
        <p className="text-xs font-bold" style={{ color: accentColor }}>{label}</p>
        {rs && <p className="text-xs font-bold" style={{ color: rs.labelColor }}>{rs.label}</p>}
      </div>
      <p className="font-black text-2xl leading-none" style={{ color: 'var(--color-gray-light)' }}>{scoreline}</p>
      {sublabel && <p className="text-xs mt-1" style={{ color: 'var(--color-gray-light)', opacity: 0.5 }}>{sublabel}</p>}
    </div>
  )
}

export default GameCard
