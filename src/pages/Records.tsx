import { Link } from 'react-router-dom'
import { useActivityStore } from '../stores/activityStore'
import { formatPace, formatDuration } from '../utils/formatters'
import type { BestEffort, CyclingBestEffort, RacePredictions } from '../types/garmin'

function BestEffortsTable({ efforts }: { efforts: BestEffort[] }) {
  if (efforts.length === 0) return null
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
      <h2 className="text-sm font-medium text-slate-200 mb-4">🏃 Mejores esfuerzos (running)</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
              <th className="pb-2 pr-4">Distancia</th>
              <th className="pb-2 pr-4">Tiempo</th>
              <th className="pb-2 pr-4">Ritmo</th>
              <th className="pb-2 pr-4">Actividad</th>
              <th className="pb-2">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {efforts.map(e => (
              <tr key={e.km} className="border-b border-slate-800/60 hover:bg-slate-800/40">
                <td className="py-2.5 pr-4 font-medium text-slate-200">{e.label}</td>
                <td className="py-2.5 pr-4 font-mono text-slate-200">{formatDuration(e.duration)}</td>
                <td className="py-2.5 pr-4 font-mono text-slate-400">{formatPace(e.pace)}</td>
                <td className="py-2.5 pr-4 text-slate-400 truncate max-w-[180px]">
                  <Link to={`/activity/${e.activityId}`} className="text-primary hover:text-primary/80 hover:underline">{e.title}</Link>
                </td>
                <td className="py-2.5 text-slate-500">{e.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CyclingBestEffortsTable({ efforts }: { efforts: CyclingBestEffort[] }) {
  if (efforts.length === 0) return null
  const isGarmin = efforts.some(e => e.kind != null)
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
      <h2 className="text-sm font-medium text-slate-200 mb-4">🚴 Récords ciclismo {isGarmin ? '(Garmin Connect)' : ''}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
              <th className="pb-2 pr-4">Tipo</th>
              <th className="pb-2 pr-4">Valor</th>
              <th className="pb-2 pr-4">Actividad</th>
              <th className="pb-2">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {efforts.map((e, i) => {
              const valueStr = e.kind === 'distance'
                ? `${(e.value! / 1000).toFixed(1)} km`
                : e.kind === 'time'
                ? formatDuration(e.value!)
                : e.kind === 'elevation'
                ? `${Math.round(e.value!)} m ↑`
                : e.speed != null
                ? `${e.speed.toFixed(1)} km/h · ${formatDuration(e.duration!)}`
                : '–'
              return (
                <tr key={i} className="border-b border-slate-800/60 hover:bg-slate-800/40">
                  <td className="py-2.5 pr-4 font-medium text-slate-200">{e.label}</td>
                  <td className="py-2.5 pr-4 font-mono text-slate-200">{valueStr}</td>
                  <td className="py-2.5 pr-4 text-slate-400 truncate max-w-[200px]">
                    <Link to={`/activity/${e.activityId}`} className="text-primary hover:text-primary/80 hover:underline">{e.title}</Link>
                    {e.distance != null && <span className="text-slate-600"> ({e.distance.toFixed(1)} km)</span>}
                  </td>
                  <td className="py-2.5 text-slate-500">{e.date}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RacePredictionsCard({ preds }: { preds: RacePredictions }) {
  const entries = [
    { label: '5 km', value: preds.time5K },
    { label: '10 km', value: preds.time10K },
    { label: 'Media Maratón', value: preds.timeHalfMarathon },
    { label: 'Maratón', value: preds.timeMarathon },
  ].filter(e => e.value != null) as { label: string; value: number }[]

  if (entries.length === 0) return null
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
      <h2 className="text-sm font-medium text-slate-200 mb-1">🎯 Predicciones Garmin</h2>
      {preds.calendarDate && (
        <p className="text-xs text-slate-500 mb-4">Estimación a {preds.calendarDate}</p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {entries.map(({ label, value }) => (
          <div key={label} className="bg-slate-900/50 rounded-lg p-3 text-center">
            <div className="text-xs text-slate-500 mb-1">{label}</div>
            <div className="font-mono text-slate-100 font-medium">{formatDuration(value)}</div>
            <div className="text-xs text-slate-500 mt-0.5">{formatPace(Math.round(value / (label === 'Maratón' ? 42.195 : label === 'Media Maratón' ? 21.0975 : label === '10 km' ? 10 : 5)))}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Records() {
  const records = useActivityStore(s => s.records)

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <h1 className="text-xl font-bold text-slate-100 mb-1">Récords Personales</h1>
      <p className="text-sm text-slate-500 mb-6">Datos directamente de Garmin Connect</p>

      {!records ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          No hay datos de récords. Ejecuta <code className="text-slate-400">python3 fetch/sync.py</code> para sincronizar.
        </div>
      ) : (
        <div className="space-y-4">
          {records.racePredictions && <RacePredictionsCard preds={records.racePredictions} />}
          <BestEffortsTable efforts={records.bestEfforts ?? []} />
          <CyclingBestEffortsTable efforts={records.cyclingBestEfforts ?? []} />
        </div>
      )}
    </div>
  )
}
