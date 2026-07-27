# 引き継ぎメモ（スマホ / Dispatch 用）

このファイルは、PCで進めた作業をスマホ（Dispatch）から続けるための引き継ぎ資料です。
迷ったらこのファイルを開けば現在地がわかります。

- リポジトリ: `aivivi0305-png/-`（public）
- 稼働ブランチ: `claude/blue-selection-impl-k0963b`（**これがデフォルトブランチ。マージ作業は不要**）
- 関連Issue: [#1](https://github.com/aivivi0305-png/-/issues/1)
- 元セッションID: `session_017ZGxZaGkGUsZzGaoYgBc7p`

---

## Dispatchでの始め方

Dispatchでこのリポジトリを選んで新しいセッションを開き、以下をそのまま貼り付ければ続きから始められます。

```
リポジトリ直下の HANDOFF.md を読んで、現在地と次の作業を把握して。
そのうえで「次にやること」の先頭から一緒に進めたい。
```

---

## これは何のシステムか

**調査・下書き・投稿予約までAIがやり、公開の最終判断だけ人間がする**半自動SNS運用の仕組み。
サーバー不要で、GitHubだけで完結する。

```
【テキスト】毎朝6時（JST）      あなた                  毎時5分
 AIがWeb検索で調査 → 下書き →  PRをMerge（=承認）  →  予約時刻が来たら
【写真】photos/inbox に置く      編集・却下も可能        X / Instagram へ投稿
 → AIが写真を見てキャプション
```

**マージしない限り、1文字も投稿されない。** これが安全装置。

---

## 今どうなっているか

### ✅ 完成・稼働中

| 内容 | 状態 |
|---|---|
| コード一式（スクリプト4本・ワークフロー4本・設定ファイル） | 完成・push済み |
| GitHub Actions 3本が `active` で登録済み | 稼働中 |
| 毎朝6時の下書き生成が自動実行されている | 実行済み（7/17〜7/20 に4回） |
| ローカルでの動作テスト（検証・投稿ドライラン・画像リサイズ） | 確認済み |

### ⚠️ ただし、まだ投稿はされない

自動実行は動いているが、**4回とも `ANTHROPIC_API_KEY` が未設定で失敗**している。
（ログ確認済み: checkout ✅ → npm install ✅ → 下書き生成ステップで1秒で失敗）

**つまり「あとはAPIキーを登録するだけ」の状態。**

---

## 次にやること

### STEP 1 ── Xのキーを4つ取る（唯一の山場・無料）

1. [developer.x.com](https://developer.x.com/en/portal/dashboard) にXアカウントでログイン
2. 無料プラン（Free）でアプリを1つ作成
3. アプリ設定 → **User authentication settings** で権限を **Read and Write** にする
   - ⚠️ ここを先にやらないと、投稿できないトークンが発行されてしまう
4. **Keys and tokens** タブで以下4つをコピー
   - API Key
   - API Key Secret
   - Access Token
   - Access Token Secret

### STEP 2 ── GitHub Secrets に登録

[Settings → Secrets → Actions](https://github.com/aivivi0305-png/-/settings/secrets/actions) を開き、「New repository secret」で登録する。

| Name | 中身 |
|---|---|
| `X_API_KEY` | API Key |
| `X_API_SECRET` | API Key Secret |
| `X_ACCESS_TOKEN` | Access Token |
| `X_ACCESS_TOKEN_SECRET` | Access Token Secret |
| `ANTHROPIC_API_KEY` | [Claude Console](https://platform.claude.com/) で発行（AI下書きを使う場合） |

Instagram（`IG_USER_ID` / `IG_ACCESS_TOKEN`）は後回しでよい。

### STEP 3 ── 動作確認

- [Actions](https://github.com/aivivi0305-png/-/actions) → 「下書き生成」→ **Run workflow** を手動実行
- 数分後に承認用PRが立てば成功
- または `photos/inbox/` に写真を1枚アップして写真フローを試す

### STEP 4 ── 自分好みに調整（任意・いつでも可）

`config/settings.mjs` を編集する。

- `persona` — 文体・キャラクター
- `topics` — 発信テーマ
- `slots` / `postsPerDay` — 投稿時刻と本数
- `photo.style` / `photo.hashtags` — 写真キャプションの雰囲気

---

## 日々の使い方（キー登録後）

### 写真を投稿する（SIGMA fp）

1. スマホでGitHubを開き、`photos/inbox` → **Add file** → **Upload files** で写真をアップ（JPEG）
2. 数分待つとAIがキャプションを書いてPRを作る
3. PRを開いて確認 → **Merge（=承認）**。直したければ編集してからMerge
4. 予約時刻にXへ画像付きで自動投稿

### テキストを投稿する

- **AIまかせ**: 毎朝6時に下書きPRが立つので、確認してMergeするだけ
- **自分で書く**: `posts/queue/` にファイルを1つ置いてMerge

### 却下したいとき

PRを **Close** するだけ。何も投稿されない。

---

## お金の話

| 項目 | 費用 |
|---|---|
| GitHub Actions | 無料（publicリポジトリは無制限） |
| X API | 無料（Freeプランで投稿可） |
| Instagram Graph API | 無料 |
| Claude API | **ここだけ従量課金**。目安 月数百円〜1,500円 |

`ANTHROPIC_API_KEY` を登録せず、自分で下書きを書けば**完全無料**でも回る。

---

## ファイル構成

```
config/settings.mjs          ← 発信内容の設定（ここを編集する）
scripts/
  generate.mjs               テキスト下書き生成（Web検索付き）
  caption.mjs                写真キャプション生成
  publish.mjs                予約投稿（X / Instagram）
  validate.mjs               下書きの検証
  util.mjs                   共通処理（文字数計算・OAuth署名など）
.github/workflows/
  generate-drafts.yml        毎朝6時JST（cron: 0 21 * * *）
  caption-photos.yml         photos/inbox への push で起動
  publish.yml                毎時5分（cron: 5 * * * *）
  validate.yml               PRで下書きを検証
posts/queue/                 承認待ち・投稿待ちの下書き
posts/published/YYYY-MM/     投稿済み（投稿URL付きで履歴が残る）
photos/inbox/                ここに写真を置くとキャプション生成が走る
images/YYYY-MM/              リサイズ済み画像（自動でコミットされる）
```

---

## 今後やりたいこと（未着手）

- [ ] Instagram の本番投稿（ビジネスアカウント化・画像の公開URL設定が前提）
- [ ] note / ブログなど記事系への下書き出力
- [ ] 投稿の反応（インプレッション等）を取得して次の企画に反映

---

## 詰まったときのヒント

| 症状 | 原因・対処 |
|---|---|
| ワークフローが失敗する | Actions のログで失敗ステップを見る。だいたいSecretsの未設定か綴り間違い |
| 投稿されない | ①PRをMergeしたか ②`scheduled_at` を過ぎているか ③Xのトークンが Read and Write か |
| PRのCIが赤い | 文字数超過か必須項目の不足。エラーメッセージに該当ファイルが出る |
| 画像がInstagramに出ない | 画像の公開URL（`imageBaseUrl`）が未設定 |

詳しい仕様は [README.md](README.md) を参照。
