import type { SQLiteDatabase } from 'expo-sqlite'

import { isGeminiModelChoice, type GeminiModelChoice } from '@/data/ai'
import { textSizes, type TextSize } from '@/theme/tokens'

export const APPEARANCES = ['light', 'dark'] as const
export type Appearance = (typeof APPEARANCES)[number]

export const NICKNAME_MAX_LENGTH = 40

export const AI_MODES = ['local', 'cloud'] as const
export type AiMode = (typeof AI_MODES)[number]

export const REPLY_LENGTHS = ['short', 'detailed'] as const
export type ReplyLength = (typeof REPLY_LENGTHS)[number]

export const VOICE_LANGUAGES = ['auto', 'fil-PH', 'en-US'] as const
export type VoiceLanguage = (typeof VOICE_LANGUAGES)[number]

export const LOCAL_BACKENDS = ['auto', 'npu', 'gpu', 'cpu'] as const
export type LocalBackend = (typeof LOCAL_BACKENDS)[number]

export const AVATAR_TONES = ['teal', 'sky', 'blue', 'violet', 'rose', 'amber'] as const
export type AvatarTone = (typeof AVATAR_TONES)[number]

export const ILLUSTRATED_AVATARS = [
  'morion',
  'responder',
  'gabai',
  'explorer',
  'medic',
  'islander',
  'bantay',
  'ming',
] as const
export type IllustratedAvatar = (typeof ILLUSTRATED_AVATARS)[number]

export const AVATAR_PRESETS = ['auto', 'initials', 'micah', ...ILLUSTRATED_AVATARS] as const
export type AvatarPreset = (typeof AVATAR_PRESETS)[number]

export type Settings = {
  appearance: Appearance
  textSize: TextSize
  nickname: string
  avatarPhoto: string
  avatarTone: AvatarTone
  avatarPreset: AvatarPreset
  avatarSeed: string
  onboarded: boolean
  aiMode: AiMode
  localBackend: LocalBackend
  localReplyLength: ReplyLength
  geminiModel: GeminiModelChoice
  backendUrl: string
  backendModel: string
  voiceReplies: boolean
  voiceLanguage: VoiceLanguage
  voiceIdentifier: string
  lastSeenUpdates: number
}

export const defaultSettings: Settings = {
  appearance: 'light',
  textSize: 'standard',
  nickname: '',
  avatarPhoto: '',
  avatarTone: 'teal',
  avatarPreset: 'micah',
  avatarSeed: '',
  onboarded: false,
  aiMode: 'local',
  localBackend: 'auto',
  localReplyLength: 'short',
  geminiModel: 'auto',
  backendUrl: '',
  backendModel: '',
  voiceReplies: false,
  voiceLanguage: 'auto',
  voiceIdentifier: '',
  lastSeenUpdates: 0,
}

export const isAppearance = (value: unknown): value is Appearance => APPEARANCES.includes(value as Appearance)
export const isTextSize = (value: unknown): value is TextSize => typeof value === 'string' && value in textSizes
export const isAiMode = (value: unknown): value is AiMode => AI_MODES.includes(value as AiMode)
export const isReplyLength = (value: unknown): value is ReplyLength => REPLY_LENGTHS.includes(value as ReplyLength)
export const isVoiceLanguage = (value: unknown): value is VoiceLanguage => VOICE_LANGUAGES.includes(value as VoiceLanguage)
export const isAvatarTone = (value: unknown): value is AvatarTone => AVATAR_TONES.includes(value as AvatarTone)
export const isIllustratedAvatar = (value: unknown): value is IllustratedAvatar =>
  ILLUSTRATED_AVATARS.includes(value as IllustratedAvatar)
export const isAvatarPreset = (value: unknown): value is AvatarPreset =>
  AVATAR_PRESETS.includes(value as AvatarPreset)

/**
 * Async on purpose: expo-sqlite's synchronous API on web requires SharedArrayBuffer
 * (cross-origin isolation), which the Expo dev server does not provide for every page.
 */
export async function readSettings(db: SQLiteDatabase): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings')
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]))
  return {
    appearance: isAppearance(stored.appearance) ? stored.appearance : defaultSettings.appearance,
    textSize: isTextSize(stored.textSize) ? stored.textSize : defaultSettings.textSize,
    nickname: typeof stored.nickname === 'string' ? stored.nickname.trim().slice(0, NICKNAME_MAX_LENGTH) : '',
    avatarPhoto: typeof stored.avatarPhoto === 'string' ? stored.avatarPhoto : '',
    avatarTone: isAvatarTone(stored.avatarTone) ? stored.avatarTone : defaultSettings.avatarTone,
    avatarPreset:
      isAvatarPreset(stored.avatarPreset) && stored.avatarPreset !== 'auto'
        ? stored.avatarPreset
        : defaultSettings.avatarPreset,
    avatarSeed: typeof stored.avatarSeed === 'string' ? stored.avatarSeed : '',
    onboarded: stored.onboarded === 'true',
    aiMode: isAiMode(stored.aiMode) ? stored.aiMode : defaultSettings.aiMode,
    localBackend: LOCAL_BACKENDS.includes(stored.localBackend as LocalBackend) ? stored.localBackend as LocalBackend : defaultSettings.localBackend,
    localReplyLength: isReplyLength(stored.localReplyLength) ? stored.localReplyLength : defaultSettings.localReplyLength,
    geminiModel: isGeminiModelChoice(stored.geminiModel) ? stored.geminiModel : defaultSettings.geminiModel,
    backendUrl: typeof stored.backendUrl === 'string' ? stored.backendUrl.trim() : '',
    backendModel: typeof stored.backendModel === 'string' ? stored.backendModel.trim() : '',
    voiceReplies: stored.voiceReplies === 'true',
    voiceLanguage: isVoiceLanguage(stored.voiceLanguage) ? stored.voiceLanguage : defaultSettings.voiceLanguage,
    voiceIdentifier: typeof stored.voiceIdentifier === 'string' ? stored.voiceIdentifier : '',
    lastSeenUpdates: Number.isFinite(Number(stored.lastSeenUpdates)) ? Number(stored.lastSeenUpdates) : 0,
  }
}

export async function writeSettings(db: SQLiteDatabase, settings: Partial<Settings>) {
  await db.withTransactionAsync(async () => {
    for (const [key, value] of Object.entries(settings)) {
      await db.runAsync(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        key,
        String(value),
      )
    }
  })
}
