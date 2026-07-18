import { getRuntimeEnv } from "./runtime";

export type TelegramButton = { text: string; callback_data: string };

type TelegramApiResult<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

function requireTelegramToken() {
  const token = getRuntimeEnv().TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  return token;
}

export async function telegramApi<T>(method: string, payload: Record<string, unknown>) {
  const token = requireTelegramToken();
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as TelegramApiResult<T>;
  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram ${method} failed.`);
  }
  return data.result as T;
}

export function sendTelegramMessage(
  chatId: string | number,
  text: string,
  keyboard?: TelegramButton[][],
  options?: { replyToMessageId?: number },
) {
  return telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
    ...(options?.replyToMessageId
      ? { reply_parameters: { message_id: options.replyToMessageId, allow_sending_without_reply: true } }
      : {}),
  });
}

export function sendTelegramPhoto(chatId: string | number, fileId: string, caption: string, keyboard?: TelegramButton[][]) {
  return telegramApi("sendPhoto", {
    chat_id: chatId,
    photo: fileId,
    caption,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

export function answerTelegramCallback(callbackQueryId: string, text?: string) {
  return telegramApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}

export function clearTelegramKeyboard(chatId: string | number, messageId: number) {
  return telegramApi("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  });
}

export async function downloadTelegramFile(fileId: string) {
  const file = await telegramApi<{ file_path?: string }>("getFile", { file_id: fileId });
  if (!file.file_path) throw new Error("Telegram did not return a file path.");
  const token = requireTelegramToken();
  const response = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
  if (!response.ok) throw new Error("Telegram file download failed.");
  return {
    bytes: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") || "application/octet-stream",
    filePath: file.file_path,
  };
}

export function aspectKeyboard(entryId: number, sourceType: string): TelegramButton[][] {
  const options = sourceType === "url"
    ? [["内容", "content"], ["見た目", "visual"], ["両方", "both"], ["なぜか気になる", "curious"]]
    : [["全体", "whole"], ["色", "color"], ["構図", "composition"], ["文字", "type"], ["質感", "texture"], ["雰囲気", "mood"]];
  const buttons = options.map(([text, value]) => ({ text, callback_data: `aspect:${entryId}:${value}` }));
  return sourceType === "url"
    ? [buttons.slice(0, 2), buttons.slice(2)]
    : [buttons.slice(0, 3), buttons.slice(3)];
}

export function learningModeKeyboard(entryId: number): TelegramButton[][] {
  return [
    [
      { text: "好みとして残す", callback_data: `mode:${entryId}:taste` },
      { text: "知識として学ぶ", callback_data: `mode:${entryId}:knowledge` },
    ],
    [
      { text: "好みと知識の両方", callback_data: `mode:${entryId}:both` },
      { text: "批評してもらう", callback_data: `mode:${entryId}:critique` },
    ],
  ];
}

export function intentKeyboard(entryId: number): TelegramButton[][] {
  return [
    [
      { text: "自分でも使いたい", callback_data: `intent:${entryId}:use` },
      { text: "見るのが好き", callback_data: `intent:${entryId}:view` },
    ],
    [
      { text: "制作の参考", callback_data: `intent:${entryId}:reference` },
      { text: "普段と違う", callback_data: `intent:${entryId}:unusual` },
    ],
  ];
}

export const aspectLabels: Record<string, string> = {
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

export const intentLabels: Record<string, string> = {
  use: "自分でも使いたい",
  view: "見るのが好き",
  reference: "制作の参考",
  unusual: "普段と違うが気になる",
};

export const learningModeLabels: Record<string, string> = {
  taste: "好みとして残す",
  knowledge: "知識として学ぶ",
  both: "好みと知識の両方",
  critique: "批評してもらう",
};
