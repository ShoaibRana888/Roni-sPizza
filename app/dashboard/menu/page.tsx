/**
 * FILE: app/dashboard/menu/page.tsx
 * PURPOSE: Menu management — add items, delete items, toggle availability.
 *          All changes persist to Supabase immediately.
 * ROUTE: /dashboard/menu
 */

'use client'

import { useState, useEffect } from 'react'
import { supabase, MenuItem } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'

const CATEGORIES = ['Classic Pizzas', "Roni's Specials", 'Protein Specials', 'Drinks', 'Extras']

const BLANK_FORM = {
  name: '', description: '', price: '', category: CATEGORIES[0], emoji: '🍕', available: true,
}

export default function MenuPage() {
  const [items, setItems]       = useState<MenuItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(BLANK_FORM)
  const [saving, setSaving]     = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Fetch all menu items on mount
  useEffect(() => {
    supabase
      .from('menu_items')
      .select('*')
      .order('category')
      .then(({ data, error }) => {
        if (!error && data) setItems(data as MenuItem[])
        setLoading(false)
      })
  }, [])

  // Toggle availability
  const toggle = async (item: MenuItem) => {
    const next = !item.available
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, available: next } : i)))
    await supabase.from('menu_items').update({ available: next }).eq('id', item.id)
  }

  // Add new item
  const addItem = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const { data, error } = await supabase
      .from('menu_items')
      .insert({
        name:        form.name.trim(),
        description: form.description.trim(),
        price:       parseInt(form.price),
        category:    form.category,
        emoji:       form.emoji || '🍕',
        available:   true,
        customizations: [],
      })
      .select()
      .single()

    if (!error && data) {
      setItems((prev) => [...prev, data as MenuItem])
      setForm(BLANK_FORM)
      setShowForm(false)
    }
    setSaving(false)
  }

  // Delete item (confirm inline)
  const deleteItem = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
    setDeleteId(null)
    await supabase.from('menu_items').delete().eq('id', id)
  }

  const categories = [...new Set(items.map((i) => i.category))]

  return (
    <>
      <header className="h-14 bg-white border-b flex items-center justify-between px-6 flex-shrink-0"
        style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
        <h1 className="text-base font-medium">Menu</h1>
        <button
          onClick={() => { setShowForm(true); setForm(BLANK_FORM) }}
          className="text-xs font-medium px-3 py-1.5 rounded-lg text-white"
          style={{ background: 'var(--espresso)' }}>
          + Add item
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {loading ? (
          <p className="text-sm text-center py-12" style={{ color: 'rgba(28,15,8,0.3)' }}>Loading menu…</p>
        ) : categories.map((cat) => (
          <div key={cat}>
            <h2 className="text-xs font-medium uppercase tracking-widest mb-3"
              style={{ color: 'rgba(28,15,8,0.35)' }}>{cat}</h2>

            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
              {items.filter((i) => i.category === cat).map((item) => (
                <div key={item.id}
                  className="bg-white rounded-xl border p-4 flex gap-3 transition-all"
                  style={{ borderColor: 'rgba(28,15,8,0.08)', opacity: item.available ? 1 : 0.5 }}>
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

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {/* Availability toggle */}
                    <button onClick={() => toggle(item)}
                      className="w-10 h-6 rounded-full relative transition-all"
                      style={{ background: item.available ? 'var(--sage)' : 'rgba(28,15,8,0.12)' }}>
                      <span className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                        style={{ left: item.available ? '20px' : '4px' }} />
                    </button>

                    {/* Delete */}
                    {deleteId === item.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => deleteItem(item.id)}
                          className="text-xs px-2 py-1 rounded-lg text-white"
                          style={{ background: '#C0392B' }}>Yes</button>
                        <button onClick={() => setDeleteId(null)}
                          className="text-xs px-2 py-1 rounded-lg border"
                          style={{ borderColor: 'rgba(28,15,8,0.15)', color: 'rgba(28,15,8,0.5)' }}>No</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteId(item.id)}
                        className="text-xs px-2 py-1 rounded-lg border transition-all"
                        style={{ borderColor: 'rgba(28,15,8,0.12)', color: 'rgba(28,15,8,0.35)' }}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add item modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center"
          style={{ background: 'rgba(28,15,8,0.4)' }}
          onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-medium mb-5">Add menu item</h2>

            <form onSubmit={addItem} className="flex flex-col gap-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'rgba(28,15,8,0.5)' }}>Name *</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. BBQ Chicken"
                    className="w-full text-sm border rounded-xl px-3 py-2 outline-none"
                    style={{ borderColor: 'rgba(28,15,8,0.15)' }} />
                </div>
                <div style={{ width: 72 }}>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'rgba(28,15,8,0.5)' }}>Emoji</label>
                  <input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                    className="w-full text-center text-xl border rounded-xl px-2 py-2 outline-none"
                    style={{ borderColor: 'rgba(28,15,8,0.15)' }} maxLength={2} />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'rgba(28,15,8,0.5)' }}>Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ingredients or short description"
                  rows={2}
                  className="w-full text-sm border rounded-xl px-3 py-2 outline-none resize-none"
                  style={{ borderColor: 'rgba(28,15,8,0.15)' }} />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'rgba(28,15,8,0.5)' }}>Price (Rs) *</label>
                  <input required type="number" min="1" value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="1295"
                    className="w-full text-sm border rounded-xl px-3 py-2 outline-none"
                    style={{ borderColor: 'rgba(28,15,8,0.15)' }} />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'rgba(28,15,8,0.5)' }}>Category *</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full text-sm border rounded-xl px-3 py-2 outline-none bg-white"
                    style={{ borderColor: 'rgba(28,15,8,0.15)' }}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm border"
                  style={{ borderColor: 'rgba(28,15,8,0.15)', color: 'rgba(28,15,8,0.5)' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm text-white font-medium"
                  style={{ background: saving ? 'rgba(28,15,8,0.3)' : 'var(--espresso)' }}>
                  {saving ? 'Adding…' : 'Add item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}