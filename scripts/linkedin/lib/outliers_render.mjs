/**
 * Render `OUTLIERS.md` from collected outlier rows + optional framework markdown per URN.
 *
 * **Default: `mode: "slim"`** — one compact table (Claude-friendly). Full prose + frameworks:
 * `mode: "verbose"` or use `--verbose-md` on the enrich script.
 */

/** Stable key for cache / map (URN preferred). */
export function outlierKey(o) {
  return String(o.urn || o.url || "").trim() || "_unknown";
}

export function formatTagLine(row) {
  const fmt = row.format_level.length ? row.format_level.join(", ") : "_(not tagged)_";
  const str = row.structural.length ? row.structural.join(", ") : "_(not tagged)_";
  const len = row.length_tier || "_(not tagged)_";
  return `**Format-level:** ${fmt}  \n**Structural:** ${str}  \n**Length tier:** ${len}  \n**Char count:** ${row.char_count}`;
}

/**
 * Put the full post in a Markdown fenced block. We avoid fixed ``` fences because
 * LinkedIn copy sometimes contains triple backticks; we lengthen the fence until
 * the delimiter never appears inside the body. (HTML `<details>` was worse: we only
 * pasted the first 320 chars as "preview", and raw `<` in posts could break the tag.)
 */
function fencedFullPost(raw) {
  const t = String(raw ?? "").replace(/\r\n/g, "\n");
  let n = 3;
  let fence;
  for (;;) {
    fence = "`".repeat(n);
    if (!t.includes(fence)) break;
    n += 1;
    if (n > 64) break;
  }
  return `${fence}text\n${t}\n${fence}`;
}

function escCell(s, max = 80) {
  let t = String(s ?? "—").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
  if (t.length > max) t = t.slice(0, max - 1) + "…";
  return t || "—";
}

function shortUrn(urn) {
  const u = String(urn || "");
  const m = u.match(/activity:(\d+)/);
  return m ? `…${m[1].slice(-10)}` : u.slice(-14) || "—";
}

/**
 * Compact document: ~2–6k tokens for ~750 rows (good for Claude context).
 * Full post bodies + long framework write-ups stay in `outliers_index.json` /
 * `outlier_framework_cache.json`.
 */
export function renderOutliersDocumentSlim(p) {
  const { multiplier, bySlug, allFlat, frameworkByKey = {}, frameworkPendingNote = "" } = p;
  const lines = [];
  lines.push("# Engagement outliers (compact index)");
  lines.push("");
  lines.push(`*Generated: ${new Date().toISOString()}*`);
  lines.push("");
  lines.push("## What this file is");
  lines.push("");
  lines.push(
    `**5× rule:** per creator, mean of likes / comments / shares; a post is listed if any metric is **≥ ${multiplier}×** that mean (and that mean > 0).`
  );
  lines.push("");
  lines.push(
    "- **This file:** scan table only (rank, metrics, short hook, tags, whether a framework exists in cache).",
    "- **Full post text:** `data/outliers_index.json` (field `text` on each outlier under `bySlug`).",
    "- **Full framework extractions (10 sections):** `data/outlier_framework_cache.json` — keys = post URN (same as `outlierKey`).",
    "- **Regenerate table:** `npm run outliers`. **Add frameworks:** `npm run outliers:architecture` (batched; uses OpenRouter).",
    ""
  );
  if (frameworkPendingNote) {
    lines.push(`*${frameworkPendingNote}*`, "");
  }
  lines.push(
    "**Verbose Markdown** (large: every post + full pasted frameworks): after caches exist, run:",
    "`node scripts/enrich_outliers_frameworks.mjs --verbose-md --md-only`",
    ""
  );
  lines.push("---");
  lines.push("");
  lines.push("## All outliers (one row each)");
  lines.push("");
  lines.push(
    "| Rank | Creator | Axes | Max× | Likes | Com | Shares | Hook | Format | Structural | FW | Activity id |"
  );
  lines.push("| ---: | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | :---: | --- |");

  allFlat.forEach((o, i) => {
    const key = outlierKey(o);
    const fw = frameworkByKey[key] && String(frameworkByKey[key]).trim() ? "✓" : "—";
    const fmt0 = escCell((o.format_level && o.format_level[0]) || "—", 22);
    const str0 = escCell((o.structural && o.structural[0]) || "—", 22);
    lines.push(
      `| ${i + 1} | ${escCell(o.influencerName, 18)} | ${escCell(o.outlierTypes.join("+"), 14)} | ${o.maxRatio.toFixed(2)} | ${o.likes ?? "—"} | ${o.comments ?? "—"} | ${o.shares ?? "—"} | ${escCell(o.hook, 44)} | ${fmt0} | ${str0} | ${fw} | ${escCell(shortUrn(o.urn), 16)} |`
    );
  });

  lines.push("");
  lines.push("## Per-creator counts (quick)");
  lines.push("");
  lines.push("| Creator | Slug | Outliers | Mean L / C / S |");
  lines.push("| --- | --- | ---: | --- |");
  for (const b of bySlug) {
    if (!b.source) {
      lines.push(`| ${escCell(b.name, 22)} | \`${b.slug}\` | 0 | — |`);
      continue;
    }
    const ml = b.means.likes != null ? b.means.likes.toFixed(0) : "—";
    const mc = b.means.comments != null ? b.means.comments.toFixed(0) : "—";
    const ms = b.means.shares != null ? b.means.shares.toFixed(0) : "—";
    lines.push(
      `| ${escCell(b.name, 22)} | \`${b.slug}\` | ${b.outliers.length} | ${ml} / ${mc} / ${ms} |`
    );
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * @param {{ multiplier: number, bySlug: any[], allFlat: any[], frameworkByKey?: Record<string, string>, frameworkPendingNote?: string, mode?: "slim" | "verbose" }} p
 */
export function renderOutliersDocument(p) {
  const mode = p.mode === "verbose" ? "verbose" : "slim";
  if (mode === "slim") return renderOutliersDocumentSlim(p);
  return renderOutliersDocumentVerbose(p);
}

/**
 * Append one creator’s verbose section (stats + each outlier with **full** `text` in a fence + framework).
 * Used by the monolithic verbose doc (`includeCreatorH2: true`) and by per-person exports (`false`).
 *
 * @param {string[]} lines
 * @param {{ slug: string, name: string, means: object, n: number, source?: string, outliers: object[] }} b
 * @param {{ multiplier: number, frameworkByKey?: Record<string, string>, includeCreatorH2?: boolean }} opts
 */
export function appendVerboseInfluencerBlock(lines, b, opts) {
  const { multiplier, frameworkByKey = {}, includeCreatorH2 = true } = opts;
  const { slug, name, means, n, source, outliers } = b;

  if (includeCreatorH2) {
    lines.push(`## ${name} (\`${slug}\`)`);
    lines.push("");
  }

  if (!source) {
    lines.push("_No posts_classified.json or posts_clean.json — skipped._");
    lines.push("");
    lines.push("---");
    lines.push("");
    return;
  }

  lines.push(
    `- **Posts analyzed:** ${n} (source: \`${source === "classified" ? "posts_classified.json" : "posts_clean.json"}\`)`
  );
  lines.push(
    `- **Means —** likes: ${means.likes != null ? means.likes.toFixed(1) : "—"} · comments: ${means.comments != null ? means.comments.toFixed(1) : "—"} · shares: ${means.shares != null ? means.shares.toFixed(1) : "—"}`
  );
  lines.push("");

  if (!outliers.length) {
    lines.push(
      `_No posts reached ${multiplier}× the mean on likes, comments, or shares (with mean > 0 in that column)._`
    );
    lines.push("");
    lines.push("---");
    lines.push("");
    return;
  }

  lines.push(`### ${multiplier}× outliers (${outliers.length} posts)`);
  lines.push("");

  let idx = 0;
  for (const o of outliers) {
    idx += 1;
    const parts = [];
    if (o.outlierTypes.includes("likes")) {
      parts.push(
        `**Likes outlier** — ${o.likes?.toLocaleString?.() ?? o.likes} reactions ≈ **${o.likesRatio?.toFixed(2)}×** mean`
      );
    }
    if (o.outlierTypes.includes("comments")) {
      parts.push(
        `**Comments outlier** — ${o.comments?.toLocaleString?.() ?? o.comments} comments ≈ **${o.commentsRatio?.toFixed(2)}×** mean`
      );
    }
    if (o.outlierTypes.includes("shares")) {
      parts.push(
        `**Shares outlier** — ${o.shares?.toLocaleString?.() ?? o.shares} shares ≈ **${o.sharesRatio?.toFixed(2)}×** mean`
      );
    }

    lines.push(`#### ${idx}. ${parts.join(" · ")}`);
    lines.push("");
    lines.push(`- **URL:** ${o.url || "—"}`);
    if (o.urn) lines.push(`- **URN:** \`${o.urn}\``);
    lines.push(
      `- **Engagement (raw):** ${o.likes ?? "—"} likes · ${o.comments ?? "—"} comments · ${o.shares ?? "—"} shares`
    );
    lines.push(`- **Hook:** ${o.hook || "—"}`);
    lines.push("");
    lines.push(formatTagLine(o));
    lines.push("");
    // Full post body (not textPreview — that is only 320 chars for JSON / slim use).
    const fullText = String(o.text ?? "").replace(/\r\n/g, "\n").trim();
    if (fullText.length > 0) {
      lines.push("**Full post**");
      lines.push("");
      lines.push(fencedFullPost(fullText));
      lines.push("");
    } else if (o.textPreview && String(o.textPreview).trim()) {
      lines.push("_No full `text` stored for this row; showing truncated preview only._");
      lines.push("");
      lines.push(fencedFullPost(String(o.textPreview).replace(/\r\n/g, "\n")));
      lines.push("");
    }

    const key = outlierKey(o);
    const fw = frameworkByKey[key];
    lines.push("---");
    lines.push("");
    lines.push("### Post architecture extraction");
    lines.push("");
    if (fw && fw.trim()) {
      lines.push(fw.trim());
    } else {
      lines.push(
        "_No framework block yet. Run `node scripts/enrich_outliers_frameworks.mjs` (see `--max`, cache in `data/outlier_framework_cache.json`)._"
      );
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
}

/**
 * One standalone Markdown file for a single influencer (full posts, same layout as verbose monolith slice).
 * Write to e.g. `data/outliers_by_person/<slug>.md` so you can open one creator at a time in Claude / editor.
 */
export function renderVerboseMarkdownForOnePerson(b, { multiplier, frameworkByKey = {} }) {
  const lines = [];
  lines.push(`# Engagement outliers — **${b.name}** (\`${b.slug}\`)`);
  lines.push("");
  lines.push(`*Generated: ${new Date().toISOString()}*`);
  lines.push("");
  lines.push(
    `**Rule:** a post is listed when **likes**, **comments**, or **shares** is **≥ ${multiplier}×** this creator’s mean for that metric (mean must be > 0). **Full post** bodies below are taken from \`outliers_index.json\` (\`text\` field), not the short preview.`
  );
  lines.push("");
  lines.push(
    "**Tags:** format-level (Typeshare-style), structural (Cole & Bush), length tier. **Framework** blocks come from `data/outlier_framework_cache.json` when present."
  );
  lines.push("");
  lines.push("---");
  lines.push("");
  appendVerboseInfluencerBlock(lines, b, { multiplier, frameworkByKey, includeCreatorH2: false });
  return lines.join("\n").replace(/\r?\n---\r?\n\r?\n$/m, "\n");
}

/** Large file: per-post sections + full framework paste (legacy). */
export function renderOutliersDocumentVerbose(p) {
  const { multiplier, bySlug, allFlat, frameworkByKey = {}, frameworkPendingNote = "" } = p;
  const lines = [];
  lines.push("# Engagement outliers (5× vs personal mean) — **VERBOSE**");
  lines.push("");
  lines.push(`*Generated: ${new Date().toISOString()}*`);
  lines.push("");
  lines.push("## Method");
  lines.push("");
  lines.push(
    `For each creator, we take **all posts** with numeric engagement, compute the **arithmetic mean** of **likes**, **comments**, and **shares** separately, then flag a post as an outlier in a category when **value ≥ ${multiplier}× that mean** and **mean > 0** (otherwise that category has no outliers).`
  );
  lines.push("");
  lines.push(
    "**Tags** come from your pipeline: **Format-level** (Typeshare-style), **Structural** (Cole & Bush), **Length tier** (Short / Medium / Long)."
  );
  lines.push("");
  lines.push(
    "### Post architecture extraction (second layer)",
    "",
    "Each outlier can include a **reverse-engineered framework** (hook mechanics, spine, rhythm, tension/payoff, reusable template slots, archetype, remixability) produced by the Post Architecture Extraction prompt. Ground rules: structural claims tied to verbatim quotes; framework names describe the *mechanism*, not the topic.",
    ""
  );
  if (frameworkPendingNote) {
    lines.push(`*${frameworkPendingNote}*`, "");
  }
  lines.push("---");
  lines.push("");

  for (const b of bySlug) {
    appendVerboseInfluencerBlock(lines, b, { multiplier, frameworkByKey, includeCreatorH2: true });
  }

  lines.push("## Global roll-up (all influencers)");
  lines.push("");
  lines.push(
    `Sorted by **strongest single-axis ratio** (max of likes/comments/shares vs mean). **${allFlat.length}** outlier rows total (a post can appear once per influencer with multiple axes).`
  );
  lines.push("");
  lines.push("| Rank | Creator | Outlier type(s) | Max× | Likes | Comments | Shares | Structural (first) |");
  lines.push("| ---: | --- | --- | ---: | ---: | ---: | ---: | --- |");

  allFlat.forEach((o, i) => {
    const types = o.outlierTypes.join(" + ");
    const str0 = (o.structural && o.structural[0]) || "—";
    lines.push(
      `| ${i + 1} | ${o.influencerName} | ${types} | ${o.maxRatio.toFixed(2)} | ${o.likes ?? "—"} | ${o.comments ?? "—"} | ${o.shares ?? "—"} | ${String(str0).replace(/\|/g, "\\|")} |`
    );
  });

  lines.push("");
  return lines.join("\n");
}
