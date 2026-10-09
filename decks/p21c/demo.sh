#!/bin/sh
# P21c gate demo (issue #12 item 2, comment 6077766447, MorphStudio 4efde92 §6): the subset transaction on the stub
# processor. $1 = a MorphV2 binary dir with the transaction (dist/ + node_modules + templates linked), $2 = one without
# it (main before P21c). Each case builds a git repository under /tmp/p21c/demo/<case>, cuts `--only` with that
# binary, runs `morph run --processor stub` (reference answers: decks/p21c/demo/ts-rename/*.md, go-p7b's
# decks/p21/break/ref/*) and prints one summary line per run plus, for a red card, the first file:line line of its log
# and the card that owns that file. Cases:
#   ts-rename old / new     a TypeScript rename across modules over 3 generations (tests/fixtures/ts-rename.json)
#   go-p7b old / new        MorphStudio P7b's shape (tests/fixtures/go-p7b), with a FORCED red-once step on
#                           control-contract-judge (its gen-2 sibling phase-loop writes loop.go first): the P21a smoke
#   go-p7b-r3 new           + mcp/count.go, outside the subset, reading the renamed Resumes: the run stops, naming it
# Data of docs/TASK_P21c_transaction.md §11; never part of a card.
set -u
NEW=$1; OLD=$2; R=/home/morph/MorphV2; T=/tmp/p21c/demo; mkdir -p $T
IDS_TS=to-metres,length-line,to-metres-judge,length-line-judge
IDS_GO=control-contract,phase-loop,runtime-guard,daemon-core,control-contract-judge,phase-loop-judge,runtime-guard-judge,daemon-core-judge

setup_ts() {  # $1 = dir
  M=$1/mod; mkdir -p $M
  python3 - "$M" <<'PY'
import json, os, sys
m = sys.argv[1]
for p, t in json.load(open('/home/morph/MorphV2/tests/fixtures/ts-rename.json')).items():
    if p.startswith('decks/r1/deck.json') or p.startswith('decks/r1/_stubs/'):
        continue
    os.makedirs(os.path.dirname(os.path.join(m, p)) or m, exist_ok=True)
    open(os.path.join(m, p), 'w').write(t)
PY
  for f in eslint.config.js vitest.config.ts decks/tools/guard.mjs decks/tools/firstdiff.mjs decks/tools/layers.json; do
    mkdir -p $(dirname $M/$f); cp $R/templates/typescript/$f $M/$f; done
  ln -s $R/node_modules $M/node_modules
  printf 'probe/\nnode_modules\n' > $M/.gitignore
  mkdir -p $1/answers; cp $R/decks/p21c/demo/ts-rename/*.md $1/answers/
  CUT="--component units --component report --judge --checks decks/r1/checks.json --only $IDS_TS"
}

setup_go() {  # $1 = dir, $2 = risk variant or ""
  M=$1/mod; mkdir -p $M; cp -r $R/tests/fixtures/go-p7b/. $M/
  cp $R/decks/tools/goguard.mjs $M/decks/tools/guard.mjs; cp $R/decks/tools/gofirstdiff.mjs $M/decks/tools/firstdiff.mjs
  [ -n "$2" ] && cp -r $R/decks/p21/break/risk/$2/. $M/
  mkdir -p $1/answers
  CUT="--component control --component supervisor --component daemon --judge --checks decks/b1/checks.json --only $IDS_GO"
}

go_answers() {  # $1 = dir, $2 = deck: one fenced answer per card from the reference files, the same for r1 and r2
  python3 - "$1" "$2" <<'PY'
import json, sys
d, deck = sys.argv[1], json.load(open(sys.argv[2]))
for c in deck:
    t = c['targets'][0]; body = open('/home/morph/MorphV2/decks/p21/break/ref/' + t).read()
    for n in ['', '.r1', '.r2']:
        open(d + '/answers/' + c['customId'] + n + '.md', 'w').write('```go\n' + body + '```\n')
PY
}

force() {  # $1 = deck, $2 = card, $3 = marker file: the card's acceptance is red once, before anything it checks
  python3 - "$1" "$2" "$3" <<'PY'
import json, sys
p, card, mark = sys.argv[1:4]
deck = json.load(open(p))
step = '[ -f ' + mark + ' ] || { touch ' + mark + '; echo "forced red once"; exit 1; }\n'
for c in deck:
    if c['customId'] == card:
        a = c['acceptance']
        if a.startswith('# morph: subset transaction\n'):
            c['acceptance'] = '# morph: subset transaction\n' + step + a[len('# morph: subset transaction\n'):]
        else:
            c['acceptance'] = step + a
open(p, 'w').write(json.dumps(deck, indent=2) + '\n')
PY
}

summary() {  # $1 = case, $2 = dir
  python3 - "$1" "$2" <<'PY'
import json, re, sys
name, d = sys.argv[1], sys.argv[2]
deck = json.load(open(d + '/deck.json'))
owner = {t: c['customId'] for c in deck for t in c['targets']}
mark = sum(1 for c in deck if (c['acceptance'] or '').startswith('# morph: subset transaction\n'))
try:
    doc = json.load(open(d + '/run.json'))
except Exception as e:
    print(name, 'no run document:', e); sys.exit(0)
rep = doc.get('report') or {}
outs = rep.get('outcomes', [])
w = sum(1 for o in outs if o['status'] == 'written')
print('%s: exit %s, transaction marks %d/%d, written %d/%d, requests %d%s' % (name, open(d + '/exit').read().strip(), mark, len(deck),
      w, len(deck), rep.get('usageTotals', {}).get('requests', 0), ', fault "' + rep['fault'] + '"' if 'fault' in rep else ''))
pat = [re.compile(r'^(?:vet: )?(?:\./)?(\S+?\.go)(:\d+.*)$'), re.compile(r'^(\S+?\.tsx?)(\(\d+,\d+\).*)$')]
for o in outs:
    line = '    %s %s attempts %d%s' % (o['customId'], o['status'], o['attempts'], (' (' + o['reason'] + ')') if o['reason'] else '')
    if o['status'] != 'written':
        for log in [o['acceptanceLog']] + o['earlierFailures'][::-1]:
            hit = None
            for l in log.split('\n'):
                if not l or l[0] in ' \t#':
                    continue
                for p in pat:
                    m = p.match(l.rstrip())
                    if m:
                        hit = (m.group(1), l.rstrip()[:110]); break
                if hit: break
            if hit:
                line += '\n        red at ' + hit[1] + '\n        blame: ' + hit[0] + ' -> ' + owner.get(hit[0], 'outside the subset'); break
    print(line)
PY
}

runcase() {  # $1 = case, $2 = binary, $3 = kind ts|go, $4 = risk, $5 = force card or ""
  D=$T/$1; rm -rf $D; mkdir -p $D
  if [ $3 = ts ]; then setup_ts $D; else setup_go $D "$4"; fi
  G="git -C $M -c user.name=p21c -c user.email=p21c@x"
  $G init -q && $G add -A && $G commit -qm base
  ( cd $M && node $2/dist/cli.js plan --root . --spec contour.yaml --map morph-map.json $CUT --out $D/deck.json > $D/plan.json 2>&1 ) \
    || { echo "$1: plan failed"; head -c 600 $D/plan.json; return; }
  [ $3 = go ] && go_answers $D $D/deck.json
  [ -n "$5" ] && force $D/deck.json $5 $D/once-$5
  ( cd $M && MORPH_PROCESSOR_stub_TYPE=stub MORPH_PROCESSOR_stub_ANSWERS_DIR=$D/answers \
      node $2/dist/cli.js run --root . --deck $D/deck.json --processor stub --deadline 1200 > $D/run.json 2> $D/run.err; echo $? > $D/exit )
  summary $1 $D
}

S=$(date +%s)
runcase ts-rename-old $OLD ts "" ""
runcase ts-rename-new $NEW ts "" ""
runcase go-p7b-old $OLD go "" control-contract-judge
runcase go-p7b-new $NEW go "" control-contract-judge
runcase go-p7b-r3-new $NEW go r3 ""
echo "demo seconds: $(( $(date +%s) - S ))"
