/**
 * FILE: app/delivery/page.tsx
 * PURPOSE: Customer-facing delivery entry point.
 *          1. Loads restaurant delivery settings from Supabase
 *          2. Asks for customer's location via browser geolocation
 *          3. Haversine distance check against restaurant's 5 km radius
 *          4. In range  → shows the menu (same ordering flow, delivery mode)
 *          5. Out of range → shows distance + friendly message
 * ROUTE: /delivery
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface DeliverySettings {
  lat: number
  lng: number
  radius_km: number
}

type Stage =
  | 'loading-settings'   // fetching restaurant config
  | 'no-settings'        // restaurant hasn't configured delivery
  | 'prompt'             // ask user to share location
  | 'locating'           // browser geolocation in progress
  | 'checking'           // doing distance math
  | 'in-range'           // ✅ within radius
  | 'out-of-range'       // ❌ too far
  | 'denied'             // user denied location permission
  | 'error'              // generic geolocation error

// ── Haversine distance (km) ──────────────────────────────────────────────────
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R    = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function fmtKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

export default function DeliveryPage() {
  const router = useRouter()

  const [stage, setStage]           = useState<Stage>('loading-settings')
  const [config, setConfig]         = useState<DeliverySettings | null>(null)
  const [distance, setDistance]     = useState<number | null>(null)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)

  // ── Fetch restaurant delivery config ────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('restaurant_settings')
      .select('value')
      .eq('key', 'delivery')
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.value) { setStage('no-settings'); return }
        const s = data.value as DeliverySettings
        if (!s.lat || !s.lng) { setStage('no-settings'); return }
        setConfig(s)
        setStage('prompt')
      })
  }, [])

  // ── Request geolocation ─────────────────────────────────────────────────────
  const requestLocation = () => {
    if (!navigator.geolocation) { setStage('error'); return }
    setStage('locating')

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setUserCoords({ lat, lng })
        setStage('checking')

        if (!config) { setStage('error'); return }

        const dist = haversineKm(lat, lng, config.lat, config.lng)
        setDistance(dist)

        // Small delay so "Checking…" is visible and not jarring
        setTimeout(() => {
          setStage(dist <= config.radius_km ? 'in-range' : 'out-of-range')
        }, 700)
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setStage('denied')
        else setStage('error')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  // ── Proceed to menu ─────────────────────────────────────────────────────────
  const browseMenu = () => {
    // Delivery orders use a special table identifier
    // The cart page reads mode=delivery to show address field
    router.push('/order?table=delivery&mode=delivery')
  }

  // ── UI states ───────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'var(--cream)' }}
    >
      {/* Logo */}
      <div className="mb-10 text-center">
        <p className="font-serif text-3xl" style={{ color: 'var(--espresso)' }}>
          Roni's Pizza
        </p>
        <p className="text-sm mt-1" style={{ color: 'rgba(28,15,8,0.4)' }}>
          Delivery
        </p>
      </div>

      <div className="w-full max-w-sm">

        {/* ── Loading settings ────────────────────────────────────────────── */}
        {stage === 'loading-settings' && (
          <Card>
            <Spinner />
            <p className="text-sm mt-4 text-center" style={{ color: 'rgba(28,15,8,0.4)' }}>
              Checking delivery availability…
            </p>
          </Card>
        )}

        {/* ── Not configured ──────────────────────────────────────────────── */}
        {stage === 'no-settings' && (
          <Card>
            <BigEmoji>🚧</BigEmoji>
            <Title>Delivery unavailable</Title>
            <Sub>
              We haven't set up delivery for your area yet. Please visit us in person or call to order.
            </Sub>
          </Card>
        )}

        {/* ── Prompt ──────────────────────────────────────────────────────── */}
        {stage === 'prompt' && (
          <Card>
            <BigEmoji>🛵</BigEmoji>
            <Title>Order delivered to you</Title>
            <Sub>
              We deliver within {config?.radius_km ?? 5} km of our restaurant.
              Share your location to see if you're in range.
            </Sub>
            <PrimaryButton onClick={requestLocation}>
              📍 Check my location
            </PrimaryButton>
          </Card>
        )}

        {/* ── Locating ────────────────────────────────────────────────────── */}
        {stage === 'locating' && (
          <Card>
            <Spinner />
            <Title>Getting your location…</Title>
            <Sub>Please allow location access when prompted.</Sub>
          </Card>
        )}

        {/* ── Checking ────────────────────────────────────────────────────── */}
        {stage === 'checking' && (
          <Card>
            <Spinner />
            <Title>Checking delivery range…</Title>
          </Card>
        )}

        {/* ── In range ────────────────────────────────────────────────────── */}
        {stage === 'in-range' && distance !== null && config && (
          <Card>
            <BigEmoji>✅</BigEmoji>
            <Title>You're in range!</Title>
            <Sub>
              You're <strong>{fmtKm(distance)}</strong> from us — well within our{' '}
              {config.radius_km} km delivery zone.
            </Sub>

            {/* Range bar */}
            <div className="w-full mt-4 mb-5">
              <div className="h-2 rounded-full overflow-hidden"
                style={{ background: 'rgba(28,15,8,0.08)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (distance / config.radius_km) * 100)}%`,
                    background: '#22C55E',
                  }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-xs" style={{ color: 'rgba(28,15,8,0.35)' }}>You</span>
                <span className="text-xs" style={{ color: 'rgba(28,15,8,0.35)' }}>
                  {config.radius_km} km limit
                </span>
              </div>
            </div>

            <PrimaryButton onClick={browseMenu}>
              🍕 Browse menu
            </PrimaryButton>
          </Card>
        )}

        {/* ── Out of range ─────────────────────────────────────────────────── */}
        {stage === 'out-of-range' && distance !== null && config && (
          <Card>
            <BigEmoji>😔</BigEmoji>
            <Title>Out of delivery range</Title>
            <Sub>
              You're <strong>{fmtKm(distance)}</strong> away, but we only deliver within{' '}
              {config.radius_km} km.
            </Sub>

            {/* Range bar — red, capped at 100% */}
            <div className="w-full mt-4 mb-5">
              <div className="h-2 rounded-full overflow-hidden"
                style={{ background: 'rgba(28,15,8,0.08)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: '100%', background: '#EF4444' }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-xs" style={{ color: 'rgba(28,15,8,0.35)' }}>You</span>
                <span className="text-xs" style={{ color: 'rgba(28,15,8,0.35)' }}>
                  {config.radius_km} km limit
                </span>
              </div>
            </div>

            <p className="text-sm text-center mb-4" style={{ color: 'rgba(28,15,8,0.5)' }}>
              You're {fmtKm(distance - config.radius_km)} outside our delivery area.
            </p>

            <SecondaryButton onClick={() => setStage('prompt')}>
              Try again
            </SecondaryButton>
          </Card>
        )}

        {/* ── Location denied ──────────────────────────────────────────────── */}
        {stage === 'denied' && (
          <Card>
            <BigEmoji>🔒</BigEmoji>
            <Title>Location access denied</Title>
            <Sub>
              We need your location to check if you're in our delivery area.
              Please enable location access in your browser settings and try again.
            </Sub>
            <PrimaryButton onClick={() => setStage('prompt')}>
              Try again
            </PrimaryButton>
          </Card>
        )}

        {/* ── Generic error ────────────────────────────────────────────────── */}
        {stage === 'error' && (
          <Card>
            <BigEmoji>⚠️</BigEmoji>
            <Title>Something went wrong</Title>
            <Sub>
              We couldn't get your location. Please try again or call us to place an order.
            </Sub>
            <PrimaryButton onClick={() => setStage('prompt')}>
              Try again
            </PrimaryButton>
          </Card>
        )}

      </div>
    </div>
  )
}

// ── Small UI helpers ─────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="bg-white rounded-3xl p-8 flex flex-col items-center text-center shadow-sm"
      style={{ border: '1px solid rgba(28,15,8,0.08)' }}
    >
      {children}
    </div>
  )
}

function BigEmoji({ children }: { children: string }) {
  return <p className="text-6xl mb-4">{children}</p>
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-serif text-xl mb-2" style={{ color: 'var(--espresso)' }}>
      {children}
    </p>
  )
}

function Sub({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(28,15,8,0.5)' }}>
      {children}
    </p>
  )
}

function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3.5 rounded-2xl text-white text-sm font-medium transition-all active:scale-95"
      style={{ background: 'var(--espresso)' }}
    >
      {children}
    </button>
  )
}

function SecondaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3.5 rounded-2xl text-sm font-medium border transition-all"
      style={{ borderColor: 'rgba(28,15,8,0.15)', color: 'rgba(28,15,8,0.6)' }}
    >
      {children}
    </button>
  )
}

function Spinner() {
  return (
    <div
      className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mb-4"
      style={{ borderColor: 'rgba(28,15,8,0.15)', borderTopColor: 'var(--espresso)' }}
    />
  )
}