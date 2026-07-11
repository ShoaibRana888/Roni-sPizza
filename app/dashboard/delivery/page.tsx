/**
 * FILE: app/dashboard/delivery/page.tsx
 * PURPOSE: Staff sets the restaurant's delivery zone.
 *          - Interactive Leaflet map (loaded via CDN, no install needed)
 *          - Drag the pin to set restaurant location
 *          - Radius slider (1–15 km, default 5 km)
 *          - Saves to Supabase `restaurant_settings` table
 *          - Draws the delivery radius circle on the map live
 * ROUTE: /dashboard/delivery
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface DeliverySettings {
  lat: number
  lng: number
  radius_km: number
  address_label?: string
}

const DEFAULT_CENTER = { lat: 31.5204, lng: 74.3587 } // Lahore, PK
const DEFAULT_RADIUS = 5

export default function DeliveryPage() {
  const mapRef        = useRef<HTMLDivElement>(null)
  const leafletRef    = useRef<any>(null)   // L
  const mapInstanceRef = useRef<any>(null)  // L.Map
  const markerRef     = useRef<any>(null)   // L.Marker
  const circleRef     = useRef<any>(null)   // L.Circle

  const [settings, setSettings]   = useState<DeliverySettings | null>(null)
  const [radius, setRadius]       = useState(DEFAULT_RADIUS)
  const [pinPos, setPinPos]       = useState<{ lat: number; lng: number } | null>(null)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [mapReady, setMapReady]   = useState(false)
  const [loading, setLoading]     = useState(true)

  // ── Load existing settings from Supabase ──────────────────────────────────
  useEffect(() => {
    supabase
      .from('restaurant_settings')
      .select('value')
      .eq('key', 'delivery')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          const s = data.value as DeliverySettings
          setSettings(s)
          setRadius(s.radius_km ?? DEFAULT_RADIUS)
          setPinPos({ lat: s.lat, lng: s.lng })
        }
        setLoading(false)
      })
  }, [])

  // ── Load Leaflet via CDN, then init map ────────────────────────────────────
  useEffect(() => {
    if (loading) return // wait until settings are loaded

    const existingScript = document.getElementById('leaflet-js')
    if (existingScript) {
      initMap()
      return
    }

    // Leaflet CSS
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)

    // Leaflet JS
    const script = document.createElement('script')
    script.id = 'leaflet-js'
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = initMap
    document.head.appendChild(script)

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  function initMap() {
    if (!mapRef.current || mapInstanceRef.current) return
    const L = (window as any).L
    if (!L) return
    leafletRef.current = L

    const center = pinPos ?? DEFAULT_CENTER

    const map = L.map(mapRef.current, { zoomControl: true }).setView(
      [center.lat, center.lng],
      13,
    )
    mapInstanceRef.current = map

    // OpenStreetMap tiles (free, no key needed)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    // Custom pin icon
    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width:36px;height:36px;border-radius:50% 50% 50% 0;
        background:#3B1F0E;border:3px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,0.4);
        transform:rotate(-45deg);
        display:flex;align-items:center;justify-content:center;
      "><span style="transform:rotate(45deg);font-size:16px;display:block;text-align:center;line-height:24px">🍕</span></div>`,
      iconSize:   [36, 36],
      iconAnchor: [18, 36],
    })

    // Draggable marker
    const marker = L.marker([center.lat, center.lng], { draggable: true, icon }).addTo(map)
    markerRef.current = marker

    // Draw radius circle
    const circle = L.circle([center.lat, center.lng], {
      radius:      (pinPos ? radius : DEFAULT_RADIUS) * 1000,
      color:       '#C47B2B',
      fillColor:   '#C47B2B',
      fillOpacity: 0.08,
      weight:      2,
    }).addTo(map)
    circleRef.current = circle

    // Update state on drag
    marker.on('dragend', () => {
      const latlng = marker.getLatLng()
      setPinPos({ lat: latlng.lat, lng: latlng.lng })
      circle.setLatLng(latlng)
    })

    // Click on map to move pin
    map.on('click', (e: any) => {
      marker.setLatLng(e.latlng)
      circle.setLatLng(e.latlng)
      setPinPos({ lat: e.latlng.lat, lng: e.latlng.lng })
    })

    setMapReady(true)
  }

  // ── Update circle radius when slider changes ───────────────────────────────
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(radius * 1000)
    }
  }, [radius])

  // ── Save to Supabase ───────────────────────────────────────────────────────
  const save = async () => {
    if (!pinPos) return
    setSaving(true)

    const value: DeliverySettings = {
      lat:       pinPos.lat,
      lng:       pinPos.lng,
      radius_km: radius,
    }

    const { error } = await supabase
      .from('restaurant_settings')
      .upsert({ key: 'delivery', value }, { onConflict: 'key' })

    setSaving(false)
    if (!error) {
      setSettings(value)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  // ── Use my current location ────────────────────────────────────────────────
  const useMyLocation = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude: lat, longitude: lng } = pos.coords
      setPinPos({ lat, lng })
      if (mapInstanceRef.current && markerRef.current && circleRef.current) {
        const latlng = { lat, lng }
        mapInstanceRef.current.setView(latlng, 15)
        markerRef.current.setLatLng(latlng)
        circleRef.current.setLatLng(latlng)
      }
    })
  }

  return (
    <>
      <header
        className="h-14 bg-white border-b flex items-center justify-between px-6 flex-shrink-0"
        style={{ borderColor: 'rgba(28,15,8,0.08)' }}
      >
        <div>
          <h1 className="text-base font-medium">Delivery Zone</h1>
        </div>

        <div className="flex items-center gap-3">
          {settings && (
            <span className="text-xs px-2.5 py-1 rounded-full"
              style={{ background: '#D1FAE5', color: '#065F46' }}>
              ✓ Zone configured
            </span>
          )}
          <button
            onClick={useMyLocation}
            className="text-xs px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'rgba(28,15,8,0.15)', color: 'rgba(28,15,8,0.6)' }}
          >
            📍 Use my location
          </button>
          <button
            onClick={save}
            disabled={saving || !pinPos}
            className="text-xs px-4 py-1.5 rounded-lg text-white font-medium transition-all"
            style={{ background: (!pinPos || saving) ? 'rgba(28,15,8,0.2)' : 'var(--espresso)' }}
          >
            {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save zone'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <div
          className="w-72 flex-shrink-0 flex flex-col border-r overflow-y-auto p-5 gap-5"
          style={{ borderColor: 'rgba(28,15,8,0.08)' }}
        >
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: 'rgba(28,15,8,0.5)' }}>
              How to set your zone
            </p>
            <p className="text-sm" style={{ color: 'rgba(28,15,8,0.7)', lineHeight: 1.6 }}>
              Click anywhere on the map or drag the 🍕 pin to set your restaurant location. The orange circle shows your delivery radius.
            </p>
          </div>

          {/* Radius slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium" style={{ color: 'rgba(28,15,8,0.5)' }}>
                Delivery radius
              </p>
              <p className="text-sm font-semibold" style={{ color: 'var(--espresso)' }}>
                {radius} km
              </p>
            </div>
            <input
              type="range"
              min={1}
              max={15}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full accent-amber-800"
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs" style={{ color: 'rgba(28,15,8,0.3)' }}>1 km</span>
              <span className="text-xs" style={{ color: 'rgba(28,15,8,0.3)' }}>15 km</span>
            </div>
          </div>

          {/* Current pin position */}
          {pinPos ? (
            <div
              className="rounded-xl p-4"
              style={{ background: 'var(--foam)' }}
            >
              <p className="text-xs font-medium mb-2" style={{ color: 'rgba(28,15,8,0.5)' }}>
                Pin location
              </p>
              <p className="text-xs font-mono" style={{ color: 'rgba(28,15,8,0.7)' }}>
                {pinPos.lat.toFixed(5)}, {pinPos.lng.toFixed(5)}
              </p>
              <p className="text-xs mt-2" style={{ color: 'rgba(28,15,8,0.4)' }}>
                Radius: {radius} km around this point
              </p>
            </div>
          ) : (
            <div
              className="rounded-xl p-4 border border-dashed"
              style={{ borderColor: 'rgba(28,15,8,0.15)' }}
            >
              <p className="text-xs text-center" style={{ color: 'rgba(28,15,8,0.35)' }}>
                No pin placed yet.<br />Click the map to set location.
              </p>
            </div>
          )}

          {/* Delivery link */}
          {settings && (
            <div
              className="rounded-xl p-4"
              style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}
            >
              <p className="text-xs font-medium mb-1" style={{ color: '#1E40AF' }}>
                Customer delivery link
              </p>
              <p className="text-xs font-mono break-all" style={{ color: '#3730A3' }}>
                {typeof window !== 'undefined' ? window.location.origin : ''}/delivery
              </p>
              <button
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/delivery`)}
                className="text-xs mt-2 px-2 py-1 rounded"
                style={{ background: '#DBEAFE', color: '#1E40AF' }}
              >
                Copy link
              </button>
            </div>
          )}
        </div>

        {/* ── Map ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10"
              style={{ background: 'var(--cream)' }}>
              <p className="text-sm" style={{ color: 'rgba(28,15,8,0.35)' }}>Loading map…</p>
            </div>
          )}
          <div ref={mapRef} className="w-full h-full" style={{ minHeight: 400 }} />
        </div>

      </div>
    </>
  )
}