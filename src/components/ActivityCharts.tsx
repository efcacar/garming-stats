import { useId } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ActivitySample } from '../types/garmin'
import { formatDuration, formatPace } from '../utils/formatters'

const METRICS = [
  { key: 'elevation', label: 'Altimetría', color: '#22c55e', unit: 'm' },
  { key: 'pace', label: 'Ritmo', color: '#3b82f6', unit: '/km' },
  { key: 'heartRate', label: 'Frecuencia cardíaca', color: '#ef4444', unit: 'bpm' },
  { key: 'power', label: 'Potencia', color: '#a78bfa', unit: 'W' },
] as const

export default function ActivityCharts({ samples, hoveredIndex, onHover }: {
  samples: ActivitySample[]
  hoveredIndex: number | null
  onHover: (index: number | null) => void
}) {
  const syncId = useId()
  const selected = hoveredIndex != null ? samples[hoveredIndex] : undefined

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
      {METRICS.map(metric => {
        const available = samples.some(sample => sample[metric.key] != null)
        const value = selected?.[metric.key]
        const format = (number: number) => metric.key === 'pace'
          ? formatPace(number)
          : `${number.toLocaleString('es-ES', { maximumFractionDigits: 1 })} ${metric.unit}`

        return (
          <section key={metric.key} aria-label={metric.label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 min-w-0">
            <div className="flex flex-wrap justify-between gap-2 text-xs mb-2">
              <h2 className="text-xs font-normal text-slate-500 uppercase tracking-wider">{metric.label}</h2>
              <span className="text-slate-300 tabular-nums">
                {selected && `${formatDuration(selected.time)} · ${selected.distance != null ? `${selected.distance.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km` : 'Sin distancia'} · ${value != null ? format(value) : 'Sin dato'}`}
              </span>
            </div>
            {!available && <p className="text-xs text-slate-500">Sin datos registrados por Garmin.</p>}
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart
                data={samples}
                syncId={syncId}
                syncMethod="index"
                margin={{ top: 5, right: 8, bottom: 0, left: 0 }}
                onMouseMove={state => {
                  const index = Number(state.activeTooltipIndex)
                  onHover(state.isTooltipActive && state.activeTooltipIndex != null && Number.isInteger(index) && samples[index] ? index : null)
                }}
                onMouseLeave={() => onHover(null)}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tickFormatter={formatDuration} tick={{ fill: '#64748b', fontSize: 10 }} minTickGap={30} axisLine={false} tickLine={false} />
                <YAxis reversed={metric.key === 'pace'} domain={['auto', 'auto']} width={48} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => metric.key === 'pace' ? formatPace(Number(v)).replace(' /km', '') : String(Math.round(Number(v)))} axisLine={false} tickLine={false} />
                <Tooltip content={() => null} cursor={false} />
                {selected && <ReferenceLine x={selected.time} stroke="#cbd5e1" strokeDasharray="3 3" />}
                <Area type="linear" dataKey={metric.key} baseValue={metric.key === 'pace' ? 'dataMax' : 'auto'} stroke={metric.color} fill={metric.color} fillOpacity={0.22} strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </section>
        )
      })}
    </div>
  )
}
