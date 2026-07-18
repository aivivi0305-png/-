import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { tasteEntries, telegramOwners } from "../db/schema";
import { sendTelegramMessage } from "./telegram";

// Critique requests are the owner's own work sent from Telegram. They are
// never treated as taste or knowledge signals; the local runner generates the
// critique against the taste context and this module delivers it back.

export type PendingCritique = {
  id: number;
  ownerId: string;
  savedAt: string;
  sourceType: string;
  title: string;
  focusNote?: string;
  sourceUrl?: string;
  mediaPath?: string;
};

export async function getPendingCritiques(): Promise<PendingCritique[]> {
  const db = getDb();
  const pending = await db
    .select()
    .from(tasteEntries)
    .where(and(eq(tasteEntries.learningMode, "critique"), eq(tasteEntries.status, "awaiting_runner")))
    .orderBy(tasteEntries.createdAt, tasteEntries.id)
    .limit(10);
  return pending.map((entry) => ({
    id: entry.id,
    ownerId: entry.ownerId,
    savedAt: entry.createdAt,
    sourceType: entry.sourceType,
    title: entry.title,
    focusNote: entry.caption || undefined,
    sourceUrl: entry.sourceUrl || undefined,
    mediaPath: entry.mediaKey ? `/api/jobs/weekly/media/${entry.id}` : undefined,
  }));
}

export async function deliverCritique(entryId: number, critique: string) {
  const clean = critique.trim();
  if (!clean) throw new Error("Critique text was empty.");

  const db = getDb();
  const [entry] = await db
    .select()
    .from(tasteEntries)
    .where(and(eq(tasteEntries.id, entryId), eq(tasteEntries.learningMode, "critique")))
    .limit(1);
  if (!entry) throw new Error("Critique entry was not found.");
  if (entry.status === "complete") return { status: "already_sent" as const };

  const [owner] = await db
    .select()
    .from(telegramOwners)
    .where(eq(telegramOwners.telegramUserId, entry.ownerId))
    .limit(1);
  if (!owner) throw new Error("Telegram owner was not found.");

  const text = `Taste Engine｜批評\n「${entry.title}」\n\n${clean}`.slice(0, 4000);
  await sendTelegramMessage(owner.chatId, text);
  await db.update(tasteEntries).set({
    analysisJson: JSON.stringify({ critique: clean.slice(0, 4000) }),
    status: "complete",
    updatedAt: sql`CURRENT_TIMESTAMP`,
  }).where(eq(tasteEntries.id, entryId));
  return { status: "sent" as const };
}
