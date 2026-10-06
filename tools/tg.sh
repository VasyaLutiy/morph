#!/usr/bin/env bash
# Post one message to the operator's Telegram channel. Reads TG_BOT_TOKEN and TG_CHAT_ID
# from $MORPH_TG_ENV (default /root/.config/morph/tg.env, mode 600, written by the operator).
# Usage: tools/tg.sh "text"   or   some-command | tools/tg.sh
# Never prints the token; silent no-op (exit 0) when the env file is absent, so a missing
# channel never breaks a phase.
set -u
ENV_FILE="${MORPH_TG_ENV:-/root/.config/morph/tg.env}"
[ -r "$ENV_FILE" ] || exit 0
# shellcheck disable=SC1090
. "$ENV_FILE"
[ -n "${TG_BOT_TOKEN:-}" ] && [ -n "${TG_CHAT_ID:-}" ] || exit 0
if [ $# -gt 0 ]; then TEXT="$*"; else TEXT="$(cat)"; fi
TEXT="[$(hostname) $(date +%H:%M)] ${TEXT}"
TEXT="${TEXT:0:3900}"
curl -sS -m 20 -o /dev/null -X POST "https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${TG_CHAT_ID}" --data-urlencode "text=${TEXT}" \
  --data-urlencode "disable_web_page_preview=true" || true
exit 0
