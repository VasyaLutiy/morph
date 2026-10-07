#!/bin/bash
# P10b2 smoke recipe: S holds repo/ (clean git repo with contour.yaml, morph-map.json, decks/s10/{checks.json,parts,deck.json},
# decks/tools/{guard,firstdiff}.mjs); the binary is a copy of dist/ in /tmp/v2bin-smoke10 (node_modules symlinked).
# The deck is cut first by: node /tmp/v2bin-smoke10/dist/cli.js plan --root $S/repo --spec contour.yaml --map morph-map.json
#   --component calc --checks decks/s10/checks.json --out decks/s10/deck.json   (then deck check, then commit the deck)
# The key goes from morph-lab/.env by indirection, never printed.
S=${S:?set S to the scratch dir}
(
  set -a; . /home/morph/MorphProject/morph-lab/.env; set +a
  for k in TYPE API_KEY MODEL ROUTE CONCURRENCY PROVIDER_ORDER REASONING_MAX_TOKENS; do
    v="MRPH_PROCESSOR_glm53_$k"; export "MORPH_PROCESSOR_glm53_$k=${!v}"
  done
  for v in $(compgen -e | grep -E '^(MRPH_|JEV_)'); do unset "$v"; done
  export GIT_AUTHOR_NAME=Smoke GIT_AUTHOR_EMAIL=smoke@example.invalid GIT_COMMITTER_NAME=Smoke GIT_COMMITTER_EMAIL=smoke@example.invalid
  t0=$(date +%s)
  node /tmp/v2bin-smoke10/dist/cli.js run --root $S/repo --deck decks/s10/deck.json --processor glm53 --max-retry-batches 8 --deadline 900 > $S/stdout.json 2> $S/stderr.txt
  rc=$?
  t1=$(date +%s)
  echo "EXIT=$rc SECONDS=$((t1-t0))"
)
