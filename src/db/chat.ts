import type { SQLiteDatabase } from 'expo-sqlite'

import { resolvePhotoUri } from '@/storage/photos'
import { resolveAudioUri } from '@/storage/audio'

export type ChatRole = 'user' | 'assistant'

/** A photo attached to a message. `fileName` is a file name on native, a data URI on web. */
export type ChatPhoto = { fileName: string; mimeType: string; uri: string }
export type ChatAudio = { fileName: string; mimeType: string; durationMs: number; uri: string }

export type ChatMessage = {
  id: number
  role: ChatRole
  body: string
  createdAt: number
  photo?: ChatPhoto
  audio?: ChatAudio
  status: 'pending' | 'done' | 'error'
  error?: string
}

type ChatRow = {
  id: number
  role: ChatRole
  body: string
  created_at: number
  photo: string | null
  photo_mime: string | null
  audio: string | null
  audio_mime: string | null
  audio_duration: number | null
  status: 'pending' | 'done' | 'error'
  error: string | null
}

const toPhoto = (fileName: string | null, mimeType: string | null): ChatPhoto | undefined =>
  fileName ? { fileName, mimeType: mimeType ?? 'image/jpeg', uri: resolvePhotoUri(fileName) } : undefined

const toAudio = (fileName: string | null, mimeType: string | null, durationMs: number | null): ChatAudio | undefined =>
  fileName ? { fileName, mimeType: mimeType ?? 'audio/aac', durationMs: durationMs ?? 0, uri: resolveAudioUri(fileName) } : undefined

const toMessage = (row: ChatRow): ChatMessage => ({
  id: row.id,
  role: row.role,
  body: row.body,
  createdAt: row.created_at,
  photo: toPhoto(row.photo, row.photo_mime),
  audio: toAudio(row.audio, row.audio_mime, row.audio_duration),
  status: row.status,
  error: row.error ?? undefined,
})

export async function listMessages(db: SQLiteDatabase): Promise<ChatMessage[]> {
  const rows = await db.getAllAsync<ChatRow>('SELECT id, role, body, created_at, photo, photo_mime, audio, audio_mime, audio_duration, status, error FROM chat_messages ORDER BY id ASC')
  return rows.map(toMessage)
}

export async function addMessage(
  db: SQLiteDatabase,
  role: ChatRole,
  body: string,
  photo?: { fileName: string; mimeType: string },
  status: ChatMessage['status'] = 'done',
  audio?: { fileName: string; mimeType: string; durationMs: number },
): Promise<ChatMessage> {
  const createdAt = Date.now()
  const result = await db.runAsync(
    'INSERT INTO chat_messages (role, body, created_at, photo, photo_mime, audio, audio_mime, audio_duration, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    role,
    body,
    createdAt,
    photo?.fileName ?? null,
    photo?.mimeType ?? null,
    audio?.fileName ?? null,
    audio?.mimeType ?? null,
    audio?.durationMs ?? null,
    status,
  )
  return toMessage({
    id: result.lastInsertRowId,
    role,
    body,
    created_at: createdAt,
    photo: photo?.fileName ?? null,
    photo_mime: photo?.mimeType ?? null,
    audio: audio?.fileName ?? null,
    audio_mime: audio?.mimeType ?? null,
    audio_duration: audio?.durationMs ?? null,
    status,
    error: null,
  })
}

export async function updateMessage(
  db: SQLiteDatabase,
  id: number,
  update: { body?: string; status?: ChatMessage['status']; error?: string | null },
) {
  const assignments: string[] = []
  const values: (string | number | null)[] = []
  if (update.body !== undefined) {
    assignments.push('body = ?')
    values.push(update.body)
  }
  if (update.status !== undefined) {
    assignments.push('status = ?')
    values.push(update.status)
  }
  if (update.error !== undefined) {
    assignments.push('error = ?')
    values.push(update.error)
  }
  if (assignments.length === 0) return
  values.push(id)
  await db.runAsync(`UPDATE chat_messages SET ${assignments.join(', ')} WHERE id = ?`, ...values)
}

export async function clearMessages(db: SQLiteDatabase) {
  await db.runAsync('DELETE FROM chat_messages')
}
