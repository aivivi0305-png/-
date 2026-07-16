/**
 * 写真キャプション生成スクリプト。
 * photos/inbox/ の写真をAIが見てキャプション下書きを作り、
 * リサイズ済み画像を images/YYYY-MM/ へ、下書きを posts/queue/ へ書き出す。
 * 処理済みの写真は inbox から削除する(コミットは呼び出し元のワークフローが行う)。
 *
 * 必要な環境変数: ANTHROPIC_API_KEY
 */
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import settings from "../config/settings.mjs";
import {
  QUEUE_DIR,
  listQueueFiles,
  parseDraft,
  serializeDraft,
  nextFreeSlots,
  xWeightedLength,
  X_WEIGHT_LIMIT,
} from "./util.mjs";

const INBOX_DIR = "photos/inbox";
const IMAGES_DIR = "images";
const SUPPORTED = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

const MODEL = process.env.MODEL || "claude-opus-4-8";
const client = new Anthropic();

const inboxFiles = fs.existsSync(INBOX_DIR)
  ? fs.readdirSync(INBOX_DIR).filter((f) => !f.startsWith(".")).sort()
  : [];

if (inboxFiles.length === 0) {
  console.log("photos/inbox/ に写真がありません。終了します。");
  process.exit(0);
}

// 既存キューの予約時刻を集めて、空いている枠に順番に割り当てる
const existing = listQueueFiles().map(
  (f) => parseDraft(fs.readFileSync(f, "utf8")).meta.scheduled_at,
);
const photos = inboxFiles.filter((f) => SUPPORTED[path.extname(f).toLowerCase()]);
for (const f of inboxFiles) {
  if (!SUPPORTED[path.extname(f).toLowerCase()]) {
    console.warn(`スキップ(未対応形式): ${f} — JPEG/PNG/WebPのみ対応(DNG等のRAWは書き出してから置いてください)`);
  }
}
const slots = nextFreeSlots(photos.length, settings, existing);

const system = `あなたは写真SNSアカウントのキャプションライターです。以下のペルソナ・スタイルで書きます。

<persona>
${settings.persona}
</persona>

<photo_style>
${settings.photo.style}
</photo_style>

制約:
- X用キャプションは全角換算135文字以内(ハッシュタグ込み)
- Instagram用は少し長めでもよい(300文字以内)
- ハッシュタグは ${settings.photo.hashtags.join(" ")} から0〜3個
- 写真に写っていないものを書かない`;

const created = [];
for (let i = 0; i < photos.length; i++) {
  const filename = photos[i];
  const srcPath = path.join(INBOX_DIR, filename);
  const slot = slots[i];
  console.log(`処理中: ${srcPath} → ${slot.scheduled_at}`);

  // 長辺 maxEdge px に縮小(小さい画像は拡大しない)して JPEG 化
  const resized = await sharp(path.resolve(srcPath))
    .rotate() // EXIFの回転を反映
    .resize({ width: settings.photo.maxEdge, height: settings.photo.maxEdge, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: resized.toString("base64") },
          },
          {
            type: "text",
            text: `この写真の投稿キャプションを作ってください。次のJSONだけを \`\`\`json コードブロックで出力:
{
  "caption_x": "X用キャプション(改行は\\n)",
  "caption_instagram": "Instagram用キャプション",
  "slug": "ファイル名に使う英小文字ケバブケースの短い説明 (例: dusk-riverside)"
}`,
          },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    console.error(`キャプション生成が拒否されました: ${srcPath}`, response.stop_details);
    continue;
  }
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  if (!m) {
    console.error(`JSONを抽出できませんでした: ${srcPath}\n${text}`);
    continue;
  }
  const caption = JSON.parse(m[1]);

  const weighted = xWeightedLength(caption.caption_x);
  if (weighted > X_WEIGHT_LIMIT) {
    console.warn(`警告: X文字数超過 (${weighted}/${X_WEIGHT_LIMIT})。PRで要修正。`);
  }

  // リサイズ画像を images/YYYY-MM/ へ保存し、inboxの元ファイルを削除
  const month = slot.date.slice(0, 7);
  const slug = (caption.slug || "photo").replace(/[^a-z0-9-]/g, "").slice(0, 40) || "photo";
  const imageRel = path.join(IMAGES_DIR, month, `${slot.date}-${slug}.jpg`);
  fs.mkdirSync(path.dirname(imageRel), { recursive: true });
  fs.writeFileSync(imageRel, resized);
  fs.unlinkSync(srcPath);

  // 下書きを作成(X用とInstagram用をマーカーで分ける)
  const body =
    settings.photo.platforms.includes("instagram") &&
    caption.caption_instagram &&
    caption.caption_instagram !== caption.caption_x
      ? `${caption.caption_x.trim()}\n\n<!-- instagram -->\n\n${caption.caption_instagram.trim()}`
      : caption.caption_x.trim();

  const draftPath = path.join(QUEUE_DIR, `${slot.date}-${slot.slot.replace(":", "")}-photo.md`);
  fs.mkdirSync(QUEUE_DIR, { recursive: true });
  fs.writeFileSync(
    draftPath,
    serializeDraft(
      { platforms: settings.photo.platforms, scheduled_at: slot.scheduled_at, image: imageRel },
      body,
    ),
  );
  created.push({ srcName: filename, draftPath, imageRel, caption, slot, weighted });
  console.log(`作成: ${draftPath} (画像: ${imageRel}, ${weighted}/${X_WEIGHT_LIMIT})`);
}

if (created.length === 0) {
  console.error("キャプションを1件も生成できませんでした");
  process.exit(1);
}

const prBody = [
  `## 📷 写真投稿の下書き (${created.length}件)`,
  "",
  "このPRを **Merge すると承認** となり、予約時刻に画像付きで自動投稿されます。",
  "キャプションを直したい場合はこのブランチのファイルを編集してからMergeしてください。",
  "",
  ...created.flatMap((c) => [
    `### ${c.slot.scheduled_at} — ${c.srcName}`,
    "",
    `- 画像: \`${c.imageRel}\`(PRの Files changed タブでプレビューできます)`,
    "",
    "```",
    c.caption.caption_x,
    "```",
    "",
    `- 文字数(X換算): ${c.weighted}/${X_WEIGHT_LIMIT}`,
    `- ファイル: \`${c.draftPath}\``,
    "",
  ]),
].join("\n");

if (process.env.PR_BODY_PATH) {
  fs.writeFileSync(process.env.PR_BODY_PATH, prBody);
  console.log(`PR本文を書き出し: ${process.env.PR_BODY_PATH}`);
}
