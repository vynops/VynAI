'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Save, Bell, Database, Shield, Server, Info, BookOpen, Check, Loader2, AlertCircle, User, Eye, EyeOff, KeyRound, Mail, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
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
  const { data: me } = useSWR<{ email: string; name: string }>('/api/auth/me', fetcher)

  const [form, setForm] = useState<AppSettings & { adminEmail: string; currentPort: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle')

  // Change password state
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwState, setPwState] = useState<'idle' | 'saved' | 'error'>('idle')
  const [pwError, setPwError] = useState('')

  // Notification test state
  const [testingChannel, setTestingChannel] = useState<string | null>(null)
  const [channelTestResults, setChannelTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({})

  // Email test state
  const [showSmtpPw, setShowSmtpPw] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [testingEmail, setTestingEmail] = useState(false)
  const [emailTest, setEmailTest] = useState<{ ok: boolean; msg: string } | null>(null)

  async function handleChangePassword() {
    if (pwForm.next !== pwForm.confirm) { setPwError('Passwords do not match'); return }
    if (pwForm.next.length < 8) { setPwError('Must be at least 8 characters'); return }
    setPwSaving(true); setPwError('')
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
    })
    const data = await res.json()
    if (res.ok) {
      setPwState('saved')
      setPwForm({ current: '', next: '', confirm: '' })
      setTimeout(() => setPwState('idle'), 3000)
    } else {
      setPwState('error'); setPwError(data.error ?? 'Failed to change password')
    }
    setPwSaving(false)
  }

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

  async function handleTestNotification(channel: 'slackWebhookUrl' | 'teamsWebhookUrl' | 'customWebhookUrl') {
    const url = String(form?.[channel] ?? '').trim()
    if (!url) {
      setChannelTestResults(prev => ({ ...prev, [channel]: { ok: false, msg: 'Enter webhook URL first' } }))
      return
    }

    setTestingChannel(channel)
    setChannelTestResults(prev => ({ ...prev, [channel]: { ok: true, msg: 'Sending...' } }))

    try {
      const res = await fetch('/api/settings/test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, url }),
      })
      const data = await res.json().catch(() => ({} as { message?: string; error?: string }))

      if (res.ok) {
        setChannelTestResults(prev => ({ ...prev, [channel]: { ok: true, msg: data.message ?? 'Notification sent' } }))
      } else {
        setChannelTestResults(prev => ({ ...prev, [channel]: { ok: false, msg: data.message ?? data.error ?? 'Notification test failed' } }))
      }
    } catch (err) {
      setChannelTestResults(prev => ({ ...prev, [channel]: { ok: false, msg: err instanceof Error ? err.message : 'Notification test failed' } }))
    } finally {
      setTestingChannel(null)
    }
  }

  async function handleTestEmail() {
    if (!testTo.trim()) {
      setEmailTest({ ok: false, msg: 'Recipient email is required' })
      return
    }
    setTestingEmail(true)
    setEmailTest({ ok: true, msg: 'Sending...' })
    try {
      const res = await fetch('/api/settings/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testTo.trim() }),
      })
      const data = await res.json().catch(() => ({} as { message?: string }))
      setEmailTest({ ok: res.ok, msg: data.message ?? (res.ok ? 'Email sent' : 'Email test failed') })
    } catch (err) {
      setEmailTest({ ok: false, msg: err instanceof Error ? err.message : 'Email test failed' })
    } finally {
      setTestingEmail(false)
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

      {/* Admin credentials */}
      <Section title="My Account" icon={User}>
        <Field label="Email" sub="Your login email">
          <input readOnly value={me?.email ?? ''} className={`${inputCls} opacity-60 cursor-default`} />
        </Field>
        <div className="border-t border-slate-800/60" />
        <Field label="Change Password">
          <div className="space-y-2">
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} placeholder="Current password"
                value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                className={cn(inputCls, 'pr-10')} />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            <input type={showPw ? 'text' : 'password'} placeholder="New password (min 8 chars)"
              value={pwForm.next} onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
              className={inputCls} />
            <input type={showPw ? 'text' : 'password'} placeholder="Confirm new password"
              value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
              className={inputCls} />
            {pwError && <p className="text-xs text-red-400">{pwError}</p>}
            <button onClick={handleChangePassword}
              disabled={!pwForm.current || !pwForm.next || !pwForm.confirm || pwSaving}
              className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50',
                pwState === 'saved' ? 'bg-green-500 text-white' : pwState === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700')}>
              {pwSaving ? <Loader2 size={13} className="animate-spin" /> : pwState === 'saved' ? <Check size={13} /> : <KeyRound size={13} />}
              {pwSaving ? 'Changing…' : pwState === 'saved' ? 'Password changed!' : 'Change Password'}
            </button>
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
          <div className="space-y-2">
            <input className={inputCls} value={form?.slackWebhookUrl ?? ''}
              onChange={e => set('slackWebhookUrl', e.target.value)}
              placeholder="https://hooks.slack.com/services/..." />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleTestNotification('slackWebhookUrl')}
                disabled={testingChannel === 'slackWebhookUrl' || !(form?.slackWebhookUrl ?? '').trim()}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 border',
                  channelTestResults.slackWebhookUrl?.ok
                    ? 'bg-green-500 text-white border-green-400/40'
                    : channelTestResults.slackWebhookUrl
                    ? 'bg-red-500/10 text-red-400 border-red-500/30'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700'
                )}
              >
                {testingChannel === 'slackWebhookUrl' ? <Loader2 size={12} className="animate-spin" /> : channelTestResults.slackWebhookUrl?.ok ? <Check size={12} /> : channelTestResults.slackWebhookUrl ? <AlertCircle size={12} /> : <Bell size={12} />}
                {testingChannel === 'slackWebhookUrl' ? 'Sending…' : 'Test Webhook'}
              </button>
              {channelTestResults.slackWebhookUrl?.msg && (
                <span className={cn('text-xs', channelTestResults.slackWebhookUrl.ok ? 'text-green-400' : 'text-red-400')}>
                  {channelTestResults.slackWebhookUrl.msg}
                </span>
              )}
            </div>
          </div>
        </Field>
        <div className="border-t border-slate-800/60" />
        <Field label="Teams Webhook URL" sub="Send alert notifications to Microsoft Teams">
          <div className="space-y-2">
            <input className={inputCls} value={form?.teamsWebhookUrl ?? ''}
              onChange={e => set('teamsWebhookUrl', e.target.value)}
              placeholder="https://outlook.webhook.office.com/webhookb2/..." />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleTestNotification('teamsWebhookUrl')}
                disabled={testingChannel === 'teamsWebhookUrl' || !(form?.teamsWebhookUrl ?? '').trim()}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 border',
                  channelTestResults.teamsWebhookUrl?.ok
                    ? 'bg-green-500 text-white border-green-400/40'
                    : channelTestResults.teamsWebhookUrl
                    ? 'bg-red-500/10 text-red-400 border-red-500/30'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700'
                )}
              >
                {testingChannel === 'teamsWebhookUrl' ? <Loader2 size={12} className="animate-spin" /> : channelTestResults.teamsWebhookUrl?.ok ? <Check size={12} /> : channelTestResults.teamsWebhookUrl ? <AlertCircle size={12} /> : <Bell size={12} />}
                {testingChannel === 'teamsWebhookUrl' ? 'Sending…' : 'Test Webhook'}
              </button>
              {channelTestResults.teamsWebhookUrl?.msg && (
                <span className={cn('text-xs', channelTestResults.teamsWebhookUrl.ok ? 'text-green-400' : 'text-red-400')}>
                  {channelTestResults.teamsWebhookUrl.msg}
                </span>
              )}
            </div>
          </div>
        </Field>
        <div className="border-t border-slate-800/60" />
        <Field label="Custom Webhook URL" sub="Send JSON alerts to any webhook endpoint">
          <div className="space-y-2">
            <input className={inputCls} value={form?.customWebhookUrl ?? ''}
              onChange={e => set('customWebhookUrl', e.target.value)}
              placeholder="https://your-webhook-endpoint.com/alerts" />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleTestNotification('customWebhookUrl')}
                disabled={testingChannel === 'customWebhookUrl' || !(form?.customWebhookUrl ?? '').trim()}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 border',
                  channelTestResults.customWebhookUrl?.ok
                    ? 'bg-green-500 text-white border-green-400/40'
                    : channelTestResults.customWebhookUrl
                    ? 'bg-red-500/10 text-red-400 border-red-500/30'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700'
                )}
              >
                {testingChannel === 'customWebhookUrl' ? <Loader2 size={12} className="animate-spin" /> : channelTestResults.customWebhookUrl?.ok ? <Check size={12} /> : channelTestResults.customWebhookUrl ? <AlertCircle size={12} /> : <Bell size={12} />}
                {testingChannel === 'customWebhookUrl' ? 'Sending…' : 'Test Webhook'}
              </button>
              {channelTestResults.customWebhookUrl?.msg && (
                <span className={cn('text-xs', channelTestResults.customWebhookUrl.ok ? 'text-green-400' : 'text-red-400')}>
                  {channelTestResults.customWebhookUrl.msg}
                </span>
              )}
            </div>
          </div>
        </Field>
        <div className="border-t border-slate-800/60" />
        <Field label="Email Alerts" sub="Optional SMTP channel for notification delivery">
          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={form?.alertEmailEnabled ?? false}
                onChange={e => set('alertEmailEnabled', e.target.checked)}
                className="rounded border-slate-600 bg-slate-900"
              />
              Enable email alerts
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input className={inputCls} value={form?.smtpHost ?? ''}
                onChange={e => set('smtpHost', e.target.value)} placeholder="SMTP host (e.g. smtp.gmail.com)" />
              <input className={inputCls} type="number" value={form?.smtpPort ?? 587}
                onChange={e => set('smtpPort', Number(e.target.value))} placeholder="SMTP port" />
              <input className={inputCls} value={form?.smtpUser ?? ''}
                onChange={e => set('smtpUser', e.target.value)} placeholder="SMTP username" />
              <div className="relative">
                <input className={cn(inputCls, 'pr-10')} type={showSmtpPw ? 'text' : 'password'} value={form?.smtpPassword ?? ''}
                  onChange={e => set('smtpPassword', e.target.value)} placeholder="SMTP password" />
                <button type="button" onClick={() => setShowSmtpPw(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showSmtpPw ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              <input className={inputCls} value={form?.smtpFrom ?? ''}
                onChange={e => set('smtpFrom', e.target.value)} placeholder="From address (e.g. VynAI <alerts@company.com>)" />
              <input className={inputCls} value={form?.alertRecipients ?? ''}
                onChange={e => set('alertRecipients', e.target.value)} placeholder="Recipients (comma-separated)" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input className={inputCls} value={testTo} onChange={e => setTestTo(e.target.value)}
                placeholder="Send test email to..." />
              <button
                type="button"
                onClick={handleTestEmail}
                disabled={testingEmail || !testTo.trim()}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 border bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700"
              >
                {testingEmail ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                {testingEmail ? 'Sending…' : 'Test Email'}
              </button>
              {emailTest?.msg && (
                <span className={cn('text-xs', emailTest.ok ? 'text-green-400' : 'text-red-400')}>
                  {emailTest.msg}
                </span>
              )}
            </div>
          </div>
        </Field>
        <div className="border-t border-slate-800/60" />
        <Field label="Alert on server down">
          <Toggle enabled={form?.alertOnServerDown ?? true} onChange={v => set('alertOnServerDown', v)} />
        </Field>
        <div className="border-t border-slate-800/60" />
        <Field label="Alert on rate limit hit">
          <div className="flex items-center gap-3">
            <Toggle enabled={form?.alertOnRateLimit ?? true} onChange={v => set('alertOnRateLimit', v)} />
            <span className="text-xs text-slate-500">Delivered to any configured channel (Slack, Teams, Webhook, Email)</span>
          </div>
        </Field>
      </Section>

      {/* Gateway rate limits */}
      <Section title="Gateway Rate Limits" icon={Shield}>
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

