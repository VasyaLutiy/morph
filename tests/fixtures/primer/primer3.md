# Primer: {name}

generated 2026-10-07T19:06:40.000Z · 16 files in the tree · no model call, no network

## Tests

- 3 tests in 2 test files by the typescript profile (counted from text, not a run)

## Runs

- archived runs: 5 (V2 3, mrph 2), 2026-10-06 → 2026-10-07
- cards: 14 written of 22 (3 failed, 5 skipped); requests 34, answers kept 1
- cost: $0.2651 over 4 priced runs (1 unpriced)
- by format: V2 3 runs, 12/13 written, $0.1688; mrph 2 runs, 2/9 written, $0.0963
- models: z-ai/glm-5.3 (3 runs), z-ai/glm-5.3:batch (1 run), deepseek/deepseek-v4.1-flash (1 run)
- skipped: broken (no report.json)

## Chronology (docs/MEASURE.md)

phase · date · builder · models · written/planned · runs · $ · notes
- P0 · 2026-10-06 · mrph · — · 1/1 written · 1 run · $0.0343
- P5 · 2026-10-06 · mrph · — · 7/8 written · 3 runs · $0.2787 · 3 runs: 7+0+0 written; re-cut 1 card, failed again; debt run at max_tokens 25500 failed — debt open…
- P5 debt (fable) · — · claude -p · — · 1/1 written · 0 runs · $4.1723 · process-generation-judge, processor swap: Fable 5.1 xhigh; 14 tests, 1 acceptance run, 0 defects, 2…
- P7 smoke · 2026-10-06 · V2 binary · — · 3/3 written · 1 run · $0.0003 · exit 0, 2 generations, 3 requests, 355 in / 106 out tokens
- P9c · 2026-10-07 · mrph · — · 7/7 written · 1 run · $0.0873 · 1 run, no fix; burned: 2 unclosed fences, 1 missing files, 2 losing variants
- P9 switch test · — · V2 replay ×3 + mrph control · — · 0/8 written · 0 runs · $0.0750 · V2 before P9b, after P9b, after P9c
- P10a · 2026-10-07 · V2 binary · z-ai/glm-5.3 · 12/12 written · 4 runs · $0.3718 · 4 runs: 0 + 10 + 1 + 1 written; 3 data fixes, the third an operator exception after an emergency st… ← switch: builder mrph → V2 binary
- P10b1 · 2026-10-07 · V2 cut + V2 run · — · 10/10 written · 1 run · $0.0998 · 1 run, no fix; 4 retries won: probe-dir-judge r1, build-acceptances r1; 4 losing variants ← switch: builder V2 binary → V2 cut + V2 run
- P10b2 · 2026-10-07 · V2 cut + V2 run · — · 6/6 written · 1 run · $0.0780 · 1 run, no fix; retries won: read-plan-checks-judge r1, plan-command-judge r2
- P10c1 · 2026-10-07 · V2 cut + V2 run · — · 8/8 written · 1 run · $0.1289 · 1 run, no fix, no retry; 4 losing v2 variants of code cards
- P11 · 2026-10-07 · V2 cut + V2 run · — · 8/8 written · 1 run · $0.0737 · 1 run; retry won send-batch-judge r1; v2 won assemble-batch, send-batch
- P11 smoke · 2026-10-07 · V2 cut + V2 run on the batch route · z-ai/glm-5.3:batch · 2/2 written · 1 run · $0.0006 · exit 0, 1 generation = 1 batch `batch-1791388269-cp5qOr5IQ0xoz1ntuc8W`, 2 requests, 832 in / 103 ou…
- P11b1 · 2026-10-07 · V2/ds · — · 14/14 written · 1 run · $0.1379 · 1 run, no fix; 13 first attempt, retry won run-deck-judge r1; 7 untried v2 ← switch: builder V2 cut + V2 run → V2/ds
- P11c1 · 2026-10-07 · V2/ds · — · 12/12 written · 1 run · $0.0941 · 1 run, no fix; 11 first attempt, run-command-judge won at r2; 6 untried v2
- P11b2 · 2026-10-07 · V2/ds · deepseek/deepseek-v4.1-flash · 9/9 written · 1 run · $0.1183 · 1 run, no fix; 7 first attempt, retries won archive-run-judge r1, parse-command-judge r1; 4 untried… ← switch: model z-ai/glm-5.3 → deepseek/deepseek-v4.1-flash
- P11b2 smoke · 2026-10-07 · V2 detached batch route · — · 2/2 written · 1 run · $0.0006 · submit exit 0, process exited, state with cards+inputs; collect in a second process: 12 × exit 1 pe…

## What is next

- next phase (docs/PLAN.md): P12a · primer + cli · issue #1: архивы V2 и mrph с итогами, хронология фаз из MEASURE (столбец «прогоны»), «что дальше» из PLAN и AUTONOMY, хвост DECISIONS и issues из файла, тесты по профилю языка; `morph primer [--write]`
- handoff (docs/AUTONOMY.md):
  > State at handoff (07.10, after the P11b2 smoke)
  > Resumed by the operator 07.10 (smoke checked green; no code reviews until further notice). Next, in order: **P12** primer (issue #1,
  > label `P12-primer`) → **smoke stop** (V2 primer on this repo); P13a, P13b, P14 → **final smoke stop**. At each smoke stop:
  > 🧪, then stop; the operator resumes.
  > Lessons for the next preparations: default code targets add a test file (give a smoke cap or code-only targets); new

## Last decisions (docs/DECISIONS.md)

- P11b2 · cut · parse-command writes src/cli/types.ts, parse.ts AND main.ts; Main's code card is filtered out, main-judge depends on parse-command (map) · widening Command breaks main.ts's last `else runCommand(command)` under tsc until the routing lands: the two must be one card.
- P11b2 · acceptance · `decks/p11b2/checks.json`: ownGit true, fullExclude `tests/cli/parse.examples.test.ts`, code-only targets (new files `intent: generate`), no smoke cap; probes `decks/p11b2/parts/{submit-deck,collect-batch,archive-run,parse-command}.probe.ts` (24 tests) with a second processor i…
- P11b2 · smoke · slug of ds on the batch route unmeasured: the smoke's first call is a one-card submit with maxTokens 8 on `deepseek/deepseek-v4.1-flash:batch`; a 400 "does not have a :batch endpoint" falls back to `z-ai/glm-5.3:batch` (P11 smoke) · no paid call before the gate.
- P11b2 smoke · batch route · `deepseek/deepseek-v4.1-flash:batch` is accepted and completes (~73 min for one tiny request, finish `length` at maxTokens 8) — slow but working; the batch route stays on `z-ai/glm-5.3:batch` (processor glm53b, 733 s for 2 requests) · operator 07.10 after checking the sm…
- from P12 · verify step · no code reviews until further notice: step 4 keeps the mechanical checks (`git status` clean, tsc, eslint, vitest, build) and drops the read of the written code against §2.2; no review passes, no review issues · operator 07.10: the goal is to close all phases through P14.

## Open issues (.morph/issues.json)

- #6 P15 golang: Go language profile written by Morph itself + live validation on a small Go project [P15-golang]
- #1 primer: на TypeScript 0 тестов — счёт только по def test_* (Python) [P12-primer]
