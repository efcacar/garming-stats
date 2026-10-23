import type { Lap, Sport, WorkoutBlock } from '../types/garmin'
import { formatDuration, formatPace } from '../utils/formatters'

const BLOCK_STYLES: Record<string, { label: string; color: string }> = {
  INTERVAL_WARMUP: { label: 'Calentamiento', color: '#f59e0b' },
  INTERVAL_ACTIVE: { label: 'Activo', color: '#3b82f6' },
  INTERVAL_REST: { label: 'Descanso', color: '#22c55e' },
  INTERVAL_RECOVERY: { label: 'Recuperación', color: '#22c55e' },
  INTERVAL_COOLDOWN: { label: 'Enfriamiento', color: '#a78bfa' },
}

function distanceLabel(distance: number, sport: Sport) {
  return sport === 'swimming'
    ? `${Math.round(distance * 1000)} m`
    : `${distance.toLocaleString('es-ES', { maximumFractionDigits: 3 })} km`
}

export default function WorkoutBlocks({ blocks, laps, sport }: {
  blocks: WorkoutBlock[] | undefined
  laps: Lap[]
  sport: Sport
}) {
  if (!blocks?.length) {
    return (
      <section className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
        <h2 className="text-xs text-slate-500 uppercase tracking-wider mb-3">Tramos de entrenamiento</h2>
        <p className="text-sm text-slate-500">
          {blocks
            ? 'Garmin no proporciona bloques de entrenamiento para esta actividad.'
            : 'Sincroniza para cargar los bloques originales del entrenamiento de Garmin.'}
        </p>
      </section>
    )
  }

  return (
    <section className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
      <h2 className="text-xs text-slate-500 uppercase tracking-wider mb-3">
        Tramos de entrenamiento · {blocks.length}
      </h2>
      <div className="space-y-2">
        {blocks.map((block, index) => {
          const style = BLOCK_STYLES[block.type ?? '']
          const color = style?.color ?? '#94a3b8'
          const partials = block.lapIndexes.flatMap(lapIndex => {
            const lap = laps.find(item => item.index === lapIndex)
            return lap ? [lap] : []
          })
          let cumulativeDistance = 0

          return (
            <details key={block.index} className="group bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
              <summary className="cursor-pointer list-none flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
                <span className="text-slate-500 group-open:rotate-90 transition-transform" aria-hidden="true">›</span>
                <div className="flex-1 min-w-32">
                  <div className="text-sm font-semibold" style={{ color }}>
                    {index + 1}. {style?.label ?? block.type ?? 'Sin clasificación'}
                  </div>
                  <div className="text-[10px] text-slate-500">{block.type ?? 'Sin clasificación Garmin'}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold tabular-nums text-slate-200">{formatDuration(block.duration)}</div>
                  <div className="text-xs text-slate-500">{distanceLabel(block.distance, sport)}</div>
                </div>
                {sport === 'running' && block.avgPace != null && (
                  <div className="text-sm tabular-nums text-slate-300">{formatPace(block.avgPace)}</div>
                )}
                {sport === 'cycling' && block.avgSpeed != null && (
                  <div className="text-sm tabular-nums text-slate-300">{block.avgSpeed} km/h</div>
                )}
                {block.avgHR != null && <div className="text-xs text-slate-400">{block.avgHR} bpm</div>}
              </summary>
              <div className="border-t border-slate-700/50 px-4 py-3 overflow-x-auto">
                {partials.length !== block.lapIndexes.length ? (
                  <p className="text-xs text-amber-400">Faltan parciales de este bloque. Vuelve a sincronizar la actividad.</p>
                ) : (
                  <table className="w-full text-xs text-left whitespace-nowrap">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="pb-2 pr-4 font-medium">Distancia en el tramo</th>
                        <th className="pb-2 pr-4 font-medium">Distancia parcial</th>
                        <th className="pb-2 pr-4 font-medium">Tiempo</th>
                        {sport === 'running' && <th className="pb-2 pr-4 font-medium">Ritmo</th>}
                        {sport === 'cycling' && <th className="pb-2 pr-4 font-medium">Velocidad</th>}
                        <th className="pb-2 pr-4 font-medium">FC</th>
                        {partials.some(lap => lap.avgPower != null) && <th className="pb-2 pr-4 font-medium">Potencia</th>}
                        <th className="pb-2 font-medium">Elevación +</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partials.map(lap => {
                        const start = cumulativeDistance
                        cumulativeDistance += lap.distance
                        return (
                          <tr key={lap.index} className="border-t border-slate-700/30 text-slate-300 tabular-nums">
                            <td className="py-2 pr-4">{distanceLabel(start, sport)} – {distanceLabel(cumulativeDistance, sport)}</td>
                            <td className="py-2 pr-4">{distanceLabel(lap.distance, sport)}</td>
                            <td className="py-2 pr-4">{formatDuration(lap.duration)}</td>
                            {sport === 'running' && <td className="py-2 pr-4">{formatPace(lap.avgPace)}</td>}
                            {sport === 'cycling' && <td className="py-2 pr-4">{lap.avgSpeed != null ? `${lap.avgSpeed} km/h` : '–'}</td>}
                            <td className="py-2 pr-4">{lap.avgHR != null ? `${lap.avgHR} bpm` : '–'}</td>
                            {partials.some(item => item.avgPower != null) && <td className="py-2 pr-4">{lap.avgPower != null ? `${lap.avgPower} W` : '–'}</td>}
                            <td className="py-2">{lap.elevationGain} m</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}
