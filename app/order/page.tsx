/**
 * FILE: app/order/page.tsx
 * PURPOSE: Customer-facing menu browsing page.
 *          - Validates table number from localStorage
 *          - Blocks ordering if table already has an active order
 *          - Fetches live menu from Supabase (falls back to MOCK_MENU)
 *          - Category filter strip + item grid
 *          - Item modal with quantity stepper + customization options
 *          - Floating cart bar
 *
 * CATEGORY ORDER: Pizzas first, Drinks and Extras last.
 *   Classic Pizzas → Roni's Specials → Protein Specials → Drinks → Extras
 *   Any unknown future categories are appended alphabetically after Extras.
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

const CATEGORY_ORDER = [
  'Classic Pizzas',
  "Roni's Specials",
  'Protein Specials',
  'Drinks',
  'Extras',
]

function sortCategories(cats: string[]): string[] {
  return [...cats].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a)
    const ib = CATEGORY_ORDER.indexOf(b)
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    return a.localeCompare(b)
  })
}

function OrderPageInner() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const table        = searchParams.get('table') || ''
  const addOn        = searchParams.get('addOn') === '1'

  const [menu, setMenu]               = useState<MenuItem[]>(MOCK_MENU)
  const [activeCategory, setCategory] = useState('All')
  const [selectedItem, setSelected]   = useState<MenuItem | null>(null)
  const [tableBlocked, setBlocked]    = useState(false)
  const [validTables, setValidTables] = useState<string[]>([])
  const [tablesLoaded, setTablesLoaded] = useState(false)

  const { addItem, itemCount, setTableNumber } = useCartStore()

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    const count = saved ? parseInt(saved) : 4
    const computed = Array.from({ length: count }, (_, i) => String(i + 1))
    setValidTables(computed)
    setTablesLoaded(true)
  }, [])

  useEffect(() => {
    if (!tablesLoaded) return
    if (!validTables.includes(table)) return
    setTableNumber(table)

    async function init() {
      if (!addOn) {
        const { data: activeOrder } = await supabase
          .from('orders')
          .select('id')
          .eq('table_number', table)
          .in('status', ['new', 'preparing'])
          .limit(1)
          .maybeSingle()

        if (activeOrder) { setBlocked(true); return }
      }

      const { data: menuData, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('available', true)

      if (!error && menuData && menuData.length > 0) {
        setMenu(menuData as MenuItem[])
      }
    }

    init()
  }, [table, setTableNumber, validTables, tablesLoaded, addOn])

  if (!tablesLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--cream)' }}>
        <p className="text-sm" style={{ color: 'rgba(28,15,8,0.35)' }}>Loading…</p>
      </div>
    )
  }

  if (!validTables.includes(table)) {
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

  const rawCategories    = [...new Set(menu.map((i) => i.category))]
  const sortedCategories = sortCategories(rawCategories)
  const categories       = ['All', ...sortedCategories]

  const sortedMenu = [...menu].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a.category)
    const ib = CATEGORY_ORDER.indexOf(b.category)
    if (ia !== ib) {
      if (ia === -1 && ib === -1) return a.category.localeCompare(b.category)
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    }
    return a.name.localeCompare(b.name)
  })

  const visible   = activeCategory === 'All'
    ? sortedMenu
    : sortedMenu.filter((i) => i.category === activeCategory)
  const cartCount = itemCount()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--cream)' }}>

      <div className="sticky top-0 z-10 bg-white border-b"
        style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
        <div className="px-5 pt-5 pb-3">
          <p className="font-serif text-2xl" style={{ color: 'var(--espresso)' }}>{CAFE_NAME}</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(28,15,8,0.4)' }}>Table {table}</p>
          {addOn && (
            <p className="text-xs mt-1 font-medium" style={{ color: '#1D4ED8' }}>
              Adding items to your current order
            </p>
          )}
        </div>

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

      <div className="flex-1 p-4 pb-32 grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {visible.map((item) => (
          <button key={item.id}
            onClick={() => setSelected(item)}
            className="bg-white rounded-2xl border p-4 text-left flex gap-3 items-start transition-all active:scale-[0.98]"
            style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                className="w-14 h-14 rounded-xl object-cover shrink-0"
              />
            ) : (
              <span className="text-3xl">{item.emoji}</span>
            )}
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

      {cartCount > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={() => router.push(`/order/cart?table=${table}${addOn ? '&addOn=1' : ''}`)}
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

      {selectedItem && (
        <ItemModal
          item={selectedItem}
          onClose={() => setSelected(null)}
          onAdd={(options, qty) => {
            addItem(selectedItem, options, undefined, qty)
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}

function ItemModal({
  item,
  onClose,
  onAdd,
}: {
  item: MenuItem
  onClose: () => void
  onAdd: (options: Record<string, string>, quantity: number) => void
}) {
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [quantity, setQuantity]     = useState(1)

  const customizations = item.customizations ?? []
  const allSelected    = customizations.every((c) => !c.required || selections[c.label])

  const unitPrice = (() => {
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
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.name}
              className="w-16 h-16 rounded-2xl object-cover shrink-0"
            />
          ) : (
            <span className="text-4xl">{item.emoji}</span>
          )}
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

        <div className="flex items-center justify-between py-3 mb-4 border-t border-b"
          style={{ borderColor: 'rgba(28,15,8,0.07)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--espresso)' }}>Quantity</p>
          <div className="flex items-center gap-5">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-9 h-9 rounded-full border flex items-center justify-center text-lg font-medium transition-all"
              style={{
                borderColor: quantity === 1 ? 'rgba(28,15,8,0.1)' : 'rgba(28,15,8,0.2)',
                color:       quantity === 1 ? 'rgba(28,15,8,0.2)' : 'var(--espresso)',
              }}>
              −
            </button>
            <span className="text-lg font-semibold w-5 text-center"
              style={{ color: 'var(--espresso)' }}>
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => Math.min(9, q + 1))}
              className="w-9 h-9 rounded-full border flex items-center justify-center text-lg font-medium transition-all"
              style={{
                borderColor: quantity === 9 ? 'rgba(28,15,8,0.1)' : 'rgba(28,15,8,0.2)',
                color:       quantity === 9 ? 'rgba(28,15,8,0.2)' : 'var(--espresso)',
              }}>
              +
            </button>
          </div>
        </div>

        <button
          disabled={!allSelected}
          onClick={() => onAdd(selections, quantity)}
          className="w-full py-3 rounded-xl text-white text-sm font-medium transition-all"
          style={{
            background: allSelected ? 'var(--espresso)' : 'rgba(28,15,8,0.15)',
            color: allSelected ? '#fff' : 'rgba(28,15,8,0.4)',
          }}>
          {allSelected
            ? `Add ${quantity > 1 ? `${quantity} × ` : ''}to cart — ${formatPrice(unitPrice * quantity)}`
            : 'Select required options above'}
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
