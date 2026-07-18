import { deliverCritique, getPendingCritiques } from "../../../../lib/critique";
import { isWeeklyJobAuthorized } from "../../../../lib/weekly-job";

export async function GET(request: Request) {
  if (!isWeeklyJobAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({
    generatedAt: new Date().toISOString(),
    pending: await getPendingCritiques(),
  });
}

export async function POST(request: Request) {
  if (!isWeeklyJobAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = await request.json() as { entryId?: number; critique?: string };
  if (!Number.isInteger(payload.entryId) || typeof payload.critique !== "string") {
    return Response.json({ error: "entryId and critique are required." }, { status: 400 });
  }
  const result = await deliverCritique(payload.entryId as number, payload.critique);
  return Response.json({ result });
}
