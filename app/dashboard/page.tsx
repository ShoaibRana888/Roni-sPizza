/**
 * FILE: app/dashboard/page.tsx
 * PURPOSE: Main dashboard for Roni's Pizza staff.
 *          - Live order cards with 25-minute countdown progress bar
 *          - Supabase Realtime — new orders appear instantly
 *          - Status: new → preparing → done → (dismissed from dashboard)
 *          - "Clear table" hides the card from dashboard WITHOUT touching DB
 *            so the order stays 'done' in history (not 'cancelled')
 *          - Cleared IDs persist in localStorage with a 24-hour TTL so
 *            cleared orders don't reappear after a page refresh
 *          - Add-on orders (second order for same table) show a blue badge
 * ROUTE: /dashboard
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, Order, OrderStatus } from '@/lib/supabase'
import { formatPrice, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'

const ORDER_DURATION_MS  = 25 * 60 * 1000
const TABLE_RESET_MS     = 60 * 60 * 1000
const STORAGE_KEY        = 'ronis_table_count'
const CLEARED_KEY        = 'ronis_cleared_orders'
const CLEARED_TTL_MS     = 24 * 60 * 60 * 1000

function loadClearedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(CLEARED_KEY)
    if (!raw) return new Set()
    const map: Record<string, number> = JSON.parse(raw)
    const now = Date.now()
    const fresh: Record<string, number> = {}
    for (const [id, ts] of Object.entries(map)) {
      if (now - ts < CLEARED_TTL_MS) fresh[id] = ts
    }
    localStorage.setItem(CLEARED_KEY, JSON.stringify(fresh))
    return new Set(Object.keys(fresh))
  } catch {
    return new Set()
  }
}

function persistClearedId(id: string) {
  try {
    const raw = localStorage.getItem(CLEARED_KEY)
    const map: Record<string, number> = raw ? JSON.parse(raw) : {}
    map[id] = Date.now()
    localStorage.setItem(CLEARED_KEY, JSON.stringify(map))
  } catch {}
}

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

  const pendingUpdates = useRef<Set<string>>(new Set())
  const clearedIds     = useRef<Set<string>>(new Set())

  useEffect(() => {
    const load = () => {
      const saved = localStorage.getItem(STORAGE_KEY)
      const count = saved ? parseInt(saved) : 4
      setTables(Array.from({ length: count }, (_, i) => i + 1))
    }
    load()
    const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) load() }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => { clearedIds.current = loadClearedIds() }, [])

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const expired = orders.filter(
      (o) => o.status === 'done' &&
        Date.now() - new Date(o.created_at).getTime() > TABLE_RESET_MS,
    )
    if (expired.length > 0) {
      expired.forEach((o) => persistClearedId(o.id))
      setOrders((prev) => prev.filter((o) => !expired.find((e) => e.id === o.id)))
    }
  }, [tick, orders])

  useEffect(() => {
    supabase
      .from('orders')
      .select('*')
      .not('status', 'eq', 'cancelled')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          const visible = (data as Order[]).filter((o) => !clearedIds.current.has(o.id))
          setOrders(visible)
        }
        setLoading(false)
      })

    const channel = supabase
      .channel('dashboard-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const id = (payload.new as Order)?.id || (payload.old as Order)?.id
        if (id && pendingUpdates.current.has(id)) { pendingUpdates.current.delete(id); return }
        if (id && clearedIds.current.has(id)) return

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
            setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
          }
        }
        if (payload.eventType === 'DELETE') {
          setOrders((prev) => prev.filter((o) => o.id !== (payload.old as Order).id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const advance = async (id: string) => {
    const order = orders.find((o) => o.id === id)
    if (!order) return
    const next: OrderStatus = order.status === 'new' ? 'preparing' : 'done'
    pendingUpdates.current.add(id)
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: next, updated_at: new Date().toISOString() } : o)))
    const { error } = await supabase.from('orders').update({ status: next }).eq('id', id)
    if (error) {
      pendingUpdates.current.delete(id)
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: order.status } : o)))
    }
  }

  const clearTable = (id: string) => {
    clearedIds.current.add(id)
    persistClearedId(id)
    setOrders((prev) => prev.filter((o) => o.id !== id))
  }

  const filtered  = filter === 'all' ? orders : orders.filter((o) => o.status === filter)
  const newCount  = orders.filter((o) => o.status === 'new').length
  const prepCount = orders.filter((o) => o.status === 'preparing').length
  const doneCount = orders.filter((o) => o.status === 'done').length
  const revenue   = orders.reduce((s, o) => s + o.total, 0)
  const activeTables = new Set(
    orders.filter((o) => o.status === 'new' || o.status === 'preparing').map((o) => o.table_number),
  )

  const tableOrderCounts = orders
    .filter((o) => o.status === 'new' || o.status === 'preparing')
    .reduce<Record<string, number>>((acc, o) => {
      acc[o.table_number] = (acc[o.table_number] ?? 0) + 1
      return acc
    }, {})

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
          <span className="text-xs tabular-nums" style={{ color: 'rgba(28,15,8,0.3)' }}>
            {new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Orders today', value: orders.length },
            { label: 'In progress',  value: prepCount },
            { label: 'Ready',        value: doneCount },
            { label: 'Revenue',      value: formatPrice(revenue) },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border p-5"
              style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
              <p className="text-xs mb-1" style={{ color: 'rgba(28,15,8,0.4)' }}>{s.label}</p>
              <p className="text-2xl font-medium">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${tables.length}, 1fr)` }}>
          {tables.map((n) => {
            const occupied = activeTables.has(String(n))
            return (
              <div key={n} className="rounded-xl border py-3 text-center transition-all"
                style={{
                  borderColor: occupied ? 'rgba(28,15,8,0.15)' : 'rgba(28,15,8,0.06)',
                  background:  occupied ? 'rgba(28,15,8,0.04)' : '#fff',
                }}>
                <p className="text-xs mb-0.5" style={{ color: 'rgba(28,15,8,0.35)' }}>Table {n}</p>
                <p className="text-sm font-medium"
                  style={{ color: occupied ? 'var(--latte)' : 'rgba(28,15,8,0.35)' }}>
                  {occupied ? 'Occupied' : 'Free'}
                </p>
              </div>
            )
          })}
        </div>

        <div className="flex gap-2">
          {FILTER_TABS.map((tab) => (
            <button key={tab.value} onClick={() => setFilter(tab.value)}
              className="text-xs px-4 py-1.5 rounded-full border transition-all"
              style={{
                background:  filter === tab.value ? 'var(--espresso)' : '#fff',
                color:       filter === tab.value ? '#fff' : 'rgba(28,15,8,0.5)',
                borderColor: filter === tab.value ? 'var(--espresso)' : 'rgba(28,15,8,0.15)',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

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
            {filtered.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                tick={tick}
                onAdvance={advance}
                onClear={clearTable}
                isAddOn={
                  (tableOrderCounts[order.table_number] ?? 0) > 1 &&
                  order.status !== 'done'
                }
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function OrderCard({
  order, tick, onAdvance, onClear, isAddOn,
}: {
  order: Order
  tick: number
  onAdvance: (id: string) => void
  onClear: (id: string) => void
  isAddOn: boolean
}) {
  const secs    = secondsLeft(order.created_at)
  const pct     = Math.round((secs / (ORDER_DURATION_MS / 1000)) * 100)
  const overdue = secs === 0 && order.status !== 'done'

  return (
    <div className="bg-white rounded-xl border overflow-hidden"
      style={{ borderColor: overdue ? 'rgba(192,57,43,0.4)' : 'rgba(28,15,8,0.08)' }}>

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
          <p className="font-medium text-sm">
            #{order.id.slice(-4).toUpperCase()}
            {isAddOn && (
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full font-normal"
                style={{ background: '#DBEAFE', color: '#1D4ED8' }}>
                Add-on
              </span>
            )}
          </p>
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
