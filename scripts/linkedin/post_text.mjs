/**
 * Shared: pull main post body from Apify linkedin-post items (field names vary).
 */

export function extractPostText(item) {
  const tryKeys = [
    "text",
    "content",
    "postText",
    "message",
    "description",
    "articleBody",
    "body",
  ];
  for (const k of tryKeys) {
    if (typeof item[k] === "string" && item[k].trim()) return item[k].trim();
  }
  if (item.post && typeof item.post.text === "string")
    return item.post.text.trim();
  if (item.text && typeof item.text === "object" && item.text.text)
    return String(item.text.text).trim();
  return "";
}

export function postFingerprint(item) {
  return String(item.urn || item.url || item.shareUrn || "").trim();
}
