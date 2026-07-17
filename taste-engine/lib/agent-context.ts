import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { telegramOwners, weeklyReports } from "../db/schema";
import { getWeeklyContext } from "./weekly";

// Snapshot of the owner's taste + knowledge, shaped for consumption by coding
// agents (Claude Code / Codex) working in other projects. Markdown is the
// primary format so the document can be dropped in as TASTE.md.

export type AgentContext = {
  generatedAt: string;
  ownerId: string;
  profile: {
    weekKey: string;
    summary: string;
    observation: string;
    question: string;
  } | null;
  tasteSignals: Array<{
    savedAt: string;
    sourceType: string;
    title: string;
    likedAspect?: string;
    intent?: string;
    caption?: string;
    sourceUrl?: string;
  }>;
  knowledge: Array<{
    savedAt: string;
    title: string;
    note?: string;
    sourceUrl?: string;
  }>;
  feedback: Array<{
    reaction: string;
    category: string;
    title: string;
    reason: string;
  }>;
};

function clip(value: string | undefined, max: number) {
  if (!value) return undefined;
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export async function getPrimaryOwnerId(): Promise<string | null> {
  const [owner] = await getDb()
    .select({ ownerId: telegramOwners.telegramUserId })
    .from(telegramOwners)
    .limit(1);
  return owner?.ownerId ?? null;
}

export async function buildAgentContext(ownerId: string): Promise<AgentContext> {
  const db = getDb();
  const context = await getWeeklyContext(ownerId);
  const [latestReport] = await db
    .select()
    .from(weeklyReports)
    .where(and(eq(weeklyReports.ownerId, ownerId), eq(weeklyReports.status, "sent")))
    .orderBy(desc(weeklyReports.weekKey), desc(weeklyReports.id))
    .limit(1);

  return {
    generatedAt: new Date().toISOString(),
    ownerId,
    profile: latestReport
      ? {
          weekKey: latestReport.weekKey,
          summary: latestReport.profileSummary,
          observation: latestReport.observation,
          question: latestReport.question,
        }
      : null,
    tasteSignals: context.entries.slice(0, 30).map((entry) => ({
      savedAt: entry.savedAt,
      sourceType: entry.sourceType,
      title: clip(entry.title, 120) ?? "(無題)",
      likedAspect: entry.likedAspect,
      intent: entry.intent,
      caption: clip(entry.caption, 200),
      sourceUrl: entry.sourceUrl,
    })),
    knowledge: context.knowledgeEntries.slice(0, 30).map((entry) => ({
      savedAt: entry.savedAt,
      title: clip(entry.title, 120) ?? "(無題)",
      note: clip(entry.note, 300),
      sourceUrl: entry.sourceUrl,
    })),
    feedback: context.priorFeedback.slice(0, 20).map((item) => ({
      reaction: item.reaction,
      category: item.category,
      title: clip(item.title, 120) ?? "(無題)",
      reason: clip(item.reason, 200) ?? "",
    })),
  };
}

export function renderAgentContextMarkdown(context: AgentContext): string {
  const lines: string[] = [
    "# Taste Context — 本人の嗜好コンテキスト",
    "",
    `> Taste Engine(Telegram経由の嗜好・知識収集ハブ)のスナップショット。生成: ${context.generatedAt}`,
    "",
    "## エージェント向けの使い方",
    "",
    "- デザイン・写真・文章・UIなど、見た目や表現の判断が必要な場面では、このコンテキストを判断基準として参照すること。",
    "- 「取り込んだ知識」は本人が参考として保存した考え方であり、本人の好みそのものとして扱わないこと。",
    "- データが少ない領域について断定しないこと。タスク側の明示的な要求と嗜好が衝突する場合は要求を優先し、その旨を一言添えること。",
    "- 嗜好は固定ではない。「推薦への反応」は好みの境界を示すので、『違う』とされた方向への提案は避けること。",
    "",
  ];

  if (context.profile) {
    lines.push(`## 現在の好みプロフィール(${context.profile.weekKey}週の分析)`, "", context.profile.summary, "");
    if (context.profile.observation) {
      lines.push("### 直近の変化・仮説", "", context.profile.observation, "");
    }
    if (context.profile.question) {
      lines.push("### 本人がいま検討中の問い", "", context.profile.question, "");
    }
  } else {
    lines.push(
      "## 現在の好みプロフィール",
      "",
      "(まだ週次分析が生成されていません。以下の生シグナルから慎重に読み取ってください。)",
      "",
    );
  }

  if (context.tasteSignals.length) {
    lines.push("## 好みのシグナル(新しい順・本人の回答つき)", "");
    for (const signal of context.tasteSignals) {
      const parts = [
        `**${signal.title}**`,
        signal.likedAspect ? `好きな点: ${signal.likedAspect}` : undefined,
        signal.intent ? `距離感: ${signal.intent}` : undefined,
        signal.caption ? `メモ: ${signal.caption}` : undefined,
        signal.sourceUrl,
      ].filter(Boolean);
      lines.push(`- [${signal.sourceType}] ${parts.join(" — ")}`);
    }
    lines.push("");
  }

  if (context.knowledge.length) {
    lines.push("## 取り込んだ知識(本人の持ち帰りメモ)", "");
    for (const entry of context.knowledge) {
      const parts = [
        `**${entry.title}**`,
        entry.note ? `「${entry.note}」` : undefined,
        entry.sourceUrl,
      ].filter(Boolean);
      lines.push(`- ${parts.join(" — ")}`);
    }
    lines.push("");
  }

  if (context.feedback.length) {
    lines.push("## 推薦への反応(好みの境界)", "");
    for (const item of context.feedback) {
      lines.push(`- ${item.reaction}［${item.category}］ ${item.title} — ${item.reason}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
