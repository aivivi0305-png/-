import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { tasteEntries, telegramOwners, telegramUpdates } from "../../../../db/schema";
import { getRuntimeEnv, requireMediaBucket } from "../../../../lib/runtime";
import {
  answerTelegramCallback,
  aspectKeyboard,
  aspectLabels,
  clearTelegramKeyboard,
  downloadTelegramFile,
  intentKeyboard,
  intentLabels,
  learningModeKeyboard,
  learningModeLabels,
  sendTelegramMessage,
  sendTelegramPhoto,
} from "../../../../lib/telegram";
import { recordWeeklyFeedback, resendCurrentWeeklyReport } from "../../../../lib/weekly";

type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
};

type TelegramMessage = {
  message_id: number;
  date?: number;
  from?: TelegramUser;
  chat: { id: number };
  text?: string;
  caption?: string;
  photo?: Array<{ file_id: string; file_unique_id?: string; width?: number; height?: number }>;
  document?: { file_id: string; file_unique_id?: string; file_name?: string; mime_type?: string };
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: TelegramUser;
    data?: string;
    message?: TelegramMessage;
  };
};

function extractUrl(value: string) {
  return value.match(/https?:\/\/[^\s]+/i)?.[0]?.replace(/[),.;]+$/, "") ?? null;
}

function friendlyTitle(sourceType: string, url: string | null, caption: string, date?: number) {
  if (caption) return caption.slice(0, 90);
  if (url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url.slice(0, 90);
    }
  }
  const when = new Date((date ?? Math.floor(Date.now() / 1000)) * 1000);
  const label = sourceType === "photo" ? "写真" : sourceType === "document" ? "ファイル" : "メモ";
  const formatted = when.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${label} · ${formatted}`;
}

async function findOwner(telegramUserId: number) {
  const db = getDb();
  const [owner] = await db
    .select()
    .from(telegramOwners)
    .where(eq(telegramOwners.telegramUserId, String(telegramUserId)))
    .limit(1);
  return owner ?? null;
}

async function handleStart(message: TelegramMessage, user: TelegramUser, command: string) {
  const db = getDb();
  const currentOwner = await findOwner(user.id);
  if (currentOwner) {
    await sendTelegramMessage(message.chat.id, "Taste Engineと接続済みです。\n\n画像・スクリーンショット・URLを、このチャットへそのまま送ってください。");
    return;
  }

  const [existingOwner] = await db.select().from(telegramOwners).limit(1);
  if (existingOwner) {
    await sendTelegramMessage(message.chat.id, "このBotは個人用Taste Engineとして設定されています。");
    return;
  }

  const suppliedCode = command.split(/\s+/)[1] ?? "";
  const pairingCode = getRuntimeEnv().TELEGRAM_PAIRING_CODE?.trim() ?? "";
  if (!pairingCode || suppliedCode !== pairingCode) {
    await sendTelegramMessage(message.chat.id, "Taste Engineとの接続コードが必要です。\nWeb側に表示された接続リンクから、もう一度開始してください。");
    return;
  }

  await db.insert(telegramOwners).values({
    telegramUserId: String(user.id),
    chatId: String(message.chat.id),
    username: user.username ?? null,
    firstName: user.first_name ?? null,
  });

  await sendTelegramMessage(
    message.chat.id,
    "接続しました ✓\n\nこれからは、気になった画像・スクリーンショット・URLをここへ送るだけです。送ったあとに、好み・知識・両方のどれとして学ぶかを選べます。",
  );
}

async function storeTelegramMedia(ownerId: string, fileId: string, sourceName: string) {
  const downloaded = await downloadTelegramFile(fileId);
  const originalExtension = downloaded.filePath.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "bin";
  const key = `telegram/${ownerId}/${Date.now()}-${crypto.randomUUID()}.${originalExtension}`;
  await requireMediaBucket().put(key, downloaded.bytes, {
    httpMetadata: { contentType: downloaded.contentType },
    customMetadata: { source: sourceName },
  });
  return { key, contentType: downloaded.contentType };
}

async function handleStatus(message: TelegramMessage, user: TelegramUser) {
  const owner = await findOwner(user.id);
  if (!owner) {
    await sendTelegramMessage(message.chat.id, "まだTaste Engineと接続されていません。接続リンクから /start してください。");
    return;
  }
  const db = getDb();
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tasteEntries)
    .where(eq(tasteEntries.ownerId, owner.telegramUserId));
  await sendTelegramMessage(message.chat.id, `Taste Engineには、Telegramから${Number(result?.count ?? 0)}件保存されています。`);
}

async function handleReview(message: TelegramMessage, user: TelegramUser) {
  const owner = await findOwner(user.id);
  if (!owner) {
    await sendTelegramMessage(message.chat.id, "まだTaste Engineと接続されていません。");
    return;
  }
  const db = getDb();
  const [entry] = await db
    .select()
    .from(tasteEntries)
    .where(eq(tasteEntries.ownerId, owner.telegramUserId))
    .orderBy(desc(tasteEntries.createdAt), desc(tasteEntries.id))
    .limit(1);
  const pending = entry && ["awaiting_mode", "awaiting_aspect", "awaiting_intent", "awaiting_note"].includes(entry.status) ? entry : null;
  if (!pending) {
    await sendTelegramMessage(message.chat.id, "未回答の保存はありません ✓\n気になるものがあれば、いつでも送ってください。");
    return;
  }
  if (pending.status === "awaiting_note") {
    await sendTelegramMessage(message.chat.id, `「${pending.title}」から持ち帰りたい考えを、一言で送ってください。\n\n例：余白は装飾ではなく、情報の優先順位をつくるもの`);
    return;
  }
  const prompt = pending.status === "awaiting_mode"
    ? `「${pending.title}」は、どう学びに使いますか？`
    : pending.status === "awaiting_intent"
      ? `「${pending.title}」は、あなたにとってどんな距離感ですか？`
      : `この保存について教えてください。\n\n「${pending.title}」\nどこに惹かれましたか？`;
  const keyboard = pending.status === "awaiting_mode"
    ? learningModeKeyboard(pending.id)
    : pending.status === "awaiting_intent"
      ? intentKeyboard(pending.id)
      : aspectKeyboard(pending.id, pending.sourceType);
  if (pending.sourceType === "photo" && pending.telegramFileId) {
    await sendTelegramPhoto(message.chat.id, pending.telegramFileId, prompt, keyboard);
  } else {
    const context = pending.sourceUrl ? `\n${pending.sourceUrl}` : "";
    await sendTelegramMessage(message.chat.id, `${prompt}${context}`, keyboard);
  }
}

async function handleWeekly(message: TelegramMessage, user: TelegramUser) {
  const owner = await findOwner(user.id);
  if (!owner) {
    await sendTelegramMessage(message.chat.id, "まだTaste Engineと接続されていません。");
    return;
  }

  try {
    const result = await resendCurrentWeeklyReport(owner.telegramUserId);
    if (result.status === "not_enough") {
      await sendTelegramMessage(
        message.chat.id,
        "無料モードでは、毎週日曜10時ごろにMac上のCodexがレポートを作ります。今週分はまだありません。質問まで回答した保存を3件以上ためておいてください。",
      );
    }
  } catch {
    await sendTelegramMessage(
      message.chat.id,
      "今週のレポートを再送できませんでした。少し時間をおいて /weekly を送ってください。",
    );
  }
}

async function handleCapture(message: TelegramMessage, user: TelegramUser) {
  const owner = await findOwner(user.id);
  if (!owner) {
    await sendTelegramMessage(message.chat.id, "最初にTaste Engineとの接続が必要です。接続リンクから /start してください。");
    return;
  }

  const text = message.text?.trim() ?? "";
  const caption = message.caption?.trim() ?? "";
  const url = extractUrl(text) ?? extractUrl(caption);
  const largestPhoto = message.photo?.at(-1);
  const document = message.document;

  let sourceType = "text";
  let telegramFileId: string | null = null;
  let mediaKey: string | null = null;
  let mediaType: string | null = null;

  if (largestPhoto) {
    sourceType = "photo";
    telegramFileId = largestPhoto.file_id;
  } else if (document) {
    sourceType = "document";
    telegramFileId = document.file_id;
  } else if (url) {
    sourceType = "url";
  } else if (!text) {
    await sendTelegramMessage(message.chat.id, "画像・スクリーンショット・URLのいずれかを送ってください。");
    return;
  }

  if (telegramFileId) {
    const stored = await storeTelegramMedia(owner.telegramUserId, telegramFileId, sourceType);
    mediaKey = stored.key;
    mediaType = stored.contentType;
  }

  const title = friendlyTitle(sourceType, url, caption || (sourceType === "text" ? text : ""), message.date);
  const db = getDb();
  const [entry] = await db.insert(tasteEntries).values({
    ownerId: owner.telegramUserId,
    sourceType,
    sourceUrl: url,
    telegramFileId,
    mediaKey,
    mediaType,
    title,
    caption: caption || (sourceType === "text" ? text : ""),
    learningMode: "taste",
    status: "awaiting_mode",
  }).returning();

  await sendTelegramMessage(
    message.chat.id,
    `この画像・リンクを保存しました ✓\n\n「${entry.title}」は、どう学びに使いますか？`,
    learningModeKeyboard(entry.id),
    { replyToMessageId: message.message_id },
  );
}

async function handleKnowledgeNote(message: TelegramMessage, user: TelegramUser) {
  const owner = await findOwner(user.id);
  if (!owner) return false;
  const note = message.text?.trim();
  if (!note) return false;
  const db = getDb();
  const [entry] = await db
    .select()
    .from(tasteEntries)
    .where(and(eq(tasteEntries.ownerId, owner.telegramUserId), eq(tasteEntries.status, "awaiting_note")))
    .orderBy(desc(tasteEntries.createdAt), desc(tasteEntries.id))
    .limit(1);
  if (!entry) return false;

  await db.update(tasteEntries).set({
    analysisJson: JSON.stringify({ knowledgeNote: note.slice(0, 500) }),
    status: "complete",
    updatedAt: sql`CURRENT_TIMESTAMP`,
  }).where(eq(tasteEntries.id, entry.id));
  await sendTelegramMessage(
    message.chat.id,
    `「${entry.title}」の考え方を知識として記録しました ✓\n\n次回から、${entry.learningMode === "both" ? "あなたの好みと" : ""}この考え方の両方を参考に提案します。`,
    undefined,
    { replyToMessageId: message.message_id },
  );
  return true;
}

async function handleMessage(message: TelegramMessage) {
  const user = message.from;
  if (!user) return;
  const command = message.text?.trim() ?? "";
  if (command.startsWith("/start")) return handleStart(message, user, command);
  if (command.startsWith("/status")) return handleStatus(message, user);
  if (command.startsWith("/review")) return handleReview(message, user);
  if (command.startsWith("/weekly")) return handleWeekly(message, user);
  if (command.startsWith("/help")) {
    await sendTelegramMessage(message.chat.id, "画像・スクリーンショット・URLを送るとTaste Engineへ保存します。送ったあとに、好み・知識・両方のどれとして使うかを選べます。\n\n/status 保存件数\n/review 未回答を確認\n/weekly 今週のレポート");
    return;
  }
  if (!message.photo && !message.document && !extractUrl(command) && await handleKnowledgeNote(message, user)) return;
  return handleCapture(message, user);
}

async function handleCallback(update: NonNullable<TelegramUpdate["callback_query"]>) {
  const chatId = update.message?.chat.id;
  const messageId = update.message?.message_id;
  if (!chatId || !messageId || !update.data) {
    await answerTelegramCallback(update.id);
    return;
  }
  const owner = await findOwner(update.from.id);
  if (!owner) {
    await answerTelegramCallback(update.id, "この操作は利用できません");
    return;
  }

  const [kind, rawId, value] = update.data.split(":");
  const entryId = Number(rawId);
  if (!Number.isInteger(entryId) || !value) {
    await answerTelegramCallback(update.id, "回答を読み取れませんでした");
    return;
  }

  const db = getDb();
  if (kind === "weekly" && (value === "like" || value === "dislike")) {
    const recommendation = await recordWeeklyFeedback(owner.telegramUserId, entryId, value);
    if (!recommendation) {
      await answerTelegramCallback(update.id, "推薦が見つかりませんでした");
      return;
    }
    await answerTelegramCallback(
      update.id,
      value === "like" ? "「気になる」を次回へ反映します" : "「違う」を次回へ反映します",
    );
    return;
  }

  const [entry] = await db
    .select()
    .from(tasteEntries)
    .where(and(eq(tasteEntries.id, entryId), eq(tasteEntries.ownerId, owner.telegramUserId)))
    .limit(1);
  if (!entry) {
    await answerTelegramCallback(update.id, "保存データが見つかりません");
    return;
  }

  if (kind === "mode" && learningModeLabels[value]) {
    if (entry.status !== "awaiting_mode") {
      await answerTelegramCallback(update.id, "この選択には回答済みです");
      await clearTelegramKeyboard(chatId, messageId).catch(() => undefined);
      return;
    }
    const nextStatus = value === "knowledge" ? "awaiting_note" : "awaiting_aspect";
    await db.update(tasteEntries).set({
      learningMode: value,
      status: nextStatus,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    }).where(eq(tasteEntries.id, entryId));
    await answerTelegramCallback(update.id, `「${learningModeLabels[value]}」として記録します`);
    await clearTelegramKeyboard(chatId, messageId).catch(() => undefined);
    if (value === "knowledge") {
      await sendTelegramMessage(chatId, `「${entry.title}」から持ち帰りたい考えを、一言で送ってください。\n\n例：余白は装飾ではなく、情報の優先順位をつくるもの`);
    } else {
      await sendTelegramMessage(chatId, `「${entry.title}」のどこに惹かれましたか？`, aspectKeyboard(entryId, entry.sourceType));
    }
    return;
  }

  if (kind === "aspect" && aspectLabels[value]) {
    if (entry.aspect && entry.status !== "awaiting_aspect") {
      await answerTelegramCallback(update.id, "この質問には回答済みです");
      await clearTelegramKeyboard(chatId, messageId).catch(() => undefined);
      return;
    }
    await db.update(tasteEntries).set({
      aspect: value,
      status: "awaiting_intent",
      updatedAt: sql`CURRENT_TIMESTAMP`,
    }).where(eq(tasteEntries.id, entryId));
    await answerTelegramCallback(update.id, `「${aspectLabels[value]}」として記録しました`);
    await clearTelegramKeyboard(chatId, messageId).catch(() => undefined);
    await sendTelegramMessage(chatId, `「${entry.title}」は、あなたにとってどんな距離感ですか？`, intentKeyboard(entryId));
    return;
  }

  if (kind === "intent" && intentLabels[value]) {
    if (entry.status === "complete") {
      await answerTelegramCallback(update.id, "この質問には回答済みです");
      await clearTelegramKeyboard(chatId, messageId).catch(() => undefined);
      return;
    }
    const needsKnowledgeNote = entry.learningMode === "both";
    await db.update(tasteEntries).set({
      intent: value,
      status: needsKnowledgeNote ? "awaiting_note" : "complete",
      updatedAt: sql`CURRENT_TIMESTAMP`,
    }).where(eq(tasteEntries.id, entryId));
    await answerTelegramCallback(update.id, `「${intentLabels[value]}」として学習しました`);
    await clearTelegramKeyboard(chatId, messageId).catch(() => undefined);
    if (needsKnowledgeNote) {
      await sendTelegramMessage(chatId, `最後に、「${entry.title}」から持ち帰りたい考えを一言で送ってください。\n\n例：写真は整えすぎず、生活の痕跡を少し残す`);
    } else {
      await sendTelegramMessage(chatId, `「${entry.title}」を好みとして学習しました ✓\n\n${aspectLabels[entry.aspect ?? ""] ?? "気になった部分"}が好きで、${intentLabels[value]}ものとして保存しています。`);
    }
    return;
  }

  await answerTelegramCallback(update.id, "回答を読み取れませんでした");
}

export async function POST(request: Request) {
  const runtime = getRuntimeEnv();
  const configuredSecret = runtime.TELEGRAM_WEBHOOK_SECRET?.trim();
  const receivedSecret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!configuredSecret || !runtime.TELEGRAM_BOT_TOKEN) {
    return Response.json({ error: "Telegram is not configured" }, { status: 503 });
  }
  if (!receivedSecret || receivedSecret !== configuredSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let claimedUpdateId: string | null = null;
  try {
    const update = (await request.json()) as TelegramUpdate;
    claimedUpdateId = String(update.update_id);
    const db = getDb();
    const [existing] = await db.select().from(telegramUpdates).where(eq(telegramUpdates.updateId, claimedUpdateId)).limit(1);
    if (existing?.status === "processing" || existing?.status === "done") {
      return Response.json({ ok: true, duplicate: true });
    }
    if (existing?.status === "failed") {
      await db.update(telegramUpdates).set({ status: "processing", error: null, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(telegramUpdates.updateId, claimedUpdateId));
    } else {
      const claimed = await db.insert(telegramUpdates).values({ updateId: claimedUpdateId }).onConflictDoNothing().returning();
      if (!claimed.length) return Response.json({ ok: true, duplicate: true });
    }

    if (update.callback_query) await handleCallback(update.callback_query);
    else if (update.message) await handleMessage(update.message);
    await db.update(telegramUpdates).set({ status: "done", updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(telegramUpdates.updateId, claimedUpdateId));
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected Telegram webhook error";
    if (claimedUpdateId) {
      try {
        await getDb().update(telegramUpdates).set({ status: "failed", error: message.slice(0, 500), updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(telegramUpdates.updateId, claimedUpdateId));
      } catch {
        // Keep the original webhook error as the useful failure signal.
      }
    }
    console.error("Telegram webhook failed", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ service: "Taste Engine Telegram intake", configured: Boolean(getRuntimeEnv().TELEGRAM_BOT_TOKEN) });
}
