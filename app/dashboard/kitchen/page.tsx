/**
 * FILE: app/dashboard/kitchen/page.tsx
 * PURPOSE: Kitchen display — large-format view of active orders (new + preparing).
 *          Designed to be readable from across the kitchen.
 *          Real-time via Supabase channel. Auto-refreshes.
 * ROUTE: /dashboard/kitchen
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

const STATUS_BG: Record<OrderStatus, string> = {
  new:       '#FEF3CD',
  preparing: '#D1FAE5',
  done:      '#E0E7FF',
  cancelled: '#F3F4F6',
}

const STATUS_ACCENT: Record<OrderStatus, string> = {
  new:       '#92620A',
  preparing: '#065F46',
  done:      '#3730A3',
  cancelled: '#6B7280',
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  new:       'NEW',
  preparing: 'PREPARING',
  done:      'READY',
  cancelled: 'CANCELLED',
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [tick, setTick]     = useState(0)
  const [now, setNow]       = useState(new Date())
  const pendingRef          = useRef<Set<string>>(new Set())

  // Tick every second for elapsed time display
  useEffect(() => {
    const t = setInterval(() => {
      setTick((n) => n + 1)
      setNow(new Date())
    }, 1000)
    return () => clearInterval(t)
  }, [])

  // Load + subscribe
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
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
        },
      )
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
    }
    await supabase.from('orders').update({ status: next }).eq('id', id)
  }

  const newOrders  = orders.filter((o) => o.status === 'new')
  const prepOrders = orders.filter((o) => o.status === 'preparing')

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: '#111', color: '#fff', fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Top bar */}
      <header
        className="flex items-center justify-between px-8 py-4 flex-shrink-0"
        style={{ background: '#1a1a1a', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-4">
          <span style={{ fontSize: 28 }}>🍳</span>
          <div>
            <p style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Kitchen Display</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
              Live — updates in real time
            </p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="text-center">
            <p style={{ fontSize: 36, fontWeight: 800, color: '#FBBF24', lineHeight: 1 }}>{newOrders.length}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Queued</p>
          </div>
          <div className="text-center">
            <p style={{ fontSize: 36, fontWeight: 800, color: '#34D399', lineHeight: 1 }}>{prepOrders.length}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Cooking</p>
          </div>
          <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.3)', fontVariantNumeric: 'tabular-nums' }}>
            {now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      </header>

      {/* Two-column board */}
      <div className="flex flex-1 overflow-hidden gap-0">
        {/* NEW column */}
        <Column
          label="QUEUED"
          accent="#FBBF24"
          orders={newOrders}
          onAdvance={advance}
          advanceLabel="→ Start Cooking"
          tick={tick}
        />

        {/* Divider */}
        <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />

        {/* PREPARING column */}
        <Column
          label="COOKING"
          accent="#34D399"
          orders={prepOrders}
          onAdvance={advance}
          advanceLabel="✓ Mark Ready"
          tick={tick}
        />
      </div>

      {/* Empty state */}
      {orders.length === 0 && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ pointerEvents: 'none' }}
        >
          <p style={{ fontSize: 72, marginBottom: 16 }}>🍕</p>
          <p style={{ fontSize: 32, fontWeight: 700, color: 'rgba(255,255,255,0.2)' }}>All clear</p>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.1)', marginTop: 8 }}>No active orders</p>
        </div>
      )}
    </div>
  )
}

// ─── Column ──────────────────────────────────────────────────────────────────

function Column({
  label,
  accent,
  orders,
  onAdvance,
  advanceLabel,
  tick,
}: {
  label: string
  accent: string
  orders: Order[]
  onAdvance: (id: string) => void
  advanceLabel: string
  tick: number
}) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Column header */}
      <div
        className="flex items-center gap-3 px-6 py-3 flex-shrink-0"
        style={{ borderBottom: `2px solid ${accent}22` }}
      >
        <span
          className="inline-block rounded-full"
          style={{ width: 10, height: 10, background: accent, boxShadow: `0 0 8px ${accent}` }}
        />
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: accent,
          }}
        >
          {label}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 13,
            color: 'rgba(255,255,255,0.25)',
          }}
        >
          {orders.length} order{orders.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {orders.length === 0 ? (
          <div
            className="flex items-center justify-center h-32 rounded-2xl"
            style={{ border: '1px dashed rgba(255,255,255,0.08)' }}
          >
            <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: 14 }}>Nothing here</p>
          </div>
        ) : (
          orders.map((order) => (
            <KitchenCard
              key={order.id}
              order={order}
              onAdvance={() => onAdvance(order.id)}
              advanceLabel={advanceLabel}
              accent={accent}
              tick={tick}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── KitchenCard ─────────────────────────────────────────────────────────────

function KitchenCard({
  order,
  onAdvance,
  advanceLabel,
  accent,
  tick,
}: {
  order: Order
  onAdvance: () => void
  advanceLabel: string
  accent: string
  tick: number
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
    'rgba(255,255,255,0.3)'

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: '#1a1a1a',
        border: `1.5px solid ${borderColor}`,
        transition: 'border-color 0.3s',
      }}
    >
      {/* Card header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>
            Table {order.table_number}
          </p>
          {order.customer_name && (
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
              {order.customer_name}
            </p>
          )}
        </div>

        <div className="text-right">
          <p
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: elapsedColor,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {elapsedStr}
          </p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 4, letterSpacing: '0.06em' }}>
            ago
          </p>
        </div>
      </div>

      {/* Items list */}
      <div className="space-y-2 mb-5">
        {order.items.map((item: CartItem, i: number) => (
          <div
            key={i}
            className="flex items-baseline gap-3 rounded-xl px-4 py-3"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            {/* Quantity badge */}
            <span
              className="flex-shrink-0 flex items-center justify-center rounded-lg"
              style={{
                width: 36,
                height: 36,
                background: accent + '22',
                color: accent,
                fontSize: 20,
                fontWeight: 800,
                lineHeight: 1,
              }}
            >
              {item.quantity}
            </span>

            <div className="flex-1 min-w-0">
              <p style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>
                {item.menuItem.emoji} {item.menuItem.name}
              </p>

              {/* Selected options */}
              {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>
                  {Object.values(item.selectedOptions).join(' · ')}
                </p>
              )}

              {/* Notes */}
              {item.notes && (
                <p
                  className="mt-1 px-2 py-0.5 rounded inline-block"
                  style={{
                    fontSize: 13,
                    color: '#FBBF24',
                    background: 'rgba(251,191,36,0.1)',
                  }}
                >
                  📝 {item.notes}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Order-level notes */}
      {order.notes && (
        <div
          className="mb-4 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}
        >
          <p style={{ fontSize: 14, color: '#FBBF24' }}>⚠️ {order.notes}</p>
        </div>
      )}

      {/* Advance button */}
      <button
        onClick={onAdvance}
        className="w-full rounded-xl py-3 text-center font-semibold transition-all active:scale-95"
        style={{
          fontSize: 15,
          background: accent + '18',
          color: accent,
          border: `1px solid ${accent}33`,
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = accent + '30'
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = accent + '18'
        }}
      >
        {advanceLabel}
      </button>
    </div>
  )
}