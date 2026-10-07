#!/bin/bash
# P11 smoke recipe (batch route): S holds repo/ (clean git repo with contour.yaml, morph-map.json,
# decks/s11/{checks.json,parts,deck.json}, decks/tools/{guard,firstdiff}.mjs; the guard copy knows layer calc);
# the binary is a copy of dist/ in /tmp/v2bin-smoke11 (node_modules symlinked).
# The deck is cut first by: node /tmp/v2bin-smoke11/dist/cli.js plan --root $S/repo --spec contour.yaml --map morph-map.json
#   --component calc --checks decks/s11/checks.json --out decks/s11/deck.json   (then deck check, then commit the deck)
# Step 0 (done once, before): the slug probe of mrph documentation/ARCHITECTURE.md §9 (max_tokens 8) on z-ai/glm-5.3:batch.
# Processor glm53b = glm53's key on the batch slug. The key goes from morph-lab/.env by indirection, never printed.
S=${S:?set S to the scratch dir}
(
  set -a; . /home/morph/MorphProject/morph-lab/.env; set +a
  export MORPH_PROCESSOR_glm53b_TYPE=openrouter
  export MORPH_PROCESSOR_glm53b_API_KEY="$MRPH_PROCESSOR_glm53_API_KEY"
  export MORPH_PROCESSOR_glm53b_MODEL='z-ai/glm-5.3:batch'
  export MORPH_PROCESSOR_glm53b_ROUTE=batch
  export MORPH_PROCESSOR_glm53b_TIMEOUT_MS=3600000
  export MORPH_PROCESSOR_glm53b_MAX_RETRIES=0
  export MORPH_PROCESSOR_glm53b_REASONING_MAX_TOKENS=1000
  for v in $(compgen -e | grep -E '^(MRPH_|JEV_)'); do unset "$v"; done
  export GIT_AUTHOR_NAME=Smoke GIT_AUTHOR_EMAIL=smoke@example.invalid GIT_COMMITTER_NAME=Smoke GIT_COMMITTER_EMAIL=smoke@example.invalid
  t0=$(date +%s)
  node /tmp/v2bin-smoke11/dist/cli.js run --root $S/repo --deck decks/s11/deck.json --processor glm53b --max-retry-batches 0 --deadline 4000 > $S/stdout.json 2> $S/stderr.txt
  rc=$?
  t1=$(date +%s)
  echo "EXIT=$rc SECONDS=$((t1-t0))"
)
