/**
 * FILE: app/dashboard/page.tsx
 * PURPOSE: Main dashboard for Roni's Pizza staff.
 *          - Shows live order cards (new / preparing / ready)
 *          - Each card has a 25-minute countdown timer
 *          - Staff click "Start prep" → "Mark ready" to advance order status
 *          - Table status strip shows which of the 4 tables are occupied
 *          - Orders auto-expire and tables reset after 1 hour
 *          - Dashboard starts empty — no fake orders shown
 * ROUTE: /dashboard
 */

'use client'

import { useState, useEffect } from 'react'
import { Order, OrderStatus } from '@/lib/supabase'
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

  // TODO: Replace local state with Supabase Realtime subscription:
  // useEffect(() => {
  //   supabase.from('orders').select('*').order('created_at', { ascending: false })
  //     .then(({ data }) => setOrders(data || []))
  //   const ch = supabase.channel('orders')
  //     .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (p) => {
  //       if (p.eventType === 'INSERT') setOrders((prev) => [p.new as Order, ...prev])
  //       if (p.eventType === 'UPDATE') setOrders((prev) => prev.map((o) => o.id === p.new.id ? p.new as Order : o))
  //       if (p.eventType === 'DELETE') setOrders((prev) => prev.filter((o) => o.id !== p.old.id))
  //     }).subscribe()
  //   return () => { supabase.removeChannel(ch) }
  // }, [])

  const advance = (id: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o
        const next: OrderStatus = o.status === 'new' ? 'preparing' : 'done'
        return { ...o, status: next, updated_at: new Date().toISOString() }
      })
    )
    // TODO: supabase.from('orders').update({ status: next }).eq('id', id)
  }

  const filtered    = filter === 'all' ? orders : orders.filter((o) => o.status === filter)
  const newCount    = orders.filter((o) => o.status === 'new').length
  const prepCount   = orders.filter((o) => o.status === 'preparing').length
  const doneCount   = orders.filter((o) => o.status === 'done').length
  const revenue     = orders.reduce((s, o) => s + o.total, 0)
  const activeTables = new Set(
    orders.filter((o) => o.status === 'new' || o.status === 'preparing').map((o) => o.table_number)
  )

  const FILTER_TABS: { label: string; value: OrderStatus | 'all' }[] = [
    { label: 'All', value: 'all' },
    { label: 'New', value: 'new' },
    { label: 'Preparing', value: 'preparing' },
    { label: 'Ready', value: 'done' },
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

        {/* Table status strip (4 tables) */}
        <div className="flex gap-3 mb-6">
          {TABLES.map((t) => {
            const busy = activeTables.has(String(t))
            return (
              <div key={t} className="flex-1 rounded-xl border p-3 text-center"
                style={{
                  borderColor: busy ? 'rgba(196,154,108,0.5)' : 'rgba(28,15,8,0.08)',
                  background: busy ? 'rgba(196,154,108,0.08)' : '#fff',
                }}>
                <p className="text-xs mb-1" style={{ color: 'rgba(28,15,8,0.4)' }}>Table {t}</p>
                <p className="text-xs font-medium" style={{ color: busy ? 'var(--latte)' : 'var(--sage)' }}>
                  {busy ? 'Occupied' : 'Free'}
                </p>
              </div>
            )
          })}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {FILTER_TABS.map((tab) => (
            <button key={tab.value} onClick={() => setFilter(tab.value)}
              className="px-3 py-1.5 rounded-full text-xs border transition-all"
              style={{
                background: filter === tab.value ? 'var(--espresso)' : '#fff',
                color: filter === tab.value ? '#fff' : 'rgba(28,15,8,0.5)',
                borderColor: filter === tab.value ? 'var(--espresso)' : 'rgba(28,15,8,0.15)',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders grid — empty state when no orders */}
        {filtered.length === 0 ? (
          <div className="text-center py-24" style={{ color: 'rgba(28,15,8,0.25)' }}>
            <p className="text-4xl mb-3">🍕</p>
            <p className="text-sm">No orders yet — waiting for customers</p>
          </div>
        ) : (
          <div className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {filtered.map((order) => (
              <OrderCard key={order.id} order={order} tick={tick} onAdvance={advance} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Order Card ───────────────────────────────────────────────────────────────
function OrderCard({ order, tick, onAdvance }: {
  order: Order; tick: number; onAdvance: (id: string) => void
}) {
  const secs    = secondsLeft(order.created_at, ORDER_DURATION_MS)
  const pct     = Math.round((secs / (ORDER_DURATION_MS / 1000)) * 100)
  const overdue = secs === 0 && order.status !== 'done'

  return (
    <div className="bg-white rounded-xl border overflow-hidden animate-fade-up"
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

      <div className="px-4 py-3 flex justify-between items-start border-b"
        style={{ borderColor: 'rgba(28,15,8,0.06)' }}>
        <div>
          <p className="font-medium text-sm">#{order.id.slice(-4).toUpperCase()}</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(28,15,8,0.4)' }}>Table {order.table_number}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[order.status]}`}>
            {STATUS_LABELS[order.status]}
          </span>
          {order.status !== 'done' && (
            <span className="text-xs font-mono"
              style={{ color: overdue ? '#C0392B' : 'rgba(28,15,8,0.4)' }}>
              {overdue ? 'Overdue' : fmtCountdown(secs)}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 py-3">
        {order.items.map((item, i) => (
          <div key={i} className="flex text-sm py-1" style={{ color: 'rgba(28,15,8,0.7)' }}>
            <span className="font-medium mr-1.5" style={{ color: 'var(--latte)' }}>{item.quantity}×</span>
            <span className="flex-1">{item.menuItem.name}</span>
            {item.selectedOptions && Object.values(item.selectedOptions).length > 0 && (
              <span className="text-xs ml-2" style={{ color: 'rgba(28,15,8,0.35)' }}>
                {Object.values(item.selectedOptions).join(', ')}
              </span>
            )}
          </div>
        ))}
        {order.notes && (
          <p className="text-xs mt-1.5 italic" style={{ color: 'rgba(28,15,8,0.4)' }}>
            Note: {order.notes}
          </p>
        )}
      </div>

      <div className="px-4 py-3 border-t flex items-center gap-2"
        style={{ borderColor: 'rgba(28,15,8,0.06)' }}>
        <span className="flex-1 text-xs" style={{ color: 'rgba(28,15,8,0.4)' }}>{formatPrice(order.total)}</span>
        {order.status === 'new' && (
          <button onClick={() => onAdvance(order.id)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg text-white"
            style={{ background: 'var(--espresso)' }}>Start prep</button>
        )}
        {order.status === 'preparing' && (
          <button onClick={() => onAdvance(order.id)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg text-white"
            style={{ background: 'var(--sage)' }}>Mark ready</button>
        )}
        {order.status === 'done' && (
          <span className="text-xs font-medium" style={{ color: 'var(--sage)' }}>✓ Ready to collect</span>
        )}
      </div>
    </div>
  )
}