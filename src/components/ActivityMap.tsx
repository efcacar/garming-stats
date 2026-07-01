import { useEffect, useRef, useState } from 'react'

interface Props {
  coords: number[][]
  sport?: string
  height?: number
  hoveredIdx?: number | null
}

const TILE_LAYERS = {
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    label: '⛰️',
    title: 'Relieve',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    label: '🌑',
    title: 'Oscuro',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    label: '🛰️',
    title: 'Satélite',
  },
}

const SPORT_COLORS: Record<string, string> = {
  running:  '#ef4444',
  cycling:  '#f97316',
  swimming: '#3b82f6',
  walking:  '#22c55e',
  other:    '#8b5cf6',
}

function pulseMarkerHtml(color: string, label: string) {
  return `
    <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
      <div style="
        position:absolute;width:20px;height:20px;border-radius:50%;
        background:${color};opacity:0.25;
        animation:map-pulse 1.8s ease-out infinite;
      "></div>
      <div style="
        width:10px;height:10px;border-radius:50%;
        background:${color};border:2px solid #fff;
        box-shadow:0 0 6px ${color}99;
        position:relative;z-index:1;
      "></div>
      <div style="
        position:absolute;top:-18px;left:50%;transform:translateX(-50%);
        font-size:9px;font-weight:700;color:${color};
        text-shadow:0 1px 2px rgba(0,0,0,0.8);letter-spacing:0.5px;
        white-space:nowrap;
      ">${label}</div>
    </div>
  `
}

export default function ActivityMap({ coords, sport = 'other', height = 320, hoveredIdx }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const hoverMarkerRef = useRef<any>(null)
  const tileLayerRef = useRef<any>(null)
  const [tileStyle, setTileStyle] = useState<keyof typeof TILE_LAYERS>('terrain')

  useEffect(() => {
    if (!containerRef.current || coords.length === 0) return

    import('leaflet').then((L) => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }

      const map = L.map(containerRef.current!, {
        zoomControl: false,
        scrollWheelZoom: false,
        attributionControl: false,
        dragging: true,
      })

      const tile = L.tileLayer(TILE_LAYERS[tileStyle].url, {
        maxZoom: 17,
      }).addTo(map)
      tileLayerRef.current = tile

      const latLngs: [number, number][] = coords.map(c => [c[0], c[1]])
      const color = SPORT_COLORS[sport] ?? '#8b5cf6'

      // Glow effect: wide semi-transparent line underneath
      L.polyline(latLngs, { color, weight: 10, opacity: 0.15 }).addTo(map)
      L.polyline(latLngs, { color, weight: 5,  opacity: 0.35 }).addTo(map)
      // Sharp line on top
      L.polyline(latLngs, { color, weight: 2.5, opacity: 1 }).addTo(map)

      map.fitBounds(L.polyline(latLngs).getBounds(), { padding: [28, 28] })
      setTimeout(() => map.invalidateSize(), 0)

      // Styled start/end markers
      if (latLngs.length > 0) {
        const iconOpts = { iconSize: [24, 24] as [number, number], iconAnchor: [12, 12] as [number, number], className: '' }
        L.marker(latLngs[0], {
          icon: L.divIcon({ ...iconOpts, html: pulseMarkerHtml('#22c55e', 'START') }),
        }).addTo(map)
        L.marker(latLngs[latLngs.length - 1], {
          icon: L.divIcon({ ...iconOpts, html: pulseMarkerHtml('#ef4444', 'END') }),
        }).addTo(map)
      }

      // Zoom control (custom position)
      L.control.zoom({ position: 'bottomright' }).addTo(map)

      mapRef.current = map
    })

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [coords, sport])

  // Switch tile layer when style changes
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return
    import('leaflet').then((L) => {
      if (!mapRef.current) return
      mapRef.current.removeLayer(tileLayerRef.current)
      tileLayerRef.current = L.tileLayer(TILE_LAYERS[tileStyle].url, { maxZoom: 17 })
      tileLayerRef.current.addTo(mapRef.current)
      tileLayerRef.current.bringToBack()
    })
  }, [tileStyle])

  useEffect(() => {
    if (!mapRef.current || hoveredIdx == null || hoveredIdx < 0 || hoveredIdx >= coords.length) {
      if (hoverMarkerRef.current) { hoverMarkerRef.current.remove(); hoverMarkerRef.current = null }
      return
    }
    import('leaflet').then((L) => {
      if (!mapRef.current) return
      const [lat, lng] = coords[hoveredIdx]
      if (hoverMarkerRef.current) {
        hoverMarkerRef.current.setLatLng([lat, lng])
      } else {
        hoverMarkerRef.current = L.circleMarker([lat, lng], {
          radius: 7, color: '#ffffff', fillColor: 'var(--color-primary)', fillOpacity: 1, weight: 2,
        }).addTo(mapRef.current)
      }
    })
  }, [hoveredIdx, coords])

  if (coords.length === 0) {
    return (
      <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center text-slate-500 text-sm" style={{ height }}>
        Sin datos GPS
      </div>
    )
  }

  return (
    <div style={{ height, position: 'relative' }} className="rounded-xl overflow-hidden border border-slate-700/50">
      <style>{`
        @keyframes map-pulse {
          0%   { transform: scale(1); opacity: 0.25; }
          70%  { transform: scale(2.5); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
        .leaflet-control-zoom {
          border: none !important;
          margin: 0 8px 8px 0 !important;
        }
        .leaflet-control-zoom a {
          background: rgba(15,23,42,0.85) !important;
          color: #94a3b8 !important;
          border: 1px solid rgba(71,85,105,0.5) !important;
          width: 28px !important;
          height: 28px !important;
          line-height: 28px !important;
          font-size: 16px !important;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(30,41,59,0.95) !important;
          color: #e2e8f0 !important;
        }
      `}</style>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {/* Tile style toggle */}
      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 1000, display: 'flex', gap: 4 }}>
        {(Object.entries(TILE_LAYERS) as [keyof typeof TILE_LAYERS, typeof TILE_LAYERS[keyof typeof TILE_LAYERS]][]).map(([key, { label, title }]) => (
          <button
            key={key}
            title={title}
            onClick={() => setTileStyle(key)}
            style={{
              background: tileStyle === key ? 'rgba(15,23,42,0.95)' : 'rgba(15,23,42,0.7)',
              border: `1px solid ${tileStyle === key ? 'rgba(148,163,184,0.5)' : 'rgba(71,85,105,0.3)'}`,
              borderRadius: 6,
              width: 28,
              height: 28,
              cursor: 'pointer',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

