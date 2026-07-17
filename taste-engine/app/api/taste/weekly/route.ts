import { desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { weeklyRecommendations, weeklyReports } from "../../../../db/schema";
import { recordWeeklyFeedback } from "../../../../lib/weekly";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const [report] = await db
    .select()
    .from(weeklyReports)
    .where(eq(weeklyReports.status, "sent"))
    .orderBy(desc(weeklyReports.weekKey), desc(weeklyReports.id))
    .limit(1);
  if (!report) return Response.json({ report: null, recommendations: [] });

  const recommendations = await db
    .select()
    .from(weeklyRecommendations)
    .where(eq(weeklyRecommendations.reportId, report.id))
    .orderBy(weeklyRecommendations.id);
  return Response.json({ report, recommendations });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await request.json() as { id?: number; feedback?: string };
  if (!Number.isInteger(payload.id) || (payload.feedback !== "like" && payload.feedback !== "dislike")) {
    return Response.json({ error: "Invalid feedback" }, { status: 400 });
  }
  const db = getDb();
  const [item] = await db
    .select()
    .from(weeklyRecommendations)
    .where(eq(weeklyRecommendations.id, payload.id as number))
    .limit(1);
  if (!item) return Response.json({ error: "Not found" }, { status: 404 });

  await recordWeeklyFeedback(item.ownerId, item.id, payload.feedback);
  return Response.json({ ok: true });
}
