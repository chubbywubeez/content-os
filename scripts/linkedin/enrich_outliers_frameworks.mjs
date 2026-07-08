/**
 * For each engagement outlier, call OpenRouter with the Post Architecture Extraction
 * prompt and merge results into `data/OUTLIERS.md`. Results are cached in
 * `data/outlier_framework_cache.json` (key = URN or URL) so interrupted runs resume.
 *
 * Requires `data/outliers_index.json` from `npm run outliers` / `build_outliers_report.mjs`.
 *
 *   node scripts/enrich_outliers_frameworks.mjs
 *   node scripts/enrich_outliers_frameworks.mjs --max=5
 *   node scripts/enrich_outliers_frameworks.mjs --max=all
 *   node scripts/enrich_outliers_frameworks.mjs --verbose-md --md-only   (huge OUTLIERS.md from cache)
 *   node scripts/enrich_outliers_frameworks.mjs --split-person-md --md-only   (also writes data/outliers_by_person/*.md)
 *   node scripts/enrich_outliers_frameworks.mjs --force    (re-fetch even if cached)
 *
 * Env: OPENROUTER_API_KEY, OPENROUTER_MODEL (optional)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectOutlierDataset, DATA } from "./lib/outliers_collect.mjs";
import { outlierKey, renderOutliersDocument } from "./lib/outliers_render.mjs";
import { writePerPersonOutlierMarkdown } from "./lib/outliers_write_per_person.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const PROMPT_PATH = path.join(ROOT, "prompts", "post_architecture_extraction.md");
const INDEX_PATH = path.join(DATA, "outliers_index.json");
const CACHE_PATH = path.join(DATA, "outlier_framework_cache.json");
const OUT_PATH = path.join(DATA, "OUTLIERS.md");

function loadEnvFromAncestors() {
  for (const dir of [ROOT, path.join(ROOT, ".."), path.join(ROOT, "..", "..")]) {
    const envPath = path.join(dir, ".env");
    if (!fs.existsSync(envPath)) continue;
    for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      const key = line.slice(0, i).trim();
      let val = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      if (key && process.env[key] === undefined) process.env[key] = val;
    }
    break;
  }
}

function parseArgs() {
  const out = { max: 15, mdOnly: false, force: false, verboseMd: false, splitPersonMd: false };
  for (const a of process.argv.slice(2)) {
    if (a === "--md-only") out.mdOnly = true;
    else if (a === "--force") out.force = true;
    else if (a === "--verbose-md") out.verboseMd = true;
    else if (a === "--split-person-md") out.splitPersonMd = true;
    else if (a.startsWith("--max=")) {
      const v = a.slice("--max=".length).trim().toLowerCase();
      if (v === "all" || v === "0") out.max = Infinity;
      else {
        const n = parseInt(v, 10);
        if (Number.isFinite(n) && n > 0) out.max = n;
      }
    }
  }
  return out;
}

function wordCount(s) {
  const m = String(s || "").trim().match(/\S+/g);
  return m ? m.length : 0;
}

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return { version: 1, items: {} };
  try {
    const j = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    if (j && typeof j.items === "object") return j;
  } catch {
    /* ignore */
  }
  return { version: 1, items: {} };
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
}

function loadPromptTemplate() {
  if (!fs.existsSync(PROMPT_PATH)) {
    throw new Error(`Missing prompt file: ${PROMPT_PATH}`);
  }
  return fs.readFileSync(PROMPT_PATH, "utf8");
}

function loadIndexOrCollect(multiplier) {
  if (fs.existsSync(INDEX_PATH)) {
    const j = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
    const mult = typeof j.multiplier === "number" ? j.multiplier : multiplier;
    return { multiplier: mult, bySlug: j.bySlug, fromFile: true };
  }
  console.warn(`No ${INDEX_PATH} — rebuilding from scrape files (multiplier=${multiplier}).`);
  const d = collectOutlierDataset({ multiplier });
  fs.writeFileSync(
    INDEX_PATH,
    JSON.stringify(
      { version: 2, generatedAt: new Date().toISOString(), multiplier: d.multiplier, bySlug: d.bySlug },
      null,
      2
    ),
    "utf8"
  );
  console.warn(`Wrote ${INDEX_PATH}`);
  return { multiplier: d.multiplier, bySlug: d.bySlug, fromFile: false };
}

function flattenForPriority(bySlug) {
  const rows = [];
  for (const b of bySlug) {
    for (const o of b.outliers) {
      rows.push({ ...o, influencerName: b.name });
    }
  }
  rows.sort((a, b) => b.maxRatio - a.maxRatio);
  return rows;
}

function buildFrameworkMap(bySlug, cacheItems) {
  const map = {};
  for (const b of bySlug) {
    for (const o of b.outliers) {
      const k = outlierKey(o);
      if (cacheItems[k] && String(cacheItems[k]).trim()) {
        map[k] = String(cacheItems[k]).trim();
      }
    }
  }
  return map;
}

async function extractFramework({ postText, context, apiKey, model, promptTemplate }) {
  const user = promptTemplate
    .replace("<<<POST>>>", postText || "_(empty)_")
    .replace("<<<CONTEXT>>>", JSON.stringify(context, null, 2));

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://local.vantum/linkedin-outliers-framework",
      "X-Title": "Vantum post architecture extract",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a content architecture analyst. Follow the user's instructions exactly. Output only the Markdown sections requested — no preamble or closing.",
        },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      max_tokens: 16_000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter HTTP ${res.status}: ${err.slice(0, 900)}`);
  }
  const body = await res.json();
  const msg = body?.choices?.[0]?.message?.content;
  if (typeof msg !== "string" || !msg.trim()) {
    throw new Error("OpenRouter: empty content");
  }
  return msg.trim();
}

async function main() {
  loadEnvFromAncestors();
  const args = parseArgs();
  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();
  const model = (process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.6").trim();

  if (process.env.OUTLIERS_VERBOSE_MD === "1") args.verboseMd = true;

  const dataset = loadIndexOrCollect(5);
  const { multiplier, bySlug } = dataset;
  const allFlat = flattenForPriority(bySlug);
  const totalOutliers = allFlat.length;

  const cache = loadCache();
  if (!cache.items) cache.items = {};

  let promptTemplate = "";
  if (!args.mdOnly) {
    promptTemplate = loadPromptTemplate();
  }

  /** Keep OUTLIERS.md in sync with cache so long runs show partial progress. */
  function writeOutliersFromCache() {
    const frameworkByKey = buildFrameworkMap(bySlug, cache.items);
    const cachedCount = Object.keys(frameworkByKey).length;
    const md = renderOutliersDocument({
      multiplier,
      bySlug,
      allFlat,
      frameworkByKey,
      mode: args.verboseMd ? "verbose" : "slim",
      frameworkPendingNote:
        cachedCount < totalOutliers
          ? `Framework cache: **${cachedCount} / ${totalOutliers}** posts (in progress — safe to stop; re-run the same command to resume).`
          : `All **${totalOutliers}** outlier posts have a cached framework block.`,
    });
    fs.writeFileSync(OUT_PATH, md, "utf8");
  }

  if (!args.mdOnly) {
    if (!apiKey) {
      console.error("Missing OPENROUTER_API_KEY in .env (Copy Maker root).");
      process.exit(1);
    }

    let newCalls = 0;
    for (const o of allFlat) {
      if (newCalls >= args.max) break;
      const key = outlierKey(o);
      if (!key || key === "_unknown") continue;
      if (!args.force && cache.items[key]) continue;

      const wc = wordCount(o.text);
      const context = {
        author_display: o.influencerName,
        platform: "LinkedIn",
        post_url: o.url,
        urn: o.urn,
        engagement: { likes: o.likes, comments: o.comments, shares: o.shares },
        outlier_axes: o.outlierTypes,
        ratios: {
          likes_vs_mean: o.likesRatio,
          comments_vs_mean: o.commentsRatio,
          shares_vs_mean: o.sharesRatio,
        },
        pipeline_tags: {
          format_level: o.format_level,
          structural: o.structural,
          length_tier: o.length_tier,
          char_count: o.char_count,
          word_count_approx: wc,
        },
      };

      console.log(`Framework extract: ${o.influencerName} · ${key.slice(0, 48)}… (${newCalls + 1}/${args.max === Infinity ? "∞" : args.max})`);
      try {
        const md = await extractFramework({
          postText: o.text || "",
          context,
          apiKey,
          model,
          promptTemplate,
        });
        cache.items[key] = md;
        saveCache(cache);
        newCalls += 1;
        writeOutliersFromCache();
      } catch (e) {
        console.error(`  Failed: ${e.message}`);
        break;
      }
    }
    console.log(`New OpenRouter calls this run: ${newCalls}. Cache: ${CACHE_PATH}`);
  }

  writeOutliersFromCache();
  console.log(`Wrote ${OUT_PATH}`);
  if (args.splitPersonMd) {
    const frameworkByKey = buildFrameworkMap(bySlug, cache.items);
    const { fileCount, outDir } = writePerPersonOutlierMarkdown({
      dataDir: DATA,
      bySlug,
      multiplier,
      frameworkByKey,
    });
    console.log(`Per-person verbose: ${fileCount} files → ${outDir} (_INDEX.md)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
