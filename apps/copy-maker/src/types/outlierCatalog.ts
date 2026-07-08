/**
 * One engagement outlier row for Content OS pickers (framework + copy-examples).
 * Built server-side from `outliers_swipe_catalog.json` (preferred) or
 * `outliers_index.json` + `outlier_framework_cache.json` (legacy fallback).
 */
export type OutlierCatalogEntry = {
  /** Stable id = LinkedIn activity URN. */
  id: string
  urn: string
  creator: string
  slug: string
  hook: string
  url: string
  axes: string
  formatTags: string[]
  structuralTags: string[]
  /** Flattened lowercase string for client-side tag / hook / creator search. */
  searchText: string
  hasFramework: boolean
  /**
   * Prompt payload for “Framework” mode.
   * Swipe catalog: mechanism name + bracketed template + optional note.
   * Legacy: full post-architecture markdown from cache.
   */
  frameworkBody: string
  /** Full post body for preview + “copy pattern” mode. */
  postBody: string
  textPreview: string
  maxRatio: number
  /** Swipe-file only — named mechanism (e.g. "The Numbered Hard-Truth Catalog"). */
  frameworkName?: string
  /** Swipe-file only — bracketed fill-in template. */
  frameworkTemplate?: string
  /** Swipe-file only - hyphenated tags from cleaned markdown. */
  tags?: string[]
  /** Captured source formatting/rhythm, including LinkedIn rich text or Unicode emphasis when present. */
  typographyStyle?: {
    summary?: string
    boldUsage?: 'none' | 'rich_text' | 'unicode' | 'markdown' | 'mixed'
    boldSamples?: string[]
    carryForwardRules?: string[]
    lineBreakStyle?: string
    listStyle?: string
    attributeTypes?: string[]
  }
  /** Alias used by the cron worker for humans who think in typesetting terms. */
  typesettingStyle?: OutlierCatalogEntry['typographyStyle']
  /** `swipe` = compiled cleaned markdown; `remote` = daily cron catalog; `legacy` = index + architecture cache. */
  catalogSource?: 'swipe' | 'remote' | 'legacy'
}
