import type { SQLiteDatabase } from 'expo-sqlite'

import { parseUpdateCache, type SourceSnapshot, type UpdateSource } from '@/services/publicUpdates'

export async function readUpdateCache(db: SQLiteDatabase): Promise<SourceSnapshot[]> {
  const rows = await db.getAllAsync<{ source: string; payload: string }>('SELECT source, payload FROM public_update_cache')
  return rows.flatMap((row) => {
    if (row.source !== 'pagasa' && row.source !== 'phivolcs') return []
    const saved = parseUpdateCache(row.payload, row.source as UpdateSource)
    return saved ? [saved] : []
  })
}

export async function writeUpdateCache(db: SQLiteDatabase, snapshot: SourceSnapshot) {
  await db.runAsync('INSERT INTO public_update_cache (source, payload) VALUES (?, ?) ON CONFLICT(source) DO UPDATE SET payload = excluded.payload',
    snapshot.source, JSON.stringify(snapshot))
}
