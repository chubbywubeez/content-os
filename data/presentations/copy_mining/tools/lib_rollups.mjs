/**
 * Shared helpers for “fat rollup” Markdown builders.
 * We intentionally skip `scores/` and `copy_mining/` so theme docs and rubrics
 * never get treated as transcripts.
 */

import fs from "node:fs";
import path from "node:path";

/** Directory names under Problem Presentations that are never transcripts. */
export const SKIP_DIRS = new Set(["scores", "copy_mining"]);

export const SKIP_MD_BASENAMES = new Set(["all_parsed_interviews.md"]);

/**
 * Recursively list Markdown files under `presentationsDir`, excluding SKIP_DIRS
 * and aggregate output files.
 */
export function walkInterviewMarkdown(presentationsDir) {
  const out = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(ent.name)) continue;
        walk(full);
        continue;
      }
      if (!ent.name.endsWith(".md")) continue;
      if (SKIP_MD_BASENAMES.has(ent.name.toLowerCase())) continue;
      out.push(full);
    }
  }

  walk(presentationsDir);
  out.sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
  return out;
}

/** Relative POSIX path from `presentationsDir` for readable Markdown. */
export function relPosix(fromDir, absolutePath) {
  return path.relative(fromDir, absolutePath).split(path.sep).join("/");
}

/**
 * Match `extract_website_copy_themes.composite_weight` (Python) closely enough
 * for rollup tables when JSON has not been mined yet.
 */
export function compositeWeightFromScoreMd(text, defaultNo = 0.35) {
  if (/(NOT\s+CALCULATED|no\s+composite\s+is\s+produced)/i.test(text)) {
    return defaultNo;
  }
  const m = text.match(
    /\*\*[^*]*?Composite\s+Score:\s*([\d.]+)\s*\/\s*100\*\*/i
  );
  if (!m) return defaultNo;
  const n = Number(m[1]);
  if (Number.isNaN(n)) return defaultNo;
  return Math.max(0, Math.min(1, n / 100));
}
