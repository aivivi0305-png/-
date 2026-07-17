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
- `scripts/run-weekly-free.mjs` — local weekly runner; it passes both taste
  signals and knowledge references to the weekly curator.

## Telegram learning flow

1. The owner sends an image, screenshot, file, URL, or text.
2. The bot asks how to use it: `taste`, `knowledge`, or `both`.
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
