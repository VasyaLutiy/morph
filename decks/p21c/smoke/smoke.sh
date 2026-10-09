#!/bin/bash
# P21c live smoke: go-p7b, --only 8 cards cut by the run's binary, x3, deck check, control-contract-judge forced red once, run on ds
set -u
R=/home/morph/MorphV2; B=/tmp/v2bin-p21c-run; T=/tmp/p21csmoke; M=$T/mod
IDS=control-contract,phase-loop,runtime-guard,daemon-core,control-contract-judge,phase-loop-judge,runtime-guard-judge,daemon-core-judge
rm -rf $M; mkdir -p $M; cp -r $R/tests/fixtures/go-p7b/. $M/
cp $R/decks/tools/goguard.mjs $M/decks/tools/guard.mjs; cp $R/decks/tools/gofirstdiff.mjs $M/decks/tools/firstdiff.mjs
G="git -C $M -c user.name=Smoke -c user.email=smoke@example.invalid"; $G init -q && $G add -A && $G commit -qm base
node $B/dist/cli.js plan --root $M --spec contour.yaml --map morph-map.json --component control --component supervisor --component daemon --judge --checks decks/b1/checks.json --only $IDS --out $T/deck.json > $T/plan.json 2>&1; echo "plan=$?"
python3 $R/decks/tools/scale_tokens.py $T/deck.json 3
node $B/dist/cli.js deck check --root $M --deck $T/deck.json > $T/check.json 2>&1; echo "check=$?"; tail -c 300 $T/check.json; echo
python3 - $T/deck.json control-contract-judge $T/once <<'PY'
import json, sys
p, card, mark = sys.argv[1:4]
deck = json.load(open(p)); M = '# morph: subset transaction\n'
step = '[ -f ' + mark + ' ] || { touch ' + mark + '; echo "forced red once"; exit 1; }\n'
for c in deck:
    if c['customId'] == card:
        a = c['acceptance']; assert a.startswith(M); c['acceptance'] = M + step + a[len(M):]
open(p, 'w').write(json.dumps(deck, indent=2) + '\n')
PY
rm -f $T/once
(
  set -a; . /home/morph/MorphProject/morph-lab/.env; set +a
  for k in TYPE API_KEY MODEL ROUTE CONCURRENCY PROVIDER_ORDER REASONING_MAX_TOKENS; do
    v="MRPH_PROCESSOR_ds_$k"; [ -n "${!v:-}" ] && export "MORPH_PROCESSOR_ds_$k=${!v}"
  done
  for v in $(compgen -e | grep -E '^(MRPH_|JEV_)'); do unset "$v"; done
  export GIT_AUTHOR_NAME=Smoke GIT_AUTHOR_EMAIL=smoke@example.invalid GIT_COMMITTER_NAME=Smoke GIT_COMMITTER_EMAIL=smoke@example.invalid
  t0=$(date +%s)
  node $B/dist/cli.js run --root $M --deck $T/deck.json --processor ds --deadline 2400 > $T/run.json 2> $T/run.err
  echo "EXIT=$? SECONDS=$(( $(date +%s)-t0 ))" > $T/run.done
)
