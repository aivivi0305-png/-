import { getDb } from "../../../../../db";
import { telegramOwners } from "../../../../../db/schema";
import { getWeeklyContext } from "../../../../../lib/weekly";
import { isWeeklyJobAuthorized } from "../../../../../lib/weekly-job";

export async function GET(request: Request) {
  if (!isWeeklyJobAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const owners = await getDb().select({ ownerId: telegramOwners.telegramUserId }).from(telegramOwners);
  const contexts = [];
  for (const owner of owners) {
    contexts.push(await getWeeklyContext(owner.ownerId));
  }

  return Response.json({
    mode: "local-chatgpt-codex",
    generatedAt: new Date().toISOString(),
    owners: contexts,
  });
}
