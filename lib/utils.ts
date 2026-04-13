/**
 * FILE: lib/utils.ts
 * PURPOSE: Shared helper functions and constants used across the app.
 *          Import from here rather than duplicating logic in individual pages.
 * USED BY: All pages and components that display prices, times, or order status
 */

import { Order } from './supabase'

export const CURRENCY  = process.env.NEXT_PUBLIC_CURRENCY  || 'Rs'
export const CAFE_NAME = process.env.NEXT_PUBLIC_CAFE_NAME || "Roni's Pizza"

/** Format a price in the local currency — e.g. formatPrice(1295) → "Rs 1,295" */
export function formatPrice(amount: number): string {
  return `${CURRENCY} ${amount.toLocaleString()}`
}

/** Human-readable time since a date — e.g. "3m ago", "1h ago" */
export function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

/** Sum the total value of all items in an order */
export function orderTotal(order: Order): number {
  return order.items.reduce((s, i) => s + i.menuItem.price * i.quantity, 0)
}

/** Human-readable label for each order status */
export const STATUS_LABELS: Record<string, string> = {
  new:       'New',
  preparing: 'Preparing',
  done:      'Ready',
  cancelled: 'Cancelled',
}

/** Tailwind colour classes for each order status badge */
export const STATUS_COLORS: Record<string, string> = {
  new:       'bg-amber-100 text-amber-800',
  preparing: 'bg-blue-100 text-blue-800',
  done:      'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}