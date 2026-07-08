'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Plus, Copy, Trash2, Shield, Key, Check, AlertCircle, Loader2, X, Eye, EyeOff, Terminal, Code2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface ApiKey {
  id: string; name: string; keyMasked: string; createdAt: string
  status: 'active' | 'revoked'; rateLimitRpm: number; rateLimitTpm: number | null
  allowedModels: string[] | null; requestsTotal: number
  tokensPrompt: number; tokensCompletion: number
  tokensByModel?: Record<string, { prompt: number; completion: number }>
}

interface AggregatedModel { name: string }

function CreateKeyModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [rpm, setRpm] = useState('60')
  const [saving, setSaving] = useState(false)
  const [newKey, setNewKey] = useState<{ keyFull: string; keyMasked: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [modelSearch, setModelSearch] = useState('')
  const { data: allModels = [] } = useSWR<AggregatedModel[]>('/api/models', fetcher)

  const filteredModels = allModels.filter(m =>
    !modelSearch || m.name.toLowerCase().includes(modelSearch.toLowerCase())
  )

  function toggleModel(name: string) {
    setSelectedModels(prev =>
      prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name]
    )
  }

  async function handleCreate() {
    setSaving(true); setError(null)
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, rateLimitRpm: Number(rpm),
        allowedModels: selectedModels.length > 0 ? selectedModels : null,
      }),
    })
    const data = await res.json()
    if (res.ok) { setNewKey(data); onCreated() }
    else setError(data.error ?? 'Failed to create key')
    setSaving(false)
  }

  function copy() {
    if (!newKey) return
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(newKey.keyFull).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
    } else {
      // Fallback for non-secure contexts (plain HTTP on IP)
      const ta = document.createElement('textarea')
      ta.value = newKey.keyFull
      ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus(); ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }
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
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-400">Allowed Models</label>
                <span className="text-xs text-slate-500">
                  {selectedModels.length === 0 ? 'All models (unrestricted)' : `${selectedModels.length} selected`}
                </span>
              </div>
              <input value={modelSearch} onChange={e => setModelSearch(e.target.value)}
                placeholder="Filter models…"
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 mb-1.5" />
              <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 divide-y divide-slate-800">
                {filteredModels.length === 0
                  ? <div className="px-3 py-3 text-xs text-slate-500 text-center">No models found</div>
                  : filteredModels.map(m => (
                    <label key={m.name} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-800/50 cursor-pointer">
                      <input type="checkbox" checked={selectedModels.includes(m.name)} onChange={() => toggleModel(m.name)}
                        className="rounded border-slate-600 accent-cyan-500" />
                      <span className="text-xs text-slate-300 font-mono truncate">{m.name}</span>
                    </label>
                  ))
                }
              </div>
              {selectedModels.length > 0 && (
                <button onClick={() => setSelectedModels([])} className="text-xs text-slate-500 hover:text-slate-300 mt-1">Clear selection (allow all)</button>
              )}
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

type UsageTab = 'powershell' | 'curl' | 'python'

function UsageGuide() {
  const [tab, setTab] = useState<UsageTab>('powershell')
  const [copied, setCopied] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3010'

  const snippets: Record<UsageTab, { label: string; icon: React.ElementType; lines: Array<{ text: string; dim?: boolean; cyan?: boolean; green?: boolean; yellow?: boolean }> }> = {
    powershell: {
      label: 'PowerShell',
      icon: Terminal,
      lines: [
        { text: '# Use Invoke-RestMethod — native PowerShell, no quoting issues', dim: true },
        { text: '' },
        { text: '# List available models', dim: true },
        { text: '$key = "sk-vynai-YOUR_KEY"', green: true },
        { text: `Invoke-RestMethod -Uri "${origin}/api/v1/models" \`` },
        { text: '  -Headers @{ "Authorization" = "Bearer $key" }', cyan: true },
        { text: '' },
        { text: '# Chat completion', dim: true },
        { text: '$body = @{ model = "gemma3:270m"; messages = @(@{ role = "user"; content = "Hello" }); stream = $false } | ConvertTo-Json -Depth 5' },
        { text: `Invoke-RestMethod -Uri "${origin}/api/v1/chat/completions" \`` },
        { text: '  -Method POST -ContentType "application/json" \`' },
        { text: '  -Headers @{ "Authorization" = "Bearer $key" } -Body $body', cyan: true },
      ],
    },
    curl: {
      label: 'curl (Linux/Mac)',
      icon: Terminal,
      lines: [
        { text: '# List available models', dim: true },
        { text: `curl ${origin}/api/v1/models \\` },
        { text: "  -H 'Authorization: Bearer sk-vynai-YOUR_KEY'", cyan: true },
        { text: '' },
        { text: '# Chat completion', dim: true },
        { text: `curl -X POST ${origin}/api/v1/chat/completions \\` },
        { text: "  -H 'Authorization: Bearer sk-vynai-YOUR_KEY' \\", cyan: true },
        { text: "  -H 'Content-Type: application/json' \\" },
        { text: "  -d '{\"model\":\"llama3.2\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}],\"stream\":false}'", green: true },
      ],
    },
    python: {
      label: 'Python',
      icon: Code2,
      lines: [
        { text: 'from openai import OpenAI', yellow: true },
        { text: '' },
        { text: 'client = OpenAI(' },
        { text: `    base_url="${origin}/api/v1",`, cyan: true },
        { text: '    api_key="sk-vynai-YOUR_KEY",', green: true },
        { text: ')' },
        { text: '' },
        { text: '# List models', dim: true },
        { text: 'print([m.id for m in client.models.list()])' },
        { text: '' },
        { text: '# Chat', dim: true },
        { text: 'resp = client.chat.completions.create(' },
        { text: '    model="llama3.2",' },
        { text: '    messages=[{"role": "user", "content": "Hello"}]' },
        { text: ')' },
        { text: 'print(resp.choices[0].message.content)' },
      ],
    },
  }

  const current = snippets[tab]
  const fullText = current.lines.map(l => l.text).join('\n')

  function copySnippet() {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(fullText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-cyan-400" />
          <span className="text-sm font-bold text-white">Usage Examples</span>
          <span className="text-xs text-slate-500 ml-1">OpenAI-compatible · <code className="font-mono text-cyan-400">{origin}/api/v1</code></span>
        </div>
        <button onClick={copySnippet} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 text-xs transition-colors">
          {copied ? <><Check size={11} className="text-green-400" /> Copied</> : <><Copy size={11} /> Copy</>}
        </button>
      </div>
      <div className="flex border-b border-slate-800">
        {(Object.keys(snippets) as UsageTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px',
              tab === t ? 'text-cyan-400 border-cyan-400' : 'text-slate-500 border-transparent hover:text-slate-300')}>
            {t === 'python' ? <Code2 size={11} /> : <Terminal size={11} />}
            {snippets[t].label}
          </button>
        ))}
      </div>
      <div className="p-4 bg-slate-950 overflow-x-auto">
        <pre className="text-xs font-mono leading-relaxed">
          {current.lines.map((line, i) => (
            <div key={i} className={cn(
              line.dim ? 'text-slate-600' :
              line.cyan ? 'text-cyan-400' :
              line.green ? 'text-green-400' :
              line.yellow ? 'text-yellow-400' :
              'text-slate-300'
            )}>{line.text || '\u00a0'}</div>
          ))}
        </pre>
      </div>
      <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-900/50 flex items-center gap-2">
        <AlertCircle size={11} className="text-yellow-500 flex-shrink-0" />
        <span className="text-xs text-slate-500">On Windows, use <code className="text-yellow-400 font-mono">Invoke-RestMethod</code> — it handles JSON natively. Avoid <code className="text-slate-400 font-mono">curl</code> (alias for <code className="text-slate-400 font-mono">Invoke-WebRequest</code>) and avoid <code className="text-slate-400 font-mono">\</code> line continuation (use backtick <code className="text-yellow-400 font-mono">`</code> instead).</span>
      </div>
    </div>
  )
}

export default function GatewayPage() {
  const { data: keys = [], mutate } = useSWR<ApiKey[]>('/api/keys', fetcher, { refreshInterval: 30000 })
  const [showCreate, setShowCreate] = useState(false)
  const [expandedTokens, setExpandedTokens] = useState<string | null>(null)
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({})
  const [loadingReveal, setLoadingReveal] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const active = keys.filter(k => k.status === 'active')

  async function handleReveal(id: string) {
    if (revealedKeys[id]) {
      setRevealedKeys(prev => { const n = { ...prev }; delete n[id]; return n })
      return
    }
    setLoadingReveal(id)
    const res = await fetch(`/api/keys/${id}`)
    if (res.ok) {
      const data = await res.json()
      setRevealedKeys(prev => ({ ...prev, [id]: data.keyFull }))
    }
    setLoadingReveal(null)
  }

  function copyKey(id: string, val: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(val).then(() => { setCopiedKey(id); setTimeout(() => setCopiedKey(null), 2000) })
    } else {
      const ta = document.createElement('textarea')
      ta.value = val; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.focus(); ta.select()
      document.execCommand('copy'); document.body.removeChild(ta)
      setCopiedKey(id); setTimeout(() => setCopiedKey(null), 2000)
    }
  }

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
            OpenAI-compatible endpoint · <code className="font-mono text-cyan-400">{typeof window !== 'undefined' ? window.location.origin : ''}/api/v1</code>
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

      {/* Usage guide */}
      <UsageGuide />

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
                  {['Name', 'Key', 'Status', 'Rate Limit', 'Requests', 'Tokens', 'Created', ''].map(h => (
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
                      <div className="flex items-center gap-1.5">
                        <code className="font-mono text-xs text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 whitespace-nowrap">
                          {revealedKeys[key.id] ?? key.keyMasked}
                        </code>
                        <button
                          onClick={() => handleReveal(key.id)}
                          className="p-1 rounded text-slate-500 hover:text-cyan-400 hover:bg-slate-800 transition-colors flex-shrink-0"
                          title={revealedKeys[key.id] ? 'Hide key' : 'Reveal key'}>
                          {loadingReveal === key.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : revealedKeys[key.id]
                              ? <EyeOff size={12} />
                              : <Eye size={12} />}
                        </button>
                        {revealedKeys[key.id] && (
                          <button
                            onClick={() => copyKey(key.id, revealedKeys[key.id])}
                            className="p-1 rounded text-slate-500 hover:text-green-400 hover:bg-slate-800 transition-colors flex-shrink-0"
                            title="Copy full key">
                            {copiedKey === key.id ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                          </button>
                        )}
                      </div>
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
                    <td className="px-4 py-3 whitespace-nowrap">
                      {(key.tokensPrompt || key.tokensCompletion)
                        ? <div className="text-xs space-y-0.5">
                            <div className="text-slate-400">
                              <span className="text-slate-500">in </span>{(key.tokensPrompt ?? 0).toLocaleString()}
                            </div>
                            <div className="text-slate-400">
                              <span className="text-slate-500">out </span>{(key.tokensCompletion ?? 0).toLocaleString()}
                            </div>
                            <button onClick={() => setExpandedTokens(expandedTokens === key.id ? null : key.id)}
                              className="text-cyan-400 font-medium hover:underline">
                              {((key.tokensPrompt ?? 0) + (key.tokensCompletion ?? 0)).toLocaleString()} total
                              {key.tokensByModel && Object.keys(key.tokensByModel).length > 0 && (
                                <span className="text-slate-500 ml-1">{expandedTokens === key.id ? '▴' : '▾'}</span>
                              )}
                            </button>
                            {expandedTokens === key.id && key.tokensByModel && (
                              <div className="mt-1.5 space-y-0.5 border-t border-slate-700 pt-1.5">
                                {Object.entries(key.tokensByModel).map(([model, t]) => (
                                  <div key={model} className="text-[11px]">
                                    <div className="text-slate-500 truncate max-w-[140px]" title={model}>{model}</div>
                                    <div className="text-slate-400">{(t.prompt + t.completion).toLocaleString()} tok</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        : <span className="text-slate-600 text-xs">—</span>
                      }
                    </td>
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
