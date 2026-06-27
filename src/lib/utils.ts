export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

export function formatBytes(gb: number): string {
  if (gb < 1) return `${(gb * 1024).toFixed(0)} MB`
  return `${gb.toFixed(1)} GB`
}

export function cn(...classes: (string | undefined | null | boolean)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function tempColor(c: number): string {
  if (c >= 85) return 'text-red-400'
  if (c >= 75) return 'text-yellow-400'
  return 'text-green-400'
}

export function vramColor(pct: number): string {
  if (pct >= 90) return 'bg-red-500'
  if (pct >= 75) return 'bg-yellow-500'
  return 'bg-cyan-500'
}

export function guessCategory(name: string, family?: string): 'general' | 'code' | 'embedding' | 'vision' {
  const n = name.toLowerCase()
  const f = (family ?? '').toLowerCase()
  if (/embed|bge|minilm|arctic-embed|nomic/.test(n)) return 'embedding'
  if (/vision|llava|moondream|bakllava/.test(n)) return 'vision'
  if (/code|stral|devstral|deepseek-coder|codellama|wizard-coder|starcoder/.test(n) || f === 'codestral') return 'code'
  return 'general'
}
