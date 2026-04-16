/**
 * FILE: app/dashboard/history/page.tsx
 * PURPOSE: Historical order browser with date picker, weekly/monthly summaries,
 *          and per-item breakdown. All data from Supabase.
 * ROUTE: /dashboard/history
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, Order } from '@/lib/supabase'
import { formatPrice, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'

type Period = 'day' | 'week' | 'month' | 'custom'

function startOf(period: 'week' | 'month', ref: Date): Date {
  const d = new Date(ref)
  if (period === 'week') {
    d.setDate(d.getDate() - d.getDay())  // Sunday
    d.setHours(0, 0, 0, 0)
  } else {
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
  }
  return d
}

function endOf(period: 'week' | 'month', ref: Date): Date {
  const d = new Date(ref)
  if (period === 'week') {
    d.setDate(d.getDate() + (6 - d.getDay()))
    d.setHours(23, 59, 59, 999)
  } else {
    d.setMonth(d.getMonth() + 1, 0)
    d.setHours(23, 59, 59, 999)
  }
  return d
}

function fmt(d: Date) {
  return d.toISOString().split('T')[0]
}

function fmtDisplay(iso: string) {
  return new Date(iso).toLocaleString('en-PK', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default function HistoryPage() {
  const today = fmt(new Date())

  const [period, setPeriod] = useState<Period>('day')
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo]     = useState(today)
  const [orders, setOrders]     = useState<Order[]>([])
  const [loading, setLoading]   = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Apply preset periods
  const applyPeriod = (p: Period) => {
    setPeriod(p)
    const now = new Date()
    if (p === 'day')   { setDateFrom(today); setDateTo(today) }
    if (p === 'week')  { setDateFrom(fmt(startOf('week',  now))); setDateTo(fmt(endOf('week',  now))) }
    if (p === 'month') { setDateFrom(fmt(startOf('month', now))); setDateTo(fmt(endOf('month', now))) }
  }

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const from = new Date(dateFrom)
    from.setHours(0, 0, 0, 0)
    const to = new Date(dateTo)
    to.setHours(23, 59, 59, 999)

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())
      .order('created_at', { ascending: false })

    if (!error && data) setOrders(data as Order[])
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // Summary stats
  const completed  = orders.filter((o) => o.status === 'done')
  const revenue    = completed.reduce((s, o) => s + o.total, 0)
  const cancelled  = orders.filter((o) => o.status === 'cancelled').length
  const avgOrder   = completed.length ? Math.round(revenue / completed.length) : 0

  // Top items
  const itemCounts: Record<string, { name: string; qty: number; revenue: number }> = {}
  completed.forEach((order) => {
    order.items.forEach((item) => {
      const key = item.menuItem.name
      if (!itemCounts[key]) itemCounts[key] = { name: key, qty: 0, revenue: 0 }
      itemCounts[key].qty     += item.quantity
      itemCounts[key].revenue += item.quantity * item.menuItem.price
    })
  })
  const topItems = Object.values(itemCounts).sort((a, b) => b.qty - a.qty).slice(0, 5)

  return (
    <>
      <header className="h-14 bg-white border-b flex items-center px-6 flex-shrink-0"
        style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
        <h1 className="text-base font-medium">Order History</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Period selector */}
        <div className="bg-white rounded-xl border p-4" style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
          <div className="flex gap-2 mb-4">
            {(['day', 'week', 'month', 'custom'] as Period[]).map((p) => (
              <button key={p} onClick={() => applyPeriod(p)}
                className="px-3 py-1.5 rounded-full text-xs border capitalize transition-all"
                style={{
                  background:  period === p ? 'var(--espresso)' : '#fff',
                  color:       period === p ? '#fff' : 'rgba(28,15,8,0.5)',
                  borderColor: period === p ? 'var(--espresso)' : 'rgba(28,15,8,0.15)',
                }}>
                {p === 'day' ? 'Today' : p}
              </button>
            ))}
          </div>

          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <label className="text-xs font-medium mb-1 block" style={{ color: 'rgba(28,15,8,0.45)' }}>From</label>
              <input type="date" value={dateFrom} max={today}
                onChange={(e) => { setDateFrom(e.target.value); setPeriod('custom') }}
                className="w-full text-sm border rounded-xl px-3 py-2 outline-none"
                style={{ borderColor: 'rgba(28,15,8,0.15)' }} />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium mb-1 block" style={{ color: 'rgba(28,15,8,0.45)' }}>To</label>
              <input type="date" value={dateTo} max={today}
                onChange={(e) => { setDateTo(e.target.value); setPeriod('custom') }}
                className="w-full text-sm border rounded-xl px-3 py-2 outline-none"
                style={{ borderColor: 'rgba(28,15,8,0.15)' }} />
            </div>
            <button onClick={fetchOrders}
              className="mt-5 px-4 py-2 rounded-xl text-white text-sm font-medium shrink-0"
              style={{ background: 'var(--espresso)' }}>
              Search
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total orders',   value: orders.length },
            { label: 'Completed',      value: completed.length },
            { label: 'Cancelled',      value: cancelled },
            { label: 'Revenue',        value: formatPrice(revenue) },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border p-4"
              style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
              <p className="text-xs mb-1" style={{ color: 'rgba(28,15,8,0.4)' }}>{s.label}</p>
              <p className="text-xl font-medium">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Two-col: top items + avg */}
        {completed.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {/* Top selling items */}
            <div className="bg-white rounded-xl border p-4" style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
              <p className="text-xs font-medium uppercase tracking-widest mb-3"
                style={{ color: 'rgba(28,15,8,0.35)' }}>Top items</p>
              {topItems.map((item, i) => (
                <div key={item.name} className="flex items-center gap-2 py-1.5 border-b last:border-0"
                  style={{ borderColor: 'rgba(28,15,8,0.05)' }}>
                  <span className="text-xs w-4 text-center font-medium"
                    style={{ color: 'rgba(28,15,8,0.3)' }}>{i + 1}</span>
                  <span className="flex-1 text-sm">{item.name}</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--latte)' }}>×{item.qty}</span>
                  <span className="text-xs" style={{ color: 'rgba(28,15,8,0.4)' }}>{formatPrice(item.revenue)}</span>
                </div>
              ))}
            </div>

            {/* Quick stats */}
            <div className="bg-white rounded-xl border p-4" style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
              <p className="text-xs font-medium uppercase tracking-widest mb-3"
                style={{ color: 'rgba(28,15,8,0.35)' }}>Summary</p>
              {[
                { label: 'Avg order value', value: formatPrice(avgOrder) },
                { label: 'Completion rate', value: orders.length ? `${Math.round(completed.length / orders.length * 100)}%` : '—' },
                { label: 'Revenue (completed)', value: formatPrice(revenue) },
              ].map((s) => (
                <div key={s.label} className="flex justify-between py-2 border-b last:border-0 text-sm"
                  style={{ borderColor: 'rgba(28,15,8,0.05)' }}>
                  <span style={{ color: 'rgba(28,15,8,0.5)' }}>{s.label}</span>
                  <span className="font-medium">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Order list */}
        <div>
          <p className="text-xs font-medium uppercase tracking-widest mb-3"
            style={{ color: 'rgba(28,15,8,0.35)' }}>
            Orders ({orders.length})
          </p>

          {loading ? (
            <p className="text-center py-12 text-sm" style={{ color: 'rgba(28,15,8,0.3)' }}>Loading…</p>
          ) : orders.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'rgba(28,15,8,0.25)' }}>
              <p className="text-3xl mb-2">📋</p>
              <p className="text-sm">No orders in this period</p>
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <div key={order.id} className="bg-white rounded-xl border overflow-hidden"
                  style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
                  {/* Row */}
                  <button
                    onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                    className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-[--cream] transition-all">
                    <span className="text-xs font-mono font-medium w-20">
                      #{order.id.slice(-6).toUpperCase()}
                    </span>
                    <span className="text-sm w-20">Table {order.table_number}</span>
                    <span className="text-xs flex-1" style={{ color: 'rgba(28,15,8,0.5)' }}>
                      {fmtDisplay(order.created_at)}
                    </span>
                    <span className="font-medium text-sm">{formatPrice(order.total)}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                    <span style={{ color: 'rgba(28,15,8,0.3)', fontSize: 10 }}>
                      {expanded === order.id ? '▲' : '▼'}
                    </span>
                  </button>

                  {/* Expanded detail */}
                  {expanded === order.id && (
                    <div className="px-4 pb-4 border-t" style={{ borderColor: 'rgba(28,15,8,0.06)' }}>
                      <div className="pt-3 space-y-1.5">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex text-sm">
                            <span className="font-medium mr-2" style={{ color: 'var(--latte)' }}>
                              {item.quantity}×
                            </span>
                            <span className="flex-1">{item.menuItem.name}</span>
                            {item.selectedOptions && (
                              <span className="text-xs" style={{ color: 'rgba(28,15,8,0.4)' }}>
                                {Object.values(item.selectedOptions).join(', ')}
                              </span>
                            )}
                            <span className="ml-4 text-xs font-medium" style={{ color: 'rgba(28,15,8,0.5)' }}>
                              {formatPrice(item.quantity * item.menuItem.price)}
                            </span>
                          </div>
                        ))}
                        {order.customer_name && (
                          <p className="text-xs mt-2" style={{ color: 'rgba(28,15,8,0.4)' }}>
                            Customer: {order.customer_name}
                          </p>
                        )}
                        {order.notes && (
                          <p className="text-xs italic" style={{ color: 'rgba(28,15,8,0.4)' }}>
                            Note: {order.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}