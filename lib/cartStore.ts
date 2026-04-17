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
 *
 * FIX: removeItem and updateQuantity now accept an optional selectedOptions
 *      parameter and match on BOTH menuItem.id AND selectedOptions. This
 *      prevents the wrong size variant from being removed/updated when the
 *      same pizza is in the cart in two different sizes.
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

/** Returns true if two selectedOptions maps are identical */
function optionsMatch(
  a: Record<string, string> | undefined,
  b: Record<string, string> | undefined,
): boolean {
  return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {})
}

interface CartStore {
  items: CartItem[]
  tableNumber: string
  customerName: string

  // Add an item to cart (merges with existing if same item + same options)
  addItem: (item: MenuItem, options?: Record<string, string>, notes?: string) => void

  // Remove an item by its menu item ID + selected options (both must match)
  removeItem: (itemId: string, selectedOptions?: Record<string, string>) => void

  // Update quantity — removes item if quantity drops to 0
  updateQuantity: (itemId: string, quantity: number, selectedOptions?: Record<string, string>) => void

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
        optionsMatch(i.selectedOptions, selectedOptions)
    )
    if (existing) {
      set((state) => ({
        items: state.items.map((i) =>
          i.menuItem.id === menuItem.id &&
          optionsMatch(i.selectedOptions, selectedOptions)
            ? { ...i, quantity: i.quantity + 1 }
            : i
        ),
      }))
    } else {
      set((state) => ({
        items: [
          ...state.items,
          { menuItem, quantity: 1, selectedOptions, notes },
        ],
      }))
    }
  },

  // FIX: match by both menuItem.id AND selectedOptions so removing "Large"
  // doesn't accidentally remove the "Medium" variant of the same pizza.
  removeItem: (itemId, selectedOptions) => {
    set((state) => ({
      items: state.items.filter(
        (i) =>
          !(
            i.menuItem.id === itemId &&
            optionsMatch(i.selectedOptions, selectedOptions)
          )
      ),
    }))
  },

  // FIX: same matching logic as removeItem for consistency.
  updateQuantity: (itemId, quantity, selectedOptions) => {
    if (quantity <= 0) {
      get().removeItem(itemId, selectedOptions)
      return
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.menuItem.id === itemId &&
        optionsMatch(i.selectedOptions, selectedOptions)
          ? { ...i, quantity }
          : i
      ),
    }))
  },

  clearCart: () => set({ items: [], tableNumber: '', customerName: '' }),

  setTableNumber: (table) => set({ tableNumber: table }),
  setCustomerName: (name) => set({ customerName: name }),

  total: () =>
    get().items.reduce(
      (sum, item) => sum + resolveItemPrice(item) * item.quantity,
      0
    ),

  itemCount: () =>
    get().items.reduce((sum, item) => sum + item.quantity, 0),
}))