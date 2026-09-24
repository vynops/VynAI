'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Bot, Send, User, Loader2, Server } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(response => response.json())
type Message = { role: 'user' | 'assistant'; content: string }
type Model = { name: string }
type FleetServer = { id: string; name: string; url: string }

export default function ChatPage() {
  const { data: models = [] } = useSWR<Model[]>('/api/models', fetcher)
  const { data: servers = [] } = useSWR<FleetServer[]>('/api/servers', fetcher)
  const [model, setModel] = useState('')
  const [serverId, setServerId] = useState('')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const selectedModel = model || models[0]?.name || ''

  async function sendMessage() {
    const content = input.trim()
    if (!content || !selectedModel || sending) return
    const next = [...messages, { role: 'user' as const, content }]
    setMessages(next); setInput(''); setSending(true); setError('')
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel, serverId: serverId || undefined, messages: next }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Chat request failed')
      setMessages([...next, { role: 'assistant', content: data.message?.content ?? '' }])
    } catch (err) { setError(err instanceof Error ? err.message : 'Chat request failed') }
    finally { setSending(false) }
  }

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-black text-white">Fleet Chat</h1><p className="text-xs text-slate-500">Ask an Ollama model about your fleet or any operational problem.</p></div>
        <div className="flex gap-2">
          <select value={selectedModel} onChange={event => setModel(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200">
            <option value="">Select model</option>{models.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}
          </select>
          <select value={serverId} onChange={event => setServerId(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200">
            <option value="">Any online server</option>{servers.map(server => <option key={server.id} value={server.id}>{server.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-500"><Bot size={38} className="text-cyan-400/60" /><p className="max-w-sm text-sm">Start with a question such as “Which models are loaded and where is VRAM pressure highest?”</p></div>}
          {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}><div className={`flex max-w-3xl gap-3 rounded-xl px-4 py-3 text-sm leading-relaxed ${message.role === 'user' ? 'bg-cyan-500/10 text-cyan-50' : 'bg-slate-800 text-slate-200'}`}>{message.role === 'user' ? <User size={15} className="mt-0.5 shrink-0 text-cyan-400" /> : <Bot size={15} className="mt-0.5 shrink-0 text-cyan-400" />}<p className="whitespace-pre-wrap">{message.content}</p></div></div>)}
          {sending && <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Thinking...</div>}
        </div>
        {error && <div className="border-t border-red-500/20 px-5 py-2 text-xs text-red-400">{error}</div>}
        <div className="border-t border-slate-800 p-4"><div className="flex gap-2"><textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage() } }} placeholder="Ask about your fleet..." rows={2} className="flex-1 resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/60" /><button onClick={() => void sendMessage()} disabled={!selectedModel || !input.trim() || sending} title="Send message" className="self-end rounded-lg bg-cyan-500 p-3 text-white transition hover:bg-cyan-400 disabled:opacity-40"><Send size={16} /></button></div></div>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-slate-600"><Server size={12} /> Responses are generated by the selected local Ollama model.</div>
    </div>
  )
}
