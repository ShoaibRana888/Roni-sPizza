/**
 * FILE: lib/supabase.ts
 * PURPOSE: Supabase client + TypeScript types.
 *
 * Uses @supabase/ssr createBrowserClient so the auth session cookie is
 * automatically included in every request — including update/delete calls
 * from dashboard pages. Without this, updates are sent as anon and
 * rejected by RLS even when the user is logged in.
 *
 * USED BY: All pages and lib files that talk to the database.
 */

import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Types ────────────────────────────────────────────────────────────────────

export type MenuCategory =
  | 'Classic Pizzas'
  | "Roni's Specials"
  | 'Protein Specials'
  | 'Drinks'
  | 'Extras'

export interface Customization {
  label: string
  options: string[]
  required: boolean
}

export interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  category: MenuCategory | string
  emoji: string
  image_url?: string
  available: boolean
  customizations?: Customization[]
  created_at: string
}

export interface CartItem {
  menuItem: MenuItem
  quantity: number
  notes?: string
  selectedOptions?: Record<string, string>
}

export type OrderStatus = 'new' | 'preparing' | 'done' | 'cancelled'

export interface Order {
  id: string
  table_number: string
  customer_name?: string
  items: CartItem[]
  status: OrderStatus
  total: number
  notes?: string
  created_at: string
  updated_at: string
}
