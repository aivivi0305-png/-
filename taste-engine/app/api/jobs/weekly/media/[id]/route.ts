import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { tasteEntries } from "../../../../../../db/schema";
import { requireMediaBucket } from "../../../../../../lib/runtime";
import { isWeeklyJobAuthorized } from "../../../../../../lib/weekly-job";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isWeeklyJobAuthorized(request)) return new Response("Unauthorized", { status: 401 });

  const { id } = await context.params;
  const entryId = Number(id);
  if (!Number.isInteger(entryId)) return new Response("Not found", { status: 404 });

  // awaiting_runner は批評リクエストの画像取得用(ジョブ認証済みのみ到達)。
  const [entry] = await getDb()
    .select()
    .from(tasteEntries)
    .where(and(eq(tasteEntries.id, entryId), inArray(tasteEntries.status, ["complete", "awaiting_runner"])))
    .limit(1);
  if (!entry?.mediaKey) return new Response("Not found", { status: 404 });

  const object = await requireMediaBucket().get(entry.mediaKey);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "private, no-store");
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
}
