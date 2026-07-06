import { useSyncExternalStore } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from '../lib/supabaseClient'

/**
 * Mount-only client setup keeps first render stable.
 * This avoids hydration mismatch risks in SSR setups.
 */
export function useSupabaseBrowserClient(): SupabaseClient | null {
  const isHydrated = useSyncExternalStore(
    () => () => {
      // No external store; this only gives us consistent SSR/client snapshots.
    },
    () => true,
    () => false,
  )
  if (!isHydrated) return null
  return getSupabaseBrowserClient()
}
