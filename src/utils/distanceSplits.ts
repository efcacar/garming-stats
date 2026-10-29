import type { ActivitySample, Lap } from '../types/garmin'

export function cyclingDistanceSplits(samples: ActivitySample[] = []): Lap[] {
  const splits: Lap[] = []
  let previous: ActivitySample = {
    time: 0, distance: 0, elevation: null, pace: null,
    heartRate: null, power: null, latitude: null, longitude: null,
  }
  let startDistance = 0
  let duration = 0
  let heartRateTotal = 0
  let heartRateTime = 0
  let powerTotal = 0
  let powerTime = 0
  let ascent = 0
  let descent = 0
  let hasElevation = false

  function finish(distance: number) {
    const length = distance - startDistance
    if (length <= 0 || duration <= 0) return
    splits.push({
      index: splits.length + 1,
      distance: length,
      duration,
      avgSpeed: Math.round(length / duration * 36000) / 10,
      avgPace: null,
      avgHR: heartRateTime > 0 ? Math.round(heartRateTotal / heartRateTime) : null,
      avgPower: powerTime > 0 ? Math.round(powerTotal / powerTime) : null,
      elevationGain: Math.round(ascent),
      elevationLoss: hasElevation ? Math.round(descent) : null,
    })
    startDistance = distance
    duration = heartRateTotal = heartRateTime = powerTotal = powerTime = ascent = descent = 0
    hasElevation = false
  }

  for (const sample of samples) {
    if (sample.distance == null || !Number.isFinite(sample.distance) || !Number.isFinite(sample.time)) continue
    if (sample.distance < previous.distance! || sample.time < previous.time) continue
    if (sample.time === previous.time) {
      if (sample.distance === previous.distance) previous = sample
      continue
    }
    const distanceDelta = sample.distance - previous.distance!
    const timeDelta = sample.time - previous.time
    let from = 0

    while (from < 1) {
      const boundary = startDistance + 10
      const to = distanceDelta > 0
        ? Math.min(1, (boundary - previous.distance!) / distanceDelta)
        : 1
      const seconds = timeDelta * (to - from)
      duration += seconds
      if (previous.heartRate != null && sample.heartRate != null) {
        heartRateTotal += (previous.heartRate + (sample.heartRate - previous.heartRate) * (from + to) / 2) * seconds
        heartRateTime += seconds
      }
      if (previous.power != null && sample.power != null) {
        powerTotal += (previous.power + (sample.power - previous.power) * (from + to) / 2) * seconds
        powerTime += seconds
      }
      if (previous.elevation != null && sample.elevation != null) {
        const change = (sample.elevation - previous.elevation) * (to - from)
        ascent += Math.max(0, change)
        descent += Math.max(0, -change)
        hasElevation = true
      }
      if (distanceDelta > 0 && sample.distance >= boundary) finish(boundary)
      from = to
    }
    previous = sample
  }
  finish(previous.distance!)
  return splits
}