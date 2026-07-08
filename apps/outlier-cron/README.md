# Content OS Outlier Cron

Railway cron worker for daily LinkedIn outlier refreshes.

What it does:

- Scrapes a bounded rotating slice of seed LinkedIn creators through Apify.
- Discovers possible new creators from profile/comment metadata.
- Finds high-engagement outliers, with a top-post fallback when the run finds too few.
- Extracts reusable frameworks through OpenRouter.
- Records typography/typesetting style, including bold/rich text, Unicode emphasis, list style, and line-break rhythm.
- Uploads the refreshed catalog to Supabase Storage for the main Content OS app to read.

Required Railway variables:

- `APIFY_TOKEN` or `APIFY_API_TOKEN`
- `OPENROUTER_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OUTLIERS_CATALOG_BUCKET`
- `OUTLIERS_CATALOG_PATH`

Useful tuning variables:

- `OUTLIER_CRON_MAX_PROFILES` default `5`
- `OUTLIER_CRON_SEED_PROFILES_PER_RUN` default `4`
- `OUTLIER_CRON_DISCOVERY_PROFILES_PER_RUN` default `1`
- `OUTLIER_CRON_POST_LIMIT` default `60`
- `OUTLIER_CRON_TARGET_MIN` default `10`
- `OUTLIER_CRON_TARGET_MAX` default `60`
- `OUTLIER_CRON_OUTLIER_MULTIPLIER` default `3`
- `OUTLIER_CRON_MIN_ENGAGEMENT_SCORE` default `75`

Railway schedule is configured in `railway.toml` as `0 9 * * *` UTC.
