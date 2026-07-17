import {
  buildAgentContext,
  getPrimaryOwnerId,
  renderAgentContextMarkdown,
} from "../../../../lib/agent-context";
import { isWeeklyJobAuthorized } from "../../../../lib/weekly-job";

// Machine-readable taste context for coding agents (Claude Code / Codex).
// Authenticated with the same Bearer secret as the weekly job endpoints so
// local CLI tooling can fetch it without a browser session.
export async function GET(request: Request) {
  if (!isWeeklyJobAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const ownerId = url.searchParams.get("owner") ?? await getPrimaryOwnerId();
  if (!ownerId) {
    return Response.json({ error: "No Telegram owner is paired yet." }, { status: 404 });
  }

  const context = await buildAgentContext(ownerId);
  if (url.searchParams.get("format") === "json") {
    return Response.json(context);
  }
  return new Response(renderAgentContextMarkdown(context), {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
