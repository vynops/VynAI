import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const DATA_DIR = path.join(process.cwd(), 'data')
const SERVERS_FILE = path.join(DATA_DIR, 'servers.json')

export interface StoredServer {
  id: string
  name: string
  url: string
  addedAt: string
  // SSH credentials — stored locally, never sent to client
  sshUser?: string
  sshPassword?: string
  sshPort?: number
}

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

export function listServers(): StoredServer[] {
  ensure()
  if (!fs.existsSync(SERVERS_FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf-8')).servers ?? []
  } catch { return [] }
}

export function addServer(input: { name: string; url: string }): StoredServer {
  const server: StoredServer = {
    id: randomUUID(),
    name: input.name.trim(),
    url: input.url.trim().replace(/\/+$/, ''),
    addedAt: new Date().toISOString(),
  }
  const servers = [...listServers(), server]
  ensure()
  fs.writeFileSync(SERVERS_FILE, JSON.stringify({ servers }, null, 2))
  return server
}

export function removeServer(id: string): boolean {
  const before = listServers()
  const after = before.filter(s => s.id !== id)
  if (before.length === after.length) return false
  fs.writeFileSync(SERVERS_FILE, JSON.stringify({ servers: after }, null, 2))
  return true
}

export function getServer(id: string): StoredServer | null {
  return listServers().find(s => s.id === id) ?? null
}

export function updateServer(id: string, patch: Partial<Omit<StoredServer, 'id' | 'addedAt'>>): StoredServer | null {
  const servers = listServers()
  const idx = servers.findIndex(s => s.id === id)
  if (idx < 0) return null
  servers[idx] = { ...servers[idx], ...patch }
  ensure()
  fs.writeFileSync(SERVERS_FILE, JSON.stringify({ servers }, null, 2))
  return servers[idx]
}
