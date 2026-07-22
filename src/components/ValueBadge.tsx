interface Props {
  edge: number
  hasValue: boolean
}

export default function ValueBadge({ edge, hasValue }: Props) {
  if (!hasValue) return null
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
      style={{ backgroundColor: 'var(--color-positive)', color: 'white' }}
    >
      ✓ VALOR +{(edge * 100).toFixed(1)}%
    </span>
  )
}
