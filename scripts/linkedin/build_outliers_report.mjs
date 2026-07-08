/**
 * Find 5× engagement outliers per influencer, write `data/OUTLIERS.md` and
 * `data/outliers_index.json` (full post text for architecture extraction).
 *
 *   node scripts/build_outliers_report.mjs
 *   node scripts/build_outliers_report.mjs --multiplier=5
 *
 * Default **OUTLIERS.md** is **slim** (tables). Verbose: `enrich_outliers_frameworks.mjs --verbose-md --md-only`.
 */

import fs from "node:fs";
import path from "node:path";

import { collectOutlierDataset, DATA } from "./lib/outliers_collect.mjs";
import { renderOutliersDocument } from "./lib/outliers_render.mjs";

function parseArgs() {
  let multiplier = 5;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--multiplier=")) {
      const n = parseFloat(a.slice("--multiplier=".length));
      if (Number.isFinite(n) && n > 1) multiplier = n;
    }
  }
  return { multiplier };
}

function main() {
  const { multiplier } = parseArgs();
  const dataset = collectOutlierDataset({ multiplier });

  const indexPayload = {
    version: 2,
    generatedAt: new Date().toISOString(),
    multiplier: dataset.multiplier,
    bySlug: dataset.bySlug,
  };
  const indexPath = path.join(DATA, "outliers_index.json");
  fs.writeFileSync(indexPath, JSON.stringify(indexPayload, null, 2), "utf8");
  console.log(`Wrote ${indexPath}`);

  const md = renderOutliersDocument({
    multiplier: dataset.multiplier,
    bySlug: dataset.bySlug,
    allFlat: dataset.allFlat,
    frameworkByKey: {},
    mode: "slim",
    frameworkPendingNote:
      "FW column = framework in `outlier_framework_cache.json`. Run `node scripts/enrich_outliers_frameworks.mjs` (then `--md-only` to refresh this table).",
  });
  const outPath = path.join(DATA, "OUTLIERS.md");
  fs.writeFileSync(outPath, md, "utf8");
  console.log(
    `Wrote ${outPath} (${dataset.allFlat.length} outlier rows, multiplier=${multiplier}×)`
  );
}

main();
