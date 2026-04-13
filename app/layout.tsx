/**
 * FILE: app/layout.tsx
 * PURPOSE: Root layout that wraps the entire app.
 *          Sets the page title, loads global CSS, and configures viewport for mobile.
 * APPLIES TO: Every page in the app (dashboard + customer ordering flow)
 *
 * FIX: In Next.js 14, `viewport` must be exported separately — not inside metadata.
 */

import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: "Roni's Pizza · Order",
  description: 'Scan, browse, and order from your table.',
}

// Viewport is now a separate export in Next.js 14
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}