'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Plus, Copy, Trash2, Shield, Key, Check, AlertCircle, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface ApiKey {
  id: string; name: string; keyMasked: string; createdAt: string
  status: 'active' | 'revoked'; rateLimitRpm: number; rateLimitTpm: number | null
  allowedModels: string[] | null; requestsTotal: number
}

function CreateKeyModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [rpm, setRpm] = useState('60')
  const [saving, setSaving] = useState(false)
  const [newKey, setNewKey] = useState<{ keyFull: string; keyMasked: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setSaving(true); setError(null)
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, rateLimitRpm: Number(rpm) }),
    })
    const data = await res.json()
    if (res.ok) { setNewKey(data); onCreated() }
    else setError(data.error ?? 'Failed to create key')
    setSaving(false)
  }

  function copy() {
    if (newKey) { navigator.clipboard.writeText(newKey.keyFull); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={!newKey ? onClose : undefined} />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10"><Key size={15} className="text-cyan-400" /></div>
            <h2 className="text-sm font-bold text-white">Create API Key</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800"><X size={15} /></button>
        </div>

        {newKey ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 text-yellow-300 text-xs">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              Copy your key now — it will never be shown again.
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-200 break-all">
              {newKey.keyFull}
            </div>
            <div className="flex gap-2">
              <button onClick={copy}
                className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all',
                  copied ? 'bg-green-500 text-white' : 'bg-cyan-500 hover:bg-cyan-400 text-white')}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy Key'}
              </button>
              <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-sm">
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Key Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="production-app"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Rate Limit (requests / min)</label>
              <input type="number" value={rpm} onChange={e => setRpm(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/60 transition-all" />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-sm">Cancel</button>
              <button onClick={handleCreate} disabled={!name.trim() || saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-white text-sm font-semibold">
                {saving && <Loader2 size={13} className="animate-spin" />}
                {saving ? 'Creating…' : 'Create Key'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function GatewayPage() {
  const { data: keys = [], mutate } = useSWR<ApiKey[]>('/api/keys', fetcher, { refreshInterval: 30000 })
  const [showCreate, setShowCreate] = useState(false)

  const active = keys.filter(k => k.status === 'active')

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this key? It will stop working immediately.')) return
    await fetch(`/api/keys/${id}`, { method: 'PATCH' })
    mutate()
  }

  async function handleDelete(id: string) {
    if (!confirm('Permanently delete this key?')) return
    await fetch(`/api/keys/${id}`, { method: 'DELETE' })
    mutate()
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">API Gateway</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            OpenAI-compatible endpoint · <code className="font-mono text-cyan-400">http://localhost:3010/api/v1</code>
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white font-semibold text-sm transition-colors">
          <Plus size={15} /> Create Key
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Active Keys', value: active.length.toString(), icon: Key, color: 'text-cyan-400' },
          { label: 'Total Keys', value: keys.length.toString(), icon: Shield, color: 'text-violet-400' },
          { label: 'Revoked', value: (keys.length - active.length).toString(), icon: AlertCircle, color: 'text-red-400' },
        ].map(item => (
          <div key={item.label} className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 flex items-center gap-3">
            <item.icon size={16} className={item.color} />
            <div>
              <div className="text-lg font-black text-white leading-tight">{item.value}</div>
              <div className="text-xs text-slate-500">{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Gateway endpoint info */}
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
        <div className="flex items-start gap-3">
          <Shield size={16} className="text-cyan-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white mb-2">OpenAI-Compatible Gateway</p>
            <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 font-mono text-xs text-slate-300 overflow-x-auto">
              <div className="text-slate-500"># Python / OpenAI SDK</div>
              <div>client = OpenAI(base_url=<span className="text-cyan-400">&quot;http://localhost:3010/api/v1&quot;</span>, api_key=<span className="text-green-400">&quot;sk-vynai-...&quot;</span>)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Keys table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">API Keys</h3>
          <span className="text-xs text-slate-500">{active.length} active · {keys.length - active.length} revoked</span>
        </div>
        {keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
            <Key size={24} className="opacity-30" />
            <p className="text-sm">No API keys yet</p>
            <button onClick={() => setShowCreate(true)} className="text-xs text-cyan-400 hover:underline">Create your first key →</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Name', 'Key', 'Status', 'Rate Limit', 'Total Requests', 'Created', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-slate-500 font-semibold uppercase tracking-wide text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keys.map((key, i) => (
                  <tr key={key.id} className={cn('border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors',
                    i % 2 ? 'bg-slate-950/20' : '', key.status === 'revoked' && 'opacity-50')}>
                    <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">{key.name}</td>
                    <td className="px-4 py-3">
                      <code className="font-mono text-xs text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 whitespace-nowrap">{key.keyMasked}</code>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                        key.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400')}>
                        {key.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {key.rateLimitRpm} rpm · {key.rateLimitTpm ? `${key.rateLimitTpm} tpm` : '∞ tpm'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{key.requestsTotal.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {key.status === 'active' && (
                          <button onClick={() => handleRevoke(key.id)}
                            className="p-1.5 rounded hover:bg-yellow-500/10 text-slate-600 hover:text-yellow-400 text-xs transition-colors" title="Revoke">
                            Revoke
                          </button>
                        )}
                        <button onClick={() => handleDelete(key.id)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors" title="Delete">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && <CreateKeyModal onClose={() => setShowCreate(false)} onCreated={() => mutate()} />}
    </div>
  )
}
