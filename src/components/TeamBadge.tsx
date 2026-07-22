interface Props {
  team: { id: string; primaryColor: string; secondaryColor: string }
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZE = {
  xs: { d: 18, font: 8 },
  sm: { d: 24, font: 9 },
  md: { d: 32, font: 11 },
  lg: { d: 44, font: 14 },
  xl: { d: 64, font: 18 },
}

export default function TeamBadge({ team, size = 'md', className = '' }: Props) {
  const s = SIZE[size]
  return (
    <span
      className={className}
      title={team.id}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: s.d,
        height: s.d,
        borderRadius: '50%',
        flexShrink: 0,
        backgroundColor: team.primaryColor,
        border: `2px solid ${team.secondaryColor}`,
        color: '#fff',
        fontWeight: 900,
        fontSize: s.font,
        letterSpacing: '-0.02em',
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
      }}
    >
      {team.id}
    </span>
  )
}
