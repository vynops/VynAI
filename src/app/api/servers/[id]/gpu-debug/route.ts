import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-store'
import { Client } from 'ssh2'

function runSSHRaw(opts: { host: string; port: number; username: string; password: string }, cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    let out = ''
    const timer = setTimeout(() => { conn.end(); reject(new Error('timeout')) }, 10000)
    conn.on('ready', () => {
      conn.exec(cmd, (err, stream) => {
        if (err) { clearTimeout(timer); conn.end(); reject(err); return }
        stream.on('data', (d: Buffer) => { out += d.toString() })
        stream.stderr.on('data', (d: Buffer) => { out += '[STDERR] ' + d.toString() })
        stream.on('close', () => { clearTimeout(timer); conn.end(); resolve(out) })
      })
    }).on('error', (e) => { clearTimeout(timer); reject(e) })
      .connect({ host: opts.host, port: opts.port, username: opts.username, password: opts.password, readyTimeout: 5000 })
  })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const server = getServer(id)
  if (!server?.sshUser || !server?.sshPassword) return NextResponse.json({ error: 'SSH not configured' }, { status: 400 })
  const host = new URL(server.url).hostname
  const opts = { host, port: server.sshPort ?? 22, username: server.sshUser, password: server.sshPassword }

  const diagnostics: Record<string, string> = {}
  const cmds: Record<string, string> = {
    which_nvidia: 'which nvidia-smi 2>&1 || echo NOT_IN_PATH',
    find_nvidia: 'find /usr /opt /usr/local -name nvidia-smi 2>/dev/null | head -5 || echo NOT_FOUND',
    proc_driver: 'ls /proc/driver/nvidia/ 2>/dev/null || echo NO_PROC_DRIVER',
    env_path: 'echo $PATH',
    raw_nvidia: 'nvidia-smi 2>&1 | head -5 || echo FAILED',
    nvidia_L: 'nvidia-smi -L 2>&1 || echo FAILED',
  }

  for (const [key, cmd] of Object.entries(cmds)) {
    try { diagnostics[key] = await runSSHRaw(opts, cmd) } catch (e) { diagnostics[key] = `ERROR: ${e}` }
  }

  return NextResponse.json(diagnostics)
}
