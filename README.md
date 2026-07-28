# SNS Autopilot — 調査・下書き・投稿予約までAI、公開は人間承認

「全自動SNS運営」ではなく、**AIが調査から下書き・予約までを準備し、公開の最終判断だけ人間が行う**半自動運用システムです。GitHubだけで完結し、サーバーは不要です。

## 仕組み

```
【テキスト投稿】毎朝06:00 JST
┌─────────────────┐
│ Claude が Web検索 │ ┐
│ で調査 → 下書き   │ │    ┌──────────────────┐    ┌──────────────────┐
│ 生成 → PR作成    │ │    │ GitHubアプリでPRを │    │ 1時間ごとにチェック │
└─────────────────┘ ├ →  │ 確認して Merge     │ →  │ 予約時刻が来たら   │
【写真投稿】随時      │    │ (= 承認)          │    │ X / Instagram へ  │
┌─────────────────┐ │    │ 編集・却下も可能    │    │ 自動投稿          │
│ photos/inbox/ に  │ │    └──────────────────┘    └──────────────────┘
│ 写真を置く → AIが  │ │
│ キャプション→PR   │ ┘
└─────────────────┘
```

- **承認 = PRのMerge**。マージすると `posts/queue/` に下書きが入り、予約時刻に自動投稿されます
- **編集**したい場合はPRのブランチ上でファイルを直接編集してからマージ
- **却下**はPRをCloseするだけ
- 投稿済みファイルは `posts/published/YYYY-MM/` へ自動移動され、投稿URL付きで履歴が残ります

## セットアップ

### 1. デフォルトブランチを確認

このリポジトリのデフォルトブランチにこの一式が入っている状態にしてください(このブランチをマージ or デフォルトに設定)。定期実行のワークフローはデフォルトブランチから動きます。

### 2. GitHub Secrets を設定

リポジトリの **Settings → Secrets and variables → Actions** で以下を登録します。

| Secret | 用途 | 取得方法 |
|---|---|---|
| `ANTHROPIC_API_KEY` | 下書き生成 (Claude) | [Claude Console](https://platform.claude.com/) でAPIキーを発行 |
| `X_API_KEY` | X投稿 | [X Developer Portal](https://developer.x.com/) でアプリ作成 → API Key |
| `X_API_SECRET` | X投稿 | 同上 → API Key Secret |
| `X_ACCESS_TOKEN` | X投稿 | 同上 → Access Token (**Read and Write** 権限で発行) |
| `X_ACCESS_TOKEN_SECRET` | X投稿 | 同上 → Access Token Secret |
| `IG_USER_ID` | Instagram投稿 | InstagramビジネスアカウントのユーザーID (Meta Graph API) |
| `IG_ACCESS_TOKEN` | Instagram投稿 | Meta開発者ポータルで長期アクセストークンを発行 |

XのみでスタートするならIG系のSecretsは未設定でOKです(Instagram指定の下書きだけ失敗し、Xは正常に動きます)。

### 3. 発信内容をカスタマイズ

[`config/settings.mjs`](config/settings.mjs) を編集します:

- `persona` — 文体・キャラクター
- `topics` — 発信テーマ(AIがここからWeb検索で調査)
- `slots` / `postsPerDay` — 投稿時刻と1日の本数
- `hashtags` — ハッシュタグ候補
- `photo` — 写真投稿のキャプションスタイル・ハッシュタグ・投稿先

### 4. 動作確認

- **Actions → 「下書き生成」→ Run workflow** で手動実行 → PRが作成されることを確認
- PRをマージ → 予約時刻を過ぎると **「予約投稿」** ワークフローが自動投稿します(手動実行も可能)

## 下書きファイルの形式

`posts/queue/2026-07-21-1200.md` のような形式です(サンプル: [`posts/_example.md`](posts/_example.md)):

```markdown
---
platforms: [x]
scheduled_at: 2026-07-21T12:00:00+09:00
---

投稿本文がここに入ります。
```

- `platforms` — `x` / `instagram`(両方指定可)
- `scheduled_at` — この時刻を過ぎた最初のチェックで投稿(1時間間隔)
- `image` — Instagram投稿時は必須。`images/` に画像を置いてパスを指定

手動で下書きを追加したい場合も、このファイルを `posts/queue/` に置いてマージするだけです。

本文に `<!-- instagram -->` マーカーを入れると、前半がX用・後半がInstagram用に分かれます(写真キャプションで自動的に使われます)。

## 📷 写真投稿ワークフロー(SIGMA fp向け)

撮った写真を投稿まで持っていくハードルを下げるための仕組みです。

1. **写真を `photos/inbox/` に置く**
   - **Mac mini**: 書き出しフォルダに入れるだけで自動送信できます → [`local/README.md`](local/README.md)
   - **スマホ**: GitHubをブラウザで開いて `photos/inbox` → `Add file` → `Upload files`
   - JPEG/PNG/WebPに対応(RAW/DNGは書き出してから)
2. 置いた瞬間にActionsが起動し、**AIが写真を見てキャプション案を作成**、承認用PRを作ります
   - 画像は自動で長辺2048pxに縮小して `images/YYYY-MM/` にコミット(リポジトリが重くならない)
   - 投稿枠は既存の予約と被らない翌日以降の空きスロットに自動割り当て
3. **PRでキャプションを確認してMerge** — 直したければ編集してからマージ
4. 予約時刻に **Xへ画像付きポスト**として自動投稿(`platforms` に `instagram` を足せばIGにも)

キャプションの文体・ハッシュタグは `config/settings.mjs` の `photo` セクションで調整できます。

## Instagram利用時の注意

Instagram Graph APIは**公開URLの画像**しか受け付けません。

- リポジトリが **public** の場合: `config/settings.mjs` の `imageBaseUrl` に
  `https://raw.githubusercontent.com/<owner>/<repo>/main` を設定すればリポジトリ内の画像がそのまま使えます
- **private** の場合: 画像を公開ホスティング(S3等)に置き、そのベースURLを設定してください

また、Instagramは画像必須のため、AIが生成するのはXの下書きのみです(PR本文に画像案は添えられます)。Instagramにも出したい下書きは、PR上で画像を追加し `platforms` に `instagram` を足してからマージしてください。

## 安全設計

- **公開は必ず人間承認** — マージされない限り1文字も投稿されません
- **二重投稿防止** — 投稿成功はファイルに記録され、リトライ時にスキップされます
- **文字数チェック** — PRのCIがX文字数制限(280重み)や必須項目を検証し、不正な下書きはマージ前に落とします
- **履歴が全部残る** — 誰がいつ何を承認・投稿したかgit履歴で追跡できます

## コスト目安

- **GitHub Actions**: publicリポジトリは無料・無制限。privateでも投稿チェックは1時間間隔なので月2,000分の無料枠に収まる
- **X API**: Freeプランで投稿可能(月500〜1,500件の上限。1日3件なら余裕)
- **Instagram Graph API**: 無料(ビジネス/クリエイターアカウントが必要)
- **Claude API(下書き生成のみ有料)**: 従量課金。1日1回のWeb検索付き生成で目安 月数百円〜1,500円程度

### 完全無料で運用する方法

下書き生成を手動に切り替えれば、承認→予約投稿のパイプラインは完全無料で回ります:

1. Claude.ai(無料プラン)などで下書きを作る
2. `posts/queue/` にファイルを置いてPRを作る(形式は `posts/_example.md` 参照)
3. Merge = 承認 → 予約時刻に自動投稿

自動生成(`ANTHROPIC_API_KEY`)はあとから追加できます。
