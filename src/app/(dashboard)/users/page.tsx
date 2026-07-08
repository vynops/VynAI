'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Users, Plus, Trash2, Shield, Eye, EyeOff, Check, Loader2, X, UserCheck, UserX } from 'lucide-react'
import { cn } from '@/lib/utils'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface User {
  id: string; email: string; name: string; role: 'admin' | 'viewer'
  createdAt: string; lastLoginAt: string | null; active: boolean
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer')
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setSaving(true); setError(null)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, password, role }),
    })
    const data = await res.json()
    if (res.ok) { onCreated(); onClose() }
    else setError(data.error ?? 'Failed to create user')
    setSaving(false)
  }

  const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 transition-all'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10"><Users size={15} className="text-cyan-400" /></div>
            <h2 className="text-sm font-bold text-white">Create User</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800"><X size={15} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Password (min 8 chars)</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" className={cn(inputCls, 'pr-10')} />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
            <div className="flex gap-2">
              {(['admin', 'viewer'] as const).map(r => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  className={cn('flex-1 py-2 rounded-lg border text-sm font-medium transition-all capitalize',
                    role === r ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400' : 'border-slate-700 text-slate-400 hover:border-slate-600')}>
                  {r}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              {role === 'admin' ? 'Full access: manage users, keys, servers, settings.' : 'Read-only access to dashboard data.'}
            </p>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-sm">Cancel</button>
            <button onClick={handleCreate} disabled={!name.trim() || !email.trim() || password.length < 8 || saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-white text-sm font-semibold">
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saving ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function UsersPage() {
  const { data: users = [], mutate } = useSWR<User[]>('/api/users', fetcher)
  const { data: me } = useSWR<{ id: string; role: string }>('/api/auth/me', fetcher)
  const [showCreate, setShowCreate] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  async function toggleActive(user: User) {
    setActionLoading(user.id)
    await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !user.active }),
    })
    mutate()
    setActionLoading(null)
  }

  async function changeRole(user: User, role: 'admin' | 'viewer') {
    setActionLoading(user.id)
    await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    mutate()
    setActionLoading(null)
  }

  async function deleteUser(user: User) {
    if (!confirm(`Delete ${user.name}? This cannot be undone.`)) return
    setActionLoading(user.id)
    const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json()
      alert(d.error ?? 'Delete failed')
    }
    mutate()
    setActionLoading(null)
  }

  const admins = users.filter(u => u.role === 'admin' && u.active).length

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Users</h2>
          <p className="text-sm text-slate-400 mt-0.5">{users.length} user{users.length !== 1 ? 's' : ''} · {admins} admin{admins !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white font-semibold text-sm transition-colors">
          <Plus size={15} /> Create User
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
            <Users size={28} className="opacity-30" />
            <p className="text-sm">No users yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['User', 'Role', 'Status', 'Last Login', 'Created', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-slate-500 font-semibold uppercase tracking-wide text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user, i) => {
                  const isMe = user.id === me?.id
                  const loading = actionLoading === user.id
                  return (
                    <tr key={user.id} className={cn('border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors',
                      i % 2 ? 'bg-slate-950/20' : '', !user.active && 'opacity-50')}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center text-[11px] font-black text-cyan-400 flex-shrink-0">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white text-sm">{user.name} {isMe && <span className="text-[10px] text-cyan-400 font-medium">(you)</span>}</div>
                            <div className="text-xs text-slate-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {(['admin', 'viewer'] as const).map(r => (
                            <button key={r} disabled={loading || isMe} onClick={() => changeRole(user, r)}
                              className={cn('px-2 py-0.5 rounded text-xs font-medium transition-all capitalize',
                                user.role === r
                                  ? r === 'admin' ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30' : 'bg-slate-700 text-slate-300 border border-slate-600'
                                  : 'text-slate-600 hover:text-slate-400 border border-transparent disabled:cursor-not-allowed')}>
                              {r}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                          user.active ? 'bg-green-500/10 text-green-400' : 'bg-slate-700 text-slate-400')}>
                          {user.active ? 'active' : 'inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'never'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {loading
                            ? <Loader2 size={14} className="animate-spin text-slate-500" />
                            : <>
                                <button onClick={() => toggleActive(user)} disabled={isMe}
                                  title={user.active ? 'Deactivate' : 'Activate'}
                                  className="p-1.5 rounded hover:bg-slate-700 text-slate-600 hover:text-slate-300 disabled:opacity-30 transition-colors">
                                  {user.active ? <UserX size={13} /> : <UserCheck size={13} />}
                                </button>
                                <button onClick={() => deleteUser(user)} disabled={isMe}
                                  title="Delete permanently"
                                  className="p-1.5 rounded hover:bg-red-500/10 text-slate-600 hover:text-red-400 disabled:opacity-30 transition-colors">
                                  <Trash2 size={13} />
                                </button>
                              </>
                          }
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => mutate()} />}
    </div>
  )
}
