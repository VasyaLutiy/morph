#!/usr/bin/env bash
# Claude Code hook → Telegram. Receives the hook's JSON on stdin; posts a one-line event.
# Wired in .claude/settings.json for Stop (the session stopped: finished or waiting for
# input) and Notification (permission prompt or idle notice). Needs tools/tg.sh.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
EVENT="${1:-event}"
INPUT="$(cat)"
LAST="$(printf '%s' "$INPUT" | python3 -c '
import json,sys
try:
    d=json.load(sys.stdin)
except Exception:
    print(""); sys.exit()
msg=d.get("message") or d.get("title") or ""
tp=d.get("transcript_path")
if not msg and tp:
    try:
        last=""
        for line in open(tp, encoding="utf-8"):
            try: o=json.loads(line)
            except Exception: continue
            m=o.get("message") or {}
            if o.get("type")=="assistant" and isinstance(m.get("content"),list):
                t=" ".join(b.get("text","") for b in m["content"] if b.get("type")=="text").strip()
                if t: last=t
        msg=last
    except Exception:
        pass
print(msg[:1500])
' 2>/dev/null)"
"$HERE/tg.sh" "claude ${EVENT}: ${LAST:-(no text)}"
exit 0
