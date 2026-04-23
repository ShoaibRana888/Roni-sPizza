/**
 * FILE: app/order/confirm/page.tsx
 * PURPOSE: Live order-tracking screen shown to customers after placing an order.
 *          Fetches ALL orders for the table (new, preparing, AND done) within a
 *          4-hour window so the full combined order remains visible even after
 *          staff marks everything as ready.
 * ROUTE: /order/confirm?table=1&orderId=<uuid>
 *
 * FIX: Previously only fetched 'new' and 'preparing' orders. When staff marked
 *      all orders 'done', the orders array became empty and the page fell back
 *      to showing only latestOrder (the single most-recent order). Now 'done'
 *      is included in the query so all items remain visible throughout.
 */

'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { useCartStore, resolveItemPrice } from '@/lib/cartStore'
import { supabase, Order, OrderStatus } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'

const ORDER_DURATION_MS  = 25 * 60 * 1000
const POLL_INTERVAL_MS   = 5_000
const SESSION_WINDOW_MS  = 4 * 60 * 60 * 1000   // only show orders from the last 4 hours

function secondsLeft(createdAt: string): number {
  const elapsed = Date.now() - new Date(createdAt).getTime()
  return Math.max(0, Math.floor((ORDER_DURATION_MS - elapsed) / 1000))
}

function fmtCountdown(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

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

const STEPS: { icon: string; text: string; activeOn: OrderStatus[] }[] = [
  { icon: '✓',  text: 'Order placed',       activeOn: ['new', 'preparing', 'done'] },
  { icon: '🍕', text: 'Being prepared',     activeOn: ['preparing', 'done'] },
  { icon: '🔔', text: 'On the way to you',  activeOn: ['done'] },
  { icon: '💳', text: 'Pay at the counter', activeOn: [] },
]

/**
 * Derive the "dominant" status across all table orders.
 * Priority: preparing > new > done > cancelled
 */
function dominantStatus(orders: Order[], fallback?: Order | null): OrderStatus {
  if (orders.some((o) => o.status === 'preparing')) return 'preparing'
  if (orders.some((o) => o.status === 'new'))        return 'new'
  if (orders.some((o) => o.status === 'done'))       return 'done'
  // No recognisable orders — use the specific order's own status as fallback
  if (fallback) return fallback.status as OrderStatus
  return 'done'
}

function ConfirmPageInner() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const table        = searchParams.get('table')   || '1'
  const orderId      = searchParams.get('orderId') || ''  // most-recent order — used for ref + timer

  const { clearCart } = useCartStore()

  // All orders for this table within the current session window
  const [orders, setOrders]           = useState<Order[]>([])
  const [latestOrder, setLatestOrder] = useState<Order | null>(null)
  const [tick, setTick]               = useState(0)
  const [loading, setLoading]         = useState(true)

  useEffect(() => { clearCart() }, [clearCart])

  useEffect(() => {
    if (!table) return

    const fetchOrders = async () => {
      // Cutoff: only include orders placed in the last 4 hours so we don't
      // accidentally merge orders from a previous table session.
      const cutoff = new Date(Date.now() - SESSION_WINDOW_MS).toISOString()

      // FIX: include 'done' so the full combined order list stays visible
      // after staff marks everything ready — not just 'new' / 'preparing'.
      const { data: tableOrders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('table_number', table)
        .in('status', ['new', 'preparing', 'done'])
        .gte('created_at', cutoff)
        .order('created_at', { ascending: true })

      if (!error && tableOrders) {
        setOrders(tableOrders as Order[])
      }

      // Also fetch the specific order placed in this session for the ref
      // number and countdown timer baseline.
      if (orderId) {
        const { data: single } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single()
        if (single) setLatestOrder(single as Order)
      }

      setLoading(false)
    }

    fetchOrders()
    const poll = setInterval(fetchOrders, POLL_INTERVAL_MS)
    return () => clearInterval(poll)
  }, [table, orderId])

  // 1-second tick for the countdown display
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--cream)' }}>
        <p className="text-sm" style={{ color: 'rgba(28,15,8,0.35)' }}>Loading your order…</p>
      </div>
    )
  }

  if (orders.length === 0 && !latestOrder) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
        style={{ background: 'var(--cream)' }}>
        <p className="text-4xl mb-4">🤔</p>
        <p className="font-serif text-xl mb-2">Order not found</p>
        <p className="text-sm mb-6" style={{ color: 'rgba(28,15,8,0.45)' }}>
          Something went wrong. Please visit the counter.
        </p>
      </div>
    )
  }

  const refOrder    = latestOrder ?? orders[orders.length - 1]
  const status      = dominantStatus(orders, latestOrder)
  const cfg         = STATUS_CONFIG[status]
  const isDone      = status === 'done'
  const isCancelled = status === 'cancelled'
  const secs        = refOrder ? secondsLeft(refOrder.created_at) : 0

  // ── Cancelled screen ────────────────────────────────────────────────────────
  if (isCancelled) {
    return (
      <div className="min-h-screen flex flex-col items-center px-5 py-8"
        style={{ background: 'var(--cream)' }}>
        <div className="w-full max-w-sm bg-white rounded-2xl border overflow-hidden mb-4"
          style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
          <div className="h-1.5 w-full" style={{ background: cfg.bg }} />
          <div className="p-5 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3 text-2xl font-bold"
              style={{ background: cfg.bg, color: cfg.color }}>
              ✕
            </div>
            <h1 className="font-serif text-xl mb-1">{cfg.headline}</h1>
            <p className="text-sm" style={{ color: 'rgba(28,15,8,0.5)' }}>{cfg.sub}</p>
          </div>
          <div className="grid grid-cols-2 border-t" style={{ borderColor: 'rgba(28,15,8,0.07)' }}>
            <div className="flex flex-col items-center py-3 border-r" style={{ borderColor: 'rgba(28,15,8,0.07)' }}>
              <span className="text-xs mb-0.5" style={{ color: 'rgba(28,15,8,0.35)' }}>Table</span>
              <span className="text-sm font-medium">{table}</span>
            </div>
            <div className="flex flex-col items-center py-3">
              <span className="text-xs mb-0.5" style={{ color: 'rgba(28,15,8,0.35)' }}>Ref</span>
              <span className="text-sm font-medium">#{refOrder?.id.slice(-6).toUpperCase()}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => router.push(`/order?table=${table}`)}
          className="w-full max-w-sm py-3 rounded-2xl text-white text-sm font-medium"
          style={{ background: 'var(--espresso)' }}>
          Start a new order
        </button>
      </div>
    )
  }

  // ── Combine ALL orders for this table into one item list + total ─────────────
  // This now works correctly even when status is 'done' because the query
  // above includes done orders in the `orders` array.
  const allItems      = orders.length > 0
    ? orders.flatMap((o) => o.items)
    : (latestOrder?.items ?? [])

  const combinedTotal = orders.length > 0
    ? orders.reduce((sum, o) => sum + o.total, 0)
    : (latestOrder?.total ?? 0)

  // Whether any order is still in-flight (i.e. customer can add more items)
  const hasActiveOrders = orders.some((o) => o.status === 'new' || o.status === 'preparing')

  // ── Main tracking screen ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center px-5 py-8"
      style={{ background: 'var(--cream)' }}>

      {/* Status card */}
      <div className="w-full max-w-sm bg-white rounded-2xl border overflow-hidden mb-4"
        style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
        <div className="h-1.5 w-full" style={{ background: cfg.bg }}>
          <div className="h-full" style={{ width: '100%', background: cfg.color, opacity: 0.6 }} />
        </div>

        <div className="p-5 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3 text-3xl"
            style={{ background: cfg.bg }}>
            {cfg.icon}
          </div>
          <h1 className="font-serif text-xl mb-1">{cfg.headline}</h1>
          <p className="text-sm" style={{ color: 'rgba(28,15,8,0.5)' }}>{cfg.sub}</p>
        </div>

        <div className="grid grid-cols-3 border-t"
          style={{ borderColor: 'rgba(28,15,8,0.07)' }}>
          <div className="flex flex-col items-center py-3 border-r"
            style={{ borderColor: 'rgba(28,15,8,0.07)' }}>
            <span className="text-xs mb-0.5" style={{ color: 'rgba(28,15,8,0.35)' }}>Table</span>
            <span className="text-sm font-medium">{table}</span>
          </div>
          <div className="flex flex-col items-center py-3 border-r"
            style={{ borderColor: 'rgba(28,15,8,0.07)' }}>
            <span className="text-xs mb-0.5" style={{ color: 'rgba(28,15,8,0.35)' }}>Ref</span>
            <span className="text-sm font-medium">#{refOrder?.id.slice(-6).toUpperCase()}</span>
          </div>
          <div className="flex flex-col items-center py-3">
            <span className="text-xs mb-0.5" style={{ color: 'rgba(28,15,8,0.35)' }}>Est. time</span>
            <span className="text-sm font-medium">{fmtCountdown(secs)}</span>
          </div>
        </div>
      </div>

      {/* Order progress */}
      <div className="w-full max-w-sm bg-white rounded-2xl border p-5 mb-4"
        style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
        <p className="text-xs font-medium uppercase tracking-wider mb-4"
          style={{ color: 'rgba(28,15,8,0.35)' }}>Order progress</p>

        <div className="space-y-3">
          {STEPS.map((step, i) => {
            const active = step.activeOn.includes(status)
            return (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 transition-all"
                  style={{
                    background: active ? 'var(--espresso)' : 'rgba(28,15,8,0.07)',
                    color:      active ? '#fff'            : 'rgba(28,15,8,0.25)',
                  }}>
                  {active ? '✓' : String(i + 1)}
                </div>
                <span className="text-sm transition-all"
                  style={{
                    color:      active ? 'var(--espresso)' : 'rgba(28,15,8,0.3)',
                    fontWeight: active ? 500 : 400,
                  }}>
                  {step.text}
                </span>
                {step.activeOn[step.activeOn.length - 1] === status && (
                  <span className="ml-auto w-2 h-2 rounded-full animate-pulse"
                    style={{ background: cfg.color }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Combined order items — ALL orders for this table */}
      <div className="w-full max-w-sm bg-white rounded-2xl border p-5 mb-4"
        style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
        <p className="text-xs font-medium uppercase tracking-wider mb-4"
          style={{ color: 'rgba(28,15,8,0.35)' }}>Your order</p>

        {orders.length > 1 && (
          <p className="text-xs mb-3 px-2 py-1.5 rounded-lg"
            style={{ background: 'rgba(28,15,8,0.04)', color: 'rgba(28,15,8,0.45)' }}>
            {orders.length} rounds combined · all items shown below
          </p>
        )}

        <div className="space-y-2">
          {allItems.map((item, i) => {
            const unitPrice = resolveItemPrice(item)
            return (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="font-medium w-5 text-right shrink-0"
                  style={{ color: 'var(--latte)' }}>
                  {item.quantity}×
                </span>
                <div className="flex-1 min-w-0">
                  <p>{item.menuItem.name}</p>
                  {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(28,15,8,0.4)' }}>
                      {Object.values(item.selectedOptions).join(' · ')}
                    </p>
                  )}
                </div>
                <span className="text-xs shrink-0" style={{ color: 'rgba(28,15,8,0.5)' }}>
                  {formatPrice(unitPrice * item.quantity)}
                </span>
              </div>
            )
          })}
        </div>

        <div className="border-t mt-4 pt-3 flex justify-between text-sm font-medium"
          style={{ borderColor: 'rgba(28,15,8,0.07)' }}>
          <span>Total</span>
          <span>{formatPrice(combinedTotal)}</span>
        </div>
      </div>

      {/* Add more items — only visible while at least one order is still active */}
      {hasActiveOrders && (
        <button
          onClick={() => router.push(`/order?table=${table}&addOn=1`)}
          className="w-full max-w-sm py-3 rounded-2xl border text-sm font-medium mb-4"
          style={{
            borderColor: 'rgba(28,15,8,0.15)',
            color:       'var(--espresso)',
            background:  '#fff',
          }}>
          + Add more items
        </button>
      )}

      <p className="text-xs text-center" style={{ color: 'rgba(28,15,8,0.3)' }}>
        {isDone
          ? "Please pay at the counter once you're done. Enjoy your meal! 🍕"
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