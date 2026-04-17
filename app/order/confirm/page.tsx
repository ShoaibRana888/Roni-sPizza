/**
 * FILE: app/order/confirm/page.tsx
 * PURPOSE: Live order-tracking screen shown to customers after placing an order.
 *          - Polls Supabase every 5 s for real-time status updates
 *          - Shows a 25-minute countdown progress bar (mirrors dashboard timer)
 *          - Three distinct visual states driven by order.status:
 *              new       → "Order received" — kitchen hasn't started yet
 *              preparing → "Being prepared" — kitchen is on it
 *              done      → "On its way!"    — food is ready / being delivered
 *          - Clears the cart on mount so the next customer starts fresh
 * ROUTE: /order/confirm?table=1&orderId=<uuid>
 * ACCESSED BY: Customers — redirected here automatically after placing order
 */

'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { useCartStore } from '@/lib/cartStore'
import { supabase, Order, OrderStatus } from '@/lib/supabase'

// Must match dashboard constant exactly
const ORDER_DURATION_MS = 25 * 60 * 1000
const POLL_INTERVAL_MS  = 5_000

function secondsLeft(createdAt: string): number {
  const elapsed = Date.now() - new Date(createdAt).getTime()
  return Math.max(0, Math.floor((ORDER_DURATION_MS - elapsed) / 1000))
}

function fmtCountdown(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ── Status config — everything that changes per-state lives here ──────────────
const STATUS_CONFIG: Record<
  OrderStatus,
  { icon: string; color: string; bg: string; headline: string; sub: string }
> = {
  new: {
    icon:     '🧾',
    color:    '#92620A',
    bg:       '#FEF3CD',
    headline: 'Order received!',
    sub:      "We've got your order and will start preparing it shortly.",
  },
  preparing: {
    icon:     '🍕',
    color:    '#1D4ED8',
    bg:       '#DBEAFE',
    headline: 'Being prepared…',
    sub:      "Your pizza is in the oven. It'll be with you very soon!",
  },
  done: {
    icon:     '🔔',
    color:    '#166534',
    bg:       '#DCFCE7',
    headline: 'On its way!',
    sub:      "Your order is ready and will be at your table any moment now.",
  },
  cancelled: {
    icon:     '✕',
    color:    '#991B1B',
    bg:       '#FEE2E2',
    headline: 'Order cancelled',
    sub:      'Your order was cancelled. Please visit the counter or re-order.',
  },
}

// ── Steps shown below the status card ────────────────────────────────────────
const STEPS: { icon: string; text: string; activeOn: OrderStatus[] }[] = [
  { icon: '✓',  text: 'Order placed',      activeOn: ['new', 'preparing', 'done'] },
  { icon: '🍕', text: 'Being prepared',    activeOn: ['preparing', 'done'] },
  { icon: '🔔', text: "On the way to you", activeOn: ['done'] },
  { icon: '💳', text: 'Pay at the counter',activeOn: [] }, // always greyed — future
]

// ─────────────────────────────────────────────────────────────────────────────

function ConfirmPageInner() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const table        = searchParams.get('table')   || '1'
  const orderId      = searchParams.get('orderId') || ''

  const { clearCart } = useCartStore()

  const [order, setOrder]   = useState<Order | null>(null)
  const [tick, setTick]     = useState(0)
  const [loading, setLoading] = useState(true)

  // Clear cart once on mount
  useEffect(() => { clearCart() }, [clearCart])

  // Fetch order immediately, then poll every 5 s
  useEffect(() => {
    if (!orderId) return

    const fetchOrder = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()
      if (!error && data) setOrder(data as Order)
      setLoading(false)
    }

    fetchOrder()
    const poll = setInterval(fetchOrder, POLL_INTERVAL_MS)
    return () => clearInterval(poll)
  }, [orderId])

  // Tick every second for the countdown
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--cream)' }}>
        <p className="text-sm" style={{ color: 'rgba(28,15,8,0.35)' }}>Loading your order…</p>
      </div>
    )
  }

  // ── Order not found ───────────────────────────────────────────────────────
  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
        style={{ background: 'var(--cream)' }}>
        <p className="text-4xl mb-4">🤔</p>
        <p className="font-serif text-xl mb-2">Order not found</p>
        <p className="text-sm mb-6" style={{ color: 'rgba(28,15,8,0.45)' }}>
          Something went wrong. Please visit the counter.
        </p>
        <button onClick={() => router.push(`/order?table=${table}`)}
          className="px-6 py-3 rounded-xl text-white text-sm font-medium"
          style={{ background: 'var(--espresso)' }}>
          Back to menu
        </button>
      </div>
    )
  }

  const status  = order.status as OrderStatus
  const cfg     = STATUS_CONFIG[status] ?? STATUS_CONFIG.new
  const secs    = secondsLeft(order.created_at)
  const pct     = Math.round((secs / (ORDER_DURATION_MS / 1000)) * 100)
  const overdue = secs === 0 && status !== 'done' && status !== 'cancelled'
  const isDone  = status === 'done'

  return (
    <div className="min-h-screen flex flex-col items-center p-6 pt-12"
      style={{ background: 'var(--cream)' }}>

      {/* ── Status card ─────────────────────────────────────────────────── */}
      <div className="w-full max-w-sm bg-white rounded-3xl border overflow-hidden shadow-sm mb-6"
        style={{ borderColor: 'rgba(28,15,8,0.08)' }}>

        {/* Progress bar — drains over 25 min, hidden once done */}
        {!isDone && status !== 'cancelled' && (
          <div className="h-1.5 w-full" style={{ background: 'rgba(28,15,8,0.06)' }}>
            <div
              className="h-full transition-all duration-1000"
              style={{
                width: `${pct}%`,
                background: overdue
                  ? '#C0392B'
                  : pct > 40
                  ? 'var(--sage)'
                  : 'var(--latte)',
              }}
            />
          </div>
        )}

        {/* Status icon + headline */}
        <div className="flex flex-col items-center pt-8 pb-6 px-6 text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-4"
            style={{ background: cfg.bg }}>
            {cfg.icon}
          </div>

          <h1 className="font-serif text-2xl mb-1">{cfg.headline}</h1>
          <p className="text-sm" style={{ color: 'rgba(28,15,8,0.5)' }}>{cfg.sub}</p>
        </div>

        {/* Meta row */}
        <div className="border-t flex divide-x"
          style={{ borderColor: 'rgba(28,15,8,0.07)', color: 'rgba(28,15,8,0.45)' }}>
          <div className="flex-1 py-3 text-center">
            <p className="text-xs mb-0.5">Table</p>
            <p className="text-sm font-medium" style={{ color: 'var(--espresso)' }}>{table}</p>
          </div>
          <div className="flex-1 py-3 text-center">
            <p className="text-xs mb-0.5">Ref</p>
            <p className="text-sm font-medium font-mono" style={{ color: 'var(--espresso)' }}>
              #{orderId.slice(-6).toUpperCase()}
            </p>
          </div>
          {/* Timer — live countdown, replaced with "Ready!" when done */}
          <div className="flex-1 py-3 text-center">
            <p className="text-xs mb-0.5">
              {isDone ? 'Status' : 'Est. time'}
            </p>
            {isDone ? (
              <p className="text-sm font-medium" style={{ color: 'var(--sage)' }}>Ready! 🎉</p>
            ) : (
              <p
                className="text-sm font-medium font-mono tabular-nums"
                style={{ color: overdue ? '#C0392B' : 'var(--espresso)' }}>
                {overdue ? 'Overdue' : fmtCountdown(secs)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Progress steps ───────────────────────────────────────────────── */}
      <div className="w-full max-w-sm bg-white rounded-2xl border p-5 mb-6"
        style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
        <p className="text-xs font-medium uppercase tracking-wider mb-4"
          style={{ color: 'rgba(28,15,8,0.35)' }}>Order progress</p>

        <div className="space-y-3">
          {STEPS.map((step, i) => {
            const active = step.activeOn.includes(status)
            return (
              <div key={i} className="flex items-center gap-3">
                {/* Step dot */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 transition-all"
                  style={{
                    background: active ? 'var(--espresso)' : 'rgba(28,15,8,0.07)',
                    color:      active ? '#fff'            : 'rgba(28,15,8,0.25)',
                  }}>
                  {active ? '✓' : String(i + 1)}
                </div>
                <span
                  className="text-sm transition-all"
                  style={{
                    color: active ? 'var(--espresso)' : 'rgba(28,15,8,0.3)',
                    fontWeight: active ? 500 : 400,
                  }}>
                  {step.text}
                </span>
                {/* Animated pulse for the "current" step */}
                {step.activeOn[step.activeOn.length - 1] === status && (
                  <span className="ml-auto w-2 h-2 rounded-full animate-pulse"
                    style={{ background: cfg.color }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Footer note ─────────────────────────────────────────────────── */}
      <p className="text-xs text-center" style={{ color: 'rgba(28,15,8,0.3)' }}>
        {isDone
          ? 'Please pay at the counter once you\'re done. Enjoy your meal! 🍕'
          : 'Updates every few seconds. No need to refresh.'}
      </p>
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense>
      <ConfirmPageInner />
    </Suspense>
  )
}