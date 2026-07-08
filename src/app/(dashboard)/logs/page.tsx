'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ScrollText, RefreshCw, CheckCircle, AlertCircle, Clock, Filter, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RequestLog } from '@/lib/request-log-store'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function statusColor(status: number) {
  if (status === 200) return 'text-green-400 bg-green-500/10'
  if (status === 429) return 'text-yellow-400 bg-yellow-500/10'
  return 'text-red-400 bg-red-500/10'
}

function latencyColor(ms: number) {
  if (ms < 500) return 'text-green-400'
  if (ms < 2000) return 'text-yellow-400'
  return 'text-red-400'
}

export default function LogsPage() {
  const { data: logs = [], isLoading, mutate } = useSWR<RequestLog[]>('/api/logs', fetcher, { refreshInterval: 15000 })
  const [filterKey, setFilterKey] = useState('')
  const [filterModel, setFilterModel] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | '200' | 'error'>('all')

  const keyNames = Array.from(new Set(logs.map(l => l.keyName))).filter(Boolean)
  const modelNames = Array.from(new Set(logs.map(l => l.model))).filter(Boolean)

  const filtered = logs.filter(l => {
    if (filterKey && l.keyName !== filterKey) return false
    if (filterModel && l.model !== filterModel) return false
    if (filterStatus === '200' && l.status !== 200) return false
    if (filterStatus === 'error' && l.status === 200) return false
    return true
  })

  const totalTokens = filtered.reduce((s, l) => s + l.promptTokens + l.completionTokens, 0)
  const avgLatency = filtered.length
    ? Math.round(filtered.reduce((s, l) => s + l.latencyMs, 0) / filtered.length)
    : 0
  const errorCount = filtered.filter(l => l.status !== 200).length

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Request Logs</h2>
          <p className="text-sm text-slate-400 mt-0.5">Last 500 gateway requests · refreshes every 15s</p>
        </div>
        <button onClick={() => mutate()}
          className="self-start sm:self-auto flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 text-sm transition-colors">
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Requests', value: filtered.length.toString(), icon: ScrollText, color: 'text-cyan-400' },
          { label: 'Tokens', value: totalTokens.toLocaleString(), icon: CheckCircle, color: 'text-violet-400' },
          { label: 'Avg Latency', value: `${avgLatency}ms`, icon: Clock, color: 'text-yellow-400' },
          { label: 'Errors', value: errorCount.toString(), icon: AlertCircle, color: errorCount > 0 ? 'text-red-400' : 'text-slate-600' },
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

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter size={13} className="text-slate-500" />
        <select value={filterKey} onChange={e => setFilterKey(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/60">
          <option value="">All keys</option>
          {keyNames.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <select value={filterModel} onChange={e => setFilterModel(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/60">
          <option value="">All models</option>
          {modelNames.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
          className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/60">
          <option value="all">All statuses</option>
          <option value="200">Success only</option>
          <option value="error">Errors only</option>
        </select>
        {(filterKey || filterModel || filterStatus !== 'all') && (
          <button onClick={() => { setFilterKey(''); setFilterModel(''); setFilterStatus('all') }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
            <X size={11} /> Clear
          </button>
        )}
        <span className="text-xs text-slate-600 ml-auto">{filtered.length} entries</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        {logs.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
            <ScrollText size={28} className="opacity-30" />
            <p className="text-sm">No requests logged yet</p>
            <p className="text-xs text-slate-600">Requests made through the gateway will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Time', 'Key', 'Model', 'Status', 'Tokens in', 'Tokens out', 'Latency', 'Error'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-slate-500 font-semibold uppercase tracking-wide text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((log, i) => (
                  <tr key={log.id} className={cn('border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors text-xs',
                    i % 2 ? 'bg-slate-950/20' : '')}>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap font-mono">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap font-medium">{log.keyName || '—'}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {log.model ? (
                        <code className="text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded text-[11px]">{log.model}</code>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColor(log.status))}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{log.promptTokens || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{log.completionTokens || '—'}</td>
                    <td className={cn('px-4 py-2.5 whitespace-nowrap font-mono', latencyColor(log.latencyMs))}>
                      {log.latencyMs}ms
                    </td>
                    <td className="px-4 py-2.5 text-red-400 text-[11px] max-w-xs truncate">
                      {log.error ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
