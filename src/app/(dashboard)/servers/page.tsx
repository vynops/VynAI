'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { Plus, RefreshCw, ExternalLink, Trash2, Terminal, Thermometer, Zap, Activity, HardDrive, Cpu } from 'lucide-react'
import { formatLatency, formatBytes, cn, tempColor, vramColor } from '@/lib/utils'
import type { StoredServer } from '@/lib/server-store'
import type { OllamaRunningModel, OllamaModel } from '@/lib/ollama'
import type { SystemMetrics } from '@/lib/ssh'
import AddServerModal from '@/components/modals/AddServerModal'
import PullModelModal from '@/components/modals/PullModelModal'
import ConfigureSSHModal from '@/components/modals/ConfigureSSHModal'
import VramSparkline from '@/components/charts/VramSparkline'
import ServerTerminal from '@/components/ServerTerminal'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface ServerLiveStatus {
  id: string; name: string; url: string; addedAt: string
  sshUser?: string; sshPort?: number
  online: boolean; latencyMs: number | null; version: string | null
  totalModels: number; loadedCount: number; vramUsedBytes: number
  tags: OllamaModel[]; ps: OllamaRunningModel[]; error: string | null
}

type VramPoint = { pct: number; usedGiB: number }

function GpuTile({ gpu, serverId, history }: { gpu: SystemMetrics['gpus'][0]; serverId: string; history: VramPoint[] }) {
  const vramPct = gpu.vramTotalMiB ? Math.round((gpu.vramUsedMiB / gpu.vramTotalMiB) * 100) : 0
  return (
    <div className="rounded-lg bg-slate-950/60 border border-slate-800/50 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-white truncate">{gpu.name}</span>
        <span className="text-xs text-slate-500 flex-shrink-0 ml-2">GPU {gpu.index}</span>
      </div>
      {/* VRAM bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-400">VRAM {(gpu.vramUsedMiB / 1024).toFixed(1)} / {(gpu.vramTotalMiB / 1024).toFixed(1)} GB</span>
          <span className={`font-medium ${vramPct >= 90 ? 'text-red-400' : vramPct >= 75 ? 'text-yellow-400' : 'text-slate-300'}`}>{vramPct}%</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${vramColor(vramPct)}`} style={{ width: `${vramPct}%` }} />
        </div>
      </div>
      {/* VRAM sparkline */}
      <VramSparkline data={history} serverId={serverId} gpuIndex={gpu.index} totalGiB={gpu.vramTotalMiB / 1024} />
      {/* GPU util bar */}
      <div className="mt-3 mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-400">GPU Util</span>
          <span className={`font-medium ${gpu.utilizationPct >= 90 ? 'text-red-400' : gpu.utilizationPct >= 75 ? 'text-yellow-400' : 'text-slate-300'}`}>{gpu.utilizationPct}%</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${gpu.utilizationPct}%` }} />
        </div>
      </div>
      {/* Temp + Power */}
      <div className="flex gap-4 text-xs mt-1">
        <span className={`flex items-center gap-1 ${tempColor(gpu.tempC)}`}>
          <Thermometer size={11} />{gpu.tempC}°C
        </span>
        <span className="flex items-center gap-1 text-slate-400">
          <Zap size={11} />{gpu.powerWatts.toFixed(0)}W
        </span>
      </div>
    </div>
  )
}

function ServerCard({ server, onDeleted, onSSHSaved }: { server: StoredServer; onDeleted: () => void; onSSHSaved: () => void }) {
  const { data: status, isLoading, mutate } = useSWR<ServerLiveStatus>(
    `/api/servers/${server.id}/status`, fetcher, { refreshInterval: 8000 }
  )
  const hasSSH = !!(server.sshUser)
  const { data: gpu, isLoading: gpuLoading, mutate: mutateGpu } = useSWR<SystemMetrics>(
    hasSSH ? `/api/servers/${server.id}/gpu` : null,
    fetcher, { refreshInterval: 12000 }
  )
  const [showSSH, setShowSSH] = useState(false)
  const [showTerminal, setShowTerminal] = useState(false)
  const [vramHistories, setVramHistories] = useState<Record<number, VramPoint[]>>({})

  useEffect(() => {
    if (!gpu?.gpus?.length) return
    setVramHistories(prev => {
      const next = { ...prev }
      for (const g of gpu.gpus) {
        const pct = g.vramTotalMiB ? Math.round((g.vramUsedMiB / g.vramTotalMiB) * 100) : 0
        const existing = prev[g.index] ?? []
        next[g.index] = [...existing.slice(-59), { pct, usedGiB: g.vramUsedMiB / 1024 }]
      }
      return next
    })
  }, [gpu])

  async function handleDelete() {
    if (!confirm(`Remove server "${server.name}"?`)) return
    await fetch(`/api/servers/${server.id}`, { method: 'DELETE' })
    onDeleted()
  }

  const online = status?.online ?? null

  return (
    <>
      <div className={cn('rounded-xl border bg-slate-900 overflow-hidden', online === false ? 'border-red-500/20' : 'border-slate-800')}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1',
              isLoading ? 'bg-slate-600 animate-pulse' : online ? 'bg-green-400 animate-pulse' : 'bg-red-400')} />
            <div className="min-w-0">
              <h3 className="font-bold text-white truncate">{server.name}</h3>
              <a href={server.url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-slate-500 font-mono hover:text-cyan-400 flex items-center gap-1 mt-0.5 transition-colors">
                {server.url} <ExternalLink size={10} />
              </a>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
              online ? 'text-green-400 bg-green-500/10' : online === false ? 'text-red-400 bg-red-500/10' : 'text-slate-500 bg-slate-800')}>
              {isLoading ? 'checking…' : online ? 'online' : online === false ? 'offline' : 'unknown'}
            </span>
            <button onClick={() => { mutate(); mutateGpu?.() }}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors" title="Refresh">
              <RefreshCw size={12} />
            </button>
            <button onClick={() => setShowSSH(true)}
              className={cn('p-1.5 rounded transition-colors', hasSSH
                ? 'text-green-500 hover:bg-green-500/10' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800')}
              title={hasSSH ? 'SSH configured — click to reconfigure' : 'Configure SSH for GPU metrics'}>
              <Terminal size={12} />
            </button>
            {hasSSH && (
              <button
                onClick={() => setShowTerminal(v => !v)}
                className={cn('px-2 py-1 rounded text-xs font-mono transition-colors',
                  showTerminal ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800')}
                title="Toggle SSH terminal">
                &gt;_
              </button>
            )}
            <button onClick={handleDelete} className="p-1.5 rounded hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors" title="Remove">
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Offline error */}
        {status && !status.online && (
          <div className="px-5 py-3 text-xs text-red-400 bg-red-500/5 border-b border-slate-800">
            ⚠ {status.error ?? 'Cannot reach server'}
          </div>
        )}

        {/* GPU metrics (real, from SSH) */}
        {hasSSH && (
          <div className="px-5 py-4 border-b border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <Cpu size={11} /> GPU Hardware
              {gpuLoading && !gpu && <span className="text-slate-600 normal-case font-normal">— connecting via SSH…</span>}
            </p>
            {gpuLoading && !gpu ? (
              <div className="space-y-2">
                <div className="h-16 bg-slate-800/30 rounded-lg animate-pulse" />
              </div>
            ) : gpu?.error ? (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 text-xs text-yellow-400">
                <Terminal size={12} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">SSH connection failed</p>
                  <p className="text-yellow-300/70 mt-0.5">{gpu.error}</p>
                  <button onClick={() => setShowSSH(true)} className="text-cyan-400 hover:underline mt-1">Reconfigure SSH →</button>
                </div>
              </div>
            ) : gpu && gpu.gpus.length === 0 ? (
              <p className="text-xs text-slate-500">No NVIDIA GPU detected — CPU-only mode</p>
            ) : gpu ? (
              <>
                <div className="space-y-3">
                  {gpu.gpus.map(g => <GpuTile key={g.index} gpu={g} serverId={server.id} history={vramHistories[g.index] ?? []} />)}
                </div>
                {/* RAM + Disk */}
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="rounded-lg bg-slate-950/60 border border-slate-800/50 p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Activity size={11} className="text-blue-400" />
                      <span className="text-xs text-slate-500">System RAM</span>
                    </div>
                    <div className="text-sm font-bold text-white">
                      {(gpu.ramUsedMiB / 1024).toFixed(1)} / {(gpu.ramTotalMiB / 1024).toFixed(1)} GB
                    </div>
                    <div className="mt-1.5 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${gpu.ramTotalMiB ? Math.round((gpu.ramUsedMiB / gpu.ramTotalMiB) * 100) : 0}%` }} />
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-950/60 border border-slate-800/50 p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <HardDrive size={11} className="text-orange-400" />
                      <span className="text-xs text-slate-500">Disk (/)</span>
                    </div>
                    <div className="text-sm font-bold text-white">
                      {gpu.diskUsedGiB} / {gpu.diskTotalGiB} GB
                    </div>
                    <div className="mt-1.5 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${gpu.diskUsePct >= 90 ? 'bg-red-500' : 'bg-orange-500'}`}
                        style={{ width: `${gpu.diskUsePct}%` }} />
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Ollama live stats */}
        {status?.online && (
          <>
            <div className="px-5 py-3 border-b border-slate-800 grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-slate-500 mb-0.5">Models</div>
                <div className="text-sm font-black text-white">{status.totalModels}</div>
                <div className="text-xs text-slate-500">{status.loadedCount} loaded</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-0.5">VRAM (Ollama)</div>
                <div className="text-sm font-black text-white">{formatBytes(status.vramUsedBytes / 1e9)}</div>
                <div className="text-xs text-slate-500">in {status.loadedCount} sessions</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-0.5">API Latency</div>
                <div className="text-sm font-black text-white">{formatLatency(status.latencyMs ?? 0)}</div>
                <div className="text-xs text-slate-500">v{status.version}</div>
              </div>
            </div>

            {status.ps.length > 0 && (
              <div className="px-5 py-3 border-b border-slate-800">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Active Sessions</p>
                <div className="space-y-1.5">
                  {status.ps.map(m => (
                    <div key={m.name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                        <code className="text-xs text-cyan-400 truncate">{m.name}</code>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 text-xs text-slate-400">
                        <span>{formatBytes(m.size_vram / 1e9)} VRAM</span>
                        {m.details?.parameter_size && <span className="text-slate-600">{m.details.parameter_size}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">All Models ({status.tags.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {status.tags.slice(0, 10).map(m => (
                  <span key={m.name} className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">{m.name}</span>
                ))}
                {status.tags.length > 10 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-500">+{status.tags.length - 10} more</span>
                )}
              </div>
            </div>
          </>
        )}

        {isLoading && (
          <div className="px-5 py-8 flex items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <RefreshCw size={12} className="animate-spin" /> Connecting to Ollama…
            </div>
          </div>
        )}
      </div>

      {/* SSH terminal panel */}
      {hasSSH && showTerminal && (
        <ServerTerminal serverId={server.id} serverName={server.name} />
      )}

      {showSSH && (
        <ConfigureSSHModal
          serverId={server.id}
          serverName={server.name}
          serverUrl={server.url}
          currentUser={server.sshUser}
          currentPort={server.sshPort}
          onClose={() => setShowSSH(false)}
          onSaved={() => { onSSHSaved(); mutateGpu?.() }}
        />
      )}
    </>
  )
}

export default function ServersPage() {
  const { data: servers = [], mutate: mutateServers } = useSWR<StoredServer[]>('/api/servers', fetcher, { refreshInterval: 30000 })
  const [showAdd, setShowAdd] = useState(false)
  const [showPull, setShowPull] = useState(false)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">{servers.length} Server{servers.length !== 1 ? 's' : ''} Registered</h2>
          <p className="text-sm text-slate-400 mt-0.5">Ollama data · 8s refresh · GPU metrics via SSH · 12s refresh</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowPull(true)} disabled={!servers.length}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 text-sm transition-colors disabled:opacity-40">
            Pull Model
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white font-semibold text-sm transition-colors">
            <Plus size={15} /> Add Server
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {servers.map(srv => (
          <ServerCard key={srv.id} server={srv} onDeleted={() => mutateServers()} onSSHSaved={() => mutateServers()} />
        ))}
        <button onClick={() => setShowAdd(true)}
          className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 hover:bg-slate-900/60 hover:border-cyan-700/50 transition-all p-8 flex flex-col items-center justify-center gap-3 text-slate-500 hover:text-slate-400 min-h-48 group">
          <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-700 group-hover:border-cyan-700/50 flex items-center justify-center"><Plus size={18} /></div>
          <div className="text-center">
            <p className="text-sm font-medium">Add Ollama Server</p>
            <p className="text-xs mt-0.5">Register a new server URL</p>
          </div>
        </button>
      </div>

      {showAdd && <AddServerModal onClose={() => setShowAdd(false)} onAdded={() => mutateServers()} />}
      {showPull && servers.length > 0 && <PullModelModal servers={servers} onClose={() => setShowPull(false)} onPulled={() => {}} />}
    </div>
  )
}
