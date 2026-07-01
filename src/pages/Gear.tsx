import { useActivityStore } from '../stores/activityStore'
import type { GearItem } from '../types/garmin'
import { fmtNum } from '../utils/formatters'


const GEAR_ICONS: Record<string, string> = {
  Shoes:   '👟',
  Bike:    '🚴',
  Wetsuit: '🤿',
  Watch:   '⌚',
  default: '🏃',
}

const GEAR_TYPE_ES: Record<string, string> = {
  Shoes:   'Zapatillas',
  Bike:    'Bicicleta',
  Wetsuit: 'Traje de neopreno',
  Watch:   'Reloj',
}

function fmtDist(km: number | null) {
  if (km == null) return '–'
  return `${fmtNum(km)} km`
}

function GearCard({ item }: { item: GearItem }) {
  const icon = GEAR_ICONS[item.type] ?? GEAR_ICONS.default
  const typeLabel = GEAR_TYPE_ES[item.type] ?? item.type
  const retired = item.status === 'retired' || (item.dateEnd != null && item.dateEnd < new Date().toISOString().slice(0, 10))

  const usedKm = item.totalDistance != null ? item.totalDistance / 1000 : null
  const maxKm  = item.maxMeters != null ? item.maxMeters / 1000 : null
  const pct = usedKm != null && maxKm != null && maxKm > 0
    ? Math.min((usedKm / maxKm) * 100, 100)
    : null

  const barColor = pct == null ? '#22c55e'
    : pct >= 90 ? '#ef4444'
    : pct >= 70 ? '#f97316'
    : '#22c55e'

  return (
    <div className={`bg-slate-800/60 border rounded-xl p-5 transition-colors ${retired ? 'border-slate-700/30 opacity-60' : 'border-slate-700/50 hover:border-slate-600/60'}`}>
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-slate-200 truncate">{item.name}</div>
            {retired && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 shrink-0">retirado</span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{typeLabel}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-xs text-slate-500">Distancia</div>
          <div className="text-sm font-mono font-semibold text-slate-200">{fmtDist(usedKm)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Actividades</div>
          <div className="text-sm font-mono font-semibold text-slate-200">
            {item.totalActivities != null ? fmtNum(item.totalActivities) : '–'}
          </div>
        </div>
        {item.dateBegin && (
          <div>
            <div className="text-xs text-slate-500">Desde</div>
            <div className="text-xs text-slate-400">{item.dateBegin}</div>
          </div>
        )}
        {maxKm != null && (
          <div>
            <div className="text-xs text-slate-500">Vida útil</div>
            <div className="text-xs text-slate-400">{fmtDist(maxKm)}</div>
          </div>
        )}
      </div>

      {pct != null && (
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-500">Desgaste</span>
            <span style={{ color: barColor }}>{pct.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function GearPage() {
  const gear = useActivityStore(s => s.gear)

  if (gear.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Sin datos de equipo. Ejecuta <code className="mx-1 text-slate-400">python3 fetch/sync.py</code> para sincronizar.
      </div>
    )
  }

  const active  = gear.filter(g => g.status !== 'retired' && (!g.dateEnd || g.dateEnd >= new Date().toISOString().slice(0, 10)))
  const retired = gear.filter(g => !active.includes(g))

  const byType = (items: GearItem[]) => {
    const groups: Record<string, GearItem[]> = {}
    for (const g of items) {
      const t = GEAR_TYPE_ES[g.type] ?? g.type
      ;(groups[t] ??= []).push(g)
    }
    return groups
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <h1 className="text-xl font-bold text-slate-100 mb-1">Equipo</h1>
      <p className="text-sm text-slate-500 mb-6">{gear.length} elementos registrados en Garmin Connect</p>

      {/* Active gear */}
      {Object.entries(byType(active)).map(([type, items]) => (
        <div key={type} className="mb-6">
          <h2 className="text-xs text-slate-500 uppercase tracking-wider mb-3">{type}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map(item => <GearCard key={item.uuid} item={item} />)}
          </div>
        </div>
      ))}

      {/* Retired gear */}
      {retired.length > 0 && (
        <div className="mt-4">
          <h2 className="text-xs text-slate-500 uppercase tracking-wider mb-3">Retirado</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {retired.map(item => <GearCard key={item.uuid} item={item} />)}
          </div>
        </div>
      )}
    </div>
  )
}
