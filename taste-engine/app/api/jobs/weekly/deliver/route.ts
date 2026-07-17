import { saveAndDeliverWeeklyReport } from "../../../../../lib/weekly";
import { isWeeklyJobAuthorized } from "../../../../../lib/weekly-job";

export async function POST(request: Request) {
  if (!isWeeklyJobAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { ownerId?: string; report?: unknown };
  try {
    payload = await request.json() as { ownerId?: string; report?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!payload.ownerId || !payload.report) {
    return Response.json({ error: "ownerId and report are required" }, { status: 400 });
  }

  try {
    const result = await saveAndDeliverWeeklyReport(payload.ownerId, payload.report);
    return Response.json({ ok: true, result });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Weekly report delivery failed",
    }, { status: 400 });
  }
}
