/**
 * FILE: lib/cartStore.ts
 * PURPOSE: Global cart state using Zustand.
 *          Tracks items in the customer's cart, their selected options, quantities,
 *          customer name, and table number.
 *          Persists in memory for the duration of the browser session.
 * USED BY: app/order/page.tsx, app/order/cart/page.tsx, app/order/confirm/page.tsx
 *
 * PRICE LOGIC:
 *   Pizza sizes are encoded in the option label itself, e.g. "Large – Rs 2395".
 *   resolveItemPrice() extracts that number so the cart always charges the
 *   correct size price rather than the base menu price.
 */

import { create } from 'zustand'
import { CartItem, MenuItem } from './supabase'

/**
 * Extract the actual price for a cart item based on its selected options.
 *
 * If the customer selected a "Size" option like "Large – Rs 2395",
 * we parse the Rs value out and use that instead of the base menu price.
 * Falls back to menuItem.price if no parseable price is found.
 *
 * Examples:
 *   "Medium – Rs 1295"  → 1295
 *   "Large – Rs 1995"   → 1995
 *   "Thin Crust"        → null (no price in this option, ignored)
 */
export function resolveItemPrice(item: CartItem): number {
  if (item.selectedOptions) {
    // Look for any option value that contains "Rs <number>"
    for (const value of Object.values(item.selectedOptions)) {
      const match = value.match(/Rs\s*([\d,]+)/)
      if (match) {
        const parsed = parseInt(match[1].replace(/,/g, ''), 10)
        if (!isNaN(parsed)) return parsed
      }
    }
  }
  // No size option found — use the base menu price (e.g. drinks, extras)
  return item.menuItem.price
}

interface CartStore {
  items: CartItem[]
  tableNumber: string
  customerName: string

  // Add an item to cart (merges with existing if same item + same options)
  addItem: (item: MenuItem, options?: Record<string, string>, notes?: string) => void

  // Remove an item entirely by its menu item ID
  removeItem: (itemId: string) => void

  // Update quantity — removes item if quantity drops to 0
  updateQuantity: (itemId: string, quantity: number) => void

  // Clear everything (called after order is placed)
  clearCart: () => void

  setTableNumber: (table: string) => void
  setCustomerName: (name: string) => void

  // Computed values — both use resolveItemPrice() for correct size pricing
  total: () => number
  itemCount: () => number
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  tableNumber: '',
  customerName: '',

  addItem: (menuItem, selectedOptions, notes) => {
    const existing = get().items.find(
      (i) =>
        i.menuItem.id === menuItem.id &&
        JSON.stringify(i.selectedOptions) === JSON.stringify(selectedOptions)
    )
    if (existing) {
      set((state) => ({
        items: state.items.map((i) =>
          i.menuItem.id === menuItem.id &&
          JSON.stringify(i.selectedOptions) === JSON.stringify(selectedOptions)
            ? { ...i, quantity: i.quantity + 1 }
            : i
        ),
      }))
    } else {
      set((state) => ({
        items: [...state.items, { menuItem, quantity: 1, selectedOptions, notes }],
      }))
    }
  },

  removeItem: (itemId) => {
    set((state) => ({ items: state.items.filter((i) => i.menuItem.id !== itemId) }))
  },

  updateQuantity: (itemId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(itemId)
      return
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.menuItem.id === itemId ? { ...i, quantity } : i
      ),
    }))
  },

  clearCart: () => set({ items: [] }),

  setTableNumber: (tableNumber) => set({ tableNumber }),

  setCustomerName: (customerName) => set({ customerName }),

  // Uses resolveItemPrice so Large pizzas charge the Large price
  total: () =>
    get().items.reduce((sum, i) => sum + resolveItemPrice(i) * i.quantity, 0),

  itemCount: () =>
    get().items.reduce((sum, i) => sum + i.quantity, 0),
}))