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
    "$TG" watchdog "tmux session 'morph' is not running" "start it: tools/vps-start.sh"; touch "$STATE/dead"; fi
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
      tmux send-keys -t morph C-u
      tmux send-keys -t morph -l "Continue by docs/AUTONOMY.md from where you stopped; the usage window has reset. Post the current state to tools/tg.sh first."
      sleep 2; tmux send-keys -t morph C-m
      "$TG" watchdog "Limit on screen, nudged the session" "nudge $N of 12"
    fi
  fi
else
  rm -f "$STATE/nudges"
  # A stall: the screen unchanged for three checks (~30 min), no mrph run in flight and no
  # background agent on screen → the main turn ended without anyone to wake it. Nudge once per stall.
  S=0
  if [ "$SUM" = "$PREV" ]; then
    S=$(( $(cat "$STATE/same" 2>/dev/null || echo 0) + 1 )); printf '%s' "$S" > "$STATE/same"
  else
    printf '0' > "$STATE/same"; rm -f "$STATE/stalled"
  fi
  # A run in flight = the mrph interpreter itself; `pgrep -f "mrph run"` also matched the
  # sessions' own wait loops (same words in their command line) and hid a 30-min stall (06.10).
  # An agent on screen excuses 30 min of silence, not 60: a hung agent shows its row too.
  if [ "$S" -ge 3 ] && ! pgrep -f '^[^ ]*python3? [^ ]*mrph run' >/dev/null && [ ! -f "$STATE/stalled" ] &&
     { [ "$S" -ge 6 ] || ! printf '%s' "$PANE" | grep -qiE "waiting for .*agent|background agent|tokens$"; }; then
    tmux send-keys -t morph C-u
    tmux send-keys -t morph -l "Nothing has happened on this screen for 30 minutes and no run is in flight. Check the state of your agents and the run branch, then continue by docs/AUTONOMY.md from where you are; post the current state to tools/tg.sh first."
    sleep 2; tmux send-keys -t morph C-m
    touch "$STATE/stalled"
    "$TG" watchdog "Stall, nudged the session" "screen unchanged 30 min · no run in flight"
  fi
fi
exit 0
