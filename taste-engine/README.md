# Taste Engine

Personal visual taste and design-knowledge learning hub. The product receives
references through Telegram and turns them into a growing taste profile,
knowledge cards, weekly inspiration, and future creative briefs.

For Claude Code or another coding agent, start with [CLAUDE.md](./CLAUDE.md).

## Development

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Project shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` and `drizzle/` define the Taste Engine's D1 data.
- Telegram intake lives in `app/api/telegram/webhook/route.ts`.
- Weekly context and delivery live in `lib/weekly.ts` and `scripts/`.

## エージェント連携(Taste Context)

このハブの本来の使い方は、**蓄積した嗜好を Codex / Claude Code などの作業エージェントから参照させる**ことです。実作業は各プロジェクトのエージェントで行い、その判断基準としてここで育てたコンテキストを渡します。

### 1. API から取得する(推奨)

`GET /api/agent/context` が、好みプロフィール(週次分析)・好みシグナル・知識メモ・推薦への反応を **TASTE.md 形式の Markdown** で返します(`?format=json` でJSON)。認証は週次ジョブと同じ `WEEKLY_JOB_SECRET` の Bearer トークンです。

各プロジェクトのディレクトリで:

```bash
node /path/to/taste-engine/scripts/taste-context.mjs   # → ./TASTE.md を生成/更新
```

設定は週次ランナーと共通(`~/.config/taste-engine/weekly.json` の `baseUrl` / `secret`)。

### 2. プロジェクト側の設定スニペット

生成した `TASTE.md` をエージェントに読ませるため、各プロジェクトの `CLAUDE.md` / `AGENTS.md` に以下を追記します:

```markdown
## 嗜好コンテキスト

デザイン・写真・文章・UIなど、見た目や表現の判断が必要な場面では、
まず `TASTE.md`(本人の嗜好コンテキスト)を読んで判断基準にすること。
「知識」セクションは参考情報であり、本人の好みそのものとして扱わないこと。
古い可能性がある場合は `node <taste-engine>/scripts/taste-context.mjs` で更新できる。
```

### 3. ハブからコピーする

ハブの「制作に使う」パネルの**「嗜好コンテキストをコピー」**ボタンで、画面に読み込まれている実データからMarkdownを生成してクリップボードにコピーできます。スクリプトを叩けない環境(スマホ等)からチャットに直接貼る用です。

### 批評モード(自分の作品を送る)

Telegramに**自分の**写真・スクリーンショット・下書きURLを送り、「批評してもらう」を選ぶと批評リクエストとして保存されます(好み・知識の学習データには混ざりません)。ローカルランナーを実行すると、蓄積された嗜好コンテキストと照らした批評(①良い点 ②嗜好とのずれ ③次の一手)がTelegramに返ります:

```bash
node scripts/run-critique.mjs            # 保留中の批評リクエストをまとめて処理
TASTE_ENGINE_RUNNER=claude node scripts/run-critique.mjs   # Claude Codeで生成
```

送信時のキャプションに「見てほしい点」を書いておくと批評に反映されます。週次ランナーと同じ設定ファイル・launchd等のスケジュール実行が使えます。

### 週次レポートを Claude Code で生成する

週次ランナーはデフォルトで ChatGPT 同梱の Codex を使いますが、環境変数で Claude Code に切り替えられます(Claude Pro/Max のサブスクリプションで動作、APIキー不要):

```bash
TASTE_ENGINE_RUNNER=claude node scripts/run-weekly-free.mjs
# claude CLI の場所が特殊な場合: TASTE_ENGINE_CLAUDE_BIN=/path/to/claude
```

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
