import { useSyncExternalStore } from 'react'

import type { LocalBackend } from '@/db/settings'
import type { TokenUsage } from '@/db/tokenUsage'

export class LocalModelUnavailableError extends Error {}

export const LOCAL_MODEL = {
  name: 'Gemma 4 E2B',
  fileName: 'gemma-4-E2B-it.litertlm',
  url: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm',
  bytes: 2_588_147_712,
}

export const LOCAL_CONTEXT_TOKENS = 4096
export type LocalModelStatus = 'missing' | 'downloading' | 'paused' | 'downloaded' | 'loading' | 'ready' | 'unsupported'
export type LocalModelState = {
  status: LocalModelStatus
  progress: number
  downloadedBytes: number
  totalBytes: number
  speedBytesPerSecond: number
  etaSeconds: number | null
  backend?: LocalBackend
  error?: string
}

const state: LocalModelState = { status: 'unsupported', progress: 0, downloadedBytes: 0, totalBytes: LOCAL_MODEL.bytes, speedBytesPerSecond: 0, etaSeconds: null }
const subscribe = (_listener: () => void) => () => {}
const noop = async () => {}

export function getLocalModelStatus(): LocalModelStatus { return 'unsupported' }
export function isLocalModelAvailable() { return false }
export function subscribeLocalModel(listener: () => void) { return subscribe(listener) }
export async function releaseLocalConversation(_conversationId?: string) {}
export async function loadLocalModel(_backend?: LocalBackend, _system?: string) { throw new LocalModelUnavailableError('On-device AI is not available in the web preview.') }
export async function unloadEngine() {}
export async function deleteModel() {}

export function useLocalModel() {
  const current = useSyncExternalStore(subscribe, () => state, () => state)
  return { ...current, engineAvailable: false, download: noop, resume: noop, pause: noop, cancel: noop, remove: deleteModel, load: loadLocalModel, unload: unloadEngine }
}

export async function generateLocal(_options?: {
  system: string
  history: { role: 'user' | 'assistant'; text: string; imageUri?: string; audioUri?: string }[]
  nPredict: number
  backend?: LocalBackend
  conversationId?: string
  signal?: AbortSignal
  onToken?: (token: string) => void
  onReset?: () => void
  onContext?: (usage: { usedTokens: number; maxTokens: number }) => void
}): Promise<{ text: string; usage: TokenUsage }> {
  throw new LocalModelUnavailableError('On-device AI is not available in the web preview.')
}
