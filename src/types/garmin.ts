export type Sport = 'running' | 'cycling' | 'swimming' | 'walking' | 'strength' | 'padel' | 'other'

export interface HRZone {
  zone: number
  name: string
  seconds: number
  lowBPM: number | null
  highBPM: number | null
}

export interface Lap {
  index: number
  distance: number     // km
  duration: number     // seconds
  avgHR: number | null
  avgPace: number | null  // sec/km
  avgSpeed: number | null // km/h
  avgPower: number | null // watts
  elevationGain: number
}

export interface ActivitySummary {
  id: number
  title: string
  sport: Sport
  startTime: string    // ISO local datetime
  distance: number     // km
  duration: number     // seconds
  movingTime: number   // seconds
  elevationGain: number
  avgHR: number
  maxHR: number
  calories: number
  tss: number | null
  avgPace: number | null    // sec/km (running/swim)
  avgSpeed: number | null   // km/h (cycling)
  avgPower: number | null   // watts (cycling)
  normalizedPower: number | null
  avgCadence: number | null
  vo2max: number | null
  aerobicTE: number | null
  anaerobicTE: number | null
  // Swimming only
  swolf?: number | null
  avgStrokesPerLength?: number | null
}

export interface ActivityDetail extends ActivitySummary {
  laps: Lap[]
  hrZones: HRZone[]
  gpxCoords: number[][]  // [lat, lon] or [lat, lon, ele] pairs
  avgStrideLength?: number | null
  trainingEffect?: number | null
}

export interface FitnessPoint {
  date: string   // YYYY-MM-DD
  ctl: number    // Chronic Training Load (Fitness)
  atl: number    // Acute Training Load (Fatigue)
  tsb: number    // Training Stress Balance (Form)
  tss: number    // TSS accumulated that day
}

export interface GlobalStats {
  totalActivities: number
  byType: Record<string, number>
  vo2maxHistory: { date: string; value: number }[]
  currentVo2max?: number
  syncedAt: string
}

export interface UserSettings {
  maxHR: number
  ftp: number          // Functional Threshold Power (watts)
  lthrRunning: number  // Lactate threshold HR for running
  thresholdPace: number // seconds per km at threshold
  ftpDate?: string
  theme: 'dark' | 'light'
  primaryColor: string // hex, e.g. '#3b82f6'
}

export interface GearItem {
  uuid: string
  name: string
  type: string           // 'Shoes' | 'Bike' | 'Wetsuit' | ...
  status: string         // 'active' | 'retired'
  dateBegin: string      // YYYY-MM-DD
  dateEnd: string | null
  maxMeters: number | null
  totalDistance: number | null  // meters (divide by 1000 for km)
  totalActivities: number | null
}

export interface SleepEntry {
  date: string           // YYYY-MM-DD
  durationSeconds: number
  deepSeconds: number
  lightSeconds: number
  remSeconds: number
  awakeSeconds: number
  score: number | null
  startGMT: number | null   // timestamp ms
  endGMT: number | null
  avgHRV: number | null
  avgSpO2: number | null
  restingHR: number | null
}

export interface BestEffort {
  km: number
  label: string
  activityId: number
  date: string         // YYYY-MM-DD
  duration: number     // seconds
  pace: number         // sec/km
  title: string
}

export interface CyclingBestEffort {
  typeId?: number
  km?: number
  label: string
  kind?: 'distance' | 'time'
  activityId: number
  date: string
  duration?: number   // seconds (for local computation)
  distance?: number   // km (for local computation)
  speed?: number      // km/h (for local computation)
  value?: number      // raw Garmin value (meters or seconds)
  title: string
}

export interface RacePredictions {
  calendarDate?: string
  time5K?: number      // seconds
  time10K?: number
  timeHalfMarathon?: number
  timeMarathon?: number
}

export interface GarminRecords {
  bestEfforts: BestEffort[]
  cyclingBestEfforts: CyclingBestEffort[]
  racePredictions: RacePredictions
}

export const DEFAULT_SETTINGS: UserSettings = {
  maxHR: 185,
  ftp: 250,
  lthrRunning: 165,
  thresholdPace: 270, // ~4:30/km
  theme: 'dark',
  primaryColor: '#3b82f6',
}
