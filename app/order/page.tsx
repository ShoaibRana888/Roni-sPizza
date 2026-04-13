/**
 * FILE: app/order/page.tsx
 * PURPOSE: Customer-facing menu browsing page — the first screen customers see after scanning their QR code.
 *          - Validates the table number (must be 1–4)
 *          - Blocks ordering if the table already has an active order in progress (checked via Supabase)
 *          - Fetches live menu from Supabase (falls back to MOCK_MENU if unavailable)
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

function OrderPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const table = searchParams.get('table') || ''

  const [menu, setMenu]               = useState<MenuItem[]>(MOCK_MENU)
  const [activeCategory, setCategory] = useState('All')
  const [selectedItem, setSelected]   = useState<MenuItem | null>(null)
  const [tableBlocked, setBlocked]    = useState(false)

  const { addItem, itemCount, setTableNumber } = useCartStore()

  // ── On mount: set table, check if blocked, fetch live menu ──────────────────
  useEffect(() => {
    if (!VALID_TABLES.includes(table)) return
    setTableNumber(table)

    async function init() {
      // 1. Check if table already has an active order
      const { data: activeOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('table_number', table)
        .in('status', ['new', 'preparing'])
        .limit(1)
        .maybeSingle()

      if (activeOrder) {
        setBlocked(true)
        return
      }

      // 2. Fetch live menu from Supabase
      const { data: menuData, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('available', true)
        .order('category')

      if (!error && menuData && menuData.length > 0) {
        setMenu(menuData as MenuItem[])
      }
      // If fetch fails, MOCK_MENU stays as the fallback
    }

    init()
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

  // ── Guard: table already has active order ────────────────────────────────────
  if (tableBlocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
        style={{ background: 'var(--cream)' }}>
        <span className="text-5xl mb-4">⏳</span>
        <h1 className="font-serif text-2xl mb-2">Order in progress</h1>
        <p className="text-sm" style={{ color: 'rgba(28,15,8,0.5)' }}>
          This table already has an active order. Please wait for it to complete.
        </p>
      </div>
    )
  }

  // ── Menu display ─────────────────────────────────────────────────────────────
  const categories  = ['All', ...new Set(menu.map((i) => i.category))]
  const visible     = activeCategory === 'All' ? menu : menu.filter((i) => i.category === activeCategory)
  const cartCount   = itemCount()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--cream)' }}>

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-5 pt-5 pb-0"
        style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-serif text-xl">{CAFE_NAME}</p>
            <p className="text-xs" style={{ color: 'rgba(28,15,8,0.4)' }}>Table {table}</p>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          {categories.map((cat) => (
            <button key={cat}
              onClick={() => setCategory(cat)}
              className="flex-shrink-0 text-xs font-medium px-4 py-1.5 rounded-full border transition-all"
              style={{
                borderColor: activeCategory === cat ? 'var(--espresso)' : 'rgba(28,15,8,0.12)',
                background:  activeCategory === cat ? 'var(--espresso)' : '#fff',
                color:       activeCategory === cat ? '#fff' : 'rgba(28,15,8,0.5)',
              }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Menu items */}
      <div className="flex-1 p-4 pb-32 grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {visible.map((item) => (
          <button key={item.id}
            onClick={() => setSelected(item)}
            className="bg-white rounded-2xl border p-4 text-left flex gap-3 items-start transition-all active:scale-[0.98]"
            style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
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
          </button>
        ))}
      </div>

      {/* Floating cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={() => router.push(`/order/cart?table=${table}`)}
            className="flex items-center gap-3 px-6 py-3 rounded-2xl text-white shadow-lg"
            style={{ background: 'var(--espresso)' }}>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.2)' }}>
              {cartCount}
            </span>
            <span className="text-sm font-medium">View cart</span>
          </button>
        </div>
      )}

      {/* Item customization modal */}
      {selectedItem && (
        <ItemModal
          item={selectedItem}
          onClose={() => setSelected(null)}
          onAdd={(options) => {
            addItem(selectedItem, options)
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}

// ── Item modal ────────────────────────────────────────────────────────────────
function ItemModal({
  item,
  onClose,
  onAdd,
}: {
  item: MenuItem
  onClose: () => void
  onAdd: (options: Record<string, string>) => void
}) {
  const [selections, setSelections] = useState<Record<string, string>>({})

  const customizations = item.customizations ?? []
  const allSelected    = customizations.every((c) => !c.required || selections[c.label])

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center"
      style={{ background: 'rgba(28,15,8,0.4)' }}
      onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-t-3xl p-6 pb-10"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-start gap-3 mb-5">
          <span className="text-4xl">{item.emoji}</span>
          <div>
            <p className="font-serif text-xl">{item.name}</p>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(28,15,8,0.5)' }}>{item.description}</p>
          </div>
        </div>

        {customizations.map((c) => (
          <div key={c.label} className="mb-4">
            <p className="text-xs font-medium mb-2" style={{ color: 'rgba(28,15,8,0.5)' }}>
              {c.label} {c.required && <span style={{ color: 'var(--latte)' }}>*</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {c.options.map((opt) => (
                <button key={opt}
                  onClick={() => setSelections((s) => ({ ...s, [c.label]: opt }))}
                  className="text-xs px-3 py-1.5 rounded-full border transition-all"
                  style={{
                    borderColor: selections[c.label] === opt ? 'var(--espresso)' : 'rgba(28,15,8,0.15)',
                    background:  selections[c.label] === opt ? 'var(--espresso)' : '#fff',
                    color:       selections[c.label] === opt ? '#fff' : 'rgba(28,15,8,0.6)',
                  }}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}

        <button
          disabled={!allSelected}
          onClick={() => onAdd(selections)}
          className="w-full mt-4 py-3 rounded-xl text-white text-sm font-medium transition-all"
          style={{
            background: allSelected ? 'var(--espresso)' : 'rgba(28,15,8,0.15)',
            color: allSelected ? '#fff' : 'rgba(28,15,8,0.4)',
          }}>
          Add to cart — {formatPrice(item.price)}
        </button>
      </div>
    </div>
  )
}

export default function OrderPage() {
  return (
    <Suspense>
      <OrderPageInner />
    </Suspense>
  )
}