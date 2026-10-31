import { fetch } from 'expo/fetch'

import { isGeminiModel, thinkingLevelFor } from '@/data/ai'
import type { TokenUsage } from '@/db/tokenUsage'

/** One timeout covers connection setup and the full streamed answer. */
const TIMEOUT_MS = 60_000

export class GeminiError extends Error {
  constructor(message: string, readonly kind: 'auth' | 'quota' | 'network' | 'timeout' | 'other', readonly status?: number) {
    super(message)
  }
}

/** Base64 image bytes sent inline. Keep well under the 20MB total request cap. */
export type GeminiImage = { mimeType: string; data: string }
export type GeminiAudio = { mimeType: string; data: string }

type GeminiHistoryMessage = { role: 'user' | 'assistant'; text: string; image?: GeminiImage; audio?: GeminiAudio }

type GeminiPart = { text: string } | { inlineData: GeminiImage | GeminiAudio }

/** Image first, then the question: Gemini follows instructions about an image better in that order. */
function toParts(message: GeminiHistoryMessage): GeminiPart[] {
  const parts: GeminiPart[] = []
  if (message.image) parts.push({ inlineData: message.image })
  if (message.audio) parts.push({ inlineData: message.audio })
  if (message.text) parts.push({ text: message.text })
  return parts.length ? parts : [{ text: '' }]
}

type GeminiErrorBody = { error?: { message?: string; status?: string; details?: { reason?: string }[] } }

/** Trims raw API messages down to a one-line, user-readable sentence. */
function trimApiMessage(message: string): string {
  return message.replace(/\s+/g, ' ').slice(0, 160).trim()
}

function mapError(status: number, body: GeminiErrorBody): GeminiError {
  const apiMessage = body.error?.message
  const keyInvalid = apiMessage?.includes('API_KEY_INVALID') || body.error?.status === 'API_KEY_INVALID' ||
    body.error?.details?.some((detail) => detail.reason === 'API_KEY_INVALID')
  if (status === 400 && keyInvalid) {
    return new GeminiError('This API key was rejected. Check that you copied it correctly.', 'auth', status)
  }
  if (status === 401 || status === 403) {
    return new GeminiError('This API key was rejected. Check that you copied it correctly.', 'auth', status)
  }
  if (status === 429) return new GeminiError('Gemini free-tier limit reached. Try again later.', 'quota', status)
  if (status === 404 || (apiMessage && /not found|not supported|generateContent/i.test(apiMessage))) {
    return new GeminiError('That model cannot answer in chat. Pick another model in Chat settings.', 'other', status)
  }
  return new GeminiError(apiMessage ? trimApiMessage(apiMessage) : `Gemini request failed (HTTP ${status}).`, 'other', status)
}

type GeminiUsageBody = { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } }

/**
 * Thought tokens count against maxOutputTokens, so a tight cap makes the model spend
 * the whole budget reasoning and return no text at all. Keep this generous and control
 * answer length through the system prompt instead.
 */
const MAX_OUTPUT_TOKENS = 2048

export async function generateGemini({ apiKey, model, system, history, signal, onToken }: {
  apiKey: string
  model: string
  system: string
  history: GeminiHistoryMessage[]
  signal?: AbortSignal
  onToken?: (token: string) => void
}): Promise<{ text: string; usage: TokenUsage }> {
  if (signal?.aborted) return { text: '', usage: { promptTokens: 0, completionTokens: 0 } }
  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, TIMEOUT_MS)
  const abortRequest = () => controller.abort()
  signal?.addEventListener('abort', abortRequest, { once: true })
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let full = ''
  const usage: TokenUsage = { promptTokens: 0, completionTokens: 0 }
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: history.map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: toParts(message) })),
        generationConfig: {
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          temperature: 0.4,
          // thinkingConfig is only valid on the catalog's thinking models; older or
          // non-catalog ids from models.list would reject the whole request over it.
          ...(isGeminiModel(model) ? { thinkingConfig: { thinkingLevel: thinkingLevelFor(model) } } : {}),
        },
      }),
      signal: controller.signal,
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as GeminiErrorBody
      throw mapError(response.status, body)
    }
    if (!response.body) throw new GeminiError('Gemini returned an empty response stream.', 'other')

    reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let emptyReason: string | undefined
    const handleLine = (line: string) => {
      if (!line.startsWith('data:')) return
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') return
      let body: GeminiErrorBody & GeminiUsageBody & {
        promptFeedback?: { blockReason?: string }
        candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[]
      }
      try {
        body = JSON.parse(payload) as typeof body
      } catch {
        return
      }
      if (body.error) throw mapError(Number((body.error as { code?: number }).code) || 500, body)
      if (body.usageMetadata) {
        usage.promptTokens = body.usageMetadata.promptTokenCount ?? usage.promptTokens
        usage.completionTokens = (body.usageMetadata.candidatesTokenCount ?? 0) + (body.usageMetadata.thoughtsTokenCount ?? 0)
      }
      const candidate = body.candidates?.[0]
      if (candidate?.finishReason || body.promptFeedback?.blockReason) {
        emptyReason = body.promptFeedback?.blockReason ?? candidate?.finishReason
      }
      for (const part of candidate?.content?.parts ?? []) {
        if (typeof part.text !== 'string' || !part.text || part.thought) continue
        full += part.text
        onToken?.(part.text)
      }
    }

    while (!signal?.aborted) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let newline: number
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, '')
        buffer = buffer.slice(newline + 1)
        handleLine(line)
      }
    }
    buffer += decoder.decode()
    if (buffer) handleLine(buffer.replace(/\r$/, ''))
    if (signal?.aborted) return { text: full.trim(), usage }
    if (!full.trim()) {
      throw new GeminiError(emptyReason ? `Gemini returned no answer (${emptyReason}).` : 'Gemini returned an empty reply.', 'other')
    }
    return { text: full.trim(), usage }
  } catch (error) {
    if (signal?.aborted) return { text: full.trim(), usage }
    if (timedOut) throw new GeminiError(`Gemini took longer than ${TIMEOUT_MS / 1000}s to answer.`, 'timeout')
    if (error instanceof GeminiError) throw error
    const detail = error instanceof Error && error.message ? ` (${error.message})` : ''
    throw new GeminiError(`Cannot reach Gemini. Check your internet connection.${detail}`, 'network')
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abortRequest)
    if (reader) {
      try { await reader.cancel() } catch {}
      reader.releaseLock()
    }
  }
}

export async function testGeminiKey(apiKey: string, model: string): Promise<void> {
  await generateGemini({ apiKey, model, system: 'You are a connectivity test.', history: [{ role: 'user', text: 'Reply with OK.' }] })
}
