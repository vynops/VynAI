import { NextRequest, NextResponse } from 'next/server'
import { validateKey, incrementUsage } from '@/lib/key-store'
import { checkRateLimit } from '@/lib/rate-limiter'
import { listServers } from '@/lib/server-store'
import { ollamaStatus } from '@/lib/ollama'

// Round-robin counter (in-memory)
let rrIndex = 0

function errorJson(status: number, message: string, code: string) {
  return NextResponse.json(
    { error: { message, type: 'invalid_request_error', code } },
    { status }
  )
}

export async function POST(req: NextRequest) {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) return errorJson(401, 'Missing Authorization header', 'missing_auth')

  const apiKey = validateKey(token)
  if (!apiKey) return errorJson(401, 'Invalid or revoked API key', 'invalid_api_key')

  // ── 2. Rate limit ─────────────────────────────────────────────────────────
  if (!checkRateLimit(apiKey.id, apiKey.rateLimitRpm)) {
    return errorJson(429, `Rate limit exceeded: ${apiKey.rateLimitRpm} req/min`, 'rate_limit_exceeded')
  }

  // ── 3. Parse request body ─────────────────────────────────────────────────
  let body: {
    model?: string
    messages?: Array<{ role: string; content: string }>
    stream?: boolean
    temperature?: number
    max_tokens?: number
    top_p?: number
  }
  try { body = await req.json() } catch {
    return errorJson(400, 'Invalid JSON body', 'invalid_body')
  }

  if (!body.model) return errorJson(400, 'model is required', 'missing_model')
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return errorJson(400, 'messages array is required', 'missing_messages')
  }

  // Check allowedModels restriction
  if (apiKey.allowedModels && !apiKey.allowedModels.includes(body.model)) {
    return errorJson(403, `Model "${body.model}" is not allowed for this key`, 'model_not_allowed')
  }

  const shouldStream = body.stream !== false // default true

  // ── 4. Pick an online Ollama server (round-robin) ─────────────────────────
  const servers = listServers()
  if (servers.length === 0) return errorJson(503, 'No Ollama servers configured', 'no_servers')

  // Try servers starting from rrIndex, skip offline ones
  let target: string | null = null
  for (let i = 0; i < servers.length; i++) {
    const srv = servers[(rrIndex + i) % servers.length]
    const s = await ollamaStatus(srv.url).catch(() => null)
    if (s?.online) {
      target = srv.url
      rrIndex = (rrIndex + i + 1) % servers.length
      break
    }
  }

  if (!target) return errorJson(503, 'No Ollama servers are currently online', 'servers_offline')

  // ── 5. Forward to Ollama /api/chat ────────────────────────────────────────
  const ollamaPayload = {
    model: body.model,
    messages: body.messages,
    stream: shouldStream,
    ...(body.temperature !== undefined && { options: { temperature: body.temperature } }),
  }

  let ollamaRes: Response
  try {
    ollamaRes = await fetch(`${target}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ollamaPayload),
    })
  } catch {
    return errorJson(502, 'Failed to reach Ollama server', 'upstream_error')
  }

  if (!ollamaRes.ok) {
    const text = await ollamaRes.text().catch(() => 'unknown error')
    return errorJson(502, `Ollama error: ${text}`, 'upstream_error')
  }

  // Increment usage (async, non-blocking)
  incrementUsage(apiKey.id)

  // ── 6a. Streaming response ────────────────────────────────────────────────
  if (shouldStream) {
    const completionId = `chatcmpl-${Date.now()}`
    const created = Math.floor(Date.now() / 1000)

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const reader = ollamaRes.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        function push(data: string) {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        }

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              if (!line.trim()) continue
              try {
                const chunk = JSON.parse(line)
                if (chunk.done) {
                  // Final chunk — emit finish then DONE
                  push(JSON.stringify({
                    id: completionId,
                    object: 'chat.completion.chunk',
                    created,
                    model: body.model,
                    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                  }))
                } else {
                  push(JSON.stringify({
                    id: completionId,
                    object: 'chat.completion.chunk',
                    created,
                    model: body.model,
                    choices: [{
                      index: 0,
                      delta: { role: chunk.message?.role, content: chunk.message?.content ?? '' },
                      finish_reason: null,
                    }],
                  }))
                }
              } catch { /* skip malformed line */ }
            }
          }
        } finally {
          push('[DONE]')
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  // ── 6b. Non-streaming response ────────────────────────────────────────────
  // Ollama with stream:false returns a single JSON object.
  // With stream:true (our internal handling) it returns NDJSON lines.
  // Handle both, and also handle qwen3-style thinking where content may be
  // empty but message.content still holds the visible reply.
  const text = await ollamaRes.text()
  const lines = text.trim().split('\n').filter(Boolean)
  let fullContent = ''

  if (lines.length === 1) {
    // Single JSON object (stream:false Ollama response)
    try {
      const parsed = JSON.parse(lines[0])
      // content may be '' for thinking models — still use it (could be empty thinking)
      fullContent = parsed.message?.content ?? parsed.response ?? ''
    } catch { /* skip */ }
  } else {
    // NDJSON stream — accumulate content across all chunks
    for (const line of lines) {
      try {
        const chunk = JSON.parse(line)
        fullContent += chunk.message?.content ?? chunk.response ?? ''
      } catch { /* skip */ }
    }
  }

  return NextResponse.json({
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: body.model,
    choices: [{
      index: 0,
      message: { role: 'assistant', content: fullContent },
      finish_reason: 'stop',
    }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  })
}
