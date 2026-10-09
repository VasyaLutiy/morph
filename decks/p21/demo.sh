#!/bin/sh
# P21 gate demo (issue #12): an --only re-cut that renames an exported Go identifier and changes a signature across
# generations in MorphStudio P7b's shape (tests/fixtures/go-p7b: Loop.Resumes → Restarts, Loop.Exited(code, now) →
# Exited(code, stderr, now); 8 cards, generations [control-contract] [control-contract-judge, phase-loop]
# [phase-loop-judge, runtime-guard] [daemon-core, runtime-guard-judge] [daemon-core-judge]; mcp/session.go outside the
# subset imports supervisor). $1 = a MorphV2 binary dir (dist/ + node_modules + templates linked); $2 = a risk variant:
# none, r1 (phase-loop's code calls Guard of the later guard.go), r3 (a file outside the subset, mcp/count.go, reads
# the old Resumes), r4 (a command outside the subset, cmd/morphd/main.go, imports daemon). Builds a git module
# in /tmp/p21/demo/<variant>, cuts `--only` the 8 cards, then plays the run card by card in deck order: the stub run
# (stub targets, the card's acceptance, decks/tools/stubcheck.mjs and decks/tools/fullvet.mjs), then the reference
# answer accepted and committed. Prints one line per card: stub exit, stubcheck, fullvet, reference exit and the stage
# it stopped at. Data of docs/TASK_P21a_breaking.md §11; never part of a card.
set -u
BIN=$1; V=${2:-none}; R=/home/morph/MorphV2; D=/tmp/p21/demo/$V; M=$D/mod; rm -rf $D; mkdir -p $M
F=$R/tests/fixtures/go-p7b; K=$R/decks/p21/break
cp -r $F/. $M/
cp $R/decks/tools/goguard.mjs $M/decks/tools/guard.mjs
cp $R/decks/tools/gofirstdiff.mjs $M/decks/tools/firstdiff.mjs
case $V in r3|r4) cp -r $K/risk/$V/. $M/;; esac
G="git -C $M -c user.name=p21 -c user.email=p21@x"
$G init -q && $G add -A && $G commit -qm base
IDS=control-contract,phase-loop,runtime-guard,daemon-core,control-contract-judge,phase-loop-judge,runtime-guard-judge,daemon-core-judge
( cd $M && node $BIN/dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component control --component supervisor \
  --component daemon --judge --checks decks/b1/checks.json --only $IDS --out $D/deck.json > $D/plan.json ) || { echo "plan failed"; cat $D/plan.json; exit 1; }
python3 - "$D" <<'PY'
import json,sys
d=sys.argv[1]
for c in json.load(open(d+'/deck.json')):
    open(d+'/'+c['customId']+'.sh','w').write(c['acceptance'])
    print(c['customId'], ','.join(c['targets']), file=open(d+'/order.txt','a'))
PY
last() { grep -E '^== ' "$1" | tail -1 | cut -c1-40; }
while read -r ID T; do
  STAGE=probe; case $ID in *-judge) STAGE=guard;; esac
  for t in $(echo $T | tr ',' ' '); do cp $K/stub/$t $M/$t; done
  ( cd $M && sh $D/$ID.sh > $D/$ID.stub.log 2>&1 ); SE=$?
  SC=$(node $R/decks/tools/stubcheck.mjs $D/$ID.stub.log $STAGE $T > $D/$ID.stubcheck 2>&1; echo $?)
  FV=$(cd $M && node $R/decks/tools/fullvet.mjs $D/deck.json $ID > $D/$ID.fullvet 2>&1; echo $?)
  $G checkout -q -- . ; $G clean -qfd -e probe
  for t in $(echo $T | tr ',' ' '); do cp $K/ref/$t $M/$t; done
  [ "$V" = r1 ] && [ "$ID" = phase-loop ] && cp $K/risk/r1/supervisor/loop.go $M/supervisor/loop.go
  ( cd $M && sh $D/$ID.sh > $D/$ID.ref.log 2>&1 ); RE=$?
  echo "$ID stub=$SE stubcheck=$SC fullvet=$FV ref=$RE ($(last $D/$ID.ref.log))"
  [ $SC = 0 ] || sed 's/^/    /' $D/$ID.stubcheck | head -3
  [ $FV = 0 ] || sed 's/^/    /' $D/$ID.fullvet | head -3
  [ $RE = 0 ] || grep -E '\.go:[0-9]+|FAIL|undefined|not in std' $D/$ID.ref.log | head -3 | sed 's/^/    /'
  $G add -A && $G commit -qm "$ID" || true
  $G clean -qfd -e probe
done < $D/order.txt
