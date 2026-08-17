import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')

export interface AppSettings {
  // General
  defaultOllamaUrl: string
  // Alerts
  gpuTempThreshold: number
  vramThreshold: number
  slackWebhookUrl: string
  teamsWebhookUrl: string
  customWebhookUrl: string
  alertEmailEnabled: boolean
  alertRecipients: string
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPassword: string
  smtpFrom: string
  alertOnServerDown: boolean
  alertOnRateLimit: boolean
  // Gateway
  globalRpm: number
  globalTpm: number | null
  // Retention
  logRetentionDays: number
}

const DEFAULTS: AppSettings = {
  defaultOllamaUrl: '',
  gpuTempThreshold: 85,
  vramThreshold: 90,
  slackWebhookUrl: '',
  teamsWebhookUrl: '',
  customWebhookUrl: '',
  alertEmailEnabled: false,
  alertRecipients: '',
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpPassword: '',
  smtpFrom: '',
  alertOnServerDown: true,
  alertOnRateLimit: true,
  globalRpm: 1000,
  globalTpm: null,
  logRetentionDays: 30,
}

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

export function loadSettings(): AppSettings {
  ensure()
  if (!fs.existsSync(SETTINGS_FILE)) return { ...DEFAULTS }
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) }
  } catch { return { ...DEFAULTS } }
}

export function saveSettings(partial: Partial<AppSettings>): AppSettings {
  const current = loadSettings()
  const next = { ...current, ...partial }
  ensure()
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2))
  return next
}
