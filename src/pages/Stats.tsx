import { useMemo, useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useActivityStore } from '../stores/activityStore'
import { formatDuration, sportIcon } from '../utils/formatters'
import type { ActivitySummary } from '../types/garmin'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, LineChart, Line, AreaChart, Area, ComposedChart,
} from 'recharts'

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtDist(km: number) {
  return `${fmtNum(km)} km`
}
function fmtTime(s: number) {
  const h = Math.floor(s / 3600)
  return `${fmtNum(h)} h`
}

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const DAYS_ES   = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// ─── Expandable chart card ─────────────────────────────────────────────────────
function ExpandableCard({ title, legend, children, defaultHeight = 200 }: {
  title: React.ReactNode
  legend?: React.ReactNode
  children: React.ReactNode
  defaultHeight?: number | 'auto'
}) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

  return (
    <>
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">{title}</div>
          <div className="flex items-center gap-3">
            {legend}
            <button onClick={() => setExpanded(true)} title="Ampliar" className="p-1 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            </button>
          </div>
        </div>
        <div style={defaultHeight === 'auto' ? undefined : { height: defaultHeight }}>{children}</div>
      </div>
      {expanded && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={() => setExpanded(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-5xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="text-sm font-medium text-slate-300 uppercase tracking-wider">{title}</div>
              <div className="flex items-center gap-4">
                {legend}
                <button onClick={() => setExpanded(false)} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
            <div style={defaultHeight === 'auto' ? undefined : { height: 480 }}>{children}</div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Summary card ─────────────────────────────────────────────────────────────
function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 text-center">
      <div className="text-2xl font-bold text-slate-100 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
      <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">{label}</div>
    </div>
  )
}

// ─── Activity calendar heatmap ────────────────────────────────────────────────
function CalendarHeatmap({ activities, year }: { activities: ActivitySummary[]; year: number }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const byDay = useMemo(() => {
    const map: Record<string, number> = {}
    for (const a of activities) {
      if (!a.startTime.startsWith(String(year))) continue
      const day = a.startTime.slice(0, 10)
      map[day] = (map[day] ?? 0) + a.distance
    }
    return map
  }, [activities, year])

  const maxDist = Math.max(...Object.values(byDay), 1)
  function cellColor(dist: number) {
    if (!dist) return '#1e293b'
    const t = Math.min(dist / maxDist, 1)
    if (t < 0.25) return '#1d4ed8'
    if (t < 0.5)  return '#2563eb'
    if (t < 0.75) return 'var(--color-primary)'
    return '#60a5fa'
  }

  const months = useMemo(() => Array.from({ length: 12 }, (_, mo) => {
    const daysInMonth = new Date(year, mo + 1, 0).getDate()
    const firstDow = (new Date(year, mo, 1).getDay() + 6) % 7
    const cells: (string | null)[] = [
      ...Array(firstDow).fill(null),
      ...Array.from({ length: daysInMonth }, (_, d) =>
        `${year}-${String(mo + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`
      ),
    ]
    const weeks: (string | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7).concat(Array(7).fill(null)).slice(0, 7))
    return { label: MONTHS_ES[mo], weeks }
  }), [byDay, year])

  function handleMouseMove(e: React.MouseEvent, date: string | null) {
    if (!date) { setTooltip(null); return }
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const dist = byDay[date] ?? 0
    const [, , dd] = date.split('-')
    const dateObj = new Date(date + 'T00:00:00')
    const dayName = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][dateObj.getDay()]
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      text: dist > 0
        ? `${dayName} ${parseInt(dd)} · ${dist.toFixed(1)} km`
        : `${dayName} ${parseInt(dd)} · Sin actividad`,
    })
  }

  return (
    <div ref={containerRef} className="overflow-x-auto relative">
      {tooltip && (
        <div
          className="absolute z-10 pointer-events-none px-2.5 py-1.5 rounded-lg text-xs text-slate-200 bg-slate-900 border border-slate-700 shadow-lg whitespace-nowrap"
          style={{ left: tooltip.x + 12, top: tooltip.y - 32 }}
        >
          {tooltip.text}
        </div>
      )}
      <div className="flex flex-wrap gap-4" onMouseLeave={() => setTooltip(null)}>
        {months.map(({ label, weeks }) => (
          <div key={label} className="shrink-0">
            <div className="text-xs text-slate-400 font-medium mb-1.5 text-center">{label}</div>
            <div className="flex gap-1 mb-1">
              {DAYS_ES.map(d => (
                <div key={d} className="w-3 text-center" style={{ fontSize: 8, color: '#475569' }}>{d[0]}</div>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex gap-1">
                  {week.map((date, di) => (
                    <div
                      key={di}
                      onMouseMove={e => handleMouseMove(e, date)}
                      className="w-3 h-3 rounded-sm cursor-default"
                      style={{ background: date ? cellColor(byDay[date] ?? 0) : 'transparent' }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function StatsPage() {
  const activities = useActivityStore(s => s.activities)
  const [sportFilter, setSportFilter] = useState<string>('all')
  const [hiddenYears, setHiddenYears] = useState<Set<string>>(new Set())
  const toggleYear = (y: string) => setHiddenYears(prev => {
    const next = new Set(prev); next.has(y) ? next.delete(y) : next.add(y); return next
  })

  const years = useMemo(() => {
    const ys = [...new Set(activities.map(a => a.startTime.slice(0, 4)))].sort().reverse()
    return ys
  }, [activities])
  const [calYear, setCalYear] = useState<number>(() => new Date().getFullYear())

  const filtered = useMemo(() =>
    sportFilter === 'all' ? activities : activities.filter(a => a.sport === sportFilter),
    [activities, sportFilter]
  )

  const availableSports = useMemo(() => {
    const LABELS: Record<string, string> = {
      running: 'Running', cycling: 'Ciclismo', swimming: 'Natación',
      walking: 'Caminar', strength: 'Fuerza', padel: 'Pádel', other: 'Otro',
    }
    return [...new Set(activities.map(a => a.sport))].sort((a, b) =>
      (LABELS[a] ?? a).localeCompare(LABELS[b] ?? b, 'es')
    )
  }, [activities])

  // ── Totals ──
  const totals = useMemo(() => ({
    distance:  filtered.reduce((s, a) => s + a.distance, 0),
    elevation: filtered.reduce((s, a) => s + a.elevationGain, 0),
    time:      filtered.reduce((s, a) => s + a.duration, 0),
    count:     filtered.length,
  }), [filtered])

  // ── Monthly data (last 24 months, kept for best-month calc) ──
  const monthlyData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const a of filtered) {
      const key = a.startTime.slice(0, 7)
      map[key] = (map[key] ?? 0) + a.distance
    }
    const keys = Object.keys(map).sort()
    return keys.slice(-24).map(k => ({
      month: MONTHS_ES[parseInt(k.slice(5)) - 1] + ' ' + k.slice(2, 4),
      dist: +map[k].toFixed(1),
    }))
  }, [filtered])

  // ── Yearly totals ──
  const yearlyData = useMemo(() => {
    const map: Record<string, { dist: number; elev: number; count: number }> = {}
    for (const a of filtered) {
      const y = a.startTime.slice(0, 4)
      if (!map[y]) map[y] = { dist: 0, elev: 0, count: 0 }
      map[y].dist  += a.distance
      map[y].elev  += a.elevationGain
      map[y].count += 1
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([year, v]) => ({
      year,
      dist:  +v.dist.toFixed(1),
      elev:  Math.round(v.elev),
      count: v.count,
    }))
  }, [filtered])

  // ── Day of week distribution ──
  const dowData = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0]
    for (const a of filtered) {
      const d = new Date(a.startTime)
      counts[(d.getDay() + 6) % 7]++
    }
    return DAYS_ES.map((label, i) => ({ label, count: counts[i] }))
  }, [filtered])

  // ── Hour of day distribution ──
  const hourData = useMemo(() => {
    const counts = Array.from({ length: 24 }, (_, h) => ({ hour: `${String(h).padStart(2, '0')}h`, count: 0 }))
    for (const a of filtered) {
      const h = new Date(a.startTime).getHours()
      counts[h].count++
    }
    return counts
  }, [filtered])

  // ── Distance histogram ──
  const distHist = useMemo(() => {
    const buckets = [
      { label: '0–5', min: 0, max: 5 }, { label: '5–10', min: 5, max: 10 },
      { label: '10–15', min: 10, max: 15 }, { label: '15–21', min: 15, max: 21 },
      { label: '21–30', min: 21, max: 30 }, { label: '30–42', min: 30, max: 42 },
      { label: '42+', min: 42, max: Infinity },
    ]
    return buckets.map(b => ({
      label: b.label,
      count: filtered.filter(a => a.distance >= b.min && a.distance < b.max).length,
    })).filter(b => b.count > 0)
  }, [filtered])

  // ── Best month ──
  const bestMonth = useMemo(() => {
    if (!monthlyData.length) return null
    return monthlyData.reduce((best, m) => m.dist > best.dist ? m : best)
  }, [monthlyData])

  // ── Longest streak ──
  const longestStreak = useMemo(() => {
    const days = [...new Set(filtered.map(a => a.startTime.slice(0, 10)))].sort()
    let max = 0, cur = 0, prev = ''
    for (const d of days) {
      const diff = prev ? (new Date(d).getTime() - new Date(prev).getTime()) / 86400000 : 0
      cur = diff === 1 ? cur + 1 : 1
      if (cur > max) max = cur
      prev = d
    }
    return max
  }, [filtered])

  // ── Year-over-year monthly comparison ──
  const YEAR_COLORS = ['var(--color-primary)','#f97316','#22c55e','#a855f7','#f59e0b','#ec4899']

  const { chartYears, monthlyByYear } = useMemo(() => {
    type Row = Record<string, number | string | null>
    const byYearMonth: Record<string, Record<number, { dist: number; elev: number; time: number; count: number; sumPace: number; cntPace: number; sumSpeed: number; cntSpeed: number; sumHR: number; cntHR: number }>> = {}

    for (const a of filtered) {
      const y = a.startTime.slice(0, 4)
      const mo = parseInt(a.startTime.slice(5, 7)) - 1
      if (!byYearMonth[y]) byYearMonth[y] = {}
      if (!byYearMonth[y][mo]) byYearMonth[y][mo] = { dist: 0, elev: 0, time: 0, count: 0, sumPace: 0, cntPace: 0, sumSpeed: 0, cntSpeed: 0, sumHR: 0, cntHR: 0 }
      const r = byYearMonth[y][mo]
      r.dist  += a.distance
      r.elev  += a.elevationGain
      r.time  += a.duration
      r.count += 1
      if (a.avgPace && a.sport === 'running') { r.sumPace += a.avgPace; r.cntPace++ }
      if (a.avgSpeed && a.sport === 'cycling') { r.sumSpeed += a.avgSpeed; r.cntSpeed++ }
      if (a.avgHR) { r.sumHR += a.avgHR; r.cntHR++ }
    }

    const chartYears = Object.keys(byYearMonth).sort()

    const monthlyByYear = MONTHS_ES.map((label, mo) => {
      const row: Row = { month: label }
      for (const y of chartYears) {
        const d = byYearMonth[y]?.[mo]
        row[`dist_${y}`]  = d ? +d.dist.toFixed(1) : 0
        row[`elev_${y}`]  = d ? Math.round(d.elev) : 0
        row[`time_${y}`]  = d ? +(d.time / 3600).toFixed(1) : 0
        row[`count_${y}`] = d ? d.count : 0
        row[`pace_${y}`]  = d && d.cntPace  ? +(d.sumPace / d.cntPace / 60).toFixed(2) : null
        row[`speed_${y}`] = d && d.cntSpeed ? +(d.sumSpeed / d.cntSpeed).toFixed(1) : null
        row[`hr_${y}`]    = d && d.cntHR    ? Math.round(d.sumHR / d.cntHR) : null
      }
      return row
    })

    return { chartYears, monthlyByYear }
  }, [filtered])

  // ── Cumulative distance current year ──
  const cumulativeYear = useMemo(() => {
    const year = new Date().getFullYear()
    const acts = filtered
      .filter(a => a.startTime.startsWith(String(year)))
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
    let cum = 0
    return acts.map(a => {
      cum += a.distance
      return { date: a.startTime.slice(5, 10), cum: +cum.toFixed(1) }
    })
  }, [filtered])

  // ── Top 10 activities by distance ──
  const topByDist = useMemo(() =>
    [...filtered].sort((a, b) => b.distance - a.distance).slice(0, 10),
    [filtered]
  )

  // ── Seasonal pattern (avg distance per calendar month across all years) ──
  const seasonalData = useMemo(() => {
    const map = Array.from({ length: 12 }, () => ({ sum: 0, count: 0 }))
    for (const a of filtered) {
      const mo = parseInt(a.startTime.slice(5, 7)) - 1
      map[mo].sum += a.distance
      map[mo].count++
    }
    return MONTHS_ES.map((label, i) => ({
      label,
      avg: map[i].count ? +(map[i].sum / map[i].count).toFixed(1) : 0,
      count: map[i].count,
    }))
  }, [filtered])

  // ── Avg HR evolution per month ──  (kept for seasonal pattern)
  const monthlyHR = useMemo(() => {
    const map: Record<string, { sum: number; cnt: number }> = {}
    for (const a of filtered) {
      if (!a.avgHR) continue
      const key = a.startTime.slice(0, 7)
      if (!map[key]) map[key] = { sum: 0, cnt: 0 }
      map[key].sum += a.avgHR
      map[key].cnt++
    }
    return Object.keys(map).sort().slice(-18).map(k => ({
      month: MONTHS_ES[parseInt(k.slice(5)) - 1] + ' ' + k.slice(2, 4),
      avgHR: Math.round(map[k].sum / map[k].cnt),
    }))
  }, [filtered])

  const TOOLTIP_STYLE = { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }
  const TOOLTIP_PROPS = {
    contentStyle: TOOLTIP_STYLE,
    itemStyle: { color: '#94a3b8' },
    labelStyle: { color: '#64748b', marginBottom: 2 },
    cursor: { fill: 'rgba(255,255,255,0.04)' },
  }

  if (activities.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">Sin actividades.</div>
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-100">Estadísticas</h1>
        <p className="text-sm text-slate-500 mt-0.5">Resumen global de tu actividad deportiva</p>
        <div className="flex items-center gap-2 mt-4">
          <span className="text-xs text-slate-500 w-16">Deporte</span>
          <div className="flex flex-wrap bg-slate-800 rounded-lg p-0.5 gap-0.5">
            {['all', ...availableSports].map(sp => (
              <button key={sp} onClick={() => setSportFilter(sp)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${sportFilter === sp ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                {sp === 'all' ? 'Todos' : sp === 'running' ? '🏃 Running' : sp === 'cycling' ? '🚴 Ciclismo' : sp === 'swimming' ? '🏊 Natación' : sp === 'walking' ? '🚶 Caminar' : sp === 'strength' ? '💪 Fuerza' : sp === 'padel' ? '🎾 Pádel' : '⚡ Otro'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Actividades"   value={fmtNum(totals.count)} />
        <Stat label="Distancia"     value={fmtDist(totals.distance)} />
        <Stat label="Tiempo"        value={fmtTime(totals.time)} />
        <Stat label="Desnivel +"    value={`${fmtNum(totals.elevation)} m`} />
      </div>

      {/* Highlights */}
      {(bestMonth || longestStreak > 1) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {bestMonth && <Stat label="Mejor mes" value={bestMonth.month} sub={`${bestMonth.dist.toFixed(0)} km`} />}
          {longestStreak > 1 && <Stat label="Racha más larga" value={`${longestStreak} días`} />}
          {yearlyData.length > 0 && (
            <Stat
              label="Mejor año"
              value={yearlyData.reduce((b, y) => y.dist > b.dist ? y : b).year}
              sub={`${fmtDist(yearlyData.reduce((b, y) => y.dist > b.dist ? y : b).dist)}`}
            />
          )}
        </div>
      )}

      <div className="space-y-4">

        {/* Calendar heatmap */}
        <ExpandableCard
          defaultHeight="auto"
          title="Actividad por día"
          legend={
            <div className="flex bg-slate-900 rounded-lg p-0.5 gap-0.5">
              {years.slice(0, 5).map(y => (
                <button key={y} onClick={() => setCalYear(Number(y))}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors ${calYear === Number(y) ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                  {y}
                </button>
              ))}
            </div>
          }
        >
          <CalendarHeatmap activities={sportFilter === 'all' ? activities : filtered} year={calYear} />
          <div className="flex items-center gap-2 mt-3 justify-end">
            <span className="text-xs text-slate-600">Menos</span>
            {['#1e293b', '#1d4ed8', '#2563eb', 'var(--color-primary)', '#60a5fa'].map(c => (
              <div key={c} className="w-3 h-3 rounded-sm" style={{ background: c }} />
            ))}
            <span className="text-xs text-slate-600">Más</span>
          </div>
        </ExpandableCard>

        {/* Monthly dist + elev */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ExpandableCard title="Distancia mensual" legend={<div className="flex gap-3">{chartYears.map((y,i) => <span key={y} onClick={() => toggleYear(y)} className={`cursor-pointer flex items-center gap-1 text-xs transition-opacity select-none ${hiddenYears.has(y) ? 'opacity-30 line-through' : 'text-slate-400 hover:text-slate-200'}`}><span className="w-2 h-2 rounded-full inline-block" style={{background: YEAR_COLORS[i]}}/>{y}</span>)}</div>}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyByYear} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={35} unit=" km" />
                  <Tooltip {...TOOLTIP_PROPS} formatter={(v: unknown, name: string) => [`${v} km`, name.replace('dist_','')]} />
                  {chartYears.map((y,i) => <Line key={y} type="monotone" dataKey={`dist_${y}`} stroke={YEAR_COLORS[i]} strokeWidth={2} dot={false} connectNulls hide={hiddenYears.has(y)} />)}
                </LineChart>
              </ResponsiveContainer>
            </ExpandableCard>

          <ExpandableCard title="Desnivel mensual" legend={<div className="flex gap-3">{chartYears.map((y,i) => <span key={y} onClick={() => toggleYear(y)} className={`cursor-pointer flex items-center gap-1 text-xs transition-opacity select-none ${hiddenYears.has(y) ? 'opacity-30 line-through' : 'text-slate-400 hover:text-slate-200'}`}><span className="w-2 h-2 rounded-full inline-block" style={{background: YEAR_COLORS[i]}}/>{y}</span>)}</div>}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyByYear} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={40} unit=" m" />
                  <Tooltip {...TOOLTIP_PROPS} formatter={(v: unknown, name: string) => [`${v} m`, name.replace('elev_','')]} />
                  {chartYears.map((y,i) => <Line key={y} type="monotone" dataKey={`elev_${y}`} stroke={YEAR_COLORS[i]} strokeWidth={2} dot={false} connectNulls hide={hiddenYears.has(y)} />)}
                </LineChart>
              </ResponsiveContainer>
            </ExpandableCard>
        </div>

        {/* Monthly time + count */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ExpandableCard defaultHeight={180} title="Horas de entrenamiento mensual" legend={<div className="flex gap-3">{chartYears.map((y,i) => <span key={y} onClick={() => toggleYear(y)} className={`cursor-pointer flex items-center gap-1 text-xs transition-opacity select-none ${hiddenYears.has(y) ? 'opacity-30 line-through' : 'text-slate-400 hover:text-slate-200'}`}><span className="w-2 h-2 rounded-full inline-block" style={{background: YEAR_COLORS[i]}}/>{y}</span>)}</div>}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyByYear} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={30} unit=" h" />
                  <Tooltip {...TOOLTIP_PROPS} formatter={(v: unknown, name: string) => [`${v} h`, name.replace('time_','')]} />
                  {chartYears.map((y,i) => <Line key={y} type="monotone" dataKey={`time_${y}`} stroke={YEAR_COLORS[i]} strokeWidth={2} dot={false} connectNulls hide={hiddenYears.has(y)} />)}
                </LineChart>
              </ResponsiveContainer>
            </ExpandableCard>

          <ExpandableCard defaultHeight={180} title="Actividades por mes" legend={<div className="flex gap-3">{chartYears.map((y,i) => <span key={y} onClick={() => toggleYear(y)} className={`cursor-pointer flex items-center gap-1 text-xs transition-opacity select-none ${hiddenYears.has(y) ? 'opacity-30 line-through' : 'text-slate-400 hover:text-slate-200'}`}><span className="w-2 h-2 rounded-full inline-block" style={{background: YEAR_COLORS[i]}}/>{y}</span>)}</div>}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyByYear} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip {...TOOLTIP_PROPS} formatter={(v: unknown, name: string) => [v, name.replace('count_','')]} />
                  {chartYears.map((y,i) => <Line key={y} type="monotone" dataKey={`count_${y}`} stroke={YEAR_COLORS[i]} strokeWidth={2} dot={false} connectNulls hide={hiddenYears.has(y)} />)}
                </LineChart>
              </ResponsiveContainer>
            </ExpandableCard>
        </div>

        {/* Yearly */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ExpandableCard title="Distancia anual">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={40} unit=" km" />
                <Tooltip {...TOOLTIP_PROPS} formatter={(v: unknown) => [`${v} km`, 'Distancia']} />
                <Bar dataKey="dist" radius={[3, 3, 0, 0]}>
                  {yearlyData.map((_, i) => <Cell key={i} fill={i === yearlyData.length - 1 ? 'var(--color-primary)' : '#6366f1'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ExpandableCard>

          <ExpandableCard title="Desnivel anual">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={45} unit=" m" />
                <Tooltip {...TOOLTIP_PROPS} formatter={(v: unknown) => [`${v} m`, 'Desnivel']} />
                <Bar dataKey="elev" radius={[3, 3, 0, 0]}>
                  {yearlyData.map((_, i) => <Cell key={i} fill={i === yearlyData.length - 1 ? '#f97316' : '#92400e'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ExpandableCard>
        </div>

        {/* Cumulative this year */}
        {cumulativeYear.length > 1 && (
          <ExpandableCard defaultHeight={160} title={`Distancia acumulada ${new Date().getFullYear()} · ${cumulativeYear.at(-1)?.cum?.toFixed(0)} km`}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cumulativeYear} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.02}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} axisLine={false} interval={Math.floor(cumulativeYear.length / 6)} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={40} unit=" km" />
                  <Tooltip {...TOOLTIP_PROPS} formatter={(v: unknown) => [`${v} km`, 'Acumulado']} />
                  <Area type="monotone" dataKey="cum" stroke="var(--color-primary)" strokeWidth={2} fill="url(#cumGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
          </ExpandableCard>
        )}

        {/* Pace/speed trend + HR trend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {monthlyByYear.some(m => chartYears.some(y => m[`pace_${y}`] != null)) && (
            <ExpandableCard defaultHeight={160} title="Ritmo medio mensual · Running">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-3">{chartYears.map((y,i) => <span key={y} onClick={() => toggleYear(y)} className={`cursor-pointer flex items-center gap-1 text-xs transition-opacity select-none ${hiddenYears.has(y) ? 'opacity-30 line-through' : 'text-slate-400 hover:text-slate-200'}`}><span className="w-2 h-2 rounded-full inline-block" style={{background: YEAR_COLORS[i]}}/>{y}</span>)}</div>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyByYear} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={32} domain={['auto','auto']} reversed />
                  <Tooltip {...TOOLTIP_PROPS} formatter={(v: unknown, name: string) => {
                    const n = Number(v); const m = Math.floor(n); const s = Math.round((n-m)*60)
                    return [`${m}:${String(s).padStart(2,'0')} /km`, name.replace('pace_','')]
                  }} />
                  {chartYears.map((y,i) => <Line key={y} type="monotone" dataKey={`pace_${y}`} stroke={YEAR_COLORS[i]} strokeWidth={2} dot={false} connectNulls hide={hiddenYears.has(y)} />)}
                </LineChart>
              </ResponsiveContainer>
            </ExpandableCard>
          )}
          {monthlyByYear.some(m => chartYears.some(y => m[`speed_${y}`] != null)) && (
            <ExpandableCard defaultHeight={160} title="Velocidad media mensual · Ciclismo">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-3">{chartYears.map((y,i) => <span key={y} onClick={() => toggleYear(y)} className={`cursor-pointer flex items-center gap-1 text-xs transition-opacity select-none ${hiddenYears.has(y) ? 'opacity-30 line-through' : 'text-slate-400 hover:text-slate-200'}`}><span className="w-2 h-2 rounded-full inline-block" style={{background: YEAR_COLORS[i]}}/>{y}</span>)}</div>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyByYear} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={32} domain={['auto','auto']} />
                  <Tooltip {...TOOLTIP_PROPS} formatter={(v: unknown, name: string) => [`${v} km/h`, name.replace('speed_','')]} />
                  {chartYears.map((y,i) => <Line key={y} type="monotone" dataKey={`speed_${y}`} stroke={YEAR_COLORS[i]} strokeWidth={2} dot={false} connectNulls hide={hiddenYears.has(y)} />)}
                </LineChart>
              </ResponsiveContainer>
            </ExpandableCard>
          )}
          {monthlyByYear.some(m => chartYears.some(y => m[`hr_${y}`] != null)) && (
            <ExpandableCard defaultHeight={160} title="FC media mensual">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-3">{chartYears.map((y,i) => <span key={y} onClick={() => toggleYear(y)} className={`cursor-pointer flex items-center gap-1 text-xs transition-opacity select-none ${hiddenYears.has(y) ? 'opacity-30 line-through' : 'text-slate-400 hover:text-slate-200'}`}><span className="w-2 h-2 rounded-full inline-block" style={{background: YEAR_COLORS[i]}}/>{y}</span>)}</div>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyByYear} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={32} domain={['auto','auto']} unit=" bpm" />
                  <Tooltip {...TOOLTIP_PROPS} formatter={(v: unknown, name: string) => [`${v} bpm`, name.replace('hr_','')]} />
                  {chartYears.map((y,i) => <Line key={y} type="monotone" dataKey={`hr_${y}`} stroke={YEAR_COLORS[i]} strokeWidth={2} dot={false} connectNulls hide={hiddenYears.has(y)} />)}
                </LineChart>
              </ResponsiveContainer>
            </ExpandableCard>
          )}
        </div>

        {/* Seasonal pattern */}
        <ExpandableCard defaultHeight={160} title="Patrón estacional · actividades por mes (media histórica)">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={seasonalData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={35} unit=" km" />
              <Tooltip {...TOOLTIP_PROPS} />
              <Bar yAxisId="left" dataKey="count" fill="#334155" radius={[3,3,0,0]} name="Actividades" />
              <Line yAxisId="right" type="monotone" dataKey="avg" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} name="Dist. media (km)" />
            </ComposedChart>
          </ResponsiveContainer>
        </ExpandableCard>

        {/* Day of week + Hour of day */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ExpandableCard defaultHeight={160} title="Actividades por día de la semana">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dowData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip {...TOOLTIP_PROPS} formatter={(v: unknown) => [v, 'Actividades']} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {dowData.map((d, i) => <Cell key={i} fill={d.count === Math.max(...dowData.map(x => x.count)) ? '#22c55e' : '#334155'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ExpandableCard>

          <ExpandableCard defaultHeight={160} title="Actividades por hora del día">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} axisLine={false} interval={3} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip {...TOOLTIP_PROPS} formatter={(v: unknown) => [v, 'Actividades']} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {hourData.map((d, i) => <Cell key={i} fill={d.count === Math.max(...hourData.map(x => x.count)) ? '#f59e0b' : '#334155'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ExpandableCard>
        </div>

        {/* Distance histogram + evolution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ExpandableCard defaultHeight={180} title="Distribución de distancias">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distHist} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip {...TOOLTIP_PROPS} formatter={(v: unknown) => [v, 'Actividades']} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]} fill="#a855f7" />
              </BarChart>
            </ResponsiveContainer>
          </ExpandableCard>

          <ExpandableCard defaultHeight={180} title="Evolución anual de actividades">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={yearlyData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip {...TOOLTIP_PROPS} formatter={(v: unknown) => [v, 'Actividades']} />
                <Line type="monotone" dataKey="count" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 4, fill: 'var(--color-primary)' }} />
              </LineChart>
            </ResponsiveContainer>
          </ExpandableCard>
        </div>

        {/* Top 10 by distance */}
        {topByDist.length > 0 && (
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-4">Top 10 actividades por distancia</div>
            <div className="space-y-2">
              {topByDist.map((a, i) => (
                <Link key={a.id} to={`/activity/${a.id}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-700/40 transition-colors group">
                  <span className="text-xs text-slate-600 w-5 text-right tabular-nums">{i + 1}</span>
                  <span className="text-base">{sportIcon(a.sport)}</span>
                  <span className="flex-1 text-sm text-slate-300 truncate group-hover:text-white">{a.title}</span>
                  <span className="text-xs text-slate-500">{a.startTime.slice(0, 10)}</span>
                  <span className="text-sm font-mono font-semibold text-primary w-20 text-right">{a.distance.toFixed(1)} km</span>
                  <span className="text-xs text-slate-500 w-16 text-right">{formatDuration(a.duration)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
