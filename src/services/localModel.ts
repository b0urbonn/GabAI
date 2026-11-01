import { Directory, DownloadTask, File, Paths } from 'expo-file-system'
import { requireOptionalNativeModule } from 'expo'
import * as Device from 'expo-device'
import { Platform, TurboModuleRegistry } from 'react-native'
import type {
  Backend,
  ConversationHandle,
  LiteRTLMInstance,
  MultimodalPart,
} from 'react-native-litert-lm'
import { useSyncExternalStore } from 'react'

import type { LocalBackend } from '@/db/settings'
import type { TokenUsage } from '@/db/tokenUsage'

export class LocalModelUnavailableError extends Error {}

const hasNitro = Boolean(TurboModuleRegistry.get('NitroModules'))
function localRuntime(): typeof import('react-native-litert-lm') {
  if (!hasNitro) throw new LocalModelUnavailableError('Local AI needs the updated GabAI development build. Install it to enable the on-device model.')
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Load only after checking the installed native runtime.
  return require('react-native-litert-lm')
}

const isMemoryError = (error: unknown) => error instanceof Error && 'code' in error && error.code === 'MEMORY_ESTIMATE_EXCEEDED'

export const LOCAL_MODEL = {
  name: 'Gemma 4 E2B',
  fileName: 'gemma-4-E2B-it.litertlm',
  url: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm',
  bytes: 2_588_147_712,
}

export const LOCAL_CONTEXT_TOKENS = 4096
const MODEL_DIR = new Directory(Paths.document, 'models')
const MODEL_FILE = new File(MODEL_DIR, LOCAL_MODEL.fileName)
const PART_FILE = new File(MODEL_DIR, `${LOCAL_MODEL.fileName}.download`)
const PAUSE_FILE = new File(MODEL_DIR, `${LOCAL_MODEL.fileName}.pause.json`)
const REQUIRED_FREE_BYTES = LOCAL_MODEL.bytes + 256 * 1024 * 1024
const TRANSCRIPT_BUDGET = 3000

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

const initialPartialBytes = PART_FILE.exists ? PART_FILE.size ?? 0 : 0
let state: LocalModelState = {
  status: !hasNitro ? 'unsupported' : MODEL_FILE.exists ? 'downloaded' : PAUSE_FILE.exists || initialPartialBytes > 0 ? 'paused' : 'missing',
  progress: MODEL_FILE.exists ? 1 : Math.min(1, initialPartialBytes / LOCAL_MODEL.bytes),
  downloadedBytes: MODEL_FILE.exists ? MODEL_FILE.size ?? LOCAL_MODEL.bytes : initialPartialBytes,
  totalBytes: LOCAL_MODEL.bytes,
  speedBytesPerSecond: 0,
  etaSeconds: null,
}
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const snapshot = () => state
function setState(patch: Partial<LocalModelState>) {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

let activeDownload: DownloadTask | null = null
let downloadIntent: 'pause' | 'cancel' | null = null
let engine: LiteRTLMInstance | null = null
let engineBackend: LocalBackend | null = null
let engineMultimodal = false
let engineLoading: Promise<LiteRTLMInstance> | null = null
const conversations = new Map<string, ConversationHandle>()
const conversationPrompts = new Map<string, string>()

// Loading, generation and teardown share native pointers. In particular, a
// settings action must never unload an engine while a chat is still using it.
let engineQueue: Promise<unknown> = Promise.resolve()
function withEngine<T>(action: () => Promise<T>): Promise<T> {
  const task = engineQueue.then(action)
  engineQueue = task.catch(() => {})
  return task
}

type DeviceReport = {
  compatible: boolean
  availableMemoryBytes: number
  lowMemory: boolean
  candidates: Backend[]
}

type LocalAiDevice = {
  scan?: () => Promise<{
    androidApi: number
    arm64: boolean
    totalRamBytes: number
    availableRamBytes: number
    lowMemory: boolean
    npuDetected: boolean
    gpuAvailable: boolean
    model?: string
  }>
  prepareAudio?: (uri: string) => Promise<string>
  prepareImage?: (uri: string) => Promise<string>
}

function nativeDevice(): LocalAiDevice | null {
  return requireOptionalNativeModule<LocalAiDevice>('LocalAiDevice')
}

export function getLocalModelStatus(): LocalModelStatus {
  return state.status
}

export function isLocalModelAvailable(): boolean {
  return hasNitro && MODEL_FILE.exists
}

export function subscribeLocalModel(listener: () => void) {
  return subscribe(listener)
}

function progressState(bytes: number, previous: { at: number; bytes: number; speed: number }) {
  const now = Date.now()
  const seconds = (now - previous.at) / 1000
  const delta = Math.max(0, bytes - previous.bytes)
  const speed = seconds > 0 && delta > 0
    ? previous.speed > 0 ? previous.speed * 0.65 + (delta / seconds) * 0.35 : delta / seconds
    : previous.speed
  previous.at = now
  previous.bytes = bytes
  previous.speed = speed
  setState({
    status: 'downloading',
    downloadedBytes: bytes,
    totalBytes: LOCAL_MODEL.bytes,
    progress: Math.min(1, bytes / LOCAL_MODEL.bytes),
    speedBytesPerSecond: speed,
    etaSeconds: speed > 0 ? Math.ceil(Math.max(0, LOCAL_MODEL.bytes - bytes) / speed) : null,
    error: undefined,
  })
}

async function readPauseState() {
  if (!PAUSE_FILE.exists) return null
  try {
    return JSON.parse(await PAUSE_FILE.text()) as ReturnType<DownloadTask['savable']>
  } catch {
    return null
  }
}

async function runDownload(resume: boolean) {
  if (activeDownload) return
  if (MODEL_FILE.exists) {
    setState({ status: 'downloaded', progress: 1, downloadedBytes: MODEL_FILE.size ?? LOCAL_MODEL.bytes, error: undefined })
    return
  }
  if (Paths.availableDiskSpace < REQUIRED_FREE_BYTES) {
    setState({ status: 'missing', error: 'Not enough free space. Keep at least 2.9 GB free to download and load Gemma 4 E2B.' })
    return
  }
  if (!MODEL_DIR.exists) MODEL_DIR.create({ intermediates: true, idempotent: true })

  const saved = resume ? await readPauseState() : null
  if (resume && !saved && PART_FILE.exists) PART_FILE.delete()
  if (!resume) {
    if (PART_FILE.exists) PART_FILE.delete()
    if (PAUSE_FILE.exists) PAUSE_FILE.delete()
  }
  const startingBytes = PART_FILE.exists ? PART_FILE.size ?? 0 : 0
  const meter = { at: Date.now(), bytes: startingBytes, speed: 0 }
  setState({
    status: 'downloading',
    progress: Math.min(1, startingBytes / LOCAL_MODEL.bytes),
    downloadedBytes: startingBytes,
    totalBytes: LOCAL_MODEL.bytes,
    speedBytesPerSecond: 0,
    etaSeconds: null,
    error: undefined,
  })

  const task = saved
    ? DownloadTask.fromSavable(saved, { onProgress: ({ bytesWritten }) => progressState(bytesWritten, meter) })
    : File.createDownloadTask(LOCAL_MODEL.url, PART_FILE, { onProgress: ({ bytesWritten }) => progressState(bytesWritten, meter) })
  activeDownload = task
  downloadIntent = null
  try {
    const downloaded = saved ? await task.resumeAsync() : await task.downloadAsync()
    activeDownload = null
    if (!downloaded) {
      if (downloadIntent === 'cancel') {
        await clearDownload()
        return
      }
      const partial = PART_FILE.exists ? PART_FILE.size ?? 0 : 0
      setState({ status: 'paused', progress: Math.min(1, partial / LOCAL_MODEL.bytes), downloadedBytes: partial, etaSeconds: null })
      return
    }
    if (downloaded.size !== LOCAL_MODEL.bytes) {
      if (PART_FILE.exists) PART_FILE.delete()
      throw new Error('The model download is incomplete. Resume it or start the download again.')
    }
    await downloaded.move(MODEL_FILE)
    if (PAUSE_FILE.exists) PAUSE_FILE.delete()
    setState({ status: 'downloaded', progress: 1, downloadedBytes: LOCAL_MODEL.bytes, error: undefined })
  } catch (error) {
    activeDownload = null
    if (downloadIntent === 'cancel') {
      await clearDownload()
      return
    }
    if (downloadIntent === 'pause') {
      const partial = PART_FILE.exists ? PART_FILE.size ?? 0 : 0
      setState({ status: 'paused', progress: Math.min(1, partial / LOCAL_MODEL.bytes), downloadedBytes: partial, etaSeconds: null })
      return
    }
    setState({
      status: PART_FILE.exists ? 'paused' : 'missing',
      progress: PART_FILE.exists ? Math.min(1, (PART_FILE.size ?? 0) / LOCAL_MODEL.bytes) : 0,
      downloadedBytes: PART_FILE.exists ? PART_FILE.size ?? 0 : 0,
      error: error instanceof Error ? error.message : 'Download failed. Check your connection and free space, then try again.',
    })
  } finally {
    if (activeDownload === task) activeDownload = null
    task.release()
    downloadIntent = null
  }
}

async function clearDownload() {
  if (MODEL_FILE.exists) MODEL_FILE.delete()
  if (PART_FILE.exists) PART_FILE.delete()
  if (PAUSE_FILE.exists) PAUSE_FILE.delete()
  setState({ status: 'missing', progress: 0, downloadedBytes: 0, error: undefined, etaSeconds: null })
}

async function download() {
  await runDownload(false)
}

async function resume() {
  await runDownload(true)
}

async function pause() {
  const task = activeDownload
  if (!task || task.state !== 'active') return
  downloadIntent = 'pause'
  try {
    await task.pauseAsync()
    const pauseState = task.savable()
    PAUSE_FILE.create({ overwrite: true })
    await PAUSE_FILE.write(JSON.stringify(pauseState))
    const partial = PART_FILE.exists ? PART_FILE.size ?? 0 : 0
    setState({ status: 'paused', progress: Math.min(1, partial / LOCAL_MODEL.bytes), downloadedBytes: partial, etaSeconds: null })
  } catch {
    downloadIntent = null
    setState({ error: 'Unable to pause the model download. Please try again.' })
  }
}

async function cancel() {
  const task = activeDownload
  downloadIntent = 'cancel'
  if (task) {
    try { task.cancel() } catch {}
  }
  await clearDownload()
}

export function useLocalModel() {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot)
  return { ...current, engineAvailable: hasNitro, download, resume, pause, cancel, remove: deleteModel, load: loadLocalModel, unload: unloadEngine }
}

function filePath(uri: string) {
  if (!uri.startsWith('file://')) throw new LocalModelUnavailableError('Attachment is not saved on this device.')
  return decodeURIComponent(uri.slice('file://'.length))
}

async function inspectDevice(multimodal: boolean): Promise<DeviceReport> {
  const runtime = localRuntime()
  let device: DeviceReport
  let gpuAvailable = true
  if (Platform.OS === 'android') {
    const report = await nativeDevice()?.scan?.()
    if (!report) throw new LocalModelUnavailableError('Update GabAI to enable local model hardware detection.')
    gpuAvailable = report.gpuAvailable
    device = {
      compatible: report.arm64 && report.androidApi >= 26,
      availableMemoryBytes: report.availableRamBytes,
      lowMemory: report.lowMemory,
      candidates: ['cpu'],
    }
  } else {
    // totalMemory is the phone's RAM, not the app's remaining jetsam budget.
    // A lightweight, unloaded instance can read the latter without parsing the model.
    const probe = runtime.createLLM()
    try {
      const memory = probe.getMemoryUsage()
      device = {
        compatible: Platform.OS === 'ios' && Device.isDevice,
        availableMemoryBytes: memory.availableMemoryBytes,
        lowMemory: memory.isLowMemory,
        candidates: ['cpu'],
      }
    } finally {
      probe.close()
    }
  }
  if (!device.compatible) throw new LocalModelUnavailableError('Local AI requires a physical, supported device.')
  // inspectModel itself reads the vision encoder and can allocate hundreds of
  // MB. Refuse unsafe loads BEFORE that native call, not just before loadModel.
  resolveBackend('cpu', device, multimodal)
  const info = await runtime.inspectModel(MODEL_FILE.uri)
  // An NNAPI accelerator does not mean this bundle was compiled for its NPU.
  const recommendation = runtime.recommendBackend(info, { device: runtime.getDeviceInfo(), prefer: 'compatibility' })
  if (!recommendation.compatible) throw new LocalModelUnavailableError(recommendation.reason)
  device.candidates = recommendation.candidates.filter((candidate) => candidate !== 'gpu' || gpuAvailable)
  return device
}

function resolveBackend(requested: LocalBackend, device: DeviceReport, multimodal: boolean): Backend {
  const candidates = requested !== 'auto' && device.candidates.includes(requested)
    ? [requested, ...device.candidates.filter((candidate) => candidate !== requested)]
    : device.candidates
  // Leave room for Android, the UI, media decoding and encoder activations.
  const reserve = (multimodal ? 1024 : 512) * 1024 * 1024
  const selected = candidates.find((backend) => localRuntime().estimateMemory({
    modelFileSizeBytes: MODEL_FILE.size ?? LOCAL_MODEL.bytes,
    availableMemoryBytes: Math.max(0, device.availableMemoryBytes - reserve),
    config: { backend, maxContextTokens: LOCAL_CONTEXT_TOKENS },
  }).verdict !== 'critical')
  if (!Number.isFinite(device.availableMemoryBytes) || device.lowMemory || !selected) {
    throw new LocalModelUnavailableError(`Not enough free memory to load local AI${multimodal ? ' with photo and voice support' : ''}. Close other apps and try again, or use Cloud AI.`)
  }
  return selected
}

function friendlyLocalError(error: unknown) {
  if (isMemoryError(error)) return new LocalModelUnavailableError('Not enough free memory right now. Close other apps and try again.')
  if (error instanceof Error && 'code' in error) {
    if (error.code === 'MODEL_NOT_FOUND') return new LocalModelUnavailableError('The model file is missing. Download it again in Chat settings.')
    if (error.code === 'ENGINE_INIT_FAILED') return new LocalModelUnavailableError('This device does not support the local AI engine.')
    if (error.code === 'MEMORY_ESTIMATE_EXCEEDED') return new LocalModelUnavailableError('This device does not have enough memory to load the model.')
  }
  const message = error instanceof Error ? error.message : String(error)
  // An argument-count or missing-method error means the installed build carries
  // an older litert-lm native module than the JS bundle — only a rebuild fixes it.
  if (/expected between .* arguments.*received|is not a function/i.test(message)) {
    return new LocalModelUnavailableError('Update the GabAI development build — the installed app has an older local AI engine than this version needs.')
  }
  if (/vision encoder/i.test(message)) return new LocalModelUnavailableError('The local model cannot analyze photos on this device.')
  if (/audio encoder/i.test(message)) return new LocalModelUnavailableError('The local model cannot analyze voice messages on this device.')
  if (/out of memory|oom|allocat/i.test(message)) return new LocalModelUnavailableError('The device ran out of memory. Close other apps and try again.')
  if (/unsupported|abi|x86/i.test(message)) return new LocalModelUnavailableError('Local AI needs a supported 64-bit phone or tablet.')
  return new LocalModelUnavailableError(message || 'Local generation failed.')
}

async function ensureEngine(backend: LocalBackend, system: string, multimodal: boolean) {
  if (engineLoading) {
    await engineLoading
    return ensureEngine(backend, system, multimodal)
  }
  // A multimodal engine answers text-only requests too, so once the encoders are
  // loaded they stay — upgrading (text-only engine, media request) is the only
  // reason to pay for a second full model load.
  if (engine?.isReady() && engineBackend === backend && (engineMultimodal || !multimodal)) return engine
  if (engine) {
    const previous = engine
    engine = null
    await previous.unload()
    previous.close()
    conversations.clear()
    conversationPrompts.clear()
  }
  setState({ status: 'loading', error: undefined })
  engineLoading = (async () => {
    // Never hand a truncated/stale download to the native bundle parser.
    if (!MODEL_FILE.exists || MODEL_FILE.size !== LOCAL_MODEL.bytes) {
      throw new LocalModelUnavailableError('The model file is incomplete. Delete it and download it again in AI Settings.')
    }
    const device = await inspectDevice(multimodal)
    const selected = resolveBackend(backend, device, multimodal)
    const instance = localRuntime().createLLM()
    const config = {
      systemPrompt: system,
      backend: selected,
      maxContextTokens: LOCAL_CONTEXT_TOKENS,
      maxOutputTokens: 512,
      temperature: 0.5,
      topK: 64,
      topP: 0.95,
      multimodal,
      thinking: { enabled: false },
      forceLoad: false,
    }
    try {
      await instance.loadModel(MODEL_FILE.uri, config)
      if (!instance.isReady()) {
        throw new LocalModelUnavailableError('Local AI was released because the device is low on memory. Close other apps and try again.')
      }
    } catch (error) {
      // A failed initialization may still own native allocations. Free them
      // before returning the error; do not retry on a half-initialized engine.
      await instance.unload().catch(() => {})
      instance.close()
      throw error
    }
    engine = instance
    engineBackend = backend
    engineMultimodal = multimodal
    setState({ status: 'ready', backend: selected, error: undefined })
    return instance
  })()
  try {
    return await engineLoading
  } catch (error) {
    engine = null
    engineBackend = null
    setState({ status: MODEL_FILE.exists ? 'downloaded' : 'missing', error: friendlyLocalError(error).message })
    throw friendlyLocalError(error)
  } finally {
    engineLoading = null
  }
}

export async function loadLocalModel(backend: LocalBackend = 'auto', system = 'You are GabAI, a practical local safety assistant.') {
  if (!MODEL_FILE.exists) throw new LocalModelUnavailableError('Download the local model first in Chat settings.')
  await withEngine(() => ensureEngine(backend, system, false))
}

export function unloadEngine() {
  return withEngine(unloadEngineLocked)
}

async function unloadEngineLocked() {
  const previous = engine
  engine = null
  engineBackend = null
  conversations.clear()
  conversationPrompts.clear()
  if (previous) {
    await previous.unload()
    previous.close()
  }
  setState({ status: MODEL_FILE.exists ? 'downloaded' : 'missing', error: undefined })
}

export function releaseLocalConversation(conversationId = 'main') {
  return withEngine(() => releaseConversationLocked(conversationId))
}

async function releaseConversationLocked(conversationId: string) {
  const handle = conversations.get(conversationId)
  conversations.delete(conversationId)
  conversationPrompts.delete(conversationId)
  await handle?.release().catch(() => {})
}

export function deleteModel() {
  return withEngine(deleteModelLocked)
}

async function deleteModelLocked() {
  await unloadEngineLocked()
  await cancel()
  setState({ status: 'missing', progress: 0, downloadedBytes: 0, error: undefined })
}

function transcript(history: { role: 'user' | 'assistant'; text: string; imageUri?: string; audioUri?: string }[]) {
  const lines: string[] = []
  let used = 0
  for (let index = history.length - 1; index >= 0; index--) {
    const message = history[index]
    const content = message.text || (message.audioUri ? '[Voice message]' : message.imageUri ? '[Image attachment]' : '')
    const line = `${message.role === 'assistant' ? 'GabAI' : 'User'}: ${content}`
    if (used + line.length > TRANSCRIPT_BUDGET) break
    lines.unshift(line)
    used += line.length
  }
  return lines.length ? `Conversation so far:\n${lines.join('\n')}\nContinue from here.\n` : ''
}

export function generateLocal(input: Parameters<typeof generateLocalLocked>[0]) {
  return withEngine(() => generateLocalLocked(input))
}

async function generateLocalLocked({
  system,
  history,
  nPredict,
  backend = 'auto',
  conversationId = 'main',
  signal,
  onToken,
  onReset,
  onContext,
}: {
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
  if (signal?.aborted) return { text: '', usage: { promptTokens: 0, completionTokens: 0 } }
  if (!MODEL_FILE.exists) throw new LocalModelUnavailableError('Download the local model in Chat settings first.')
  const current = history.at(-1)
  if (!current) return { text: '', usage: { promptTokens: 0, completionTokens: 0 } }
  const multimodal = Boolean(current.imageUri || current.audioUri)
  let full = ''
  let audioPath: string | undefined
  let imagePath: string | undefined
  try {
    const parts: MultimodalPart[] = []
    if (current.imageUri) {
      filePath(current.imageUri)
      imagePath = await nativeDevice()?.prepareImage?.(current.imageUri)
      parts.push({ type: 'image', path: imagePath ?? filePath(current.imageUri) })
    }
    if (current.audioUri) {
      const native = nativeDevice()
      if (Platform.OS === 'android' && native?.prepareAudio) {
        audioPath = await native.prepareAudio(current.audioUri)
        parts.push({ type: 'audio', path: audioPath })
      } else {
        throw new LocalModelUnavailableError('Voice message analysis is not supported on this device yet. Send a photo or type your question instead.')
      }
    }

    const instance = await ensureEngine(backend, system, multimodal)
    if (signal?.aborted) return { text: '', usage: { promptTokens: 0, completionTokens: 0 } }
    const memory = instance.getMemoryUsage()
    const minimumFree = (multimodal ? 1024 : 512) * 1024 * 1024
    if (memory.isLowMemory || memory.availableMemoryBytes < minimumFree) {
      throw new LocalModelUnavailableError('Not enough free memory for this reply. Close other apps and try again, or use Cloud AI.')
    }
    const modalities = instance.getModelInfo()?.modalities
    if (modalities && current.imageUri && !modalities.vision) {
      throw new LocalModelUnavailableError('The downloaded model cannot analyze photos.')
    }
    if (modalities && current.audioUri && !modalities.audio) {
      throw new LocalModelUnavailableError('The downloaded model cannot analyze voice messages.')
    }
    const forecast = instance.getMemoryForecast()
    if (forecast && forecast.contextTokensUsed > LOCAL_CONTEXT_TOKENS * 0.75) await releaseConversationLocked(conversationId)
    if (conversationPrompts.get(conversationId) !== system) await releaseConversationLocked(conversationId)
    let conversation = conversations.get(conversationId)
    const newConversation = !conversation
    if (!conversation) {
      // Keep only one native conversation/transcript alive on a phone.
      for (const id of conversations.keys()) await releaseConversationLocked(id)
      conversation = instance.createConversation({ systemPrompt: system })
      conversations.set(conversationId, conversation)
      conversationPrompts.set(conversationId, system)
    }
    const previousHistory = history.slice(0, -1).filter((item) => item.text || item.imageUri || item.audioUri)
    const currentText = current.text.trim() || (current.audioUri ? 'Listen to this voice message and answer what the speaker asked.' : current.imageUri ? 'Describe this image and give relevant safety steps.' : '')
    const prompt = `${newConversation && previousHistory.length ? `${transcript(previousHistory)}\n` : ''}${currentText}`
    await conversation.execute(
      [...parts, { type: 'text', text: prompt }],
      (token, done) => {
        if (signal?.aborted || done || !token) return
        full += token
        onToken?.(token)
      },
      { maxOutputTokens: nPredict, repetitionPenalty: 1.1, noRepeatNgramSize: 6, thinking: { enabled: false } },
    )
    if (signal?.aborted) return { text: full.trim(), usage: { promptTokens: 0, completionTokens: 0 } }
    const context = instance.getMemoryForecast()
    const contextTokens = instance.getContextTokenCount()
    if (contextTokens >= 0) onContext?.({ usedTokens: contextTokens, maxTokens: context?.maxContextTokens ?? LOCAL_CONTEXT_TOKENS })
    return {
      text: full.trim(),
      usage: { promptTokens: Math.max(0, contextTokens - full.length / 4), completionTokens: Math.ceil(full.length / 4) },
    }
  } catch (error) {
    if (signal?.aborted) return { text: full.trim(), usage: { promptTokens: 0, completionTokens: 0 } }
    await releaseConversationLocked(conversationId)
    onReset?.()
    throw friendlyLocalError(error)
  } finally {
    for (const path of [audioPath, imagePath]) {
      if (!path) continue
      const temporary = new File(path.startsWith('file://') ? path : `file://${path}`)
      try { if (temporary.exists) temporary.delete() } catch {}
    }
  }
}
