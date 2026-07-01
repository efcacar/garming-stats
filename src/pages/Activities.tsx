import { useState, useMemo } from 'react'
import { useActivityStore } from '../stores/activityStore'
import type { Sport } from '../types/garmin'
import ActivityCard from '../components/ActivityCard'

const SPORT_LABELS: Record<string, string> = {
  walking:  '🚶 Caminar',
  cycling:  '🚴 Ciclismo',
  strength: '💪 Fuerza',
  swimming: '🏊 Natación',
  other:    '⚡ Otro',
  padel:    '🎾 Pádel',
  running:  '🏃 Running',
}

const DISTANCE_RANGES: { value: string; label: string; min: number; max: number }[] = [
  { value: 'all',   label: 'Cualquier distancia', min: 0,   max: Infinity },
  { value: '0-5',   label: '< 5 km',              min: 0,   max: 5 },
  { value: '5-10',  label: '5 – 10 km',           min: 5,   max: 10 },
  { value: '10-21', label: '10 – 21 km',          min: 10,  max: 21 },
  { value: '21-42', label: '21 – 42 km',          min: 21,  max: 42 },
  { value: '42+',   label: '> 42 km',             min: 42,  max: Infinity },
]

const SORT_OPTIONS = [
  { value: 'date-desc',  label: 'Fecha (reciente)' },
  { value: 'date-asc',   label: 'Fecha (antigua)' },
  { value: 'dist-desc',  label: 'Distancia (mayor)' },
  { value: 'dist-asc',   label: 'Distancia (menor)' },
  { value: 'dur-desc',   label: 'Duración (mayor)' },
  { value: 'ele-desc',   label: 'Desnivel (mayor)' },
]

export default function Activities() {
  const activities = useActivityStore(s => s.activities)
  const [sportFilter, setSportFilter] = useState<Sport | 'all'>('all')
  const [yearFilter, setYearFilter] = useState<string>('all')
  const [distFilter, setDistFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('date-desc')
  const [page, setPage] = useState(0)

  const PAGE_SIZE = 20

  const availableSports = useMemo(() => {
    const sports = [...new Set(activities.map(a => a.sport))] as Sport[]
    return sports.sort((a, b) =>
      (SPORT_LABELS[a] ?? a).replace(/^\S+\s/, '').localeCompare(
        (SPORT_LABELS[b] ?? b).replace(/^\S+\s/, ''), 'es'
      )
    )
  }, [activities])

  const years = useMemo(() => {
    const ys = new Set(activities.map(a => a.startTime.slice(0, 4)))
    return ['all', ...Array.from(ys).sort().reverse()]
  }, [activities])

  const filtered = useMemo(() => {
    const range = DISTANCE_RANGES.find(r => r.value === distFilter) ?? DISTANCE_RANGES[0]
    const list = activities.filter(a => {
      if (sportFilter !== 'all' && a.sport !== sportFilter) return false
      if (yearFilter !== 'all' && !a.startTime.startsWith(yearFilter)) return false
      if (a.distance < range.min || a.distance >= range.max) return false
      return true
    })
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'date-asc':  return a.startTime.localeCompare(b.startTime)
        case 'dist-desc': return b.distance - a.distance
        case 'dist-asc':  return a.distance - b.distance
        case 'dur-desc':  return b.duration - a.duration
        case 'ele-desc':  return b.elevationGain - a.elevationGain
        default:          return b.startTime.localeCompare(a.startTime)
      }
    })
  }, [activities, sportFilter, yearFilter, distFilter, sortBy])

  const paginated = filtered.slice(0, (page + 1) * PAGE_SIZE)
  const hasMore = paginated.length < filtered.length

  function resetFilters() {
    setSportFilter('all'); setYearFilter('all'); setDistFilter('all'); setSortBy('date-desc'); setPage(0)
  }
  const isFiltered = sportFilter !== 'all' || yearFilter !== 'all' || distFilter !== 'all' || sortBy !== 'date-desc'

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-100">Actividades</h1>
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-6">
        {/* Sport */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 w-16">Deporte</span>
          <div className="flex flex-wrap bg-slate-800 rounded-lg p-0.5 gap-0.5">
            {[{ value: 'all' as const, label: 'Todos' }, ...availableSports.map(s => ({ value: s, label: SPORT_LABELS[s] ?? s }))].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => { setSportFilter(value); setPage(0) }}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  sportFilter === value ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: year + distance + sort + count + reset */}
        <div className="flex gap-3 flex-wrap items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-16">Año</span>
            <select
              value={yearFilter}
              onChange={e => { setYearFilter(e.target.value); setPage(0) }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300"
            >
              {years.map(y => (
                <option key={y} value={y}>{y === 'all' ? 'Todos los años' : y}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-16">Distancia</span>
            <select
              value={distFilter}
              onChange={e => { setDistFilter(e.target.value); setPage(0) }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300"
            >
              {DISTANCE_RANGES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-16">Ordenar</span>
            <select
              value={sortBy}
              onChange={e => { setSortBy(e.target.value); setPage(0) }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <span className="text-sm text-slate-500">{filtered.length} actividades</span>

          {isFiltered && (
            <button
              onClick={resetFilters}
              className="text-xs text-slate-500 hover:text-slate-300 underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {paginated.map(a => (
          <ActivityCard key={a.id} activity={a} />
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setPage(p => p + 1)}
          className="mt-6 w-full py-3 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors text-sm"
        >
          Cargar más ({filtered.length - paginated.length} restantes)
        </button>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          No hay actividades con estos filtros.
        </div>
      )}
    </div>
  )
}
