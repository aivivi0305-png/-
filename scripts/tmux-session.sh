#!/bin/bash
# Brings up (or re-attaches to) a tmux session for this repo.
#
#   ./scripts/tmux-session.sh          # 起動して attach
#   ./scripts/tmux-session.sh --no-attach
#
# 前提: 批評/週次ランナーはローカルの Codex / Claude CLI を叩くため、
# このセッションは作業マシン(Mac)上で動かすことを想定しています。
#
# Windows:
#   0 work    — リポジトリ直下のシェル(Claude Code / git 用)
#   1 hub     — Taste Engine の開発サーバ(コマンドは入力済み・Enterで起動)
#   2 critique— 批評ランナーの常駐(Telegramに送ると数分後に批評が返る)
#   3 weekly  — 週次レポートの手動実行用(コマンドは入力済み)
set -euo pipefail

SESSION="${TASTE_TMUX_SESSION:-taste}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CRITIQUE_INTERVAL="${TASTE_CRITIQUE_INTERVAL:-300}"
ATTACH=1
[ "${1:-}" = "--no-attach" ] && ATTACH=0

if ! command -v tmux >/dev/null 2>&1; then
  echo "tmux が見つかりません。先にインストールしてください (brew install tmux)。" >&2
  exit 1
fi

# 既存セッションがあれば作り直さず、そのまま繋ぐ(作業中のペインを壊さない)。
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "既存のセッション '$SESSION' に接続します。"
else
  echo "セッション '$SESSION' を作成します (root: $ROOT)"

  tmux new-session -d -s "$SESSION" -n work -c "$ROOT"
  tmux send-keys -t "$SESSION:work" "cat HANDOFF.md | head -40" C-m

  tmux new-window -t "$SESSION" -n hub -c "$ROOT/taste-engine"
  # 開発サーバは勝手に起動せず、入力だけしておく(ポート衝突を避けるため)。
  tmux send-keys -t "$SESSION:hub" "npm run dev"

  tmux new-window -t "$SESSION" -n critique -c "$ROOT"
  if [ -f "${TASTE_ENGINE_WEEKLY_CONFIG:-$HOME/.config/taste-engine/weekly.json}" ]; then
    tmux send-keys -t "$SESSION:critique" \
      "node taste-engine/scripts/run-critique.mjs --watch $CRITIQUE_INTERVAL" C-m
  else
    tmux send-keys -t "$SESSION:critique" \
      "echo '設定ファイルが未作成です: ~/.config/taste-engine/weekly.json (baseUrl と secret)'" C-m
    tmux send-keys -t "$SESSION:critique" \
      "node taste-engine/scripts/run-critique.mjs --watch $CRITIQUE_INTERVAL"
  fi

  tmux new-window -t "$SESSION" -n weekly -c "$ROOT"
  tmux send-keys -t "$SESSION:weekly" "node taste-engine/scripts/run-weekly-free.mjs"

  tmux select-window -t "$SESSION:work"
fi

if [ "$ATTACH" -eq 1 ]; then
  if [ -n "${TMUX:-}" ]; then
    tmux switch-client -t "$SESSION"
  else
    tmux attach-session -t "$SESSION"
  fi
else
  echo "起動しました。接続: tmux attach -t $SESSION"
fi
