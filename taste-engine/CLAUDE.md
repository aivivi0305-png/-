# Taste Engine — Claude handoff

## What this is

Taste Engine is a personal learning hub. It collects visual references and
articles through Telegram, then uses the accumulated signals for weekly
inspiration and creative briefs.

The product has two separate learning layers:

- **Taste**: what the owner likes visually and why.
- **Knowledge**: design, editorial, photography, or brand principles that the
  owner wants the system to consider without treating them as personal taste.

## Important product rules

- Keep taste and knowledge separate. An article's claim is not automatically a
  preference signal.
- Keep the Telegram flow lightweight. Do not ask questions that are not needed
  to improve future recommendations.
- Do not remove the ChatGPT sign-in checks from read routes. Saved references
  and uploaded media are personal data.
- Do not add API keys, Telegram tokens, webhook secrets, or local weekly-runner
  configuration to the repository. Hosted secrets are managed outside source.
- Preserve the user's untracked `app/* 2.*` files. They are not product source.

## Main code map

- `app/page.tsx` — the web hub UI, saved items, knowledge cards, and weekly
  recommendation display.
- `app/globals.css` — all product styling.
- `app/api/telegram/webhook/route.ts` — Telegram intake and inline-question
  flow.
- `lib/telegram.ts` — Telegram messages and inline keyboard definitions.
- `db/schema.ts` and `drizzle/` — durable D1 schema and migrations.
- `lib/weekly.ts` — context for weekly recommendations and Telegram delivery.
- `lib/agent-context.ts` and `app/api/agent/context/route.ts` — the taste
  context export for coding agents (Claude Code / Codex). Bearer-authenticated
  with `WEEKLY_JOB_SECRET`; returns TASTE.md-style markdown or JSON.
- `scripts/taste-context.mjs` — fetches the agent context into any project as
  `TASTE.md`. Uses the same local config file as the weekly runner.
- `scripts/run-weekly-free.mjs` — local weekly runner; it passes both taste
  signals and knowledge references to the weekly curator. The curator CLI is
  switchable: Codex by default, Claude Code with `TASTE_ENGINE_RUNNER=claude`.
- `lib/critique.ts`, `app/api/jobs/critique/route.ts`, and
  `scripts/run-critique.mjs` — critique mode. The owner sends their own work
  from Telegram and picks 批評してもらう; the local runner critiques it against
  the taste context and replies on Telegram. Critique entries must never be
  counted as taste or knowledge signals.

## Telegram learning flow

1. The owner sends an image, screenshot, file, URL, or text.
2. The bot asks how to use it: `taste`, `knowledge`, `both`, or `critique`
   (critique = the owner's own work; answered asynchronously by the local
   critique runner and excluded from all learning signals).
3. `taste` asks which visual/content aspect matters, then the intended distance
   from the owner's own work.
4. `knowledge` asks for one short takeaway in the owner's words.
5. `both` collects the taste answers and then the takeaway.
6. Completed records appear in the hub. Knowledge and both-mode records show a
   knowledge card and are supplied to weekly recommendations as context.

## Working safely

```bash
npm run lint
npm run build
npm run db:generate  # only after changing db/schema.ts
```

After a schema change, inspect the generated Drizzle migration before shipping.
The current `npm test` is leftover starter coverage for a removed skeleton and
is not a reliable product regression suite.

Do not publish or change hosted configuration unless the user explicitly asks.
When changing Telegram behavior, preserve idempotent webhook handling and the
existing callback formats for already-sent buttons.
