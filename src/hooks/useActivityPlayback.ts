import { useEffect, useRef, useState } from 'react'
import type { ActivitySample } from '../types/garmin'

export default function useActivityPlayback(samples: ActivitySample[] | undefined) {
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState<number | null>(null)
  const [speed, setSpeed] = useState(60)
  const timeRef = useRef<number | null>(null)
  const start = samples?.[0]?.time ?? 0
  const end = samples?.[samples.length - 1]?.time ?? start
  const available = (samples?.length ?? 0) > 1 && end > start

  useEffect(() => {
    setPlaying(false)
    setTime(null)
    timeRef.current = null
  }, [samples])

  useEffect(() => {
    if (!playing || !available) return
    let frame: number
    let previous: number | undefined
    const tick = (now: number) => {
      if (previous != null) {
        const next = Math.min(end, (timeRef.current ?? start) + (now - previous) / 1000 * speed)
        timeRef.current = next
        setTime(next)
        if (next >= end) {
          setPlaying(false)
          return
        }
      }
      previous = now
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, available, start, end, speed])

  let index: number | null = null
  if (time != null && samples?.length) {
    let low = 0
    let high = samples.length - 1
    while (low < high) {
      const middle = Math.ceil((low + high) / 2)
      if (samples[middle].time <= time) low = middle
      else high = middle - 1
    }
    index = low
  }

  const seek = (next: number) => {
    const clamped = Math.max(start, Math.min(end, next))
    timeRef.current = clamped
    setTime(clamped)
  }

  return {
    available, playing, time: time ?? start, start, end, speed, index, setSpeed, seek,
    pause: () => setPlaying(false),
    toggle: () => {
      if (!playing && (timeRef.current == null || timeRef.current >= end)) seek(start)
      setPlaying(current => !current)
    },
    restart: () => {
      setPlaying(false)
      seek(start)
    },
  }
}
