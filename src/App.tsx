import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useActivityStore } from './stores/activityStore'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Activities from './pages/Activities'
import ActivityDetailPage from './pages/ActivityDetail'
import FitnessChartPage from './pages/FitnessChartPage'
import ZoneAnalysis from './pages/ZoneAnalysis'
import Records from './pages/Records'
import Settings from './pages/Settings'
import PerformanceAnalysis from './pages/PerformanceAnalysis'
import SleepPage from './pages/Sleep'
import StatsPage from './pages/Stats'
import GearPage from './pages/Gear'

export default function App() {
  const loadActivities = useActivityStore(s => s.loadActivities)
  const loadStats = useActivityStore(s => s.loadStats)
  const loadSettings = useActivityStore(s => s.loadSettings)
  const loadRecords = useActivityStore(s => s.loadRecords)
  const loadSleep = useActivityStore(s => s.loadSleep)
  const loadGear = useActivityStore(s => s.loadGear)
  const stats = useActivityStore(s => s.stats)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    loadActivities()
    loadStats()
    loadSettings()
    loadRecords()
    loadSleep()
    loadGear()
  }, [loadActivities, loadStats, loadSettings, loadRecords, loadSleep, loadGear])

  // Auto-sync when last sync date is not today
  useEffect(() => {
    if (!stats?.syncedAt) return
    const lastSync = stats.syncedAt.slice(0, 10)
    const today = new Date().toISOString().slice(0, 10)
    if (lastSync === today) return

    console.log(`[AutoSync] Last sync: ${lastSync}, today: ${today}. Syncing…`)
    fetch('/api/sync', { method: 'POST' })
      .then(r => r.json())
      .then(json => {
        if (json.ok) {
          return Promise.all([loadActivities(), loadStats(), loadRecords(), loadSleep()])
        }
      })
      .catch(() => {/* silent fail */})
  }, [stats?.syncedAt])

  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-hidden flex flex-col min-w-0">
          {/* Mobile top bar */}
          <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-slate-700/50 bg-slate-900 shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-slate-400 hover:text-slate-200 text-xl leading-none"
              aria-label="Abrir menú"
            >
              ☰
            </button>
            <span className="text-primary font-bold text-sm tracking-tight">Garmin Stats</span>
          </div>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/activities" element={<Activities />} />
            <Route path="/activity/:id" element={<ActivityDetailPage />} />
            <Route path="/fitness" element={<FitnessChartPage />} />
            <Route path="/zones" element={<ZoneAnalysis />} />
            <Route path="/records" element={<Records />} />
            <Route path="/gear" element={<GearPage />} />
            <Route path="/sleep" element={<SleepPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/performance" element={<PerformanceAnalysis />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
