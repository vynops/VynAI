'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Save, Bell, Database, Shield, Server, Info, BookOpen, Check, Loader2, AlertCircle, User } from 'lucide-react'
import type { AppSettings } from '@/lib/settings-store'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ── Layout helpers ────────────────────────────────────────────────────────────

function Section({ title, icon: Icon, badge, children }: {
  title: string; icon: React.ElementType; badge?: string; children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
        <Icon size={15} className="text-cyan-400" />
        <h3 className="text-sm font-bold text-white">{title}</h3>
        {badge && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 font-medium">{badge}</span>
        )}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <div className="sm:w-60 flex-shrink-0">
        <p className="text-sm font-medium text-white">{label}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 transition-colors'

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`relative inline-flex w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${enabled ? 'bg-cyan-500' : 'bg-slate-700'}`}
      aria-pressed={enabled}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : ''}`} />
    </button>
  )
}


// ── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: remote, mutate } = useSWR<AppSettings & { adminEmail: string; currentPort: string }>('/api/settings', fetcher)

  const [form, setForm] = useState<AppSettings & { adminEmail: string; currentPort: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle')

  // Hydrate form from server on first load
  useEffect(() => {
    if (remote && !form) setForm(remote)
  }, [remote, form])

  function set<K extends keyof (AppSettings & { adminEmail: string; currentPort: string })>(
    key: K, value: (AppSettings & { adminEmail: string; currentPort: string })[K]
  ) {
    setForm(prev => prev ? { ...prev, [key]: value } : prev)
    setSaveState('idle')
  }

  async function handleSave() {
    if (!form) return
    setSaving(true)
    setSaveState('idle')
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const saved = await res.json()
        mutate({ ...saved, adminEmail: form.adminEmail }, false)
        setSaveState('saved')
        setTimeout(() => setSaveState('idle'), 3000)
      } else {
        setSaveState('error')
      }
    } catch {
      setSaveState('error')
    } finally {
      setSaving(false)
    }
  }

  const loading = !form

  return (
    <div className="space-y-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Settings</h2>
          <p className="text-sm text-slate-400 mt-0.5">Saved to <code className="font-mono text-xs text-cyan-400">data/settings.json</code></p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 ${
            saveState === 'saved' ? 'bg-green-500 text-white' :
            saveState === 'error' ? 'bg-red-500 text-white' :
            'bg-cyan-500 hover:bg-cyan-400 text-white'
          }`}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> :
           saveState === 'saved' ? <Check size={14} /> :
           saveState === 'error' ? <AlertCircle size={14} /> :
           <Save size={14} />}
          {saving ? 'Saving…' : saveState === 'saved' ? 'Saved!' : saveState === 'error' ? 'Save failed' : 'Save Changes'}
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 size={13} className="animate-spin" /> Loading settings…
        </div>
      )}

      {/* Admin credentials (read-only — set in .env.local) */}
      <Section title="Admin Account" icon={User}>
        <Field label="Admin Email" sub="Set via VYNAI_ADMIN_EMAIL in .env.local">
          <input
            readOnly
            value={form?.adminEmail ?? ''}
            className={`${inputCls} opacity-60 cursor-default`}
          />
        </Field>
        <div className="border-t border-slate-800/60" />
        <Field label="Password" sub="Set via VYNAI_ADMIN_PASSWORD in .env.local">
          <div className="flex items-center gap-3">
            <input readOnly value="••••••••••••" type="password"
              className={`${inputCls} opacity-60 cursor-default flex-1`} />
            <p className="text-xs text-slate-500 whitespace-nowrap">Edit .env.local to change</p>
          </div>
        </Field>
      </Section>

      {/* General */}
      <Section title="General" icon={Server}>
        <Field label="Gateway Port" sub="Port VynAI listens on for API requests">
          <div className="flex items-center gap-2">
            <input readOnly value={form?.currentPort ?? '3010'}
              className={`${inputCls} opacity-60 cursor-default`} />
            <p className="text-xs text-slate-500 whitespace-nowrap">Edit .env.local to change</p>
          </div>
        </Field>
        <div className="border-t border-slate-800/60" />
        <Field label="Default Ollama URL" sub="Auto-registers this server on first startup">
          <input className={inputCls} value={form?.defaultOllamaUrl ?? ''}
            onChange={e => set('defaultOllamaUrl', e.target.value)}
            placeholder="http://Ollama-Server-URL:11434" />
        </Field>

      </Section>

      {/* Alerts */}
      <Section title="Alerts & Thresholds" icon={Bell}>
        <Field label="GPU Temp Alert (°C)" sub="Warn when any GPU exceeds this temperature">
          <input className={inputCls} type="number" value={form?.gpuTempThreshold ?? ''}
            onChange={e => set('gpuTempThreshold', Number(e.target.value))} placeholder="85" />
        </Field>
        <div className="border-t border-slate-800/60" />
        <Field label="VRAM Alert (%)" sub="Warn when loaded models exceed this % of VRAM">
          <input className={inputCls} type="number" value={form?.vramThreshold ?? ''}
            onChange={e => set('vramThreshold', Number(e.target.value))} placeholder="90" />
        </Field>
        <div className="border-t border-slate-800/60" />
        <Field label="Slack Webhook URL" sub="Send alert notifications to Slack">
          <input className={inputCls} value={form?.slackWebhookUrl ?? ''}
            onChange={e => set('slackWebhookUrl', e.target.value)}
            placeholder="https://hooks.slack.com/services/…" />
        </Field>
        <div className="border-t border-slate-800/60" />
        <Field label="Alert on server down">
          <Toggle enabled={form?.alertOnServerDown ?? true} onChange={v => set('alertOnServerDown', v)} />
        </Field>
        <div className="border-t border-slate-800/60" />
        <Field label="Alert on rate limit hit">
          <div className="flex items-center gap-3">
            <Toggle enabled={form?.alertOnRateLimit ?? true} onChange={v => set('alertOnRateLimit', v)} />
            <span className="text-xs text-slate-500">Slack webhook required to deliver</span>
          </div>
        </Field>
      </Section>

      {/* Gateway rate limits */}
      <Section title="Gateway Rate Limits" icon={Shield} badge="v0.2 — gateway proxy">
        <div className="flex items-start gap-2.5 mb-1 p-3 rounded-lg border border-slate-700/50 bg-slate-950/40 text-xs text-slate-400">
          <Info size={13} className="text-slate-500 flex-shrink-0 mt-0.5" />
          Rate limiting is enforced when requests route through the VynAI gateway proxy. Values are saved and will be active in v0.2.
        </div>
        <Field label="Global RPM limit" sub="Requests per minute across all API keys (0 = off)">
          <input className={inputCls} type="number" value={form?.globalRpm ?? ''}
            onChange={e => set('globalRpm', Number(e.target.value))} placeholder="1000" />
        </Field>
        <div className="border-t border-slate-800/60" />
        <Field label="Global TPM limit" sub="Tokens per minute — blank = unlimited">
          <input className={inputCls} type="number"
            value={form?.globalTpm ?? ''}
            onChange={e => set('globalTpm', e.target.value === '' ? null : Number(e.target.value))}
            placeholder="Unlimited" />
        </Field>
      </Section>

      {/* Data retention */}
      <Section title="Data Retention" icon={Database}>
        <Field label="Request log retention (days)" sub="0 = keep forever">
          <input className={inputCls} type="number" value={form?.logRetentionDays ?? ''}
            onChange={e => set('logRetentionDays', Number(e.target.value))} placeholder="30" />
        </Field>
        <div className="border-t border-slate-800/60" />
        <div className="flex items-start gap-3 pt-1">
          <Info size={14} className="text-slate-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500 leading-relaxed">
            Settings are stored in <code className="font-mono text-slate-400">data/settings.json</code>.
            API keys are in <code className="font-mono text-slate-400">data/keys.json</code>.
            Server registry is in <code className="font-mono text-slate-400">data/servers.json</code>.
            None of these are committed to git by default.
          </p>
        </div>
      </Section>

      {/* Server setup guide link */}
      <Link href="/setup" className="rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900/70 hover:border-slate-700 transition-all p-5 flex items-center justify-between gap-4 group">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10">
            <BookOpen size={16} className="text-cyan-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Ollama Server Setup Guide</p>
            <p className="text-xs text-slate-400 mt-0.5">Install, configure network access, and register a new server</p>
          </div>
        </div>
        <span className="text-slate-500 group-hover:text-slate-300 text-xs flex-shrink-0">View guide →</span>
      </Link>

      {/* About */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-bold text-white">VynAI</p>
            <p className="text-xs text-slate-500 mt-0.5">Ollama Fleet Management Dashboard</p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <span>MIT License</span>
            <a href="https://github.com/vynops/VynAI" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">GitHub →</a>
          </div>
        </div>
      </div>
    </div>
  )
}
