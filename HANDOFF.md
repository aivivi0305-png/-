# Taste Engine 作業の引き継ぎ

最終更新: 2026-07-28 / ブランチ: `claude/ai-preference-ui-improve-v10dg5`

---

## 1. 何を目指しているか

**目的は「このハブで何かを生成すること」ではありません。**

実作業は Codex / Claude Code で行う。その一つ一つの作業・プロジェクトにおいて、
**自分の嗜好を理解している参照先があることで、各アウトプットの質を上げる。**

Taste Engine はそのための **Source of Truth(嗜好の参照元)** です。この前提を外して
「ハブ側で制作物を作る」方向に機能を足さないでください。

### 全体のループ

```
Telegramで収集 → 週次で好みプロフィール化 → TASTE.md として各プロジェクトの
エージェントが参照 → 自作品は批評モードで還流 → 収集へ戻る
```

---

## 2. 現在の状態

### 完了していること

| 項目 | 内容 |
|---|---|
| **ソースの取り込み** | ChatGPT側にしかなかった Taste Engine 一式を `taste-engine/` に取り込み済み |
| **UIの可読性改善** | 7〜10pxだった極小フォントを11px以上のタイプスケールに統一、コントラスト改善 |
| **UIの再設計** | 雑誌風レイアウト+固定サイドバー → カード基調のダッシュボード型に全面再設計 |
| **プロフィールの実データ化** | ハードコードだった「94%・秩序の中に…」を、週次レポートの実データ表示に置換(未受信時はサンプル表記) |
| **エージェント連携** | `GET /api/agent/context` + `scripts/taste-context.mjs`。任意プロジェクトで `TASTE.md` を生成 |
| **「制作に使う」の実装** | ダミーボタン → 実データから嗜好コンテキストを組み立ててコピーする実機能に |
| **Claude Code対応** | 週次ランナーを `TASTE_ENGINE_RUNNER=claude` でClaude Code CLIに切り替え可能に(既定はCodexのまま) |
| **批評モード** | Telegramで自作品を送り「批評してもらう」→ ローカルランナーが嗜好と照らした批評を返信 |

コミット(古い順): `b8cf687` → `9d5ec3a` → `31fb858` → `7b0f886`

### ⚠️ 最重要: リポジトリとChatGPT側は別物です

**本番はChatGPTのホスティング(`*.chatgpt.site`)で動いており、このリポジトリからは自動デプロイされません。**
ここでの変更を本番に反映するには、**ChatGPT側のプロジェクトにファイルを手で差し替える**必要があります。

現時点で **ChatGPT側に未反映の可能性が高い**(最後に確認したときは旧デザインのままでした)。

反映するときのChatGPTへの指示文:

> 添付のzip内の `app/`・`lib/`・`scripts/`・`README.md`・`CLAUDE.md` で、現在のプロジェクトの同名ファイルを丸ごと差し替えてください。
> `db/`・`worker/`・`drizzle/`・`.openai/` は変更しないでください。
> コードを改善・整形し直さず、zipの内容をそのまま使ってください。差し替え後、ビルドを確認して再デプロイしてください。

DBスキーマは変更していないため、**マイグレーションは不要**です。

---

## 3. 使うために必要な設定

### ローカル(Mac)の設定ファイル

`~/.config/taste-engine/weekly.json` — 週次ランナー・批評ランナー・コンテキスト取得スクリプトで共通:

```json
{ "baseUrl": "https://<本番URL>", "secret": "<WEEKLY_JOB_SECRET と同じ値>" }
```

### ホスティング側の環境変数

`WEEKLY_JOB_SECRET` が設定済みであること(週次ランナーを動かしていれば設定済みのはず)。
新しい `/api/agent/context` と `/api/jobs/critique` はこの同じシークレットで認証します。

### 各プロジェクトでの使い方

```bash
node /path/to/taste-engine/scripts/taste-context.mjs   # → ./TASTE.md を生成
```

そのプロジェクトの `CLAUDE.md` / `AGENTS.md` に以下を追記:

```markdown
## 嗜好コンテキスト
デザイン・写真・文章・UIなど、見た目や表現の判断が必要な場面では、
まず `TASTE.md`(本人の嗜好コンテキスト)を読んで判断基準にすること。
「知識」セクションは参考情報であり、本人の好みそのものとして扱わないこと。
```

### ランナーの実行

```bash
node taste-engine/scripts/run-weekly-free.mjs        # 週次レポート
node taste-engine/scripts/run-critique.mjs           # 溜まった批評リクエストを1回だけ処理
node taste-engine/scripts/run-critique.mjs --watch 300  # 300秒ごとに常駐(tmuxで放置する用)
# どれも TASTE_ENGINE_RUNNER=claude でClaude Code生成に切り替え可
```

### tmux(ローカル作業環境)

```bash
./scripts/tmux-session.sh          # セッション作成 + 接続
./scripts/tmux-session.sh --no-attach
```

`work` / `hub`(開発サーバ)/ `critique`(批評ランナー常駐)/ `weekly` の4ウィンドウ構成。
開発サーバと週次ランナーは**コマンドを入力しただけの状態**にしてあり、Enterを押すまで起動しません
(ポート衝突や意図しない実行を避けるため)。批評ランナーだけは設定ファイルがあれば自動で常駐します。

環境変数: `TASTE_TMUX_SESSION`(セッション名、既定 `taste`)、`TASTE_CRITIQUE_INTERVAL`(秒、既定 300)。

---

## 4. 今後やること(優先度順)

### A. ChatGPT側へ反映して実機確認 【最優先・未着手】

上記の手順で差し替え・再デプロイし、スマホから実際に触って確認する。
特に確認したいのは、実データが入った状態での好みプロフィール表示と、
「嗜好コンテキストをコピー」がスマホのブラウザで動くか(クリップボードAPIの権限)。

### B. ランナーの定期実行 【tmuxで対応済み・launchd化は任意】

`run-critique.mjs --watch` + `scripts/tmux-session.sh` の `critique` ウィンドウで常駐するようにした。
Telegramに送って放置 → 数分後に批評が返る、という体験はこれで成立する。

残っているのは「Macを再起動しても勝手に復帰する」ようにすること。必要なら
既存の `taste-engine/scripts/com.tasteengine.weekly.plist` を雛形に launchd 化する
(tmuxセッションを立ち上げる方式でも、ランナーを直接叩く方式でもよい)。

### C. SNS Autopilot 側との連携 【未着手・効果大】

このリポジトリ直下のSNS Autopilotが写真キャプションを生成するとき(`scripts/caption.mjs`)、
Taste Engine の嗜好コンテキストを渡せば、**投稿の文体が自分の好みに寄る**。
2つのプロジェクトが同じリポジトリにある利点を活かせる唯一の箇所。

### D. 好みプロフィールの履歴化 【未着手】

`weekly_reports` は週ごとに残っているので、「先週からどう変わったか」を
時系列で見せられる。学習している実感が最も上がる部分。スキーマ変更は不要。

### E. lint既存エラーの解消 【任意】

`app/page.tsx:151` の「setState in effect」エラー。変更前から存在し、
SSR安全のための意図的なパターン。CIでlintを必須にするなら無効化コメントが必要。

---

## 5. 作業時の注意

- **批評エントリ(`learning_mode=critique`)を学習信号に混ぜないこと。** 自作品を「目指したい好み」として
  学習してしまうと嗜好が現状に引きずられる。好み・知識シグナル、週次レポート、
  エージェントコンテキスト、ハブの保存一覧のすべてから除外済み。この設計を壊さないこと。
- **好みと知識を分離すること。** 記事の主張は自動的に本人の好みではない。
- **Telegramの送信済みボタンのコールバック形式を変えないこと。** 過去に送ったメッセージのボタンが壊れる。
- 変更後は `npm run lint --prefix taste-engine` と `npm run build --prefix taste-engine` を通すこと。
