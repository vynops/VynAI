import { NextResponse } from 'next/server'
import { listServers } from '@/lib/server-store'
import { ollamaStatus } from '@/lib/ollama'
import { loadSettings } from '@/lib/settings-store'
import { trackOffline, trackOnline, sendServerDownAlerts, trackThresholdAlert, sendThresholdAlerts } from '@/lib/alert-tracker'
import { fetchServerMetrics } from '@/lib/ssh'
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
  const gpuMetricsByServer = new Map<string, Awaited<ReturnType<typeof fetchServerMetrics>>>()

  await Promise.allSettled(
    merged
      .filter(s => s.online && s.sshUser && s.sshPassword)
      .map(async (s) => {
        let host: string
        try {
          host = new URL(s.url).hostname
        } catch {
          return
        }

        const metrics = await fetchServerMetrics({
          host,
          port: s.sshPort ?? 22,
          username: s.sshUser!,
          password: s.sshPassword!,
        })

        if (!metrics.error) {
          gpuMetricsByServer.set(s.id, metrics)
        }
      })
  )

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
      if (settings.alertOnServerDown) {
        const isNew = trackOffline(s.id)
        if (isNew) {
          void sendServerDownAlerts(settings, s.name)
        }
      }
    } else {
      // Server recovered — clear so it can alert again next time
      trackOnline(s.id)

      const metrics = gpuMetricsByServer.get(s.id)
      if (!metrics || metrics.gpus.length === 0) continue

      const maxTemp = Math.max(...metrics.gpus.map(g => g.tempC))
      const gpuTempExceeded = maxTemp >= settings.gpuTempThreshold
      if (gpuTempExceeded) {
        alerts.push({
          id: `gpu-temp-${s.id}`,
          severity: 'warning',
          message: `${s.name} GPU temp ${maxTemp}C exceeds threshold ${settings.gpuTempThreshold}C`,
          serverName: s.name,
        })
      }
      const tempTransition = trackThresholdAlert(`gpu-temp-${s.id}`, gpuTempExceeded)
      if (tempTransition) {
        void sendThresholdAlerts(
          settings,
          s.name,
          'GPU temperature',
          `${maxTemp}C`,
          `${settings.gpuTempThreshold}C`
        )
      }

      const totalVramMiB = metrics.gpus.reduce((sum, g) => sum + g.vramTotalMiB, 0)
      const usedVramMiB = metrics.gpus.reduce((sum, g) => sum + g.vramUsedMiB, 0)
      const vramPct = totalVramMiB > 0 ? (usedVramMiB / totalVramMiB) * 100 : 0
      const vramExceeded = vramPct >= settings.vramThreshold

      if (vramExceeded) {
        alerts.push({
          id: `vram-${s.id}`,
          severity: 'warning',
          message: `${s.name} VRAM usage ${vramPct.toFixed(1)}% exceeds threshold ${settings.vramThreshold}%`,
          serverName: s.name,
        })
      }
      const vramTransition = trackThresholdAlert(`vram-${s.id}`, vramExceeded)
      if (vramTransition) {
        void sendThresholdAlerts(
          settings,
          s.name,
          'VRAM usage',
          `${vramPct.toFixed(1)}%`,
          `${settings.vramThreshold}%`
        )
      }
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

