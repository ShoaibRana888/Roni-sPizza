/**
 * FILE: app/dashboard/orders/page.tsx
 * PURPOSE: Live order management for staff.
 *          Only shows active (new/preparing) orders. Done orders are in History.
 *          Staff can advance status or cancel active orders.
 * ROUTE: /dashboard/orders
 */

'use client'

import { useState, useEffect } from 'react'
import { supabase, Order, OrderStatus } from '@/lib/supabase'
import { formatPrice, timeAgo, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'

export default function OrdersPage() {
  const [orders, setOrders]   = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState<OrderStatus | 'all'>('all')

  useEffect(() => {
    supabase
      .from('orders')
      .select('*')
      .in('status', ['new', 'preparing'])
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setOrders(data as Order[])
        setLoading(false)
      })
  }, [])

  const advance = async (id: string) => {
    const order = orders.find((o) => o.id === id)
    if (!order) return
    const next: OrderStatus = order.status === 'new' ? 'preparing' : 'done'
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: next } : o))
    await supabase.from('orders').update({ status: next }).eq('id', id)
  }

  const cancel = async (id: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== id))
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', id)
  }

  const TABS: { label: string; value: OrderStatus | 'all' }[] = [
    { label: 'All',       value: 'all' },
    { label: 'New',       value: 'new' },
    { label: 'Preparing', value: 'preparing' },
  ]

  const visible = orders
    .filter((o) => filter === 'all' || o.status === filter)
    .filter((o) =>
      !search ||
      o.table_number.includes(search) ||
      o.id.slice(-6).toLowerCase().includes(search.toLowerCase()) ||
      (o.customer_name ?? '').toLowerCase().includes(search.toLowerCase())
    )

  return (
    <>
      <header className="h-14 bg-white border-b flex items-center gap-4 px-6 flex-shrink-0"
        style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
        <h1 className="text-base font-medium">Orders</h1>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search table, ref, name…"
          className="ml-auto text-sm border rounded-xl px-3 py-1.5 outline-none w-56"
          style={{ borderColor: 'rgba(28,15,8,0.15)' }}
        />
      </header>

      <div className="bg-white border-b flex gap-2 px-6 py-2" style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
        {TABS.map((tab) => (
          <button key={tab.value} onClick={() => setFilter(tab.value)}
            className="px-3 py-1.5 rounded-full text-xs border transition-all"
            style={{
              background:  filter === tab.value ? 'var(--espresso)' : '#fff',
              color:       filter === tab.value ? '#fff' : 'rgba(28,15,8,0.5)',
              borderColor: filter === tab.value ? 'var(--espresso)' : 'rgba(28,15,8,0.15)',
            }}>
            {tab.label}
            <span className="ml-1.5 opacity-60">
              {tab.value === 'all'
                ? orders.length
                : orders.filter((o) => o.status === tab.value).length}
            </span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <p className="text-center py-16 text-sm" style={{ color: 'rgba(28,15,8,0.3)' }}>Loading…</p>
        ) : visible.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'rgba(28,15,8,0.25)' }}>
            <p className="text-4xl mb-3">📋</p>
            <p className="text-sm">No orders found</p>
          </div>
        ) : (
          <table className="w-full text-sm bg-white rounded-xl border overflow-hidden"
            style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
            <thead>
              <tr className="border-b text-left" style={{ borderColor: 'rgba(28,15,8,0.06)' }}>
                {['Ref', 'Table', 'Customer', 'Items', 'Total', 'Status', 'Time', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-medium"
                    style={{ color: 'rgba(28,15,8,0.4)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((order) => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-[--cream] transition-colors"
                  style={{ borderColor: 'rgba(28,15,8,0.05)' }}>
                  <td className="px-4 py-3 font-mono text-xs font-medium">
                    #{order.id.slice(-6).toUpperCase()}
                  </td>
                  <td className="px-4 py-3">Table {order.table_number}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'rgba(28,15,8,0.5)' }}>
                    {order.customer_name || '—'}
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate" style={{ color: 'rgba(28,15,8,0.6)' }}>
                    {order.items.map((i) => `${i.quantity}× ${i.menuItem.name}`).join(', ')}
                  </td>
                  <td className="px-4 py-3 font-medium">{formatPrice(order.total)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'rgba(28,15,8,0.4)' }}>
                    {timeAgo(order.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {order.status !== 'done' && (
                        <button onClick={() => advance(order.id)}
                          className="text-xs font-medium px-3 py-1 rounded-lg text-white"
                          style={{ background: order.status === 'new' ? 'var(--espresso)' : 'var(--sage)' }}>
                          {order.status === 'new' ? 'Start prep' : 'Mark ready'}
                        </button>
                      )}
                      {order.status !== 'done' && (
                        <button onClick={() => cancel(order.id)}
                          className="text-xs px-3 py-1 rounded-lg border"
                          style={{ borderColor: 'rgba(192,57,43,0.3)', color: 'rgba(192,57,43,0.7)' }}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
