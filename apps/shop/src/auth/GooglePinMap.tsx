import { ToastMessage } from '../components/Toast';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { useEffect, useRef, useState } from 'react'

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() || (import.meta.env.DEV ? 'DEMO_MAP_ID' : '')

if (apiKey) setOptions({ key: apiKey, v: 'weekly', language: 'en', region: 'PK' })

type Coordinates = { lat: number; lng: number }
type Props = { latitude: string; longitude: string; onSelect: (coordinates: Coordinates) => void; onError?: () => void }

function validCoordinates(latitude: string, longitude: string): Coordinates | null {
  if (!latitude.trim() || !longitude.trim()) return null
  const lat = Number(latitude)
  const lng = Number(longitude)
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null
}

function markerCoordinates(position: google.maps.marker.AdvancedMarkerElement['position']): Coordinates | null {
  if (!position) return null
  if (position instanceof google.maps.LatLng) return { lat: position.lat(), lng: position.lng() }
  return { lat: position.lat, lng: position.lng }
}

export default function GooglePinMap({ latitude, longitude, onSelect, onError }: Props) {
  const elementRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const onSelectRef = useRef(onSelect)
  const [error, setError] = useState('')
  onSelectRef.current = onSelect

  useEffect(() => {
    if (!apiKey || !elementRef.current) return
    let cancelled = false
    let clickListener: google.maps.MapsEventListener | undefined
    let marker: google.maps.marker.AdvancedMarkerElement | undefined

    async function initialize() {
      try {
        const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([
          importLibrary('maps'), importLibrary('marker'),
        ])
        if (cancelled || !elementRef.current) return
        const chosen = validCoordinates(latitude, longitude)
        const map = new Map(elementRef.current, {
          center: chosen || { lat: 31.52037, lng: 74.35875 },
          zoom: chosen ? 18 : 13,
          mapId,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        })
        marker = new AdvancedMarkerElement({ map, position: chosen || undefined, gmpDraggable: true, title: 'Shop entrance pin; drag to adjust' })
        mapRef.current = map
        markerRef.current = marker
        clickListener = map.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (!event.latLng || !markerRef.current) return
          const point = { lat: event.latLng.lat(), lng: event.latLng.lng() }
          markerRef.current.position = point
          onSelectRef.current(point)
        })
        marker.addEventListener('gmp-dragend', () => {
          const point = markerCoordinates(markerRef.current?.position)
          if (point) onSelectRef.current(point)
        })
      } catch {
        if (!cancelled) { setError('Map could not load. Retry the map or enter coordinates.'); onError?.() }
      }
    }
    void initialize()
    return () => {
      cancelled = true
      clickListener?.remove()
      if (marker) marker.map = null
      mapRef.current = null
      markerRef.current = null
    }
    // The map instance is initialized once; coordinate changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const point = validCoordinates(latitude, longitude)
    if (!point || !mapRef.current || !markerRef.current) return
    markerRef.current.position = point
    mapRef.current.panTo(point)
  }, [latitude, longitude])

  return <div className="signup-google-map-shell">
    <div ref={elementRef} className="signup-google-map" role="application" aria-label="Google map for choosing the shop entrance" />
    {error && <ToastMessage>{error}</ToastMessage>}
  </div>
}
