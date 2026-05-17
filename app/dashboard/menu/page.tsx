/**
 * FILE: app/dashboard/menu/page.tsx
 * PURPOSE: Menu management — add, edit, delete items, toggle availability,
 *          upload photos. All changes persist to Supabase immediately.
 * ROUTE: /dashboard/menu
 *
 * CHANGES:
 *   - Edit button added to each item card (pencil icon, sits next to Delete)
 *   - Clicking Edit opens the same form modal pre-populated with item values
 *   - Save changes calls supabase.update() instead of insert()
 *   - Photo can be replaced during an edit
 *   - Customization options (Size/Crust) can be edited — each option is an
 *     editable text input so staff can update prices inline (e.g. "Medium – Rs 1395")
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, MenuItem, Customization } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'

const CATEGORIES = ['Classic Pizzas', "Roni's Specials", 'Protein Specials', 'Drinks', 'Extras']

interface FormState {
  name: string
  description: string
  price: string
  category: string
  emoji: string
  available: boolean
  imageFile: File | null
  // Customizations as an editable list
  customizations: { label: string; options: string[]; required: boolean }[]
}

const BLANK_FORM: FormState = {
  name: '', description: '', price: '', category: CATEGORIES[0], emoji: '🍕',
  available: true, imageFile: null, customizations: [],
}

function itemToForm(item: MenuItem): FormState {
  return {
    name:           item.name,
    description:    item.description,
    price:          String(item.price),
    category:       item.category,
    emoji:          item.emoji,
    available:      item.available,
    imageFile:      null,
    customizations: (item.customizations ?? []).map((c) => ({
      label:    c.label,
      options:  [...c.options],
      required: c.required,
    })),
  }
}

async function uploadImage(file: File): Promise<string | null> {
  const ext  = file.name.split('.').pop()
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage
    .from('menu-images')
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) { console.error('Image upload failed:', error); return null }
  const { data } = supabase.storage.from('menu-images').getPublicUrl(path)
  return data.publicUrl
}

export default function MenuPage() {
  const [items, setItems]             = useState<MenuItem[]>([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)  // null = add mode
  const [form, setForm]               = useState<FormState>(BLANK_FORM)
  const [saving, setSaving]           = useState(false)
  const [uploading, setUploading]     = useState(false)
  const [deleteId, setDeleteId]       = useState<string | null>(null)
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null)
  const photoInputRef  = useRef<HTMLInputElement>(null)
  const photoTargetId  = useRef<string | null>(null)

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

  // ── Open add modal ──────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditingItem(null)
    setForm(BLANK_FORM)
    setShowForm(true)
  }

  // ── Open edit modal ─────────────────────────────────────────────────────────
  const openEdit = (item: MenuItem) => {
    setEditingItem(item)
    setForm(itemToForm(item))
    setShowForm(true)
  }

  // ── Toggle availability ─────────────────────────────────────────────────────
  const toggle = async (item: MenuItem) => {
    const next = !item.available
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, available: next } : i))
    await supabase.from('menu_items').update({ available: next }).eq('id', item.id)
  }

  // ── Save (add or edit) ──────────────────────────────────────────────────────
  const saveForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    if (form.imageFile && form.imageFile.size > 2 * 1024 * 1024) {
      alert('Image must be under 2 MB')
      setSaving(false)
      return
    }

    let image_url: string | null | undefined = undefined

    if (form.imageFile) {
      setUploading(true)
      image_url = await uploadImage(form.imageFile)
      setUploading(false)
    }

    const payload: Record<string, unknown> = {
      name:           form.name.trim(),
      description:    form.description.trim(),
      price:          parseInt(form.price),
      category:       form.category,
      emoji:          form.emoji || '🍕',
      available:      form.available,
      customizations: form.customizations,
    }
    if (image_url !== undefined) payload.image_url = image_url

    if (editingItem) {
      // ── EDIT ──
      const { data, error } = await supabase
        .from('menu_items')
        .update(payload)
        .eq('id', editingItem.id)
        .select()
        .single()

      if (!error && data) {
        setItems((prev) => prev.map((i) => i.id === editingItem.id ? data as MenuItem : i))
        setShowForm(false)
        setEditingItem(null)
      }
    } else {
      // ── ADD ──
      const { data, error } = await supabase
        .from('menu_items')
        .insert({ ...payload, image_url: image_url ?? null })
        .select()
        .single()

      if (!error && data) {
        setItems((prev) => [...prev, data as MenuItem])
        setShowForm(false)
      }
    }

    setSaving(false)
  }

  // ── Photo upload for existing items ────────────────────────────────────────
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const id   = photoTargetId.current
    if (!file || !id) return
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2 MB'); return }
    setUploadingPhotoId(id)
    const url = await uploadImage(file)
    if (url) {
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, image_url: url } : i))
      await supabase.from('menu_items').update({ image_url: url }).eq('id', id)
    }
    setUploadingPhotoId(null)
    e.target.value = ''
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  const deleteItem = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
    setDeleteId(null)
    await supabase.from('menu_items').delete().eq('id', id)
  }

  // ── Customization helpers ───────────────────────────────────────────────────
  const addCustomization = () => {
    setForm((f) => ({
      ...f,
      customizations: [...f.customizations, { label: '', options: [''], required: true }],
    }))
  }

  const removeCustomization = (ci: number) => {
    setForm((f) => ({
      ...f,
      customizations: f.customizations.filter((_, i) => i !== ci),
    }))
  }

  const updateCustomizationLabel = (ci: number, label: string) => {
    setForm((f) => ({
      ...f,
      customizations: f.customizations.map((c, i) => i === ci ? { ...c, label } : c),
    }))
  }

  const updateOption = (ci: number, oi: number, value: string) => {
    setForm((f) => ({
      ...f,
      customizations: f.customizations.map((c, i) =>
        i === ci
          ? { ...c, options: c.options.map((o, j) => j === oi ? value : o) }
          : c,
      ),
    }))
  }

  const addOption = (ci: number) => {
    setForm((f) => ({
      ...f,
      customizations: f.customizations.map((c, i) =>
        i === ci ? { ...c, options: [...c.options, ''] } : c,
      ),
    }))
  }

  const removeOption = (ci: number, oi: number) => {
    setForm((f) => ({
      ...f,
      customizations: f.customizations.map((c, i) =>
        i === ci ? { ...c, options: c.options.filter((_, j) => j !== oi) } : c,
      ),
    }))
  }

  const categories = [...new Set(items.map((i) => i.category))]

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <header
        className="h-14 bg-white border-b flex items-center justify-between px-6 flex-shrink-0"
        style={{ borderColor: 'rgba(28,15,8,0.08)' }}
      >
        <h1 className="text-base font-medium">Menu</h1>
        <button
          onClick={openAdd}
          className="text-xs font-medium px-3 py-1.5 rounded-lg text-white"
          style={{ background: 'var(--espresso)' }}
        >
          + Add item
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {loading ? (
          <p className="text-sm text-center py-12" style={{ color: 'rgba(28,15,8,0.3)' }}>
            Loading menu…
          </p>
        ) : categories.map((cat) => (
          <div key={cat}>
            <h2
              className="text-xs font-medium uppercase tracking-widest mb-3"
              style={{ color: 'rgba(28,15,8,0.35)' }}
            >
              {cat}
            </h2>

            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
            >
              {items.filter((i) => i.category === cat).map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border p-4 flex gap-3 transition-all"
                  style={{ borderColor: 'rgba(28,15,8,0.08)', opacity: item.available ? 1 : 0.5 }}
                >
                  {/* Photo area */}
                  <button
                    type="button"
                    className="relative shrink-0 group"
                    title={item.image_url ? 'Change photo' : 'Add photo'}
                    onClick={() => { photoTargetId.current = item.id; photoInputRef.current?.click() }}
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-14 h-14 rounded-xl object-cover"
                      />
                    ) : (
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                        style={{ background: 'var(--foam)' }}
                      >
                        {item.emoji}
                      </div>
                    )}
                    {uploadingPhotoId === item.id && (
                      <div
                        className="absolute inset-0 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.8)' }}
                      >
                        <span className="text-xs" style={{ color: 'rgba(28,15,8,0.5)' }}>…</span>
                      </div>
                    )}
                    <div
                      className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                      style={{ background: 'rgba(28,15,8,0.45)' }}
                    >
                      <span className="text-white text-xs font-medium">📷</span>
                    </div>
                  </button>

                  {/* Item info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.name}</p>
                    <p
                      className="text-xs mt-0.5 line-clamp-2"
                      style={{ color: 'rgba(28,15,8,0.45)' }}
                    >
                      {item.description}
                    </p>
                    <p className="text-sm mt-1 font-medium" style={{ color: 'var(--latte)' }}>
                      {formatPrice(item.price)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {/* Availability toggle */}
                    <button
                      onClick={() => toggle(item)}
                      title={item.available ? 'Mark unavailable' : 'Mark available'}
                      className="relative w-10 h-5 rounded-full transition-colors"
                      style={{ background: item.available ? 'var(--sage)' : 'rgba(28,15,8,0.12)' }}
                    >
                      <span
                        className="absolute top-1 w-3 h-3 rounded-full bg-white transition-all"
                        style={{ left: item.available ? '22px' : '4px' }}
                      />
                    </button>

                    {/* Edit button */}
                    <button
                      onClick={() => openEdit(item)}
                      className="text-xs px-2 py-1 rounded-lg border transition-all"
                      style={{ borderColor: 'rgba(28,15,8,0.12)', color: 'rgba(28,15,8,0.5)' }}
                    >
                      Edit
                    </button>

                    {/* Delete button */}
                    {deleteId === item.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="text-xs px-2 py-1 rounded-lg text-white"
                          style={{ background: '#C0392B' }}
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setDeleteId(null)}
                          className="text-xs px-2 py-1 rounded-lg border"
                          style={{ borderColor: 'rgba(28,15,8,0.15)', color: 'rgba(28,15,8,0.5)' }}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteId(item.id)}
                        className="text-xs px-2 py-1 rounded-lg border transition-all"
                        style={{ borderColor: 'rgba(28,15,8,0.12)', color: 'rgba(28,15,8,0.35)' }}
                      >
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

      {/* Hidden input for in-card photo uploads */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoChange}
      />

      {/* Add / Edit modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center"
          style={{ background: 'rgba(28,15,8,0.4)' }}
          onClick={() => { setShowForm(false); setEditingItem(null) }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col"
            style={{ maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
              style={{ borderColor: 'rgba(28,15,8,0.08)' }}
            >
              <h2 className="text-base font-medium">
                {editingItem ? `Edit — ${editingItem.name}` : 'Add menu item'}
              </h2>
              <button
                onClick={() => { setShowForm(false); setEditingItem(null) }}
                className="text-lg"
                style={{ color: 'rgba(28,15,8,0.3)' }}
              >
                ✕
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <form id="menu-form" onSubmit={saveForm} className="flex flex-col gap-4">

                {/* Name + Emoji */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'rgba(28,15,8,0.5)' }}>
                      Name *
                    </label>
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. BBQ Chicken"
                      className="w-full text-sm border rounded-xl px-3 py-2 outline-none"
                      style={{ borderColor: 'rgba(28,15,8,0.15)' }}
                    />
                  </div>
                  <div style={{ width: 72 }}>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'rgba(28,15,8,0.5)' }}>
                      Emoji
                    </label>
                    <input
                      value={form.emoji}
                      onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                      className="w-full text-center text-xl border rounded-xl px-2 py-2 outline-none"
                      style={{ borderColor: 'rgba(28,15,8,0.15)' }}
                      maxLength={2}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'rgba(28,15,8,0.5)' }}>
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Ingredients or short description"
                    rows={2}
                    className="w-full text-sm border rounded-xl px-3 py-2 outline-none resize-none"
                    style={{ borderColor: 'rgba(28,15,8,0.15)' }}
                  />
                </div>

                {/* Price + Category */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'rgba(28,15,8,0.5)' }}>
                      Base price (Rs) *
                    </label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      placeholder="1295"
                      className="w-full text-sm border rounded-xl px-3 py-2 outline-none"
                      style={{ borderColor: 'rgba(28,15,8,0.15)' }}
                    />
                    <p className="text-xs mt-1" style={{ color: 'rgba(28,15,8,0.35)' }}>
                      Used when no size option is selected
                    </p>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'rgba(28,15,8,0.5)' }}>
                      Category *
                    </label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full text-sm border rounded-xl px-3 py-2 outline-none bg-white"
                      style={{ borderColor: 'rgba(28,15,8,0.15)' }}
                    >
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {/* Customizations (Size, Crust, Protein, etc.) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium" style={{ color: 'rgba(28,15,8,0.5)' }}>
                      Customizations
                    </label>
                    <button
                      type="button"
                      onClick={addCustomization}
                      className="text-xs px-2 py-1 rounded-lg border"
                      style={{ borderColor: 'rgba(28,15,8,0.15)', color: 'rgba(28,15,8,0.5)' }}
                    >
                      + Add group
                    </button>
                  </div>

                  {form.customizations.length === 0 && (
                    <p className="text-xs" style={{ color: 'rgba(28,15,8,0.3)' }}>
                      No customizations yet. Add a group like "Size" or "Crust".
                    </p>
                  )}

                  <div className="space-y-3">
                    {form.customizations.map((c, ci) => (
                      <div
                        key={ci}
                        className="rounded-xl p-3"
                        style={{ background: 'rgba(28,15,8,0.03)', border: '1px solid rgba(28,15,8,0.08)' }}
                      >
                        {/* Group label + required toggle + remove */}
                        <div className="flex gap-2 mb-2 items-center">
                          <input
                            value={c.label}
                            onChange={(e) => updateCustomizationLabel(ci, e.target.value)}
                            placeholder="Group name (e.g. Size)"
                            className="flex-1 text-xs border rounded-lg px-2 py-1.5 outline-none"
                            style={{ borderColor: 'rgba(28,15,8,0.15)' }}
                          />
                          <label className="flex items-center gap-1 text-xs cursor-pointer"
                            style={{ color: 'rgba(28,15,8,0.45)' }}>
                            <input
                              type="checkbox"
                              checked={c.required}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  customizations: f.customizations.map((x, i) =>
                                    i === ci ? { ...x, required: e.target.checked } : x,
                                  ),
                                }))
                              }
                            />
                            Required
                          </label>
                          <button
                            type="button"
                            onClick={() => removeCustomization(ci)}
                            className="text-xs px-1.5 py-1 rounded"
                            style={{ color: '#C0392B' }}
                          >
                            ✕
                          </button>
                        </div>

                        {/* Options */}
                        <div className="space-y-1.5">
                          {c.options.map((opt, oi) => (
                            <div key={oi} className="flex gap-1.5 items-center">
                              <input
                                value={opt}
                                onChange={(e) => updateOption(ci, oi, e.target.value)}
                                placeholder={
                                  c.label === 'Size'
                                    ? 'e.g. Medium – Rs 1295'
                                    : c.label === 'Crust'
                                    ? 'e.g. Thin Crust'
                                    : 'Option'
                                }
                                className="flex-1 text-xs border rounded-lg px-2 py-1.5 outline-none"
                                style={{ borderColor: 'rgba(28,15,8,0.15)' }}
                              />
                              {c.options.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeOption(ci, oi)}
                                  className="text-xs px-1 rounded"
                                  style={{ color: 'rgba(28,15,8,0.3)' }}
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addOption(ci)}
                            className="text-xs mt-1"
                            style={{ color: 'rgba(28,15,8,0.35)' }}
                          >
                            + Add option
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Photo */}
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'rgba(28,15,8,0.5)' }}>
                    {editingItem?.image_url ? 'Replace photo (optional, max 2 MB)' : 'Photo (optional, max 2 MB)'}
                  </label>
                  {editingItem?.image_url && !form.imageFile && (
                    <img
                      src={editingItem.image_url}
                      alt="current"
                      className="w-16 h-16 rounded-xl object-cover mb-2"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setForm({ ...form, imageFile: e.target.files?.[0] ?? null })}
                    className="w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:cursor-pointer"
                    style={{ color: 'rgba(28,15,8,0.5)' }}
                  />
                  {form.imageFile && (
                    <p className="text-xs mt-1" style={{ color: 'rgba(28,15,8,0.4)' }}>
                      {form.imageFile.name}
                    </p>
                  )}
                </div>

              </form>
            </div>

            {/* Sticky footer with action buttons */}
            <div
              className="flex gap-3 px-6 py-4 border-t flex-shrink-0"
              style={{ borderColor: 'rgba(28,15,8,0.08)' }}
            >
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingItem(null) }}
                className="flex-1 py-2.5 rounded-xl text-sm border"
                style={{ borderColor: 'rgba(28,15,8,0.15)', color: 'rgba(28,15,8,0.5)' }}
              >
                Cancel
              </button>
              <button
                form="menu-form"
                type="submit"
                disabled={saving || uploading}
                className="flex-1 py-2.5 rounded-xl text-sm text-white font-medium"
                style={{ background: (saving || uploading) ? 'rgba(28,15,8,0.3)' : 'var(--espresso)' }}
              >
                {uploading
                  ? 'Uploading…'
                  : saving
                  ? (editingItem ? 'Saving…' : 'Adding…')
                  : (editingItem ? 'Save changes' : 'Add item')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}