/**
 * FILE: app/order/confirm/page.tsx
 * PURPOSE: Order confirmation screen — shown to customers after successfully placing an order.
 *          - Clears the cart so it's ready for the next session
 *          - Displays the order reference number and table number
 *          - Explains what happens next (prep → delivery → pay at counter)
 *          - Offers a link to order something else (only if the table resets)
 * ROUTE: /order/confirm?table=1&orderId=ord-123
 * ACCESSED BY: Customers — redirected here automatically after placing order
 */

'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, Suspense } from 'react'
import { useCartStore } from '@/lib/cartStore'

function ConfirmPageInner() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const table   = searchParams.get('table')   || '1'
  const orderId = searchParams.get('orderId') || ''

  const { clearCart } = useCartStore()

  // Clear the cart as soon as the confirmation page loads
  useEffect(() => {
    clearCart()
  }, [clearCart])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
      style={{ background: 'var(--cream)' }}>

      {/* Success checkmark */}
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ background: 'var(--sage)' }}>
        <span className="text-white text-3xl">✓</span>
      </div>

      <h1 className="font-serif text-3xl mb-2">Order placed!</h1>
      <p className="text-sm mb-1" style={{ color: 'rgba(28,15,8,0.5)' }}>
        We've got your order for Table {table}
      </p>
      {/* Short order reference for staff to cross-check */}
      <p className="text-xs mb-8" style={{ color: 'rgba(28,15,8,0.35)' }}>
        Ref: #{orderId.slice(-6).toUpperCase()}
      </p>

      {/* "What happens next" card */}
      <div className="bg-white rounded-2xl border w-full max-w-xs p-5 mb-8 text-left"
        style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
        <p className="text-xs font-medium uppercase tracking-wider mb-3"
          style={{ color: 'rgba(28,15,8,0.35)' }}>What happens next</p>
        {[
          { icon: '🍕', text: 'Your order is being prepared' },
          { icon: '🔔', text: "We'll bring it to your table" },
          { icon: '💳', text: 'Pay at the counter when done' },
        ].map((step, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <span className="text-lg">{step.icon}</span>
            <span className="text-sm" style={{ color: 'rgba(28,15,8,0.65)' }}>{step.text}</span>
          </div>
        ))}
      </div>

      {/* Note: table is locked until the order completes or 1 hour passes */}
      <p className="text-xs mb-4" style={{ color: 'rgba(28,15,8,0.3)' }}>
        You can place another order once this one is collected.
      </p>

      <button onClick={() => router.push(`/order?table=${table}`)}
        className="px-8 py-3 rounded-xl border text-sm font-medium transition-all"
        style={{ borderColor: 'rgba(28,15,8,0.2)', color: 'rgba(28,15,8,0.7)' }}>
        Back to menu
      </button>
    </div>
  )
}

export default function ConfirmPage() {
  return <Suspense><ConfirmPageInner /></Suspense>
}