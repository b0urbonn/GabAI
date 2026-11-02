import type { SQLiteDatabase } from 'expo-sqlite'

import { DIRECTORY_SOURCE, isEmergencyNumber, type ContactScope } from '@/data/contacts'
import { MUNICIPALITIES } from '@/data/profile'
import { replaceRemoteContacts, setDirectoryStamp, type RemoteContact } from '@/db/contacts'

export type DirectoryRefresh =
  | { status: 'updated'; count: number }
  | { status: 'unreachable' }
  | { status: 'invalid' }

const FETCH_TIMEOUT_MS = 8000
const MAX_ENTRIES = 500

/**
 * Parses a directory manifest (see `data/hotlines.json`) into rows. Returns null when the
 * payload is unusable at all; individual bad entries are skipped so one typo can't sink an update.
 */
function parseDirectory(json: unknown): RemoteContact[] | null {
  if (!json || typeof json !== 'object') return null
  const file = json as Record<string, unknown>
  const rows = new Map<string, RemoteContact>()
  const push = (scope: ContactScope, list: unknown) => {
    if (!Array.isArray(list)) return
    for (const item of list) {
      const label = typeof (item as { label?: unknown })?.label === 'string' ? (item as { label: string }).label.trim() : ''
      const number = typeof (item as { number?: unknown })?.number === 'string' ? (item as { number: string }).number.trim() : ''
      if (label.length >= 2 && label.length <= 60 && isEmergencyNumber(number)) rows.set(`${scope}:${label}`, { scope, label, number })
    }
  }
  push('National', file.national)
  push('Provincial', file.provincial)
  const municipalities = file.municipalities
  if (municipalities && typeof municipalities === 'object') {
    for (const municipality of MUNICIPALITIES) push(municipality, (municipalities as Record<string, unknown>)[municipality])
  }
  if (rows.size === 0 || rows.size > MAX_ENTRIES) return null
  return [...rows.values()]
}

/**
 * Pulls the latest hotline directory from `DIRECTORY_SOURCE` and atomically replaces the
 * stored copy. The app stays offline-first: this only runs when the user taps Refresh, and
 * every failure keeps the previously saved (or bundled) numbers.
 */
export async function refreshDirectory(db: SQLiteDatabase): Promise<DirectoryRefresh> {
  let json: unknown
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const response = await fetch(DIRECTORY_SOURCE.url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    clearTimeout(timer)
    if (!response.ok) return { status: 'unreachable' }
    json = await response.json()
  } catch {
    return { status: 'unreachable' }
  }
  const rows = parseDirectory(json)
  if (!rows) return { status: 'invalid' }
  // Guard against manifest corruption: never accept a directory that lost whole scopes.
  const scopes = new Set(rows.map((row) => row.scope))
  const sane = scopes.has('National') && scopes.has('Provincial') && MUNICIPALITIES.every((m) => scopes.has(m))
  if (!sane) return { status: 'invalid' }
  await replaceRemoteContacts(db, rows)
  await setDirectoryStamp(db, Date.now())
  return { status: 'updated', count: rows.length }
}
