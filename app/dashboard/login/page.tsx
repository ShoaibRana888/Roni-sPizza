/**
 * FILE: app/dashboard/login/page.tsx
 * ROUTE: /dashboard/login
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Incorrect email or password.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--cream)' }}>
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <p className="font-serif text-3xl" style={{ color: 'var(--espresso)' }}>Roni's Pizza</p>
          <p className="text-sm mt-1" style={{ color: 'rgba(28,15,8,0.4)' }}>Staff dashboard</p>
        </div>

        <div className="bg-white rounded-2xl border p-8"
          style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
          <h1 className="text-base font-medium mb-6">Sign in</h1>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium mb-1.5 block"
                style={{ color: 'rgba(28,15,8,0.5)' }}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@ronispizza.com"
                className="w-full text-sm border rounded-xl px-4 py-2.5 outline-none"
                style={{ borderColor: 'rgba(28,15,8,0.15)' }}
              />
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block"
                style={{ color: 'rgba(28,15,8,0.5)' }}>Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-sm border rounded-xl px-4 py-2.5 outline-none"
                style={{ borderColor: 'rgba(28,15,8,0.15)' }}
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-white text-sm font-medium mt-2"
              style={{ background: loading ? 'rgba(28,15,8,0.3)' : 'var(--espresso)' }}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}