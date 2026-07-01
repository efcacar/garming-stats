import { Link } from 'react-router-dom'
import { useActivityStore } from '../stores/activityStore'
import { formatDuration, formatPace, sportIcon, sportColor } from '../utils/formatters'
import { daysAgo } from '../utils/date'
import { useFitnessHistory } from '../hooks/useFitnessHistory'
import { useWeekComparison } from '../hooks/useWeekComparison'
import { useSportVolume as _useSportVolume } from '../hooks/useSportVolume'
import { useTrainingStreak } from '../hooks/useTrainingStreak'
import { useZoneDistribution } from '../hooks/useZoneDistribution'
import { useWeeklyLoad } from '../hooks/useWeeklyLoad'
import RadialProgress from '../components/RadialProgress'
import FormBadge from '../components/FormBadge'
import DeltaBadge from '../components/DeltaBadge'
import {
  AreaChart, Area, XAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts'

// ─── Loading / Empty states ───────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-slate-400 animate-pulse text-sm">Cargando...</div>
    </div>
  )
}

function EmptyScreen() {
  return (
    <div className="flex-1 p-8 max-w-2xl">
      <div className="bg-amber-950/40 border border-amber-800/50 rounded-xl p-6">
        <h2 className="text-amber-300 font-medium text-lg mb-2">Sin datos de Garmin</h2>
        <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm text-slate-300 space-y-1 mt-3">
          <div>cp .env.example .env</div>
          <div>cd fetch && pip install -r requirements.txt</div>
          <div>python3 sync.py --limit 20</div>
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const activities = useActivityStore(s => s.activities)
  const stats = useActivityStore(s => s.stats)
  const sleep = useActivityStore(s => s.sleep)
  const loading = useActivityStore(s => s.loading)
  const error = useActivityStore(s => s.error)
  const theme = useActivityStore(s => s.settings.theme)

  const { current: fitness, sparkPoints } = useFitnessHistory()
  const { current: week, previous: lastWeek } = useWeekComparison()
  const { bySport: _sportHours, totalHours: _totalHours, percentages: _percentages } = _useSportVolume(30)
  const streak = useTrainingStreak()
  const { slices: zoneSlices, isAerobicFocused } = useZoneDistribution(30)
  const weeklyLoad = useWeeklyLoad(16)

  if (loading) return <LoadingScreen />
  if (error || activities.length === 0) return <EmptyScreen />

  const tsb = fitness?.tsb ?? 0
  const ctl = fitness?.ctl ?? 0
  const atl = fitness?.atl ?? 0
  const tsbColor = tsb > 10 ? '#22c55e' : tsb > -5 ? 'var(--color-primary)' : tsb > -15 ? '#eab308' : tsb > -25 ? '#f97316' : '#ef4444'
  const maxWeekTSS = Math.max(...weeklyLoad.map(w => w.tss), 1)

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden px-6 pt-7 pb-6"
        style={{ background: theme === 'light'
          ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #eff6ff 100%)'
          : 'linear-gradient(135deg, #18181b 0%, #27272a 50%, #18181b 100%)' }}>
        <div className="absolute top-0 left-1/4 w-96 h-48 rounded-full opacity-10 blur-3xl pointer-events-none"
          style={{ background: tsbColor }} />

        {/* Form title row */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">Estado de forma</div>
            <div className="flex items-center gap-3">
              <span className="text-4xl font-black" style={{ color: tsbColor, textShadow: `0 0 30px ${tsbColor}66` }}>
                {tsb > 0 ? '+' : ''}{Math.round(tsb)}
              </span>
              <div>
                <FormBadge tsb={tsb} />
                <div className="text-xs text-slate-500 mt-1.5">Forma = Fitness − Fatiga</div>
              </div>
            </div>
          </div>

          {/* VO2max */}
          {(stats?.currentVo2max || stats?.vo2maxHistory?.length) ? (
            <div className="text-right">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">VO2max</div>
              <div className="text-3xl font-black text-purple-400" style={{ textShadow: '0 0 20px #a855f766' }}>
                {(stats.currentVo2max ?? stats.vo2maxHistory.at(-1)!.value).toFixed(1)}
              </div>
              <div className="text-xs text-slate-500">ml/kg/min</div>
            </div>
          ) : null}
        </div>

        {/* CTL / ATL radials + streak */}
        <div className="flex flex-wrap items-center gap-6 mb-6">
          <div className="flex items-center gap-3">
            <RadialProgress value={ctl} max={100} color="#3b82f6" size={72} stroke={6}>
              <span className="text-base font-bold text-primary/80">{Math.round(ctl)}</span>
            </RadialProgress>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Fitness</div>
              <div className="text-xs text-slate-400">CTL · 42 días</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <RadialProgress value={atl} max={100} color="#f97316" size={72} stroke={6}>
              <span className="text-base font-bold text-orange-300">{Math.round(atl)}</span>
            </RadialProgress>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Fatiga</div>
              <div className="text-xs text-slate-400">ATL · 7 días</div>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {streak > 1 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border"
                style={{ borderColor: '#f59e0b40', background: '#f59e0b10' }}>
                <span className="text-lg">🔥</span>
                <div>
                  <div className="text-sm font-bold text-amber-400">{streak} días</div>
                  <div className="text-xs text-slate-500">racha activa</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fitness sparkline */}
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkPoints} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gCTL" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gATL" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                formatter={(v: unknown, n: unknown) => [String(v), String(n)]}
              />
              <Area type="monotone" dataKey="ctl" name="Fitness" stroke="var(--color-primary)" strokeWidth={2} fill="url(#gCTL)" dot={false} />
              <Area type="monotone" dataKey="atl" name="Fatiga" stroke="#f97316" strokeWidth={1.5} fill="url(#gATL)" dot={false} strokeDasharray="3 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 mt-1">
          <LegendDot color="#3b82f6" label="Fitness (CTL)" />
          <LegendDot color="#f97316" label="Fatiga (ATL)" />
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-5 space-y-5">

        {/* Week comparison */}
        <section>
          <SectionHeader left="Esta semana" right="vs semana anterior" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Sesiones',    value: week.count,            prev: lastWeek.count,            fmt: (v: number) => String(v),              unit: '' },
              { label: 'Distancia',   value: week.distance,         prev: lastWeek.distance,         fmt: (v: number) => v.toFixed(1),           unit: 'km' },
              { label: 'Tiempo',      value: week.duration / 3600,  prev: lastWeek.duration / 3600,  fmt: (v: number) => v.toFixed(1),           unit: 'h' },
              { label: 'Carga (TSS)', value: week.tss,              prev: lastWeek.tss,              fmt: (v: number) => Math.round(v).toString(), unit: '' },
            ].map(({ label, value, prev, fmt, unit }) => (
              <div key={label} className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4 hover:border-slate-600/60 transition-colors">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">{label}</div>
                <div className="text-2xl font-bold text-slate-100 mb-1">
                  {fmt(value)}<span className="text-sm text-slate-500 ml-1">{unit}</span>
                </div>
                <DeltaBadge value={value - prev} unit={unit ? ` ${unit}` : ''} />
              </div>
            ))}
          </div>
        </section>

        {/* Sport rings + Zone radar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-5">
            {sleep.length > 0 ? (() => {
              const last = sleep[sleep.length - 1]
              const sc = !last.score ? '#64748b' : last.score >= 80 ? '#22c55e' : last.score >= 60 ? '#3b82f6' : last.score >= 40 ? '#eab308' : '#ef4444'
              const hrs = (s: number) => `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`
              const total = last.durationSeconds
              const deepPct  = total > 0 ? (last.deepSeconds  / total) * 100 : 0
              const remPct   = total > 0 ? (last.remSeconds   / total) * 100 : 0
              const lightPct = total > 0 ? (last.lightSeconds / total) * 100 : 0
              const awakePct = total > 0 ? (last.awakeSeconds / total) * 100 : 0
              return (
                <Link to="/sleep" className="block h-full group">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🌙</span>
                      <div>
                        <div className="text-xs font-medium text-slate-300">Última noche</div>
                        <div className="text-xs text-slate-600">{last.date}</div>
                      </div>
                    </div>
                    <span className="text-xs text-slate-600 group-hover:text-primary transition-colors">Ver historial →</span>
                  </div>

                  {/* Score + duration row */}
                  <div className="flex items-center gap-4 mb-4">
                    {last.score != null && (
                      <div className="relative shrink-0">
                        <svg width="56" height="56" viewBox="0 0 56 56">
                          <circle cx="28" cy="28" r="23" fill="none" stroke="#1e293b" strokeWidth="5"/>
                          <circle cx="28" cy="28" r="23" fill="none" stroke={sc} strokeWidth="5"
                            strokeDasharray={`${(last.score / 100) * 144.5} 144.5`}
                            strokeLinecap="round" transform="rotate(-90 28 28)"
                            style={{ transition: 'stroke-dasharray 0.6s ease' }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-sm font-bold" style={{ color: sc }}>{last.score}</span>
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="text-xl font-bold text-slate-100">{hrs(total)}</div>
                      <div className="text-xs text-slate-500">duración total</div>
                    </div>
                  </div>

                  {/* Phase bar */}
                  <div className="flex h-1.5 rounded-full overflow-hidden gap-px mb-3">
                    <div style={{ width: `${deepPct}%`,  background: '#6366f1' }} />
                    <div style={{ width: `${remPct}%`,   background: '#a855f7' }} />
                    <div style={{ width: `${lightPct}%`, background: '#475569' }} />
                    <div style={{ width: `${awakePct}%`, background: '#ef444430' }} />
                  </div>

                  {/* Metrics row */}
                  <div className="flex gap-3">
                    <div className="flex-1 bg-slate-900/50 rounded-lg px-2 py-1.5 text-center">
                      <div className="text-xs font-semibold text-indigo-400">{hrs(last.deepSeconds)}</div>
                      <div className="text-xs text-slate-600">profundo</div>
                    </div>
                    <div className="flex-1 bg-slate-900/50 rounded-lg px-2 py-1.5 text-center">
                      <div className="text-xs font-semibold text-purple-400">{hrs(last.remSeconds)}</div>
                      <div className="text-xs text-slate-600">REM</div>
                    </div>
                    <div className="flex-1 bg-slate-900/50 rounded-lg px-2 py-1.5 text-center">
                      <div className="text-xs font-semibold text-slate-400">{hrs(last.lightSeconds)}</div>
                      <div className="text-xs text-slate-600">ligero</div>
                    </div>
                    {last.avgHRV != null && (
                      <div className="flex-1 bg-slate-900/50 rounded-lg px-2 py-1.5 text-center">
                        <div className="text-xs font-semibold text-cyan-400">{Math.round(last.avgHRV)}</div>
                        <div className="text-xs text-slate-600">HRV</div>
                      </div>
                    )}
                    {last.restingHR != null && (
                      <div className="flex-1 bg-slate-900/50 rounded-lg px-2 py-1.5 text-center">
                        <div className="text-xs font-semibold text-rose-400">{last.restingHR}</div>
                        <div className="text-xs text-slate-600">FC rep.</div>
                      </div>
                    )}
                  </div>
                </Link>
              )
            })() : (
              <div className="text-xs text-slate-500 uppercase tracking-wider">Sueño</div>
            )}
          </div>

          <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-5">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Zonas FC · 30 días</div>
            <div className="text-xs mb-2" style={{ color: isAerobicFocused ? '#22c55e' : '#eab308' }}>
              {isAerobicFocused ? '✅ Buena base aeróbica (Z1+Z2 >60%)' : '⚠️ Añade más entrenamiento en Z1–Z2'}
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <RadarChart data={zoneSlices} margin={{ top: 0, right: 20, bottom: 0, left: 20 }}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="zone" tick={{ fill: '#64748b', fontSize: 10 }} />
                <Radar dataKey="pct" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.2} strokeWidth={1.5} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                  formatter={(v: unknown) => [`${v}%`, 'Tiempo']}
                />
              </RadarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
              {zoneSlices.map(z => (
                <span key={z.zone} className="text-xs" style={{ color: z.color }}>{z.zone} {z.pct}%</span>
              ))}
            </div>
          </div>
        </div>

        {/* Recent activities */}<section>
          <SectionHeader left="Últimas actividades" rightLink={{ to: '/activities', label: 'Ver todas →' }} />
          <div className="space-y-2">
            {activities.slice(0, 6).map(a => (
              <Link
                key={a.id}
                to={`/activity/${a.id}`}
                className="flex items-center gap-4 px-4 py-3 rounded-xl border border-slate-700/40 bg-slate-800/30 hover:bg-slate-800/70 hover:border-slate-600/50 transition-all group"
              >
                <div className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: sportColor(a.sport), boxShadow: `0 0 6px ${sportColor(a.sport)}88` }} />

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-200 truncate group-hover:text-white">{a.title}</div>
                  <div className="text-xs text-slate-500">
                    {daysAgo(a.startTime) === 0 ? 'Hoy' : daysAgo(a.startTime) === 1 ? 'Ayer' : `Hace ${daysAgo(a.startTime)}d`}
                    {' · '}{sportIcon(a.sport)}
                  </div>
                </div>

                <div className="flex items-center gap-5 shrink-0 text-right">
                  {a.distance > 0 && (
                    <div>
                      <div className="text-sm font-bold text-slate-200">
                        {a.distance.toFixed(1)}<span className="text-xs text-slate-500 ml-0.5">km</span>
                      </div>
                      {a.avgPace && <div className="text-xs text-slate-500">{formatPace(a.avgPace)}</div>}
                      {a.avgSpeed && !a.avgPace && <div className="text-xs text-slate-500">{a.avgSpeed.toFixed(1)} km/h</div>}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-bold text-slate-200">{formatDuration(a.duration)}</div>
                    {a.avgHR > 0 && <div className="text-xs text-slate-500">{a.avgHR} bpm</div>}
                  </div>
                  {a.tss != null && (
                    <div className="w-10 text-right">
                      <div className="text-sm font-bold" style={{ color: sportColor(a.sport) }}>{Math.round(a.tss)}</div>
                      <div className="text-xs text-slate-600">TSS</div>
                    </div>
                  )}
                  <div className="text-slate-600 group-hover:text-slate-400 text-xs">→</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <div className="h-2" />
      </div>
    </div>
  )
}

// ─── Shared layout helpers ────────────────────────────────────────────────────

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-500">
      <span className="w-3 h-0.5 rounded inline-block" style={{ background: color }} />
      {label}
    </span>
  )
}

function SectionHeader({
  left,
  right,
  rightLink,
}: {
  left: string
  right?: string
  rightLink?: { to: string; label: string }
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="text-xs text-slate-500 uppercase tracking-widest">{left}</div>
      {right && <div className="text-xs text-slate-600">{right}</div>}
      {rightLink && (
        <Link to={rightLink.to} className="text-xs text-primary hover:text-primary/80">{rightLink.label}</Link>
      )}
    </div>
  )
}
