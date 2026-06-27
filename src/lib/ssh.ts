import { Client } from 'ssh2'

export interface GpuMetric {
  index: number
  name: string
  vramTotalMiB: number
  vramUsedMiB: number
  tempC: number
  utilizationPct: number
  powerWatts: number
}

export interface SystemMetrics {
  gpus: GpuMetric[]
  ramTotalMiB: number
  ramUsedMiB: number
  diskTotalGiB: number
  diskUsedGiB: number
  diskUsePct: number
  error: string | null
}

interface SSHOptions {
  host: string
  port: number
  username: string
  password: string
}

const TIMEOUT_MS = 8000

function runSSH(opts: SSHOptions, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    let stdout = ''
    const timer = setTimeout(() => { conn.end(); reject(new Error('SSH timeout')) }, TIMEOUT_MS)

    conn
      .on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) { clearTimeout(timer); conn.end(); reject(err); return }
          stream.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
          stream.stderr.on('data', () => {})
          stream.on('close', () => { clearTimeout(timer); conn.end(); resolve(stdout) })
        })
      })
      .on('error', (err) => { clearTimeout(timer); reject(err) })
      .connect({ host: opts.host, port: opts.port, username: opts.username, password: opts.password, readyTimeout: 5000 })
  })
}

function parseNvidiaSmi(raw: string): GpuMetric[] {
  return raw.trim().split('\n').flatMap((line, i) => {
    const parts = line.split(',').map(s => s.trim())
    if (parts.length < 6) return []   // 6 fields: name,memTotal,memUsed,temp,util,power
    return [{
      index: i,
      name: parts[0],
      vramTotalMiB: parseInt(parts[1]) || 0,
      vramUsedMiB: parseInt(parts[2]) || 0,
      tempC: parseInt(parts[3]) || 0,
      utilizationPct: parseInt(parts[4]) || 0,
      powerWatts: parseFloat(parts[5]) || 0,
    }]
  })
}

function parseMemInfo(raw: string): { totalMiB: number; usedMiB: number } {
  // free -m output: "Mem:   total used free shared buff/cache available"
  const line = raw.trim().split('\n').find(l => l.startsWith('Mem:'))
  if (!line) return { totalMiB: 0, usedMiB: 0 }
  const parts = line.split(/\s+/)
  return { totalMiB: parseInt(parts[1]) || 0, usedMiB: parseInt(parts[2]) || 0 }
}

function parseDiskInfo(raw: string): { totalGiB: number; usedGiB: number; usePct: number } {
  // df -BG output last line: Filesystem 1G-blocks Used Available Use% Mountpoint
  const line = raw.trim().split('\n').pop() ?? ''
  const parts = line.split(/\s+/)
  const totalGiB = parseFloat(parts[1]?.replace('G', '') ?? '0') || 0
  const usedGiB = parseFloat(parts[2]?.replace('G', '') ?? '0') || 0
  const usePct = parseInt(parts[4]?.replace('%', '') ?? '0') || 0
  return { totalGiB, usedGiB, usePct }
}

// Try each known nvidia-smi location with full args — correct OR-chain approach
const QUERY = '--query-gpu=name,memory.total,memory.used,temperature.gpu,utilization.gpu,power.draw --format=csv,noheader,nounits'
const NVIDIA_PATHS = ['nvidia-smi', '/usr/bin/nvidia-smi', '/usr/local/bin/nvidia-smi', '/opt/cuda/bin/nvidia-smi', '/usr/local/cuda/bin/nvidia-smi']
const GPU_CMD = NVIDIA_PATHS.map(p => `${p} ${QUERY} 2>/dev/null`).join(' || ') + ' || echo NO_GPU'

const COMMAND = [
  `bash -c '${GPU_CMD}'`,
  'echo "---MEM---"',
  'free -m | grep "^Mem:"',
  'echo "---DISK---"',
  'df -BG / | tail -1',
].join('; ')

export async function fetchServerMetrics(opts: SSHOptions): Promise<SystemMetrics> {
  let raw: string
  try {
    raw = await runSSH(opts, COMMAND)
  } catch (err) {
    return { gpus: [], ramTotalMiB: 0, ramUsedMiB: 0, diskTotalGiB: 0, diskUsedGiB: 0, diskUsePct: 0, error: err instanceof Error ? err.message : 'SSH failed' }
  }

  const sections = raw.split(/---MEM---|---DISK---/)
  const gpuSection = sections[0] ?? ''
  const memSection = sections[1] ?? ''
  const diskSection = sections[2] ?? ''

  const gpus = gpuSection.includes('NO_GPU') ? [] : parseNvidiaSmi(gpuSection)
  const { totalMiB: ramTotalMiB, usedMiB: ramUsedMiB } = parseMemInfo(memSection)
  const { totalGiB: diskTotalGiB, usedGiB: diskUsedGiB, usePct: diskUsePct } = parseDiskInfo(diskSection)

  return { gpus, ramTotalMiB, ramUsedMiB, diskTotalGiB, diskUsedGiB, diskUsePct, error: null }
}
