#!/bin/sh
# P20 gate demo (issue #11): MorphStudio run 20261008-201843 reproduced on go-mini. $1 = a MorphV2 binary dir (dist/ +
# node_modules + templates linked). Builds a git module in /tmp/p20/demo/mod, cuts the full deck and two --only decks,
# runs six acceptances and prints their exits; then run decks/tools/stubcheck.mjs on the logs (docs/TASK_P20_rerun.md §11).
set -u
BIN=$1; D=/tmp/p20/demo; M=$D/mod; rm -rf $M; mkdir -p $M
F=/home/morph/MorphV2/tests/fixtures/go-mini
cp -r $F/contour.yaml $F/go.mod $F/internal $F/decks $M/
python3 - "$M" <<'PY'
import json,sys
m=json.load(open('/home/morph/MorphV2/tests/fixtures/cli/goMini.sameGen.map.json'))
open(sys.argv[1]+'/morph-map.json','w').write(json.dumps(m,indent=2)+"\n")
import shutil; shutil.copy('/home/morph/MorphV2/tests/fixtures/go-mini/morph-map.json', sys.argv[1]+'/std-map.json')
PY
cp /home/morph/MorphV2/decks/tools/goguard.mjs $M/decks/tools/guard.mjs
cp /home/morph/MorphV2/decks/tools/gofirstdiff.mjs $M/decks/tools/firstdiff.mjs
mkdir -p $M/calc
cat > $M/calc/clamp_value.go <<'GO'
package calc

// ClampValue keeps v inside the closed range of lo and hi given in any order.
func ClampValue(v, lo, hi int) int {
	if lo > hi {
		lo, hi = hi, lo
	}
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}
GO
cat > $M/calc/percent_of.go <<'GO'
package calc

// PercentOf is part of whole as a whole percent, rounded half up, kept inside 0..100.
func PercentOf(part, whole int) int {
	if whole <= 0 {
		return 0
	}
	return ClampValue((200*part+whole)/(2*whole), 0, 100)
}
GO
cat > $M/calc/half.go <<'GO'
package calc

// HalfShare is the percent of one half: an accepted file outside every card that calls PercentOf (mount.go's role).
func HalfShare() int { return PercentOf(1, 2) }
GO
printf 'probe/\n' > $M/.gitignore
git -C $M init -q && git -C $M -c user.name=p20 -c user.email=p20@x add -A && git -C $M -c user.name=p20 -c user.email=p20@x commit -qm base
cd $M
for O in "" "--only percent-of" "--only clamp-value-judge"; do
  N=$(echo "full$O" | tr -c 'a-z0-9\n' '_' ); MAP=morph-map.json; case "$O" in *judge) MAP=std-map.json;; esac
  [ -z "$O" ] && node $BIN/dist/cli.js plan --root . --spec contour.yaml --map std-map.json --component calc --component report --judge --checks decks/m1/checks.json --out /tmp/p20/demo/std.json > /dev/null 2>&1
  node $BIN/dist/cli.js plan --root . --spec contour.yaml --map $MAP --component calc --component report --judge --checks decks/m1/checks.json $O --out /tmp/p20/demo/$N.json > /dev/null 2>&1 || echo "plan $O failed"
done
git status --short
python3 - <<'PY'
import json
for n in ['full','std','full__only_percent_of','full__only_clamp_value_judge']:
    d={c['customId']:c for c in json.load(open('/tmp/p20/demo/'+n+'.json'))}
    for cid in ['percent-of','clamp-value-judge']:
        if cid in d: open('/tmp/p20/demo/%s.%s.sh'%(n,cid),'w').write(d[cid]['acceptance'])
PY
for s in /tmp/p20/demo/*.sh; do
  sh $s > $s.log 2>&1; echo "$(basename $s) exit $?"; git checkout -q -- . ; git clean -qfd -e probe
done
