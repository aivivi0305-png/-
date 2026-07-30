#!/bin/bash
#
# tmux で作業環境を立ち上げる。
#
#   bash local/tmux-start.sh
#
# ウィンドウ構成:
#   1. claude — Claude Code(このリポジトリの文脈で作業する)
#   2. logs   — 写真同期のログを追尾
#   3. shell  — git操作などの作業用
#
# tmuxを使うと、SSHが切れてもMac mini側で作業が生き続けます。
# 切断: Ctrl-b d   /   再接続: bash local/tmux-start.sh (または tmux attach -t sns)
#
set -uo pipefail

SESSION="${SNS_TMUX_SESSION:-sns}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ログの場所(macOSとそれ以外で分ける)
if [ -n "${SNS_LOG_FILE:-}" ]; then
  LOG_FILE="$SNS_LOG_FILE"
elif [ "$(uname -s)" = "Darwin" ]; then
  LOG_FILE="$HOME/Library/Logs/sns-autopilot.log"
else
  LOG_FILE="${TMPDIR:-/tmp}/sns-autopilot.log"
fi

if ! command -v tmux >/dev/null 2>&1; then
  echo "tmux が入っていません。先にインストールしてください:" >&2
  echo "  brew install tmux" >&2
  exit 1
fi

attach() {
  # すでにtmuxの中にいる場合は attach できないので切り替える
  if [ -n "${TMUX:-}" ]; then
    tmux switch-client -t "$SESSION"
  else
    tmux attach-session -t "$SESSION"
  fi
}

# すでにセッションがあればそこへ戻るだけ
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "既存のセッション '$SESSION' に接続します"
  attach
  exit 0
fi

echo "セッション '$SESSION' を作成します (リポジトリ: $REPO_DIR)"
mkdir -p "$(dirname "$LOG_FILE")"
touch "$LOG_FILE" 2>/dev/null || true

# --- 1) claude ウィンドウ ---
tmux new-session -d -s "$SESSION" -n claude -c "$REPO_DIR"

if command -v claude >/dev/null 2>&1; then
  # 起動と同時に引き継ぎメモを読ませて、前回の続きから入れるようにする
  KICKOFF='リポジトリ直下の HANDOFF.md を読んで、現在地と次の作業を把握して。そのうえで「次にやること」の先頭から一緒に進めたい。'
  tmux send-keys -t "$SESSION:claude" "claude '$KICKOFF'" C-m
else
  tmux send-keys -t "$SESSION:claude" \
    "echo 'Claude Code が未インストールです。次のコマンドで入れてください:'; echo '  npm install -g @anthropic-ai/claude-code'; echo; echo 'インストール後、このウィンドウで claude と打てば起動します。'" C-m
fi

# --- 2) logs ウィンドウ ---
tmux new-window -t "$SESSION" -n logs -c "$REPO_DIR"
tmux send-keys -t "$SESSION:logs" "tail -f '$LOG_FILE'" C-m

# --- 3) shell ウィンドウ ---
tmux new-window -t "$SESSION" -n shell -c "$REPO_DIR"
tmux send-keys -t "$SESSION:shell" "git status --short --branch" C-m

tmux select-window -t "$SESSION:claude"
attach
