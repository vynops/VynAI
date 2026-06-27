'use client'

import useSWR from 'swr'
import { RefreshCw, Brain, Database, Eye, Code2, Server, HardDrive } from 'lucide-react'
import { formatBytes, guessCategory, cn } from '@/lib/utils'
import { VramBarChart, ModelSizesChart } from '@/components/charts/Charts'
import type { AggregatedModel } from '@/app/api/models/route'
import type { OverviewResponse } from '@/app/api/overview/route'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const CAT_CONFIG = {
  general:   { label: 'General',   color: 'text-slate-300',  bg: 'bg-slate-800',       icon: Brain   },
  code:      { label: 'Code',      color: 'text-violet-400', bg: 'bg-violet-500/10',   icon: Code2   },
  embedding: { label: 'Embedding', color: 'text-blue-400',   bg: 'bg-blue-500/10',     icon: Database },
  vision:    { label: 'Vision',    color: 'text-orange-400', bg: 'bg-orange-500/10',   icon: Eye     },
}
type Category = keyof typeof CAT_CONFIG

export default function AnalyticsPage() {
  const { data: models = [], isLoading: loadingModels, mutate: mutateModels } = useSWR<AggregatedModel[]>(
    '/api/models', fetcher, { refreshInterval: 30000 }
  )
  const { data: overview, isLoading: loadingOverview, mutate: mutateOverview } = useSWR<OverviewResponse>(
    '/api/overview', fetcher, { refreshInterval: 15000 }
  )

  const loading = loadingModels || loadingOverview

  // Compute category breakdown
  const categorized = models.map(m => ({
    ...m,
    category: guessCategory(m.name, m.details?.family) as Category,
    sizeGiB: m.sizeBytes / 1e9,
  }))

  const catCounts = (Object.keys(CAT_CONFIG) as Category[]).map(cat => ({
    cat,
    count: categorized.filter(m => m.category === cat).length,
    totalGiB: categorized.filter(m => m.category === cat).reduce((s, m) => s + m.sizeGiB, 0),
  }))

  // VRAM chart data
  const vramData = (overview?.loadedModels ?? [])
    .map(m => ({ name: m.name, vramGiB: (m.size_vram ?? 0) / 1e9, serverName: m.serverName }))
    .sort((a, b) => b.vramGiB - a.vramGiB)

  // Model sizes chart — top 20 by disk size
  const sizeChartData = [...categorized]
    .sort((a, b) => b.sizeGiB - a.sizeGiB)
    .slice(0, 20)
    .reverse()
    .map(m => ({ name: m.name, sizeGiB: m.sizeGiB, category: m.category }))

  const totalGiB = models.reduce((s, m) => s + m.sizeBytes / 1e9, 0)
  const stats = overview?.stats

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Analytics</h2>
          <p className="text-sm text-slate-400 mt-0.5">Real-time snapshot from your Ollama fleet</p>
        </div>
        <button onClick={() => { mutateModels(); mutateOverview() }}
          className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors" title="Refresh">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Fleet summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Models', value: models.length, icon: Brain, color: 'text-violet-400' },
          { label: 'Loaded Now', value: stats?.loadedCount ?? 0, icon: Server, color: 'text-green-400' },
          { label: 'Disk Usage', value: `${totalGiB.toFixed(1)} GB`, icon: HardDrive, color: 'text-cyan-400' },
          { label: 'VRAM In Use', value: stats ? formatBytes((stats.totalVramBytes ?? 0) / 1e9) : '—', icon: HardDrive, color: 'text-yellow-400' },
        ].map(item => (
          <div key={item.label} className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 flex items-center gap-3">
            <item.icon size={15} className={item.color} />
            <div>
              {loading
                ? <div className="h-6 w-12 bg-slate-800 rounded animate-pulse mb-1" />
                : <div className="text-lg font-black text-white leading-tight">{item.value}</div>
              }
              <div className="text-xs text-slate-500">{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="text-sm font-bold text-white mb-4">Model Inventory by Type</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {catCounts.map(({ cat, count, totalGiB }) => {
            const cfg = CAT_CONFIG[cat]
            const Icon = cfg.icon
            const pct = models.length ? Math.round((count / models.length) * 100) : 0
            return (
              <div key={cat} className={cn('rounded-xl border p-4', cfg.bg, 'border-slate-800/50')}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn('p-1.5 rounded-lg', cfg.bg)}><Icon size={14} className={cfg.color} /></div>
                  <span className={cn('text-xs font-semibold', cfg.color)}>{cfg.label}</span>
                </div>
                <div className="text-2xl font-black text-white mb-1">{count}</div>
                <div className="text-xs text-slate-500">{totalGiB.toFixed(1)} GB · {pct}%</div>
                <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-current transition-all" style={{ width: `${pct}%`, color: cfg.color.replace('text-', 'bg-') }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* VRAM usage by loaded model */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white">VRAM Usage — Active Sessions</h3>
            <p className="text-xs text-slate-500 mt-0.5">From Ollama /api/ps · auto-refreshes</p>
          </div>
          {vramData.length > 0 && (
            <span className="text-xs text-slate-400">{vramData.length} model{vramData.length !== 1 ? 's' : ''} loaded</span>
          )}
        </div>
        {loadingOverview ? (
          <div className="h-32 bg-slate-800/30 rounded-lg animate-pulse" />
        ) : vramData.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center text-slate-500 text-sm gap-1">
            <Brain size={24} className="opacity-30" />
            <p>No models currently loaded</p>
          </div>
        ) : (
          <VramBarChart data={vramData} />
        )}
      </div>

      {/* Model sizes */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white">Model Sizes — Top 20 by Disk</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="inline-flex items-center gap-1 mr-3"><span className="w-2 h-2 rounded bg-slate-400 inline-block" />General</span>
              <span className="inline-flex items-center gap-1 mr-3"><span className="w-2 h-2 rounded bg-violet-400 inline-block" />Code</span>
              <span className="inline-flex items-center gap-1 mr-3"><span className="w-2 h-2 rounded bg-blue-400 inline-block" />Embedding</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded bg-orange-400 inline-block" />Vision</span>
            </p>
          </div>
        </div>
        {loadingModels ? (
          <div className="h-40 bg-slate-800/30 rounded-lg animate-pulse" />
        ) : sizeChartData.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-slate-500 text-sm">No models found</div>
        ) : (
          <ModelSizesChart data={sizeChartData} />
        )}
      </div>

      {/* Server breakdown */}
      {overview && overview.servers.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="text-sm font-bold text-white mb-4">Per-Server Snapshot</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {overview.servers.map(srv => (
              <div key={srv.id} className={cn('rounded-lg border p-4', srv.online ? 'border-slate-800 bg-slate-950/40' : 'border-red-500/20 bg-red-500/5')}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={cn('w-2 h-2 rounded-full flex-shrink-0', srv.online ? 'bg-green-400 animate-pulse' : 'bg-red-400')} />
                  <span className="text-sm font-semibold text-white truncate">{srv.name}</span>
                </div>
                {srv.online ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div><span className="text-slate-500">Models:</span> <span className="text-white font-medium">{srv.totalModels}</span></div>
                    <div><span className="text-slate-500">Loaded:</span> <span className="text-white font-medium">{srv.loadedCount}</span></div>
                    <div><span className="text-slate-500">Latency:</span> <span className="text-white font-medium">{srv.latencyMs}ms</span></div>
                    <div><span className="text-slate-500">VRAM:</span> <span className="text-white font-medium">{formatBytes((srv.vramUsedBytes ?? 0) / 1e9)}</span></div>
                    <div className="col-span-2"><span className="text-slate-500">Version:</span> <span className="text-white font-mono text-xs">{srv.version}</span></div>
                  </div>
                ) : (
                  <p className="text-xs text-red-400">{srv.error}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
