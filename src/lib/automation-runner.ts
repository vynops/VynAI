import { getServer } from '@/lib/server-store'
import { ollamaStatus } from '@/lib/ollama'
import { getJob, listJobs, updateJob } from '@/lib/automation-store'

const activeJobs = new Map<string, AbortController>()

export async function runAutomationJob(id: string): Promise<void> {
  const job = getJob(id)
  if (!job || job.status === 'rejected' || job.status === 'cancelled' || job.status === 'pending_approval' || activeJobs.has(id)) return

  const server = getServer(job.serverId)
  if (!server) {
    updateJob(id, { status: 'failed', error: 'Server no longer exists', finishedAt: new Date().toISOString() })
    return
  }

  const controller = new AbortController()
  activeJobs.set(id, controller)
  updateJob(id, { status: 'running', startedAt: job.startedAt ?? new Date().toISOString(), error: undefined })
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
      body: JSON.stringify({ model: job.model, stream: true }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`)
    if (!response.body) throw new Error('Ollama returned no progress stream')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let completed = false
    let finished = false
    const processLine = (line: string) => {
      if (!line.trim()) return
      const progress = JSON.parse(line) as { status?: string; completed?: number; total?: number; error?: string }
      if (progress.error) throw new Error(progress.error)
      const status = progress.status ?? 'Pulling model'
      updateJob(id, {
        progress: { status, completed: progress.completed, total: progress.total },
        output: status,
      })
      if (status.toLowerCase() === 'success') {
        completed = true
        finished = true
      }
    }

    while (!finished) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) processLine(line)
    }
    if (buffer.trim()) processLine(buffer)
    if (!completed) throw new Error('Ollama pull stream ended before completion')
    updateJob(id, { status: 'succeeded', output: `Model pull completed for ${job.model}`, finishedAt: new Date().toISOString() })
  } catch (error) {
    updateJob(id, {
      status: controller.signal.aborted ? 'cancelled' : 'failed',
      error: controller.signal.aborted ? undefined : error instanceof Error ? error.message : 'Automation failed',
      finishedAt: new Date().toISOString(),
    })
  } finally {
    activeJobs.delete(id)
  }
}

export function cancelAutomationJob(id: string): boolean {
  const job = getJob(id)
  if (!job || job.action !== 'model_pull' || job.status !== 'running') return false
  const controller = activeJobs.get(id)
  if (!controller) return false
  controller.abort()
  return true
}

export function resumeAutomationJobs(): void {
  for (const job of listJobs()) {
    if (job.status === 'queued' || job.status === 'running') void runAutomationJob(job.id)
  }
}
