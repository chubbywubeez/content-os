import { useCallback, useEffect, useState } from 'react'
import type { OutlierCatalogEntry } from '../types/outlierCatalog'

type ApiResponse = {
  count?: number
  entries?: OutlierCatalogEntry[]
  error?: string
  indexPath?: string
  cachePath?: string
}

/**
 * Loads the merged outlier catalog (post text + optional framework extraction).
 * Refetch after `npm run outliers` / `npm run outliers:architecture` updates source files.
 */
export function useOutliersCatalog() {
  const [entries, setEntries] = useState<OutlierCatalogEntry[]>([])
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadState('loading')
    setErrorMessage(null)
    try {
      const res = await fetch('/api/outliers-catalog', { cache: 'no-store' })
      const json = (await res.json()) as ApiResponse
      if (!res.ok) {
        setEntries([])
        setLoadState('error')
        setErrorMessage(json.error ?? `HTTP ${res.status}`)
        return
      }
      setEntries(Array.isArray(json.entries) ? json.entries : [])
      setLoadState('ok')
    } catch (e) {
      setEntries([])
      setLoadState('error')
      setErrorMessage(e instanceof Error ? e.message : 'fetch failed')
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  return { entries, loadState, errorMessage, refresh: load }
}
