/**
 * 下書きの検証スクリプト(PRのCIで実行)。
 * posts/queue/ の全ファイルをチェックし、問題があれば exit 1。
 */
import fs from "node:fs";
import {
  listQueueFiles,
  parseDraft,
  splitBody,
  xWeightedLength,
  X_WEIGHT_LIMIT,
} from "./util.mjs";

const SUPPORTED_PLATFORMS = ["x", "instagram"];
const errors = [];

for (const filePath of listQueueFiles()) {
  const label = filePath;
  let draft;
  try {
    draft = parseDraft(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    errors.push(`${label}: ${err.message}`);
    continue;
  }
  const { meta, body } = draft;

  if (!body) errors.push(`${label}: 本文が空です`);

  const platforms = Array.isArray(meta.platforms)
    ? meta.platforms
    : meta.platforms
      ? [meta.platforms]
      : [];
  if (platforms.length === 0) {
    errors.push(`${label}: platforms が未設定です`);
  }
  for (const p of platforms) {
    if (!SUPPORTED_PLATFORMS.includes(p)) {
      errors.push(`${label}: 未対応のプラットフォーム "${p}"`);
    }
  }

  if (!meta.scheduled_at || Number.isNaN(new Date(meta.scheduled_at).getTime())) {
    errors.push(`${label}: scheduled_at が不正です (例: 2026-07-21T12:00:00+09:00)`);
  }

  const texts = splitBody(body);

  if (platforms.includes("x")) {
    const weighted = xWeightedLength(texts.x);
    if (weighted > X_WEIGHT_LIMIT) {
      errors.push(`${label}: X文字数超過 (${weighted}/${X_WEIGHT_LIMIT})`);
    }
  }

  if (platforms.includes("instagram") && !meta.image) {
    errors.push(`${label}: Instagram投稿には image が必須です`);
  }

  if (meta.image && !fs.existsSync(meta.image)) {
    errors.push(`${label}: 画像ファイルが存在しません: ${meta.image}`);
  }
}

if (errors.length > 0) {
  console.error("❌ 下書きの検証に失敗しました:\n");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("✅ すべての下書きが有効です");
