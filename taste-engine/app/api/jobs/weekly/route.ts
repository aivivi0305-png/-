import { getRuntimeEnv } from "../../../../lib/runtime";
import { isWeeklyJobAuthorized } from "../../../../lib/weekly-job";

export async function POST(request: Request) {
  if (!isWeeklyJobAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({
    error: "Paid API generation is disabled. Use the local ChatGPT/Codex weekly runner.",
  }, { status: 410 });
}

export async function GET() {
  const runtime = getRuntimeEnv();
  return Response.json({
    service: "Taste Engine weekly report",
    mode: "local-chatgpt-codex",
    configured: Boolean(runtime.WEEKLY_JOB_SECRET),
  });
}
