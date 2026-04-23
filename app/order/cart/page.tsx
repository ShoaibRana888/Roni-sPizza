/**
 * FILE: app/order/cart/page.tsx
 * PURPOSE: Customer cart review page.
 *
 * CHANGES:
 *   - Customer name / car number is now MANDATORY before placing an order.
 *   - Added a Dine In / To My Car toggle so customers can specify delivery type.
 *   - Car orders are prefixed with 🚗 in customer_name so staff can identify them instantly.
 */

'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'
import { useCartStore, resolveItemPrice } from '@/lib/cartStore'
import { formatPrice } from '@/lib/utils'
import { supabase } from '../../../lib/supabase'

function CartPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const table = searchParams.get('table') || '1'
  const addOn = searchParams.get('addOn') === '1'

  const { items, updateQuantity, removeItem, total, itemCount, customerName, setCustomerName } = useCartStore()

  const [submitting, setSubmitting]     = useState(false)
  const [deliveryType, setDeliveryType] = useState<'dine-in' | 'car'>('dine-in')
  const [nameError, setNameError]       = useState(false)

  const placeOrder = async () => {
    if (items.length === 0 || submitting) return

    const trimmed = customerName.trim()
    if (!trimmed) {
      setNameError(true)
      return
    }
    setNameError(false)
    setSubmitting(true)

    // Prefix car orders so staff can identify them on the dashboard
    const displayName = deliveryType === 'car' ? `🚗 ${trimmed}` : trimmed

    const { data, error } = await supabase.from('orders').insert({
      table_number: table,
      customer_name: displayName,
      items,
      total: total(),
      status: 'new',
    }).select().single()

    if (error) {
      console.error('Order failed:', error)
      setSubmitting(false)
      return
    }

    sessionStorage.setItem(`ronis_table_${table}_order_time`, String(Date.now()))
    router.push(`/order/confirm?table=${table}&orderId=${data.id}`)
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
        style={{ background: 'var(--cream)' }}>
        <span className="text-5xl mb-4">🛒</span>
        <p className="font-serif text-xl mb-2">Your cart is empty</p>
        <p className="text-sm mb-6" style={{ color: 'rgba(28,15,8,0.45)' }}>Add something from the menu</p>
        <button onClick={() => router.push(`/order?table=${table}${addOn ? '&addOn=1' : ''}`)}
          className="px-6 py-3 rounded-xl text-white text-sm font-medium"
          style={{ background: 'var(--espresso)' }}>
          Back to menu
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--cream)' }}>

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b flex items-center gap-3 px-5 py-4"
        style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
        <button onClick={() => router.push(`/order?table=${table}${addOn ? '&addOn=1' : ''}`)}
          className="text-xl" style={{ color: 'rgba(28,15,8,0.45)' }}>←</button>
        <h1 className="font-serif text-xl">{addOn ? 'Add more items' : 'Your cart'}</h1>
        <span className="ml-auto text-xs" style={{ color: 'rgba(28,15,8,0.4)' }}>Table {table}</span>
      </div>

      <div className="flex-1 p-5 space-y-3 pb-48">

        {/* Cart items */}
        {items.map((cartItem, i) => {
          const itemPrice = resolveItemPrice(cartItem)
          return (
            <div key={i} className="bg-white rounded-2xl border p-4 flex gap-3"
              style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
              <span className="text-2xl">{cartItem.menuItem.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{cartItem.menuItem.name}</p>
                {cartItem.selectedOptions && Object.keys(cartItem.selectedOptions).length > 0 && (
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(28,15,8,0.4)' }}>
                    {Object.values(cartItem.selectedOptions).join(' · ')}
                  </p>
                )}
                {cartItem.notes && (
                  <p className="text-xs mt-0.5 italic" style={{ color: 'rgba(28,15,8,0.4)' }}>
                    "{cartItem.notes}"
                  </p>
                )}
                <p className="text-sm mt-1 font-medium" style={{ color: 'var(--latte)' }}>
                  {formatPrice(itemPrice * cartItem.quantity)}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={() => removeItem(cartItem.menuItem.id, cartItem.selectedOptions)}
                  className="text-xs" style={{ color: 'rgba(28,15,8,0.3)' }}>✕</button>
                <div className="flex items-center gap-2 border rounded-lg px-2 py-1"
                  style={{ borderColor: 'rgba(28,15,8,0.12)' }}>
                  <button
                    onClick={() => updateQuantity(cartItem.menuItem.id, cartItem.quantity - 1, cartItem.selectedOptions)}
                    className="text-base w-5 text-center">−</button>
                  <span className="text-sm font-medium w-4 text-center">{cartItem.quantity}</span>
                  <button
                    onClick={() => updateQuantity(cartItem.menuItem.id, cartItem.quantity + 1, cartItem.selectedOptions)}
                    className="text-base w-5 text-center">+</button>
                </div>
              </div>
            </div>
          )
        })}

        {/* Name / Car number — MANDATORY */}
        <div
          className="bg-white rounded-2xl border p-4 space-y-3"
          style={{ borderColor: nameError ? '#EF4444' : 'rgba(28,15,8,0.08)' }}>

          {/* Dine In / To My Car toggle */}
          <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(28,15,8,0.12)' }}>
            <button
              onClick={() => { setDeliveryType('dine-in'); setCustomerName(''); setNameError(false) }}
              className="flex-1 py-2 text-xs font-medium transition-all"
              style={{
                background: deliveryType === 'dine-in' ? 'var(--espresso)' : '#fff',
                color:      deliveryType === 'dine-in' ? '#fff' : 'rgba(28,15,8,0.5)',
              }}>
              🪑 Dine In
            </button>
            <button
              onClick={() => { setDeliveryType('car'); setCustomerName(''); setNameError(false) }}
              className="flex-1 py-2 text-xs font-medium transition-all"
              style={{
                background: deliveryType === 'car' ? 'var(--espresso)' : '#fff',
                color:      deliveryType === 'car' ? '#fff' : 'rgba(28,15,8,0.5)',
              }}>
              🚗 To My Car
            </button>
          </div>

          {/* Label */}
          <div>
            <p className="text-xs font-medium mb-1.5"
              style={{ color: nameError ? '#EF4444' : 'rgba(28,15,8,0.45)' }}>
              {deliveryType === 'dine-in' ? 'Your name' : 'Car number / description'}
              <span style={{ color: '#EF4444' }}> *</span>
            </p>
            <input
              type="text"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value)
                if (e.target.value.trim()) setNameError(false)
              }}
              placeholder={
                deliveryType === 'dine-in'
                  ? 'e.g. Ahmed'
                  : 'e.g. White Corolla · LEA-4821'
              }
              className="w-full text-sm outline-none"
              style={{ color: 'var(--espresso)' }}
            />
            {nameError && (
              <p className="text-xs mt-1.5" style={{ color: '#EF4444' }}>
                {deliveryType === 'dine-in'
                  ? 'Please enter your name to place the order.'
                  : 'Please enter your car number so we can find you.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer — totals + place order */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-white border-t space-y-3"
        style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
        <div className="flex justify-between text-sm">
          <span style={{ color: 'rgba(28,15,8,0.5)' }}>
            {itemCount()} item{itemCount() !== 1 ? 's' : ''}
          </span>
          <span className="font-medium">{formatPrice(total())}</span>
        </div>

        <button
          onClick={placeOrder}
          disabled={submitting}
          className="w-full py-4 rounded-2xl text-white font-medium text-sm transition-all"
          style={{ background: submitting ? 'rgba(28,15,8,0.3)' : 'var(--espresso)' }}>
          {submitting
            ? (addOn ? 'Adding items…' : 'Placing order…')
            : (addOn ? `Add to order · ${formatPrice(total())}` : `Place order · ${formatPrice(total())}`)}
        </button>

        <p className="text-center text-xs" style={{ color: 'rgba(28,15,8,0.3)' }}>
          Pay at the counter when your order is ready
        </p>
      </div>
    </div>
  )
}

export default function CartPage() {
  return <Suspense><CartPageInner /></Suspense>
}