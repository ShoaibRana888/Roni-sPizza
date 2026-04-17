/**
 * FILE: app/dashboard/layout.tsx
 * PURPOSE: Shared layout for all dashboard pages (staff only).
 *          Renders the left sidebar with navigation links.
 *          Wraps: Dashboard home, Orders, Menu, QR Codes pages.
 *          - Table count in footer is dynamic (reads from localStorage)
 *          - Sign out button at the bottom
 * ROUTE: /dashboard/*
 */

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const NAV = [
  { href: '/dashboard',         label: 'Dashboard', icon: '◈' },
  { href: '/dashboard/orders',  label: 'Orders',    icon: '◎' },
  { href: '/dashboard/menu',    label: 'Menu',      icon: '⊞' },
  { href: '/dashboard/qr',      label: 'QR Codes',  icon: '▣' },
]

const STORAGE_KEY = 'ronis_table_count'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [tableCount, setTableCount] = useState(4)

  // Load table count from localStorage, keep in sync with QR page changes
  useEffect(() => {
    const load = () => {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setTableCount(parseInt(saved))
    }
    load()

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) load()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/dashboard/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 flex flex-col flex-shrink-0 px-3 py-6"
        style={{ background: 'var(--espresso)' }}>
        <div className="mb-8 px-2">
          <p className="font-serif text-white text-xl leading-tight">Roni's Pizza</p>
          <p className="text-xs tracking-widest uppercase mt-1"
            style={{ color: 'rgba(255,255,255,0.35)' }}>Staff Dashboard</p>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all"
                style={{
                  color:      active ? 'var(--latte)' : 'rgba(255,255,255,0.5)',
                  background: active ? 'rgba(196,154,108,0.2)' : 'transparent',
                }}>
                <span className="text-base w-5 text-center">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto px-2 space-y-3">
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <span className="online-dot mr-1.5" />
            Live · {tableCount} table{tableCount !== 1 ? 's' : ''}
          </div>
          <button
            onClick={signOut}
            className="text-xs w-full text-left transition-opacity hover:opacity-70"
            style={{ color: 'rgba(255,255,255,0.35)' }}>
            Sign out →
          </button>
        </div>
      </aside>

      {/* Page content injected here */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[--cream]">
        {children}
      </main>
    </div>
  )
}