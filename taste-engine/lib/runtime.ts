import { env } from "cloudflare:workers";

export type TasteRuntimeEnv = {
  DB?: D1Database;
  MEDIA?: R2Bucket;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_PAIRING_CODE?: string;
  WEEKLY_JOB_SECRET?: string;
};

export function getRuntimeEnv(): TasteRuntimeEnv {
  return env as unknown as TasteRuntimeEnv;
}

export function requireMediaBucket(): R2Bucket {
  const bucket = getRuntimeEnv().MEDIA;
  if (!bucket) {
    throw new Error("Cloudflare R2 binding `MEDIA` is unavailable.");
  }
  return bucket;
}
