'use client'

import { useState } from 'react'
import { X, Download, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import type { StoredServer } from '@/lib/server-store'

interface Props {
  servers: StoredServer[]
  defaultServerId?: string
  onClose: () => void
  onPulled: () => void
}

const POPULAR = [
  'llama3.2', 'llama3.1:8b', 'mistral', 'gemma3', 'qwen3:8b',
  'codestral', 'deepseek-coder-v2', 'nomic-embed-text', 'mxbai-embed-large',
]

export default function PullModelModal({ servers, defaultServerId, onClose, onPulled }: Props) {
  const [model, setModel] = useState('')
  const [serverId, setServerId] = useState(defaultServerId ?? servers[0]?.id ?? '')
  const [pulling, setPulling] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function handlePull() {
    if (!model.trim() || !serverId) return
    setPulling(true)
    setResult(null)
    try {
      const res = await fetch(`/api/servers/${serverId}/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ ok: true, message: `Pull started — check the server in a few minutes` })
        onPulled()
      } else {
        setResult({ ok: false, message: data.error ?? 'Pull failed' })
      }
    } catch {
      setResult({ ok: false, message: 'Network error' })
    } finally {
      setPulling(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Download size={16} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Pull Model</h2>
              <p className="text-xs text-slate-500 mt-0.5">Download from Ollama library</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Server selector */}
          {servers.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Pull to Server</label>
              <select
                value={serverId}
                onChange={(e) => setServerId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-200 focus:outline-none focus:border-violet-500/60 transition-all"
              >
                {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          {/* Model name */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Model Name</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePull()}
              placeholder="e.g. llama3.2 or gemma3:12b"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500/60 transition-all"
              autoFocus
            />
          </div>

          {/* Quick picks */}
          <div>
            <p className="text-xs text-slate-500 mb-2">Popular models</p>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR.map(m => (
                <button
                  key={m}
                  onClick={() => setModel(m)}
                  className={`text-xs px-2 py-1 rounded-lg border font-mono transition-all ${
                    model === m
                      ? 'border-violet-500/40 bg-violet-500/10 text-violet-400'
                      : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {result && (
            <div className={`flex items-start gap-2 p-3 rounded-lg border text-xs ${
              result.ok
                ? 'border-green-500/20 bg-green-500/5 text-green-400'
                : 'border-red-500/20 bg-red-500/5 text-red-400'
            }`}>
              {result.ok ? <CheckCircle size={12} className="mt-0.5 flex-shrink-0" /> : <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />}
              {result.message}
            </div>
          )}

          <p className="text-xs text-slate-500 leading-relaxed">
            Pull runs in the background. Large models can take several minutes.{' '}
            <a href="https://ollama.com/library" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">Browse Ollama library →</a>
          </p>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-sm font-medium transition-colors">
              {result?.ok ? 'Close' : 'Cancel'}
            </button>
            {!result?.ok && (
              <button
                onClick={handlePull}
                disabled={!model.trim() || !serverId || pulling}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all"
              >
                {pulling ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                {pulling ? 'Starting pull…' : 'Pull Model'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
