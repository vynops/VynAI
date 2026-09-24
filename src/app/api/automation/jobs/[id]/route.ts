import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getSessionUser } from '@/lib/auth'
import { getJob, updateJob } from '@/lib/automation-store'
import { runAutomationJob } from '@/lib/automation-runner'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAdmin(req)
  if (deny) return deny
  const { id } = await params
  const job = getJob(id)
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  let body: { action?: 'approve' | 'reject' }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (job.status !== 'pending_approval') return NextResponse.json({ error: 'Job is no longer awaiting approval' }, { status: 409 })

  if (body.action === 'reject') {
    return NextResponse.json(updateJob(id, { status: 'rejected', finishedAt: new Date().toISOString() }))
  }
  if (body.action !== 'approve') return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
  const user = await getSessionUser(req)
  updateJob(id, { status: 'queued', output: `Approved by ${user!.email}` })
  void runAutomationJob(id)
  return NextResponse.json(getJob(id))
}
