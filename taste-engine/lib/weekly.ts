import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  tasteEntries,
  telegramOwners,
  weeklyRecommendations,
  weeklyReports,
} from "../db/schema";
import { sendTelegramMessage, type TelegramButton } from "./telegram";

export type WeeklyCategory = "close" | "edge" | "wildcard";
export type WeeklyKind = "site" | "article" | "inspiration";

export type WeeklyDraft = {
  profileSummary: string;
  observation: string;
  recommendations: Array<{
    category: WeeklyCategory;
    kind: WeeklyKind;
    title: string;
    url: string;
    description: string;
    reason: string;
  }>;
  question: string;
};

export type WeeklyRunResult = {
  status: "sent" | "resent" | "already_sent" | "generating" | "not_enough";
  reportId?: number;
  completedEntries?: number;
  requiredEntries?: number;
};

const aspectLabels: Record<string, string> = {
  whole: "全体",
  color: "色",
  composition: "構図",
  type: "文字",
  texture: "質感",
  mood: "雰囲気",
  content: "内容",
  visual: "見た目",
  both: "内容と見た目の両方",
  curious: "なぜか気になる",
};

const intentLabels: Record<string, string> = {
  use: "自分でも使いたい",
  view: "見るのが好き",
  reference: "制作の参考",
  unusual: "普段と違うが気になる",
};

const categoryLabels: Record<WeeklyCategory, string> = {
  close: "本命",
  edge: "少し外側",
  wildcard: "意外枠",
};

const kindLabels: Record<WeeklyKind, string> = {
  site: "サイト",
  article: "情報・記事",
  inspiration: "インスピレーション",
};

function truncate(value: string, max: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function getJstWeekKey(now = new Date()) {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = jst.getUTCDay();
  const distanceFromMonday = day === 0 ? 6 : day - 1;
  jst.setUTCDate(jst.getUTCDate() - distanceFromMonday);
  return jst.toISOString().slice(0, 10);
}

function safeAnalysis(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function knowledgeNote(value: string) {
  const analysis = safeAnalysis(value) as { knowledgeNote?: unknown } | undefined;
  return typeof analysis?.knowledgeNote === "string" ? analysis.knowledgeNote : undefined;
}

export function validateWeeklyDraft(value: unknown): WeeklyDraft {
  if (!value || typeof value !== "object") throw new Error("Weekly report JSON was invalid.");
  const draft = value as Partial<WeeklyDraft>;
  if (
    typeof draft.profileSummary !== "string" ||
    typeof draft.observation !== "string" ||
    typeof draft.question !== "string" ||
    !Array.isArray(draft.recommendations) ||
    draft.recommendations.length !== 5
  ) {
    throw new Error("Weekly report was incomplete.");
  }

  const recommendations = draft.recommendations.map((item) => {
    if (!item || typeof item !== "object") throw new Error("A weekly recommendation was invalid.");
    const candidate = item as WeeklyDraft["recommendations"][number];
    if (
      !["close", "edge", "wildcard"].includes(candidate.category) ||
      !["site", "article", "inspiration"].includes(candidate.kind) ||
      !candidate.title ||
      !candidate.url ||
      !candidate.description ||
      !candidate.reason
    ) {
      throw new Error("A weekly recommendation was incomplete.");
    }
    const url = new URL(candidate.url);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("A weekly recommendation URL was invalid.");
    }
    return { ...candidate, url: url.toString() };
  });

  const categoryCounts = recommendations.reduce<Record<string, number>>((counts, item) => {
    counts[item.category] = (counts[item.category] ?? 0) + 1;
    return counts;
  }, {});
  if (categoryCounts.close !== 2 || categoryCounts.edge !== 2 || categoryCounts.wildcard !== 1) {
    throw new Error("Weekly recommendation balance was invalid.");
  }

  return {
    profileSummary: draft.profileSummary,
    observation: draft.observation,
    recommendations,
    question: draft.question,
  };
}

export async function getWeeklyContext(ownerId: string) {
  const db = getDb();
  const weekKey = getJstWeekKey();
  const completedEntries = await db
    .select()
    .from(tasteEntries)
    .where(and(eq(tasteEntries.ownerId, ownerId), eq(tasteEntries.status, "complete")))
    .orderBy(desc(tasteEntries.createdAt), desc(tasteEntries.id))
    .limit(50);
  const priorFeedback = await db
    .select({
      title: weeklyRecommendations.title,
      url: weeklyRecommendations.url,
      category: weeklyRecommendations.category,
      reason: weeklyRecommendations.reason,
      feedback: weeklyRecommendations.feedback,
      createdAt: weeklyRecommendations.createdAt,
    })
    .from(weeklyRecommendations)
    .where(eq(weeklyRecommendations.ownerId, ownerId))
    .orderBy(desc(weeklyRecommendations.createdAt), desc(weeklyRecommendations.id))
    .limit(30);
  const [currentReport] = await db
    .select({ status: weeklyReports.status })
    .from(weeklyReports)
    .where(and(eq(weeklyReports.ownerId, ownerId), eq(weeklyReports.weekKey, weekKey)))
    .limit(1);

  // 批評リクエスト(critique)は本人の作品なので、好み・知識のどちらの信号にも含めない。
  const tasteEntriesForReport = completedEntries.filter((entry) => entry.learningMode === "taste" || entry.learningMode === "both");
  const knowledgeEntries = completedEntries.filter((entry) => entry.learningMode === "knowledge" || entry.learningMode === "both");

  return {
    ownerId,
    weekKey,
    weeklyStatus: currentReport?.status ?? null,
    completedEntries: tasteEntriesForReport.length,
    entries: tasteEntriesForReport.map((entry) => ({
      id: entry.id,
      savedAt: entry.createdAt,
      sourceType: entry.sourceType,
      title: entry.title,
      caption: entry.caption || undefined,
      sourceUrl: entry.sourceUrl || undefined,
      likedAspect: entry.aspect ? aspectLabels[entry.aspect] ?? entry.aspect : undefined,
      intent: entry.intent ? intentLabels[entry.intent] ?? entry.intent : undefined,
      visualAnalysis: safeAnalysis(entry.analysisJson),
      mediaPath: entry.mediaKey ? `/api/jobs/weekly/media/${entry.id}` : undefined,
    })),
    knowledgeEntries: knowledgeEntries.map((entry) => ({
      id: entry.id,
      savedAt: entry.createdAt,
      title: entry.title,
      sourceUrl: entry.sourceUrl || undefined,
      learningMode: entry.learningMode,
      note: knowledgeNote(entry.analysisJson),
    })),
    priorFeedback: priorFeedback
      .filter((item) => item.feedback)
      .map((item) => ({
        title: item.title,
        url: item.url,
        category: item.category,
        reason: item.reason,
        reaction: item.feedback === "like" ? "気になる" : "違う",
        reactedAt: item.createdAt,
      })),
  };
}

function buildTelegramReport(
  report: typeof weeklyReports.$inferSelect,
  recommendations: Array<typeof weeklyRecommendations.$inferSelect>,
) {
  const lines = [
    `Taste Engine｜週次レポート ${report.weekKey}`,
    "",
    "今週見えている好み",
    truncate(report.profileSummary, 360),
    "",
    "今回の変化・仮説",
    truncate(report.observation, 360),
    "",
  ];

  recommendations.forEach((item, index) => {
    const category = categoryLabels[item.category as WeeklyCategory] ?? item.category;
    const kind = kindLabels[item.kind as WeeklyKind] ?? item.kind;
    lines.push(`${index + 1}.［${category}｜${kind}］${truncate(item.title, 100)}`);
    lines.push(truncate(item.description, 220));
    lines.push(`合いそうな理由：${truncate(item.reason, 240)}`);
    lines.push(item.url, "");
  });

  lines.push("今週の問い", truncate(report.question, 300));
  lines.push("", "下の番号から「気になる / 違う」を押すと、次回の精度に反映します。");
  return truncate(lines.join("\n"), 4050);
}

async function deliverReport(
  chatId: string,
  report: typeof weeklyReports.$inferSelect,
  recommendations: Array<typeof weeklyRecommendations.$inferSelect>,
) {
  const keyboard: TelegramButton[][] = recommendations.map((item, index) => [
    { text: `${index + 1} 気になる`, callback_data: `weekly:${item.id}:like` },
    { text: `${index + 1} 違う`, callback_data: `weekly:${item.id}:dislike` },
  ]);
  await sendTelegramMessage(chatId, buildTelegramReport(report, recommendations), keyboard);
}

export async function saveAndDeliverWeeklyReport(
  ownerId: string,
  value: unknown,
): Promise<WeeklyRunResult> {
  const draft = validateWeeklyDraft(value);
  const db = getDb();
  const [owner] = await db
    .select()
    .from(telegramOwners)
    .where(eq(telegramOwners.telegramUserId, ownerId))
    .limit(1);
  if (!owner) throw new Error("Telegram owner was not found.");

  const entries = await db
    .select()
    .from(tasteEntries)
    .where(eq(tasteEntries.ownerId, ownerId))
    .orderBy(desc(tasteEntries.createdAt), desc(tasteEntries.id))
    .limit(50);
  const completedEntries = entries.filter(
    (entry) => entry.status === "complete" && entry.learningMode !== "knowledge",
  );
  if (completedEntries.length < 3) {
    return {
      status: "not_enough",
      completedEntries: completedEntries.length,
      requiredEntries: 3,
    };
  }

  const weekKey = getJstWeekKey();
  const [existing] = await db
    .select()
    .from(weeklyReports)
    .where(and(eq(weeklyReports.ownerId, ownerId), eq(weeklyReports.weekKey, weekKey)))
    .limit(1);

  if (existing?.status === "sent") {
    return { status: "already_sent", reportId: existing.id };
  }

  let report = existing;
  if (report) {
    const [updated] = await db
      .update(weeklyReports)
      .set({ status: "generating", error: null, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(weeklyReports.id, report.id))
      .returning();
    report = updated;
  } else {
    const [created] = await db
      .insert(weeklyReports)
      .values({ ownerId, weekKey })
      .onConflictDoNothing()
      .returning();
    if (!created) return { status: "generating" };
    report = created;
  }

  try {
    await db.delete(weeklyRecommendations).where(eq(weeklyRecommendations.reportId, report.id));
    const inserted = await db.insert(weeklyRecommendations).values(
      draft.recommendations.map((item) => ({
        reportId: report.id,
        ownerId,
        category: item.category,
        kind: item.kind,
        title: item.title,
        url: item.url,
        description: item.description,
        reason: item.reason,
      })),
    ).returning();
    const [ready] = await db
      .update(weeklyReports)
      .set({
        status: "ready",
        profileSummary: draft.profileSummary,
        observation: draft.observation,
        question: draft.question,
        error: null,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(weeklyReports.id, report.id))
      .returning();

    await deliverReport(owner.chatId, ready, inserted);
    await db
      .update(weeklyReports)
      .set({ status: "sent", sentAt: sql`CURRENT_TIMESTAMP`, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(weeklyReports.id, report.id));
    return { status: "sent", reportId: report.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Weekly report generation failed.";
    await db
      .update(weeklyReports)
      .set({ status: "failed", error: message.slice(0, 800), updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(weeklyReports.id, report.id));
    throw error;
  }
}

export async function resendCurrentWeeklyReport(ownerId: string): Promise<WeeklyRunResult> {
  const db = getDb();
  const [owner] = await db
    .select()
    .from(telegramOwners)
    .where(eq(telegramOwners.telegramUserId, ownerId))
    .limit(1);
  if (!owner) throw new Error("Telegram owner was not found.");

  const [report] = await db
    .select()
    .from(weeklyReports)
    .where(and(
      eq(weeklyReports.ownerId, ownerId),
      eq(weeklyReports.weekKey, getJstWeekKey()),
      eq(weeklyReports.status, "sent"),
    ))
    .limit(1);
  if (!report) return { status: "not_enough" };

  const recommendations = await db
    .select()
    .from(weeklyRecommendations)
    .where(eq(weeklyRecommendations.reportId, report.id))
    .orderBy(weeklyRecommendations.id);
  await deliverReport(owner.chatId, report, recommendations);
  return { status: "resent", reportId: report.id };
}

export async function recordWeeklyFeedback(ownerId: string, recommendationId: number, feedback: string) {
  if (feedback !== "like" && feedback !== "dislike") return null;
  const db = getDb();
  const [recommendation] = await db
    .select()
    .from(weeklyRecommendations)
    .where(and(
      eq(weeklyRecommendations.id, recommendationId),
      eq(weeklyRecommendations.ownerId, ownerId),
    ))
    .limit(1);
  if (!recommendation) return null;

  await db
    .update(weeklyRecommendations)
    .set({ feedback, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(weeklyRecommendations.id, recommendationId));
  return recommendation;
}
