import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const QUEUE_DIR = "posts/queue";
export const PUBLISHED_DIR = "posts/published";

/**
 * 下書きファイル(frontmatter + 本文)をパースする。
 * frontmatter は `key: value` の1行形式のみ対応(値が [a, b] なら配列)。
 */
export function parseDraft(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error("frontmatter (--- ... ---) が見つかりません");
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    meta[kv[1]] = value;
  }
  return { meta, body: m[2].trim() };
}

export function serializeDraft(meta, body) {
  const lines = [];
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || value === null || value === "") continue;
    lines.push(
      Array.isArray(value) ? `${key}: [${value.join(", ")}]` : `${key}: ${value}`,
    );
  }
  return `---\n${lines.join("\n")}\n---\n\n${body}\n`;
}

export function listQueueFiles(dir = QUEUE_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => path.join(dir, f));
}

/**
 * X の重み付き文字数。上限は280。
 * CJK など全角文字は2、ASCII等は1でカウント。URLは一律23。
 */
export function xWeightedLength(text) {
  const LIGHT_RANGES = [
    [0, 4351],
    [8192, 8205],
    [8208, 8223],
    [8242, 8247],
  ];
  const normalized = text.replace(/https?:\/\/\S+/g, "u".repeat(23));
  let length = 0;
  for (const ch of normalized) {
    const cp = ch.codePointAt(0);
    length += LIGHT_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi) ? 1 : 2;
  }
  return length;
}

export const X_WEIGHT_LIMIT = 280;

function pctEncode(s) {
  return encodeURIComponent(s).replace(
    /[!*'()]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

/**
 * X API v2 用の OAuth 1.0a Authorization ヘッダーを生成する。
 * JSONボディのリクエストでは oauth_* パラメータのみが署名対象。
 */
export function oauth1Header(method, url, creds) {
  const params = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };
  const paramString = Object.keys(params)
    .sort()
    .map((k) => `${pctEncode(k)}=${pctEncode(params[k])}`)
    .join("&");
  const baseString = [
    method.toUpperCase(),
    pctEncode(url),
    pctEncode(paramString),
  ].join("&");
  const signingKey = `${pctEncode(creds.apiSecret)}&${pctEncode(creds.accessSecret)}`;
  params.oauth_signature = crypto
    .createHmac("sha1", signingKey)
    .update(baseString)
    .digest("base64");
  return (
    "OAuth " +
    Object.keys(params)
      .sort()
      .map((k) => `${pctEncode(k)}="${pctEncode(params[k])}"`)
      .join(", ")
  );
}

/** JST(またはsettings.timezone)での日付文字列 YYYY-MM-DD を返す */
export function dateInTimezone(offset, addDays = 0) {
  const offsetMs =
    (offset.startsWith("-") ? -1 : 1) *
    (parseInt(offset.slice(1, 3), 10) * 60 + parseInt(offset.slice(4, 6), 10)) *
    60_000;
  const d = new Date(Date.now() + offsetMs + addDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}
