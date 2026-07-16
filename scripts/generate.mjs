/**
 * 調査 → 下書き生成スクリプト。
 * Claude (Web検索付き) でテーマの最新動向を調べ、翌日分の投稿下書きを
 * posts/queue/ に書き出す。PR本文は PR_BODY_PATH に出力する。
 *
 * 必要な環境変数: ANTHROPIC_API_KEY
 */
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import settings from "../config/settings.mjs";
import {
  QUEUE_DIR,
  serializeDraft,
  xWeightedLength,
  X_WEIGHT_LIMIT,
  dateInTimezone,
} from "./util.mjs";

const MODEL = process.env.MODEL || "claude-opus-4-8";
const client = new Anthropic();

const targetDate = dateInTimezone(settings.timezone, 1); // 翌日分を生成
const count = Math.min(settings.postsPerDay, settings.slots.length);
const slots = settings.slots.slice(0, count);
const today = dateInTimezone(settings.timezone, 0);

const system = `あなたは日本語SNS運用の専門ライターです。以下のペルソナになりきって投稿文を書きます。

<persona>
${settings.persona}
</persona>

制約:
- 各投稿はX(Twitter)の文字数制限内: 全角換算で135文字以内(URL含む場合はさらに短く)
- 事実は必ずWeb検索で確認した情報に基づくこと。憶測でニュースを書かない
- ハッシュタグは ${settings.hashtags.join(" ")} から0〜2個
- 宣伝臭・煽りは禁止。読んだ人が1つ持ち帰れる具体性を入れる`;

const prompt = `今日は${today}です。以下のテーマについてWeb検索で最新の動向・ニュースを調査し、${targetDate}に投稿するSNS下書きを${count}件作成してください。

テーマ:
${settings.topics.map((t) => `- ${t}`).join("\n")}

${count}件はそれぞれ別の切り口にしてください(ニュース紹介 / 実践Tips / 考察など)。

最後に、次のJSON配列だけを \`\`\`json コードブロックで出力してください:
[
  {
    "theme": "投稿の切り口の一言説明",
    "text": "投稿本文(改行は\\n)",
    "image_idea": "Instagramに転用する場合の画像案(任意)"
  }
]`;

console.log(`モデル: ${MODEL} / 生成対象日: ${targetDate} (${count}件)`);

let messages = [{ role: "user", content: prompt }];
let response;
for (let attempt = 0; attempt < 6; attempt++) {
  response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
    messages,
  });
  if (response.stop_reason !== "pause_turn") break;
  // サーバー側ツールのループ上限に達した場合は続きを再要求する
  messages = [...messages, { role: "assistant", content: response.content }];
}

if (response.stop_reason === "refusal") {
  console.error("リクエストが拒否されました:", response.stop_details);
  process.exit(1);
}

const fullText = response.content
  .filter((b) => b.type === "text")
  .map((b) => b.text)
  .join("\n");

const jsonMatch =
  fullText.match(/```json\s*([\s\S]*?)```/) || fullText.match(/(\[[\s\S]*\])/);
if (!jsonMatch) {
  console.error("応答からJSONを抽出できませんでした:\n", fullText);
  process.exit(1);
}
const drafts = JSON.parse(jsonMatch[1]);

fs.mkdirSync(QUEUE_DIR, { recursive: true });
const created = [];
for (let i = 0; i < Math.min(drafts.length, slots.length); i++) {
  const draft = drafts[i];
  const slot = slots[i];
  const weighted = xWeightedLength(draft.text);
  if (weighted > X_WEIGHT_LIMIT) {
    console.warn(
      `警告: ${slot} の下書きがX上限超過 (${weighted}/${X_WEIGHT_LIMIT})。PRで要修正。`,
    );
  }
  const filename = `${targetDate}-${slot.replace(":", "")}.md`;
  const filePath = path.join(QUEUE_DIR, filename);
  const meta = {
    platforms: settings.defaultPlatforms,
    scheduled_at: `${targetDate}T${slot}:00${settings.timezone}`,
  };
  fs.writeFileSync(filePath, serializeDraft(meta, draft.text.trim()));
  created.push({ ...draft, slot, filePath, weighted });
  console.log(`作成: ${filePath} (${weighted}/${X_WEIGHT_LIMIT})`);
}

if (created.length === 0) {
  console.error("下書きが1件も生成されませんでした");
  process.exit(1);
}

const prBody = [
  `## ${targetDate} の投稿下書き (${created.length}件)`,
  "",
  "このPRを **Merge すると承認** となり、予約時刻に自動投稿されます。",
  "文面を直したい場合はこのブランチのファイルを編集してからMergeしてください。却下はClose。",
  "",
  ...created.flatMap((d) => [
    `### ${d.slot} — ${d.theme}`,
    "",
    "```",
    d.text,
    "```",
    "",
    `- 文字数(X換算): ${d.weighted}/${X_WEIGHT_LIMIT}`,
    d.image_idea ? `- 画像案(Instagram転用時): ${d.image_idea}` : "",
    `- ファイル: \`${d.filePath}\``,
    "",
  ]),
].join("\n");

const prBodyPath = process.env.PR_BODY_PATH;
if (prBodyPath) {
  fs.writeFileSync(prBodyPath, prBody);
  console.log(`PR本文を書き出し: ${prBodyPath}`);
}
