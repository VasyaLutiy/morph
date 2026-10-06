#!/usr/bin/env bash
# Start (or re-attach to) the autonomous MorphV2 session on the VPS inside tmux.
#   tools/vps-start.sh            start the session "morph" if it is not running
#   tools/vps-start.sh attach     attach to it (detach with Ctrl-b d)
#   tools/vps-start.sh log        follow the session log
# The session survives an SSH drop. Log: /root/morph-logs/session-<date>.log
set -eu
REPO="$(cd "$(dirname "$0")/.." && pwd)"
LOGDIR=/root/morph-logs; mkdir -p "$LOGDIR"
LOG="$LOGDIR/session-$(date +%Y%m%d-%H%M).log"
export PATH="$HOME/.local/bin:$PATH"
case "${1:-start}" in
  attach) exec tmux attach -t morph ;;
  log) exec tail -n 200 -f "$(ls -t $LOGDIR/session-*.log | head -1)" ;;
  start)
    if tmux has-session -t morph 2>/dev/null; then echo "session 'morph' already runs: tools/vps-start.sh attach"; exit 0; fi
    PROMPT='Read CLAUDE.md, then docs/AUTONOMY.md in full: it is the regulation that replaces the operator. Then docs/PLAN.md section "Фазы по записи (после P2)" and docs/MEASURE.md. Work the phases from P3 onward by that regulation, one phase at a time, each with a fresh orchestrator agent for the preparation and a fresh one for the run, as described in AUTONOMY.md. Post to the operator with tools/tg.sh at every milestone AUTONOMY.md names (phase start, gate result, run result with numbers, merge, any stop) and stop when the regulation says to stop.'
    tmux new-session -d -s morph -c "$REPO" "claude --dangerously-skip-permissions \"$PROMPT\"; echo; echo '[claude exited]'; sleep 86400"
    tmux pipe-pane -t morph -o "cat >> '$LOG'"
    "$REPO/tools/tg.sh" "MorphV2 autonomous session started on $(hostname); log $LOG"
    echo "started tmux session 'morph'; attach: tools/vps-start.sh attach; log: $LOG"
    ;;
  *) echo "usage: $0 [start|attach|log]"; exit 2 ;;
esac
