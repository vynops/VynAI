import { NextResponse } from 'next/server'
import { listServers } from '@/lib/server-store'
import { ollamaStatus } from '@/lib/ollama'
import { loadSettings } from '@/lib/settings-store'
import { trackOffline, trackOnline, sendSlackAlert } from '@/lib/alert-tracker'
import type { OllamaRunningModel } from '@/lib/ollama'

export interface OverviewServer {
  id: string; name: string; url: string; addedAt: string
  online: boolean; latencyMs: number | null; version: string | null
  totalModels: number; loadedCount: number; vramUsedBytes: number; error: string | null
}

export interface LoadedModelEntry extends OllamaRunningModel {
  serverName: string
  serverId: string
}

export interface OverviewAlert {
  id: string; severity: 'critical' | 'warning'; message: string; serverName: string
}

export interface OverviewResponse {
  servers: OverviewServer[]
  stats: {
    serversTotal: number; serversOnline: number
    totalModels: number; loadedCount: number
    totalVramBytes: number; avgLatencyMs: number | null
  }
  loadedModels: LoadedModelEntry[]
  alerts: OverviewAlert[]
}

export async function GET() {
  const servers = listServers()
  if (!servers.length) {
    return NextResponse.json<OverviewResponse>({
      servers: [], alerts: [], loadedModels: [],
      stats: { serversTotal: 0, serversOnline: 0, totalModels: 0, loadedCount: 0, totalVramBytes: 0, avgLatencyMs: null },
    })
  }

  const results = await Promise.allSettled(
    servers.map(async (srv) => {
      const s = await ollamaStatus(srv.url)
      return { ...srv, ...s, vramUsedBytes: s.ps.reduce((sum, m) => sum + (m.size_vram ?? 0), 0) }
    })
  )

  const merged = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { ...servers[i], online: false, latencyMs: null, version: null, tags: [], ps: [], vramUsedBytes: 0, error: 'Unreachable' }
  )

  const online = merged.filter(s => s.online)
  const uniqueModels = new Set(merged.flatMap(s => s.tags.map(t => t.name)))
  const loadedModels: LoadedModelEntry[] = merged.flatMap(s =>
    s.ps.map(m => ({ ...m, serverName: s.name, serverId: s.id }))
  )
  const totalVramBytes = loadedModels.reduce((sum, m) => sum + (m.size_vram ?? 0), 0)
  const avgLatencyMs = online.length
    ? Math.round(online.reduce((s, r) => s + (r.latencyMs ?? 0), 0) / online.length)
    : null

  const settings = loadSettings()

  const alerts: OverviewAlert[] = []
  for (const s of merged) {
    if (!s.online) {
      alerts.push({
        id: `offline-${s.id}`,
        severity: 'critical' as const,
        message: `Cannot reach ${s.name}: ${s.error}`,
        serverName: s.name,
      })
      // Send Slack notification only on first detection (online→offline transition)
      if (settings.alertOnServerDown && settings.slackWebhookUrl) {
        const isNew = trackOffline(s.id)
        if (isNew) {
          sendSlackAlert(settings.slackWebhookUrl, s.name)
        }
      }
    } else {
      // Server recovered — clear so it can alert again next time
      trackOnline(s.id)
    }
  }

  const payload: OverviewResponse = {
    servers: merged.map(s => ({
      id: s.id, name: s.name, url: s.url, addedAt: s.addedAt,
      online: s.online, latencyMs: s.latencyMs, version: s.version,
      totalModels: s.tags.length, loadedCount: s.ps.length,
      vramUsedBytes: s.vramUsedBytes, error: s.error ?? null,
    })),
    stats: {
      serversTotal: servers.length,
      serversOnline: online.length,
      totalModels: uniqueModels.size,
      loadedCount: loadedModels.length,
      totalVramBytes,
      avgLatencyMs,
    },
    loadedModels,
    alerts,
  }

  return NextResponse.json(payload)
}
