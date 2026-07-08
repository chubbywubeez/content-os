/**
 * Write one verbose Markdown file per influencer under `data/outliers_by_person/`.
 * Each file includes **full** post `text` (from `outliers_index.json`) plus cached frameworks.
 * Use this when a single giant `OUTLIERS.md` is awkward for LLMs or editors.
 */

import fs from "node:fs";
import path from "node:path";

import { outlierKey, renderVerboseMarkdownForOnePerson } from "./outliers_render.mjs";

/**
 * @param {{ dataDir: string, bySlug: any[], multiplier: number, frameworkByKey?: Record<string, string> }} p
 * @returns {{ outDir: string, fileCount: number }}
 */
export function writePerPersonOutlierMarkdown(p) {
  const { dataDir, bySlug, multiplier, frameworkByKey = {} } = p;
  const outDir = path.join(dataDir, "outliers_by_person");
  fs.mkdirSync(outDir, { recursive: true });

  const indexLines = [
    "# Outliers by person",
    "",
    "Each `.md` file is **one creator**: engagement stats, every outlier with **full post** copy (fenced), and framework extraction when cached.",
    "",
    "Regenerate after `npm run outliers` or cache updates:",
    "`npm run outliers:person-md`",
    "",
    "| Creator | Slug | Outliers | File |",
    "| --- | --- | ---: | --- |",
  ];

  let fileCount = 0;
  for (const b of bySlug) {
    if (!b.source || !b.outliers?.length) continue;

    const safeSlug = String(b.slug || "unknown").replace(/[^\w.-]+/g, "_");
    const md = renderVerboseMarkdownForOnePerson(b, { multiplier, frameworkByKey });
    fs.writeFileSync(path.join(outDir, `${safeSlug}.md`), md, "utf8");

    indexLines.push(
      `| ${String(b.name || "").replace(/\|/g, "\\|")} | \`${safeSlug}\` | ${b.outliers.length} | [\`${safeSlug}.md\`](./${safeSlug}.md) |`
    );
    fileCount += 1;
  }

  fs.writeFileSync(path.join(outDir, "_INDEX.md"), indexLines.join("\n") + "\n", "utf8");
  return { outDir, fileCount };
}
