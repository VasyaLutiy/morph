#!/bin/bash
# Final smoke of MorphV2 (after P14b; operator's smoke stop 3), TASK_P14b §8. The order the session ran, 08.10.
# Binary: npm run build; cp -r dist /tmp/v2bin-final/; ln -s ~/MorphV2/node_modules /tmp/v2bin-final/node_modules.
# Env: morph.sh (ds keys by indirection from morph-lab/.env, never printed). step.sh logs exit and seconds per step.
set -e
R=/home/morph/MorphV2; P=$R/decks/p14b/smoke; S=/tmp/smoke-final; T=$S/T; B=/tmp/v2bin-final/dist/cli.js
G="git -c user.name=Smoke -c user.email=smoke@example.invalid"
# 1. T, base (b0): the P10b2 smoke record, map, package; MorphV2's tsconfig/vitest/eslint config, tests/setup+helpers,
#    guard (+ the calc layer, guard.calc.diff) and firstdiff; checks with the two judges; the two probes.
mkdir -p $T && cd $T && git init -q -b main .
cp $P/contour.yaml $P/morph-map.json $P/package.json $P/.gitignore .
ln -s $R/node_modules node_modules && echo node_modules >> .git/info/exclude
cp $R/tsconfig.json $R/vitest.config.ts $R/eslint.config.js .
mkdir -p tests decks/tools decks/s14/parts && cp $R/tests/setup.ts $R/tests/helpers.ts tests/
cp $R/decks/tools/guard.mjs $R/decks/tools/firstdiff.mjs decks/tools/ && patch -s decks/tools/guard.mjs < $P/guard.calc.diff
cp $P/checks.json $P/guard.calc.diff decks/s14/ && cp $P/parts/*.ts decks/s14/parts/
git add -A && $G commit -qm "smoke14 base" && git tag b0
# 2. plan --checks, deck check, x3, b1
node $B plan --root $T --spec contour.yaml --map morph-map.json --component calc --judge --checks decks/s14/checks.json --out decks/s14/deck.json > $S/out/plan.json
node $B deck check --root $T --deck decks/s14/deck.json > $S/out/deck-check.json
python3 $R/decks/tools/scale_tokens.py decks/s14/deck.json 3
git add decks/s14/deck.json && $G commit -qm "deck s14 (morph plan --checks, maxTokens x3 for ds)" && git tag b1
# 3-6. the steps (run and scout under nohup, polled on out/<name>.done)
$S/step.sh run run --root $T --deck decks/s14/deck.json --processor ds --deadline 1200
$S/step.sh primer primer --root $T --write
printf 'Make Clamp Percent round half down; name the file that must change.\n' > $S/scout-task.txt
$S/step.sh scout scout --root $T --processor ds --issue $S/scout-task.txt --deadline 300
$S/step.sh plan-from-scout plan --from-scout latest --root $T --out $S/smoke-scout-deck.json
$S/step.sh scout-deck-check deck check --root $T --deck $S/smoke-scout-deck.json
$S/step.sh review review b1 HEAD --root $T --spec contour.yaml --map morph-map.json --scout latest --mutants 8 --mutant-timeout 120 --write
printf '# smoke14\n\nA hand-written README, outside every card.\n' > README.md && git add README.md && $G commit -qm "seeded: README by hand"
$S/step.sh review-seeded review b1 HEAD --root $T
