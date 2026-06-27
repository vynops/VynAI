/** Ollama REST API types and client */

export interface OllamaModelDetails {
  parent_model: string
  format: string
  family: string
  families: string[]
  parameter_size: string
  quantization_level: string
}

export interface OllamaModel {
  name: string
  model: string
  modified_at: string
  size: number
  digest: string
  details: OllamaModelDetails
}

export interface OllamaRunningModel extends OllamaModel {
  size_vram: number
  expires_at: string
}

export interface OllamaTagsResponse { models: OllamaModel[] }
export interface OllamaPsResponse { models: OllamaRunningModel[] }
export interface OllamaVersionResponse { version: string }

const TIMEOUT_MS = 6000

async function ollamaFetch<T>(baseUrl: string, path: string): Promise<T> {
  const url = `${baseUrl.replace(/\/+$/, '')}${path}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json() as Promise<T>
  } finally {
    clearTimeout(timer)
  }
}

export async function ollamaTags(url: string) {
  return ollamaFetch<OllamaTagsResponse>(url, '/api/tags')
}
export async function ollamaPs(url: string) {
  return ollamaFetch<OllamaPsResponse>(url, '/api/ps')
}
export async function ollamaVersion(url: string) {
  return ollamaFetch<OllamaVersionResponse>(url, '/api/version')
}
export async function ollamaPull(url: string, model: string) {
  return ollamaFetch<{ status: string }>(url, '/api/pull')
    // Actual pull is a streaming POST — we just kick it off
    .catch(() => null)
}

/** Returns version + tags + ps in parallel; null fields if offline */
export async function ollamaStatus(baseUrl: string) {
  const t0 = Date.now()
  try {
    const [version, tags, ps] = await Promise.all([
      ollamaVersion(baseUrl),
      ollamaTags(baseUrl),
      ollamaPs(baseUrl),
    ])
    return {
      online: true,
      latencyMs: Date.now() - t0,
      version: version.version,
      tags: tags.models ?? [],
      ps: ps.models ?? [],
      error: null,
    }
  } catch (err) {
    return {
      online: false,
      latencyMs: null,
      version: null,
      tags: [] as OllamaModel[],
      ps: [] as OllamaRunningModel[],
      error: err instanceof Error ? err.message : 'Unreachable',
    }
  }
}
