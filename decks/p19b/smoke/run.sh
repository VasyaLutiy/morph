#!/usr/bin/env bash
# P19b smokes (issue #10 acceptance), run by the main session AFTER the P19b merge with a binary copy of the merged tree.
#   BIN=/tmp/v2bin-p19b-smoke OUT=/tmp/p19b-smoke decks/p19b/smoke/run.sh [go] [typescript]      dry part, $0
#   S1_RUN=1 BIN=… OUT=… decks/p19b/smoke/run.sh go                                               + the live Go run on ds
# The binary copy: npm run build && rm -rf $BIN && mkdir -p $BIN && cp -r dist $BIN/ && ln -s $PWD/node_modules
#   $BIN/node_modules && ln -s $PWD/templates $BIN/templates   (init takes the guards from $BIN/templates)
# go: `morph init` (module hsize), the record of decks/p19b/smoke/go/ (Components size uses github.com/dustin/go-humanize
#   v1.0.1, word uses nothing), the scaffold step WITH the network once (go get, tools.go, go mod tidy, go mod vendor,
#   commit vendor/), then OFFLINE: plan --checks (every acceptance GOFLAGS=-mod=vendor, format-size's guard line names the
#   module, plural-word's names nothing), deck check, the guard on a probe tree (a declared import passes, an undeclared
#   module and a module of another Component are rejected), and with S1_RUN=1 the run on ds (cap $0.02) and the module
#   verified with GOPROXY=off, an empty module cache and dead HTTP(S) proxies (go vet, gofmt -l, go test ./...).
# typescript: `morph init` (name cases), the record of decks/p19b/smoke/typescript/ (text uses change-case 5.4.4, count
#   nothing), the scaffold step WITH the network once (npm install --save-exact, then npm ci from the lock), plan --checks
#   (kebab-title's guard line names change-case, word-count's nothing), deck check, a stub run with answers/ok (4/4
#   written) and a stub run of the two code cards with answers/planted (both rejected by the guard).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
BIN="${BIN:-/tmp/v2bin-p19b-smoke}"
OUT="${OUT:-/tmp/p19b-smoke}"
M="node $BIN/dist/cli.js"
mkdir -p "$OUT"
export GIT_AUTHOR_NAME=Smoke GIT_AUTHOR_EMAIL=smoke@example.invalid GIT_COMMITTER_NAME=Smoke GIT_COMMITTER_EMAIL=smoke@example.invalid
DEAD="HTTP_PROXY=http://127.0.0.1:9 HTTPS_PROXY=http://127.0.0.1:9 http_proxy=http://127.0.0.1:9 https_proxy=http://127.0.0.1:9"
ok() { echo "  ok   $*"; }
bad() { echo "  FAIL $*"; FAILS=$((FAILS+1)); }
FAILS=0
has() { python3 - "$@" <<'PY'
import json, sys
deck, cid, needle, want = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] == "1"
needle = needle.replace("\\n", "\n")
acc = next(c for c in json.load(open(deck)) if c["customId"] == cid)["acceptance"] or ""
sys.exit(0 if (needle in acc) == want else 1)
PY
}

smoke_go() {
  local D="$OUT/go" P="$OUT/go-probe" G="$OUT/gopath-empty"
  rm -rf "$D" "$P" "$G" "$OUT/gopath-net"; mkdir -p "$G"
  $M init --root "$D" --name hsize --language go --module hsize > "$OUT/go.init.json" || { bad "init"; return; }
  cp -r "$HERE/go/." "$D/"
  # the scaffold step: the network once
  (cd "$D" && export GOFLAGS=-mod=mod GOPROXY=https://proxy.golang.org GOPATH="$OUT/gopath-net" GOCACHE="$OUT/gocache" &&
    go get github.com/dustin/go-humanize@v1.0.1 && go mod tidy && go mod vendor) > "$OUT/go.p0.txt" 2>&1 \
    && ok "scaffold: go get + tidy + vendor ($(grep -c . "$D/vendor/modules.txt") lines in vendor/modules.txt, $(du -sk "$D/vendor" | cut -f1) KB)" \
    || { bad "scaffold step (see $OUT/go.p0.txt)"; return; }
  git -C "$D" init -q -b main && git -C "$D" add -A && git -C "$D" commit -qm "init hsize (go) + smoke record + vendored go-humanize v1.0.1"
  # offline from here
  export GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOWORK=off GOFLAGS=-mod=vendor GOPATH="$G" GOCACHE="$OUT/gocache-off"
  $M plan --root "$D" --spec contour.yaml --map morph-map.json --component size --component word --judge \
    --checks decks/s1/checks.json --out decks/s1/deck.json > "$OUT/go.plan.json" && ok "plan --checks exit 0" || bad "plan --checks"
  local DK="$D/decks/s1/deck.json"
  for c in format-size plural-word format-size-judge plural-word-judge; do
    has "$DK" $c "export GOFLAGS=-mod=vendor GOPROXY=off " 1 && has "$DK" $c "-mod=mod" 0 && ok "$c: GOFLAGS=-mod=vendor, GOPROXY=off" || bad "$c: vendor env"
  done
  has "$DK" format-size "node \$P/guard.mjs src size/format_size.go 'github.com/dustin/go-humanize'" 1 && ok "format-size: guard names the module" || bad "format-size guard line"
  has "$DK" plural-word "node \$P/guard.mjs src word/plural_word.go\n" 1 && ok "plural-word: guard names nothing" || bad "plural-word guard line"
  $M deck check --root "$D" --deck decks/s1/deck.json > "$OUT/go.check.json"; python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); sys.exit(0 if d.get("errors")==0 else 1)' "$OUT/go.check.json" \
    && ok "deck check: 0 errors" || bad "deck check"
  git -C "$D" add -A && git -C "$D" commit -qm "deck s1" || true
  # the guard on a probe tree
  cp -r "$D" "$P"
  mkdir -p "$P/size" "$P/word"
  printf 'package size\n\nimport humanize "github.com/dustin/go-humanize"\n\n// FormatSize is the probe tree'"'"'s stand-in.\nfunc FormatSize(n uint64) string {\n\tif n == 0 {\n\t\treturn "empty"\n\t}\n\treturn humanize.Bytes(n)\n}\n' > "$P/size/format_size.go"
  printf 'package word\n\nimport "fmt"\n\n// PluralWord is the probe tree'"'"'s stand-in.\nfunc PluralWord(n int, noun string) string {\n\tif n == 1 || n == -1 {\n\t\treturn fmt.Sprintf("%%d %%s", n, noun)\n\t}\n\treturn fmt.Sprintf("%%d %%ss", n, noun)\n}\n' > "$P/word/plural_word.go"
  (cd "$P" && node decks/tools/guard.mjs src size/format_size.go 'github.com/dustin/go-humanize' && node decks/tools/guard.mjs src word/plural_word.go) > "$OUT/go.guard-clean.txt" 2>&1 \
    && ok "guard: the declared import passes, the stdlib package passes" || bad "guard on the clean probe tree ($(cat "$OUT/go.guard-clean.txt"))"
  (cd "$P" && env $DEAD go build ./... && go vet ./...) > "$OUT/go.build-probe.txt" 2>&1 && ok "probe tree builds offline from vendor/" || bad "probe tree build ($(tail -3 "$OUT/go.build-probe.txt"))"
  printf 'package size\n\nimport _ "golang.org/x/text/language"\n' > "$P/size/planted.go"
  (cd "$P" && node decks/tools/guard.mjs src size/format_size.go 'github.com/dustin/go-humanize') > "$OUT/go.guard-planted1.txt" 2>&1
  [ $? = 1 ] && grep -q "imports golang.org/x/text/language (the standard library and github.com/dustin/go-humanize only)" "$OUT/go.guard-planted1.txt" \
    && ok "guard rejects an undeclared module: $(head -1 "$OUT/go.guard-planted1.txt")" || bad "planted undeclared module ($(cat "$OUT/go.guard-planted1.txt"))"
  rm -f "$P/size/planted.go"
  printf 'package word\n\nimport _ "github.com/dustin/go-humanize"\n' > "$P/word/planted.go"
  (cd "$P" && node decks/tools/guard.mjs src word/plural_word.go) > "$OUT/go.guard-planted2.txt" 2>&1
  [ $? = 1 ] && grep -q "imports github.com/dustin/go-humanize (the standard library only)" "$OUT/go.guard-planted2.txt" \
    && ok "guard rejects another Component's module: $(head -1 "$OUT/go.guard-planted2.txt")" || bad "planted foreign module ($(cat "$OUT/go.guard-planted2.txt"))"
  if [ "${S1_RUN:-0}" = 1 ]; then
    python3 "$D/decks/tools/scale_tokens.py" "$DK" 3 > /dev/null && git -C "$D" commit -qam "deck s1 x3"
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
print(f"  run  go: exit {sys.argv[2]} · {w}/{len(o)} written · ${d['report']['usageTotals'].get('cost', 0):.4f} · {int(sys.argv[3])/60:.1f} min · run {d['runId']}")
PY
    )
    (cd "$D" && env $DEAD go vet ./... && F=$(gofmt -l size word) && [ -z "$F" ] && env $DEAD go test -count=1 ./...) > "$OUT/go.verify.txt" 2>&1 \
      && ok "after the run, offline (GOPROXY=off, empty $G, dead proxies): go vet, gofmt -l, go test ./... green" || bad "offline verify ($(tail -5 "$OUT/go.verify.txt"))"
    (cd "$D" && GOFLAGS=-mod=mod env $DEAD go build ./... ) > "$OUT/go.modmod.txt" 2>&1 \
      && bad "-mod=mod built without the network (the vendor flag proved nothing)" || ok "control: -mod=mod with the empty module cache fails ($(grep -m1 -o 'module lookup disabled by GOPROXY=off' "$OUT/go.modmod.txt"))"
    [ -z "$(ls -A "$G" 2>/dev/null | grep -v '^pkg$')" ] && ok "module cache $G holds no download" || bad "module cache not empty"
  fi
  unset GOPROXY GOSUMDB GOTOOLCHAIN GOWORK GOFLAGS GOPATH GOCACHE
}

smoke_ts() {
  local D="$OUT/typescript"
  rm -rf "$D"
  $M init --root "$D" --name cases --language typescript > "$OUT/ts.init.json" || { bad "init"; return; }
  cp -r "$HERE/typescript/." "$D/"; rm -rf "$D/answers"
  # the scaffold step: the network once
  (cd "$D" && npm install --no-audit --no-fund && npm install --no-audit --no-fund --save-exact change-case@5.4.4 && rm -rf node_modules && npm ci --no-audit --no-fund) > "$OUT/ts.p0.txt" 2>&1 \
    && ok "scaffold: npm install --save-exact change-case@5.4.4, npm ci from the lock ($(python3 -c 'import json; print(json.load(open("'"$D"'/package.json"))["dependencies"])'))" \
    || { bad "scaffold step (see $OUT/ts.p0.txt)"; return; }
  git -C "$D" init -q -b main && git -C "$D" add -A && git -C "$D" commit -qm "init cases (typescript) + smoke record + change-case 5.4.4"
  $M plan --root "$D" --spec contour.yaml --map morph-map.json --component text --component count --judge \
    --checks decks/s1/checks.json --out decks/s1/deck.json > "$OUT/ts.plan.json" && ok "plan --checks exit 0" || bad "plan --checks"
  local DK="$D/decks/s1/deck.json"
  has "$DK" kebab-title "node \$P/guard.mjs src src/text/kebabTitle.ts 'change-case'" 1 && ok "kebab-title: guard names change-case" || bad "kebab-title guard line"
  has "$DK" word-count "node \$P/guard.mjs src src/count/wordCount.ts\n" 1 && ok "word-count: guard names nothing" || bad "word-count guard line"
  python3 -c 'import json,sys; c=[x for x in json.load(open(sys.argv[1])) if x["customId"]=="kebab-title"][0]; sys.exit(0 if "docs/deps/change-case.md" in c["contextSlice"] and "change-case@5.4.4" in c["instruction"] else 1)' "$DK" \
    && ok "kebab-title: the digest in its slice, the directive in its instruction" || bad "kebab-title slice or directive"
  $M deck check --root "$D" --deck decks/s1/deck.json > "$OUT/ts.check.json"; python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); sys.exit(0 if d.get("errors")==0 else 1)' "$OUT/ts.check.json" \
    && ok "deck check: 0 errors" || bad "deck check"
  git -C "$D" add -A && git -C "$D" commit -qm "deck s1" || true
  # stub run, the right answers
  MORPH_PROCESSOR_st_TYPE=stub MORPH_PROCESSOR_st_ANSWERS_DIR="$HERE/typescript/answers/ok" \
    $M run --root "$D" --deck decks/s1/deck.json --processor st --deadline 900 > "$OUT/ts.run-ok.json" 2> "$OUT/ts.run-ok.err"
  python3 - "$OUT/ts.run-ok.json" <<'PY' && ok "stub run (answers/ok): 4/4 written" || bad "stub run ok (see $OUT/ts.run-ok.json)"
import json, sys
d = json.load(open(sys.argv[1])); o = d["report"]["outcomes"]
print("  run  ts ok:", ", ".join(f'{x["customId"]} {x["status"]}' for x in o), "· run", d["runId"])
sys.exit(0 if sum(1 for x in o if x["status"] == "written") == 4 else 1)
PY
  # stub run, the planted imports (the two code cards alone, from main)
  git -C "$D" checkout -q main
  rm -rf /tmp/morph/kebab-title-s1 /tmp/morph/word-count-s1; sleep 2   # a run id is the second it starts
  python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); json.dump([c for c in d if not c["customId"].endswith("-judge")], open(sys.argv[2],"w"), indent=2)' "$DK" "$OUT/ts.planted.deck.json"
  cp "$OUT/ts.planted.deck.json" "$D/decks/s1/planted.json" && git -C "$D" add -A && git -C "$D" commit -qm "planted deck" -q
  MORPH_PROCESSOR_st_TYPE=stub MORPH_PROCESSOR_st_ANSWERS_DIR="$HERE/typescript/answers/planted" \
    $M run --root "$D" --deck decks/s1/planted.json --processor st --deadline 900 > "$OUT/ts.run-planted.json" 2> "$OUT/ts.run-planted.err"
  grep -rh 'package import "typescript" (allowed: node:\*, change-case)' "$D/.morph/runs" /tmp/morph/kebab-title-s1 > /dev/null 2>&1 \
    && ok "guard rejects an undeclared package in kebab-title: package import \"typescript\" (allowed: node:*, change-case)" || bad "planted typescript import not rejected"
  grep -rh 'package import "change-case" (allowed: node:\*)' "$D/.morph/runs" /tmp/morph/word-count-s1 > /dev/null 2>&1 \
    && ok "guard rejects another Component's package in word-count: package import \"change-case\" (allowed: node:*)" || bad "planted change-case import not rejected"
  python3 - "$OUT/ts.run-planted.json" <<'PY' && ok "stub run (answers/planted): 0/2 written" || bad "planted run wrote a card"
import json, sys
d = json.load(open(sys.argv[1])); o = d["report"]["outcomes"]
print("  run  ts planted:", ", ".join(f'{x["customId"]} {x["status"]}' for x in o), "· run", d["runId"])
sys.exit(0 if all(x["status"] != "written" for x in o) else 1)
PY
}

for L in "${@:-go typescript}"; do
  for L1 in $L; do
    echo "== $L1"
    case "$L1" in
      go) smoke_go ;;
      typescript) smoke_ts ;;
      *) echo "unknown $L1"; exit 2 ;;
    esac
  done
done
echo "== smoke: $FAILS failed check(s)"
[ "$FAILS" = 0 ]
