/**
 * FILE: app/dashboard/invoice/page.tsx
 * PURPOSE: Invoice generation for orders.
 *          Search by table number or order ref.
 *          Renders a printable invoice. Staff can print or download.
 * ROUTE: /dashboard/invoice
 */

'use client'

import { useState, useRef } from 'react'
import { supabase, Order, CartItem } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-PK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function resolveItemPrice(item: CartItem): number {
  const base = item.menuItem.price
  if (!item.selectedOptions) return base * item.quantity
  for (const val of Object.values(item.selectedOptions)) {
    const match = val.match(/Rs\s*([\d,]+)/)
    if (match) return parseInt(match[1].replace(',', '')) * item.quantity
  }
  return base * item.quantity
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function InvoicePage() {
  const [search, setSearch]     = useState('')
  const [orders, setOrders]     = useState<Order[]>([])
  const [selected, setSelected] = useState<Order | null>(null)
  const [loading, setLoading]   = useState(false)
  const [searched, setSearched] = useState(false)
  const invoiceRef              = useRef<HTMLDivElement>(null)

  const runSearch = async () => {
    if (!search.trim()) return
    setLoading(true)
    setSearched(true)
    setSelected(null)

    const q = search.trim().toLowerCase()

    // Search by table number or order id suffix
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      const matched = (data as Order[]).filter((o) =>
        o.table_number === q ||
        o.id.slice(-6).toLowerCase() === q ||
        o.id.toLowerCase().includes(q) ||
        (o.customer_name ?? '').toLowerCase().includes(q)
      )
      setOrders(matched)
    }

    setLoading(false)
  }

  const handlePrint = () => {
    window.print()
  }

  const subtotal = selected
    ? selected.items.reduce((s: number, item: CartItem) => s + resolveItemPrice(item), 0)
    : 0

  return (
    <>
      {/* Print styles — hidden in normal view, shown only when printing */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #invoice-printable, #invoice-printable * { visibility: visible !important; }
          #invoice-printable {
            position: fixed !important;
            top: 0; left: 0;
            width: 100%; height: auto;
            background: white !important;
            padding: 40px !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <header
        className="h-14 bg-white border-b flex items-center gap-4 px-6 flex-shrink-0"
        style={{ borderColor: 'rgba(28,15,8,0.08)' }}
      >
        <h1 className="text-base font-medium">Invoice</h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — search + order list */}
        <div
          className="w-80 flex flex-col flex-shrink-0 border-r overflow-hidden"
          style={{ borderColor: 'rgba(28,15,8,0.08)' }}
        >
          {/* Search bar */}
          <div className="p-4 border-b" style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
            <p className="text-xs mb-2" style={{ color: 'rgba(28,15,8,0.4)' }}>
              Search by table, ref, or name
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                placeholder="e.g. 3, abc123, Ali"
                className="flex-1 text-sm border rounded-lg px-3 py-2 outline-none"
                style={{ borderColor: 'rgba(28,15,8,0.15)' }}
              />
              <button
                onClick={runSearch}
                disabled={loading}
                className="px-3 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: 'var(--espresso)',
                  color: '#fff',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? '…' : 'Search'}
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            {!searched && (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <p className="text-2xl mb-2">🧾</p>
                <p className="text-sm" style={{ color: 'rgba(28,15,8,0.35)' }}>
                  Search for an order to generate an invoice
                </p>
              </div>
            )}

            {searched && orders.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <p className="text-2xl mb-2">🔍</p>
                <p className="text-sm" style={{ color: 'rgba(28,15,8,0.4)' }}>No orders found</p>
              </div>
            )}

            {orders.map((order) => (
              <button
                key={order.id}
                onClick={() => setSelected(order)}
                className="w-full text-left px-4 py-3 border-b transition-all"
                style={{
                  borderColor: 'rgba(28,15,8,0.06)',
                  background: selected?.id === order.id ? 'rgba(28,15,8,0.04)' : 'transparent',
                  borderLeft: selected?.id === order.id ? '3px solid var(--latte)' : '3px solid transparent',
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">Table {order.table_number}</p>
                    {order.customer_name && (
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(28,15,8,0.45)' }}>
                        {order.customer_name}
                      </p>
                    )}
                    <p className="text-xs mt-0.5 font-mono" style={{ color: 'rgba(28,15,8,0.3)' }}>
                      #{order.id.slice(-6).toUpperCase()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatPrice(order.total)}</p>
                    <p
                      className="text-xs mt-0.5 px-1.5 py-0.5 rounded-full inline-block"
                      style={{
                        background:
                          order.status === 'done' ? '#D1FAE5' :
                          order.status === 'new' ? '#FEF3CD' :
                          order.status === 'preparing' ? '#DBEAFE' :
                          '#F3F4F6',
                        color:
                          order.status === 'done' ? '#065F46' :
                          order.status === 'new' ? '#92620A' :
                          order.status === 'preparing' ? '#1E40AF' :
                          '#4B5563',
                      }}
                    >
                      {order.status}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right panel — invoice preview */}
        <div className="flex-1 overflow-y-auto p-8" style={{ background: '#F5F5F5' }}>
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-4xl mb-3">←</p>
              <p className="text-sm" style={{ color: 'rgba(28,15,8,0.35)' }}>
                Select an order from the list to preview its invoice
              </p>
            </div>
          ) : (
            <div>
              {/* Action bar */}
              <div className="flex justify-end gap-3 mb-6">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: 'var(--espresso)',
                    color: '#fff',
                  }}
                >
                  🖨️ Print Invoice
                </button>
              </div>

              {/* Invoice */}
              <div
                id="invoice-printable"
                ref={invoiceRef}
                className="bg-white rounded-2xl p-10 max-w-2xl mx-auto shadow-sm"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <p
                      style={{
                        fontFamily: "'DM Serif Display', serif",
                        fontSize: 28,
                        color: 'var(--espresso)',
                        lineHeight: 1,
                      }}
                    >
                      Roni's Pizza
                    </p>
                    <p className="text-sm mt-1" style={{ color: 'rgba(28,15,8,0.45)' }}>
                      Tax Invoice
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-xs font-mono px-2 py-1 rounded"
                      style={{ background: 'var(--foam)', color: 'var(--espresso)' }}
                    >
                      #{selected.id.slice(-6).toUpperCase()}
                    </p>
                    <p className="text-xs mt-2" style={{ color: 'rgba(28,15,8,0.45)' }}>
                      {fmtDate(selected.created_at)}
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: 'rgba(28,15,8,0.08)', marginBottom: 24 }} />

                {/* Order info */}
                <div
                  className="grid grid-cols-2 gap-4 mb-8 p-4 rounded-xl"
                  style={{ background: 'var(--foam)' }}
                >
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'rgba(28,15,8,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Table
                    </p>
                    <p className="text-lg font-semibold">Table {selected.table_number}</p>
                  </div>
                  {selected.customer_name && (
                    <div>
                      <p className="text-xs mb-1" style={{ color: 'rgba(28,15,8,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Customer
                      </p>
                      <p className="text-lg font-semibold">{selected.customer_name}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'rgba(28,15,8,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Status
                    </p>
                    <p className="text-base font-medium capitalize">{selected.status}</p>
                  </div>
                </div>

                {/* Items table */}
                <table className="w-full mb-6" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid rgba(28,15,8,0.08)' }}>
                      <th className="text-left pb-3 text-xs" style={{ color: 'rgba(28,15,8,0.4)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        Item
                      </th>
                      <th className="text-center pb-3 text-xs" style={{ color: 'rgba(28,15,8,0.4)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', width: 60 }}>
                        Qty
                      </th>
                      <th className="text-right pb-3 text-xs" style={{ color: 'rgba(28,15,8,0.4)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', width: 100 }}>
                        Price
                      </th>
                      <th className="text-right pb-3 text-xs" style={{ color: 'rgba(28,15,8,0.4)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', width: 100 }}>
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((item: CartItem, i: number) => {
                      const unitPrice = resolveItemPrice({ ...item, quantity: 1 })
                      const lineTotal = resolveItemPrice(item)
                      const optStr = item.selectedOptions
                        ? Object.values(item.selectedOptions).join(', ')
                        : ''
                      return (
                        <tr
                          key={i}
                          style={{ borderBottom: '1px solid rgba(28,15,8,0.05)' }}
                        >
                          <td className="py-3 pr-4">
                            <p className="text-sm font-medium">
                              {item.menuItem.emoji} {item.menuItem.name}
                            </p>
                            {optStr && (
                              <p className="text-xs mt-0.5" style={{ color: 'rgba(28,15,8,0.4)' }}>
                                {optStr}
                              </p>
                            )}
                            {item.notes && (
                              <p className="text-xs mt-0.5" style={{ color: 'rgba(28,15,8,0.5)' }}>
                                Note: {item.notes}
                              </p>
                            )}
                          </td>
                          <td className="py-3 text-center text-sm">{item.quantity}</td>
                          <td className="py-3 text-right text-sm" style={{ color: 'rgba(28,15,8,0.5)' }}>
                            {formatPrice(unitPrice)}
                          </td>
                          <td className="py-3 text-right text-sm font-medium">
                            {formatPrice(lineTotal)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Totals */}
                <div
                  className="rounded-xl p-5"
                  style={{ background: 'var(--espresso)', color: '#fff' }}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Total</p>
                      <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 2 }}>
                        {formatPrice(selected.total)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {selected.items.reduce((s: number, i: CartItem) => s + i.quantity, 0)} item(s)
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        Inclusive of all taxes
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center">
                  <p className="text-xs" style={{ color: 'rgba(28,15,8,0.3)' }}>
                    Thank you for dining at Roni's Pizza 🍕
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}