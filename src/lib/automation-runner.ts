import { getServer } from '@/lib/server-store'
import { ollamaStatus } from '@/lib/ollama'
import { getJob, updateJob } from '@/lib/automation-store'

export async function runAutomationJob(id: string): Promise<void> {
  const job = getJob(id)
  if (!job || job.status === 'rejected') return

  const server = getServer(job.serverId)
  if (!server) {
    updateJob(id, { status: 'failed', error: 'Server no longer exists', finishedAt: new Date().toISOString() })
    return
  }

  updateJob(id, { status: 'running', startedAt: new Date().toISOString(), error: undefined })
  try {
    if (job.action === 'health_check' || job.action === 'diagnose') {
      const status = await ollamaStatus(server.url)
      const output = JSON.stringify({
        online: status.online,
        latencyMs: status.latencyMs,
        version: status.version,
        models: status.tags.map(model => model.name),
        loaded: status.ps.map(model => model.name),
        error: status.error,
      }, null, 2)
      updateJob(id, { status: status.online ? 'succeeded' : 'failed', output, error: status.online ? undefined : status.error ?? 'Server offline', finishedAt: new Date().toISOString() })
      return
    }

    if (!job.model) throw new Error('Model is required for a model pull')
    const response = await fetch(`${server.url}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: job.model, stream: false }),
    })
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`)
    updateJob(id, { status: 'succeeded', output: `Model pull completed for ${job.model}`, finishedAt: new Date().toISOString() })
  } catch (error) {
    updateJob(id, { status: 'failed', error: error instanceof Error ? error.message : 'Automation failed', finishedAt: new Date().toISOString() })
  }
}
