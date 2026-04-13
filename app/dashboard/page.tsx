/**
 * FILE: app/dashboard/page.tsx
 * PURPOSE: Main dashboard for Roni's Pizza staff.
 *          - Shows live order cards (new / preparing / ready)
 *          - Each card has a 25-minute countdown timer
 *          - Staff click "Start prep" → "Mark ready" to advance order status
 *          - Table status strip shows which of the 4 tables are occupied
 *          - Orders auto-expire and tables reset after 1 hour
 *          - Subscribes to Supabase Realtime for live updates
 * ROUTE: /dashboard
 */

'use client'

import { useState, useEffect } from 'react'
import { supabase, Order, OrderStatus } from '@/lib/supabase'
import { formatPrice, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'

const ORDER_DURATION_MS = 25 * 60 * 1000   // 25-minute prep countdown
const TABLE_RESET_MS    = 60 * 60 * 1000   // tables auto-clear after 1 hour
const TABLES            = [1, 2, 3, 4]

function secondsLeft(createdAt: string, durationMs: number): number {
  const elapsed = Date.now() - new Date(createdAt).getTime()
  return Math.max(0, Math.floor((durationMs - elapsed) / 1000))
}

function fmtCountdown(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [tick, setTick]     = useState(0)
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all')
  const [loading, setLoading] = useState(true)

  // Tick every second to keep countdowns live
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Auto-remove orders older than TABLE_RESET_MS (1 hour), freeing the table
  useEffect(() => {
    const expired = orders.filter(
      (o) => Date.now() - new Date(o.created_at).getTime() > TABLE_RESET_MS
    )
    if (expired.length > 0) {
      setOrders((prev) => prev.filter((o) => !expired.find((e) => e.id === o.id)))
    }
  }, [tick, orders])

  // ── Supabase: initial fetch + Realtime subscription ─────────────────────────
  useEffect(() => {
    // 1. Load existing active orders on mount
    supabase
      .from('orders')
      .select('*')
      .in('status', ['new', 'preparing', 'done'])
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setOrders(data as Order[])
        setLoading(false)
      })

    // 2. Subscribe to all order changes in real time
    const channel = supabase
      .channel('dashboard-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setOrders((prev) => [payload.new as Order, ...prev])
          }
          if (payload.eventType === 'UPDATE') {
            setOrders((prev) =>
              prev.map((o) => (o.id === payload.new.id ? (payload.new as Order) : o))
            )
          }
          if (payload.eventType === 'DELETE') {
            setOrders((prev) => prev.filter((o) => o.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // ── Advance order status (new → preparing → done) ───────────────────────────
  const advance = async (id: string) => {
    const order = orders.find((o) => o.id === id)
    if (!order) return
    const next: OrderStatus = order.status === 'new' ? 'preparing' : 'done'

    // Optimistic update
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, status: next, updated_at: new Date().toISOString() } : o
      )
    )

    // Persist to Supabase
    const { error } = await supabase
      .from('orders')
      .update({ status: next })
      .eq('id', id)

    if (error) {
      console.error('Failed to update order:', error)
      // Revert optimistic update on failure
      setOrders((prev) =>
        prev.map((o) =>
          o.id === id ? { ...o, status: order.status } : o
        )
      )
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
      {/* Top bar */}
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
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'New',       value: newCount,              color: '#92620A', bg: '#FEF3CD' },
            { label: 'Preparing', value: prepCount,             color: '#1d4ed8', bg: '#dbeafe' },
            { label: 'Done',      value: doneCount,             color: '#166534', bg: '#dcfce7' },
            { label: 'Revenue',   value: formatPrice(revenue),  color: 'var(--espresso)', bg: 'var(--latte-light)' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border p-4"
              style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
              <p className="text-xs mb-1" style={{ color: 'rgba(28,15,8,0.4)' }}>{s.label}</p>
              <p className="text-2xl font-serif" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Table status */}
        <div className="bg-white rounded-xl border p-4 mb-6 flex gap-3"
          style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
          {TABLES.map((n) => {
            const occupied = activeTables.has(String(n))
            return (
              <div key={n} className="flex-1 rounded-lg p-3 text-center text-sm font-medium transition-all"
                style={{
                  background: occupied ? 'var(--espresso)' : 'var(--cream)',
                  color:      occupied ? '#fff' : 'rgba(28,15,8,0.3)',
                }}>
                Table {n}
                <p className="text-xs font-normal mt-0.5" style={{ opacity: 0.7 }}>
                  {occupied ? 'Occupied' : 'Free'}
                </p>
              </div>
            )
          })}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {FILTER_TABS.map((tab) => (
            <button key={tab.value}
              onClick={() => setFilter(tab.value)}
              className="text-xs font-medium px-4 py-1.5 rounded-full border transition-all"
              style={{
                borderColor: filter === tab.value ? 'var(--espresso)' : 'rgba(28,15,8,0.12)',
                background:  filter === tab.value ? 'var(--espresso)' : '#fff',
                color:       filter === tab.value ? '#fff' : 'rgba(28,15,8,0.5)',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders */}
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
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {filtered.map((order) => {
              const secs    = secondsLeft(order.created_at, ORDER_DURATION_MS)
              const urgent  = secs < 5 * 60 && order.status !== 'done'
              return (
                <div key={order.id}
                  className="bg-white rounded-2xl border p-5 flex flex-col gap-3"
                  style={{
                    borderColor: urgent ? '#f97316' : 'rgba(28,15,8,0.08)',
                    boxShadow:   urgent ? '0 0 0 2px #fed7aa' : 'none',
                  }}>

                  {/* Card header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">Table {order.table_number}</p>
                      {order.customer_name && (
                        <p className="text-xs mt-0.5" style={{ color: 'rgba(28,15,8,0.4)' }}>
                          {order.customer_name}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </div>

                  {/* Items */}
                  <ul className="text-sm space-y-1" style={{ color: 'rgba(28,15,8,0.7)' }}>
                    {order.items.map((item, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span>{item.quantity}× {item.menuItem.name}</span>
                        <span style={{ color: 'rgba(28,15,8,0.4)' }}>{formatPrice(item.quantity * item.menuItem.price)}</span>
                      </li>
                    ))}
                  </ul>

                  {order.notes && (
                    <p className="text-xs italic px-3 py-2 rounded-lg"
                      style={{ background: 'var(--cream)', color: 'rgba(28,15,8,0.5)' }}>
                      "{order.notes}"
                    </p>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-1 border-t"
                    style={{ borderColor: 'rgba(28,15,8,0.06)' }}>
                    <p className="font-medium text-sm">{formatPrice(order.total)}</p>
                    {order.status !== 'done' && order.status !== 'cancelled' && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono tabular-nums"
                          style={{ color: urgent ? '#f97316' : 'rgba(28,15,8,0.35)' }}>
                          {fmtCountdown(secs)}
                        </span>
                        <button onClick={() => advance(order.id)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg text-white transition-all"
                          style={{ background: order.status === 'new' ? 'var(--espresso)' : 'var(--sage)' }}>
                          {order.status === 'new' ? 'Start prep' : 'Mark ready'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}