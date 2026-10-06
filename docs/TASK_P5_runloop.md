# TASK_P5 — the run loop (`src/runloop/`)

> Phase P5 of `docs/PLAN.md` ("Фазы по записи (после P2)"), Component `runloop` of
> `contour.yaml` (four Functions: Resolve Runnable, Process Generation, Build Retry, Run
> Deck; two Data Objects: Card Outcome, Run Report). TypeScript under `src/runloop/`: resolve
> which cards of a generation can run, process one generation (compile → send → parse →
> verify per card, discard a stale answer, fire the commit hook on an accepted card),
> build the retry card for a failure, and drive a whole deck generation by generation with
> a budget, producing the Run Report. The milestone is an **end-to-end run of a deck on
> the stub processor inside vitest**: no network, no git. Built by the old Morph (`mrph`)
> on glm; judge cards write the example tests.
>
> Reconciliation with the PLAN: P5 = "runnable, process generation, retry, run deck, state
> и архив". The git step — the run branch, the per-card commit, the archive write and its
> commit — is P6 (`git`). runloop therefore takes the commit as an **injected hook**
> (`deps.commit`, a `CommitHook`) and **returns** the Run Report; it owns the Run Report
> schema and the archive layout but writes and commits nothing itself. The clock (`now`)
> and the processor transport (`fetch`, `sleep`) are injected too, so a test waits on no
> timer and opens no socket.

## 1. Why this

P5 is the first phase that composes the whole tree: `compiler` (compile, parse),
`processor` (send, stub), `acceptance` (verify, snapshot, diff), `cards` (layer). P7
(`cli`) will call `runDeck` for the first run of the `morph` binary, first on the stub,
then on glm. The old Morph paid for every rule below (`mrph/flows/run.py`, `generations.py`):

- **A dependency that died must not take its dependants down silently.** A failed card
  whose dependant still ran wasted a generation on code that could not compile. Here a
  card whose dependency failed, was skipped or ran out of budget is skipped at once, its
  reason naming the dependency (Resolve Runnable).
- **A stale answer applied over a changed input is a silent corruption.** A sibling in the
  same generation wrote a file this card's slice holds; the answer, generated against the
  old bytes, no longer fits. The digest captured at compile is re-checked before verify;
  a change discards the answer (Process Generation; `compareCaptures` of P2).
- **An unbounded run is a money leak.** A hung provider, a retry storm, a deck that never
  converges. The budget is three numbers checked at every generation boundary: `maxCards`,
  `maxRetryBatches`, `deadline` (Run Deck).
- **A diagnosis thrown away costs the next attempt.** The retry carries the acceptance
  output and the previous attempt's diff into the instruction, so the executor fixes what
  the acceptance reported instead of guessing again (Build Retry).

PLAN: 8 cards per phase at ≈ $0.1–0.2. This cut: 8 cards (4 code, 4 judge), 13 record
examples (4 + 3 + 3 + 3).

## 2. Contract

### 2.1. INPUT data shapes the code must build

Every example constructs its inputs inline or in a `tmpRoot()`; **no fixture files** (the
literals are small; the compiler, stub and acceptance read from a tmp tree). The shapes
the code and the tests construct, with their addresses:

- **A `Card`** and a **`Deck`** — `src/cards/types.ts` (P1): `Card = {customId, intent:
  "generate"|"patch", targets: string[], contextSlice: string[], instruction: string,
  acceptance: string | null, model, maxTokens, reasoning, variants: number, dependsOn:
  string[]}`; `Deck = {cards: Card[]; externalDependsOn: string[]}`. A test card sets every
  field (no defaults are applied here; the planner's defaults are P10). `acceptance` is the
  **shell command** verifyCard runs; a test uses shell builtins plus `grep`/`cat`, so the
  run gives the acceptance a `PATH` (see `env` below).
- **A `ProcessorConfig`** and a **`Transport`** — `src/processor/types.ts` (P4). A stub
  config is `{id: "stub", type: "stub", model: "stub", apiKey: null, baseUrl:
  "https://openrouter.ai/api/v1", route: "sync", concurrency: 4, providerOrder: null,
  reasoning: null, timeoutMs: 600000, maxRetries: 0, answersDir: <the tmp answers dir>}`.
  The transport is `{fetch: fakeFetch().fetch, sleep: async () => {}}` of `tests/helpers.ts`
  (P0): the stub route never calls `fetch`, and `sleep` resolves at once. `Usage` and
  `GenerationResult` are `src/processor/types.ts`.
- **A stub answers directory** — a `tmpRoot()` holding `<customId>.md` files. `sendGeneration`
  on a stub config reads `<requestCustomId>.md`, else the request id with a FINAL `.v<n>`
  stripped (`a.v1` → `a.md`; a retry request `a.r1.v1` → `a.r1.md`): see Stub Answer, P4.
  A test writes an answer whose body is a fenced block `` ```ts\nexport const x = "MARK";\n``` ``
  so that `parseAnswer` (one target) extracts `export const x = "MARK";\n` into the target
  file, and the card's acceptance (`grep -q MARK <target>`) passes.
- **`VariantAnswer` / `VerifyInput` / `VerifyOutcome` / `VariantResult`** —
  `src/acceptance/types.ts` (P3). `verifyCard(input: VerifyInput): Promise<VerifyOutcome>`;
  `VerifyInput = {root, targets, command, variants: VariantAnswer[], env, timeoutMs?}`.
- **A `CommitHook`, a `RunDeps`, a `RunBudget`, a `RunInput`** — `src/runloop/types.ts` (§2.2,
  written by the `resolve` card). A test builds `deps = {config, transport, commit, now,
  env}` where `commit: CommitHook = (customId, targets) => ({commit: "sha-"+customId,
  diffstat: {files: targets.length, insertions: 1, deletions: 0}})` and records the ids it
  was fired with, `now` is a function returning a fixed or scripted number, and `env = {PATH:
  process.env.PATH ?? ""}` (a test file may read `process.env`; the guard forbids it only in
  `src/`). The archive answers directory lives under the run `root`.

### 2.2. OUTPUT data shapes

`src/runloop/types.ts` exports exactly these names (types only, no values). It imports `Deck`
from `../cards/types.js` and `Usage`, `ProcessorConfig`, `Transport` from
`../processor/types.js` — all with `import type`; it exports none of them (`Card` is NOT
imported here: no type below names it, and eslint rejects an unused import).

```ts
import type { Deck } from "../cards/types.js";
import type { ProcessorConfig, Transport, Usage } from "../processor/types.js";

export type CardStatus = "written" | "failed" | "skipped" | "budget-exceeded";
export interface Diffstat { files: number; insertions: number; deletions: number }
export interface CommitInfo { commit: string; diffstat: Diffstat }
export type CommitHook = (customId: string, targets: string[]) => CommitInfo | null;
export interface CardOutcome {
  customId: string;
  status: CardStatus;
  reason: string | null;
  attempts: number;
  winningVariant: string | null;
  acceptanceLog: string;
  earlierFailures: string[];
  commit: string | null;
  diffstat: Diffstat | null;
}
export interface UsageTotals { inputTokens: number; outputTokens: number; cost: number | null; requests: number }
export interface RunReport {
  runId: string; completedAt: number; branch: string; processor: string;
  generations: number; outcomes: CardOutcome[]; usageTotals: UsageTotals;
}
export interface RunBudget { maxCards: number; maxRetryBatches: number; deadline: number }
export interface RunDeps {
  config: ProcessorConfig; transport: Transport; commit: CommitHook;
  now: () => number; env: Record<string, string>;
}
export interface RunInput { root: string; runId: string; branch: string; deck: Deck; budget: RunBudget }
export interface GenerationOutcome { outcomes: CardOutcome[]; usage: Usage[] }
export interface RunResult { report: RunReport; outcomes: CardOutcome[] }
```

Every object is built with its keys in the interface order.

**`resolveRunnable(cards: Card[], done: Record<string, CardStatus>): {runnable: Card[];
skipped: CardOutcome[]}`** (`src/runloop/resolve.ts`; pure, imports types only).

1. For each card in input order: scan `card.dependsOn` in order; the FIRST id `d` with
   `done[d]` present and not `"written"` makes the card skipped with reason `"dependency " +
   d + " " + done[d]` (e.g. `"dependency a failed"`). An id absent from `done` (external, or
   satisfied outside the run) is ignored.
2. A runnable card goes to `runnable`; a skipped card's outcome is `{customId: card.customId,
   status: "skipped", reason, attempts: 0, winningVariant: null, acceptanceLog: "",
   earlierFailures: [], commit: null, diffstat: null}`. Both lists keep the input order.

**`processGeneration(cards: Card[], deps: RunDeps, root: string): Promise<GenerationOutcome>`**
(`src/runloop/generation.ts`). Imports `compileCard` from `../compiler/compile.js`, `parseAnswer`
from `../compiler/parse.js`, `captureInputs` and `compareCaptures` from
`../compiler/capture.js`, `sendGeneration` from `../processor/send.js`, `verifyCard` from
`../acceptance/verify.js`; types from `../cards/types.js`, `../compiler/types.js`,
`../processor/types.js`, `../acceptance/types.js`, `./types.js` (all `import type`).

1. **Compile** every card with `compileCard(card, root)`. On `{ok: false, faults}` the card
   gets no request and its outcome (built in step 4) is `{status: "failed", reason:
   "compile: " + faults[0].message, attempts: 1, winningVariant: null, acceptanceLog:
   faults.map(f => f.message).join("\n"), earlierFailures: [], commit: null, diffstat:
   null}`. On `{ok: true, requests, inputs}` keep `requests` and the `inputs` digest.
2. **Send** all compiled-ok cards' requests, concatenated in card order, in ONE
   `sendGeneration(deps.config, requests, deps.transport)` call; split `answers` and `usage`
   back to each card by its request slice. `GenerationOutcome.usage` is every `usage` row
   returned (compile-failed cards add none).
3. **Verify** each compiled-ok card in card order (so an earlier card's accepted write is on
   disk before the next card is checked):
   - recompute `captureInputs(card, root)` and `compareCaptures(inputs, recomputed)`; a
     non-empty result → `{status: "failed", reason: "stale inputs", attempts: 1,
     winningVariant: null, acceptanceLog: "stale inputs: " + changed.join(", "),
     earlierFailures: [], commit: null, diffstat: null}`, and `verifyCard` is NOT called;
   - else build `variants: VariantAnswer[]`, one per request: `{variant: request.customId,
     answer: answer.text === null ? {corrupt: answer.error ?? "no text returned"} :
     parseAnswer(answer.text, card.targets)}`; call `verifyCard({root, targets:
     card.targets, command: card.acceptance ?? "", variants, env: deps.env, timeoutMs:
     deps.config.timeoutMs})`.
   - **accepted** (`outcome.accepted !== null`): let `w = outcome.accepted.variant`;
     `commitInfo = deps.commit(card.customId, card.targets)`; outcome `{status: "written",
     reason: null, attempts: 1, winningVariant: w, acceptanceLog: the matching result's log,
     earlierFailures: the logs of the results before the winner (in order), commit:
     commitInfo === null ? null : commitInfo.commit, diffstat: commitInfo === null ? null :
     commitInfo.diffstat}`.
   - **rejected** (`accepted === null`): outcome `{status: "failed", reason: "acceptance
     failed", attempts: 1, winningVariant: null, acceptanceLog: the LAST result's log,
     earlierFailures: the logs of every earlier result, commit: null, diffstat: null}`. If
     `card.acceptance === null` the command is `""` (exit 0 for an empty script); a planner
     always sets it, so this is not a separate error here.
4. Return `{outcomes, usage}` with `outcomes` in card order.

**`buildRetry(card: Card, attempt: number, acceptanceOutput: string, previousDiff: string |
null): Card`** (`src/runloop/retry.ts`; pure, imports `Card` type only).

1. `attempt` must be `1` or `2`, else `throw new Error("buildRetry: attempt must be 1 or 2")`.
2. `base` = `card.customId` with a trailing `/\.r[0-9]+$/` removed; the new `customId` is
   `base + ".r" + attempt`.
3. Copy `intent`, `targets`, `contextSlice`, `acceptance`, `model`, `maxTokens`, `reasoning`,
   `variants` from `card`; `dependsOn` is `[]`.
4. `instruction` = `card.instruction + "\n\nYour previous attempt failed its acceptance. Fix
   exactly what the acceptance reports and return the whole file again.\nAcceptance output:\n"
   + acceptanceOutput`, and when `previousDiff !== null`, `+ "\n\nYour previous attempt
   (rejected):\n" + previousDiff`.

**`runDeck(input: RunInput, deps: RunDeps): Promise<RunResult>`** (`src/runloop/deck.ts`). Imports
`layerGenerations` from `../cards/layer.js`, `resolveRunnable` from `./resolve.js`,
`processGeneration` from `./generation.js`, `buildRetry` from `./retry.js`; types from
`../cards/types.js`, `../processor/types.js`, `./types.js`.

1. `gens = layerGenerations(input.deck)` (`string[][]`). Keep `done: Map<string, CardOutcome>`
   keyed by the ORIGINAL card id, `cardsProcessed = 0`, `retryBatches = 0`, and a `Usage[]`
   accumulator.
2. `deps.now()` is called once at EACH generation boundary (before the generation is resolved)
   and once more at the very end for `completedAt`.
3. For each generation `g` of `gens`, the cards of `g` that are not yet in `done`:
   - **budget boundary**: `deps.now() >= input.budget.deadline` → each such card gets
     `{status: "budget-exceeded", reason: "deadline", attempts: 0, winningVariant: null,
     acceptanceLog: "", earlierFailures: [], commit: null, diffstat: null}`; else
     `cardsProcessed >= input.budget.maxCards` → the same with `reason: "maxCards " +
     input.budget.maxCards`. Either stops this generation (no resolve, no send).
   - else `resolveRunnable(cardsOfG, statusMap)` where `statusMap[id] = done.get(id).status`;
     record each `skipped` outcome in `done`. `processGeneration(runnable, deps, input.root)`;
     append its `usage`; record each outcome in `done`; `cardsProcessed += runnable.length`.
4. **Retry** after a generation: while there is a card in `done` with `status === "failed"`
   that has been retried fewer than 2 times AND `retryBatches < input.budget.maxRetryBatches`:
   one retry batch (`retryBatches += 1`) builds `buildRetry(originalCard, retryNumber,
   outcome.acceptanceLog, the last variant's diff or null)` for every such card (retryNumber
   = times retried so far + 1), runs `processGeneration(retries, deps, input.root)`, and for
   each result keyed back to its original card: a `"written"` retry replaces the card's
   outcome with `{...retryOutcome, customId: originalId, attempts: retryNumber + 1,
   earlierFailures: [...previous earlierFailures, previous acceptanceLog, ...retry
   earlierFailures]}`; a still-`"failed"` retry updates `attempts` and appends to
   `earlierFailures` the same way but keeps `status "failed"`. (The retry card's `commit`
   fires inside `processGeneration` under the retry id.) A failed card blocked only by the
   batch cap keeps `status "failed"`.
   — The last variant's diff for a `verifyCard` result is not surfaced by `processGeneration`;
   pass `null` here (the acceptance log already carries the diagnosis). `previousDiff` is kept
   in the contract for P6/P10, where the planner threads it through.
5. **Run Report**: `{runId: input.runId, completedAt: deps.now(), branch: input.branch,
   processor: deps.config.id, generations: gens.length, outcomes: the outcomes in the deck's
   card order, usageTotals: {inputTokens: Σ inputTokens, outputTokens: Σ outputTokens, cost:
   every row's cost summed, or null when no row reported a cost, requests: the number of
   usage rows}}`. Return `{report, outcomes}`.

### 2.3. Names

| module | exports | card writes no test | judge's test |
|---|---|---|---|
| `src/runloop/types.ts` | the types of §2.2, no values | — | — |
| `src/runloop/resolve.ts` | `resolveRunnable` | probe | `tests/runloop/resolve.examples.test.ts` |
| `src/runloop/generation.ts` | `processGeneration` | probe | `tests/runloop/generation.examples.test.ts` |
| `src/runloop/retry.ts` | `buildRetry` | probe | `tests/runloop/retry.examples.test.ts` |
| `src/runloop/deck.ts` | `runDeck` | probe | `tests/runloop/deck.examples.test.ts` |

A code card covered by a probe writes **no test file**. The `resolve` card writes `types.ts`
and `resolve.ts`. The judge's file holds one `test(...)` per example of its Function, in
record order, named `<Function> example <n>: <what>`, then at most twelve tests of its own on
§2.2. Compare outcomes, reports and configs whole with `toStrictEqual`; strings and numbers
with `toBe`; a `null` is checked `=== null` or inside `toStrictEqual`, never through `??` (the
P3 lesson). Every test that runs a deck or a generation uses the stub processor, a `fakeFetch`
transport whose `fetch` is never called, and an `env` carrying `PATH`; no `vi.mock`,
`vi.stubGlobal`, `vi.useFakeTimers`, no real timer, no function or variable named `fetch` or
`Fake*`. The global `fetch` stays blocked; child processes come only from `verifyCard`
(`src/acceptance/run.ts`).

### 2.4. What must not break

- P0–P4 untouched byte for byte: the scaffold, `src/cards/*`, `src/compiler/*`,
  `src/acceptance/*`, `src/processor/*` and their tests.
- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/` — untouched by every
  card.
- `tsc --noEmit`, `eslint src tests`, `vitest run` green on the whole tree after every
  generation; the 215 tests of P0–P4 stay green.

## 3. Acceptance

Built by `decks/tools/build.py p5` into the `acceptance` of every P5 card in `morph-map.json`;
`mrph plan --spec` copies it onto the card. Narrow to broad; the first red is the
regeneration's diagnosis.

Code cards (targets under `src/runloop/` only; `resolve` also writes `types.ts`):

1. `probe/<card>/`: the guard, a vitest config, `tsconfig.card.json` extending
   `../../tsconfig.json` and **excluding the targets of the other cards of the same
   generation**; removed on exit.
2. `tsc --noEmit -p probe/<card>/tsconfig.card.json` (project + probe).
3. `eslint <the card's targets>`.
4. `guard.mjs src <targets>`: layer `runloop` imports `cards`, `wait`, `store`, `compiler`,
   `response`, `acceptance`, `language`, `git`, `processor` (all `import type` for the ones
   whose values runloop does not call; it calls `compileCard`, `parseAnswer`, `captureInputs`,
   `compareCaptures`, `sendGeneration`, `verifyCard`, `layerGenerations`). No `fetch`, no
   `process`, no `process.env`, no `node:child_process`, no `console`, no `any`, no package
   imports. `Date`/`Math.random` are not forbidden in `runloop`, but §2.2 uses `deps.now`
   instead of `Date`.
5. `decks/p5/parts/<card>.probe.ts` under vitest: one `test` per record example of the card's
   Function, values **and** types, then one or two tests pinning the §2.2 rows. Nulls as
   `=== null` or inside `toStrictEqual`, never `??`.
6. `vitest run` — everything in the tree.
7. Frozen: `git diff --quiet HEAD -- contour.yaml morph-map.json docs decks tests/fixtures`;
   no untracked file other than the targets.

Judge cards (`tests/runloop/<m>.examples.test.ts`):

1–3. `probe/<card>/` (no probe file); the same `tsc`; `eslint <target>`.
4. `guard.mjs tests <target> <min> <max> lits.json` — `min` = the examples of the Function
   (Resolve Runnable 4, Process Generation 3, Build Retry 3, Run Deck 3), `max` = `min + 12`;
   `lits.json`: resolve `dependency a failed`, `dependency b skipped`, `budget-exceeded`;
   generation `written`, `acceptance failed`, `stale inputs`, `stub`; retry `c.r1`, `c.r2`,
   `Acceptance output:`, `buildRetry: attempt must be 1 or 2`; deck `budget-exceeded`,
   `deadline`, `written`.
5. `vitest run <target>`; 6. `vitest run`; 7. frozen and untracked as above.

Dense output: `--reporter=dot`, failures filtered to `^ FAIL |Error|expected|received`, 80
lines. Timeout of the whole chain 300 s; measured on a dry tree with stubs (§9).

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- **Layer**: `runloop` (`decks/tools/guard.mjs`, already defined) imports `cards`, `wait`,
  `store`, `compiler`, `response`, `acceptance`, `language`, `git`, `processor`. P5 does NOT
  import `git` or `store` (git is P6; the commit is the injected `deps.commit`). The transport
  and the clock are parameters; no `fetch`, `setTimeout`, `Date`, `process` or child process
  in `src/runloop/`; `verifyCard` owns the only child process.
- `types.ts` and `resolve.ts` and `retry.ts` import types only; `generation.ts` and `deck.ts`
  import the functions named in §2.2 and types.
- Every test writes only under a `tmpRoot()` and removes it; no fixture is written.
- A judge writes only its test file and never touches the module it tests.
- A file a card writes is in no sibling's slice in the same generation; a judge depends on its
  code card.
- Exact strings of §2.2 (`dependency <id> <status>`, `compile: `, `stale inputs`, `stale
  inputs: `, `acceptance failed`, `budget-exceeded` reasons `deadline` and `maxCards <n>`, the
  retry addendum, `buildRetry: attempt must be 1 or 2`, `sha-`/`stub` only in tests): the
  executor copies them, it does not rephrase.

## 7. Out of scope

- All of `git` (P6): the run branch, the per-card commit, the archive write
  (`.morph/runs/<runId>/{deck.json, report.json}`) and its commit. runloop fires `deps.commit`
  and returns the Run Report; P6 wires the real commit and writes the archive.
- The `cli` (P7): argv, dispatch, the single JSON out, exit codes, printing the report.
- The planner (P10): building the deck, defaults, the budget's values, threading
  `previousDiff` into the retry.
- The batch route (P11); choosing or reading the registry (P4, already done — the config is a
  parameter here).
- A Retry-After header, jitter, a per-request deadline other than the transport's timeout
  (owned by the processor); concurrency across generations (each generation is one
  `sendGeneration` call).

## 8. How to run

```
python3 decks/tools/build.py p5
cd /home/morph/MorphProject/morph-lab
venv/bin/mrph plan --root <repo> --spec <repo>/contour.yaml --map <repo>/morph-map.json --component runloop --judge   # dry
venv/bin/mrph deck clear --root <repo> && venv/bin/mrph deck reset --root <repo>
venv/bin/mrph plan --root <repo> --spec <repo>/contour.yaml --map <repo>/morph-map.json --component runloop --judge --add
venv/bin/mrph deck check --root <repo>
venv/bin/mrph run --root <repo> --processor glm53 --deadline 2400   # by the gate of docs/AUTONOMY.md
```

`mrph` reads `.env` from the current directory: run it from `morph-lab`, never from the repo.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards in the deck | 8 (4 code, 4 judge) |
| generations | 4 (resolve; process-generation + build-retry + resolve-judge; run-deck + process-generation-judge + build-retry-judge; run-deck-judge) |
| executor bill | ≈ $0.15 nominal (≈ 250k in, 60k out at $0.31/M in, $1.13/M out), ≤ $0.30 with a re-cut |
| cards with regeneration | 2 of 8 |
| `write-write` / `read-write` at `deck check` | 0 / 0 |
| tests after the run | 215 + 4 judge files; ≥ 13 judge example tests |
| chain on a dry tree with stubs | measured before the gate; code cards red at the probe per example (readable `Error`), judges red at the guard (count and literals); with a reference implementation every code chain green, and single-rule mutations redden the probe |
| first red | resolve: the reason string or the first-non-written rule; generation: the stale re-check skipped, or the commit hook not fired, or earlierFailures; deck: the budget boundary, the retry merge (attempts), or the generation count |

**Falsifiable claims:** (1) no card goes red on a sibling's file; (2) no judge red traces to
§2.1; (3) no test of this phase opens a socket (`network blocked in tests` never fires).

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), judge tests written,
defects the judge found the probe did not (and the reverse), the row of `docs/MEASURE.md`.

## 11. Actual

Filled after the run.
