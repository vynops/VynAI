'use client'

import useSWR from 'swr'
import { useState } from 'react'
import { Activity, CheckCircle2, Clock3, XCircle, ShieldCheck, Play, Ban } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(response => response.json())
type Server = { id: string; name: string }
type Job = {
  id: string; action: string; status: string; serverName: string; model?: string
  createdBy: string; createdAt: string; output?: string; error?: string
  progress?: { status?: string; completed?: number; total?: number }
}

const labels: Record<string, string> = { health_check: 'Health check', diagnose: 'Diagnose server', model_pull: 'Pull model' }

export default function AutomationPage() {
  const { data: servers = [] } = useSWR<Server[]>('/api/servers', fetcher)
  const { data: jobs = [], mutate } = useSWR<Job[]>('/api/automation/jobs', fetcher, { refreshInterval: 3000 })
  const [serverId, setServerId] = useState('')
  const [action, setAction] = useState<'health_check' | 'diagnose' | 'model_pull'>('health_check')
  const [model, setModel] = useState('')
  const [error, setError] = useState('')

  async function createJob() {
    setError('')
    const response = await fetch('/api/automation/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, serverId, model }) })
    const data = await response.json()
    if (!response.ok) { setError(data.error ?? 'Could not create job'); return }
    setServerId(''); setModel(''); await mutate()
  }

  async function decide(id: string, decision: 'approve' | 'reject' | 'cancel') {
    await fetch(`/api/automation/jobs/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: decision }) })
    await mutate()
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div><h1 className="text-xl font-black text-white">Automation</h1><p className="text-xs text-slate-500">Run repeatable fleet operations with durable history and approval gates.</p></div>
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-center gap-2"><Play size={15} className="text-cyan-400" /><h2 className="text-sm font-bold text-white">Create operation</h2></div>
        <div className="grid gap-3 md:grid-cols-4">
          <select value={action} onChange={event => setAction(event.target.value as typeof action)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"><option value="health_check">Health check</option><option value="diagnose">Diagnose server</option><option value="model_pull">Pull model</option></select>
          <select value={serverId} onChange={event => setServerId(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"><option value="">Select server</option>{servers.map(server => <option key={server.id} value={server.id}>{server.name}</option>)}</select>
          {action === 'model_pull' ? <input value={model} onChange={event => setModel(event.target.value)} placeholder="Model name, e.g. llama3.2" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200" /> : <div className="hidden md:block" />}
          <button onClick={() => void createJob()} disabled={!serverId || (action === 'model_pull' && !model.trim())} className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-400 disabled:opacity-40">Run operation</button>
        </div>
        {action === 'model_pull' && <p className="mt-3 flex items-center gap-1.5 text-[11px] text-yellow-400"><ShieldCheck size={12} /> Model pulls require administrator approval before execution.</p>}
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-5 py-4"><h2 className="text-sm font-bold text-white">Operation history</h2></div>
        <div className="divide-y divide-slate-800/70">
          {jobs.length === 0 && <div className="p-8 text-center text-sm text-slate-500">No operations have run yet.</div>}
          {jobs.map(job => {
            const progress = job.progress
            const percent = progress?.total && progress.completed !== undefined
              ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
              : null
            return (
              <div key={job.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="rounded-lg bg-slate-800 p-2 text-cyan-400"><Activity size={15} /></div>
                <div className="min-w-44 flex-1">
                  <div className="text-sm font-semibold text-slate-200">{labels[job.action] ?? job.action}{job.model ? ` · ${job.model}` : ''}</div>
                  <div className="text-[11px] text-slate-500">{job.serverName} · {new Date(job.createdAt).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {job.status === 'succeeded' ? <CheckCircle2 size={14} className="text-green-400" /> : job.status === 'failed' || job.status === 'rejected' ? <XCircle size={14} className="text-red-400" /> : job.status === 'cancelled' ? <Ban size={14} className="text-slate-400" /> : <Clock3 size={14} className="text-yellow-400" />}
                  <span className="text-slate-400">{job.status.replace('_', ' ')}</span>
                </div>
                {job.status === 'pending_approval' && <div className="flex gap-2"><button onClick={() => void decide(job.id, 'approve')} className="rounded bg-green-500/15 px-2.5 py-1.5 text-xs text-green-300 hover:bg-green-500/25">Approve</button><button onClick={() => void decide(job.id, 'reject')} title="Reject operation" className="rounded bg-red-500/15 p-1.5 text-red-300 hover:bg-red-500/25"><Ban size={13} /></button></div>}
                {job.action === 'model_pull' && (job.status === 'queued' || job.status === 'running') && <button onClick={() => void decide(job.id, 'cancel')} className="rounded border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 hover:border-red-500/40 hover:text-red-300">Cancel</button>}
                {percent !== null && <div className="basis-full"><div className="mb-1 flex justify-between text-[11px] text-slate-500"><span>{progress?.status ?? 'Pulling model'}</span><span>{percent}%</span></div><div className="h-1.5 overflow-hidden rounded bg-slate-800"><div className="h-full bg-cyan-500" style={{ width: `${percent}%` }} /></div></div>}
                {(job.error || job.output) && <div className="basis-full rounded bg-slate-950 px-3 py-2 font-mono text-[11px] text-slate-500">{job.error ?? job.output}</div>}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
