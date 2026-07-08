/**
 * After scrape: for each post, derive a **core_topic** (stable theme) and a **take**
 * = **angle** — short positioning chips (not a prose hook), e.g. "Contrarian", "X vs Y",
 * "Controversial", "Pattern interrupt". Writes `data/<slug>/posts_topics.json`.
 *
 * Uses OpenRouter (same .env pattern as other Vantum tools). Batched to control cost.
 * Prefers **`posts_clean.json`** when present (full text + same order as raw); otherwise reads **`posts_raw.json`**.
 *
 * Usage (from `linkedin_influencers/`):
 *   node scripts/extract_topics_and_takes.mjs
 *   node scripts/extract_topics_and_takes.mjs --slug=george-mack
 *   node scripts/extract_topics_and_takes.mjs --force
 *   node scripts/extract_topics_and_takes.mjs --batch=10
 *
 * Optional:
 *   node scripts/extract_topics_and_takes.mjs --rollup
 *   → writes `data/TOPIC_ROLLUP.md` (topic frequency across everyone)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { postFingerprint } from "./post_text.mjs";
import { getFullPostText, extractOpeningHook } from "./post_normalize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");
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
    slug: "",
    force: false,
    rollup: false,
    batch: 10,
    /** Max chars sent to the model per post (full post text by default). */
    textCap: 120_000,
  };
  for (const a of process.argv.slice(2)) {
    if (a === "--force") out.force = true;
    else if (a === "--rollup") out.rollup = true;
    else if (a.startsWith("--slug=")) out.slug = a.slice("--slug=".length).trim();
    else if (a.startsWith("--batch="))
      out.batch = Math.max(2, parseInt(a.split("=")[1], 10) || 10);
    else if (a.startsWith("--text-cap="))
      out.textCap = Math.max(500, parseInt(a.split("=")[1], 10) || 120_000);
  }
  return out;
}

function stripJsonFence(raw) {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  return t.trim();
}

async function openRouterTagBatch(rows, { apiKey, model }) {
  const system = `You label LinkedIn posts for a marketing copy library.

Return ONLY valid JSON (no markdown fences): an array of objects, one per input row, in the SAME ORDER as the input.
Each object must have:
- "i" — number, the row index from the input (must match).
- "core_topic" — string, 2–6 words, Title Case, stable theme (e.g. "Pipeline Anxiety", "AI Search Visibility"). No hashtags.
- "take" — string: the post's **angle** as 1–4 short chips joined by " | " (max ~120 chars total). This is NOT a sentence or summary.

Each input row may include a short "hook" field (opening line). Use it as a hint for angle/topic but still read the full "text".

**Angle chips** describe how the post *positions* itself — tone, frame, or tension. Pick only what fits. Examples (mix/match, Title Case each chip):
- Contrarian | Expert vs Beginner
- Controversial | Sacred Cow
- X vs Y (use real poles, e.g. "Inbound vs Outbound")
- Pattern Interrupt | Status Quo
- Polarizing | Tribal
- Anti-hustle | Reframe
- Vulnerable | Personal Stake
- Data-led | Skeptic bait
- Humble brag | Authority
- Timely | Newsjack
- If none apply: "Straight value" or "Observational"

Avoid long prose. No hashtags. Use " | " between chips only.

If the post is mostly image / link with almost no text, infer cautiously; if impossible, core_topic "Low Text Signal" and take "Unknown | Needs media context".`;

  const user = JSON.stringify(rows);

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://local.vantum/linkedin-topics",
      "X-Title": "Vantum LinkedIn topic extract",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.25,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter HTTP ${res.status}: ${err.slice(0, 900)}`);
  }
  const body = await res.json();
  const msg = body?.choices?.[0]?.message?.content;
  if (typeof msg !== "string") throw new Error("OpenRouter: empty content");
  const parsed = JSON.parse(stripJsonFence(msg));
  if (!Array.isArray(parsed)) throw new Error("Expected JSON array from model");
  return parsed;
}

function listSlugDirs(onlySlug) {
  if (!fs.existsSync(DATA)) return [];
  const names = fs
    .readdirSync(DATA, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => n !== "." && n !== "..");
  const filtered = onlySlug
    ? names.filter((n) => n.toLowerCase() === onlySlug.toLowerCase())
    : names;
  return filtered.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

async function processSlug(slug, args, apiKey, model) {
  const cleanPath = path.join(DATA, slug, "posts_clean.json");
  const rawPath = path.join(DATA, slug, "posts_raw.json");
  const srcPath = fs.existsSync(cleanPath) ? cleanPath : rawPath;
  const outPath = path.join(DATA, slug, "posts_topics.json");
  if (!fs.existsSync(srcPath)) {
    console.warn(`Skip ${slug}: missing ${cleanPath} or ${rawPath}`);
    return null;
  }
  if (fs.existsSync(outPath) && !args.force) {
    console.log(`Skip ${slug}: ${outPath} exists (use --force to regenerate)`);
    try {
      return JSON.parse(fs.readFileSync(outPath, "utf8"));
    } catch {
      return null;
    }
  }

  const posts = JSON.parse(fs.readFileSync(srcPath, "utf8"));
  if (!Array.isArray(posts)) {
    console.warn(`Skip ${slug}: source JSON is not an array`);
    return null;
  }

  const items = [];
  const batch = args.batch;

  for (let start = 0; start < posts.length; start += batch) {
    const slice = posts.slice(start, start + batch);
    const rows = slice.map((post, j) => {
      const i = start + j;
      // Prefer full `text` from posts_clean.json; fall back to Apify raw shape.
      const full =
        typeof post.text === "string" && post.text.trim()
          ? post.text
          : getFullPostText(post);
      const text = full.slice(0, args.textCap);
      const hook =
        typeof post.hook === "string" && post.hook.trim()
          ? post.hook.trim()
          : extractOpeningHook(full);
      return {
        i,
        url: String(post.url || ""),
        type: String(post.type || ""),
        hook,
        text,
      };
    });

    console.log(`  ${slug}: batch ${start + 1}-${start + slice.length} / ${posts.length}`);
    const tagged = await openRouterTagBatch(rows, { apiKey, model });
    const byI = new Map();
    for (const row of tagged) {
      if (row && typeof row.i === "number") byI.set(row.i, row);
    }

    for (let j = 0; j < slice.length; j++) {
      const i = start + j;
      const post = slice[j];
      const t = byI.get(i) ?? {};
      const angleRaw = String(t.take ?? t.angle ?? "").trim();
      const hookRow =
        typeof post.hook === "string" && post.hook.trim()
          ? post.hook.trim()
          : extractOpeningHook(
              typeof post.text === "string" && post.text.trim()
                ? post.text
                : getFullPostText(post)
            );
      items.push({
        index: i,
        fingerprint: postFingerprint(post),
        url: String(post.url || ""),
        hook: hookRow,
        core_topic: String(t.core_topic || "").trim() || "Unknown",
        angle: angleRaw,
        take: angleRaw,
      });
    }
  }

  const bundle = {
    slug,
    generated_at: new Date().toISOString(),
    model,
    post_count: posts.length,
    items,
  };
  fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2), "utf8");
  console.log(`  Wrote ${outPath}`);
  return bundle;
}

function buildRollup(bundles) {
  /** slug -> Map topic -> count */
  const perSlug = new Map();
  const global = new Map();
  const globalAngles = new Map();

  function countAngleChips(s) {
    if (!s || typeof s !== "string") return;
    for (const part of s.split("|")) {
      const chip = part.trim();
      if (!chip) continue;
      globalAngles.set(chip, (globalAngles.get(chip) || 0) + 1);
    }
  }

  for (const b of bundles) {
    if (!b?.items) continue;
    const sm = new Map();
    for (const it of b.items) {
      const t = (it.core_topic || "Unknown").trim();
      sm.set(t, (sm.get(t) || 0) + 1);
      global.set(t, (global.get(t) || 0) + 1);
      countAngleChips(it.angle || it.take);
    }
    perSlug.set(b.slug, sm);
  }

  const lines = [];
  lines.push("# Influencer topic rollup");
  lines.push("");
  lines.push(`*Generated: ${new Date().toISOString()}*`);
  lines.push("");
  lines.push("## Global top topics (all influencers)");
  lines.push("");
  const topG = [...global.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
  for (const [topic, n] of topG) {
    lines.push(`- **${topic}** — ${n} posts`);
  }
  lines.push("");
  lines.push("## Global top angle chips (split from `take` / `angle`)");
  lines.push("");
  const topA = [...globalAngles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50);
  for (const [chip, n] of topA) {
    lines.push(`- **${chip}** — ${n}`);
  }
  lines.push("");
  lines.push("## Per influencer (top 15 topics each)");
  lines.push("");

  for (const slug of [...perSlug.keys()].sort()) {
    const sm = perSlug.get(slug);
    const top = [...sm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
    lines.push(`### ${slug}`);
    lines.push("");
    for (const [topic, n] of top) {
      lines.push(`- ${topic} (${n})`);
    }
    lines.push("");
  }

  const out = path.join(DATA, "TOPIC_ROLLUP.md");
  fs.writeFileSync(out, lines.join("\n"), "utf8");
  console.log(`Wrote ${out}`);
}

async function main() {
  loadEnvFromAncestors();
  const args = parseArgs();
  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) {
    console.error("Missing OPENROUTER_API_KEY in .env (Copy Maker root).");
    process.exit(1);
  }
  const model = (
    process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.6"
  ).trim();

  const slugs = listSlugDirs(args.slug);
  if (!slugs.length) {
    console.error("No influencer folders under data/. Run scrape first.");
    process.exit(1);
  }

  const bundles = [];
  for (const slug of slugs) {
    console.log(`Topics + takes: ${slug}`);
    const b = await processSlug(slug, args, apiKey, model);
    if (b) bundles.push(b);
  }

  if (args.rollup && bundles.length) buildRollup(bundles);

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
