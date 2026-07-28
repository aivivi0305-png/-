#!/bin/bash
#
# Mac mini 用の写真同期スクリプト。
# 監視フォルダに書き出された写真を GitHub の photos/inbox/ へ push する。
# push されると GitHub Actions が起動し、AIがキャプションを書いて承認用PRを作る。
#
# launchd から2分おきに実行される想定(local/install-macos.sh がセットアップする)。
# 手動実行も可能: bash local/sync-photos.sh
#
set -uo pipefail

REPO_DIR="${SNS_REPO_DIR:-$HOME/sns-autopilot}"
WATCH_DIR="${SNS_WATCH_DIR:-$HOME/Pictures/sns-inbox}"
SENT_DIR="$WATCH_DIR/_sent"
LOCK_DIR="${TMPDIR:-/tmp}/sns-autopilot-sync.lock"
# 書き出し途中のファイルを掴まないよう、更新から一定時間経ったものだけ扱う(分)
MIN_AGE_MIN="${SNS_MIN_AGE_MIN:-1}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# 二重起動を防ぐ(前回の処理が長引いている場合は何もしない)
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  log "前回の同期が実行中のためスキップします"
  exit 0
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null' EXIT

if [ ! -d "$WATCH_DIR" ]; then
  log "監視フォルダが見つかりません: $WATCH_DIR"
  exit 0
fi
if [ ! -d "$REPO_DIR/.git" ]; then
  log "gitリポジトリが見つかりません: $REPO_DIR"
  log "SNS_REPO_DIR を正しいパスに設定してください"
  exit 1
fi

# 書き出しが完了した画像だけを対象にする(_sent 配下は対象外)
FILES=$(find "$WATCH_DIR" -maxdepth 1 -type f -mmin "+$MIN_AGE_MIN" \
  \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) 2>/dev/null)
if [ -z "$FILES" ]; then
  exit 0
fi

cd "$REPO_DIR" || exit 1
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# 先にリモートへ追従しておく(Actionsがinbox整理をpushしているため)
if ! git pull --rebase --quiet origin "$BRANCH"; then
  log "pull に失敗しました。次回の実行でリトライします"
  exit 1
fi

mkdir -p photos/inbox "$SENT_DIR"

COUNT=0
while IFS= read -r src; do
  [ -n "$src" ] || continue
  base=$(basename "$src")
  dest="photos/inbox/$base"
  # 同名ファイルがすでにある場合は連番を付けて衝突を避ける
  n=1
  while [ -e "$dest" ]; do
    dest="photos/inbox/${base%.*}-${n}.${base##*.}"
    n=$((n + 1))
  done
  if cp "$src" "$dest" && mv "$src" "$SENT_DIR/"; then
    COUNT=$((COUNT + 1))
    log "追加: $base"
  else
    log "コピーに失敗: $base"
  fi
done <<< "$FILES"

[ "$COUNT" -gt 0 ] || exit 0

git add photos/inbox
if git diff --cached --quiet; then
  log "コミットする変更がありません"
  exit 0
fi

git -c user.name="sns-autopilot" \
    -c user.email="sns-autopilot@localhost" \
    commit -q -m "photos: ${COUNT}枚を追加 ($(date '+%Y-%m-%d %H:%M'))"

for attempt in 1 2 3; do
  if git push --quiet origin "$BRANCH"; then
    log "${COUNT}枚をpushしました。GitHubでキャプション生成が始まります"
    exit 0
  fi
  log "push に失敗。リトライします ($attempt/3)"
  git pull --rebase --quiet origin "$BRANCH" || true
  sleep 5
done

log "push に失敗しました。ネットワークまたはgitの認証設定を確認してください"
log "コミットはローカルに残っているので、認証を直せば次回の実行でpushされます"
exit 1
