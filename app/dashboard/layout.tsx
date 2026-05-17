/**
 * FILE: app/dashboard/layout.tsx
 * PURPOSE: Shared layout for all dashboard pages (staff only).
 *
 * MOBILE  (<768px): Bottom tab bar — full screen content, tabs pinned to bottom.
 * DESKTOP (≥768px): Left sidebar (original design), unchanged.
 *
 * NAV includes Kitchen and Invoice added previously.
 */

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const NAV = [
  { href: '/dashboard',          label: 'Dashboard', icon: '◈',  mobileIcon: '⊟'  },
  { href: '/dashboard/orders',   label: 'Orders',    icon: '◎',  mobileIcon: '◎'  },
  { href: '/dashboard/kitchen',  label: 'Kitchen',   icon: '🍳', mobileIcon: '🍳' },
  { href: '/dashboard/invoice',  label: 'Invoice',   icon: '🧾', mobileIcon: '🧾' },
  { href: '/dashboard/history',  label: 'History',   icon: '◷',  mobileIcon: '◷'  },
  { href: '/dashboard/menu',     label: 'Menu',      icon: '⊞',  mobileIcon: '⊞'  },
  { href: '/dashboard/qr',       label: 'QR',        icon: '▣',  mobileIcon: '▣'  },
]

const STORAGE_KEY = 'ronis_table_count'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname    = usePathname()
  const router      = useRouter()
  const [tableCount, setTableCount] = useState(4)

  useEffect(() => {
    const load = () => {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setTableCount(parseInt(saved))
    }
    load()
    const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) load() }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/dashboard/login')
  }

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── DESKTOP SIDEBAR (hidden on mobile) ─────────────────────────────── */}
      <aside
        className="hidden md:flex w-52 flex-col flex-shrink-0 px-3 py-6"
        style={{ background: 'var(--espresso)' }}
      >
        <div className="mb-8 px-2">
          <p className="font-serif text-white text-xl leading-tight">Roni's Pizza</p>
          <p className="text-xs tracking-widest uppercase mt-1"
            style={{ color: 'rgba(255,255,255,0.35)' }}>
            Staff Dashboard
          </p>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all"
                style={{
                  color:      active ? 'var(--latte)' : 'rgba(255,255,255,0.5)',
                  background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                }}
              >
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto px-2 space-y-3">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {tableCount} table{tableCount !== 1 ? 's' : ''} active
          </p>
          <button
            onClick={signOut}
            className="w-full text-left text-xs px-3 py-2 rounded-lg transition-all"
            style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)' }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────────── */}
      <main
        className="flex-1 flex flex-col overflow-hidden"
        style={{ background: 'var(--cream)' }}
      >
        {/* Mobile top bar (hidden on desktop) */}
        <div
          className="md:hidden flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ background: 'var(--espresso)' }}
        >
          <div>
            <p className="font-serif text-white text-base leading-tight">Roni's Pizza</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {NAV.find((n) => isActive(n.href))?.label ?? 'Dashboard'}
            </p>
          </div>
          <button
            onClick={signOut}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.08)' }}
          >
            Sign out
          </button>
        </div>

        {/* Page content — on mobile, leave space for the bottom tab bar (56px) */}
        <div className="flex-1 flex flex-col overflow-hidden md:pb-0 pb-14">
          {children}
        </div>
      </main>

      {/* ── MOBILE BOTTOM TAB BAR (hidden on desktop) ───────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex"
        style={{
          background:   'var(--espresso)',
          borderTop:    '1px solid rgba(255,255,255,0.07)',
          paddingBottom: 'env(safe-area-inset-bottom)', // handles iPhone notch
          height:       56,
        }}
      >
        {NAV.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-all"
              style={{ color: active ? 'var(--latte)' : 'rgba(255,255,255,0.35)' }}
            >
              {/* Active indicator dot */}
              <span
                className="text-lg leading-none"
                style={{ filter: active ? 'none' : 'grayscale(0.5) opacity(0.6)' }}
              >
                {item.mobileIcon}
              </span>
              <span
                className="text-center"
                style={{
                  fontSize:    9,
                  fontWeight:  active ? 600 : 400,
                  letterSpacing: '0.02em',
                  lineHeight:  1,
                }}
              >
                {item.label}
              </span>
              {/* Active underline pip */}
              {active && (
                <span
                  className="absolute bottom-0 rounded-full"
                  style={{
                    width:      20,
                    height:     2,
                    background: 'var(--latte)',
                    marginBottom: 2,
                  }}
                />
              )}
            </Link>
          )
        })}
      </nav>

    </div>
  )
}