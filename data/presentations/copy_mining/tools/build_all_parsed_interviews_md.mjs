/**
 * Concatenate every parsed interview Markdown under `Problem Presentations/`
 * except `scores/` and `copy_mining/` (so rubrics, mined themes, and quote
 * rollups are never inlined as “interviews”).
 *
 * Includes duplicate exports (e.g. `claude_web_export/`) as separate sections
 * so nothing is dropped for the sake of deduping.
 *
 * Run: node "Problem Presentations/copy_mining/tools/build_all_parsed_interviews_md.mjs"
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { relPosix, walkInterviewMarkdown } from "./lib_rollups.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRESENTATIONS_DIR = path.resolve(__dirname, "..", "..");
const OUT_NAME = "ALL_PARSED_INTERVIEWS.md";
const OUT = path.join(PRESENTATIONS_DIR, OUT_NAME);

const files = walkInterviewMarkdown(PRESENTATIONS_DIR);

const parts = [];
parts.push("# All parsed interviews (combined — full tree)");
parts.push("");
parts.push(
  "This file concatenates **every** interview-style Markdown file under `Problem Presentations/`, walking subfolders **except** `scores/` and `copy_mining/` (those hold scores and mined outputs, not transcripts)."
);
parts.push("");
parts.push(
  "If the same conversation exists in more than one folder (for example root + `claude_web_export/`), **both copies are included** so this file stays lossless."
);
parts.push("");
parts.push(
  "Sources are normally produced by `_convert_to_md.py` from `originals/`."
);
parts.push("");
parts.push("---");
parts.push("");

for (const abs of files) {
  const rel = relPosix(PRESENTATIONS_DIR, abs);
  const body = fs.readFileSync(abs, "utf8").replace(/\s+$/, "");
  parts.push(`## ${rel}`);
  parts.push("");
  parts.push(`*Full path (repo-relative): \`Problem Presentations/${rel}\`*`);
  parts.push("");
  parts.push(body);
  parts.push("");
  parts.push("---");
  parts.push("");
}

parts.push("");
parts.push(`**Markdown files included:** ${files.length}`);
parts.push("");

fs.writeFileSync(OUT, parts.join("\n"), "utf8");
console.log(`Wrote ${OUT} (${files.length} markdown files)`);
