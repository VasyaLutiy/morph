#!/usr/bin/env bash
# Watchdog for the autonomous tmux session "morph" (cron, every 10 minutes, as user morph).
# If the pane shows a usage/rate limit message and the screen has not changed since the last
# check, nudge the session to continue (the limit window has likely reset) and tell the operator.
# If the session is gone, tell the operator once per hour. Never starts a paid run itself.
set -u
export PATH="$HOME/.local/bin:$PATH" TERM=xterm-256color
HERE="$(cd "$(dirname "$0")" && pwd)"
TG="$HOME/MorphV2/tools/tg.sh"; [ -x "$TG" ] || TG="$HERE/tg.sh"
STATE="$HOME/.morph-watchdog"; mkdir -p "$STATE"
if ! tmux has-session -t morph 2>/dev/null; then
  if [ ! -f "$STATE/dead" ] || [ $(( $(date +%s) - $(stat -c %Y "$STATE/dead") )) -gt 3600 ]; then
    "$TG" "watchdog: tmux session 'morph' is not running"; touch "$STATE/dead"; fi
  exit 0
fi
rm -f "$STATE/dead"
PANE="$(tmux capture-pane -pt morph -S -40 2>/dev/null)"
SUM="$(printf '%s' "$PANE" | md5sum | cut -c1-12)"
PREV="$(cat "$STATE/sum" 2>/dev/null || true)"; printf '%s' "$SUM" > "$STATE/sum"
if printf '%s' "$PANE" | grep -qiE "limit reached|usage limit|rate limit|out of extra usage|resets at|try again"; then
  if [ "$SUM" = "$PREV" ]; then
    N=$(( $(cat "$STATE/nudges" 2>/dev/null || echo 0) + 1 )); printf '%s' "$N" > "$STATE/nudges"
    if [ "$N" -le 12 ]; then
      tmux send-keys -t morph "Continue by docs/AUTONOMY.md from where you stopped; the usage window has reset. Post the current state to tools/tg.sh first." Enter
      "$TG" "watchdog: limit message on screen, nudged the session (nudge $N)"
    fi
  fi
else
  rm -f "$STATE/nudges"
fi
exit 0
