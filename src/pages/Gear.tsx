import { useActivityStore } from '../stores/activityStore'
import type { GearItem } from '../types/garmin'
import GearCard from '../components/GearCard'
import { gearTypeLabel } from '../utils/formatters'

export default function GearPage() {
  const gear = useActivityStore(s => s.gear)

  if (gear.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Sin datos de equipo. Ejecuta <code className="mx-1 text-slate-400">source .venv/bin/activate && python fetch/sync.py</code> para sincronizar.
      </div>
    )
  }

  const active  = gear.filter(g => g.status !== 'retired' && (!g.dateEnd || g.dateEnd >= new Date().toISOString().slice(0, 10)))
  const retired = gear.filter(g => !active.includes(g))

  const byType = (items: GearItem[]) => {
    const groups: Record<string, GearItem[]> = {}
    for (const g of items) {
      const t = gearTypeLabel(g.type)
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
