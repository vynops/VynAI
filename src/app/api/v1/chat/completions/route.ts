import { NextRequest, NextResponse } from 'next/server'
import { validateKey, incrementUsage, markKeyUsed, addTokenUsage } from '@/lib/key-store'
import { appendLog } from '@/lib/request-log-store'
import { checkRateLimit, checkKeyTokenLimit, checkGlobalRateLimit, checkGlobalTokenLimit, addKeyTokenUsage, addGlobalTokenUsage } from '@/lib/rate-limiter'
import { listServers } from '@/lib/server-store'
import { ollamaStatus } from '@/lib/ollama'
import { loadSettings } from '@/lib/settings-store'
import { canSendRateLimitAlert, clearRateLimitAlert, sendRateLimitAlerts } from '@/lib/alert-tracker'

// Round-robin counter (in-memory)
let rrIndex = 0

function errorJson(status: number, message: string, code: string) {
  return NextResponse.json(
    { error: { message, type: 'invalid_request_error', code } },
    { status }
  )
}

function logFailure(key: { id: string; name: string }, model: string, status: number, error: string, startTime: number) {
  appendLog({
    timestamp: new Date().toISOString(), keyId: key.id, keyName: key.name, model,
    promptTokens: 0, completionTokens: 0, latencyMs: Date.now() - startTime, status, error,
  })
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  // ── 1. Auth ─────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) return errorJson(401, 'Missing Authorization header', 'missing_auth')

  const apiKey = validateKey(token)
  if (!apiKey) return errorJson(401, 'Invalid or revoked API key', 'invalid_api_key')
  markKeyUsed(apiKey.id)

  const settings = loadSettings()

  // ── 2. Rate limit ───────────────────────────────────────────────
  if (!checkGlobalRateLimit(settings.globalRpm)) {
    appendLog({ timestamp: new Date().toISOString(), keyId: apiKey.id, keyName: apiKey.name, model: '', promptTokens: 0, completionTokens: 0, latencyMs: Date.now() - startTime, status: 429, error: 'Global RPM limit exceeded' })
    if (settings.alertOnRateLimit && canSendRateLimitAlert('global-rpm')) {
      void sendRateLimitAlerts(settings, `Global RPM exceeded (${settings.globalRpm} req/min)`).catch(() => clearRateLimitAlert('global-rpm'))
    }
    return errorJson(429, `Global rate limit exceeded: ${settings.globalRpm} req/min`, 'global_rate_limit_exceeded')
  }

  if (!checkGlobalTokenLimit(settings.globalTpm)) {
    appendLog({ timestamp: new Date().toISOString(), keyId: apiKey.id, keyName: apiKey.name, model: '', promptTokens: 0, completionTokens: 0, latencyMs: Date.now() - startTime, status: 429, error: 'Global TPM limit exceeded' })
    if (settings.alertOnRateLimit && canSendRateLimitAlert('global-tpm')) {
      void sendRateLimitAlerts(settings, `Global TPM exceeded (${settings.globalTpm ?? 0} tokens/min)`).catch(() => clearRateLimitAlert('global-tpm'))
    }
    return errorJson(429, 'Global token rate limit exceeded', 'global_token_rate_limit_exceeded')
  }

  if (!checkRateLimit(apiKey.id, apiKey.rateLimitRpm)) {
    appendLog({ timestamp: new Date().toISOString(), keyId: apiKey.id, keyName: apiKey.name, model: '', promptTokens: 0, completionTokens: 0, latencyMs: Date.now() - startTime, status: 429, error: 'Rate limit exceeded' })
    if (settings.alertOnRateLimit && canSendRateLimitAlert(`key-rpm-${apiKey.id}`)) {
      const alertKey = `key-rpm-${apiKey.id}`
      void sendRateLimitAlerts(settings, `Key "${apiKey.name}" exceeded ${apiKey.rateLimitRpm} req/min`).catch(() => clearRateLimitAlert(alertKey))
    }
    return errorJson(429, `Rate limit exceeded: ${apiKey.rateLimitRpm} req/min`, 'rate_limit_exceeded')
  }

  if (!checkKeyTokenLimit(apiKey.id, apiKey.rateLimitTpm ?? null)) {
    logFailure(apiKey, '', 429, 'Key TPM limit exceeded', startTime)
    return errorJson(429, `Token rate limit exceeded: ${apiKey.rateLimitTpm} tokens/min`, 'token_rate_limit_exceeded')
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
    logFailure(apiKey, '', 400, 'Invalid JSON body', startTime)
    return errorJson(400, 'Invalid JSON body', 'invalid_body')
  }

  if (!body.model) {
    logFailure(apiKey, '', 400, 'model is required', startTime)
    return errorJson(400, 'model is required', 'missing_model')
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    logFailure(apiKey, body.model, 400, 'messages array is required', startTime)
    return errorJson(400, 'messages array is required', 'missing_messages')
  }

  if (body.temperature !== undefined && (!Number.isFinite(body.temperature) || body.temperature < 0 || body.temperature > 2)) {
    logFailure(apiKey, body.model, 400, 'temperature must be between 0 and 2', startTime)
    return errorJson(400, 'temperature must be between 0 and 2', 'invalid_temperature')
  }
  if (body.max_tokens !== undefined && (!Number.isInteger(body.max_tokens) || body.max_tokens < 1)) {
    logFailure(apiKey, body.model, 400, 'max_tokens must be a positive integer', startTime)
    return errorJson(400, 'max_tokens must be a positive integer', 'invalid_max_tokens')
  }
  if (body.top_p !== undefined && (!Number.isFinite(body.top_p) || body.top_p < 0 || body.top_p > 1)) {
    logFailure(apiKey, body.model, 400, 'top_p must be between 0 and 1', startTime)
    return errorJson(400, 'top_p must be between 0 and 1', 'invalid_top_p')
  }

  // Check allowedModels restriction
  if (apiKey.allowedModels && !apiKey.allowedModels.includes(body.model)) {
    logFailure(apiKey, body.model, 403, 'Model not allowed for this key', startTime)
    return errorJson(403, `Model "${body.model}" is not allowed for this key`, 'model_not_allowed')
  }

  const shouldStream = body.stream !== false // default true

  // ── 4. Pick an online Ollama server (round-robin) ─────────────────────────
  const servers = listServers()
  if (servers.length === 0) {
    logFailure(apiKey, body.model, 503, 'No Ollama servers configured', startTime)
    return errorJson(503, 'No Ollama servers configured', 'no_servers')
  }

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

  if (!target) {
    appendLog({ timestamp: new Date().toISOString(), keyId: apiKey.id, keyName: apiKey.name, model: body.model!, promptTokens: 0, completionTokens: 0, latencyMs: Date.now() - startTime, status: 503, error: 'No servers online' })
    return errorJson(503, 'No Ollama servers are currently online', 'servers_offline')
  }

  // ── 5. Forward to Ollama /api/chat ────────────────────────────────────────
  const ollamaPayload = {
    model: body.model,
    messages: body.messages,
    stream: shouldStream,
    ...((body.temperature !== undefined || body.max_tokens !== undefined || body.top_p !== undefined) && {
      options: {
        ...(body.temperature !== undefined && { temperature: body.temperature }),
        ...(body.max_tokens !== undefined && { num_predict: body.max_tokens }),
        ...(body.top_p !== undefined && { top_p: body.top_p }),
      },
    }),
  }

  let ollamaRes: Response
  try {
    ollamaRes = await fetch(`${target}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ollamaPayload),
    })
  } catch {
    logFailure(apiKey, body.model, 502, 'Failed to reach Ollama server', startTime)
    return errorJson(502, 'Failed to reach Ollama server', 'upstream_error')
  }

  if (!ollamaRes.ok) {
    const text = await ollamaRes.text().catch(() => 'unknown error')
    appendLog({ timestamp: new Date().toISOString(), keyId: apiKey.id, keyName: apiKey.name, model: body.model!, promptTokens: 0, completionTokens: 0, latencyMs: Date.now() - startTime, status: 502, error: `Ollama: ${text.slice(0, 120)}` })
    return errorJson(502, `Ollama error: ${text}`, 'upstream_error')
  }

  // Increment usage (async, non-blocking)
  incrementUsage(apiKey.id)
  const keyId = apiKey.id

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
                  // Capture token usage from final done chunk
                  const pt = chunk.prompt_eval_count ?? 0
                  const ct = chunk.eval_count ?? 0
                  if (pt || ct) addTokenUsage(keyId, body.model!, pt, ct)
                  addKeyTokenUsage(keyId, pt + ct)
                  addGlobalTokenUsage(pt + ct)
                  appendLog({ timestamp: new Date().toISOString(), keyId, keyName: apiKey.name, model: body.model!, promptTokens: pt, completionTokens: ct, latencyMs: Date.now() - startTime, status: 200 })
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
  let promptTokenCount = 0
  let completionTokenCount = 0

  if (lines.length === 1) {
    // Single JSON object (stream:false Ollama response)
    try {
      const parsed = JSON.parse(lines[0])
      // content may be '' for thinking models — still use it (could be empty thinking)
      fullContent = parsed.message?.content ?? parsed.response ?? ''
      const pt = parsed.prompt_eval_count ?? 0
      const ct = parsed.eval_count ?? 0
      promptTokenCount = pt
      completionTokenCount = ct
      if (pt || ct) addTokenUsage(keyId, body.model!, pt, ct)
      addKeyTokenUsage(keyId, pt + ct)
      addGlobalTokenUsage(pt + ct)
      appendLog({ timestamp: new Date().toISOString(), keyId, keyName: apiKey.name, model: body.model!, promptTokens: pt, completionTokens: ct, latencyMs: Date.now() - startTime, status: 200 })
    } catch { /* skip */ }
  } else {
    // NDJSON stream — accumulate content across all chunks
    for (const line of lines) {
      try {
        const chunk = JSON.parse(line)
        fullContent += chunk.message?.content ?? chunk.response ?? ''
        if (chunk.done) {
          const pt = chunk.prompt_eval_count ?? 0
          const ct = chunk.eval_count ?? 0
          promptTokenCount += pt
          completionTokenCount += ct
          if (pt || ct) addTokenUsage(keyId, body.model!, pt, ct)
          addKeyTokenUsage(keyId, pt + ct)
          addGlobalTokenUsage(pt + ct)
          appendLog({ timestamp: new Date().toISOString(), keyId, keyName: apiKey.name, model: body.model!, promptTokens: pt, completionTokens: ct, latencyMs: Date.now() - startTime, status: 200 })
        }
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
    usage: {
      prompt_tokens: promptTokenCount,
      completion_tokens: completionTokenCount,
      total_tokens: promptTokenCount + completionTokenCount,
    },
  })
}
