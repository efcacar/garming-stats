interface MetricCardProps {
  label: string
  value: string | number
  unit?: string
  sub?: string
  color?: string
  large?: boolean
  compact?: boolean
}

export default function MetricCard({ label, value, unit, sub, color, large, compact }: MetricCardProps) {
  return (
    <div className={`bg-slate-800/60 border border-slate-700/50 flex flex-col gap-1 ${compact ? 'rounded-lg px-3 py-2' : 'rounded-xl p-4'}`}>
      <div className={`text-slate-500 uppercase tracking-wider ${compact ? 'text-[10px]' : 'text-xs'}`}>{label}</div>
      <div className={`font-bold tabular-nums leading-none ${large ? 'text-4xl' : compact ? 'text-lg' : 'text-2xl'}`} style={color ? { color } : {}}>
        {value}
        {unit && <span className={`font-normal text-slate-400 ml-1 ${compact ? 'text-xs' : 'text-sm'}`}>{unit}</span>}
      </div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}
