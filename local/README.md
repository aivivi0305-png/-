# Mac mini で写真を自動送信する

現像した写真をフォルダに書き出すだけで、GitHubに自動でアップされ、AIがキャプションを書いて承認用PRを立てるようにします。

```
Lightroom等で書き出し
   ↓ ~/Pictures/sns-inbox に入れる
Mac miniの常駐スクリプトが2分おきに検知して自動push
   ↓
GitHub Actions がAIキャプションを生成して承認PRを作成
   ↓
スマホでPRを確認して Merge（= 承認）
   ↓
予約時刻に X へ画像付きで自動投稿
```

**あなたがやることは「書き出す」と「Mergeする」の2つだけ**になります。

---

## セットアップ（Mac miniで1回だけ）

### 1. リポジトリをclone

```bash
cd ~
git clone https://github.com/aivivi0305-png/-.git sns-autopilot
cd sns-autopilot
```

### 2. gitがpushできる状態にする

すでにMac miniでGitHubにpushできているなら不要です。まだなら [GitHub CLI](https://cli.github.com/) が一番簡単です。

```bash
brew install gh
gh auth login          # ブラウザで認証。「Authenticate Git with your GitHub credentials」を選ぶ
```

認証できているかの確認:

```bash
git -C ~/sns-autopilot push --dry-run
```

エラーが出なければOKです。

### 3. 常駐させる

```bash
bash local/install-macos.sh
```

これだけです。`~/Pictures/sns-inbox` が作られ、2分おきに監視が始まります。

別のフォルダを監視したい場合は引数で指定できます:

```bash
bash local/install-macos.sh ~/Pictures/書き出し/SNS用
```

---

## 使い方

1. 現像した写真を **JPEG** で監視フォルダに書き出す
   - RAW/DNGは非対応です。書き出してから入れてください
2. 数分待つと、GitHubに承認用PRが立ちます
3. スマホでPRを開き、キャプションを確認して **Merge**
4. 予約時刻（デフォルト 12:00 / 19:00 / 21:00）にXへ投稿されます

送信済みの写真は `~/Pictures/sns-inbox/_sent/` に移動します（消えません）。
同じ写真を送り直したい場合は、`_sent` から監視フォルダに戻せばOKです。

---

## 動作確認・トラブル対処

**ログを見る**

```bash
tail -f ~/Library/Logs/sns-autopilot.log
```

**すぐに手動で実行する**（2分待ちたくないとき）

```bash
cd ~/sns-autopilot
SNS_WATCH_DIR=~/Pictures/sns-inbox bash local/sync-photos.sh
```

**一時停止する / 再開する**

```bash
launchctl unload ~/Library/LaunchAgents/com.snsautopilot.syncphotos.plist   # 停止
launchctl load   ~/Library/LaunchAgents/com.snsautopilot.syncphotos.plist   # 再開
```

| 症状 | 原因・対処 |
|---|---|
| 写真が送られない | 書き出し直後1分間は安全のため待機します。1分以上経っても動かなければログを確認 |
| `push に失敗` とログに出る | git認証の問題。`gh auth login` をやり直す。コミットはローカルに残るので、直せば次回送信されます |
| `pull に失敗` とログに出る | ネットワークか、ローカルに未コミットの変更がある可能性。`cd ~/sns-autopilot && git status` を確認 |
| PRが立たない | GitHubのSecretsに `ANTHROPIC_API_KEY` が登録されているか確認（Actionsのログに出ます） |
| 同名ファイルを送った | 自動で `-1`, `-2` と連番が付くので上書きされません |

---

## 仕組みのメモ

- 書き出し途中のファイルを掴まないよう、**更新から1分以上経ったファイルだけ**を対象にします
- 2分おきの起動は launchd の `StartInterval` によるもので、常駐プロセスは残りません（軽量）
- 処理が重なった場合はロックでスキップされ、二重送信は起きません
- Mac miniがスリープしていた場合は、復帰後の次のタイミングでまとめて送信されます
