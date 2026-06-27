export type ServerStatus = 'online' | 'offline' | 'degraded'
export type ModelCategory = 'general' | 'code' | 'embedding' | 'vision'
export type KeyStatus = 'active' | 'revoked'
export type AlertSeverity = 'warning' | 'critical'
export type AlertType = 'gpu_temp' | 'vram' | 'server_down' | 'rate_limit'
export type RequestStatus = 'success' | 'error' | 'timeout'

export interface GPU {
  id: number
  name: string
  vramTotalGiB: number
  vramUsedGiB: number
  tempC: number
  utilizationPct: number
  powerWatts: number
}

export interface OllamaServer {
  id: string
  name: string
  url: string
  status: ServerStatus
  location: string
  version: string
  gpus: GPU[]
  modelsLoaded: string[]
  requestsPerMin: number
  responseTimeMs: number
  uptimePct: number
  addedAt: string
  lastSeen: string
  totalRequests: number
}

export interface Model {
  id: string
  name: string
  displayName: string
  family: string
  sizeGiB: number
  parametersBillion: number
  quantization: string
  contextLength: number
  category: ModelCategory
  servers: string[]
  totalRequests: number
  avgLatencyMs: number
  tokensPerSec: number
  lastUsed: string
}

export interface ApiKey {
  id: string
  name: string
  keyMasked: string
  createdAt: string
  lastUsed: string
  requestsToday: number
  requestsTotal: number
  rateLimitRpm: number
  rateLimitTpm: number | null
  status: KeyStatus
  allowedModels: string[] | null
  createdBy: string
}

export interface HourlyStats {
  hour: string
  requests: number
  tokensIn: number
  tokensOut: number
  avgLatencyMs: number
  p95LatencyMs: number
  errors: number
}

export interface Alert {
  id: string
  type: AlertType
  severity: AlertSeverity
  message: string
  serverId: string
  serverName: string
  timestamp: string
  resolved: boolean
}

export interface RequestLog {
  id: string
  timestamp: string
  model: string
  serverId: string
  serverName: string
  apiKeyName: string
  tokensIn: number
  tokensOut: number
  latencyMs: number
  status: RequestStatus
}
