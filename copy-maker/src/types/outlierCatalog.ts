/**
 * One engagement outlier row for Content OS pickers (framework + copy-examples).
 * Built server-side from outliers_index.json + outlier_framework_cache.json.
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
  /** Post architecture markdown from cache (may be empty until enrich job fills it). */
  frameworkBody: string
  /** Full post body for preview + “copy examples” mode. */
  postBody: string
  textPreview: string
  maxRatio: number
}
