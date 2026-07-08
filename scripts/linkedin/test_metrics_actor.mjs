/**
 * One-off: call Apify actor `iron-crawler/linkedin-post-metrics-scraper` with a
 * single post URL and print the first dataset row (views/impressions if present).
 *
 *   node scripts/test_metrics_actor.mjs
 *   node scripts/test_metrics_actor.mjs --url=https://www.linkedin.com/posts/...
 */

import { ApifyClient } from "apify-client";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LINKEDIN_ROOT = path.resolve(__dirname, "..");
const COPY_MAKER_ROOT = path.resolve(LINKEDIN_ROOT, "..");

function loadEnvFromAncestors() {
  for (const dir of [LINKEDIN_ROOT, COPY_MAKER_ROOT, path.join(COPY_MAKER_ROOT, "..")]) {
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
  let url = "";
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--url=")) url = a.slice("--url=".length).trim();
  }
  return { url };
}

const DEFAULT_TEST_URL =
  "https://www.linkedin.com/posts/george-mack_the-high-agency-triangle-activity-7399873166883409920-9cM7";

async function tryCall(client, actorId, input, label) {
  console.log(`\n--- ${label} ---\ninput: ${JSON.stringify(input)}`);
  const run = await client.actor(actorId).call(input, { waitSecs: 180 });
  const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 5 });
  console.log(`run: ${run.status}  dataset: ${run.defaultDatasetId}  items: ${items.length}`);
  if (!items.length) {
    console.log("(no items)");
    return null;
  }
  console.log(JSON.stringify(items[0], null, 2));
  return items[0];
}

async function main() {
  loadEnvFromAncestors();
  const { url: urlArg } = parseArgs();
  const testUrl = urlArg || DEFAULT_TEST_URL;

  const token = (process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN || "").trim();
  if (!token) {
    console.error("Missing APIFY_TOKEN (or APIFY_API_TOKEN) in .env.");
    process.exit(1);
  }

  const client = new ApifyClient({ token });
  const actorId = "iron-crawler/linkedin-post-metrics-scraper";

  try {
    await tryCall(client, actorId, { linkedin_url: testUrl }, "linkedin_url (schema)");
  } catch (e) {
    console.warn("linkedin_url failed:", e.message);
    try {
      await tryCall(client, actorId, { post_urls: [testUrl] }, "post_urls (readme)");
    } catch (e2) {
      console.error("post_urls failed:", e2.message);
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
