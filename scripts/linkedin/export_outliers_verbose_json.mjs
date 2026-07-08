/**
 * Build `data/outliers_verbose.json` — one JSON bundle with the same information
 * the verbose OUTLIERS markdown carried: engagement, tags, full post `text`, and
 * optional `framework_markdown` from `outlier_framework_cache.json`.
 *
 * Uses `outliers_index.json` (run `npm run outliers` first). Does **not** parse
 * `OUTLIERS_VERBOSE_ARCHIVED.md` (that file is generated from these sources).
 *
 *   node scripts/export_outliers_verbose_json.mjs
 *   node scripts/export_outliers_verbose_json.mjs --minify   → outliers_verbose.min.json (no indent, no text_preview, omit null fw)
 */

import fs from "node:fs";
import path from "node:path";

import { collectOutlierDataset, DATA } from "./lib/outliers_collect.mjs";
import { outlierKey } from "./lib/outliers_render.mjs";

const INDEX_PATH = path.join(DATA, "outliers_index.json");
const CACHE_PATH = path.join(DATA, "outlier_framework_cache.json");
const OUT_PATH = path.join(DATA, "outliers_verbose.json");
const OUT_MIN_PATH = path.join(DATA, "outliers_verbose.min.json");

function parseArgs() {
  return { minify: process.argv.includes("--minify") };
}

function loadCacheItems() {
  if (!fs.existsSync(CACHE_PATH)) return {};
  try {
    const j = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    return j && typeof j.items === "object" ? j.items : {};
  } catch {
    return {};
  }
}

function loadBySlug() {
  if (fs.existsSync(INDEX_PATH)) {
    const j = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
    if (Array.isArray(j.bySlug)) return { bySlug: j.bySlug, multiplier: j.multiplier ?? 5 };
  }
  const d = collectOutlierDataset({ multiplier: 5 });
  return { bySlug: d.bySlug, multiplier: d.multiplier };
}

function main() {
  const { minify } = parseArgs();
  const { bySlug, multiplier } = loadBySlug();
  const cache = loadCacheItems();

  const outliers = [];
  for (const b of bySlug) {
    let rank = 0;
    for (const o of b.outliers || []) {
      rank += 1;
      const key = outlierKey(o);
      const fw = cache[key];
      const fwStr = typeof fw === "string" && fw.trim() ? fw.trim() : null;

      const row = {
        influencer_name: b.name,
        influencer_slug: b.slug,
        rank_within_influencer: rank,
        urn: o.urn || "",
        url: o.url || "",
        engagement: {
          likes: o.likes ?? null,
          comments: o.comments ?? null,
          shares: o.shares ?? null,
        },
        ratios_vs_personal_mean: {
          likes: o.likesRatio ?? null,
          comments: o.commentsRatio ?? null,
          shares: o.sharesRatio ?? null,
          max: o.maxRatio ?? null,
        },
        outlier_types: o.outlierTypes || [],
        hook: o.hook || "",
        format_level: o.format_level || [],
        structural: o.structural || [],
        length_tier: o.length_tier || "",
        char_count: o.char_count ?? null,
        text: o.text || "",
      };
      if (!minify) {
        row.text_preview = o.textPreview || (o.text || "").slice(0, 320);
        row.framework_markdown = fwStr;
      } else if (fwStr) {
        row.framework_markdown = fwStr;
      }
      outliers.push(row);
    }
  }

  const payload = {
    generated_at: new Date().toISOString(),
    multiplier,
    source_files: {
      index: "outliers_index.json",
      framework_cache: "outlier_framework_cache.json",
    },
    count: outliers.length,
    outliers,
  };

  if (minify) {
    const s = JSON.stringify(payload);
    fs.writeFileSync(OUT_MIN_PATH, s, "utf8");
    console.log(
      `Wrote ${OUT_MIN_PATH} (${outliers.length} outliers, ${(fs.statSync(OUT_MIN_PATH).size / 1e6).toFixed(2)} MB, minified)`
    );
    return;
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), "utf8");
  const bytes = fs.statSync(OUT_PATH).size;
  console.log(`Wrote ${OUT_PATH} (${outliers.length} outliers, ${(bytes / 1e6).toFixed(2)} MB)`);
}

main();
