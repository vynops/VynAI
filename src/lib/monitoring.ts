import { listServers } from '@/lib/server-store'
import { loadSettings } from '@/lib/settings-store'
import { ollamaStatus } from '@/lib/ollama'
import { fetchServerMetrics } from '@/lib/ssh'
import {
  sendServerDownAlerts,
  sendThresholdAlerts,
  trackOffline,
  trackOnline,
  trackThresholdAlert,
} from '@/lib/alert-tracker'
import { retryPendingNotifications } from '@/lib/notification-outbox'

let cycleRunning = false

export async function runMonitoringCycle(): Promise<void> {
  if (cycleRunning) return
  cycleRunning = true
  try {
    const settings = loadSettings()
    const servers = listServers()
    await Promise.all(servers.map(async server => {
      const status = await ollamaStatus(server.url)
      if (!status.online) {
        if (settings.alertOnServerDown && trackOffline(server.id)) {
          try { await sendServerDownAlerts(settings, server.name) }
          catch (error) {
            trackOnline(server.id)
            throw error
          }
        }
        return
      }

      trackOnline(server.id)
      if (!server.sshUser || !server.sshPassword) return

      let host: string
      try { host = new URL(server.url).hostname } catch { return }
      const metrics = await fetchServerMetrics({
        host,
        port: server.sshPort ?? 22,
        username: server.sshUser,
        password: server.sshPassword,
      })
      if (metrics.error || metrics.gpus.length === 0) return

      const maxTemp = Math.max(...metrics.gpus.map(gpu => gpu.tempC))
      const tempKey = `gpu-temp-${server.id}`
      if (trackThresholdAlert(tempKey, maxTemp >= settings.gpuTempThreshold)) {
        try { await sendThresholdAlerts(settings, server.name, 'GPU temperature', `${maxTemp}C`, `${settings.gpuTempThreshold}C`) }
        catch (error) { trackThresholdAlert(tempKey, false); throw error }
      }

      const totalVram = metrics.gpus.reduce((sum, gpu) => sum + gpu.vramTotalMiB, 0)
      const usedVram = metrics.gpus.reduce((sum, gpu) => sum + gpu.vramUsedMiB, 0)
      const vramPercent = totalVram > 0 ? (usedVram / totalVram) * 100 : 0
      const vramKey = `vram-${server.id}`
      if (trackThresholdAlert(vramKey, vramPercent >= settings.vramThreshold)) {
        try { await sendThresholdAlerts(settings, server.name, 'VRAM usage', `${vramPercent.toFixed(1)}%`, `${settings.vramThreshold}%`) }
        catch (error) { trackThresholdAlert(vramKey, false); throw error }
      }
    }))

    await retryPendingNotifications(settings)
  } finally {
    cycleRunning = false
  }
}