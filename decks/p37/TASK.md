# P37 — related tests per card, the whole suite once per run (issue #49)

## 1. Why this

Every built acceptance ran the whole vitest suite at `== full`. The archive replay (issue #49 comment 6124636350;
35 acceptances of runs 20261009-153356, 20261011-142527, 20261011-153418, 20261012-065817, 20261012-075009, each on
the tree it saw, sequential): full 1 277.8 s, `vitest related --run <targets>` with the same excludes 254.6 s (−80 %);
per code card 14–62 s → 8–20 s, per judge 27–58 s → 1.0–3.3 s. Of 6 distinct full-run reds, 5 are caught by the
related tests of some card of the same deck; the one missed (P30, Primer Command example 9 reading a deleted
fixture) reads repository data without importing the changed code: the once-per-run net catches it.

## 2. Contract

### 2.1. Input shapes

- Card Context (builder) as today; `fullStep(ctx)` reads ctx.profile, ctx.targets, ctx.fullExclude.
- Suite Net reads Card (cards): customId, targets, acceptance (string | null). Fixture `tests/fixtures/cli/suiteNet.json`
  (one object): `files` (path → text: src/a.ts, src/b.ts, src/m/c.ts, tests/a.test.ts importing ../src/a.js and the
  missing ./gone.js, tests/helper.ts re-exporting ../src/m/c.js, tests/c.test.ts with `import('./helper.js')`),
  `cards` (a holds the related mark, b, c, j = 4 cards), `vitest` (five fake `node_modules/.bin/vitest` scripts:
  red, green, broken, runRed, runGreen) and `repo` (tests/a.test.ts for Run Command 13/14). Examples' given/then in
  `tests/fixtures/cli/examples.json` ("Suite Net 1–4", "Run Command 13–15").
- `tests/fixtures/builder/code1.txt, code2.txt, judge1.txt, judge2.txt`: the `== full` line in the related form.
- `tests/fixtures/builder/p10.related.json`: decks/p10/v2deck.json with each acceptance's `== full` line become
  fullStep's (12 cards, each differs in exactly that line).
- `tests/fixtures/identity/corpus.json`: p15 1 248 185 B, p21c 363 152 B, p22a 338 048 B (each cut differs from the old
  one only in its `== full` lines: 12 of 50, 10 of 10, 10 of 10 acceptances); go-mini and go-p7b unchanged.

Every expected value was measured by a spike (the change applied in a scratch worktree, never committed): the four
fixture texts, p10.related.json, the three corpus rows, every Suite Net and Run Command 13–15 value.

### 2.2. Output shapes

- `== full` line of a TypeScript acceptance: `echo '== full'; node_modules/.bin/vitest related --run <targets> --passWithNoTests[ --exclude <p>…] --reporter=dot > $P/vt.log 2>&1 || {…same failure report and locator…}`.
- Run Document: optional last key `suite: {command, ok, failing, cards, log}` (Suite Result) when some acceptance holds
  RELATED_MARK and no fault; exit 1 when the run was otherwise 0 and `suite.ok` is false.

### 2.3. Names

`src/builder/compose.ts` (RELATED_LINE, fullStep), `src/cli/suiteNet.ts` (RELATED_MARK, SUITE_LINE, SUITE_SCRIPT,
SuiteResult, suiteNet), `src/cli/runCommand.ts`, `src/cli/types.ts` (RunDocument.suite). Judges:
`tests/builder/compose.p37.examples.test.ts`, `tests/cli/suiteNet.examples.test.ts`,
`tests/cli/runCommand.p37.examples.test.ts`; `tests/builder/buildAcceptances.examples.test.ts` example 1 patched.

### 2.4. What must not break

The full suite except the two pinned goldens this phase changes (Build Acceptances example 1, Check Identity
example 1) — measured by the spike: 2 red of 1 103 before the data, 0 after. Go acceptances byte for byte.

## 3. Acceptance

`morph plan --checks decks/p37/checks.json --only …` (a transaction). Probes `decks/p37/parts/*.probe.ts`, stubs
`decks/p37/_stubs/`.

## 4. Constraints

NodeNext, no `any`, stubs from `tests/helpers.ts`, tests write only under tmp roots. cli: No Shell, No Network,
No Env, No Process (Suite Net runs its script through acceptance's Run Acceptance).

## 7. Out of scope

- Item 4 (Go): the Go `== full` stays `go test ./...` and Suite Net does not run for a Go deck. Importers of a package
  need `go list` at acceptance time (a design of its own), and the Go corpus suites run in seconds (go-mini 0.09 s).
- Python (no built acceptances).
- The net's result in report.json: it lives in the Run Document (stdout); RunReport (runloop, over 30 000 bytes) is
  not touched.
- Test sharding, a cache between attempts (the issue).

## 9. Pre-registration

7 cards (3 code, 4 judges), 3 generations, transaction. First red expected: run-command-judge's tmp-repo setup
(the fake vitest must be committed) or suite-net's import resolution. Cap $5.
