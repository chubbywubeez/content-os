/**
 * Scrape LinkedIn posts per influencer (one Apify run per profile) using the
 * community actor `supreme_coder/linkedin-post` (console id Wpp1BZ6yGWjySadk3).
 *
 * Docs / input schema: https://apify.com/supreme_coder/linkedin-post
 *
 * Env:
 *   APIFY_TOKEN   — required for scraping (Apify Console → Integrations → API token)
 *   OPENROUTER_API_KEY — optional; if set, adds LLM tags (format + structural)
 *
 * Optional env (same as other Vantum scripts):
 *   OPENROUTER_MODEL — default anthropic/claude-sonnet-4.6
 *
 * Usage (from repo root or this folder):
 *   node linkedin_influencers/scripts/scrape_and_classify.mjs
 *   node linkedin_influencers/scripts/scrape_and_classify.mjs --limit=80
 *   node linkedin_influencers/scripts/scrape_and_classify.mjs --unlimited
 *   node linkedin_influencers/scripts/scrape_and_classify.mjs --scrape-only
 *   node linkedin_influencers/scripts/scrape_and_classify.mjs --classify-only
 *   node linkedin_influencers/scripts/scrape_and_classify.mjs --no-llm
 *   node linkedin_influencers/scripts/scrape_and_classify.mjs --deep
 *
 * Default Apify input uses **deepScrape: false** so `posts_raw.json` stays smaller
 * (counts still come from numeric fields when the actor provides them). Use `--deep`
 * if you need full comment / reaction payloads embedded in raw JSON.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ApifyClient } from "apify-client";

import { getFullPostText, normalizePost, writeCleanExport } from "./post_normalize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");
const INFLUENCERS_PATH = path.join(ROOT, "influencers.json");

const ACTOR_ID = "Wpp1BZ6yGWjySadk3";

const FORMAT_LEVEL_TAGS = [
  "Atomic Essay",
  "LinkedIn Post",
  "Tweet",
  "X/Twitter Thread",
  "Medium Story",
  "Blog Post",
  "Deck",
  "Newsletter",
  "Bluesky / Threads posts",
];

const STRUCTURAL_TAGS = [
  "List post",
  "Story post",
  "How-to / Framework post",
  "Observation / Contrarian take",
  "Case study / Breakdown",
  "Personal essay / Reflection",
  "Question post",
  "One-liner / Punch",
  "Quote + commentary",
];

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

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
  const out = {
    /** When true, omit `limitPerSource` so the actor scrapes every post it can (see Apify input schema). */
    unlimited: false,
    limit: 100,
    scrapeOnly: false,
    classifyOnly: false,
    noLlm: false,
    /** When true, pass `deepScrape: true` to the actor (large raw JSON with nested comment/reaction blobs). */
    deep: false,
  };
  for (const a of process.argv.slice(2)) {
    if (a === "--scrape-only") out.scrapeOnly = true;
    else if (a === "--classify-only") out.classifyOnly = true;
    else if (a === "--no-llm") out.noLlm = true;
    else if (a === "--deep") out.deep = true;
    else if (a === "--unlimited") out.unlimited = true;
    else if (a.startsWith("--limit=")) {
      const n = parseInt(a.split("=")[1], 10);
      if (!Number.isFinite(n) || n <= 0) out.unlimited = true;
      else out.limit = n;
    }
  }
  return out;
}

function lengthTier(charCount) {
  if (charCount < 400) return "Short";
  if (charCount < 1500) return "Medium";
  if (charCount <= 3000) return "Long";
  return "Long";
}

function heuristicStructural(text) {
  const tags = new Set();
  if (!text) return [...tags];
  const t = text.trim();
  const oneLine = t.split(/\n/).length <= 2 && t.length < 200;
  if (oneLine) tags.add("One-liner / Punch");

  if (/[?？]\s*$/.test(t) || /^.{1,120}[?？]\s*$/m.test(t))
    tags.add("Question post");

  if (/^[\s>*"]{0,3}["""]/.test(t) || /^>[\s]*["""]/m.test(t))
    tags.add("Quote + commentary");

  const listLines = t
    .split("\n")
    .filter((ln) =>
      /^\s*(\d{1,2}[\).]\s|[-*•]\s|\[[ x]\]\s)/i.test(ln)
    ).length;
  if (listLines >= 3) tags.add("List post");

  if (
    /\b(step \d|first,|second,|third,|framework|playbook|here's how)\b/i.test(
      t
    )
  ) {
    tags.add("How-to / Framework post");
  }

  if (
    /\b(I learned|lesson|when I|years ago|story:|once upon)\b/i.test(t) &&
    t.length > 400
  ) {
    tags.add("Story post");
  }

  if (/\b(unpopular|hot take|everyone is wrong|stop doing)\b/i.test(t)) {
    tags.add("Observation / Contrarian take");
  }

  if (/\b(case study|breakdown|what X got right|teardown)\b/i.test(t)) {
    tags.add("Case study / Breakdown");
  }

  if (
    /\b(I feel|I realized|honestly,|vulnerable|imposter)\b/i.test(t) &&
    t.length > 350
  ) {
    tags.add("Personal essay / Reflection");
  }

  return [...tags];
}

function heuristicFormat(item, text, url) {
  const u = (url || "").toLowerCase();
  const tags = new Set();
  if (/twitter\.com|x\.com/.test(u)) {
    tags.add(u.includes("/status/") ? "Tweet" : "X/Twitter Thread");
    return [...tags];
  }
  if (/bsky\.app|threads\.net/.test(u)) tags.add("Bluesky / Threads posts");
  if (/medium\.com/.test(u)) tags.add("Medium Story");
  if (/substack\.com|beehiiv|convertkit/.test(u)) tags.add("Newsletter");
  if (/\.pdf(\?|$)/i.test(u) || item?.type === "document")
    tags.add("Deck");
  if (item?.isArticle || item?.article) tags.add("Blog Post");
  if (item?.images?.length >= 1 && text.length < 400 && !text.includes("\n\n"))
    tags.add("Atomic Essay");

  if (tags.size === 0) tags.add("LinkedIn Post");
  return [...tags];
}

async function openRouterClassifyBatch(chunk, { apiKey, model }) {
  const payload = chunk.map((item, i) => ({
    i,
    url: item.url || item.postLink || item.link || "",
    text_preview: getFullPostText(item).slice(0, 1200),
  }));

  const system = `You tag social posts for a content library. Return ONLY valid JSON (no markdown fences): an array of objects, one per input index, in order.
Each object: { "i": number, "format_level": string[], "structural": string[] }

Rules:
- Use ONLY these format_level labels (subset allowed, 1–3 entries): ${JSON.stringify(FORMAT_LEVEL_TAGS)}
- Use ONLY these structural labels (1–4 entries): ${JSON.stringify(STRUCTURAL_TAGS)}
- Prefer precision over volume. If unsure, omit rather than guess wildly.
- LinkedIn native text posts are usually "LinkedIn Post" unless URL or content clearly indicates another format.
- Do NOT output length_tier (the pipeline computes it from character count).`;

  const user = JSON.stringify(payload, null, 0);

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://local.vantum/linkedin-influencers",
      "X-Title": "Vantum LinkedIn classifier",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter HTTP ${res.status}: ${err.slice(0, 800)}`);
  }
  const body = await res.json();
  const msg = body?.choices?.[0]?.message?.content;
  if (typeof msg !== "string") throw new Error("OpenRouter: empty content");
  let raw = msg.trim();
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Classifier JSON was not an array");
  return parsed;
}

/** Pull every dataset row using offset pagination (stable across client versions). */
async function downloadAllDatasetItems(client, datasetId) {
  const all = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const page = await client.dataset(datasetId).listItems({ offset, limit });
    all.push(...page.items);
    if (page.items.length === 0) break;
    if (page.items.length < limit) break;
    offset += page.items.length;
  }
  return all;
}

function mergeClassification(item, llmRow, slug) {
  const text = getFullPostText(item);
  const n = text.length;
  const url = String(item.url || item.postLink || item.link || "");

  const length_tier = lengthTier(n);
  let format_level = heuristicFormat(item, text, url);
  let structural = heuristicStructural(text);

  if (llmRow && typeof llmRow === "object") {
    const fl = Array.isArray(llmRow.format_level) ? llmRow.format_level : [];
    const st = Array.isArray(llmRow.structural) ? llmRow.structural : [];
    const clean = (arr, allowed) =>
      [...new Set(arr.filter((x) => allowed.includes(x)))];
    const flClean = clean(fl, FORMAT_LEVEL_TAGS);
    const stClean = clean(st, STRUCTURAL_TAGS);
    if (flClean.length) format_level = [...new Set([...format_level, ...flClean])];
    if (stClean.length)
      structural = [...new Set([...structural, ...stClean])];
  }

  // Clean base row (full text, counts-only engagement, indexed media) — no nested comments/reactors.
  const base = normalizePost(item);
  return {
    ...base,
    _classification: {
      influencer_slug: slug,
      length_tier,
      format_level,
      structural,
      char_count: n,
    },
  };
}

async function classifyWithOptionalLlm(items, slug, args) {
  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();
  const model = (
    process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.6"
  ).trim();

  if (args.noLlm || !apiKey) {
    return items.map((item) =>
      mergeClassification(item, null, slug)
    );
  }

  const batchSize = 10;
  const out = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    let rows = [];
    try {
      rows = await openRouterClassifyBatch(chunk, { apiKey, model });
    } catch (e) {
      console.warn(`  OpenRouter batch failed (${slug}):`, e.message);
    }
    const byI = new Map();
    for (const r of rows) {
      if (r && typeof r.i === "number") byI.set(r.i, r);
    }
    for (let j = 0; j < chunk.length; j++) {
      out.push(mergeClassification(chunk[j], byI.get(j), slug));
    }
  }
  return out;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function scrapeOne(client, slug, limitOrNull, deepScrape) {
  const profileUrl = `https://www.linkedin.com/in/${slug}/`;
  const input = {
    urls: [profileUrl],
    deepScrape: Boolean(deepScrape),
    rawData: false,
  };
  // Actor docs: omit limitPerSource for unlimited posts per URL.
  if (limitOrNull != null && Number.isFinite(limitOrNull)) {
    input.limitPerSource = limitOrNull;
  }

  const run = await client.actor(ACTOR_ID).call(input, {
    // Large backfills can exceed 1h; Apify run timeout is separate but this is client wait.
    waitSecs: limitOrNull == null ? 14_400 : 3600,
  });

  const datasetId = run.defaultDatasetId;
  return downloadAllDatasetItems(client, datasetId);
}

function filterItemsForSlug(items, slug) {
  const needle = `/in/${slug.toLowerCase()}/`;
  return items.filter((it) => {
    const blob = JSON.stringify(it).toLowerCase();
    return blob.includes(needle);
  });
}

async function main() {
  loadEnvFromAncestors();
  const args = parseArgs();

  if (args.scrapeOnly && args.classifyOnly) {
    console.error("Use only one of --scrape-only or --classify-only");
    process.exit(1);
  }

  const influencers = JSON.parse(
    fs.readFileSync(INFLUENCERS_PATH, "utf8")
  );
  ensureDir(DATA);

  const token = (process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN || "").trim();
  if (!args.classifyOnly && !token) {
    console.error(
      "Missing APIFY_TOKEN (or APIFY_API_TOKEN). Add it to your .env in the Copy Maker root."
    );
    process.exit(1);
  }

  const client = token ? new ApifyClient({ token }) : null;

  for (const row of influencers) {
    const slug = row.slug;
    const dir = path.join(DATA, slug);
    ensureDir(dir);
    const rawPath = path.join(dir, "posts_raw.json");
    const outPath = path.join(dir, "posts_classified.json");

    if (!args.classifyOnly) {
      console.log(`Scraping ${row.name} (${slug}) …`);
      const items = await scrapeOne(
        client,
        slug,
        args.unlimited ? null : args.limit,
        args.deep
      );
      const filtered = filterItemsForSlug(items, slug);
      const toSave = filtered.length ? filtered : items;
      if (filtered.length < items.length) {
        console.log(
          `  Note: kept ${filtered.length}/${items.length} items matching /in/${slug}/ in JSON (rest may be recommendations).`
        );
      }
      fs.writeFileSync(rawPath, JSON.stringify(toSave, null, 2), "utf8");
      console.log(`  Wrote ${rawPath} (${toSave.length} posts)`);
      const { jsonPath: cleanJson, mdPath } = writeCleanExport(dir, toSave, slug);
      console.log(`  Wrote ${cleanJson} + ${mdPath} (clean export, counts-only engagement)`);
    }

    if (args.scrapeOnly) continue;

    if (!fs.existsSync(rawPath)) {
      console.warn(`Skip classify: missing ${rawPath}`);
      continue;
    }

    const items = JSON.parse(fs.readFileSync(rawPath, "utf8"));
    console.log(`Classifying ${slug} (${items.length} posts) …`);
    const classified = await classifyWithOptionalLlm(items, slug, args);
    fs.writeFileSync(outPath, JSON.stringify(classified, null, 2), "utf8");
    console.log(`  Wrote ${outPath}`);
    // Refresh clean markdown/json from raw so engagement/text stay in sync after any re-scrape.
    const { jsonPath: cleanJson, mdPath } = writeCleanExport(dir, items, slug);
    console.log(`  Refreshed ${cleanJson} + ${mdPath}`);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
