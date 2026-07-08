/**
 * One “sheet” of all grading: summary table + every full `scores/*.score.md` report.
 * Parsing rules mirror `Problem Presentations/tools/stack_rank_scores.py` so the
 * rank table stays consistent with `STACK_RANK.md` (regenerate either after edits).
 *
 * Run: node "Problem Presentations/copy_mining/tools/build_all_grading_md.mjs"
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRESENTATIONS_DIR = path.resolve(__dirname, "..", "..");
const SCORES_DIR = path.join(PRESENTATIONS_DIR, "scores");
const OUT = path.join(SCORES_DIR, "ALL_GRADING.md");

const COMPOSITE_RE =
  /\*\*[^*\n]*?(?:Interim\s+)?Composite\s+Score:\s*([\d.]+)\s*\/\s*100\*\*/i;

const NO_COMPOSITE_HINT =
  /(NOT\s+CALCULATED|no\s+composite\s+is\s+produced|Do\s+not\s+continue\s+scoring|fabricating\s+scores\s+from\s+non-existent)/i;

const CLASSIFICATION_RE =
  /##\s*CLASSIFICATION\s*\n+\*\*([A-E])\s*[—–-]\s*([^*]+?)\*\*/i;

const HYPOTHESIS_RE =
  /(?:\*\*)?Normalized\s+Hypothesis\s+Score:?\s*\*?\*?\s*([\d.]+)\s*%(?:\*\*)?/i;

const EARLY_CLASS_RE =
  /(?:Classification|CLASSIFY)\s*:\s*\*?\*?\s*([A-E])\s*[—–-]\s*([^\n*]+)/i;

function parseScoreFile(text) {
  const compM = text.match(COMPOSITE_RE);
  if (compM) {
    return {
      composite: Number(compM[1]),
      compositeDisplay: null,
      hypothesisPct: hypothesisPct(text),
    };
  }
  if (NO_COMPOSITE_HINT.test(text)) {
    return {
      composite: null,
      compositeDisplay: "N/C",
      hypothesisPct: hypothesisPct(text),
    };
  }
  return {
    composite: null,
    compositeDisplay: "—",
    hypothesisPct: hypothesisPct(text),
  };
}

function hypothesisPct(text) {
  const m = text.match(HYPOTHESIS_RE);
  return m ? `${m[1]}%` : null;
}

function classificationLabel(text) {
  const m = text.match(CLASSIFICATION_RE);
  if (m) {
    const letter = m[1].toUpperCase();
    let rest = m[2].trim().replace(/\s+/g, " ");
    if (rest.length > 72) rest = `${rest.slice(0, 69)}…`;
    return `${letter} — ${rest}`;
  }
  const early = text.match(EARLY_CLASS_RE);
  if (early) {
    const tail = early[2].trim().slice(0, 60);
    return `${early[1].toUpperCase()} — ${tail}`;
  }
  return "—";
}

/** Match `stack_rank_scores.py` display style closely (trim trailing zeros). */
function formatCompositeDisplay(comp, fallback) {
  if (comp != null && !Number.isNaN(comp)) {
    return comp.toFixed(2).replace(/\.?0+$/, "");
  }
  return fallback ?? "—";
}

function isoUtc() {
  return new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function main() {
  if (!fs.existsSync(SCORES_DIR)) {
    console.error("Missing scores dir:", SCORES_DIR);
    process.exit(1);
  }

  const scoreFiles = fs
    .readdirSync(SCORES_DIR)
    .filter((n) => n.endsWith(".score.md"))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  const rows = [];
  for (const fname of scoreFiles) {
    const abs = path.join(SCORES_DIR, fname);
    const raw = fs.readFileSync(abs, "utf8");
    const parsed = parseScoreFile(raw);
    const { composite, compositeDisplay, hypothesisPct: hyp } = parsed;
    const cls = classificationLabel(raw);
    const label = fname.replace(/\.score\.md$/i, "");

    const disp = formatCompositeDisplay(composite, compositeDisplay);
    const sortBucket = composite != null && !Number.isNaN(composite) ? 0 : 1;
    const sortVal =
      composite != null && !Number.isNaN(composite) ? -composite : 0;

    rows.push({
      sortBucket,
      sortVal,
      label,
      disp,
      hyp: hyp ?? "—",
      cls: cls.replace(/\|/g, "\\|"),
      fname,
      raw: raw.replace(/\s+$/, ""),
    });
  }

  rows.sort((a, b) => {
    if (a.sortBucket !== b.sortBucket) return a.sortBucket - b.sortBucket;
    if (a.sortVal !== b.sortVal) return a.sortVal - b.sortVal;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });

  const lines = [];
  lines.push("# All grading (combined)");
  lines.push("");
  lines.push(
    `*Generated: ${isoUtc()} · Source: \`Problem Presentations/scores/*.score.md\`*`
  );
  lines.push("");
  lines.push(
    "This file is a **single place** for interview grading: an auto-parsed summary table (same logic as `tools/stack_rank_scores.py` / `STACK_RANK.md`), then the **full text** of every score report below."
  );
  lines.push("");
  lines.push(
    "**Regenerate** this rollup after you add or edit score files (Node must be available):"
  );
  lines.push("");
  lines.push("```bash");
  lines.push(
    'node "Problem Presentations/copy_mining/tools/build_all_grading_md.mjs"'
  );
  lines.push("```");
  lines.push("");
  lines.push(
    "To refresh only the short stack-rank file (requires Python on your PATH):"
  );
  lines.push("");
  lines.push("```bash");
  lines.push('python "Problem Presentations/tools/stack_rank_scores.py"');
  lines.push("```");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Summary — stack rank");
  lines.push("");
  lines.push(
    "Composite and classification are **parsed** from each file (model wording varies). **N/C** = no numeric composite."
  );
  lines.push("");
  lines.push(
    "| Rank | Participant | Composite /100 | Hypothesis norm. | Classification | Source |"
  );
  lines.push("| ---: | --- | ---: | --- | --- | --- |");

  rows.forEach((r, i) => {
    const link = `[open](${r.fname})`;
    lines.push(
      `| ${i + 1} | ${r.label} | ${r.disp} | ${r.hyp} | ${r.cls} | ${link} |`
    );
  });

  lines.push("");
  lines.push(`**Participants:** ${rows.length}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Full score reports (complete text)");
  lines.push("");

  for (const r of rows) {
    lines.push(`### ${r.label}`);
    lines.push("");
    lines.push(`*File: \`scores/${r.fname}\`*`);
    lines.push("");
    lines.push(r.raw);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  fs.writeFileSync(OUT, lines.join("\n") + "\n", "utf8");
  console.log(`Wrote ${OUT} (${rows.length} reports)`);
}

main();
