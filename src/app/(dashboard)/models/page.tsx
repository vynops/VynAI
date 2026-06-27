'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Download, Search, Brain, Database, Eye, Code2, RefreshCw } from 'lucide-react'
import { formatBytes, guessCategory, cn } from '@/lib/utils'
import type { AggregatedModel } from '@/app/api/models/route'
import type { StoredServer } from '@/lib/server-store'
import PullModelModal from '@/components/modals/PullModelModal'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const CAT = {
  general: { label: 'General', color: 'text-slate-300', bg: 'bg-slate-800', icon: Brain },
  code: { label: 'Code', color: 'text-violet-400', bg: 'bg-violet-500/10', icon: Code2 },
  embedding: { label: 'Embedding', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Database },
  vision: { label: 'Vision', color: 'text-orange-400', bg: 'bg-orange-500/10', icon: Eye },
}

type Category = keyof typeof CAT

export default function ModelsPage() {
  const { data: models = [], isLoading, mutate } = useSWR<AggregatedModel[]>('/api/models', fetcher, { refreshInterval: 15000 })
  const { data: servers = [] } = useSWR<StoredServer[]>('/api/servers', fetcher)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Category | 'all'>('all')
  const [showPull, setShowPull] = useState(false)

  const categorized = models.map(m => ({ ...m, category: guessCategory(m.name, m.details?.family) as Category }))

  const filtered = categorized.filter(m => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.details?.family?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || m.category === filter
    return matchSearch && matchFilter
  })

  const counts = { all: models.length, ...Object.fromEntries(
    (Object.keys(CAT) as Category[]).map(c => [c, categorized.filter(m => m.category === c).length])
  )} as Record<string | 'all', number>

  const totalGiB = models.reduce((s, m) => s + m.sizeBytes / 1e9, 0)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">
            {isLoading ? 'Loading models…' : `${models.length} Models`}
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {servers.length} server{servers.length !== 1 ? 's' : ''} · {formatBytes(totalGiB)} total · refreshes every 15s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => mutate()} className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors" title="Refresh">
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowPull(true)} disabled={!servers.length}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white font-semibold text-sm transition-colors disabled:opacity-40">
            <Download size={15} /> Pull Model
          </button>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(['all', ...Object.keys(CAT)] as (Category | 'all')[]).map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              filter === cat
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                : 'text-slate-400 hover:text-white border border-transparent hover:border-slate-700'
            )}
          >
            {cat === 'all' ? 'All' : CAT[cat].label}
            <span className="ml-1.5 text-xs opacity-60">{counts[cat] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or family…"
          className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-800 bg-slate-900 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-500 text-sm gap-2">
            <RefreshCw size={14} className="animate-spin" /> Fetching models from servers…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Brain size={32} className="mb-3 opacity-30" />
            <p className="text-sm">{search ? 'No models match your search' : 'No models found'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Model', 'Type', 'Size', 'Params / Quant', 'Context', 'Servers', 'Loaded', 'Modified', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-slate-500 font-semibold uppercase tracking-wide text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => {
                  const cat = CAT[m.category]
                  const CatIcon = cat.icon
                  const sizeGiB = m.sizeBytes / 1e9
                  const isLoaded = m.loadedOn.length > 0
                  return (
                    <tr key={m.name} className={cn('border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors', i % 2 ? 'bg-slate-950/20' : '')}>
                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded flex-shrink-0 ${cat.bg}`}>
                            <CatIcon size={11} className={cat.color} />
                          </div>
                          <code className="font-mono text-xs text-white">{m.name}</code>
                          {isLoaded && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" title="Currently loaded" />}
                        </div>
                      </td>
                      {/* Category */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', cat.bg, cat.color)}>{cat.label}</span>
                      </td>
                      {/* Size */}
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap font-mono text-xs">
                        {sizeGiB >= 1 ? `${sizeGiB.toFixed(1)} GB` : `${(m.sizeBytes / 1e6).toFixed(0)} MB`}
                      </td>
                      {/* Params / Quant */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-xs text-slate-300">{m.details?.parameter_size ?? '—'}</div>
                        <div className="text-xs text-slate-500 font-mono">{m.details?.quantization_level ?? ''}</div>
                      </td>
                      {/* Context */}
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {m.details?.family ?? '—'}
                      </td>
                      {/* Servers */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {m.serverNames.map(n => (
                            <span key={n} className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 font-medium">{n}</span>
                          ))}
                        </div>
                      </td>
                      {/* Loaded */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isLoaded ? (
                          <span className="flex items-center gap-1 text-xs text-green-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> active
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">idle</span>
                        )}
                      </td>
                      {/* Modified */}
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {new Date(m.modifiedAt).toLocaleDateString()}
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <button className="p-1.5 rounded hover:bg-slate-800 text-slate-600 hover:text-slate-300 transition-colors" title="Pull / update">
                          <Download size={12} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showPull && (
        <PullModelModal servers={servers} onClose={() => setShowPull(false)} onPulled={() => mutate()} />
      )}
    </div>
  )
}
