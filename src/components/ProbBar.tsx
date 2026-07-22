interface Props {
  probHome: number
  probAway: number
  homeName: string
  awayName: string
}

export default function ProbBar({ probHome, probAway, homeName, awayName }: Props) {
  const pct = (p: number) => (p * 100).toFixed(0) + '%'

  return (
    <div className="w-full">
      <div className="flex rounded-lg overflow-hidden h-9 text-sm font-bold">
        <div
          className="flex items-center justify-center gap-1 transition-all"
          style={{ width: `${probHome * 100}%`, backgroundColor: 'var(--color-primary)' }}
        >
          {probHome > 0.15 && <span className="text-white truncate px-1">{homeName}</span>}
          <span className="text-white font-black shrink-0">{pct(probHome)}</span>
        </div>
        <div
          className="flex items-center justify-center gap-1 transition-all"
          style={{ width: `${probAway * 100}%`, backgroundColor: 'var(--color-accent)' }}
        >
          {probAway > 0.15 && <span className="text-white truncate px-1">{awayName}</span>}
          <span className="text-white font-black shrink-0">{pct(probAway)}</span>
        </div>
      </div>

      <div className="flex justify-between text-xs mt-1.5 font-semibold" style={{ color: 'var(--color-gray-light)', opacity: 0.6 }}>
        <span>{homeName} {pct(probHome)}</span>
        <span>{awayName} {pct(probAway)}</span>
      </div>
    </div>
  )
}
