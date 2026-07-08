/**
 * Build `posts_clean.json` + `POSTS.md` from existing `posts_raw.json`
 * (strips comment/reaction profile noise; keeps full text + engagement counts).
 *
 *   node scripts/export_posts_readable.mjs
 *   node scripts/export_posts_readable.mjs --slug=adammgrant
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { writeCleanExport } from "./post_normalize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");

function parseArgs() {
  let slug = "";
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--slug=")) slug = a.slice("--slug=".length).trim();
  }
  return { slug };
}

function listSlugDirs(onlySlug) {
  if (!fs.existsSync(DATA)) return [];
  return fs
    .readdirSync(DATA, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => !onlySlug || n.toLowerCase() === onlySlug.toLowerCase())
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function main() {
  const { slug } = parseArgs();
  const slugs = listSlugDirs(slug);
  if (!slugs.length) {
    console.error("No data/<slug>/ folders.");
    process.exit(1);
  }
  for (const s of slugs) {
    const rawPath = path.join(DATA, s, "posts_raw.json");
    if (!fs.existsSync(rawPath)) {
      console.warn(`Skip ${s}: no posts_raw.json`);
      continue;
    }
    const posts = JSON.parse(fs.readFileSync(rawPath, "utf8"));
    const { jsonPath, mdPath, count } = writeCleanExport(path.join(DATA, s), posts, s);
    console.log(`Wrote ${jsonPath} + ${mdPath} (${count} posts)`);
  }
  console.log("Done.");
}

main();
