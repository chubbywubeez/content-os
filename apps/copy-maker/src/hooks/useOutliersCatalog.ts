import { useCallback, useEffect, useState } from 'react'
import type { OutlierCatalogEntry } from '../types/outlierCatalog'

type ApiResponse = {
  count?: number
  entries?: OutlierCatalogEntry[]
  catalogSource?: 'swipe' | 'remote' | 'legacy'
  error?: string
  swipeCatalogPath?: string
  indexPath?: string
  cachePath?: string
}

/**
 * Loads the outlier catalog for framework / copy-pattern pickers.
 * Refetch after `npm run swipe:catalog` (or `swipe:sync`) updates the swipe JSON.
 */
export function useOutliersCatalog() {
  const [entries, setEntries] = useState<OutlierCatalogEntry[]>([])
  const [catalogSource, setCatalogSource] = useState<'swipe' | 'remote' | 'legacy' | null>(null)
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
      setCatalogSource(
        json.catalogSource === 'swipe' || json.catalogSource === 'remote' || json.catalogSource === 'legacy'
          ? json.catalogSource
          : null,
      )
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

  return { entries, catalogSource, loadState, errorMessage, refresh: load }
}
