import { useMemo, useState } from 'react'
import { useActivityStore } from '../stores/activityStore'
import { formatDuration } from '../utils/formatters'
import type { SleepEntry } from '../types/garmin'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

function hrs(s: number): string {
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`
}

function scoreColor(score: number | null): string {
  if (score == null) return '#64748b'
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#3b82f6'
  if (score >= 40) return '#eab308'
  return '#ef4444'
}

function SleepCard({ entry }: { entry: SleepEntry }) {
  const total = entry.durationSeconds
  const deep = total > 0 ? (entry.deepSeconds / total) * 100 : 0
  const rem  = total > 0 ? (entry.remSeconds  / total) * 100 : 0
  const light = total > 0 ? (entry.lightSeconds / total) * 100 : 0
  const awake = total > 0 ? (entry.awakeSeconds / total) * 100 : 0
  const sc = scoreColor(entry.score)

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-sm font-medium text-slate-200">{entry.date}</div>
          <div className="text-xs text-slate-500 mt-0.5">{hrs(total)}</div>
        </div>
        {entry.score != null && (
          <div className="text-2xl font-black" style={{ color: sc }}>{entry.score}</div>
        )}
      </div>

      {/* Phase bar */}
      <div className="flex h-2 rounded-full overflow-hidden gap-px mb-3">
        <div style={{ width: `${deep}%`,  background: '#6366f1' }} title={`Profundo: ${hrs(entry.deepSeconds)}`} />
        <div style={{ width: `${rem}%`,   background: '#a855f7' }} title={`REM: ${hrs(entry.remSeconds)}`} />
        <div style={{ width: `${light}%`, background: '#475569' }} title={`Ligero: ${hrs(entry.lightSeconds)}`} />
        <div style={{ width: `${awake}%`, background: '#ef444440' }} title={`Despierto: ${hrs(entry.awakeSeconds)}`} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-xs font-medium text-indigo-400">{hrs(entry.deepSeconds)}</div>
          <div className="text-xs text-slate-500">profundo</div>
        </div>
        <div>
          <div className="text-xs font-medium text-purple-400">{hrs(entry.remSeconds)}</div>
          <div className="text-xs text-slate-500">REM</div>
        </div>
        <div>
          <div className="text-xs font-medium text-slate-400">{hrs(entry.lightSeconds)}</div>
          <div className="text-xs text-slate-500">ligero</div>
        </div>
      </div>

      {(entry.avgHRV != null || entry.restingHR != null || entry.avgSpO2 != null) && (
        <div className="flex gap-4 mt-3 pt-3 border-t border-slate-700/50">
          {entry.avgHRV != null && (
            <div className="text-center">
              <div className="text-xs font-semibold text-cyan-400">{Math.round(entry.avgHRV)}</div>
              <div className="text-xs text-slate-500">HRV</div>
            </div>
          )}
          {entry.restingHR != null && (
            <div className="text-center">
              <div className="text-xs font-semibold text-rose-400">{entry.restingHR}</div>
              <div className="text-xs text-slate-500">FC reposo</div>
            </div>
          )}
          {entry.avgSpO2 != null && (
            <div className="text-center">
              <div className="text-xs font-semibold text-primary">{entry.avgSpO2.toFixed(1)}%</div>
              <div className="text-xs text-slate-500">SpO₂</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function SleepPage() {
  const sleep = useActivityStore(s => s.sleep)
  const [view, setView] = useState<'charts' | 'list'>('charts')

  const chartData = useMemo(() =>
    sleep.slice(-30).map(e => ({
      date: e.date.slice(5),
      total: +(e.durationSeconds / 3600).toFixed(2),
      deep:  +(e.deepSeconds  / 3600).toFixed(2),
      rem:   +(e.remSeconds   / 3600).toFixed(2),
      light: +(e.lightSeconds / 3600).toFixed(2),
      score: e.score ?? null,
      hrv:   e.avgHRV ?? null,
    })),
    [sleep]
  )

  const avgDuration = sleep.length
    ? sleep.reduce((s, e) => s + e.durationSeconds, 0) / sleep.length
    : 0
  const avgScore = sleep.filter(e => e.score != null).length
    ? sleep.filter(e => e.score != null).reduce((s, e) => s + e.score!, 0) / sleep.filter(e => e.score != null).length
    : null
  const avgHRV = sleep.filter(e => e.avgHRV != null).length
    ? sleep.filter(e => e.avgHRV != null).reduce((s, e) => s + e.avgHRV!, 0) / sleep.filter(e => e.avgHRV != null).length
    : null

  if (sleep.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Sin datos de sueño. Ejecuta <code className="mx-1 text-slate-400">python3 fetch/sync.py</code> para sincronizar.
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="flex flex-wrap gap-3 items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Sueño</h1>
          <p className="text-sm text-slate-500 mt-0.5">{sleep.length} noches registradas</p>
        </div>
        <div className="flex bg-slate-800 rounded-lg p-0.5 gap-0.5">
          {(['charts', 'list'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${view === v ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              {v === 'charts' ? '📊 Gráficos' : '📋 Lista'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-slate-100">{hrs(avgDuration)}</div>
          <div className="text-xs text-slate-500 mt-1">Duración media</div>
        </div>
        {avgScore != null && (
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold" style={{ color: scoreColor(Math.round(avgScore)) }}>{avgScore.toFixed(0)}</div>
            <div className="text-xs text-slate-500 mt-1">Puntuación media</div>
          </div>
        )}
        {avgHRV != null && (
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-cyan-400">{avgHRV.toFixed(0)}</div>
            <div className="text-xs text-slate-500 mt-1">HRV medio</div>
          </div>
        )}
      </div>

      {view === 'charts' ? (
        <div className="space-y-4">
          {/* Duration chart */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">Duración (h) · últimas 30 noches</div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} axisLine={false} interval={4} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={28} domain={[0, 10]} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  content={({ payload, label }) => {
                    if (!payload?.length) return null
                    const total = payload.reduce((s, p) => s + Number(p.value ?? 0), 0)
                    const COLORS: Record<string, string> = { deep: '#6366f1', rem: '#a855f7', light: '#475569' }
                    const LABELS: Record<string, string> = { deep: 'Profundo', rem: 'REM', light: 'Ligero' }
                    return (
                      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '6px 10px', fontSize: 11 }}>
                        <div style={{ color: '#64748b', marginBottom: 4 }}>{label}</div>
                        {payload.map(p => (
                          <div key={p.dataKey as string} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: COLORS[p.dataKey as string] ?? '#94a3b8' }}>
                            <span>{LABELS[p.dataKey as string] ?? p.dataKey}</span>
                            <span>{Number(p.value).toFixed(1)} h</span>
                          </div>
                        ))}
                        <div style={{ borderTop: '1px solid #334155', marginTop: 4, paddingTop: 4, display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                          <span>Total</span>
                          <span>{total.toFixed(1)} h</span>
                        </div>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="deep"  stackId="a" fill="#6366f1" radius={0} />
                <Bar dataKey="rem"   stackId="a" fill="#a855f7" radius={0} />
                <Bar dataKey="light" stackId="a" fill="#475569" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 justify-between items-center">
              <div className="flex gap-4">
                {([['#6366f1','Profundo'],['#a855f7','REM'],['#475569','Ligero']] as [string,string][]).map(([c,l]) => (
                  <div key={l} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: c }} />
                    <span className="text-xs font-medium" style={{ color: c }}>{l}</span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-slate-500">
                Total: <span className="text-slate-300 font-medium">{hrs(chartData.reduce((s,d) => s + (d.deep + d.rem + d.light) * 3600, 0))}</span>
              </div>
            </div>
          </div>

          {/* Score + HRV chart */}
          {chartData.some(d => d.score != null) && (
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">Puntuación de sueño</div>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} axisLine={false} interval={4} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={28} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} labelStyle={{ color: '#64748b' }} cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    formatter={(v: unknown) => [v, 'Puntuación']} />
                  <Area type="monotone" dataKey="score" stroke="var(--color-primary)" strokeWidth={1.5} fill="url(#scoreGrad)" dot={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* HRV chart */}
          {chartData.some(d => d.hrv != null) && (
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">HRV nocturno</div>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="hrvGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} axisLine={false} interval={4} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} labelStyle={{ color: '#64748b' }} cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    formatter={(v: unknown) => [v, 'HRV']} />
                  <Area type="monotone" dataKey="hrv" stroke="#06b6d4" strokeWidth={1.5} fill="url(#hrvGrad)" dot={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...sleep].reverse().map(e => <SleepCard key={e.date} entry={e} />)}
        </div>
      )}
    </div>
  )
}
