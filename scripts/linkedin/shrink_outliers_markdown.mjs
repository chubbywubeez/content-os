/**
 * Strip bloat from verbose outlier Markdown (archived or `--verbose-md` output):
 * 1. Removes repeated "no framework yet" boilerplate + surrounding `---` / header.
 * 2. Removes the trailing `## Global roll-up` section (duplicate of per-creator data).
 *
 * Preserves post bodies, previews, and real framework sections (anything after
 * `### Post architecture extraction` that is NOT the italic placeholder line).
 *
 * Usage:
 *   node scripts/shrink_outliers_markdown.mjs
 *   node scripts/shrink_outliers_markdown.mjs --in=data/OUTLIERS.md --out=data/OUTLIERS.md
 *
 * Default input: `data/OUTLIERS_VERBOSE_ARCHIVED.md` → overwrites after `.bak` backup.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");

const DEFAULT_IN = path.join(DATA, "OUTLIERS_VERBOSE_ARCHIVED.md");

/** Exact boilerplate from `outliers_render.mjs` verbose branch (751× in full scrape). */
const PLACEHOLDER_RE = new RegExp(
  "\\r?\\n---\\r?\\n\\r?\\n### Post architecture extraction\\r?\\n\\r?\\n" +
    "_No framework block yet\\. Run `node scripts/enrich_outliers_frameworks\\.mjs` " +
    "\\(see `--max`, cache in `data/outlier_framework_cache\\.json`\\)\\._" +
    "\\r?\\n",
  "g"
);

/** Trailing duplicate table (same rows sorted globally). */
const GLOBAL_ROLLUP_RE = /\r?\n\r?\n---\r?\n\r?\n## Global roll-up \(all influencers\)[\s\S]*$/m;

function parseArgs() {
  let inPath = DEFAULT_IN;
  let outPath = "";
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--in=")) inPath = path.resolve(ROOT, a.slice("--in=".length).trim());
    else if (a.startsWith("--out=")) outPath = path.resolve(ROOT, a.slice("--out=".length).trim());
  }
  if (!outPath) outPath = inPath;
  return { inPath, outPath };
}

function main() {
  const { inPath, outPath } = parseArgs();
  if (!fs.existsSync(inPath)) {
    console.error(`Missing file: ${inPath}`);
    process.exit(1);
  }
  const before = fs.readFileSync(inPath, "utf8");
  const n0 = before.length;

  let after = before.replace(PLACEHOLDER_RE, "\n");
  const n1 = after.length;
  const removedPlaceholders = n0 - n1;

  after = after.replace(GLOBAL_ROLLUP_RE, "\n");
  const n2 = after.length;
  const removedRollup = n1 - n2;

  const totalSaved = n0 - n2;

  if (inPath === outPath) {
    const bak = inPath + ".bak";
    fs.writeFileSync(bak, before, "utf8");
    console.log(`Backup: ${bak}`);
  }

  fs.writeFileSync(outPath, after, "utf8");
  console.log(`Wrote ${outPath}`);
  console.log("");
  console.log(`Characters before: ${n0.toLocaleString()}`);
  console.log(`Characters after:  ${n2.toLocaleString()}`);
  console.log(`Removed (placeholders + rules): ${removedPlaceholders.toLocaleString()}`);
  console.log(`Removed (global roll-up):       ${removedRollup.toLocaleString()}`);
  console.log(`Total saved:                    ${totalSaved.toLocaleString()} (~${Math.round(totalSaved / 4)} tokens if ~4 chars/token)`);
}

main();
