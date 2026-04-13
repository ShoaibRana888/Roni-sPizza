/**
 * FILE: app/dashboard/orders/page.tsx
 * PURPOSE: Full order history table for staff.
 *          Shows all orders (new, preparing, done) in a sortable table view.
 *          Staff can advance order status from here too.
 *          Fetches from Supabase on mount and updates status via Supabase.
 * ROUTE: /dashboard/orders
 */

'use client'

import { useState, useEffect } from 'react'
import { supabase, Order, OrderStatus } from '@/lib/supabase'
import { formatPrice, timeAgo, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'

export default function OrdersPage() {
  const [orders, setOrders]   = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch all orders on mount, newest first
  useEffect(() => {
    supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setOrders(data as Order[])
        setLoading(false)
      })
  }, [])

  // Advance order status and persist to Supabase
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

    const { error } = await supabase
      .from('orders')
      .update({ status: next })
      .eq('id', id)

    if (error) {
      console.error('Failed to update order:', error)
      // Revert on failure
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: order.status } : o))
      )
    }
  }

  return (
    <>
      <header className="h-14 bg-white border-b flex items-center px-6 flex-shrink-0"
        style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
        <h1 className="text-base font-medium">All Orders</h1>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-center py-24" style={{ color: 'rgba(28,15,8,0.25)' }}>
            <p className="text-sm">Loading orders…</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-24" style={{ color: 'rgba(28,15,8,0.25)' }}>
            <p className="text-4xl mb-3">📋</p>
            <p className="text-sm">No orders yet</p>
          </div>
        ) : (
          <table className="w-full text-sm bg-white rounded-xl border overflow-hidden"
            style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
            <thead>
              <tr className="border-b text-left" style={{ borderColor: 'rgba(28,15,8,0.06)' }}>
                {['Order', 'Table', 'Items', 'Total', 'Status', 'Time', 'Action'].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-medium"
                    style={{ color: 'rgba(28,15,8,0.4)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-[--cream] transition-colors"
                  style={{ borderColor: 'rgba(28,15,8,0.05)' }}>
                  <td className="px-4 py-3 font-medium">#{order.id.slice(-4).toUpperCase()}</td>
                  <td className="px-4 py-3">Table {order.table_number}</td>
                  <td className="px-4 py-3" style={{ color: 'rgba(28,15,8,0.6)' }}>
                    {order.items.map((i) => `${i.quantity}× ${i.menuItem.name}`).join(', ')}
                  </td>
                  <td className="px-4 py-3">{formatPrice(order.total)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'rgba(28,15,8,0.4)' }}>
                    {timeAgo(order.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {order.status !== 'done' && order.status !== 'cancelled' && (
                      <button onClick={() => advance(order.id)}
                        className="text-xs font-medium px-3 py-1 rounded-lg text-white"
                        style={{ background: order.status === 'new' ? 'var(--espresso)' : 'var(--sage)' }}>
                        {order.status === 'new' ? 'Start prep' : 'Mark ready'}
                      </button>
                    )}
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