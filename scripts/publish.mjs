/**
 * 予約投稿スクリプト。
 * posts/queue/ の承認済み下書き(=mainにマージ済み)のうち、
 * scheduled_at を過ぎたものを X / Instagram に投稿する。
 * 投稿済みファイルは posts/published/YYYY-MM/ へ移動する。
 *
 * 必要な環境変数:
 *   X:         X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET
 *   Instagram: IG_USER_ID, IG_ACCESS_TOKEN
 *   DRY_RUN=1 で実際には投稿せずログのみ
 */
import fs from "node:fs";
import path from "node:path";
import settings from "../config/settings.mjs";
import {
  PUBLISHED_DIR,
  listQueueFiles,
  parseDraft,
  serializeDraft,
  splitBody,
  oauth1Header,
} from "./util.mjs";

const DRY_RUN = process.env.DRY_RUN === "1";
const now = new Date();
let hadError = false;

function xCreds() {
  const creds = {
    apiKey: process.env.X_API_KEY,
    apiSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
  };
  if (!creds.apiKey || !creds.apiSecret || !creds.accessToken || !creds.accessSecret) {
    throw new Error("Xの認証情報(X_API_KEY等のSecrets)が設定されていません");
  }
  return creds;
}

async function uploadMediaToX(imagePath, creds) {
  const url = "https://upload.twitter.com/1.1/media/upload.json";
  const form = new FormData();
  form.append(
    "media",
    new Blob([fs.readFileSync(imagePath)]),
    path.basename(imagePath),
  );
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: oauth1Header("POST", url, creds) },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`X media upload ${res.status}: ${JSON.stringify(data)}`);
  }
  return data.media_id_string;
}

async function postToX(text, imagePath) {
  const creds = xCreds();
  const payload = { text };
  if (imagePath) {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`画像ファイルが見つかりません: ${imagePath}`);
    }
    payload.media = { media_ids: [await uploadMediaToX(imagePath, creds)] };
  }
  const url = "https://api.twitter.com/2/tweets";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: oauth1Header("POST", url, creds),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`X API ${res.status}: ${JSON.stringify(data)}`);
  }
  return `https://x.com/i/web/status/${data.data.id}`;
}

async function postToInstagram(caption, imagePath) {
  const userId = process.env.IG_USER_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  if (!userId || !token) {
    throw new Error("Instagramの認証情報(IG_USER_ID / IG_ACCESS_TOKEN)が設定されていません");
  }
  if (!imagePath) {
    throw new Error("Instagram投稿には frontmatter の image が必須です");
  }
  const base = process.env.IMAGE_BASE_URL || settings.imageBaseUrl;
  if (!base) {
    throw new Error("画像URLのベース(settings.imageBaseUrl か IMAGE_BASE_URL)が未設定です");
  }
  const imageUrl = `${base.replace(/\/$/, "")}/${imagePath}`;
  const graph = "https://graph.facebook.com/v21.0";

  const containerRes = await fetch(`${graph}/${userId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      image_url: imageUrl,
      caption,
      access_token: token,
    }),
  });
  const container = await containerRes.json().catch(() => ({}));
  if (!containerRes.ok) {
    throw new Error(`IG media作成 ${containerRes.status}: ${JSON.stringify(container)}`);
  }

  const publishRes = await fetch(`${graph}/${userId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      creation_id: container.id,
      access_token: token,
    }),
  });
  const published = await publishRes.json().catch(() => ({}));
  if (!publishRes.ok) {
    throw new Error(`IG publish ${publishRes.status}: ${JSON.stringify(published)}`);
  }
  return published.id;
}

for (const filePath of listQueueFiles()) {
  let draft;
  try {
    draft = parseDraft(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error(`スキップ(パース失敗): ${filePath}: ${err.message}`);
    hadError = true;
    continue;
  }
  const { meta, body } = draft;
  const scheduledAt = new Date(meta.scheduled_at);
  if (Number.isNaN(scheduledAt.getTime())) {
    console.error(`スキップ(scheduled_at不正): ${filePath}`);
    hadError = true;
    continue;
  }
  if (scheduledAt > now) continue; // まだ時刻前

  const platforms = Array.isArray(meta.platforms) ? meta.platforms : [meta.platforms];
  const texts = splitBody(body);
  let changed = false;

  for (const platform of platforms) {
    if (meta[`posted_${platform}`]) continue; // 再実行時の二重投稿防止
    try {
      if (DRY_RUN) {
        console.log(`[DRY_RUN] ${platform} へ投稿: ${filePath}` + (meta.image ? ` (画像: ${meta.image})` : ""));
        continue;
      }
      if (platform === "x") {
        meta.posted_x = await postToX(texts.x, meta.image);
        console.log(`Xへ投稿完了: ${meta.posted_x}`);
      } else if (platform === "instagram") {
        meta.posted_instagram = await postToInstagram(texts.instagram, meta.image);
        console.log(`Instagramへ投稿完了: ${meta.posted_instagram}`);
      } else {
        throw new Error(`未対応のプラットフォーム: ${platform}`);
      }
      changed = true;
    } catch (err) {
      console.error(`投稿失敗 (${platform}) ${filePath}: ${err.message}`);
      hadError = true;
    }
  }

  if (DRY_RUN) continue;

  const allPosted = platforms.every((p) => meta[`posted_${p}`]);
  if (allPosted) {
    meta.posted_at = new Date().toISOString();
    const monthDir = path.join(PUBLISHED_DIR, meta.scheduled_at.slice(0, 7));
    fs.mkdirSync(monthDir, { recursive: true });
    const dest = path.join(monthDir, path.basename(filePath));
    fs.writeFileSync(dest, serializeDraft(meta, body));
    fs.unlinkSync(filePath);
    console.log(`完了: ${dest} へ移動`);
  } else if (changed) {
    // 一部プラットフォームのみ成功 → 投稿済み記録だけ残してキューに留める
    fs.writeFileSync(filePath, serializeDraft(meta, body));
    console.log(`部分投稿を記録(残りは次回リトライ): ${filePath}`);
  }
}

// 投稿失敗があっても、成功分のファイル移動はコミットさせたいので exit 0。
// 失敗はログで確認できる。
if (hadError) console.error("一部の投稿でエラーが発生しました(ログ参照)");
