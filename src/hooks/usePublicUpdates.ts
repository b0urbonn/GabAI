import { useSQLiteContext } from 'expo-sqlite'
import { useCallback, useEffect, useRef, useState } from 'react'

import { readUpdateCache, writeUpdateCache } from '@/db/publicUpdates'
import {
  fetchPublicUpdates,
  currentUpdates,
  REFRESH_INTERVAL,
  type PublicUpdate,
  type UpdateSource,
} from '@/services/publicUpdates'

type UpdatesState = {
  items: PublicUpdate[]
  loading: boolean
  error: string | null
  lastChecked: number | null
}

const SOURCES: UpdateSource[] = ['pagasa', 'phivolcs']

export function usePublicUpdates() {
  const db = useSQLiteContext()
  const [state, setState] = useState<UpdatesState>({ items: [], loading: true, error: null, lastChecked: null })
  const abortRef = useRef<AbortController | null>(null)

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const results = await Promise.allSettled(
        SOURCES.map(async (source) => {
          const snapshot = await fetchPublicUpdates(source, signal ?? new AbortController().signal)
          await writeUpdateCache(db, snapshot).catch(() => {})
          return snapshot
        }),
      )
      if (signal?.aborted) return

      const successfulSnapshots = results
        .filter((r): r is PromiseFulfilledResult<typeof results[0] extends PromiseSettledResult<infer T> ? T : never> => r.status === 'fulfilled')
        .map((r) => r.value)

      if (successfulSnapshots.length > 0) {
        const allItems = currentUpdates(successfulSnapshots.flatMap((s) => s.items))
        const lastChecked = Math.max(...successfulSnapshots.map((s) => s.checkedAt))
        setState({ items: allItems, loading: false, error: null, lastChecked })
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: prev.items.length > 0 ? null : 'Could not reach official sources. Check your connection and try again.',
        }))
      }
    } catch {
      if (signal?.aborted) return
      setState((prev) => ({
        ...prev,
        loading: false,
        error: prev.items.length > 0 ? null : 'Could not reach official sources. Check your connection and try again.',
      }))
    }
  }, [db])

  // Load cache then fetch fresh data
  useEffect(() => {
    const controller = new AbortController()
    abortRef.current = controller

    readUpdateCache(db)
      .then((cached) => {
        if (controller.signal.aborted) return
        const cachedItems = currentUpdates(cached.flatMap((s) => s.items))
        const lastChecked = cached.length > 0 ? Math.max(...cached.map((s) => s.checkedAt)) : null
        setState((prev) => ({ ...prev, items: cachedItems, lastChecked, loading: true }))
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) refresh(controller.signal)
      })

    return () => controller.abort()
  }, [db, refresh])

  // Auto-refresh
  useEffect(() => {
    const controller = new AbortController()
    const interval = setInterval(() => refresh(controller.signal), REFRESH_INTERVAL)
    return () => {
      clearInterval(interval)
      controller.abort()
    }
  }, [refresh])

  const manualRefresh = useCallback(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    return refresh(controller.signal)
  }, [refresh])

  return { ...state, refresh: manualRefresh }
}
