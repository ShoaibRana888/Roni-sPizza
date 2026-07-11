/**
 * FILE: app/dashboard/kitchen/page.tsx
 * PURPOSE: Kitchen display — live view of active orders.
 *
 * MOBILE  (<768px): Tabbed layout — QUEUED / COOKING switcher, full-width cards.
 * DESKTOP (≥768px): Two-column side-by-side layout (original design).
 *
 * Real-time via Supabase channel. Auto-refreshes elapsed timers every second.
 */

'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase, Order, OrderStatus, CartItem } from '@/lib/supabase'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function elapsed(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function urgencyLevel(iso: string): 'ok' | 'warn' | 'urgent' {
  const mins = (Date.now() - new Date(iso).getTime()) / 60000
  if (mins > 20) return 'urgent'
  if (mins > 10) return 'warn'
  return 'ok'
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function KitchenPage() {
  const [orders, setOrders]       = useState<Order[]>([])
  const [tick, setTick]           = useState(0)
  const [now, setNow]             = useState(new Date())
  const [mobileTab, setMobileTab] = useState<'new' | 'preparing'>('new')
  const pendingRef                = useRef<Set<string>>(new Set())

  // Tick every second for elapsed timers
  useEffect(() => {
    const t = setInterval(() => { setTick((n) => n + 1); setNow(new Date()) }, 1000)
    return () => clearInterval(t)
  }, [])

  // Load + realtime subscribe
  useEffect(() => {
    supabase
      .from('orders')
      .select('*')
      .in('status', ['new', 'preparing'])
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setOrders(data as Order[])
      })

    const channel = supabase
      .channel('kitchen-orders')
      .on('postgres_changes', { event: '*', schema: 'cafe_orders', table: 'orders' }, (payload) => {
        const id = (payload.new as Order)?.id || (payload.old as Order)?.id
        if (id && pendingRef.current.has(id)) { pendingRef.current.delete(id); return }

        if (payload.eventType === 'INSERT') {
          const o = payload.new as Order
          if (o.status === 'new' || o.status === 'preparing') {
            setOrders((prev) => [...prev.filter((x) => x.id !== o.id), o])
          }
        }
        if (payload.eventType === 'UPDATE') {
          const o = payload.new as Order
          if (o.status === 'done' || o.status === 'cancelled') {
            setOrders((prev) => prev.filter((x) => x.id !== o.id))
          } else {
            setOrders((prev) => prev.map((x) => x.id === o.id ? o : x))
          }
        }
        if (payload.eventType === 'DELETE') {
          setOrders((prev) => prev.filter((x) => x.id !== (payload.old as Order).id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const advance = async (id: string) => {
    const order = orders.find((o) => o.id === id)
    if (!order) return
    const next: OrderStatus = order.status === 'new' ? 'preparing' : 'done'
    pendingRef.current.add(id)
    if (next === 'done') {
      setOrders((prev) => prev.filter((o) => o.id !== id))
    } else {
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: next } : o))
      setMobileTab('preparing') // switch to cooking tab after starting
    }
    await supabase.from('orders').update({ status: next }).eq('id', id)
  }

  const newOrders  = orders.filter((o) => o.status === 'new')
  const prepOrders = orders.filter((o) => o.status === 'preparing')

  // ── SHARED header ──────────────────────────────────────────────────────────
  const header = (
    <header
      className="flex items-center justify-between px-4 md:px-8 py-3 md:py-4 flex-shrink-0"
      style={{ background: '#1a1a1a', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl md:text-2xl">🍳</span>
        <p className="text-white font-bold text-base md:text-xl">Kitchen Display</p>
      </div>
      <div className="flex items-center gap-4 md:gap-8">
        <div className="text-center">
          <p style={{ fontSize: 24, fontWeight: 800, color: '#FBBF24', lineHeight: 1 }}>
            {newOrders.length}
          </p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em' }}>
            QUEUED
          </p>
        </div>
        <div className="text-center">
          <p style={{ fontSize: 24, fontWeight: 800, color: '#34D399', lineHeight: 1 }}>
            {prepOrders.length}
          </p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em' }}>
            COOKING
          </p>
        </div>
        <p className="hidden md:block tabular-nums text-sm"
          style={{ color: 'rgba(255,255,255,0.3)' }}>
          {now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
      </div>
    </header>
  )

  // ── MOBILE layout (tabs) ───────────────────────────────────────────────────
  const mobileView = (
    <div className="flex flex-col flex-1 overflow-hidden md:hidden"
      style={{ background: '#111', color: '#fff' }}>
      {header}

      {/* Tab switcher */}
      <div className="flex flex-shrink-0"
        style={{ background: '#1a1a1a', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {([
          { key: 'new',       label: 'QUEUED',  count: newOrders.length,  accent: '#FBBF24' },
          { key: 'preparing', label: 'COOKING', count: prepOrders.length, accent: '#34D399' },
        ] as const).map((tab) => {
          const active = mobileTab === tab.key
          return (
            <button key={tab.key}
              onClick={() => setMobileTab(tab.key)}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold tracking-widest transition-all"
              style={{
                color:        active ? tab.accent : 'rgba(255,255,255,0.3)',
                borderBottom: active ? `2px solid ${tab.accent}` : '2px solid transparent',
                letterSpacing: '0.1em',
              }}>
              <span className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: active ? tab.accent : 'rgba(255,255,255,0.2)' }} />
              {tab.label}
              <span className="ml-1 text-xs font-semibold"
                style={{ color: active ? tab.accent : 'rgba(255,255,255,0.25)' }}>
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Cards — full width */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {(mobileTab === 'new' ? newOrders : prepOrders).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40"
            style={{ color: 'rgba(255,255,255,0.15)' }}>
            <p className="text-4xl mb-2">{mobileTab === 'new' ? '✓' : '🍕'}</p>
            <p className="text-sm">Nothing here</p>
          </div>
        ) : (
          (mobileTab === 'new' ? newOrders : prepOrders).map((order) => (
            <KitchenCard
              key={order.id}
              order={order}
              onAdvance={() => advance(order.id)}
              advanceLabel={mobileTab === 'new' ? '→ Start Cooking' : '✓ Mark Ready'}
              accent={mobileTab === 'new' ? '#FBBF24' : '#34D399'}
              tick={tick}
              compact
            />
          ))
        )}
      </div>
    </div>
  )

  // ── DESKTOP layout (two columns) ───────────────────────────────────────────
  const desktopView = (
    <div className="hidden md:flex flex-col flex-1 overflow-hidden"
      style={{ background: '#111', color: '#fff' }}>
      {header}

      <div className="flex flex-1 overflow-hidden">
        {/* QUEUED column */}
        <DesktopColumn
          label="QUEUED" accent="#FBBF24"
          orders={newOrders} tick={tick}
          onAdvance={advance} advanceLabel="→ Start Cooking"
        />
        <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
        {/* COOKING column */}
        <DesktopColumn
          label="COOKING" accent="#34D399"
          orders={prepOrders} tick={tick}
          onAdvance={advance} advanceLabel="✓ Mark Ready"
        />
      </div>

      {orders.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p style={{ fontSize: 64, marginBottom: 12 }}>🍕</p>
          <p style={{ fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.15)' }}>All clear</p>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {mobileView}
      {desktopView}
    </div>
  )
}

// ─── Desktop Column ───────────────────────────────────────────────────────────

function DesktopColumn({
  label, accent, orders, tick, onAdvance, advanceLabel,
}: {
  label: string
  accent: string
  orders: Order[]
  tick: number
  onAdvance: (id: string) => void
  advanceLabel: string
}) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-3 flex-shrink-0"
        style={{ borderBottom: `2px solid ${accent}22` }}>
        <span className="inline-block rounded-full w-2.5 h-2.5"
          style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: accent }}>
          {label}
        </span>
        <span className="ml-auto text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {orders.length} order{orders.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {orders.length === 0 ? (
          <div className="flex items-center justify-center h-32 rounded-2xl"
            style={{ border: '1px dashed rgba(255,255,255,0.08)' }}>
            <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: 14 }}>Nothing here</p>
          </div>
        ) : (
          orders.map((order) => (
            <KitchenCard key={order.id} order={order}
              onAdvance={() => onAdvance(order.id)}
              advanceLabel={advanceLabel} accent={accent} tick={tick} />
          ))
        )}
      </div>
    </div>
  )
}

// ─── KitchenCard ─────────────────────────────────────────────────────────────

function KitchenCard({
  order, onAdvance, advanceLabel, accent, tick, compact = false,
}: {
  order: Order
  onAdvance: () => void
  advanceLabel: string
  accent: string
  tick: number
  compact?: boolean
}) {
  const urgency = urgencyLevel(order.created_at)
  const elapsedStr = elapsed(order.created_at)

  const borderColor =
    urgency === 'urgent' ? '#EF4444' :
    urgency === 'warn'   ? '#F59E0B' :
    'rgba(255,255,255,0.08)'

  const elapsedColor =
    urgency === 'urgent' ? '#EF4444' :
    urgency === 'warn'   ? '#F59E0B' :
    'rgba(255,255,255,0.35)'

  const tableSize  = compact ? 22 : 28
  const nameSize   = compact ? 16 : 20
  const optSize    = compact ? 12 : 13
  const elapsedSz  = compact ? 18 : 22

  return (
    <div className="rounded-2xl p-4 md:p-5"
      style={{ background: '#1a1a1a', border: `1.5px solid ${borderColor}`, transition: 'border-color 0.3s' }}>

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p style={{ fontSize: tableSize, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>
            Table {order.table_number}
          </p>
          {order.customer_name && (
            <p style={{ fontSize: compact ? 13 : 16, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>
              {order.customer_name}
            </p>
          )}
        </div>
        <div className="text-right">
          <p style={{ fontSize: elapsedSz, fontWeight: 700, color: elapsedColor, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {elapsedStr}
          </p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 3, letterSpacing: '0.06em' }}>
            ago
          </p>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2 mb-4">
        {order.items.map((item: CartItem, i: number) => (
          <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            {/* Qty badge */}
            <span className="flex-shrink-0 flex items-center justify-center rounded-lg"
              style={{
                width: compact ? 30 : 36, height: compact ? 30 : 36,
                background: accent + '22', color: accent,
                fontSize: compact ? 16 : 20, fontWeight: 800,
              }}>
              {item.quantity}
            </span>
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: nameSize, fontWeight: 700, lineHeight: 1.2 }}>
                {item.menuItem.emoji} {item.menuItem.name}
              </p>
              {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                <p style={{ fontSize: optSize, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                  {Object.values(item.selectedOptions).join(' · ')}
                </p>
              )}
              {item.notes && (
                <p className="mt-1 px-2 py-0.5 rounded inline-block"
                  style={{ fontSize: optSize, color: '#FBBF24', background: 'rgba(251,191,36,0.1)' }}>
                  📝 {item.notes}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Order notes */}
      {order.notes && (
        <div className="mb-3 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <p style={{ fontSize: 13, color: '#FBBF24' }}>⚠️ {order.notes}</p>
        </div>
      )}

      {/* Advance button */}
      <button onClick={onAdvance}
        className="w-full rounded-xl py-2.5 text-center font-semibold transition-all active:scale-95"
        style={{ fontSize: 14, background: accent + '18', color: accent, border: `1px solid ${accent}33`, cursor: 'pointer' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = accent + '30' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = accent + '18' }}>
        {advanceLabel}
      </button>
    </div>
  )
}