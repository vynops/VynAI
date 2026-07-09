'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { Server, Brain, HardDrive, Clock, AlertTriangle, CheckCircle, RefreshCw, Zap, ArrowRight } from 'lucide-react'
import { formatBytes, formatLatency, cn } from '@/lib/utils'
import { VramBarChart } from '@/components/charts/Charts'
import type { OverviewResponse } from '@/app/api/overview/route'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function StatCard({ label, value, sub, icon: Icon, iconColor, loading, href }: {
  label: string; value: string; sub: string; icon: React.ElementType; iconColor: string; loading?: boolean; href?: string
}) {
  const inner = (
    <div className={cn(
      'rounded-xl border border-slate-800 bg-slate-900 p-5 transition-all',
      href && 'hover:border-slate-600 hover:bg-slate-800/70 cursor-pointer group'
    )}>
      <div className="mb-3 flex items-start justify-between">
        <div className="p-2 rounded-lg bg-slate-800 inline-flex">
          <Icon size={18} className={iconColor} />
        </div>
        {href && <ArrowRight size={13} className="text-slate-700 group-hover:text-slate-400 transition-colors mt-1" />}
      </div>
      {loading
        ? <div className="h-8 w-20 bg-slate-800 rounded animate-pulse mb-1" />
        : <div className="text-2xl font-black text-white mb-1">{value}</div>
      }
      <div className="text-xs font-semibold text-slate-300 mb-0.5">{label}</div>
      <div className="text-xs text-slate-500">{sub}</div>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

export default function OverviewPage() {
  const { data: overview, isLoading } = useSWR<OverviewResponse>(
    '/api/overview', fetcher, { refreshInterval: 10000 }
  )

  const stats = overview?.stats
  const vramData = (overview?.loadedModels ?? [])
    .map(m => ({ name: m.name, vramGiB: (m.size_vram ?? 0) / 1e9, serverName: m.serverName }))
    .sort((a, b) => b.vramGiB - a.vramGiB)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Servers Online" loading={isLoading}
          value={stats ? `${stats.serversOnline}/${stats.serversTotal}` : '—'}
          sub={stats ? (stats.serversOnline === stats.serversTotal ? 'All reachable' : `${stats.serversTotal - stats.serversOnline} unreachable`) : ''}
          icon={Server} iconColor="text-cyan-400" href="/servers" />
        <StatCard label="Models Available" loading={isLoading}
          value={stats ? `${stats.totalModels}` : '—'}
          sub={stats ? `${stats.loadedCount} currently loaded` : ''}
          icon={Brain} iconColor="text-violet-400" href="/models" />
        <StatCard label="VRAM In Use" loading={isLoading}
          value={stats ? formatBytes(stats.totalVramBytes / 1e9) : '—'}
          sub={`across ${stats?.loadedCount ?? 0} loaded models`}
          icon={HardDrive} iconColor="text-yellow-400" href="/analytics" />
        <StatCard label="Avg API Latency" loading={isLoading}
          value={stats?.avgLatencyMs != null ? formatLatency(stats.avgLatencyMs) : '—'}
          sub="to Ollama /api/tags"
          icon={Clock} iconColor="text-green-400" href="/gateway" />
      </div>

      {/* VRAM chart + server health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* VRAM usage by loaded model */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-white">VRAM Usage — Loaded Models</h2>
              <p className="text-xs text-slate-500 mt-0.5">Live from /api/ps · refreshes every 10s</p>
            </div>
            {isLoading && <RefreshCw size={13} className="text-slate-600 animate-spin" />}
          </div>
          {isLoading ? (
            <div className="h-40 bg-slate-800/30 rounded-lg animate-pulse" />
          ) : vramData.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-slate-500 text-sm gap-2">
              <Brain size={28} className="opacity-30" />
              <p>No models currently loaded</p>
              <Link href="/models" className="text-xs text-cyan-400 hover:underline">Pull a model →</Link>
            </div>
          ) : (
            <VramBarChart data={vramData} />
          )}
        </div>

        {/* Server health */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-bold text-white mb-4">Server Health</h2>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-20 bg-slate-800/30 rounded-lg animate-pulse" />)}
            </div>
          ) : overview?.servers.length === 0 ? (
            <div className="text-xs text-slate-500 py-4 text-center">No servers registered</div>
          ) : (
            <div className="space-y-3">
              {overview?.servers.map(srv => (
                <Link key={srv.id} href="/servers" className="block rounded-lg border border-slate-800 bg-slate-950/50 p-3 hover:border-slate-600 hover:bg-slate-800/40 transition-all group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={cn('w-2 h-2 rounded-full flex-shrink-0',
                        srv.online ? 'bg-green-400 animate-pulse' : 'bg-red-400')} />
                      <span className="text-xs font-semibold text-white truncate">{srv.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-xs font-medium',
                        srv.online ? 'text-green-400' : 'text-red-400')}>
                        {srv.online ? 'online' : 'offline'}
                      </span>
                      <ArrowRight size={11} className="text-slate-700 group-hover:text-slate-400 transition-colors" />
                    </div>
                  </div>
                  {srv.online ? (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span>{srv.totalModels} models</span>
                      <span>{srv.loadedCount} loaded</span>
                      <span>{formatLatency(srv.latencyMs ?? 0)}</span>
                      <span>{formatBytes((srv.vramUsedBytes ?? 0) / 1e9)} VRAM</span>
                      <span className="col-span-2 text-slate-600">v{srv.version}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-red-400 truncate">{srv.error}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alerts + loaded model sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Alerts */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white">Alerts</h2>
            <div className="flex items-center gap-2">
              {(overview?.alerts.length ?? 0) > 0
                ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-medium">{overview?.alerts.length} active</span>
                : <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle size={12} /> All clear</span>
              }
              <Link href="/logs" className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">Logs <ArrowRight size={11} /></Link>
            </div>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="h-12 bg-slate-800/30 rounded-lg animate-pulse" />)}
            </div>
          ) : overview?.alerts.length === 0 ? (
            <div className="flex items-center gap-3 py-6 justify-center text-slate-500 text-xs">
              <CheckCircle size={16} className="text-green-500" /> All servers reachable
            </div>
          ) : (
            <div className="space-y-2">
              {overview?.alerts.map(a => (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                  <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-300">{a.message}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{a.serverName}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active model sessions */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-bold text-white mb-4">Active Model Sessions</h2>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-800/30 rounded animate-pulse" />)}
            </div>
          ) : vramData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-slate-500 text-xs gap-1">
              <Zap size={16} className="opacity-30" />
              <p>No active sessions</p>
              <Link href="/models" className="text-cyan-400 hover:underline mt-0.5">Browse models →</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {vramData.map(m => (
                <div key={`${m.serverName}-${m.name}`} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-800 bg-slate-950/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                    <code className="text-xs text-cyan-400 truncate">{m.name}</code>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 text-xs text-slate-400">
                    <span>{m.vramGiB.toFixed(1)} GB VRAM</span>
                    <span className="text-slate-600">{m.serverName}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
