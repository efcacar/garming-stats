import { useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'

interface Props {
  coords: number[][]
  onHover: (idx: number | null) => void
}

function haversineKm(a: number[], b: number[]): number {
  const R = 6371
  const dLat = (b[0] - a[0]) * Math.PI / 180
  const dLon = (b[1] - a[1]) * Math.PI / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

export default function ElevationChart({ coords, onHover }: Props) {
  const data = useMemo(() => {
    if (!coords.length) return []
    // Check if any coord has elevation (not just the first)
    if (!coords.some(c => c.length >= 3)) return []
    let dist = 0
    return coords.map((c, i) => {
      if (i > 0) dist += haversineKm(coords[i - 1], c)
      return { idx: i, dist: +dist.toFixed(2), ele: c[2] ?? null }
    }).filter(d => d.ele != null) as { idx: number; dist: number; ele: number }[]
  }, [coords])

  if (!data.length) return null

  const eles = data.map(d => d.ele)
  const minEle = Math.floor(Math.min(...eles) - 5)
  const maxEle = Math.ceil(Math.max(...eles) + 10)

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 mb-6">
      <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">Altimetría</div>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart
          data={data}
          margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
          onMouseMove={(e) => {
            const dataIdx = e?.activeTooltipIndex
            if (dataIdx != null) {
              const numIdx = Number(dataIdx)
              if (!isNaN(numIdx) && data[numIdx] != null) {
                onHover(data[numIdx].idx)
              }
            }
          }}
          onMouseLeave={() => onHover(null)}
        >
          <defs>
            <linearGradient id="eleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="dist"
            tick={{ fill: '#64748b', fontSize: 10 }}
            unit=" km"
            tickCount={6}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[minEle, maxEle]}
            tick={{ fill: '#64748b', fontSize: 10 }}
            unit="m"
            width={42}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              fontSize: 11,
              padding: '4px 10px',
            }}
            itemStyle={{ color: '#94a3b8' }}
            formatter={(v: unknown) => [`${v} m`, 'Altitud']}
            labelFormatter={(v) => `${v} km`}
            cursor={{ stroke: '#475569', strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="ele"
            stroke="var(--color-primary)"
            strokeWidth={1.5}
            fill="url(#eleGrad)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
