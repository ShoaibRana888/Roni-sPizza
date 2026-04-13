/**
 * FILE: app/order/page.tsx
 * PURPOSE: Customer-facing menu browsing page — the first screen customers see after scanning their QR code.
 *          - Validates the table number (must be 1–4)
 *          - Blocks ordering if the table already has an active order in progress
 *          - Shows full menu grouped by category with a filter strip at the top
 *          - Tapping an item opens a customization modal (size, crust, extras)
 *          - A floating cart bar appears at the bottom once items are added
 * ROUTE: /order?table=1  (or 2, 3, 4)
 * ACCESSED BY: Customers via QR code scan — no login required
 */

'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '../../lib/supabase'
import { MenuItem } from '@/lib/supabase'
import { MOCK_MENU } from '@/lib/mockData'
import { useCartStore } from '@/lib/cartStore'
import { formatPrice } from '@/lib/utils'
import { resolveItemPrice } from '@/lib/cartStore'

const CAFE_NAME    = "Roni's Pizza"
const VALID_TABLES = ['1', '2', '3', '4']
const TABLE_RESET_MS = 60 * 60 * 1000  // 1 hour — matches dashboard reset

function OrderPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const table = searchParams.get('table') || ''

  const [menu, setMenu]               = useState<MenuItem[]>(MOCK_MENU)
  const [activeCategory, setCategory] = useState('All')
  const [selectedItem, setSelected]   = useState<MenuItem | null>(null)
  const [tableBlocked, setBlocked]    = useState(false)

  const { addItem, itemCount, setTableNumber } = useCartStore()

  useEffect(() => {
    if (!VALID_TABLES.includes(table)) return
    setTableNumber(table)

    // Check if this table already has an active order placed within the last hour.
    // In production this is verified server-side via Supabase.
    const key       = `ronis_table_${table}_order_time`
    const orderTime = sessionStorage.getItem(key)
  
    const { data } = await supabase
      .from('orders')
      .select('id')
      .eq('table_number', table)
      .in('status', ['new', 'preparing'])
      .limit(1)
      .maybeSingle()
    if (data) setBlocked(true)
  }, [table, setTableNumber])

  // ── Guard: invalid table number ──────────────────────────────────────────────
  if (!VALID_TABLES.includes(table)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
        style={{ background: 'var(--cream)' }}>
        <span className="text-5xl mb-4">🍕</span>
        <h1 className="font-serif text-2xl mb-2">Invalid table</h1>
        <p className="text-sm" style={{ color: 'rgba(28,15,8,0.5)' }}>
          Please scan the QR code on your table.
        </p>
      </div>
    )
  }

  // ── Guard: table already has an order in progress ────────────────────────────
  if (tableBlocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
        style={{ background: 'var(--cream)' }}>
        <span className="text-5xl mb-4">⏳</span>
        <h1 className="font-serif text-2xl mb-2">Order in progress</h1>
        <p className="text-sm mb-2" style={{ color: 'rgba(28,15,8,0.5)' }}>
          Table {table} already has an active order being prepared.
        </p>
        <p className="text-xs" style={{ color: 'rgba(28,15,8,0.35)' }}>
          Once your order is collected, you can place a new one.
        </p>
      </div>
    )
  }

  const categories = ['All', ...Array.from(new Set(menu.map((m) => m.category)))]
  const filtered   = activeCategory === 'All'
    ? menu.filter((m) => m.available)
    : menu.filter((m) => m.category === activeCategory && m.available)

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--cream)' }}>

      {/* Sticky header: restaurant name + table number + category filter */}
      <div className="sticky top-0 z-10">
        <div className="px-5 pt-8 pb-4" style={{ background: 'var(--espresso)' }}>
          <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Welcome to</p>
          <h1 className="font-serif text-2xl text-white">{CAFE_NAME}</h1>
          <span className="inline-block mt-2 text-xs px-3 py-1 rounded-full"
            style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)' }}>
            Table {table}
          </span>
        </div>

        {/* Horizontal category filter */}
        <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-white border-b"
          style={{ borderColor: 'rgba(28,15,8,0.08)', scrollbarWidth: 'none' }}>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setCategory(cat)}
              className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm transition-all border"
              style={{
                background: activeCategory === cat ? 'var(--espresso)' : 'transparent',
                color: activeCategory === cat ? '#fff' : 'rgba(28,15,8,0.55)',
                borderColor: activeCategory === cat ? 'var(--espresso)' : 'rgba(28,15,8,0.15)',
              }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Menu item list */}
      <div className="flex-1 p-4 space-y-3 pb-32">
        {filtered.map((item, i) => (
          <button key={item.id} onClick={() => setSelected(item)}
            className="w-full text-left bg-white rounded-2xl border p-4 flex items-center gap-4 transition-all animate-fade-up"
            style={{ borderColor: 'rgba(28,15,8,0.08)', animationDelay: `${i * 30}ms` }}>
            <span className="text-3xl">{item.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{item.name}</p>
              <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'rgba(28,15,8,0.45)' }}>
                {item.description}
              </p>
              <p className="text-sm mt-1.5 font-medium" style={{ color: 'var(--latte)' }}>
                {formatPrice(item.price)}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xl text-white"
              style={{ background: 'var(--espresso)' }}>+</div>
          </button>
        ))}
      </div>

      {/* Floating cart bar — only visible when cart has items */}
      {itemCount() > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4" style={{ background: 'var(--cream)' }}>
          <button onClick={() => router.push(`/order/cart?table=${table}`)}
            className="w-full flex items-center justify-between rounded-2xl px-5 py-4 text-white font-medium"
            style={{ background: 'var(--espresso)' }}>
            <span className="text-sm">View cart</span>
            <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'var(--latte)' }}>
              {itemCount()} item{itemCount() !== 1 ? 's' : ''}
            </span>
          </button>
        </div>
      )}

      {/* Item customization modal (slides up from bottom) */}
      {selectedItem && (
        <ItemModal item={selectedItem} onClose={() => setSelected(null)} onAdd={() => setSelected(null)} />
      )}
    </div>
  )
}

// ─── Item Modal ───────────────────────────────────────────────────────────────
// Shown when customer taps a menu item. Handles size/crust/extras selection.
function ItemModal({ item, onClose, onAdd }: {
  item: MenuItem; onClose: () => void; onAdd: () => void
}) {
  const { addItem }  = useCartStore()
  const [options, setOptions] = useState<Record<string, string>>({})
  const [notes, setNotes]     = useState('')
  const [qty, setQty]         = useState(1)

  // Prevent adding to cart if required customizations haven't been selected
  // Compute the correct price based on the currently selected Size option
  const resolvedPrice = resolveItemPrice({ menuItem: item, quantity: qty, selectedOptions: options })

  const canAdd = !item.customizations?.some((c) => c.required && !options[c.label])

  const handleAdd = () => {
    if (!canAdd) return
    for (let i = 0; i < qty; i++) addItem(item, options, notes)
    onAdd()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}>
      <div className="w-full rounded-t-3xl p-6 pb-8 animate-fade-up"
        style={{ background: 'var(--cream)' }}
        onClick={(e) => e.stopPropagation()}>

        {/* Item name, description, price */}
        <div className="flex items-start gap-4 mb-5">
          <span className="text-4xl">{item.emoji}</span>
          <div>
            <h2 className="font-serif text-xl">{item.name}</h2>
            <p className="text-sm mt-1" style={{ color: 'rgba(28,15,8,0.5)' }}>{item.description}</p>
            <p className="font-medium mt-1" style={{ color: 'var(--latte)' }}>{formatPrice(resolvedPrice)}</p>
          </div>
        </div>

        {/* Customization options (e.g. Size, Crust) */}
        {item.customizations?.map((cust) => (
          <div key={cust.label} className="mb-4">
            <p className="text-xs font-medium uppercase tracking-wider mb-2"
              style={{ color: 'rgba(28,15,8,0.4)' }}>
              {cust.label}{cust.required ? ' *' : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {cust.options.map((opt) => (
                <button key={opt} onClick={() => setOptions((o) => ({ ...o, [cust.label]: opt }))}
                  className="px-3 py-1.5 rounded-full text-sm border transition-all"
                  style={{
                    background: options[cust.label] === opt ? 'var(--espresso)' : '#fff',
                    color: options[cust.label] === opt ? '#fff' : 'rgba(28,15,8,0.6)',
                    borderColor: options[cust.label] === opt ? 'var(--espresso)' : 'rgba(28,15,8,0.15)',
                  }}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Special requests text box */}
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Any special requests?"
          className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none mb-5 outline-none"
          style={{ borderColor: 'rgba(28,15,8,0.15)', background: '#fff', height: 64 }} />

        {/* Quantity selector + add to cart button */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 border rounded-xl px-3 py-2 bg-white"
            style={{ borderColor: 'rgba(28,15,8,0.15)' }}>
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="text-lg w-6 text-center">−</button>
            <span className="font-medium w-4 text-center text-sm">{qty}</span>
            <button onClick={() => setQty(qty + 1)} className="text-lg w-6 text-center">+</button>
          </div>
          <button onClick={handleAdd} disabled={!canAdd}
            className="flex-1 py-3 rounded-xl text-white font-medium text-sm transition-opacity"
            style={{ background: 'var(--espresso)', opacity: canAdd ? 1 : 0.4 }}>
            Add to cart · {formatPrice(resolvedPrice * qty)}
          </button>
        </div>
        {!canAdd && (
          <p className="text-center text-xs mt-2" style={{ color: 'rgba(28,15,8,0.4)' }}>
            Please select all required options (marked *)
          </p>
        )}
      </div>
    </div>
  )
}

export default function OrderPage() {
  return <Suspense><OrderPageInner /></Suspense>
}