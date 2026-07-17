import { getRuntimeEnv } from "./runtime";

export function isWeeklyJobAuthorized(request: Request) {
  const expected = getRuntimeEnv().WEEKLY_JOB_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return Boolean(expected && supplied && expected === supplied);
}
