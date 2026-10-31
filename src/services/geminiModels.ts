import { AUTO_MODEL, GEMINI_MODELS, MODEL_PREFERENCE, supportsVision, type GeminiModel, type GeminiModelChoice } from '@/data/ai'

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000'
const TIMEOUT_MS = 15_000
/** Keys rarely gain or lose models mid-session, so one lookup per hour is plenty. */
const CACHE_TTL_MS = 10 * 60 * 1000

type ListedModel = { name?: string; supportedGenerationMethods?: string[] }
const NON_CHAT_MODEL = /(tts|image|imagen|veo|embedding|aqa|robotics|computer-use|native-audio)/i
const COMPLEX_REQUEST = /\b(prove|step[- ]by[- ]step|analy[sz]e|debug|refactor|algorithm|derive|essay|in[- ]depth|detailed|compare|explain why)\b/i

let cache: { key: string; at: number; models: string[] } | null = null
const cooldowns = new Map<string, Map<string, number>>()

const modelBucket = (model: string) => model.replace(/^models\//, '').replace(/-\d{3}$/, '')

export function markGeminiModelUnavailable(apiKey: string, model: string, status: number) {
  const health = cooldowns.get(apiKey) ?? new Map<string, number>()
  cooldowns.set(apiKey, health)
  const duration = status === 404 ? CACHE_TTL_MS : status === 429 ? 60 * 1000 : 30 * 1000
  health.set(modelBucket(model), Date.now() + duration)
  if (status === 404) cache = null
}

/**
 * Every model this key can call through generateContent — the full free-tier
 * list, not just GabAI's curated catalog. Ordered by GabAI preference first so
 * `auto` still picks cheap models; unknown ids follow alphabetically.
 * Returns `null` when the list could not be fetched — offline, blocked, or a bad key —
 * so callers can fall back to the configured model instead of refusing to answer.
 */
export async function fetchAvailableModels(apiKey: string): Promise<string[] | null> {
  if (cache && cache.key === apiKey && Date.now() - cache.at < CACHE_TTL_MS) return cache.models
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(ENDPOINT, { headers: { 'x-goog-api-key': apiKey }, signal: controller.signal })
    if (!response.ok) return null
    const body = await response.json() as { models?: ListedModel[] }
    const callable = (body.models ?? [])
      .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
      .map((model) => model.name?.replace(/^models\//, ''))
      .filter((name): name is string => typeof name === 'string' && !NON_CHAT_MODEL.test(name))
    // Catalog ids first in preference order, then every other id the key exposes.
    const rest = callable.filter((id) => !MODEL_PREFERENCE.includes(id as GeminiModel)).sort()
    const models = [...MODEL_PREFERENCE.filter((id) => callable.includes(id)), ...rest]
    cache = { key: apiKey, at: Date.now(), models }
    return models
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export function clearModelCache() {
  cache = null
}

/**
 * Chooses the model to send a request to.
 *
 * Keeps the user's choice whenever it is usable, and only substitutes when that model
 * is missing from the key's list or cannot handle an attached image. Never blocks on
 * the network: if discovery fails, the configured model is attempted as-is.
 */
export async function resolveModel(
  apiKey: string,
  configured: GeminiModelChoice,
  options: { needsVision?: boolean; needsAudio?: boolean; question?: string; historyText?: string } = {},
): Promise<{ model: string; substituted: boolean; reason?: string }> {
  const needsVision = options.needsVision ?? false
  const needsAudio = options.needsAudio ?? false
  const available = await fetchAvailableModels(apiKey)
  const candidates = available?.length ? available : MODEL_PREFERENCE
  const mediaSupported = (model: string) => (!needsVision || supportsVision(model)) && (!needsAudio || !NON_CHAT_MODEL.test(model))

  // Auto routes short questions to Flash-Lite, regular chat and attachments to
  // Flash, and long or multi-step requests to the strongest available Pro tier.
  if (configured === AUTO_MODEL) {
    const ranked = [...candidates].filter(mediaSupported)
    const fallback = candidates.filter(mediaSupported)
    const allText = `${options.question ?? ''} ${options.historyText ?? ''}`
    const isComplex = (options.question?.length ?? 0) > 1500 || (options.historyText?.length ?? 0) > 20_000 || options.question?.includes('```') || COMPLEX_REQUEST.test(allText)
    const preferred = isComplex
      ? ranked.find((id) => /-pro(?:-|$)/i.test(id)) ?? ranked.find((id) => /flash(?!-lite)/i.test(id))
      : needsVision || needsAudio
        ? ranked.find((id) => /flash(?!-lite)/i.test(id))
        : (options.question?.trim().length ?? 0) < 60
          ? ranked.find((id) => /flash-lite/i.test(id)) ?? ranked.find((id) => /flash(?!-lite)/i.test(id))
          : ranked.find((id) => /flash(?!-lite)/i.test(id))
    const pick = preferred ?? fallback[0] ?? candidates[0]
    return { model: pick, substituted: Boolean(available && !available.includes(pick)), reason: 'picked automatically' }
  }

  if (needsVision && !supportsVision(configured)) {
    const fallback = candidates.find(supportsVision)
    if (fallback) return { model: fallback, substituted: true, reason: `${configured} cannot read images` }
  }
  if (needsAudio && NON_CHAT_MODEL.test(configured)) {
    const fallback = candidates.find((id) => !NON_CHAT_MODEL.test(id))
    if (fallback) return { model: fallback, substituted: true, reason: `${configured} cannot process voice messages` }
  }
  if (!available || available.includes(configured)) return { model: configured, substituted: false }

  const fallback = available.find(mediaSupported)
  if (!fallback) return { model: configured, substituted: false }
  return { model: fallback, substituted: true, reason: `${configured} is not available on this API key` }
}

/** Candidate models for quota and availability fallback, before any text is visible. */
export async function resolveModelCandidates(
  apiKey: string,
  configured: GeminiModelChoice,
  options: { needsVision?: boolean; needsAudio?: boolean; question?: string; historyText?: string } = {},
): Promise<string[]> {
  const selected = await resolveModel(apiKey, configured, options)
  const available = await fetchAvailableModels(apiKey)
  const pool = available?.length ? available : MODEL_PREFERENCE
  const supportsMedia = (id: string) => !NON_CHAT_MODEL.test(id) && (!options.needsVision || supportsVision(id))
  const health = cooldowns.get(apiKey)
  const ordered = [selected.model, ...pool.filter((id) => /-pro(?:-|$)/i.test(id)), ...pool.filter((id) => /flash(?!-lite)/i.test(id)), ...pool.filter((id) => /flash-lite/i.test(id)), ...pool]
  const eligible = [...new Set(ordered.filter((id) => supportsMedia(id)))].filter((id) => (health?.get(modelBucket(id)) ?? 0) <= Date.now())
  return (eligible.length ? eligible : [...new Set(ordered.filter(supportsMedia))]).slice(0, 5)
}

/** 'gemini-2.0-flash-lite' → 'Gemini 2.0 Flash Lite' when the id is not in the catalog. */
export const modelLabel = (id: string) =>
  GEMINI_MODELS.find((model) => model.id === id)?.label
  ?? id.replace(/^models\//, '').replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
