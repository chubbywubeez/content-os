/**
 * Turn noisy Apify `posts_raw.json` rows into **posts_clean** records:
 * full post text, engagement counts only (no commenter / reactor profiles),
 * and indexed media with simple categories.
 */

import fs from "node:fs";
import path from "node:path";

import { extractPostText, postFingerprint } from "./post_text.mjs";

/** Full caption: repost / activity line + body when present. */
export function getFullPostText(raw) {
  const body = extractPostText(raw);
  const act = typeof raw.activityDescription === "string" ? raw.activityDescription.trim() : "";
  if (act && raw.isActivity) {
    return body ? `${act}\n\n${body}` : act;
  }
  return body;
}

/** First scalar from candidates: numbers or numeric strings (handles "1,234"). */
function pickFirstFiniteNumber(...candidates) {
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) return c;
    if (typeof c === "string") {
      const t = c.trim().replace(/,/g, "");
      if (/^\d+$/.test(t)) return parseInt(t, 10);
      if (/^\d+\.\d+$/.test(t)) return Math.round(parseFloat(t));
    }
  }
  return null;
}

/**
 * Opening "hook" line(s) for copy mining: first substantive line(s) of the body.
 * Strips the common "X reposted this" lead-in so the hook reflects the actual post copy.
 */
export function extractOpeningHook(fullText) {
  let t = String(fullText || "").trim();
  if (!t) return "";
  // Drop LinkedIn repost banner when it is followed by the real post body.
  if (/^[^\n]{1,160}\sreposted this\n\n/i.test(t)) {
    t = t.replace(/^[^\n]+\sreposted this\n\n/i, "").trim();
  }
  const paragraphs = t
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const head = paragraphs[0] || t;
  const lines = head.split(/\n/).map((l) => l.trim()).filter(Boolean);
  let hook = lines[0] || "";
  // Very short first line (e.g. "So:") — grab the next line too.
  if (hook.length < 36 && lines.length > 1) {
    hook = `${hook} ${lines[1]}`.trim();
  }
  if (!hook) hook = head.slice(0, 200);
  const max = 240;
  if (hook.length > max) {
    const sliced = hook.slice(0, max);
    const sp = sliced.lastIndexOf(" ");
    hook = `${(sp > 100 ? sliced.slice(0, sp) : sliced).trim()}…`;
  }
  return hook;
}

/**
 * Likes / comments / shares / views / impressions — never embed who reacted or commented.
 * We do **not** use `reactions.length` as likes: with deep scrape that array is a sample of
 * reactors, not the total like count (use `numLikes` from the actor when present).
 */
export function extractEngagement(raw) {
  const nested =
    raw.engagement ||
    raw.engagementStats ||
    raw.socialStats ||
    raw.socialActivityCounts ||
    raw.stats ||
    raw.analytics ||
    {};

  const numComments = pickFirstFiniteNumber(
    raw.numComments,
    raw.commentCount,
    nested.numComments,
    nested.commentCount,
    Array.isArray(raw.comments) ? raw.comments.length : undefined
  );

  const numLikes = pickFirstFiniteNumber(
    raw.numLikes,
    raw.likeCount,
    raw.totalLikeCount,
    raw.reactionsCount,
    raw.totalReactionCount,
    nested.numLikes,
    nested.likeCount,
    nested.totalReactions
  );

  const numShares = pickFirstFiniteNumber(
    raw.numShares,
    raw.shareCount,
    raw.repostsCount,
    nested.numShares,
    nested.shareCount
  );

  const numImpressions = pickFirstFiniteNumber(
    raw.numImpressions,
    raw.impressions,
    raw.impressionCount,
    raw.totalImpressions,
    raw.feedImpressions,
    nested.numImpressions,
    nested.impressions,
    raw.socialActivityCounts?.numImpressions,
    raw.stats?.impressions,
    raw.analytics?.impressions,
    raw.videoAnalytics?.impressions
  );

  const numViews = pickFirstFiniteNumber(
    raw.numViews,
    raw.viewCount,
    raw.views,
    raw.totalViews,
    raw.videoViewCount,
    raw.playCount,
    nested.numViews,
    nested.views,
    nested.viewCount,
    raw.stats?.views,
    raw.linkedinVideo?.numViews,
    raw.linkedinVideo?.viewCount,
    raw.videoPlayMetadata?.viewCount
  );

  return { numComments, numLikes, numShares, numViews, numImpressions };
}

/**
 * Indexed media with coarse category for creative reference.
 * Does not download binaries — URLs only.
 */
export function buildMediaIndex(raw) {
  const slots = [];
  const t = String(raw.type || "").toLowerCase();

  if (Array.isArray(raw.images) && raw.images.length) {
    const multi = raw.images.length > 1;
    raw.images.forEach((url, i) => {
      slots.push({
        index: slots.length + 1,
        category: multi ? "carousel_image" : "single_image",
        url: String(url),
      });
    });
  }

  if (t.includes("video") && raw.linkedinVideo?.videoPlayMetadata?.thumbnail) {
    const th = raw.linkedinVideo.videoPlayMetadata.thumbnail;
    const root = th.rootUrl || "";
    const art = Array.isArray(th.artifacts) ? th.artifacts[0] : null;
    const seg = art?.fileIdentifyingUrlPathSegment;
    const thumbUrl = root && seg ? `${root}${seg}` : null;
    slots.push({
      index: slots.length + 1,
      category: "linkedin_native_video",
      thumbnail_url: thumbUrl,
      note: "Primary post is video; full text is the caption in `text`.",
    });
  }

  return slots;
}

/** One clean row per Apify item (same array order as scrape). */
export function normalizePost(raw) {
  const text = getFullPostText(raw);
  const eng = extractEngagement(raw);
  const hook = extractOpeningHook(text);
  return {
    fingerprint: postFingerprint(raw),
    url: String(raw.url || ""),
    urn: String(raw.urn || ""),
    type: String(raw.type || ""),
    timeSincePosted: String(raw.timeSincePosted || ""),
    postedAtISO: String(raw.postedAtISO || ""),
    isActivity: Boolean(raw.isActivity),
    hook,
    text,
    engagement: {
      numComments: eng.numComments,
      numLikes: eng.numLikes,
      numShares: eng.numShares,
      numViews: eng.numViews,
      numImpressions: eng.numImpressions,
    },
    media: buildMediaIndex(raw),
  };
}

export function normalizeAllPosts(rawPosts) {
  if (!Array.isArray(rawPosts)) return [];
  return rawPosts.map(normalizePost);
}

/** Write `posts_clean.json` + `POSTS.md` under `slugDir`. */
export function writeCleanExport(slugDir, rawPosts, slugLabel) {
  const clean = normalizeAllPosts(rawPosts);
  const jsonPath = path.join(slugDir, "posts_clean.json");
  fs.writeFileSync(jsonPath, JSON.stringify(clean, null, 2), "utf8");

  const lines = [
    `# ${slugLabel} — posts (clean export)`,
    "",
    "*Full post text, opening **hook**, engagement counts, indexed media. No comment bodies or reactor profiles.*",
    "",
    "---",
    "",
  ];

  clean.forEach((p, i) => {
    lines.push(`## Post ${i + 1}`);
    lines.push("");
    lines.push(`- **URL:** ${p.url}`);
    lines.push(`- **Type:** ${p.type}`);
    lines.push(`- **When:** ${p.timeSincePosted || p.postedAtISO || "—"}`);
    lines.push(`- **Activity / repost:** ${p.isActivity ? "yes" : "no"}`);
    lines.push(
      `- **Comments:** ${p.engagement.numComments ?? "—"} · **Likes:** ${p.engagement.numLikes ?? "—"} · **Shares:** ${p.engagement.numShares ?? "—"} · **Views:** ${p.engagement.numViews ?? "—"} · **Impressions:** ${p.engagement.numImpressions ?? "—"}`
    );
    lines.push("");
    if (p.hook) {
      lines.push("### Hook");
      lines.push("");
      lines.push(p.hook);
      lines.push("");
    }
    if (p.media.length) {
      lines.push("### Media (indexed)");
      lines.push("");
      p.media.forEach((m) => {
        const u = m.thumbnail_url || m.url;
        if (u) lines.push(`- **#${m.index}** [${m.category}](${u})`);
        else lines.push(`- **#${m.index}** _${m.category}_ — ${m.note || ""}`);
      });
      lines.push("");
    }
    lines.push("### Full post text");
    lines.push("");
    lines.push(p.text || "_(empty)_");
    lines.push("");
    lines.push("---");
    lines.push("");
  });

  const mdPath = path.join(slugDir, "POSTS.md");
  fs.writeFileSync(mdPath, lines.join("\n"), "utf8");
  return { jsonPath, mdPath, count: clean.length };
}
