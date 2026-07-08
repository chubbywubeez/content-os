/**
 * Shared: load posts, unify rows, compute per-creator 5× (or N×) engagement outliers.
 * Used by `build_outliers_report.mjs` and `enrich_outliers_frameworks.mjs`.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  extractEngagement,
  extractOpeningHook,
  getFullPostText,
} from "../post_normalize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const LINKEDIN_ROOT = path.resolve(__dirname, "..", "..");
export const DATA = path.join(LINKEDIN_ROOT, "data");
export const INFLUENCERS_PATH = path.join(LINKEDIN_ROOT, "influencers.json");

/** One logical post row from either classified shape. Includes full `text` for LLM extraction. */
export function unifyPost(post, slugFromDir) {
  const raw = post.raw_item ?? post;
  const eng =
    post.engagement && typeof post.engagement === "object"
      ? {
          numComments: post.engagement.numComments,
          numLikes: post.engagement.numLikes,
          numShares: post.engagement.numShares,
        }
      : extractEngagement(raw);

  const cls = post._classification ?? post;
  const format_level = Array.isArray(cls.format_level) ? cls.format_level : [];
  const structural = Array.isArray(cls.structural) ? cls.structural : [];
  const length_tier = typeof cls.length_tier === "string" ? cls.length_tier : "";
  const char_count =
    typeof cls.char_count === "number"
      ? cls.char_count
      : (getFullPostText(raw) || "").length;

  const text = typeof post.text === "string" ? post.text : getFullPostText(raw);
  const hook =
    typeof post.hook === "string" && post.hook.trim()
      ? post.hook.trim()
      : extractOpeningHook(text);

  const url = String(post.url || raw.url || post.source_url || "").trim();
  const urn = String(post.urn || raw.urn || "").trim();
  const slug = String(post.influencer_slug || slugFromDir || "").trim();

  return {
    slug,
    url,
    urn,
    hook,
    text: text || "",
    textPreview: (text || "").slice(0, 320),
    likes: eng.numLikes,
    comments: eng.numComments,
    shares: eng.numShares,
    format_level,
    structural,
    length_tier,
    char_count,
  };
}

export function meanPositive(nums) {
  const vals = nums.filter((n) => typeof n === "number" && Number.isFinite(n) && n >= 0);
  if (!vals.length) return null;
  const s = vals.reduce((a, b) => a + b, 0);
  return s / vals.length;
}

export function loadPosts(slug) {
  const dir = path.join(DATA, slug);
  const classifiedPath = path.join(dir, "posts_classified.json");
  const cleanPath = path.join(dir, "posts_clean.json");
  if (fs.existsSync(classifiedPath)) {
    return { source: "classified", posts: JSON.parse(fs.readFileSync(classifiedPath, "utf8")) };
  }
  if (fs.existsSync(cleanPath)) {
    return { source: "clean", posts: JSON.parse(fs.readFileSync(cleanPath, "utf8")) };
  }
  return null;
}

/**
 * @param {{ multiplier?: number }} opts
 * @returns {{ multiplier: number, bySlug: object[], allFlat: object[] }}
 */
export function collectOutlierDataset(opts = {}) {
  const multiplier = typeof opts.multiplier === "number" && opts.multiplier > 1 ? opts.multiplier : 5;
  const influencers = JSON.parse(fs.readFileSync(INFLUENCERS_PATH, "utf8"));

  /** @type {object[]} */
  const bySlug = [];

  for (const row of influencers) {
    const slug = row.slug;
    const name = row.name;
    const loaded = loadPosts(slug);
    if (!loaded || !Array.isArray(loaded.posts)) {
      bySlug.push({
        slug,
        name,
        means: { likes: null, comments: null, shares: null },
        n: 0,
        source: null,
        outliers: [],
      });
      continue;
    }

    const rows = loaded.posts.map((p) => unifyPost(p, slug));
    const meanLikes = meanPositive(rows.map((r) => r.likes));
    const meanComments = meanPositive(rows.map((r) => r.comments));
    const meanShares = meanPositive(rows.map((r) => r.shares));

    const outliers = [];
    for (const r of rows) {
      const types = [];
      let likesRatio = null;
      let commentsRatio = null;
      let sharesRatio = null;

      if (meanLikes != null && meanLikes > 0 && typeof r.likes === "number" && r.likes >= multiplier * meanLikes) {
        types.push("likes");
        likesRatio = r.likes / meanLikes;
      }
      if (
        meanComments != null &&
        meanComments > 0 &&
        typeof r.comments === "number" &&
        r.comments >= multiplier * meanComments
      ) {
        types.push("comments");
        commentsRatio = r.comments / meanComments;
      }
      if (meanShares != null && meanShares > 0 && typeof r.shares === "number" && r.shares >= multiplier * meanShares) {
        types.push("shares");
        sharesRatio = r.shares / meanShares;
      }

      if (types.length) {
        outliers.push({
          ...r,
          outlierTypes: types,
          likesRatio,
          commentsRatio,
          sharesRatio,
          maxRatio: Math.max(likesRatio ?? 0, commentsRatio ?? 0, sharesRatio ?? 0),
        });
      }
    }

    outliers.sort((a, b) => b.maxRatio - a.maxRatio);

    bySlug.push({
      slug,
      name,
      means: { likes: meanLikes, comments: meanComments, shares: meanShares },
      n: rows.length,
      source: loaded.source,
      outliers,
    });
  }

  const allFlat = [];
  for (const b of bySlug) {
    for (const o of b.outliers) {
      allFlat.push({ ...o, influencerName: b.name });
    }
  }
  allFlat.sort((a, b) => b.maxRatio - a.maxRatio);

  return { multiplier, bySlug, allFlat };
}
