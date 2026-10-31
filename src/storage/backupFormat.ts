import { PROFILE_KEYS, PROFILE_VALUE_MAX_LENGTH, type ProfileInfo } from '@/data/profile'
import { NICKNAME_MAX_LENGTH, isAppearance, isAvatarPreset, isAvatarTone, isTextSize, type Settings } from '@/db/settings'

export type BackupSettings = Pick<Settings, 'appearance' | 'textSize'> &
  Partial<Pick<Settings, 'nickname' | 'avatarTone' | 'avatarPreset'>>

export type Backup = { app: 'GabAI'; version: 1; exportedAt: string; profile: ProfileInfo; settings: BackupSettings }

export const MAX_BACKUP_BYTES = 64 * 1024

export class BackupError extends Error {}

export function createBackup(profile: ProfileInfo, settings: BackupSettings) {
  const exportedAt = new Date().toISOString()
  const backup: Backup = {
    app: 'GabAI',
    version: 1,
    exportedAt,
    profile,
    settings: {
      appearance: settings.appearance,
      textSize: settings.textSize,
      nickname: settings.nickname,
      ...(settings.avatarTone ? { avatarTone: settings.avatarTone } : {}),
      ...(settings.avatarPreset ? { avatarPreset: settings.avatarPreset } : {}),
    },
  }
  return { fileName: `GabAI-backup-${exportedAt.slice(0, 10)}.json`, json: JSON.stringify(backup, null, 2) }
}

export function parseBackup(raw: string): Backup {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new BackupError('This file is not valid JSON. Choose a GabAI backup.')
  }
  const candidate = data as Partial<Backup> | null
  // Older backups used the device theme; restore those with the light default.
  const savedAppearance: unknown = candidate?.settings?.appearance
  const appearance = savedAppearance === 'system' ? 'light' : savedAppearance
  if (!candidate || candidate.app !== 'GabAI' || candidate.version !== 1 || !candidate.settings || !candidate.profile ||
      typeof candidate.profile !== 'object' || Array.isArray(candidate.profile) ||
      !isAppearance(appearance) || !isTextSize(candidate.settings.textSize)) {
    throw new BackupError('Choose a valid GabAI backup file (version 1).')
  }
  const profile: ProfileInfo = {}
  for (const [key, value] of Object.entries(candidate.profile)) {
    if (!PROFILE_KEYS.includes(key) || typeof value !== 'string' || value.length > PROFILE_VALUE_MAX_LENGTH) {
      throw new BackupError('This backup contains unsupported profile information.')
    }
    profile[key] = value
  }
  const settings: BackupSettings = { appearance, textSize: candidate.settings.textSize }
  if (typeof candidate.settings.nickname === 'string') {
    settings.nickname = candidate.settings.nickname.trim().slice(0, NICKNAME_MAX_LENGTH)
  }
  if (isAvatarTone(candidate.settings.avatarTone)) {
    settings.avatarTone = candidate.settings.avatarTone
  }
  if (isAvatarPreset(candidate.settings.avatarPreset)) {
    settings.avatarPreset =
      candidate.settings.avatarPreset === 'auto' ? 'morion' : candidate.settings.avatarPreset
  }
  return {
    app: 'GabAI',
    version: 1,
    exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : '',
    profile,
    settings,
  }
}
