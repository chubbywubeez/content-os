import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

/**
 * Read a required Vite env value.
 * Throws a clear error so config issues fail fast during development.
 */
function getRequiredEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY'): string {
  const value = import.meta.env[name]
  if (typeof value === 'string' && value.trim()) return value
  throw new Error(`Missing required env var: ${name}`)
}

/**
 * Hydration-safe browser client.
 * Returns null on the server so SSR/hydration paths stay deterministic.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (typeof window === 'undefined') return null
  if (browserClient) return browserClient

  browserClient = createClient(
    getRequiredEnv('VITE_SUPABASE_URL'),
    getRequiredEnv('VITE_SUPABASE_PUBLISHABLE_KEY'),
  )
  return browserClient
}
