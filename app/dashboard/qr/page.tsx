/**
 * FILE: app/dashboard/qr/page.tsx
 * PURPOSE: QR code generator. Staff can add or delete tables.
 *          Table count is stored in localStorage so it persists across sessions.
 *          Base URL from NEXT_PUBLIC_BASE_URL or window.location.origin.
 * ROUTE: /dashboard/qr
 */

'use client'

import { useEffect, useRef, useState } from 'react'

const ENV_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || ''
const STORAGE_KEY  = 'ronis_table_count'
const MIN_TABLES   = 1
const MAX_TABLES   = 20

export default function QRPage() {
  const [baseUrl, setBaseUrl]   = useState('')
  const [tables, setTables]     = useState<number[]>([])
  const [confirmDel, setConfirmDel] = useState<number | null>(null)

  useEffect(() => {
    setBaseUrl(ENV_BASE_URL || window.location.origin)
    const saved = localStorage.getItem(STORAGE_KEY)
    const count = saved ? parseInt(saved) : 4
    setTables(Array.from({ length: count }, (_, i) => i + 1))
  }, [])

  const saveTables = (newTables: number[]) => {
    setTables(newTables)
    localStorage.setItem(STORAGE_KEY, String(newTables.length))
  }

  const addTable = () => {
    if (tables.length >= MAX_TABLES) return
    const next = tables.length > 0 ? Math.max(...tables) + 1 : 1
    saveTables([...tables, next])
  }

  const deleteTable = (n: number) => {
    saveTables(tables.filter((t) => t !== n))
    setConfirmDel(null)
  }

  return (
    <>
      <header className="h-14 bg-white border-b flex items-center justify-between px-6 flex-shrink-0"
        style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
        <h1 className="text-base font-medium">QR Codes</h1>
        <button
          onClick={addTable}
          disabled={tables.length >= MAX_TABLES}
          className="text-xs font-medium px-3 py-1.5 rounded-lg text-white disabled:opacity-40"
          style={{ background: 'var(--espresso)' }}>
          + Add table
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">

        {/* Info strip */}
        <div className="bg-white rounded-xl border p-4 mb-6" style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'rgba(28,15,8,0.45)' }}>Live ordering URL</p>
          <p className="text-sm font-mono" style={{ color: 'var(--latte)' }}>
            {baseUrl ? `${baseUrl}/order?table=N` : 'Loading…'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'rgba(28,15,8,0.35)' }}>
            {tables.length} table{tables.length !== 1 ? 's' : ''} active
          </p>
        </div>

        <p className="text-sm mb-4" style={{ color: 'rgba(28,15,8,0.5)' }}>
          Print and laminate one QR per table. Customers scan to order — no app needed.
        </p>

        {tables.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'rgba(28,15,8,0.25)' }}>
            <p className="text-4xl mb-3">▣</p>
            <p className="text-sm">No tables yet — click "+ Add table" to get started</p>
          </div>
        ) : (
          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {tables.map((n) => (
              <QRCard
                key={`${n}-${baseUrl}`}
                table={n}
                baseUrl={baseUrl}
                onDelete={() => setConfirmDel(n)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDel !== null && (
        <div className="fixed inset-0 z-40 flex items-center justify-center"
          style={{ background: 'rgba(28,15,8,0.4)' }}>
          <div className="bg-white rounded-2xl p-6 w-80 shadow-xl">
            <p className="font-medium mb-2">Delete Table {confirmDel}?</p>
            <p className="text-sm mb-5" style={{ color: 'rgba(28,15,8,0.5)' }}>
              This removes the QR code. Any orders already placed are unaffected.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(null)}
                className="flex-1 py-2 rounded-xl text-sm border"
                style={{ borderColor: 'rgba(28,15,8,0.15)', color: 'rgba(28,15,8,0.5)' }}>
                Cancel
              </button>
              <button onClick={() => deleteTable(confirmDel)}
                className="flex-1 py-2 rounded-xl text-sm text-white font-medium"
                style={{ background: '#C0392B' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function QRCard({
  table, baseUrl, onDelete,
}: {
  table: number
  baseUrl: string
  onDelete: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const url = `${baseUrl}/order?table=${table}`

  useEffect(() => {
    if (!baseUrl) return
    import('qrcode').then((QRCode) => {
      if (canvasRef.current) {
        QRCode.toCanvas(canvasRef.current, url, {
          width: 160,
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
        h1 { font-size: 28px; margin-bottom: 4px; }
        p { color: #666; font-size: 14px; margin-bottom: 20px; }
        img { border-radius: 12px; }
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
    <div className="bg-white rounded-2xl border p-5 flex flex-col items-center gap-3"
      style={{ borderColor: 'rgba(28,15,8,0.08)' }}>
      <p className="font-serif text-lg self-start w-full">Table {table}</p>
      <canvas ref={canvasRef} style={{ borderRadius: 8 }} />
      <p className="text-xs text-center break-all font-mono w-full"
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
      <button onClick={onDelete}
        className="w-full text-xs py-1.5 rounded-lg border transition-all"
        style={{ borderColor: 'rgba(192,57,43,0.2)', color: 'rgba(192,57,43,0.6)' }}>
        Delete table
      </button>
    </div>
  )
}