import type { ActivitySummary } from '../types/garmin'
import { formatDistance, formatDuration, formatPace } from '../utils/formatters'
import MetricCard from './MetricCard'

export default function ActivityMetrics({ activity: act }: { activity: ActivitySummary }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-5 auto-rows-fr gap-2">
      <MetricCard compact label="Distancia" value={formatDistance(act.distance, act.sport)} />
      <MetricCard compact label="Duración" value={formatDuration(act.duration)} />
      {act.sport === 'running' && act.avgPace
        ? <MetricCard compact color="#3b82f6" label="Ritmo medio" value={formatPace(act.avgPace)} />
        : act.sport === 'cycling' && act.avgSpeed
        ? <MetricCard compact label="Velocidad" value={act.avgSpeed} unit="km/h" />
        : <MetricCard compact label="Calorías" value={act.calories} unit="kcal" />
      }
      <MetricCard compact color={act.avgHR > 0 ? '#ef4444' : undefined} label="FC Media" value={act.avgHR > 0 ? act.avgHR : '–'} unit={act.avgHR > 0 ? 'bpm' : ''} />
      <MetricCard compact color={act.maxHR > 0 ? '#ef4444' : undefined} label="FC Máxima" value={act.maxHR > 0 ? act.maxHR : '–'} unit={act.maxHR > 0 ? 'bpm' : ''} />
      <MetricCard compact color="#22c55e" label="Elevación +" value={act.elevationGain} unit="m" />
      <MetricCard compact color="#22c55e" label="Descenso" value={act.elevationLoss} unit="m" />
      <MetricCard compact color={act.maxElevation != null ? '#22c55e' : undefined} label="Altitud máx." value={act.maxElevation ?? '–'} unit={act.maxElevation != null ? 'm' : ''} />
      <MetricCard compact label="Temperatura media" value={act.avgTemperature != null ? act.avgTemperature.toLocaleString('es-ES', { maximumFractionDigits: 1 }) : '–'} unit={act.avgTemperature != null ? '°C' : ''} />
      {act.tss != null && <MetricCard compact label="TSS" value={Math.round(act.tss)} />}
      {act.sport === 'cycling' && act.avgPower
        ? <MetricCard compact color="#a78bfa" label="Potencia media" value={act.avgPower} unit="W" />
        : act.sport === 'cycling' && act.normalizedPower
        ? <MetricCard compact color="#a78bfa" label="Potencia NP" value={act.normalizedPower} unit="W" />
        : act.sport === 'running' && act.avgCadence
        ? <MetricCard compact label="Cadencia" value={act.avgCadence} unit="spm" />
        : null
      }
    </div>
  )
}
