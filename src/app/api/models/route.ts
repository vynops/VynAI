import { NextResponse } from 'next/server'
import { listServers } from '@/lib/server-store'
import { ollamaTags, ollamaPs, type OllamaModel } from '@/lib/ollama'

export interface AggregatedModel {
  name: string
  servers: string[]
  serverNames: string[]
  loadedOn: string[]
  sizeBytes: number
  details: OllamaModel['details']
  modifiedAt: string
}

export async function GET() {
  const servers = listServers()
  if (!servers.length) return NextResponse.json([])

  // Fetch tags + ps from all servers in parallel
  const results = await Promise.allSettled(
    servers.map(async (srv) => {
      const [tags, ps] = await Promise.all([
        ollamaTags(srv.url).catch(() => ({ models: [] as OllamaModel[] })),
        ollamaPs(srv.url).catch(() => ({ models: [] as OllamaModel[] })),
      ])
      return { srv, tags: tags.models, loadedNames: ps.models.map(m => m.name) }
    })
  )

  // Aggregate: group by model name across servers
  const map = new Map<string, AggregatedModel>()

  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    const { srv, tags, loadedNames } = r.value

    for (const m of tags) {
      const existing = map.get(m.name)
      if (existing) {
        existing.servers.push(srv.id)
        existing.serverNames.push(srv.name)
        if (loadedNames.includes(m.name)) existing.loadedOn.push(srv.name)
      } else {
        map.set(m.name, {
          name: m.name,
          servers: [srv.id],
          serverNames: [srv.name],
          loadedOn: loadedNames.includes(m.name) ? [srv.name] : [],
          sizeBytes: m.size,
          details: m.details,
          modifiedAt: m.modified_at,
        })
      }
    }
  }

  const models = Array.from(map.values()).sort((a, b) => b.sizeBytes - a.sizeBytes)
  return NextResponse.json(models)
}
