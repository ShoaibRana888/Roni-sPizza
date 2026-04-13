/**
 * FILE: app/dashboard/menu/page.tsx
 * PURPOSE: Menu management page for staff.
 *          Displays all menu items grouped by category.
 *          Toggle switch marks items as available/unavailable in real time
 *          (e.g. to hide sold-out items from the customer ordering screen).
 * ROUTE: /dashboard/menu
 */

'use client'

import { useState } from 'react'
import { MenuItem } from '@/lib/supabase'
import { MOCK_MENU } from '@/lib/mockData'
import { formatPrice } from '@/lib/utils'

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>(MOCK_MENU)

  const toggle = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, available: !item.available } : item
      )
    )
    // TODO: persist to Supabase:
    // supabase.from('menu_items').update({ available: !item.available }).eq('id', id)
  }

  const categories = [...new Set(items.map((i) => i.category))]

  return (
    <>
      <header className="h-14 bg-white border-b flex items-center justify-between px-6 flex-shrink-0"
        style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
        <h1 className="text-base font-medium">Menu</h1>
        <button className="text-xs font-medium px-3 py-1.5 rounded-lg text-white"
          style={{ background: 'var(--espresso)' }}>
          + Add item
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {categories.map((cat) => (
          <div key={cat}>
            {/* Category heading */}
            <h2 className="text-xs font-medium uppercase tracking-widest mb-3"
              style={{ color: 'rgba(28,15,8,0.35)' }}>{cat}</h2>

            <div className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {items.filter((i) => i.category === cat).map((item) => (
                <div key={item.id} className="bg-white rounded-xl border p-4 flex gap-3"
                  style={{
                    borderColor: 'rgba(28,15,8,0.08)',
                    opacity: item.available ? 1 : 0.5,  // dim unavailable items
                  }}>
                  <span className="text-2xl">{item.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'rgba(28,15,8,0.45)' }}>
                      {item.description}
                    </p>
                    <p className="text-sm mt-1 font-medium" style={{ color: 'var(--latte)' }}>
                      {formatPrice(item.price)}
                    </p>
                  </div>

                  {/* Availability toggle */}
                  <button onClick={() => toggle(item.id)}
                    className="flex-shrink-0 w-10 h-6 rounded-full relative transition-all self-start mt-0.5"
                    style={{ background: item.available ? 'var(--sage)' : 'rgba(28,15,8,0.12)' }}>
                    <span className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                      style={{ left: item.available ? '20px' : '4px' }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}