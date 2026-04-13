/**
 * FILE: app/page.tsx
 * PURPOSE: Root route — immediately redirects staff to the dashboard.
 *          Customers never land here; they always arrive via /order?table=N from their QR code.
 * ROUTE: /
 */

import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/dashboard')
}