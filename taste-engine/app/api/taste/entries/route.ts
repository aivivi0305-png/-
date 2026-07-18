import { desc, ne } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { tasteEntries } from "../../../../db/schema";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  // 批評リクエストは学習データではないので、保存一覧には出さない。
  const entries = await db
    .select()
    .from(tasteEntries)
    .where(ne(tasteEntries.learningMode, "critique"))
    .orderBy(desc(tasteEntries.createdAt), desc(tasteEntries.id))
    .limit(100);

  return Response.json({
    entries: entries.map((entry) => ({
      ...entry,
      mediaUrl: entry.mediaKey ? `/api/taste/media/${entry.id}` : null,
    })),
  });
}
