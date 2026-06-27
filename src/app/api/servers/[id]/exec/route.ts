import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-store'
import { Client } from 'ssh2'

// Destructive commands that are blocked regardless of user intent
const BLOCKED_PATTERNS = [
  'rm -rf /', 'sudo rm -rf', 'mkfs', 'dd if=/dev/zero', 'dd if=/dev/random',
  ':(){', '>(', 'chmod -r /', 'chown -r /', 'shutdown', 'reboot', 'halt', 'poweroff', 'init 0',
]

function isSafe(cmd: string): { ok: boolean; reason?: string } {
  const lower = cmd.toLowerCase().trim()
  const hit = BLOCKED_PATTERNS.find(p => lower.includes(p))
  if (hit) return { ok: false, reason: `Blocked pattern: "${hit}"` }
  return { ok: true }
}

function execSSH(
  opts: { host: string; port: number; username: string; password: string },
  command: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    let stdout = '', stderr = ''
    const timer = setTimeout(() => { conn.end(); reject(new Error('Command timed out after 15s')) }, 15000)

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) { clearTimeout(timer); conn.end(); reject(err); return }
        stream.on('data', (d: Buffer) => { stdout += d.toString() })
        stream.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
        stream.on('close', (code: number) => {
          clearTimeout(timer); conn.end()
          resolve({ stdout, stderr, exitCode: code ?? 0 })
        })
      })
    })
      .on('error', (e) => { clearTimeout(timer); reject(e) })
      .connect({ host: opts.host, port: opts.port, username: opts.username, password: opts.password, readyTimeout: 5000 })
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const server = getServer(id)
  if (!server?.sshUser || !server?.sshPassword) {
    return NextResponse.json({ error: 'SSH not configured for this server' }, { status: 400 })
  }

  let body: { command?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const command = body.command?.trim()
  if (!command) return NextResponse.json({ error: 'command is required' }, { status: 400 })

  const safety = isSafe(command)
  if (!safety.ok) return NextResponse.json({ error: safety.reason }, { status: 403 })

  let host: string
  try { host = new URL(server.url).hostname } catch { return NextResponse.json({ error: 'Invalid server URL' }, { status: 400 }) }

  const t0 = Date.now()
  try {
    const result = await execSSH(
      { host, port: server.sshPort ?? 22, username: server.sshUser, password: server.sshPassword },
      command,
    )
    return NextResponse.json({ ...result, durationMs: Date.now() - t0 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'SSH execution failed' }, { status: 502 })
  }
}
