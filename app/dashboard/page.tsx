/**
 * FILE: app/dashboard/page.tsx
 * PURPOSE: Main dashboard for Roni's Pizza staff.
 *          - Live order cards with 25-minute countdown progress bar
 *          - Supabase Realtime — new orders appear instantly
 *          - Status: new → preparing → done → cleared (cancelled)
 *          - "Clear table" button frees the table after food is collected
 *          - Realtime skips updates we just made (prevents revert bug)
 *          - Table strip reads from localStorage (synced with QR page)
 * ROUTE: /dashboard
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, Order, OrderStatus } from '@/lib/supabase'
import { formatPrice, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'

const ORDER_DURATION_MS = 25 * 60 * 1000
const TABLE_RESET_MS    = 60 * 60 * 1000
const STORAGE_KEY       = 'ronis_table_count'

function secondsLeft(createdAt: string): number {
  const elapsed = Date.now() - new Date(createdAt).getTime()
  return Math.max(0, Math.floor((ORDER_DURATION_MS - elapsed) / 1000))
}

function fmtCountdown(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function DashboardPage() {
  const [orders, setOrders]   = useState<Order[]>([])
  const [tick, setTick]       = useState(0)
  const [filter, setFilter]   = useState<OrderStatus | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [tables, setTables]   = useState<number[]>([])

  // Track IDs we just updated so Realtime doesn't revert our optimistic changes
  const pendingUpdates = useRef<Set<string>>(new Set())

  // Load tables from localStorage, keep in sync with QR page (cross-tab)
  useEffect(() => {
    const load = () => {
      const saved = localStorage.getItem(STORAGE_KEY)
      const count = saved ? parseInt(saved) : 4
      setTables(Array.from({ length: count }, (_, i) => i + 1))
    }
    load()

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) load()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Tick every second for countdown timers
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Auto-hide done orders older than 1 hour
  useEffect(() => {
    const expired = orders.filter(
      (o) =>
        o.status === 'done' &&
        Date.now() - new Date(o.created_at).getTime() > TABLE_RESET_MS
    )
    if (expired.length > 0) {
      setOrders((prev) => prev.filter((o) => !expired.find((e) => e.id === o.id)))
    }
  }, [tick, orders])

  // Supabase: initial load + Realtime subscription
  useEffect(() => {
    supabase
      .from('orders')
      .select('*')
      .not('status', 'eq', 'cancelled')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setOrders(data as Order[])
        setLoading(false)
      })

    const channel = supabase
      .channel('dashboard-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          const id = (payload.new as Order)?.id || (payload.old as Order)?.id

          // Skip if we triggered this update (prevents revert bug)
          if (id && pendingUpdates.current.has(id)) {
            pendingUpdates.current.delete(id)
            return
          }

          if (payload.eventType === 'INSERT') {
            const incoming = payload.new as Order
            if (incoming.status !== 'cancelled') {
              setOrders((prev) => [incoming, ...prev.filter((o) => o.id !== incoming.id)])
            }
          }
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Order
            if (updated.status === 'cancelled') {
              setOrders((prev) => prev.filter((o) => o.id !== updated.id))
            } else {
              setOrders((prev) =>
                prev.map((o) => (o.id === updated.id ? updated : o))
              )
            }
          }
          if (payload.eventType === 'DELETE') {
            setOrders((prev) => prev.filter((o) => o.id !== (payload.old as Order).id))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Advance: new → preparing → done
  const advance = async (id: string) => {
    const order = orders.find((o) => o.id === id)
    if (!order) return
    const next: OrderStatus = order.status === 'new' ? 'preparing' : 'done'

    pendingUpdates.current.add(id)
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: next, updated_at: new Date().toISOString() } : o))
    )

    const { error } = await supabase.from('orders').update({ status: next }).eq('id', id)
    if (error) {
      console.error('Failed to advance order:', error)
      pendingUpdates.current.delete(id)
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: order.status } : o)))
    }
  }

  // Clear table: marks as cancelled and removes from active view
  const clearTable = async (id: string) => {
    pendingUpdates.current.add(id)
    setOrders((prev) => prev.filter((o) => o.id !== id))

    const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', id)
    if (error) {
      console.error('Failed to clear table:', error)
      pendingUpdates.current.delete(id)
      const { data } = await supabase.from('orders').select('*').eq('id', id).single()
      if (data) setOrders((prev) => [data as Order, ...prev])
    }
  }

  const filtered     = filter === 'all' ? orders : orders.filter((o) => o.status === filter)
  const newCount     = orders.filter((o) => o.status === 'new').length
  const prepCount    = orders.filter((o) => o.status === 'preparing').length
  const doneCount    = orders.filter((o) => o.status === 'done').length
  const revenue      = orders.reduce((s, o) => s + o.total, 0)
  const activeTables = new Set(
    orders
      .filter((o) => o.status === 'new' || o.status === 'preparing')
      .map((o) => o.table_number)
  )

  const FILTER_TABS: { label: string; value: OrderStatus | 'all' }[] = [
    { label: 'All',       value: 'all' },
    { label: 'New',       value: 'new' },
    { label: 'Preparing', value: 'preparing' },
    { label: 'Ready',     value: 'done' },
  ]

  return (
    <>
      <header className="h-14 bg-white border-b flex items-center justify-between px-6 flex-shrink-0"
        style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
        <h1 className="text-base font-medium">Dashboard</h1>
        <div className="flex items-center gap-3">
          {newCount > 0 && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full animate-pulse"
              style={{ background: '#FEF3CD', color: '#92620A' }}>
              {newCount} new order{newCount !== 1 ? 's' : ''}
            </span>
          )}
          <span className="text-sm" style={{ color: 'rgba(28,15,8,0.35)' }}>
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Orders today', value: orders.length },
            { label: 'In progress',  value: prepCount },
            { label: 'Ready',        value: doneCount },
            { label: 'Revenue',      value: formatPrice(revenue) },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl p-4 border"
              style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
              <p className="text-xs mb-1.5" style={{ color: 'rgba(28,15,8,0.4)' }}>{s.label}</p>
              <p className="text-2xl font-medium">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Table status strip — dynamic, driven by localStorage */}
        {tables.length > 0 && (
          <div className="flex gap-3 mb-6 flex-wrap">
            {tables.map((t) => {
              const busy = activeTables.has(String(t))
              return (
                <div key={t} className="flex-1 min-w-[80px] rounded-xl border p-3 text-center"
                  style={{
                    borderColor: busy ? 'rgba(196,154,108,0.5)' : 'rgba(28,15,8,0.08)',
                    background:  busy ? 'rgba(196,154,108,0.08)' : '#fff',
                  }}>
                  <p className="text-xs mb-1" style={{ color: 'rgba(28,15,8,0.4)' }}>Table {t}</p>
                  <p className="text-xs font-medium" style={{ color: busy ? 'var(--latte)' : 'var(--sage)' }}>
                    {busy ? 'Occupied' : 'Free'}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {FILTER_TABS.map((tab) => (
            <button key={tab.value} onClick={() => setFilter(tab.value)}
              className="px-3 py-1.5 rounded-full text-xs border transition-all"
              style={{
                background:  filter === tab.value ? 'var(--espresso)' : '#fff',
                color:       filter === tab.value ? '#fff' : 'rgba(28,15,8,0.5)',
                borderColor: filter === tab.value ? 'var(--espresso)' : 'rgba(28,15,8,0.15)',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders grid */}
        {loading ? (
          <div className="text-center py-24" style={{ color: 'rgba(28,15,8,0.25)' }}>
            <p className="text-sm">Loading orders…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24" style={{ color: 'rgba(28,15,8,0.25)' }}>
            <p className="text-4xl mb-3">🍕</p>
            <p className="text-sm">No orders yet — waiting for customers</p>
          </div>
        ) : (
          <div className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {filtered.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                tick={tick}
                onAdvance={advance}
                onClear={clearTable}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ── Order Card ────────────────────────────────────────────────────────────────
function OrderCard({
  order, tick, onAdvance, onClear,
}: {
  order: Order
  tick: number
  onAdvance: (id: string) => void
  onClear: (id: string) => void
}) {
  const secs    = secondsLeft(order.created_at)
  const pct     = Math.round((secs / (ORDER_DURATION_MS / 1000)) * 100)
  const overdue = secs === 0 && order.status !== 'done'

  return (
    <div className="bg-white rounded-xl border overflow-hidden"
      style={{ borderColor: overdue ? 'rgba(192,57,43,0.4)' : 'rgba(28,15,8,0.08)' }}>

      {/* Countdown progress bar — drains over 25 minutes */}
      {order.status !== 'done' && (
        <div className="h-1 w-full" style={{ background: 'rgba(28,15,8,0.06)' }}>
          <div className="h-full transition-all duration-1000"
            style={{
              width: `${pct}%`,
              background: overdue ? '#C0392B' : pct > 40 ? 'var(--sage)' : 'var(--latte)',
            }} />
        </div>
      )}

      {/* Card header */}
      <div className="px-4 py-3 flex justify-between items-start border-b"
        style={{ borderColor: 'rgba(28,15,8,0.06)' }}>
        <div>
          <p className="font-medium text-sm">#{order.id.slice(-4).toUpperCase()}</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(28,15,8,0.4)' }}>
            Table {order.table_number}
            {order.customer_name ? ` · ${order.customer_name}` : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[order.status]}`}>
            {STATUS_LABELS[order.status]}
          </span>
          {order.status !== 'done' && (
            <span className="text-xs font-mono tabular-nums"
              style={{ color: overdue ? '#C0392B' : 'rgba(28,15,8,0.4)' }}>
              {overdue ? 'Overdue' : fmtCountdown(secs)}
            </span>
          )}
        </div>
      </div>

      {/* Items list */}
      <div className="px-4 py-3 space-y-1.5 border-b" style={{ borderColor: 'rgba(28,15,8,0.06)' }}>
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span style={{ color: 'rgba(28,15,8,0.7)' }}>
              {item.quantity}× {item.menuItem.name}
            </span>
            <span style={{ color: 'rgba(28,15,8,0.4)' }}>
              {formatPrice(item.menuItem.price * item.quantity)}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium">{formatPrice(order.total)}</span>
        <div className="flex gap-2">
          {order.status !== 'done' ? (
            <button onClick={() => onAdvance(order.id)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-white"
              style={{ background: order.status === 'new' ? 'var(--latte)' : 'var(--sage)' }}>
              {order.status === 'new' ? 'Start preparing' : 'Mark ready'}
            </button>
          ) : (
            <button onClick={() => onClear(order.id)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border"
              style={{ borderColor: 'rgba(28,15,8,0.15)', color: 'rgba(28,15,8,0.5)' }}>
              Clear table
            </button>
          )}
        </div>
      </div>
    </div>
  )
}