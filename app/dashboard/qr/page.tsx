/**
 * FILE: app/dashboard/qr/page.tsx
 * PURPOSE: QR code generator for Roni's Pizza's 4 tables.
 *          Each QR code links to /order?table=N (the customer ordering page).
 *          Base URL is read from NEXT_PUBLIC_BASE_URL env var (set to your
 *          live domain), falling back to window.location.origin.
 *          Staff can download a PNG or print a ready-to-laminate card per table.
 * ROUTE: /dashboard/qr
 */

'use client'

import { useEffect, useRef, useState } from 'react'

const TABLES = [1, 2, 3, 4]

const ENV_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || ''

export default function QRPage() {
  const [baseUrl, setBaseUrl] = useState('')

  useEffect(() => {
    setBaseUrl(ENV_BASE_URL || window.location.origin)
  }, [])

  return (
    <>
      <header className="h-14 bg-white border-b flex items-center px-6 flex-shrink-0"
        style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
        <h1 className="text-base font-medium">QR Codes</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6">

        {/* Info strip */}
        <div className="bg-white rounded-xl border p-4 mb-6"
          style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'rgba(28,15,8,0.45)' }}>
            Live ordering URL
          </p>
          <p className="text-sm font-mono" style={{ color: 'var(--latte)' }}>
            {baseUrl ? `${baseUrl}/order?table=1 … 4` : 'Loading…'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'rgba(28,15,8,0.35)' }}>
            Controlled by <code>NEXT_PUBLIC_BASE_URL</code> in your environment variables.
          </p>
        </div>

        <p className="text-sm mb-4" style={{ color: 'rgba(28,15,8,0.5)' }}>
          Print and laminate one QR per table. Customers scan it to open the ordering page — no app needed.
        </p>

        {/* QR Cards */}
        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {TABLES.map((n) => (
            <QRCard key={`${n}-${baseUrl}`} table={n} baseUrl={baseUrl} />
          ))}
        </div>
      </div>
    </>
  )
}

function QRCard({ table, baseUrl }: { table: number; baseUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const url = `${baseUrl}/order?table=${table}`

  useEffect(() => {
    if (!baseUrl) return
    import('qrcode').then((QRCode) => {
      if (canvasRef.current) {
        QRCode.toCanvas(canvasRef.current, url, {
          width: 180,
          margin: 2,
          color: { dark: '#1C0F08', light: '#FAF7F2' },
        })
      }
    })
  }, [url, baseUrl])

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `ronis-pizza-table-${table}.png`
    link.href = canvas.toDataURL()
    link.click()
  }

  const printCard = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const img = canvas.toDataURL()
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`
      <html><head><title>Roni's Pizza - Table ${table}</title>
      <style>
        body { font-family: Georgia, serif; text-align: center; padding: 40px; }
        h1   { font-size: 28px; margin-bottom: 4px; }
        p    { color: #666; font-size: 14px; margin-bottom: 20px; }
        img  { border-radius: 12px; }
        .url { font-size: 11px; color: #aaa; font-family: monospace; margin-top: 8px; word-break: break-all; }
        .tbl { font-size: 20px; margin-top: 16px; font-weight: bold; }
      </style></head>
      <body>
        <h1>Roni's Pizza</h1>
        <p>Scan to browse the menu and place your order</p>
        <img src="${img}" width="200" />
        <p class="tbl">Table ${table}</p>
        <p class="url">${url}</p>
        <script>window.onload = () => window.print()</script>
      </body></html>
    `)
    w.document.close()
  }

  return (
    <div className="bg-white rounded-2xl border p-5 flex flex-col items-center gap-4"
      style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
      <p className="font-serif text-lg">Table {table}</p>
      <canvas ref={canvasRef} style={{ borderRadius: 8 }} />
      <p className="text-xs text-center break-all font-mono"
        style={{ color: 'rgba(28,15,8,0.3)' }}>
        {url}
      </p>
      <div className="flex gap-2 w-full">
        <button onClick={download}
          className="flex-1 text-xs font-medium py-2 rounded-lg border transition-all"
          style={{ borderColor: 'rgba(28,15,8,0.15)', color: 'rgba(28,15,8,0.6)' }}>
          Download
        </button>
        <button onClick={printCard}
          className="flex-1 text-xs font-medium py-2 rounded-lg text-white"
          style={{ background: 'var(--espresso)' }}>
          Print
        </button>
      </div>
    </div>
  )
}