import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, requireAdmin } from '@/lib/auth'
import { createJob, listJobs } from '@/lib/automation-store'
import { getServer } from '@/lib/server-store'
import { runAutomationJob } from '@/lib/automation-runner'

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(listJobs())
}

export async function POST(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  let body: { action?: 'health_check' | 'diagnose' | 'model_pull'; serverId?: string; model?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body.action || !body.serverId) return NextResponse.json({ error: 'action and serverId are required' }, { status: 400 })
  if (body.action === 'model_pull' && !body.model?.trim()) return NextResponse.json({ error: 'model is required for model_pull' }, { status: 400 })

  const server = getServer(body.serverId)
  if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 })
  const user = await getSessionUser(req)
  const job = createJob({
    action: body.action,
    serverId: server.id,
    serverName: server.name,
    model: body.model?.trim(),
    createdBy: user!.email,
    status: body.action === 'model_pull' ? 'pending_approval' : 'queued',
  })

  if (job.status === 'queued') void runAutomationJob(job.id)
  return NextResponse.json(job, { status: 201 })
}
