#!/bin/bash
#
# Mac mini に写真の自動同期を常駐させるセットアップスクリプト。
#
#   bash local/install-macos.sh [監視フォルダ]
#
# 監視フォルダを省略すると ~/Pictures/sns-inbox を使う。
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WATCH_DIR="${1:-$HOME/Pictures/sns-inbox}"
LABEL="com.snsautopilot.syncphotos"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_FILE="$HOME/Library/Logs/sns-autopilot.log"

echo "リポジトリ : $REPO_DIR"
echo "監視フォルダ: $WATCH_DIR"

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "エラー: $REPO_DIR はgitリポジトリではありません" >&2
  exit 1
fi

mkdir -p "$WATCH_DIR" "$HOME/Library/LaunchAgents" "$(dirname "$LOG_FILE")"
chmod +x "$REPO_DIR/local/sync-photos.sh"

cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$REPO_DIR/local/sync-photos.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>SNS_REPO_DIR</key>
    <string>$REPO_DIR</string>
    <key>SNS_WATCH_DIR</key>
    <string>$WATCH_DIR</string>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>StartInterval</key>
  <integer>120</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$LOG_FILE</string>
  <key>StandardErrorPath</key>
  <string>$LOG_FILE</string>
</dict>
</plist>
PLIST_EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

cat <<DONE

✅ セットアップ完了。2分おきに監視フォルダをチェックします。

  写真の置き場所 : $WATCH_DIR
  送信済みの保管先: $WATCH_DIR/_sent
  ログ           : $LOG_FILE

使い方:
  1. 現像した写真(JPEG)を $WATCH_DIR に書き出す
  2. 数分後、GitHubに承認用PRが立つ
  3. スマホでPRを確認して Merge すれば予約投稿される

動作確認:
  tail -f "$LOG_FILE"

停止したいとき:
  launchctl unload "$PLIST"

DONE
