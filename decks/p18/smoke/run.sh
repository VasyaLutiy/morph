#!/usr/bin/env bash
# P18 smoke (issue #9 acceptance), run by the main session after the merge. Per language: `morph init` into
# $OUT/<language> from the binary copy's templates/, the leak check on the new project, the 2-Function record, map,
# checks and probes of decks/p18/smoke/<language>/ copied over it, a git repo, then `morph plan` (typescript and go with
# --checks; python with the map's acceptances: no python acceptance builder) and `morph deck check`. $0 so far.
# With S1_RUN=1 and the language go, the Go deck (4 cards) runs on processor ds, maxTokens x3 by the new project's own
# decks/tools/scale_tokens.py; the key goes from morph-lab/.env by indirection, never printed (cap $0.02).
#   BIN=/tmp/v2bin-p18s OUT=/tmp/p18-smoke decks/p18/smoke/run.sh [typescript] [go] [python]
# The binary copy: rm -rf $BIN && mkdir -p $BIN && cp -r dist $BIN/ && ln -s $PWD/node_modules $BIN/node_modules &&
#   ln -s $PWD/templates $BIN/templates      (defaultTemplatesDir() of $BIN/dist/scaffold/initProject.js = $BIN/templates)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
BIN="${BIN:-/tmp/v2bin-p18s}"
OUT="${OUT:-/tmp/p18-smoke}"
M="node $BIN/dist/cli.js"
mkdir -p "$OUT"
export GIT_AUTHOR_NAME=Smoke GIT_AUTHOR_EMAIL=smoke@example.invalid GIT_COMMITTER_NAME=Smoke GIT_COMMITTER_EMAIL=smoke@example.invalid
for L in "${@:-typescript go python}"; do
  for L1 in $L; do
    D="$OUT/$L1"; rm -rf "$D"
    case "$L1" in
      typescript) NAME=slugs; MOD=""; C=text ;;
      python) NAME=slugs; MOD=""; C=text ;;
      go) NAME=mini; MOD="--module mini"; C=calc ;;
      *) echo "unknown language $L1"; exit 2 ;;
    esac
    # shellcheck disable=SC2086
    $M init --root "$D" --name "$NAME" --language "$L1" $MOD > "$OUT/$L1.init.json"; IE=$?
    FILES=$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(len(d.get("files", [])))' "$OUT/$L1.init.json")
    "$HERE/leak.sh" "$D" > "$OUT/$L1.leak.txt"; LE=$?
    cp -r "$HERE/$L1/." "$D/"
    git -C "$D" init -q -b main && git -C "$D" add -A && git -C "$D" commit -qm "init $NAME ($L1) + smoke record"
    if [ "$L1" = python ]; then CHECKS=""; else CHECKS="--checks decks/s1/checks.json"; fi
    # shellcheck disable=SC2086
    $M plan --root "$D" --spec contour.yaml --map morph-map.json --component "$C" --judge $CHECKS --out decks/s1/deck.json > "$OUT/$L1.plan.json"; PE=$?
    CARDS=$(python3 -c 'import json,sys; print(len(json.load(open(sys.argv[1]))))' "$D/decks/s1/deck.json" 2>/dev/null || echo 0)
    $M deck check --root "$D" --deck decks/s1/deck.json > "$OUT/$L1.check.json"; DE=$?
    ERR=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("errors"))' "$OUT/$L1.check.json" 2>/dev/null || echo "?")
    git -C "$D" add -A && git -C "$D" commit -qm "deck s1" || true
    echo "$L1: init exit $IE ($FILES files) · leak exit $LE · plan exit $PE ($CARDS cards) · deck check exit $DE (errors $ERR)"
    if [ "$L1" = go ] && [ "${S1_RUN:-0}" = 1 ]; then
      python3 "$D/decks/tools/scale_tokens.py" "$D/decks/s1/deck.json" 3 && git -C "$D" commit -qam "deck s1 x3"
      (
        set -a; . /home/morph/MorphProject/morph-lab/.env; set +a
        for k in TYPE API_KEY MODEL ROUTE CONCURRENCY PROVIDER_ORDER REASONING_MAX_TOKENS; do
          v="MRPH_PROCESSOR_ds_$k"; [ -n "${!v:-}" ] && export "MORPH_PROCESSOR_ds_$k=${!v}"
        done
        for v in $(compgen -e | grep -E '^(MRPH_|JEV_)'); do unset "$v"; done
        t0=$(date +%s)
        $M run --root "$D" --deck decks/s1/deck.json --processor ds --deadline 900 > "$OUT/go.run.json" 2> "$OUT/go.run.err"
        rc=$?; t1=$(date +%s)
        python3 - "$OUT/go.run.json" "$rc" "$((t1-t0))" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
o = d["report"]["outcomes"]
w = sum(1 for x in o if x["status"] == "written")
print(f"go run: exit {sys.argv[2]} · {w}/{len(o)} written · ${d['report']['usageTotals'].get('cost', 0):.4f} · {int(sys.argv[3])/60:.1f} min · run {d['runId']}")
PY
      )
    fi
  done
done
