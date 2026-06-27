'use client'

import { useState, useRef, useEffect } from 'react'
import { Terminal, Copy, Trash2, ChevronRight, Loader2, Check, AlertCircle } from 'lucide-react'

interface Entry {
  id: number
  command: string
  stdout: string
  stderr: string
  exitCode: number
  durationMs: number
  error?: string
}

const QUICK = [
  { label: 'ollama ps', cmd: 'ollama ps' },
  { label: 'ollama list', cmd: 'ollama list' },
  { label: 'nvidia-smi', cmd: 'nvidia-smi' },
  { label: 'nvidia-smi -L', cmd: 'nvidia-smi -L' },
  { label: 'free -h', cmd: 'free -h' },
  { label: 'df -h /', cmd: 'df -h /' },
  { label: 'uptime', cmd: 'uptime' },
  { label: 'ollama logs', cmd: 'journalctl -u ollama -n 30 --no-pager 2>/dev/null || cat ~/.ollama/logs/server.log 2>/dev/null | tail -30' },
]

// Strip ANSI escape codes (colors, cursor movements)
function stripAnsi(s: string) {
  return s.replace(/\x1b\[[0-9;?]*[mGKHFJlh]/g, '').replace(/\x1b[()][AB012]/g, '')
}

interface Props {
  serverId: string
  serverName: string
}

export default function ServerTerminal({ serverId, serverName }: Props) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const [copied, setCopied] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const idRef = useRef(0)

  // Auto-scroll to bottom on new output
  useEffect(() => {
    const el = outputRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries, running])

  async function run(cmd: string) {
    const command = cmd.trim()
    if (!command || running) return
    setRunning(true)
    setInput('')
    setHistIdx(-1)
    setHistory(prev => [command, ...prev.filter(c => c !== command)].slice(0, 50))

    try {
      const res = await fetch(`/api/servers/${serverId}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      })
      const data = await res.json()
      setEntries(prev => [...prev, {
        id: idRef.current++,
        command,
        stdout: stripAnsi(data.stdout ?? ''),
        stderr: stripAnsi(data.stderr ?? ''),
        exitCode: data.exitCode ?? (res.ok ? 0 : 1),
        durationMs: data.durationMs ?? 0,
        error: !res.ok ? (data.error ?? 'Command failed') : undefined,
      }])
    } catch {
      setEntries(prev => [...prev, {
        id: idRef.current++, command,
        stdout: '', stderr: '', exitCode: 1, durationMs: 0,
        error: 'Network error — check connection',
      }])
    } finally {
      setRunning(false)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { run(input); return }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const i = Math.min(histIdx + 1, history.length - 1)
      setHistIdx(i); setInput(history[i] ?? '')
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const i = Math.max(histIdx - 1, -1)
      setHistIdx(i); setInput(i < 0 ? '' : history[i])
    }
  }

  function copyAll() {
    const text = entries.map(e =>
      `$ ${e.command}\n${e.error ? `Error: ${e.error}` : (e.stdout + (e.stderr ? `[stderr] ${e.stderr}` : '')).trim()}`
    ).join('\n\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="border-t border-slate-800 bg-slate-950 rounded-b-xl overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-xs text-slate-400 font-mono">{serverName}</span>
          <span className="text-xs text-slate-600">·</span>
          <span className="text-xs text-slate-600">{history.length} commands run</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={copyAll} disabled={!entries.length}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-600 hover:text-slate-300 transition-colors disabled:opacity-30" title="Copy all output">
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
          </button>
          <button onClick={() => setEntries([])} disabled={!entries.length}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-600 hover:text-slate-300 transition-colors disabled:opacity-30" title="Clear output">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Quick command buttons */}
      <div className="px-4 py-2 border-b border-slate-800/60 flex flex-wrap gap-1.5">
        {QUICK.map(({ label, cmd }) => (
          <button key={label} onClick={() => run(cmd)} disabled={running}
            className="text-xs px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white font-mono transition-colors disabled:opacity-40">
            {label}
          </button>
        ))}
      </div>

      {/* Output area */}
      <div ref={outputRef}
        className="px-4 py-3 font-mono text-xs space-y-4 overflow-y-auto"
        style={{ minHeight: 80, maxHeight: 360 }}
        onClick={() => inputRef.current?.focus()}
      >
        {entries.length === 0 && (
          <p className="text-slate-700 italic select-none">No commands yet. Try a quick command above or type below.</p>
        )}

        {entries.map(e => (
          <div key={e.id}>
            {/* Command header */}
            <div className="flex items-center gap-1.5 text-cyan-400 mb-1 select-none">
              <ChevronRight size={11} className="flex-shrink-0" />
              <span className="font-semibold">{e.command}</span>
              <span className="ml-auto flex-shrink-0 text-slate-600">
                {e.durationMs > 0 && `${e.durationMs}ms · `}
                {e.error ? (
                  <span className="text-red-500">error</span>
                ) : e.exitCode === 0 ? (
                  <span className="text-green-600">exit 0</span>
                ) : (
                  <span className="text-red-500">exit {e.exitCode}</span>
                )}
              </span>
            </div>
            {/* Error message */}
            {e.error && (
              <div className="flex items-start gap-1.5 text-red-400 pl-4">
                <AlertCircle size={11} className="flex-shrink-0 mt-0.5" />
                {e.error}
              </div>
            )}
            {/* stdout */}
            {e.stdout.trim() && (
              <pre className="text-slate-300 pl-4 whitespace-pre-wrap break-words leading-relaxed">{e.stdout.trimEnd()}</pre>
            )}
            {/* stderr (shown in amber) */}
            {e.stderr.trim() && (
              <pre className="text-amber-400/70 pl-4 whitespace-pre-wrap break-words leading-relaxed">[stderr] {e.stderr.trimEnd()}</pre>
            )}
          </div>
        ))}

        {running && (
          <div className="flex items-center gap-2 text-slate-600 select-none">
            <Loader2 size={11} className="animate-spin" />
            <span>Running…</span>
          </div>
        )}
      </div>

      {/* Input row */}
      <div className="flex items-center gap-3 px-4 py-3 border-t border-slate-800/60">
        <Terminal size={12} className="text-green-400 flex-shrink-0" />
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={running}
          placeholder="type command… (↑↓ for history, Enter to run)"
          className="flex-1 bg-transparent font-mono text-xs text-slate-200 placeholder-slate-700 focus:outline-none"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
        />
        <button onClick={() => run(input)} disabled={!input.trim() || running}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors disabled:opacity-40 flex-shrink-0">
          {running ? <Loader2 size={11} className="animate-spin" /> : <ChevronRight size={11} />}
          Run
        </button>
      </div>
    </div>
  )
}
