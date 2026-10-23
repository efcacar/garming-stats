import { useEffect, useMemo, useRef, useState } from 'react'
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'

interface Props {
  coords: number[][]
  sport?: string
  height?: number
  hoveredIdx?: number | null
  hoveredPosition?: [number, number] | null
}

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
if (API_KEY) setOptions({ key: API_KEY, v: 'quarterly', language: 'es', region: 'ES' })

const SPORT_COLORS: Record<string, string> = {
  running: '#ef4444',
  cycling: '#f97316',
  swimming: '#3b82f6',
  walking: '#22c55e',
  other: '#8b5cf6',
}

function validPosition(position: number[] | null | undefined): position is number[] {
  return !!position && Number.isFinite(position[0]) && Number.isFinite(position[1])
    && Math.abs(position[0]) <= 90 && Math.abs(position[1]) <= 180
}

export default function ActivityMap({ coords, sport = 'other', height = 320, hoveredIdx, hoveredPosition }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const hoverMarkerRef = useRef<google.maps.Marker | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const path = useMemo(() => coords.filter(validPosition).map(point => ({ lat: point[0], lng: point[1] })), [coords])
  const hasRoute = path.length > 0

  useEffect(() => {
    if (!API_KEY || !hasRoute || !containerRef.current) return
    let cancelled = false
    let timedOut = false
    const container = containerRef.current
    const previousAuthFailure = window.gm_authFailure
    window.gm_authFailure = () => {
      if (!cancelled) {
        console.error('Google Maps authentication failed. Check API key restrictions, enabled API and billing.')
        setError('Google Maps ha rechazado la clave. Comprueba Maps JavaScript API, la facturación y los sitios web autorizados en Google Cloud.')
      }
      previousAuthFailure?.()
    }
    const timeout = setTimeout(() => {
      timedOut = true
      if (!cancelled) setError('Google Maps está tardando demasiado en cargar. Comprueba tu conexión y recarga la página.')
    }, 20000)

    Promise.all([importLibrary('maps'), importLibrary('marker')]).then(([{ Map }]) => {
      if (cancelled) return
      clearTimeout(timeout)
      if (timedOut) setError(null)
      mapRef.current = new Map(container, {
        center: { lat: 0, lng: 0 },
        zoom: 12,
        mapTypeId: 'roadmap',
        mapTypeControl: true,
        mapTypeControlOptions: { mapTypeIds: ['roadmap', 'hybrid', 'terrain'] },
        streetViewControl: false,
        fullscreenControl: true,
        scrollwheel: false,
      })
      setReady(true)
    }).catch(() => {
      if (cancelled) return
      clearTimeout(timeout)
      console.error('Google Maps JavaScript API could not be loaded.')
      setError('No se pudo cargar Google Maps. Comprueba tu conexión, los bloqueadores del navegador y la configuración de la API.')
    })

    return () => {
      cancelled = true
      clearTimeout(timeout)
      window.gm_authFailure = previousAuthFailure
      if (mapRef.current) google.maps.event.clearInstanceListeners(mapRef.current)
      hoverMarkerRef.current?.setMap(null)
      hoverMarkerRef.current = null
      mapRef.current = null
      container.replaceChildren()
      setReady(false)
    }
  }, [hasRoute])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !path.length) return
    const color = SPORT_COLORS[sport] ?? SPORT_COLORS.other
    const route = new google.maps.Polyline({
      map, path, strokeColor: color, strokeOpacity: 1, strokeWeight: 4, clickable: false,
    })
    const bounds = new google.maps.LatLngBounds()
    path.forEach(point => bounds.extend(point))
    if (path.length === 1) {
      map.setCenter(path[0])
      map.setZoom(16)
    } else {
      map.fitBounds(bounds, 32)
    }
    // Symbol markers do not require a Google Cloud map ID.
    const markers = [
      { position: path[0], color: '#22c55e', title: 'Inicio' },
      { position: path[path.length - 1], color: '#ef4444', title: 'Final' },
    ].map(({ position, color: fillColor, title }) => new google.maps.Marker({
      map, position, title, clickable: false,
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 },
    }))
    return () => {
      route.setMap(null)
      markers.forEach(marker => marker.setMap(null))
    }
  }, [ready, path, sport])

  useEffect(() => {
    const map = mapRef.current
    const position = hoveredPosition ?? (hoveredIdx != null ? coords[hoveredIdx] : null)
    if (!ready || !map || !validPosition(position)) {
      hoverMarkerRef.current?.setMap(null)
      return
    }
    const point = { lat: position[0], lng: position[1] }
    if (!hoverMarkerRef.current) {
      const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#14b8a6'
      hoverMarkerRef.current = new google.maps.Marker({
        position: point, map, title: 'Posición del entrenamiento', clickable: false, zIndex: 10,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: primaryColor, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 },
      })
    } else {
      hoverMarkerRef.current.setPosition(point)
      hoverMarkerRef.current.setMap(map)
    }
  }, [ready, hoveredPosition, hoveredIdx, coords])

  const message = !hasRoute
    ? 'Sin datos GPS'
    : !API_KEY
      ? 'Configura VITE_GOOGLE_MAPS_API_KEY en .env.local y reinicia el servidor para activar Google Maps.'
      : error

  return (
    <div style={{ height }} className="relative rounded-xl overflow-hidden border border-slate-700/50 bg-slate-800/60">
      <div ref={containerRef} aria-label="Mapa del recorrido en Google Maps" className="h-full w-full" />
      {(message || !ready) && (
        <div role={error ? 'alert' : 'status'} className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-slate-400 bg-slate-900/95">
          {message ?? 'Cargando Google Maps...'}
        </div>
      )}
    </div>
  )
}
