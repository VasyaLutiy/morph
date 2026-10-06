#!/bin/bash
# P7 smoke recipe: S holds repo/ (clean git repo) and side/deck.json; the key goes from morph-lab/.env by indirection, never printed
S=${S:?set S to the scratch dir}
(
  set -a; . /home/morph/MorphProject/morph-lab/.env; set +a
  for k in TYPE API_KEY MODEL ROUTE CONCURRENCY PROVIDER_ORDER REASONING_MAX_TOKENS; do
    v="MRPH_PROCESSOR_glm53_$k"; export "MORPH_PROCESSOR_glm53_$k=${!v}"
  done
  for v in $(compgen -e | grep -E '^(MRPH_|JEV_)'); do unset "$v"; done
  export GIT_AUTHOR_NAME=Smoke GIT_AUTHOR_EMAIL=smoke@example.invalid GIT_COMMITTER_NAME=Smoke GIT_COMMITTER_EMAIL=smoke@example.invalid
  t0=$(date +%s)
  node /home/morph/MorphV2/dist/cli.js run --root $S/repo --deck $S/side/deck.json --processor glm53 --deadline 600 > $S/stdout.json 2> $S/stderr.txt
  rc=$?
  t1=$(date +%s)
  echo "EXIT=$rc SECONDS=$((t1-t0))"
)
