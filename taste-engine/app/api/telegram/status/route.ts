import { sql } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { tasteEntries, telegramOwners } from "../../../../db/schema";
import { getRuntimeEnv } from "../../../../lib/runtime";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const [ownerCount] = await db.select({ count: sql<number>`count(*)` }).from(telegramOwners);
  const [entryCount] = await db.select({ count: sql<number>`count(*)` }).from(tasteEntries);
  const runtime = getRuntimeEnv();

  return Response.json({
    configured: Boolean(runtime.TELEGRAM_BOT_TOKEN && runtime.TELEGRAM_WEBHOOK_SECRET && runtime.TELEGRAM_PAIRING_CODE),
    paired: Number(ownerCount?.count ?? 0) > 0,
    entries: Number(entryCount?.count ?? 0),
  });
}
