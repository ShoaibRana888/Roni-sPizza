/**
 * FILE: lib/cartStore.ts
 * PURPOSE: Global cart state using Zustand.
 *
 * FIXES:
 *   - addItem now accepts an optional `quantity` param so the modal can add
 *     multiple drinks/extras in one tap instead of calling addItem N times.
 *   - removeItem and updateQuantity match on BOTH menuItem.id AND selectedOptions
 *     so the correct size variant is targeted (not just first match by id).
 */

import { create } from 'zustand'
import { CartItem, MenuItem } from './supabase'

/**
 * Extract the actual price for a cart item based on its selected options.
 * Looks for "Rs <number>" in any option value (e.g. "Large – Rs 1995").
 * Falls back to menuItem.price for items without size pricing (drinks, extras).
 */
export function resolveItemPrice(item: CartItem): number {
  if (item.selectedOptions) {
    for (const value of Object.values(item.selectedOptions)) {
      const match = value.match(/Rs\s*([\d,]+)/)
      if (match) {
        const parsed = parseInt(match[1].replace(/,/g, ''), 10)
        if (!isNaN(parsed)) return parsed
      }
    }
  }
  return item.menuItem.price
}

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

  /**
   * Add an item to the cart.
   * - Merges with an existing entry if same item + same options (increments qty).
   * - `quantity` defaults to 1; pass a higher value when the modal stepper > 1.
   */
  addItem: (
    item: MenuItem,
    options?: Record<string, string>,
    notes?: string,
    quantity?: number,
  ) => void

  /** Remove a specific size/option variant by id + selectedOptions. */
  removeItem: (itemId: string, selectedOptions?: Record<string, string>) => void

  /** Update quantity of a specific variant; removes it if qty drops to 0. */
  updateQuantity: (
    itemId: string,
    quantity: number,
    selectedOptions?: Record<string, string>,
  ) => void

  clearCart: () => void
  setTableNumber: (table: string) => void
  setCustomerName: (name: string) => void

  total: () => number
  itemCount: () => number
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  tableNumber: '',
  customerName: '',

  addItem: (menuItem, selectedOptions, notes, quantity = 1) => {
    const existing = get().items.find(
      (i) =>
        i.menuItem.id === menuItem.id &&
        optionsMatch(i.selectedOptions, selectedOptions),
    )
    if (existing) {
      set((state) => ({
        items: state.items.map((i) =>
          i.menuItem.id === menuItem.id &&
          optionsMatch(i.selectedOptions, selectedOptions)
            ? { ...i, quantity: i.quantity + quantity }
            : i,
        ),
      }))
    } else {
      set((state) => ({
        items: [
          ...state.items,
          { menuItem, quantity, selectedOptions, notes },
        ],
      }))
    }
  },

  removeItem: (itemId, selectedOptions) => {
    set((state) => ({
      items: state.items.filter(
        (i) =>
          !(
            i.menuItem.id === itemId &&
            optionsMatch(i.selectedOptions, selectedOptions)
          ),
      ),
    }))
  },

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
          : i,
      ),
    }))
  },

  clearCart: () => set({ items: [], tableNumber: '', customerName: '' }),
  setTableNumber: (table) => set({ tableNumber: table }),
  setCustomerName: (name) => set({ customerName: name }),

  total: () =>
    get().items.reduce(
      (sum, item) => sum + resolveItemPrice(item) * item.quantity,
      0,
    ),

  itemCount: () =>
    get().items.reduce((sum, item) => sum + item.quantity, 0),
}))