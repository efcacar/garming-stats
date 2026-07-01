import { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useActivityStore } from '../stores/activityStore'

const s = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
    <path d={d}/>
  </svg>
)

const NAV = [
  { to: '/',            label: 'Dashboard',      icon: s('M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M9 22V12h6v10') },
  { to: '/activities',  label: 'Actividades',    icon: s('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01') },
  { to: '/stats',       label: 'Estadísticas',   icon: s('M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z') },
  { to: '/fitness',     label: 'Fitness & Forma', icon: s('M22 12h-4l-3 9L9 3l-3 9H2') },
  { to: '/zones',       label: 'Zonas',           icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>) },
  { to: '/sleep',       label: 'Sueño',           icon: s('M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z') },
  { to: '/performance', label: 'Rendimiento',     icon: s('M13 2L3 14h9l-1 8 10-12h-9l1-8z') },
  { to: '/records',     label: 'Récords',         icon: s('M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z') },
  { to: '/gear',        label: 'Equipo',           icon: s('M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0 0h18') },
  { to: '/settings',    label: 'Ajustes',         icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>) },
]

interface Props {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: Props) {
  const stats = useActivityStore(s => s.stats)
  const activities = useActivityStore(s => s.activities)
  const loadActivities = useActivityStore(s => s.loadActivities)
  const loadStats = useActivityStore(s => s.loadStats)
  const loadRecords = useActivityStore(s => s.loadRecords)
  const loadSleep = useActivityStore(s => s.loadSleep)
  const location = useLocation()
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startProgress() {
    setProgress(0)
    let p = 0
    progressRef.current = setInterval(() => {
      // Slow fill: 0→85% over ~50s, then stalls waiting for completion
      p = p < 85 ? p + (85 - p) * 0.03 : p
      setProgress(Math.min(p, 85))
    }, 500)
  }

  function finishProgress(ok: boolean) {
    if (progressRef.current) clearInterval(progressRef.current)
    setProgress(ok ? 100 : 0)
    if (ok) setTimeout(() => setProgress(0), 1200)
  }

  async function handleSync() {
    setSyncing(true)
    setSyncError(null)
    startProgress()
    try {
      const res = await fetch('/api/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.log || 'Error')
      await Promise.all([loadActivities(), loadStats(), loadRecords(), loadSleep()])
      finishProgress(true)
    } catch (e) {
      setSyncError((e as Error).message.slice(0, 80))
      finishProgress(false)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <aside className={`fixed md:static inset-y-0 left-0 z-40 w-56 shrink-0 bg-slate-900 border-r border-slate-700/50 flex flex-col h-screen overflow-y-auto transform transition-transform duration-200 ease-in-out ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-700/50">
        <div className="flex items-center justify-between gap-2">
          <div className="text-primary font-bold text-lg tracking-tight">Garmin Stats</div>
          <button
            onClick={handleSync}
            disabled={syncing}
            title="Sincronizar con Garmin"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <div className="text-slate-500 text-xs mt-0.5">
          {activities.length > 0 ? `${activities.length} actividades` : 'Sin datos aún'}
          {stats?.syncedAt && (
            <span className="text-slate-600"> · {new Date(stats.syncedAt).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          )}
        </div>
        {syncing && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-primary">Sincronizando…</span>
              <span className="text-xs text-slate-600">{Math.round(progress)}%</span>
            </div>
            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: 'var(--color-primary)' }}
            />
            </div>
          </div>
        )}
        {!syncing && progress === 100 && (
          <div className="mt-1 text-xs text-green-400">✓ Sincronización completada</div>
        )}
        {syncError && <div className="text-xs text-red-400 mt-1 leading-tight">{syncError}</div>}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-0.5">
        {NAV.map(({ to, label, icon }) => {
          // Activities link should also be active on /activity/:id
          const isActivityDetail = to === '/activities' && location.pathname.startsWith('/activity/')
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) => {
                const active = isActive || isActivityDetail
                return `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active ? 'font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`
              }}
              style={({ isActive }) => {
                const active = isActive || isActivityDetail
                return active ? { background: 'color-mix(in srgb, var(--color-primary) 20%, transparent)', color: 'var(--color-primary)' } : undefined
              }}
            >
              {icon}
              {label}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
