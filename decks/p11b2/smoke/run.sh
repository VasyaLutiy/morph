#!/bin/bash
# P11b2 smoke recipe (detached batch route): S=/tmp/smoke11b2 holds repo/ (clean git repo rebuilt from decks/p11/smoke/:
# contour.yaml, morph-map.json, decks/s11/{checks.json,parts,deck.json}, decks/tools/{guard,firstdiff}.mjs + guard.calc.diff),
# the binary is a copy of dist/ in /tmp/v2bin-smoke11b2 (node_modules symlinked). Keys by indirection in morph.sh, never printed.
# Deck: node /tmp/v2bin-smoke11b2/dist/cli.js plan --root $S/repo --spec contour.yaml --map morph-map.json --component calc
#   --checks decks/s11/checks.json --out decks/s11/deck.json; deck check (0 errors); commit.
S=/tmp/smoke11b2
# 1. slug check (one card, maxTokens 8): deepseek/deepseek-v4.1-flash:batch on ds's key (default of morph.sh)
#    $S/morph.sh submit --root $S/repo --deck $S/slug.json --processor dsb > $S/slug-submit.json
#    nohup $S/collect-loop.sh <slug batch id> slug &      # 60 tries, still in_progress -> fallback below
# 2. process A (exits before B starts)
SLUG=z-ai/glm-5.3:batch KEYP=glm53 $S/morph.sh submit --root $S/repo --deck decks/s11/deck.json --processor dsb > $S/submit.json
id=$(python3 -c "import json;print(json.load(open('$S/submit.json'))['batchId'])")
# 3. process B: a new background process, collect every 60 s while exit 1, at most 60 tries; writes $S/main.done
SLUG=z-ai/glm-5.3:batch KEYP=glm53 nohup $S/collect-loop.sh "$id" main > /dev/null 2>&1 &
# 4. after main.done shows exit=0: the stub replay of the collected answers
# ( unset MRPH_*/JEV_*/MORPH_*; GIT_* = Smoke;
#   MORPH_PROCESSOR_rp_TYPE=stub MORPH_PROCESSOR_rp_ANSWERS_DIR=$S/repo/.morph/batches/$id \
#   node /tmp/v2bin-smoke11b2/dist/cli.js run --root $S/repo --deck decks/s11/deck.json --processor rp --max-retry-batches 0 > $S/replay-stdout.json )
