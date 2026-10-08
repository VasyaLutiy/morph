#!/bin/bash
# P15 smoke (TASK_P15_golang §8): go-mini end to end on ds. Run from the MorphV2 root after npm run build.
set -e
rm -rf /tmp/smoke-go /tmp/v2bin-smoke-go && mkdir -p /tmp/smoke-go /tmp/v2bin-smoke-go
cp -r dist package.json /tmp/v2bin-smoke-go/ && ln -s $PWD/node_modules /tmp/v2bin-smoke-go/node_modules
cp -r tests/fixtures/go-mini /tmp/smoke-go/M && cp decks/tools/goguard.mjs /tmp/smoke-go/M/decks/tools/guard.mjs
cp decks/tools/gofirstdiff.mjs /tmp/smoke-go/M/decks/tools/firstdiff.mjs && cp decks/p15/smoke/morph.sh /tmp/smoke-go/
cd /tmp/smoke-go/M && git init -q && git config user.name Smoke && git config user.email smoke@example.invalid
git add -A && git commit -qm B0
/tmp/smoke-go/morph.sh plan --root . --spec contour.yaml --map morph-map.json --component calc --component report --judge --checks decks/m1/checks.json --out decks/m1/deck.json
/tmp/smoke-go/morph.sh deck check --root . --deck decks/m1/deck.json
python3 /home/morph/MorphV2/decks/tools/scale_tokens.py decks/m1/deck.json 3 && git add -A && git commit -qm B1
/tmp/smoke-go/morph.sh run --root . --deck decks/m1/deck.json --processor ds --deadline 1200 > /tmp/smoke-go/run.json
GOFLAGS=-mod=mod GOPROXY=off go vet ./... && test -z "$(gofmt -l .)" && GOFLAGS=-mod=mod GOPROXY=off go test -count=1 ./...
/tmp/smoke-go/morph.sh primer --root . --write > /tmp/smoke-go/primer.json
