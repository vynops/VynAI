'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, LineChart, Line, Legend, Cell,
} from 'recharts'
import type { HourlyStats } from '@/lib/types'

const TS = {
  contentStyle: { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, color: '#f8fafc', fontSize: 12 },
  labelStyle: { color: '#94a3b8' },
}

// ─── Historical charts (kept for potential future use) ───────────────────────

export function RequestsAreaChart({ data }: { data: HourlyStats[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}>
        <defs>
          <linearGradient id="gradReq" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.28} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradErr" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f87171" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip {...TS} />
        <Area type="monotone" dataKey="requests" stroke="#06b6d4" strokeWidth={2} fill="url(#gradReq)" name="Requests" />
        <Area type="monotone" dataKey="errors" stroke="#f87171" strokeWidth={1.5} fill="url(#gradErr)" name="Errors" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function TokensBarChart({ data }: { data: HourlyStats[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 8, left: -22, bottom: 0 }} barSize={6}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`} />
        <Tooltip {...TS} formatter={(v) => [`${(Number(v) / 1000).toFixed(0)}K`, '']} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        <Bar dataKey="tokensIn" stackId="t" fill="#6366f1" name="Tokens In" />
        <Bar dataKey="tokensOut" stackId="t" fill="#06b6d4" name="Tokens Out" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function LatencyLineChart({ data }: { data: HourlyStats[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}ms`} />
        <Tooltip {...TS} formatter={(v) => [`${v}ms`, '']} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        <Line type="monotone" dataKey="avgLatencyMs" stroke="#34d399" strokeWidth={2} dot={false} name="P50 Latency" />
        <Line type="monotone" dataKey="p95LatencyMs" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="P95 Latency" strokeDasharray="4 2" />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── Real-data charts ────────────────────────────────────────────────────────

/** Live VRAM usage — from Ollama /api/ps */
export function VramBarChart({ data }: { data: { name: string; vramGiB: number; serverName: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, left: 4, bottom: 0 }} barSize={14}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
        <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}GB`} />
        <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={170} />
        <Tooltip {...TS} formatter={(v) => [`${Number(v).toFixed(2)} GB VRAM`, '']} />
        <Bar dataKey="vramGiB" name="VRAM" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#06b6d4' : '#6366f1'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Model disk sizes — from Ollama /api/tags */
export function ModelSizesChart({ data }: { data: { name: string; sizeGiB: number; category: string }[] }) {
  const catColors: Record<string, string> = { general: '#94a3b8', code: '#a78bfa', embedding: '#60a5fa', vision: '#fb923c' }
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, left: 4, bottom: 0 }} barSize={12}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
        <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}GB`} />
        <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={185} />
        <Tooltip {...TS} formatter={(v) => [`${Number(v).toFixed(1)} GB`, 'Disk size']} />
        <Bar dataKey="sizeGiB" name="Size" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => <Cell key={i} fill={catColors[d.category] ?? '#94a3b8'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
