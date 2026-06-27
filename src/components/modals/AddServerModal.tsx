'use client'

import { useState } from 'react'
import { X, Server, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface Props {
  onClose: () => void
  onAdded: () => void
}

export default function AddServerModal({ onClose, onAdded }: Props) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('http://')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleTest() {
    if (!url.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/servers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (res.ok) {
        setTestResult({ ok: true, message: `✓ Ollama v${data.version} · ${data.modelCount} models` })
        if (!name) setName(new URL(url).hostname)
      } else {
        setTestResult({ ok: false, message: data.error ?? 'Could not connect' })
      }
    } catch {
      setTestResult({ ok: false, message: 'Network error — check the URL and try again' })
    } finally {
      setTesting(false)
    }
  }

  async function handleAdd() {
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || new URL(url).hostname, url }),
      })
      const data = await res.json()
      if (res.ok) {
        onAdded()
        onClose()
      } else {
        setError(data.error ?? 'Failed to add server')
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  const canAdd = url.startsWith('http') && (testResult?.ok || name.trim())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Server size={16} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Add Ollama Server</h2>
              <p className="text-xs text-slate-500 mt-0.5">Register a new server URL</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          {/* URL */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Ollama URL</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setTestResult(null) }}
                placeholder="http://192.168.1.10:11434"
                className="flex-1 px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 transition-all"
              />
              <button
                onClick={handleTest}
                disabled={testing || !url.startsWith('http')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-sm font-medium transition-all disabled:opacity-50"
              >
                {testing ? <Loader2 size={13} className="animate-spin" /> : null}
                Test
              </button>
            </div>
            {testResult && (
              <div className={`flex items-center gap-2 mt-2 text-xs ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                {testResult.ok ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                {testResult.message}
              </div>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="gpu-server-01"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 transition-all"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-xs">
              <AlertCircle size={12} />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-sm font-medium transition-colors">
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!canAdd || saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saving ? 'Adding…' : 'Add Server'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
