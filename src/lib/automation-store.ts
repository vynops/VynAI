import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const DATA_DIR = path.join(process.cwd(), 'data')
const JOBS_FILE = path.join(DATA_DIR, 'automation-jobs.json')

export type AutomationAction = 'health_check' | 'diagnose' | 'model_pull'
export type AutomationStatus = 'pending_approval' | 'queued' | 'running' | 'succeeded' | 'failed' | 'rejected'

export interface AutomationJob {
  id: string
  action: AutomationAction
  status: AutomationStatus
  serverId: string
  serverName: string
  model?: string
  createdBy: string
  createdAt: string
  startedAt?: string
  finishedAt?: string
  output?: string
  error?: string
}

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function readJobs(): AutomationJob[] {
  ensure()
  if (!fs.existsSync(JOBS_FILE)) return []
  try { return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8')).jobs ?? [] } catch { return [] }
}

function writeJobs(jobs: AutomationJob[]) {
  ensure()
  fs.writeFileSync(JOBS_FILE, JSON.stringify({ jobs: jobs.slice(-500) }, null, 2))
}

export function listJobs(): AutomationJob[] {
  return readJobs().reverse()
}

export function getJob(id: string): AutomationJob | null {
  return readJobs().find(job => job.id === id) ?? null
}

export function createJob(input: Omit<AutomationJob, 'id' | 'createdAt' | 'status'> & { status?: AutomationStatus }): AutomationJob {
  const job: AutomationJob = {
    ...input,
    id: randomUUID(),
    status: input.status ?? 'queued',
    createdAt: new Date().toISOString(),
  }
  writeJobs([...readJobs(), job])
  return job
}

export function updateJob(id: string, patch: Partial<AutomationJob>): AutomationJob | null {
  const jobs = readJobs()
  const index = jobs.findIndex(job => job.id === id)
  if (index < 0) return null
  jobs[index] = { ...jobs[index], ...patch }
  writeJobs(jobs)
  return jobs[index]
}
