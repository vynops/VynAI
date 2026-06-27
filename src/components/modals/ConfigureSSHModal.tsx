'use client'

import { useState } from 'react'
import { X, Terminal, CheckCircle, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react'

interface Props {
  serverId: string
  serverName: string
  serverUrl: string
  currentUser?: string
  currentPort?: number
  onClose: () => void
  onSaved: () => void
}

export default function ConfigureSSHModal({ serverId, serverName, serverUrl, currentUser = '', currentPort = 22, onClose, onSaved }: Props) {
  const host = (() => { try { return new URL(serverUrl).hostname } catch { return serverUrl } })()

  const [user, setUser] = useState(currentUser)
  const [password, setPassword] = useState('')
  const [port, setPort] = useState(String(currentPort))
  const [showPw, setShowPw] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; detail?: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleTest() {
    if (!user || !password) return
    setTesting(true); setTestResult(null)
    try {
      const res = await fetch(`/api/servers/${serverId}/ssh-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, sshUser: user, sshPassword: password, sshPort: Number(port) }),
      })
      const data = await res.json()
      if (res.ok) {
        const gpuLine = data.gpuCount > 0
          ? `${data.gpuCount} GPU${data.gpuCount > 1 ? 's' : ''}: ${data.gpuNames.join(', ')}`
          : 'No NVIDIA GPU detected (CPU-only mode)'
        setTestResult({
          ok: true,
          message: `✓ Connected to ${host}`,
          detail: `${gpuLine} · ${data.ramTotalGiB} GB RAM · ${data.diskTotalGiB} GB disk`,
        })
      } else {
        setTestResult({ ok: false, message: data.error ?? 'Connection failed' })
      }
    } catch {
      setTestResult({ ok: false, message: 'Network error' })
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    if (!user || !password) { setError('Username and password are required'); return }
    setSaving(true); setError(null)
    const res = await fetch(`/api/servers/${serverId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sshUser: user, sshPassword: password, sshPort: Number(port) }),
    })
    if (res.ok) { onSaved(); onClose() }
    else { const d = await res.json(); setError(d.error ?? 'Save failed') }
    setSaving(false)
  }

  const canTest = user.trim() && password.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><Terminal size={15} className="text-green-400" /></div>
            <div>
              <h2 className="text-sm font-bold text-white">Configure SSH — {serverName}</h2>
              <p className="text-xs text-slate-500 mt-0.5">For GPU metrics, RAM, and disk stats</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800"><X size={15} /></button>
        </div>

        <div className="space-y-4">
          {/* Host (read-only) */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Host</label>
            <input readOnly value={host}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-950/60 text-sm text-slate-400 font-mono cursor-default" />
          </div>

          {/* User + Port */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Username</label>
              <input value={user} onChange={e => setUser(e.target.value)} placeholder="kamal"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-green-500/60 transition-all" />
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">SSH Port</label>
              <input type="number" value={port} onChange={e => setPort(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-200 focus:outline-none focus:border-green-500/60 transition-all" />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setTestResult(null) }}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 pr-10 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-green-500/60 transition-all"
              />
              <button type="button" onClick={() => setShowPw(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`rounded-lg border p-3 text-xs space-y-0.5 ${
              testResult.ok ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'
            }`}>
              <div className={`flex items-center gap-1.5 font-medium ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                {testResult.ok ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                {testResult.message}
              </div>
              {testResult.detail && <p className="text-slate-400 pl-4">{testResult.detail}</p>}
            </div>
          )}

          {/* Security note */}
          <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-950/40 rounded-lg p-3 border border-slate-800/50">
            <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
            Credentials stored locally in <code className="font-mono text-slate-400 mx-0.5">data/servers.json</code> — never sent to the browser.
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-sm transition-colors">
              Cancel
            </button>
            <button onClick={handleTest} disabled={!canTest || testing}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-700 hover:border-green-700/50 text-slate-300 hover:text-green-400 text-sm font-medium transition-all disabled:opacity-40">
              {testing ? <Loader2 size={13} className="animate-spin" /> : <Terminal size={13} />}
              Test SSH
            </button>
            <button onClick={handleSave} disabled={!canTest || saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white text-sm font-semibold transition-all">
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saving ? 'Saving…' : 'Save & Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
