/**
 * FILE: lib/mockData.ts
 * PURPOSE: The full Roni's Pizza menu used while Supabase is not yet connected.
 *          Once you connect Supabase, replace references to MOCK_MENU with a
 *          database query in each page (see TODO comments in order/page.tsx and
 *          dashboard/menu/page.tsx).
 *
 * CATEGORIES:
 *   Classic Pizzas   — Rs 1295 (M) / Rs 1495 (L)
 *   Roni's Specials  — Rs 1595 (M) / Rs 1995 (L)
 *   Protein Specials — Rs 1895 (M) / Rs 2395 (L)
 *   Drinks           — Rs 90–120
 *   Extras           — Rs 95–245
 *
 * NOTE: No sample orders are included here. The dashboard starts empty and
 *       fills with real orders as customers scan and order.
 */

import { MenuItem } from './supabase'

export const MOCK_MENU: MenuItem[] = [

  // ── Classic Pizzas ──────────────────────────────────────────────────────────
  {
    id: 'cp-1', name: 'Margherita', emoji: '🍕', price: 1295,
    description: 'Homemade Marinara Sauce, Mozzarella, Parmesan Dust',
    category: 'Classic Pizzas', available: true,
    customizations: [
      { label: 'Size',  options: ['Medium – Rs 1295', 'Large – Rs 1495'], required: true },
      { label: 'Crust', options: ['Thin Crust', 'Deep Pan'],              required: true },
    ],
    created_at: new Date().toISOString(),
  },
  {
    id: 'cp-2', name: 'Hawaiian Heat', emoji: '🍕', price: 1295,
    description: 'Homemade Marinara Sauce, Mozzarella, Chicken Chunks, Pineapple, Sweet Corn, Onion, Chilli Flakes',
    category: 'Classic Pizzas', available: true,
    customizations: [
      { label: 'Size',  options: ['Medium – Rs 1295', 'Large – Rs 1495'], required: true },
      { label: 'Crust', options: ['Thin Crust', 'Deep Pan'],              required: true },
    ],
    created_at: new Date().toISOString(),
  },
  {
    id: 'cp-3', name: 'Veggie Delight', emoji: '🍕', price: 1295,
    description: 'Homemade Marinara Sauce, Mozzarella, Onion, Capsicum, Mushroom, Sweet Corn, Jalapeño',
    category: 'Classic Pizzas', available: true,
    customizations: [
      { label: 'Size',  options: ['Medium – Rs 1295', 'Large – Rs 1495'], required: true },
      { label: 'Crust', options: ['Thin Crust', 'Deep Pan'],              required: true },
    ],
    created_at: new Date().toISOString(),
  },
  {
    id: 'cp-4', name: 'Marinara', emoji: '🍕', price: 1295,
    description: 'Homemade Marinara Sauce — on Thin Crust or Deep Pan',
    category: 'Classic Pizzas', available: true,
    customizations: [
      { label: 'Size',  options: ['Medium – Rs 1295', 'Large – Rs 1495'], required: true },
      { label: 'Crust', options: ['Thin Crust', 'Deep Pan'],              required: true },
    ],
    created_at: new Date().toISOString(),
  },

  // ── Roni's Specials ─────────────────────────────────────────────────────────
  {
    id: 'rs-1', name: 'Fiery Tikka', emoji: '🔥', price: 1595,
    description: 'Homemade Marinara Sauce, Mozzarella, Chicken Tikka Chunks, Onion, Jalapeño, Green Chilli',
    category: "Roni's Specials", available: true,
    customizations: [
      { label: 'Size',  options: ['Medium – Rs 1595', 'Large – Rs 1995'], required: true },
      { label: 'Crust', options: ['Thin Crust', 'Deep Pan'],              required: true },
    ],
    created_at: new Date().toISOString(),
  },
  {
    id: 'rs-2', name: "Roni's Supreme", emoji: '👑', price: 1595,
    description: 'Homemade Marinara Sauce, Mozzarella, Chicken Chunks, Chicken Sausages, Black Olives, Jalapeño, Mushrooms, Capsicum',
    category: "Roni's Specials", available: true,
    customizations: [
      { label: 'Size',  options: ['Medium – Rs 1595', 'Large – Rs 1995'], required: true },
      { label: 'Crust', options: ['Thin Crust', 'Deep Pan'],              required: true },
    ],
    created_at: new Date().toISOString(),
  },
  {
    id: 'rs-3', name: 'Chicken Kebab', emoji: '🍗', price: 1595,
    description: 'Homemade Marinara Sauce, Mozzarella, Smokey Chicken Kebab Chunks, Onion, Capsicum, Jalapeño',
    category: "Roni's Specials", available: true,
    customizations: [
      { label: 'Size',  options: ['Medium – Rs 1595', 'Large – Rs 1995'], required: true },
      { label: 'Crust', options: ['Thin Crust', 'Deep Pan'],              required: true },
    ],
    created_at: new Date().toISOString(),
  },
  {
    id: 'rs-4', name: 'Chicken & Mushrooms', emoji: '🍄', price: 1595,
    description: 'Homemade Marinara Sauce, Mozzarella, Chicken Chunks, Mushroom, Black Olives',
    category: "Roni's Specials", available: true,
    customizations: [
      { label: 'Size',  options: ['Medium – Rs 1595', 'Large – Rs 1995'], required: true },
      { label: 'Crust', options: ['Thin Crust', 'Deep Pan'],              required: true },
    ],
    created_at: new Date().toISOString(),
  },

  // ── Protein Specials ─────────────────────────────────────────────────────────
  {
    id: 'ps-1', name: "Beef Lover's", emoji: '🥩', price: 1895,
    description: 'Homemade Marinara Sauce, Mozzarella, Minced Beef, Beef Sausages, Beef Pepperoni, Jalapeño, Onion, Capsicum',
    category: 'Protein Specials', available: true,
    customizations: [
      { label: 'Size',  options: ['Medium – Rs 1895', 'Large – Rs 2395'], required: true },
      { label: 'Crust', options: ['Thin Crust', 'Deep Pan'],              required: true },
    ],
    created_at: new Date().toISOString(),
  },
  {
    id: 'ps-2', name: 'OG Pepperoni', emoji: '🍕', price: 1895,
    description: 'Homemade Marinara Sauce, Mozzarella, Beef Pepperoni',
    category: 'Protein Specials', available: true,
    customizations: [
      { label: 'Size',  options: ['Medium – Rs 1895', 'Large – Rs 2395'], required: true },
      { label: 'Crust', options: ['Thin Crust', 'Deep Pan'],              required: true },
    ],
    created_at: new Date().toISOString(),
  },

  // ── Drinks ───────────────────────────────────────────────────────────────────
  {
    id: 'dr-1', name: 'Coca Cola', emoji: '🥤', price: 120,
    description: '350 ml', category: 'Drinks', available: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'dr-2', name: 'Sprite', emoji: '🥤', price: 120,
    description: '350 ml', category: 'Drinks', available: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'dr-3', name: 'Water', emoji: '💧', price: 90,
    description: 'Still mineral water', category: 'Drinks', available: true,
    created_at: new Date().toISOString(),
  },

  // ── Extras ───────────────────────────────────────────────────────────────────
  {
    id: 'ex-1', name: 'Extra Protein', emoji: '➕', price: 245,
    description: 'Add extra protein: Tikka Chunks, Beef Sausages, Minced Beef, or Pepperoni',
    category: 'Extras', available: true,
    customizations: [
      { label: 'Protein', options: ['Tikka Chunks', 'Beef Sausages', 'Minced Beef', 'Pepperoni'], required: true },
    ],
    created_at: new Date().toISOString(),
  },
  {
    id: 'ex-2', name: 'Extra Cheese', emoji: '🧀', price: 185,
    description: 'Extra mozzarella on your pizza',
    category: 'Extras', available: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'ex-3', name: 'Extra Dip', emoji: '🫙', price: 95,
    description: 'Chilli Oil, Tangy Jalapeño, or Creamy Garlic',
    category: 'Extras', available: true,
    customizations: [
      { label: 'Sauce', options: ['Chilli Oil', 'Tangy Jalapeño', 'Creamy Garlic'], required: true },
    ],
    created_at: new Date().toISOString(),
  },
]