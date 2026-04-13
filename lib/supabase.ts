/**
 * FILE: lib/supabase.ts
 * PURPOSE: Supabase client initialisation + all TypeScript types used across the app.
 *          Import `supabase` wherever you need to query the database.
 *          Import types (MenuItem, Order, etc.) wherever you need them.
 * USED BY: All pages and lib files that talk to the database
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Types ────────────────────────────────────────────────────────────────────

export type MenuCategory = 'Classic Pizzas' | "Roni's Specials" | 'Protein Specials' | 'Drinks' | 'Extras'

export interface Customization {
  label: string       // e.g. "Size"
  options: string[]   // e.g. ["Medium – Rs 1295", "Large – Rs 1495"]
  required: boolean
}

export interface MenuItem {
  id: string
  name: string
  description: string
  price: number           // in Rs (smallest unit)
  category: MenuCategory | string
  emoji: string
  available: boolean
  customizations?: Customization[]
  created_at: string
}

export interface CartItem {
  menuItem: MenuItem
  quantity: number
  notes?: string
  selectedOptions?: Record<string, string>  // e.g. { "Size": "Large – Rs 1495", "Crust": "Deep Pan" }
}

export type OrderStatus = 'new' | 'preparing' | 'done' | 'cancelled'

export interface Order {
  id: string
  table_number: string       // "1" | "2" | "3" | "4"
  customer_name?: string
  items: CartItem[]
  status: OrderStatus
  total: number              // in Rs
  notes?: string
  created_at: string
  updated_at: string
}