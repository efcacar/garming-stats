import { create } from 'zustand'
import type { ActivitySummary, ActivityDetail, GlobalStats, UserSettings, GarminRecords, SleepEntry, GearItem } from '../types/garmin'
import { DEFAULT_SETTINGS } from '../types/garmin'

function getSystemTheme(): 'dark' | 'light' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: 'dark' | 'light') {
  document.documentElement.dataset.theme = theme
}

function applyPrimaryColor(color: string) {
  document.documentElement.style.setProperty('--color-primary', color)

  // Inject/update a style tag so Tailwind compiled classes are overridden
  let el = document.getElementById('primary-color-overrides') as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = 'primary-color-overrides'
    document.head.appendChild(el)
  }
  const c20 = color + '33'   // ~20% opacity
  const c90 = color + 'e6'   // ~90% opacity
  const c80 = color + 'cc'   // ~80% opacity
  el.textContent = `
    .bg-primary, [class*="bg-primary"]:not([class*="bg-primary/"]) { background-color: ${color} !important; }
    .bg-primary\\/20 { background-color: ${c20} !important; }
    .bg-primary\\/90 { background-color: ${c90} !important; }
    .text-primary { color: ${color} !important; }
    .text-primary\\/80 { color: ${c80} !important; }
    .border-primary { border-color: ${color} !important; }
    input[type=range] { accent-color: ${color} !important; }
  `
}

interface ActivityState {
  activities: ActivitySummary[]
  stats: GlobalStats | null
  records: GarminRecords | null
  sleep: SleepEntry[]
  gear: GearItem[]
  settings: UserSettings
  loading: boolean
  error: string | null
  detailCache: Record<number, ActivityDetail>

  loadActivities: () => Promise<void>
  loadStats: () => Promise<void>
  loadRecords: () => Promise<void>
  loadSleep: () => Promise<void>
  loadGear: () => Promise<void>
  loadSettings: () => Promise<void>
  updateSettings: (s: Partial<UserSettings>) => void
  loadDetail: (id: number) => Promise<ActivityDetail | null>
}

export const useActivityStore = create<ActivityState>()(
    (set, get) => ({
      activities: [],
      stats: null,
      records: null,
      sleep: [],
      gear: [],
      settings: DEFAULT_SETTINGS,
      loading: false,
      error: null,
      detailCache: {},

      loadActivities: async () => {
        set({ loading: true, error: null })
        try {
          const res = await fetch('/data/activities.json')
          if (!res.ok) throw new Error(`No se encontró /data/activities.json (status ${res.status})`)
          const data: ActivitySummary[] = await res.json()
          data.sort((a, b) => b.startTime.localeCompare(a.startTime))
          set({ activities: data, loading: false })
        } catch (e) {
          set({ loading: false, error: (e as Error).message })
        }
      },

      loadStats: async () => {
        try {
          const res = await fetch('/data/stats.json')
          if (!res.ok) return
          const data: GlobalStats = await res.json()
          set({ stats: data })
        } catch {
          // stats are optional
        }
      },

      loadGear: async () => {
        try {
          const res = await fetch('/data/gear.json')
          if (!res.ok) return
          const data: GearItem[] = await res.json()
          set({ gear: data })
        } catch {
          // gear is optional
        }
      },

      loadSleep: async () => {
        try {
          const res = await fetch('/data/sleep.json')
          if (!res.ok) return
          const data: SleepEntry[] = await res.json()
          set({ sleep: data })
        } catch {
          // sleep is optional
        }
      },

      loadRecords: async () => {
        try {
          const res = await fetch('/data/records.json')
          if (!res.ok) return
          const data: GarminRecords = await res.json()
          set({ records: data })
        } catch {
          // records are optional
        }
      },

      loadSettings: async () => {
        try {
          const res = await fetch('/api/settings')
          if (!res.ok) {
            applyTheme(getSystemTheme())
            return
          }
          const data = await res.json()
          if (data && Object.keys(data).length > 0) {
            const theme = data.theme ?? getSystemTheme()
            const settings = { ...DEFAULT_SETTINGS, ...data, theme }
            set({ settings })
            applyTheme(theme)
            applyPrimaryColor(settings.primaryColor)
          } else {
            applyTheme(getSystemTheme())
            applyPrimaryColor(DEFAULT_SETTINGS.primaryColor)
          }
        } catch {
          applyTheme(getSystemTheme())
        }
      },

      updateSettings: (s) => {
        const next = { ...get().settings, ...s }
        set({ settings: next })
        if (s.theme) applyTheme(s.theme)
        if (s.primaryColor) applyPrimaryColor(s.primaryColor)
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        }).catch(() => {/* best-effort */})
      },

      loadDetail: async (id: number) => {
        const cached = get().detailCache[id]
        if (cached) return cached
        try {
          const res = await fetch(`/data/activity_${id}.json`)
          if (!res.ok) return null
          const detail: ActivityDetail = await res.json()
          set(state => ({ detailCache: { ...state.detailCache, [id]: detail } }))
          return detail
        } catch {
          return null
        }
      },
    })
)
