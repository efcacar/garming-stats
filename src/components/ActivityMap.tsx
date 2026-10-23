import { useEffect, useRef, useState } from 'react'
import * as L from 'leaflet'

interface Props {
  coords: number[][]
  sport?: string
  height?: number
  hoveredIdx?: number | null
  hoveredPosition?: [number, number] | null
}

const TILE_LAYERS = {
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    title: 'Relieve',
    attribution: '&copy; OpenStreetMap contributors, SRTM | &copy; OpenTopoMap (CC-BY-SA)',
    maxZoom: 17,
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    title: 'Oscuro',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    title: 'Satélite',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxZoom: 19,
  },
}

const SPORT_COLORS: Record<string, string> = {
  running: '#ef4444', cycling: '#f97316', swimming: '#3b82f6', walking: '#22c55e', other: '#8b5cf6',
}

export default function ActivityMap({ coords, sport = 'other', height = 320, hoveredIdx, hoveredPosition }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const hoverMarkerRef = useRef<L.CircleMarker | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const [tileStyle, setTileStyle] = useState<keyof typeof TILE_LAYERS>('terrain')

  useEffect(() => {
    if (!containerRef.current || !coords.length) return
    const map = L.map(containerRef.current, { zoomControl: false, scrollWheelZoom: false })
    mapRef.current = map
    const points: [number, number][] = coords.map(point => [point[0], point[1]])
    const color = SPORT_COLORS[sport] ?? SPORT_COLORS.other
    L.polyline(points, { color, weight: 10, opacity: 0.15 }).addTo(map)
    L.polyline(points, { color, weight: 5, opacity: 0.35 }).addTo(map)
    const route = L.polyline(points, { color, weight: 2.5 }).addTo(map)
    map.fitBounds(route.getBounds(), { padding: [28, 28] })
    const resizeTimer = setTimeout(() => map.invalidateSize(), 0)
    ;[
      { position: points[0], color: '#22c55e', title: 'Inicio' },
      { position: points[points.length - 1], color: '#ef4444', title: 'Final' },
    ].forEach(({ position, color: fillColor, title }) => {
      L.circleMarker(position, { radius: 6, color: '#ffffff', weight: 2, fillColor, fillOpacity: 1 })
        .bindTooltip(title).addTo(map)
    })
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    return () => {
      clearTimeout(resizeTimer)
      hoverMarkerRef.current = null
      tileLayerRef.current = null
      mapRef.current = null
      map.remove()
    }
  }, [coords, sport])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    tileLayerRef.current?.remove()
    const layer = TILE_LAYERS[tileStyle]
    tileLayerRef.current = L.tileLayer(layer.url, {
      attribution: layer.attribution, maxZoom: layer.maxZoom,
    }).addTo(map)
    tileLayerRef.current.bringToBack()
  }, [tileStyle, coords, sport])

  useEffect(() => {
    const map = mapRef.current
    const position = hoveredPosition ?? (hoveredIdx != null ? coords[hoveredIdx] : null)
    if (!map || !position || !Number.isFinite(position[0]) || !Number.isFinite(position[1])) {
      hoverMarkerRef.current?.remove()
      hoverMarkerRef.current = null
      return
    }
    if (hoverMarkerRef.current) {
      hoverMarkerRef.current.setLatLng([position[0], position[1]])
    } else {
      hoverMarkerRef.current = L.circleMarker([position[0], position[1]], {
        radius: 7, color: '#ffffff', fillColor: 'var(--color-primary)', fillOpacity: 1, weight: 2,
        interactive: false,
      }).addTo(map)
    }
  }, [hoveredPosition, hoveredIdx, coords, sport])

  if (!coords.length) {
    return <div style={{ height }} className="rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center text-sm text-slate-500">Sin datos GPS</div>
  }

  return (
    <div style={{ height }} className="relative rounded-xl overflow-hidden border border-slate-700/50">
      <div ref={containerRef} aria-label="Mapa del recorrido" className="h-full w-full" />
      <div className="absolute top-2 right-2 z-[1000] flex gap-1">
        {(Object.keys(TILE_LAYERS) as (keyof typeof TILE_LAYERS)[]).map(key => (
          <button key={key} type="button" title={TILE_LAYERS[key].title} aria-pressed={tileStyle === key}
            onClick={() => setTileStyle(key)}
            className={`rounded-md border px-2 py-1 text-xs text-white ${tileStyle === key ? 'bg-zinc-900 border-zinc-400' : 'bg-zinc-900/80 border-zinc-600'}`}>
            {TILE_LAYERS[key].title}
          </button>
        ))}
      </div>
    </div>
  )
}
