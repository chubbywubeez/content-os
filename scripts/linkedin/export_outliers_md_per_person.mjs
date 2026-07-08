/**
 * Emit `data/outliers_by_person/<slug>.md` — one verbose outlier doc per creator (full posts).
 *
 *   node scripts/export_outliers_md_per_person.mjs
 *
 * Needs `data/outliers_index.json` (`npm run outliers`). Optional frameworks from
 * `data/outlier_framework_cache.json` (same keys as enrich script).
 */

import fs from "node:fs";
import path from "node:path";

import { collectOutlierDataset, DATA } from "./lib/outliers_collect.mjs";
import { outlierKey } from "./lib/outliers_render.mjs";
import { writePerPersonOutlierMarkdown } from "./lib/outliers_write_per_person.mjs";

const INDEX_PATH = path.join(DATA, "outliers_index.json");
const CACHE_PATH = path.join(DATA, "outlier_framework_cache.json");

function loadCacheItems() {
  if (!fs.existsSync(CACHE_PATH)) return {};
  try {
    const j = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    return j && typeof j.items === "object" ? j.items : {};
  } catch {
    return {};
  }
}

function buildFrameworkMap(bySlug, cacheItems) {
  const map = {};
  for (const b of bySlug) {
    for (const o of b.outliers || []) {
      const k = outlierKey(o);
      if (cacheItems[k] && String(cacheItems[k]).trim()) {
        map[k] = String(cacheItems[k]).trim();
      }
    }
  }
  return map;
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
  const { bySlug, multiplier } = loadBySlug();
  const cache = loadCacheItems();
  const frameworkByKey = buildFrameworkMap(bySlug, cache);

  const { outDir, fileCount } = writePerPersonOutlierMarkdown({
    dataDir: DATA,
    bySlug,
    multiplier,
    frameworkByKey,
  });
  console.log(`Wrote ${fileCount} per-person files + _INDEX.md under ${outDir}`);
}

main();
