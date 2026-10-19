import { useMemo } from 'react'
import { useActivityStore } from '../stores/activityStore'
import type { WeightEntry } from '../types/garmin'
import {
  ResponsiveContainer,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts'

function fmtKg(v: number): string {
  return `${v.toFixed(1)} kg`
}

function round1(v: number): number {
  return Number(v.toFixed(1))
}

function fmtDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function daysDiff(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00`).getTime()
  const db = new Date(`${b}T00:00:00`).getTime()
  return Math.round((da - db) / 86400000)
}

function movingAverage(values: number[], windowSize: number): number[] {
  const out: number[] = []
  for (let i = 0; i < values.length; i += 1) {
    const start = Math.max(0, i - windowSize + 1)
    const window = values.slice(start, i + 1)
    const avg = window.reduce((s, v) => s + v, 0) / window.length
    out.push(Number(avg.toFixed(2)))
  }
  return out
}

function findClosestPast(entries: WeightEntry[], targetDate: string, minDays: number): WeightEntry | null {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const d = daysDiff(targetDate, entries[i].date)
    if (d >= minDays) return entries[i]
  }
  return null
}

export default function WeightPage() {
  const weight = useActivityStore(s => s.weight)

  if (weight.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Sin datos de peso. Ejecuta <code className="mx-1 text-slate-400">source .venv/bin/activate && python fetch/sync.py</code> para sincronizar.
      </div>
    )
  }

  const last180 = weight.slice(-180)
  const values = last180.map(e => e.weightKg)
  const trend = movingAverage(values, 7)
  const chartData = last180.map((e, i) => ({
    ...e,
    d: e.date.slice(5),
    trendKg: trend[i],
  }))

  const latest = weight[weight.length - 1]
  const first = weight[0]
  const minW = Math.min(...values)
  const maxW = Math.max(...values)

  const prev30 = findClosestPast(weight, latest.date, 30)
  const prev90 = findClosestPast(weight, latest.date, 90)
  const delta30 = prev30 ? latest.weightKg - prev30.weightKg : null
  const delta90 = prev90 ? latest.weightKg - prev90.weightKg : null

  const yMin = Math.floor((Math.min(...values, ...trend) - 1) * 2) / 2
  const yMax = Math.ceil((Math.max(...values, ...trend) + 1) * 2) / 2

  const lastEntryWithBodyFat = [...weight].reverse().find(e => e.bodyFatPct != null)

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Peso</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {weight.length} mediciones · desde {fmtDate(first.date)} hasta {fmtDate(latest.date)}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Último registro</div>
          <div className="text-3xl font-black text-primary">{fmtKg(latest.weightKg)}</div>
          <div className="text-xs text-slate-500">{fmtDate(latest.date)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-slate-100">{fmtKg(minW)}</div>
          <div className="text-xs text-slate-500 mt-1">Mínimo (180 días)</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-slate-100">{fmtKg(maxW)}</div>
          <div className="text-xs text-slate-500 mt-1">Máximo (180 días)</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 text-center">
          <div className={`text-2xl font-bold ${delta30 != null && delta30 <= 0 ? 'text-green-400' : 'text-amber-400'}`}>
            {delta30 == null ? '–' : `${delta30 > 0 ? '+' : ''}${delta30.toFixed(1)} kg`}
          </div>
          <div className="text-xs text-slate-500 mt-1">Cambio 30 días</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 text-center">
          <div className={`text-2xl font-bold ${delta90 != null && delta90 <= 0 ? 'text-green-400' : 'text-amber-400'}`}>
            {delta90 == null ? '–' : `${delta90 > 0 ? '+' : ''}${delta90.toFixed(1)} kg`}
          </div>
          <div className="text-xs text-slate-500 mt-1">Cambio 90 días</div>
        </div>
      </div>

      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 mb-6">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">Evolución de peso · últimos 180 registros</div>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={chartData} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="weightArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="d" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} interval={Math.max(Math.floor(chartData.length / 8), 1)} />
            <YAxis domain={[yMin, yMax]} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={38} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: '#64748b' }}
              labelFormatter={(_, payload) => {
                const p = payload?.[0]?.payload as { date?: string } | undefined
                return p?.date ? fmtDate(p.date) : ''
              }}
              formatter={(value: unknown, name: unknown) => {
                if (typeof value !== 'number') return [value, name]
                if (name === 'trendKg') return [fmtKg(value), 'Tendencia 7d']
                return [fmtKg(value), 'Peso']
              }}
            />
            <ReferenceLine y={latest.weightKg} stroke="#334155" strokeDasharray="4 4" />
            <Area type="monotone" dataKey="weightKg" fill="url(#weightArea)" stroke="none" />
            <Line type="monotone" dataKey="weightKg" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="trendKg" stroke="#f59e0b" strokeWidth={1.8} dot={false} strokeDasharray="5 3" />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'var(--color-primary)' }} />
            Peso diario
          </div>
          <div className="flex items-center gap-1.5 text-amber-300">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} />
            Tendencia (media 7 días)
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">Composición corporal</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Metric label="IMC" value={latest.bmi != null ? latest.bmi.toFixed(1) : '–'} />
            <Metric label="% Grasa" value={lastEntryWithBodyFat?.bodyFatPct != null ? `${lastEntryWithBodyFat.bodyFatPct.toFixed(1)}%` : '–'} />
            <Metric label="Masa muscular" value={latest.muscleMassKg != null ? fmtKg(latest.muscleMassKg) : '–'} />
            <Metric label="Agua corporal" value={latest.bodyWaterPct != null ? `${latest.bodyWaterPct.toFixed(1)}%` : '–'} />
            <Metric label="Masa ósea" value={latest.boneMassKg != null ? fmtKg(latest.boneMassKg) : '–'} />
            <Metric label="Edad metabólica" value={latest.metabolicAge != null ? `${Math.round(latest.metabolicAge)}` : '–'} />
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">Últimos registros (delta vs medida anterior)</div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {[...weight].reverse().slice(0, 20).map((e, idx, arr) => {
              const prev = arr[idx + 1]
              const delta = prev ? round1(round1(e.weightKg) - round1(prev.weightKg)) : null
              const deltaColor = delta == null ? 'text-slate-500' : delta <= 0 ? 'text-green-400' : 'text-amber-400'
              return (
                <div key={`${e.date}-${e.timestamp ?? idx}`} className="flex items-center justify-between bg-slate-900/60 border border-slate-700/40 rounded-lg px-3 py-2">
                  <div>
                    <div className="text-sm text-slate-200">{fmtDate(e.date)}</div>
                    <div className="text-xs text-slate-500">
                      {e.bmi != null ? `IMC ${e.bmi.toFixed(1)}` : 'Sin IMC'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-100">{fmtKg(e.weightKg)}</div>
                    <div className={`text-xs ${deltaColor}`}>
                      {delta == null ? '–' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg`}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900/60 border border-slate-700/40 rounded-lg px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-200 mt-0.5">{value}</div>
    </div>
  )
}
