import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { ActivityDetail } from '../types/garmin'
import { useActivityStore } from '../stores/activityStore'
import { formatDuration, formatDate, sportLabel } from '../utils/formatters'
import { HR_ZONE_DEFS } from '../utils/calculations'
import ActivityMap from '../components/ActivityMap'
import ElevationChart from '../components/ElevationChart'
import ActivityCharts from '../components/ActivityCharts'
import ActivityMetrics from '../components/ActivityMetrics'
import GearCard from '../components/GearCard'

import WorkoutBlocks from '../components/WorkoutBlocks'
import useActivityPlayback from '../hooks/useActivityPlayback'

export default function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const loadDetail = useActivityStore(s => s.loadDetail)
  const loadActivities = useActivityStore(s => s.loadActivities)
  const activities = useActivityStore(s => s.activities)
  const gear = useActivityStore(s => s.gear)
  const [detail, setDetail] = useState<ActivityDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState<number | null>(null)
  const [refreshError, setRefreshError] = useState<{ id: number; message: string } | null>(null)
  const [refreshWarning, setRefreshWarning] = useState<{ id: number; message: string } | null>(null)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [hoveredSample, setHoveredSample] = useState<number | null>(null)
  const playback = useActivityPlayback(detail?.samples)
  const selectedIndex = playback.playing ? playback.index : hoveredSample ?? playback.index

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setHoveredSample(null)
    setHoveredIdx(null)
    loadDetail(Number(id)).then(d => {
      if (cancelled) return
      setDetail(d)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [id, loadDetail, activities])

  const summary = activities.find(a => a.id === Number(id))

  async function refreshActivity() {
    const activityId = Number(id)
    setRefreshing(activityId)
    setRefreshError(null)
    setRefreshWarning(null)
    try {
      const response = await fetch(`/api/sync?activityId=${activityId}`, { method: 'POST' })
      const result = await response.json()
      await loadActivities()
      if (!response.ok || !result.ok) throw new Error(result.error || result.log || 'No se pudo actualizar la actividad.')
      if (result.warnings?.length) setRefreshWarning({ id: activityId, message: result.warnings.join('\n') })
    } catch (error) {
      setRefreshError({ id: activityId, message: (error as Error).message })
    } finally {
      setRefreshing(null)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Cargando actividad...
      </div>
    )
  }

  const act = detail ?? summary
  const sample = selectedIndex != null ? detail?.samples?.[selectedIndex] : undefined
  if (!act) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Actividad no encontrada.{' '}
        <Link to="/activities" className="text-primary ml-1">Volver</Link>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 break-words text-xl font-bold text-slate-100">{act.title}</h1>
          <button
            type="button"
            onClick={refreshActivity}
            disabled={refreshing !== null}
            aria-label="Forzar actualización de esta actividad"
            title="Forzar actualización de esta actividad desde Garmin"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg aria-hidden="true" className={`h-4 w-4 ${refreshing === act.id ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        <div className="text-sm text-slate-500 mt-0.5">
          {formatDate(act.startTime)} · {sportLabel(act.sport)}
        </div>
        {refreshing === act.id && <p role="status" className="text-xs text-primary mt-2">Actualizando actividad desde Garmin...</p>}
        {refreshError?.id === act.id && <p role="alert" className="text-xs text-red-400 mt-2 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">{refreshError.message}</p>}
        {refreshWarning?.id === act.id && <p role="status" className="text-xs text-amber-400 mt-2 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">{refreshWarning.message}</p>}
        {!detail && <p role="status" className="text-sm text-amber-400 mt-2">Detalle no disponible. Pendiente de descargar desde Garmin.</p>}
      </div>

      {/* Key metrics */}
      <div className="mb-3">
        <ActivityMetrics activity={act} />
      </div>

      {/* Map */}
      {playback.available && (
        <section aria-label="Reproducción del entrenamiento" className="flex flex-wrap items-center gap-3 bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 mb-3">
          <button
            type="button"
            onClick={() => { setHoveredSample(null); playback.toggle() }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white"
            aria-label={playback.playing ? 'Pausar recorrido' : 'Reproducir recorrido'}
            title={playback.playing ? 'Pausar recorrido' : 'Reproducir recorrido'}
          >
            <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              {playback.playing
                ? <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                : <path d="M7 4v16l14-8z" />}
            </svg>
          </button>
          <button type="button" onClick={() => { setHoveredSample(null); playback.restart() }} aria-label="Reiniciar recorrido" title="Reiniciar recorrido" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-700/50">
            <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 4v6h6M3 10a9 9 0 1 1 2.6 8.4" />
            </svg>
          </button>
          <span className="text-xs text-slate-300 tabular-nums">{formatDuration(playback.time)} / {formatDuration(playback.end)}</span>
          <input
            type="range"
            aria-label="Posición del recorrido"
            min={playback.start}
            max={playback.end}
            step="any"
            value={playback.time}
            onChange={event => { setHoveredSample(null); playback.seek(Number(event.target.value)) }}
            className="min-w-32 flex-1 accent-primary"
          />
          <label className="text-xs text-slate-400 flex items-center gap-2">
            Velocidad
            <select aria-label="Velocidad de reproducción" value={playback.speed} onChange={event => playback.setSpeed(Number(event.target.value))} className="bg-slate-800 text-slate-200 rounded p-1">
              {[1, 10, 30, 60, 120].map(speed => <option key={speed} value={speed}>{speed}x</option>)}
            </select>
          </label>
        </section>
      )}
      {detail?.gpxCoords && detail.gpxCoords.length > 0 && (
        <div className="mb-3">
          <ActivityMap coords={detail.gpxCoords} sport={act.sport} height={320} hoveredIdx={hoveredIdx} hoveredPosition={sample?.latitude != null && sample.longitude != null ? [sample.latitude, sample.longitude] : null} />
        </div>
      )}

      {/* Elevation chart */}
      {detail?.samples && detail.samples.length > 0 ? (
        <ActivityCharts samples={detail.samples} hoveredIndex={selectedIndex} onHover={index => {
          if (!playback.playing) setHoveredSample(index)
        }} />
      ) : detail?.gpxCoords && detail.gpxCoords.length > 0 && (
        <ElevationChart coords={detail.gpxCoords} onHover={setHoveredIdx} />
      )}
      {detail && !detail.samples && (
        <p className="text-xs text-slate-500 mb-4">Sincroniza para cargar las gráficas de ritmo, frecuencia cardíaca y potencia.</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4 items-start">
        <div className="min-w-0">
          {detail && <WorkoutBlocks blocks={detail.workoutBlocks} laps={detail.laps} sport={act.sport} />}
        </div>
        <div className="min-w-0 space-y-4">
      {/* HR Zones */}
      {detail?.hrZones && detail.hrZones.length > 0 && (
        <section className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
          <h2 className="text-xs text-slate-500 uppercase tracking-wider mb-3">Zonas de frecuencia cardíaca</h2>
          <div className="space-y-2">
            {detail.hrZones.map((zone) => {
              const total = detail.hrZones.reduce((s, z) => s + z.seconds, 0)
              const pct = total > 0 ? (zone.seconds / total) * 100 : 0
              const def = HR_ZONE_DEFS[zone.zone - 1]
              return (
                <div key={zone.zone} className="flex items-center gap-2">
                  <div className="w-14 shrink-0 text-xs text-slate-400">{zone.name}</div>
                  <div className="flex-1 min-w-0 bg-slate-800 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{ width: `${pct}%`, background: def?.color ?? '#6b7280' }}
                    />
                  </div>
                  <div className="w-12 shrink-0 text-xs text-slate-400 text-right">{formatDuration(zone.seconds)}</div>
                  <div className="w-8 shrink-0 text-xs text-slate-500 text-right">{pct.toFixed(0)}%</div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
        <h2 className="text-xs text-slate-500 uppercase tracking-wider mb-3">Material utilizado</h2>
        {detail?.gear && detail.gear.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {detail.gear.map(item => (
              <GearCard key={item.uuid} item={gear.find(g => g.uuid === item.uuid) ?? item} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            {detail?.gear
              ? 'Esta actividad no tiene material asociado en Garmin Connect.'
              : 'Material pendiente de sincronizar. Vuelve a sincronizar para cargar el equipo de esta actividad.'}
          </p>
        )}
      </section>

        </div>
      </div>
    </div>
  )
}
