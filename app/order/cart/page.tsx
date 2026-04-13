/**
 * FILE: app/order/cart/page.tsx
 * PURPOSE: Customer cart review page — the step between browsing and confirming.
 *          - Shows all items with correct size-based pricing (e.g. Large = Rs 2395)
 *          - Allows quantity adjustments and item removal
 *          - Optional customer name field (shown on dashboard order card)
 *          - "Place order" submits the order and locks the table for 1 hour
 * ROUTE: /order/cart?table=1
 * ACCESSED BY: Customers (no login required)
 *
 * PRICE FIX: Uses resolveItemPrice() from cartStore to extract the actual price
 *            from the selected size option (e.g. "Large – Rs 2395" → 2395)
 *            instead of always showing the base menu price.
 */

'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useCartStore, resolveItemPrice } from '@/lib/cartStore'
import { formatPrice } from '@/lib/utils'

function CartPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const table = searchParams.get('table') || '1'

  const { items, updateQuantity, removeItem, total, itemCount, customerName, setCustomerName } = useCartStore()

  const placeOrder = async () => {
    if (items.length === 0) return

    // Lock this table for 1 hour so no second order can be placed
    sessionStorage.setItem(`ronis_table_${table}_order_time`, String(Date.now()))

    // TODO: Replace with real Supabase insert:
    // const { data, error } = await supabase.from('orders').insert({
    //   table_number: table,
    //   customer_name: customerName || null,
    //   items,
    //   total: total(),
    //   status: 'new',
    // }).select().single()
    // if (error) { console.error(error); return }
    // router.push(`/order/confirm?table=${table}&orderId=${data.id}`)

    const orderId = `ord-${Date.now()}`
    router.push(`/order/confirm?table=${table}&orderId=${orderId}`)
  }

  // ── Empty cart ────────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
        style={{ background: 'var(--cream)' }}>
        <span className="text-5xl mb-4">🛒</span>
        <p className="font-serif text-xl mb-2">Your cart is empty</p>
        <p className="text-sm mb-6" style={{ color: 'rgba(28,15,8,0.45)' }}>Add something from the menu</p>
        <button onClick={() => router.push(`/order?table=${table}`)}
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
        <button onClick={() => router.push(`/order?table=${table}`)}
          className="text-xl" style={{ color: 'rgba(28,15,8,0.45)' }}>←</button>
        <h1 className="font-serif text-xl">Your cart</h1>
        <span className="ml-auto text-xs" style={{ color: 'rgba(28,15,8,0.4)' }}>Table {table}</span>
      </div>

      <div className="flex-1 p-5 space-y-3 pb-48">

        {/* Cart items */}
        {items.map((cartItem, i) => {
          // Resolve the correct price based on selected size option
          const itemPrice = resolveItemPrice(cartItem)

          return (
            <div key={i} className="bg-white rounded-2xl border p-4 flex gap-3"
              style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
              <span className="text-2xl">{cartItem.menuItem.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{cartItem.menuItem.name}</p>

                {/* Selected options (e.g. "Large – Rs 2395 · Deep Pan") */}
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

                {/* Price — uses resolved size price, multiplied by quantity */}
                <p className="text-sm mt-1 font-medium" style={{ color: 'var(--latte)' }}>
                  {formatPrice(itemPrice * cartItem.quantity)}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                {/* Remove item */}
                <button onClick={() => removeItem(cartItem.menuItem.id)}
                  className="text-xs" style={{ color: 'rgba(28,15,8,0.3)' }}>✕</button>

                {/* Quantity stepper */}
                <div className="flex items-center gap-2 border rounded-lg px-2 py-1"
                  style={{ borderColor: 'rgba(28,15,8,0.12)' }}>
                  <button onClick={() => updateQuantity(cartItem.menuItem.id, cartItem.quantity - 1)}
                    className="text-base w-5 text-center">−</button>
                  <span className="text-sm font-medium w-4 text-center">{cartItem.quantity}</span>
                  <button onClick={() => updateQuantity(cartItem.menuItem.id, cartItem.quantity + 1)}
                    className="text-base w-5 text-center">+</button>
                </div>
              </div>
            </div>
          )
        })}

        {/* Optional name */}
        <div className="bg-white rounded-2xl border p-4" style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'rgba(28,15,8,0.45)' }}>
            Your name (optional)
          </p>
          <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
            placeholder="So we can call your order"
            className="w-full text-sm outline-none" style={{ color: 'var(--espresso)' }} />
        </div>
      </div>

      {/* Fixed bottom bar — total uses resolveItemPrice via store's total() */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-white border-t space-y-3"
        style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
        <div className="flex justify-between text-sm">
          <span style={{ color: 'rgba(28,15,8,0.5)' }}>
            {itemCount()} item{itemCount() !== 1 ? 's' : ''}
          </span>
          <span className="font-medium">{formatPrice(total())}</span>
        </div>
        <button onClick={placeOrder}
          className="w-full py-4 rounded-2xl text-white font-medium text-sm"
          style={{ background: 'var(--espresso)' }}>
          Place order · {formatPrice(total())}
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