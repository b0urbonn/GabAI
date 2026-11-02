import type { SQLiteDatabase } from 'expo-sqlite'

import { isContactScope, isCustomScope, type ContactScope, type CustomScope } from '@/data/contacts'

/** A contact the user added on the Emergency screen, filed under `scope` ('mine' = "My contacts"). */
export type CustomContact = { id: number; label: string; number: string; scope: CustomScope }

type CustomContactRow = { id: number; label: string; number: string; scope: string }

const toCustomContact = (row: CustomContactRow): CustomContact => ({
  id: row.id,
  label: row.label,
  number: row.number,
  scope: isCustomScope(row.scope) ? row.scope : 'mine',
})

export async function listCustomContacts(db: SQLiteDatabase): Promise<CustomContact[]> {
  const rows = await db.getAllAsync<CustomContactRow>('SELECT id, label, number, scope FROM emergency_contacts ORDER BY created_at ASC')
  return rows.map(toCustomContact)
}

export async function getCustomContact(db: SQLiteDatabase, id: number): Promise<CustomContact | null> {
  const row = await db.getFirstAsync<CustomContactRow>('SELECT id, label, number, scope FROM emergency_contacts WHERE id = ?', id)
  return row ? toCustomContact(row) : null
}

export async function addCustomContact(db: SQLiteDatabase, contact: { label: string; number: string; scope: CustomScope }): Promise<CustomContact> {
  const result = await db.runAsync(
    'INSERT INTO emergency_contacts (label, number, scope, created_at) VALUES (?, ?, ?, ?)',
    contact.label,
    contact.number,
    contact.scope,
    Date.now(),
  )
  return { id: result.lastInsertRowId, ...contact }
}

export async function updateCustomContact(db: SQLiteDatabase, id: number, contact: { label: string; number: string; scope: CustomScope }) {
  await db.runAsync('UPDATE emergency_contacts SET label = ?, number = ?, scope = ? WHERE id = ?', contact.label, contact.number, contact.scope, id)
}

export async function deleteCustomContact(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM emergency_contacts WHERE id = ?', id)
}

/** User-corrected numbers for bundled hotlines, keyed by `contactKey` from `src/data/contacts`. */
export type ContactOverrideMap = Record<string, string>

export async function listContactOverrides(db: SQLiteDatabase): Promise<ContactOverrideMap> {
  const rows = await db.getAllAsync<{ key: string; number: string }>('SELECT key, number FROM emergency_contact_overrides')
  return Object.fromEntries(rows.map((row) => [row.key, row.number]))
}

export async function setContactOverride(db: SQLiteDatabase, key: string, number: string) {
  await db.runAsync(
    'INSERT INTO emergency_contact_overrides (key, number) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET number = excluded.number',
    key,
    number,
  )
}

export async function clearContactOverride(db: SQLiteDatabase, key: string) {
  await db.runAsync('DELETE FROM emergency_contact_overrides WHERE key = ?', key)
}

/** Hotlines fetched from the remote directory manifest; sit between bundled data and user overrides. */
export type RemoteContact = { scope: ContactScope; label: string; number: string }

export async function listRemoteContacts(db: SQLiteDatabase): Promise<RemoteContact[]> {
  const rows = await db.getAllAsync<{ scope: string; label: string; number: string }>('SELECT scope, label, number FROM emergency_remote_contacts ORDER BY rowid ASC')
  return rows.filter((row): row is RemoteContact => isContactScope(row.scope))
}

/** Replaces the whole fetched directory in one transaction so a partial write never shows. */
export async function replaceRemoteContacts(db: SQLiteDatabase, contacts: RemoteContact[]) {
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM emergency_remote_contacts')
    for (const contact of contacts) {
      await db.runAsync('INSERT INTO emergency_remote_contacts (scope, label, number) VALUES (?, ?, ?)', contact.scope, contact.label, contact.number)
    }
  })
}

const DIRECTORY_STAMP_KEY = 'directory_updated_at'

/** Epoch ms of the last successful directory refresh, or 0 when never refreshed. */
export async function getDirectoryStamp(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', DIRECTORY_STAMP_KEY)
  const stamp = Number(row?.value)
  return Number.isFinite(stamp) ? stamp : 0
}

export async function setDirectoryStamp(db: SQLiteDatabase, stamp: number) {
  await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', DIRECTORY_STAMP_KEY, String(stamp))
}
