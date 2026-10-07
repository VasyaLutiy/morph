# Primer: MorphV2

generated 2026-10-07T23:30:01.153Z · 761 files in the tree · no model call, no network

## Tests

- 664 tests in 89 test files by the typescript profile (counted from text, not a run)

## Runs

- archived runs: 33 (V2 15, mrph 18), 2026-10-06 → 2026-10-07
- cards: 200 written of 229 (13 failed, 16 skipped); requests 416, answers kept 107
- cost: $3.1558 over 33 priced runs (0 unpriced)
- by format: V2 15 runs, 109/124 written, $1.5883; mrph 18 runs, 91/105 written, $1.5675
- models: z-ai/glm-5.3 (28 runs), deepseek/deepseek-v4.1-flash (5 runs)

## Chronology (docs/MEASURE.md)

phase · date · builder · models · written/planned · runs · $ · notes
- P0 · 2026-10-06 · mrph · z-ai/glm-5.3 · 1/1 written · 1 run · $0.0343
- P1 · 2026-10-06 · mrph · z-ai/glm-5.3 · 6/8 written · 1 run · $0.1438
- P1b · 2026-10-06 · mrph · z-ai/glm-5.3 · 2/2 written · 1 run · $0.0270
- P2 · 2026-10-06 · mrph · z-ai/glm-5.3 · 8/8 written · 1 run · $0.1087
- P3 · 2026-10-06 · mrph · z-ai/glm-5.3 · 8/8 written · 2 runs · $0.2254 · 2 runs: 1+8 written
- P4 · 2026-10-06 · mrph · z-ai/glm-5.3 · 8/8 written · 2 runs · $0.1406 · 2 runs: 7+1 written; re-cut 1 card
- P5 · 2026-10-06 · mrph · z-ai/glm-5.3 · 7/8 written · 3 runs · $0.2787 · 3 runs: 7+0+0 written; re-cut 1 card, failed again; debt run at max_tokens 25500 failed — debt open…
- P5 debt (fable) · — · claude -p · — · 1/1 written · 0 runs · $4.1723 · process-generation-judge, processor swap: Fable 5.1 xhigh; 14 tests, 1 acceptance run, 0 defects, 2…
- P6 · 2026-10-06 · mrph · z-ai/glm-5.3 · 8/8 written · 1 run · $0.0984 · 1 run, no re-cut
- P7 · 2026-10-06 · mrph · z-ai/glm-5.3 · 10/10 written · 1 run · $0.1276 · 1 run, no re-cut
- P7 smoke · 2026-10-06 · V2 binary · — · 3/3 written · 1 run · $0.0003 · exit 0, 2 generations, 3 requests, 355 in / 106 out tokens
- P8 · 2026-10-07 · mrph · z-ai/glm-5.3 · 8/8 written · 1 run · $0.0456 · 1 run, no re-cut
- P9 · 2026-10-07 · mrph · z-ai/glm-5.3 · 8/8 written · 1 run · $0.1556 · 1 run, no re-cut
- P9b · 2026-10-07 · mrph · z-ai/glm-5.3 · 9/9 written · 2 runs · $0.0944 · 2 runs: 8+1 written; re-cut 1 card — data, output-directive-judge, TASK §2.2 wording
- P9c · 2026-10-07 · mrph · z-ai/glm-5.3 · 7/7 written · 1 run · $0.0873 · 1 run, no fix; burned: 2 unclosed fences, 1 missing files, 2 losing variants
- P9 switch test · — · V2 replay ×3 + mrph control · — · 0/8 written · 0 runs · $0.0750 · V2 before P9b, after P9b, after P9c
- P10a · 2026-10-07 · V2 binary · z-ai/glm-5.3 · 12/12 written · 4 runs · $0.3718 · 4 runs: 0 + 10 + 1 + 1 written; 3 data fixes, the third an operator exception after an emergency st… ← switch: builder mrph → V2 binary
- P10b1 · 2026-10-07 · V2 cut + V2 run · z-ai/glm-5.3 · 10/10 written · 1 run · $0.0998 · 1 run, no fix; 4 retries won: probe-dir-judge r1, build-acceptances r1; 4 losing variants ← switch: builder V2 binary → V2 cut + V2 run
- P10b2 · 2026-10-07 · V2 cut + V2 run · z-ai/glm-5.3 · 6/6 written · 1 run · $0.0780 · 1 run, no fix; retries won: read-plan-checks-judge r1, plan-command-judge r2
- P10b2 smoke · 2026-10-07 · V2 cut + V2 run · — · 2/2 written · 1 run · $0.0005 · exit 0, 2 generations, 2 requests, 915 in / 92 out tokens
- P10c1 · 2026-10-07 · V2 cut + V2 run · z-ai/glm-5.3 · 8/8 written · 1 run · $0.1289 · 1 run, no fix, no retry; 4 losing v2 variants of code cards
- P10c2 · 2026-10-07 · V2 cut + V2 run · z-ai/glm-5.3 · 8/8 written · 1 run · $0.1840 · 1 run, no fix; retries won: process-generation r1, process-generation-judge r1 after v1 cut at max_…
- P11 · 2026-10-07 · V2 cut + V2 run · z-ai/glm-5.3 · 8/8 written · 1 run · $0.0737 · 1 run; retry won send-batch-judge r1; v2 won assemble-batch, send-batch
- P11 fix 1 · 2026-10-07 · V2 cut + V2 run · z-ai/glm-5.3 · 1/1 written · 1 run · $0.0140 · send-batch v1, first attempt
- P11 smoke · 2026-10-07 · V2 cut + V2 run on the batch route · — · 2/2 written · 1 run · $0.0006 · exit 0, 1 generation = 1 batch `batch-1791388269-cp5qOr5IQ0xoz1ntuc8W`, 2 requests, 832 in / 103 ou…
- P11b1 · 2026-10-07 · V2/ds · deepseek/deepseek-v4.1-flash · 14/14 written · 1 run · $0.1379 · 1 run, no fix; 13 first attempt, retry won run-deck-judge r1; 7 untried v2 ← switch: builder V2 cut + V2 run → V2/ds; model z-ai/glm-5.3 → deepseek/deepseek-v4.1-flash
- P11c1 · 2026-10-07 · V2/ds · deepseek/deepseek-v4.1-flash · 12/12 written · 1 run · $0.0941 · 1 run, no fix; 11 first attempt, run-command-judge won at r2; 6 untried v2
- P11c2 · 2026-10-07 · V2/ds · deepseek/deepseek-v4.1-flash · 10/10 written · 1 run · $0.0880 · 1 run, no fix, no retry; run-acceptance won on v2; 4 untried v2
- P11b2 · 2026-10-07 · V2/ds · deepseek/deepseek-v4.1-flash · 9/9 written · 1 run · $0.1183 · 1 run, no fix; 7 first attempt, retries won archive-run-judge r1, parse-command-judge r1; 4 untried…
- P11b2 smoke · 2026-10-07 · V2 detached batch route · — · 2/2 written · 1 run · $0.0006 · submit exit 0, process exited, state with cards+inputs; collect in a second process: 12 × exit 1 pe…
- P12a · 2026-10-07 · V2/ds · deepseek/deepseek-v4.1-flash · 11/11 written · 1 run · $0.1998 · 1 run, no fix; 7 first attempt; read-story 3 answers cut at max_tokens 30 000, won r1.v2; 3 judges …

## What is next

- next phase (docs/PLAN.md): P12b · primer · владение по трейлерам (`%(trailers)`): путь → карты, модель, прогон; секция ownership для seed scout
- handoff (docs/AUTONOMY.md):
  > State at handoff (07.10, after the P12a smoke)
  > **Stopped at the operator's smoke stop after P12a (primer on this repo); the operator resumes.** Next, in order: **P12b**
  > primer ownership by trailers (TASK_P12 §7; the seed of P13a); P13a, P13b, P14 → **final smoke stop**.
  > Lessons for the next preparations: default code targets add a test file (give a smoke cap or code-only targets); new
  > files need `"intent": "generate"` in the map; a new `src/` folder needs its layer in `decks/tools/guard.mjs`; size a judge

## Last decisions (docs/DECISIONS.md)

- P12 · record · primer: four Functions, 17 examples, 25 170 bytes; cli compacted first (folded behaviours re-wrapped at 160 columns, yaml.safe_load identical: 29 850 → 29 266; 5 phrases shortened without a changed fact), then the routing: 29 996 · the 30 000 rule.
- P12 · guard · layer primer joins NO_CLOCK and NO_ENV; `CLOCK_FORMATTERS` = src/primer/primerCommand.ts, the one file that may name `Date` (to format deps.now()) · the three readers are pure functions of their inputs.
- P12 · cut · renderPrimer declares its own input types (structurally readRuns' and readStory's results; tsc checks them where primerCommand passes them), so read-runs, read-story and render-primer are one generation; parse-command writes src/cli/types.ts, parse.ts and main.ts (Main's code card filte…
- P12 · acceptance · `decks/p12/checks.json`: ownGit true (the tests spawn git in tmp repos), fullExclude `tests/cli/parse.examples.test.ts` (ripple 1: the six-command message), code-only targets (`intent: generate` for the four new files), no smoke cap; probes `decks/p12/parts/{read-runs,read-story,…
- P12a · read-story · budget lesson (run 20261007-231118): maxTokens 10 000 (30 000 after ×3) was cut on 3 of 4 answers on ds; the card won on r1.v2, no fix · the next cut of Read Story (and any ds card whose answer is ≥ 10 KB) gets ≥ 16 000 before the ×3.

## Open issues (.morph/issues.json)

- #6 P15 golang: Go language profile written by Morph itself + live validation on a small Go project [P15-golang]
- #1 primer: на TypeScript 0 тестов — счёт только по def test_* (Python) [P12-primer]
