import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getDb } from "../../../../../db";
import { tasteEntries } from "../../../../../db/schema";
import { requireMediaBucket } from "../../../../../lib/runtime";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await context.params;
  const entryId = Number(id);
  if (!Number.isInteger(entryId)) return new Response("Not found", { status: 404 });

  const db = getDb();
  const [entry] = await db.select().from(tasteEntries).where(eq(tasteEntries.id, entryId)).limit(1);
  if (!entry?.mediaKey) return new Response("Not found", { status: 404 });

  const object = await requireMediaBucket().get(entry.mediaKey);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "private, max-age=3600");
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
}
