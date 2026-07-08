/**
 * All-inclusive customer-quote rollup:
 * - Union roster: parsed transcripts (full tree minus scores/copy_mining),
 *   mined `per_interview/*.json`, and `scores/*.score.md` — no one omitted.
 * - Snippets come from JSON when present; otherwise a placeholder + paths.
 *
 * Run: node "Problem Presentations/copy_mining/tools/build_all_quotes_md.mjs"
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  compositeWeightFromScoreMd,
  relPosix,
  walkInterviewMarkdown,
} from "./lib_rollups.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COPY_MINING = path.resolve(__dirname, "..");
const PRESENTATIONS_DIR = path.join(COPY_MINING, "..");
const PER_INTERVIEW = path.join(COPY_MINING, "per_interview");
const SCORES_DIR = path.join(PRESENTATIONS_DIR, "scores");
const OUT = path.join(COPY_MINING, "ALL_CUSTOMER_QUOTES_WITH_WEIGHTS.md");

const DEFAULT_NO_SCORE = 0.35;

/** @type {Map<string, { display: string, data: object, file: string }>} */
const jsonByLower = new Map();
for (const name of fs.readdirSync(PER_INTERVIEW)) {
  if (!name.endsWith(".json")) continue;
  const fp = path.join(PER_INTERVIEW, name);
  const data = JSON.parse(fs.readFileSync(fp, "utf8"));
  const display = String(data.interview ?? path.basename(name, ".json"));
  jsonByLower.set(display.toLowerCase(), { display, data, file: name });
}

/** stem (basename .md) -> transcript relative paths */
const transcriptsByStem = new Map();
for (const abs of walkInterviewMarkdown(PRESENTATIONS_DIR)) {
  const stem = path.basename(abs, ".md");
  const rel = relPosix(PRESENTATIONS_DIR, abs);
  const key = stem.toLowerCase();
  if (!transcriptsByStem.has(key)) transcriptsByStem.set(key, []);
  transcriptsByStem.get(key).push(`Problem Presentations/${rel}`);
}

/** interview display name -> weight from score file on disk */
function weightFromScoreFile(displayName) {
  const scorePath = path.join(SCORES_DIR, `${displayName}.score.md`);
  if (!fs.existsSync(scorePath)) return null;
  const text = fs.readFileSync(scorePath, "utf8");
  return compositeWeightFromScoreMd(text, DEFAULT_NO_SCORE);
}

/** Collect union of canonical display names (prefer JSON spelling). */
const unionLower = new Set([
  ...jsonByLower.keys(),
  ...transcriptsByStem.keys(),
]);

if (fs.existsSync(SCORES_DIR)) {
  for (const n of fs.readdirSync(SCORES_DIR)) {
    if (!n.endsWith(".score.md")) continue;
    const stem = n.replace(/\.score\.md$/i, "");
    unionLower.add(stem.toLowerCase());
  }
}

function displayForKey(lower) {
  const j = jsonByLower.get(lower);
  if (j) return j.display;
  const paths = transcriptsByStem.get(lower);
  if (paths && paths.length) return path.basename(paths[0], ".md");
  if (fs.existsSync(SCORES_DIR)) {
    for (const n of fs.readdirSync(SCORES_DIR)) {
      if (!n.endsWith(".score.md")) continue;
      const stem = n.replace(/\.score\.md$/i, "");
      if (stem.toLowerCase() === lower) return stem;
    }
  }
  return lower;
}

const sortedKeys = [...unionLower].sort((a, b) =>
  displayForKey(a).localeCompare(displayForKey(b), undefined, {
    sensitivity: "base",
  })
);

const lines = [];
lines.push("# All customer quotes (copy mining — full roster)");
lines.push("");
lines.push(
  "This document lists **every** interview in scope: anyone with a parsed transcript under `Problem Presentations/` (full tree except `scores/` and `copy_mining/`), anyone with `scores/*.score.md`, and anyone with `copy_mining/per_interview/*.json`. Nothing is dropped from the roster just because mining has not run yet."
);
lines.push("");
lines.push(
  "**Important:** Pull quotes in JSON are produced by the **mine** step in `Problem Presentations/tools/extract_website_copy_themes.py`, which caps how many themes/snippets are extracted per interview. For the full word-for-word interview, use `Problem Presentations/ALL_PARSED_INTERVIEWS.md` (fat transcript rollup)."
);
lines.push("");
lines.push("## How the weights work");
lines.push("");
lines.push("### Interview weight (`interview_weight`, 0.0–1.0)");
lines.push("");
lines.push(
  "Each mined JSON stores a weight from the **composite fit score** in `Problem Presentations/scores/<Interview>.score.md` (**Composite Score: X / 100** → X÷100, clamped). If there is no score line, the miner defaults to **0.35**."
);
lines.push("");
lines.push(
  "In this rollup, if JSON is missing we still show a row using the score file when it exists (same formula), otherwise **0.35**."
);
lines.push("");
lines.push("### Snippet intensity (`intensity_1_to_5`)");
lines.push("");
lines.push(
  "Per snippet from the miner: how sharp or usable the line is for website copy."
);
lines.push("");
lines.push(
  "### Cluster ranking (see `WEBSITE_COPY_THEMES.md`): `sum(interview_weight × intensity)` per cluster."
);
lines.push("");
lines.push("---");
lines.push("");
lines.push("## Interview roster (all names)");
lines.push("");
lines.push("| Interview | Has mined JSON | `interview_weight` used here | Score file |");
lines.push("|-----------|----------------|-------------------------------:|--------------|");

let totalSnippets = 0;
const rowsMeta = [];

for (const key of sortedKeys) {
  const display = displayForKey(key);
  const jEntry = jsonByLower.get(key);
  const hasJson = Boolean(jEntry);
  let w;
  let wNote;
  if (jEntry) {
    w = Number(jEntry.data.interview_weight ?? DEFAULT_NO_SCORE);
    wNote = "from `per_interview/*.json` (same as miner)";
  } else {
    const parsed = weightFromScoreFile(display);
    w = parsed ?? DEFAULT_NO_SCORE;
    wNote =
      parsed != null
        ? "from `.score.md` (no JSON yet)"
        : `default ${DEFAULT_NO_SCORE} (no score / no composite line)`;
  }
  const scorePath = path.join(SCORES_DIR, `${display}.score.md`);
  const scoreCell = fs.existsSync(scorePath)
    ? `\`scores/${path.basename(scorePath)}\``
    : "—";
  lines.push(
    `| ${display} | ${hasJson ? "yes" : "no"} | ${w.toFixed(4)} (${wNote}) | ${scoreCell} |`
  );
  rowsMeta.push({ key, display, hasJson, w, jEntry });
}

lines.push("");
lines.push(`**Names in roster:** ${sortedKeys.length}`);
lines.push("");
lines.push("---");
lines.push("");
lines.push("## All quotes by interview (same order)");
lines.push("");

for (const { display, hasJson, w, jEntry } of rowsMeta) {
  lines.push(`### ${display}`);
  lines.push("");
  const paths = transcriptsByStem.get(display.toLowerCase()) ?? [];
  if (paths.length) {
    lines.push("**Parsed transcript paths:**");
    lines.push("");
    for (const p of paths) lines.push(`- \`${p}\``);
    lines.push("");
  } else {
    lines.push(
      "*No parsed Markdown transcript found under `Problem Presentations/` (excluding `scores/` / `copy_mining/`).*"
    );
    lines.push("");
  }

  if (!hasJson) {
    lines.push("#### No mined snippets yet");
    lines.push("");
    lines.push(
      `There is no \`copy_mining/per_interview/${display}.json\` (or the JSON uses a different spelling). Run the **mine** command from \`extract_website_copy_themes.py\` to generate pull quotes. Until then, the full spoken interview text lives only in the transcript file(s) above and in \`ALL_PARSED_INTERVIEWS.md\`.`
    );
    lines.push("");
    lines.push(`- **\`interview_weight\` (for planning):** ${w.toFixed(4)}`);
    lines.push("");
    lines.push("---");
    lines.push("");
    continue;
  }

  const { data, file } = jEntry;
  const wJson = Number(data.interview_weight ?? DEFAULT_NO_SCORE);
  lines.push(`- **Mined file:** \`per_interview/${file}\``);
  lines.push(`- **\`interview_weight\`:** ${wJson.toFixed(4)}`);
  lines.push("");

  const snippets = Array.isArray(data.snippets) ? data.snippets : [];
  totalSnippets += snippets.length;

  snippets.forEach((s, idx) => {
    const tag = String(s.theme_tag ?? "");
    const quote = String(s.pull_quote ?? "").trim();
    const angle = String(s.website_angle ?? "").trim();
    const intensity = Number(s.intensity_1_to_5 ?? 0);
    const sw = wJson * intensity;

    lines.push(`#### ${idx + 1}. \`${tag}\``);
    lines.push("");
    lines.push(`- **\`intensity_1_to_5\`:** ${intensity}`);
    lines.push(
      `- **\`snippet_weight\`** (\`interview_weight\` × intensity): **${sw.toFixed(4)}**`
    );
    lines.push("");
    lines.push("**Pull quote**");
    lines.push("");
    lines.push(`> ${quote}`);
    lines.push("");
    lines.push("**Website angle**");
    lines.push("");
    lines.push(angle);
    lines.push("");
  });

  lines.push("---");
  lines.push("");
}

lines.push("");
lines.push(
  `**Interviews with mined JSON:** ${rowsMeta.filter((r) => r.hasJson).length} · **Total mined snippets:** ${totalSnippets}`
);
lines.push("");

fs.writeFileSync(OUT, lines.join("\n"), "utf8");
console.log(
  `Wrote ${OUT} (roster ${sortedKeys.length}, snippets ${totalSnippets})`
);
