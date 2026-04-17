/**
 * FILE: app/order/page.tsx
 * PURPOSE: Customer-facing menu browsing page — the first screen customers see after scanning their QR code.
 *          - Validates the table number dynamically (reads active tables from localStorage)
 *          - Blocks ordering if the table already has an active order in progress (checked via Supabase)
 *          - Fetches live menu from Supabase (falls back to MOCK_MENU if unavailable)
 *          - Shows full menu grouped by category with a filter strip at the top
 *          - Tapping an item opens a customization modal (size, crust, extras)
 *          - A floating cart bar appears at the bottom once items are added
 * ROUTE: /order?table=1  (or any active table number)
 * ACCESSED BY: Customers via QR code scan — no login required
 *
 * PRICE FIX: ItemModal now derives the display price from the selected Size option
 *            (e.g. "Large – Rs 1995" → Rs 1,995) instead of always showing item.price.
 */

'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '../../lib/supabase'
import { MenuItem } from '@/lib/supabase'
import { MOCK_MENU } from '@/lib/mockData'
import { useCartStore } from '@/lib/cartStore'
import { formatPrice } from '@/lib/utils'

const CAFE_NAME   = "Roni's Pizza"
const STORAGE_KEY = 'ronis_table_count'

function OrderPageInner() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const table        = searchParams.get('table') || ''

  const [menu, setMenu]               = useState<MenuItem[]>(MOCK_MENU)
  const [activeCategory, setCategory] = useState('All')
  const [selectedItem, setSelected]   = useState<MenuItem | null>(null)
  const [tableBlocked, setBlocked]    = useState(false)
  const [validTables, setValidTables] = useState<string[]>([])
  const [tablesLoaded, setTablesLoaded] = useState(false)

  const { addItem, itemCount, setTableNumber } = useCartStore()

  // ── On mount: compute valid tables from localStorage ─────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    const count = saved ? parseInt(saved) : 4
    const computed = Array.from({ length: count }, (_, i) => String(i + 1))
    setValidTables(computed)
    setTablesLoaded(true)
  }, [])

  // ── Once valid tables are known, validate + init ──────────────────────────────
  useEffect(() => {
    if (!tablesLoaded) return
    if (!validTables.includes(table)) return
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

      // 2. Fetch live menu
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('available', true)
        .order('category')

      if (!error && data && data.length > 0) {
        setMenu(data)
      }
    }

    init()
  }, [tablesLoaded, table, setTableNumber, validTables])

  // ── Invalid table ─────────────────────────────────────────────────────────────
  if (tablesLoaded && !validTables.includes(table)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
        style={{ background: 'var(--cream)' }}>
        <span className="text-5xl mb-4">🍕</span>
        <p className="font-serif text-2xl mb-2">{CAFE_NAME}</p>
        <p className="text-sm" style={{ color: 'rgba(28,15,8,0.45)' }}>
          Table not found. Please scan the QR code at your table.
        </p>
      </div>
    )
  }

  // ── Table blocked ─────────────────────────────────────────────────────────────
  if (tableBlocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
        style={{ background: 'var(--cream)' }}>
        <span className="text-5xl mb-4">⏳</span>
        <p className="font-serif text-2xl mb-2">Order in progress</p>
        <p className="text-sm" style={{ color: 'rgba(28,15,8,0.45)' }}>
          This table already has an active order.
        </p>
        <p className="text-sm mt-1" style={{ color: 'rgba(28,15,8,0.35)' }}>
          Please wait for it to complete.
        </p>
      </div>
    )
  }

  // ── Menu display ─────────────────────────────────────────────────────────────
  const categories = ['All', ...new Set(menu.map((i) => i.category))]
  const visible    = activeCategory === 'All' ? menu : menu.filter((i) => i.category === activeCategory)
  const cartCount  = itemCount()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--cream)' }}>

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b"
        style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
        <div className="px-5 pt-5 pb-3">
          <p className="font-serif text-2xl" style={{ color: 'var(--espresso)' }}>{CAFE_NAME}</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(28,15,8,0.4)' }}>Table {table}</p>
        </div>

        {/* Category filter strip */}
        <div className="flex gap-2 px-5 pb-3 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => (
            <button key={cat}
              onClick={() => setCategory(cat)}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all"
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

  /**
   * FIX: Derive the display price from the selected Size option.
   *
   * If the user has picked a Size option like "Large – Rs 1995", parse
   * the Rs value out and show that. Otherwise fall back to item.price.
   *
   * This mirrors the resolveItemPrice() logic in cartStore.ts so the
   * modal button always reflects the correct size price before adding.
   */
  const displayPrice = (() => {
    const sizeValue = selections['Size']
    if (sizeValue) {
      const match = sizeValue.match(/Rs\s*([\d,]+)/)
      if (match) {
        const parsed = parseInt(match[1].replace(/,/g, ''), 10)
        if (!isNaN(parsed)) return parsed
      }
    }
    return item.price
  })()

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

        {/* FIX: Button now shows dynamically resolved price based on selected size */}
        <button
          disabled={!allSelected}
          onClick={() => onAdd(selections)}
          className="w-full mt-4 py-3 rounded-xl text-white text-sm font-medium transition-all"
          style={{
            background: allSelected ? 'var(--espresso)' : 'rgba(28,15,8,0.15)',
            color: allSelected ? '#fff' : 'rgba(28,15,8,0.4)',
          }}>
          Add to cart — {formatPrice(displayPrice)}
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