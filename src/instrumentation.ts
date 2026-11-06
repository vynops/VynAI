declare global {
  var __vynaiMonitorStarted: boolean | undefined
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || globalThis.__vynaiMonitorStarted) return
  globalThis.__vynaiMonitorStarted = true

  const [{ runMonitoringCycle }, { loadSettings }, { retryPendingNotifications }, { resumeAutomationJobs }] = await Promise.all([
    import('@/lib/monitoring'),
    import('@/lib/settings-store'),
    import('@/lib/notification-outbox'),
    import('@/lib/automation-runner'),
  ])
  resumeAutomationJobs()

  const run = () => {
    void runMonitoringCycle().catch(error => console.error('[VynAI] Monitoring cycle failed:', error))
    void retryPendingNotifications(loadSettings()).catch(error => console.error('[VynAI] Notification retry failed:', error))
  }

  setTimeout(run, 5_000).unref?.()
  setInterval(run, 30_000).unref?.()
}