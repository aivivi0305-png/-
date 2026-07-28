# このリポジトリについて

独立した2つのプロジェクトが同居しています。作業する前に、どちらの話かを必ず確認してください。

| ディレクトリ | 中身 | 詳細 |
|---|---|---|
| リポジトリ直下 (`scripts/`, `posts/`, `photos/`, `config/`, `.github/workflows/`) | **SNS Autopilot** — AIが調査・下書き・予約まで行い、公開はPRのマージ(人間承認)で行う半自動SNS運用システム。GitHub Actionsで動作 | [README.md](./README.md) |
| `taste-engine/` | **Taste Engine** — Telegram経由で嗜好と知識を収集し、週次で好みプロフィールを更新する個人用ハブ。Next.js(vinext)+ Cloudflare D1/R2 | [taste-engine/CLAUDE.md](./taste-engine/CLAUDE.md) |

作業の現在地・残タスクは [HANDOFF.md](./HANDOFF.md) を参照してください。**セッション開始時はまずHANDOFF.mdを読むこと。**

## セットアップ

`.claude/hooks/session-start.sh` が両プロジェクトの `npm install` を自動実行します(Claude Code on the web のみ)。手動なら:

```bash
npm install && npm install --prefix taste-engine
```

## 確認コマンド

```bash
npm run validate                    # SNS Autopilot: 下書きの形式チェック
npm run lint  --prefix taste-engine # Taste Engine: ESLint
npm run build --prefix taste-engine # Taste Engine: ビルド
```

`taste-engine` の lint には既存エラーが1件あります(`app/page.tsx` の localStorage 読み込み effect)。これは変更前から存在するもので、SSR安全のための意図的なパターンです。**新たにエラーを増やさないこと**を基準にしてください。`npm test` は削除済みスケルトンの残骸なので、回帰テストとしては信用しないでください。

## 共通ルール

- APIキー・Telegramトークン・Webhookシークレット・ローカルランナーの設定をリポジトリにコミットしないこと。シークレットはホスティング側とローカルの設定ファイルで管理します。
- 秘匿情報を扱うため、`taste-engine` の読み取りルートから ChatGPT サインインのチェックを外さないこと。
- Telegramの挙動を変更するときは、Webhookの冪等処理と**送信済みボタンのコールバック形式**を壊さないこと。
