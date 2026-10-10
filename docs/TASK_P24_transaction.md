# TASK_P24 — issue #16, part 1: a transaction's retries are per card, a retry batch runs by layers, a rolled-back outcome keeps its attempt (`src/runloop/transaction.ts`, `src/runloop/types.ts`)

Old-Morph scheme (README.md, Morph-Orchestrator v1). Record: Component runloop-subset, Function Run Transaction
(behaviour amended, examples 8–11 added). Cut WITHOUT `--only`: `--component runloop-subset` selects exactly the two
cards of this phase, so the deck is not itself a transaction (the defect fixed here).

## 1. Why this

- P22a run 20261009-175810 and P22b run 20261009-211927: both 9/10 green on the final tree, both committed 0/10.
- 175810: parse-command-judge stopped at attempts 2 after 2 retry batches it was only partly in; the cap of 2 batches is
  counted over the whole run (`transaction.ts:385`, default `maxRetryBatches` 2).
- 211927: run-mutants-judge red once (attempts 1), never retried; one of the two batches was burned by
  `gate-command-judge.r1.v1 stale` (its slice holds `src/gate/gateCommand.ts`, rewritten by gate-command.r1 in the same
  flat `processGeneration`, `transaction.ts:444`).
- After either rollback every outcome has `winningVariant: null`: the fix deck regenerated 10 cards ($0.1752) against
  $0.0069 for the one red card. Part 2 (resume from archived answers) needs the kept attempt this part adds.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main**: `src/cards/types.ts` — `Card`, `Deck` ({cards, externalDependsOn}); `src/cards/layer.ts` —
  `layerGenerations(deck: Deck): string[][]` (customIds per generation; a dependsOn outside the deck is ignored);
  `src/runloop/types.ts` — `RunInput`, `RunDeps`, `RunResult`, `CardOutcome`, `RunReport`; `src/runloop/generation.ts` —
  `processGeneration(cards, deps, root)` → {outcomes, usage, requests, retryContexts}; `src/runloop/retry.ts` —
  `buildRetry(card, n, acceptanceOutput, previousDiff)`; everything else transaction.ts already imports.
- **Preconditions of the callees.** runloop · the stub processor answers `<id>.v1` from `<answersDir>/<id>.md`, a retry
  `<id>.r1.v1` from `<id>.r1.md` (Run Transaction 8–11). runloop · processGeneration compiles every card of its call
  first, then writes them in order; a card whose `contextSlice` file changed since its compile is discarded "stale inputs"
  (verdict "stale") — Run Transaction 9: in ONE call, j.r1 (slice out/a.ts) is stale after a.r1 writes out/a.ts. compiler
  · a slice file must exist at compile (j's out/a.ts is written by W first). acceptance · the log is the command's whole
  output ("a red once\n"); a log line `out/a.ts(1,14): …` blames out/a.ts's owner, a line with no file blames the card
  whose acceptance ran.
- **Fixtures**: none. Every example's literal lives in the record (runloop-subset, Run Transaction 8–11).
- **Harness skeleton** (Run Transaction 8–11; only `tests/helpers.ts` and the modules named):

```ts
const M = TRANSACTION_MARK + "\n";
const fence = (body: string): string => "```ts\n" + body + "```\n";
function card(customId: string, target: string, acceptance: string, dependsOn: string[] = [], contextSlice: string[] = []): Card {
  return { customId, intent: "generate", targets: [target], contextSlice, instruction: "write " + target, acceptance, model: null,
    maxTokens: null, reasoning: null, variants: 1, dependsOn }; }
const once = (mark: string, line: string): string => `[ -f ${mark} ] || { touch ${mark}; echo "${line}"; exit 1; }`;
const r = tmpRoot("morph-tx-"); const commits: string[] = []; const records: VariantRecord[] = [];
const deps: RunDeps = { config: { id: "stub", type: "stub", model: "stub", apiKey: null, baseUrl: "https://openrouter.ai/api/v1", route: "sync",
    concurrency: 4, providerOrder: null, reasoning: null, timeoutMs: 600000, maxRetries: 0, answersDir: r.root },
  transport: { fetch: fakeFetch().fetch, sleep: async () => {} },
  commit: (id, targets) => { commits.push(id); return { commit: "sha-" + id, diffstat: { files: targets.length, insertions: 1, deletions: 0 } }; },
  now: () => 0, env: { PATH: process.env.PATH ?? "" }, onVariant: (rec) => { records.push(rec); } };
const input = (cards: Card[], maxRetryBatches = 2): RunInput => ({ root: r.root, runId: "t1", branch: "morph/t1",
  deck: { cards, externalDependsOn: [] }, budget: { maxCards: 99, maxRetryBatches, deadline: 1e12 } });
```

**Distinct markers.** Answers A1 A2 A3 A4 A5 A7 A8 B2 B5 B7 B8 C3 C6 J1 J2; logs "red-a9", "a red once", "j red once",
"b red once", "c red once"; once-files r0.once r1.once r2.once a.once j.once b.once.

### 2.2. OUTPUT data shapes

**`src/runloop/types.ts`** (PATCH) — two optional keys, nothing else changes:

```ts
export interface CardOutcome { /* every key as now, then */ lastRound?: "green" | "red" }
export interface RunReport { /* runId … requests?: RequestUsage[]; */ stop?: string; fault?: string }
```

**`src/runloop/transaction.ts`** (PATCH) — Run Transaction as the record says; the changes against main:

| where | main | P24 |
|---|---|---|
| the stop before a retry batch | a blamed card with 2 retries, or `batches >= maxRetryBatches` over the run | a blamed card is capped at 2 retries (W's included), cap text `2 retries`; else at `maxRetryBatches` retries of this transaction, cap text `maxRetryBatches <m>`; no run-wide batch counter |
| a cap stop | rollback, nothing named | `report.stop = "retry cap: " + capped blamed cards in deck order as "<id> (<cap>)" joined ", "`, then rollback |
| the retry batch | one `processGeneration` of every blamed card | one call per generation of `layerGenerations(input.deck)` restricted to the blamed, in order, empty skipped |
| a rollback outcome | `winningVariant: null` | the variant whose files are on the tree (W's or the last written retry's); last key `lastRound` "green"/"red" when a round ran, absent when none ran (W's rollback) |
| report keys | … requests, fault | … requests, stop, fault (each when set; fault last) |

Unchanged: the deadline stop (outcomes "budget-exceeded" reason "deadline", no stop key), the outside-subset fault, the
interrupt and thrown-value paths, reasons, attempts, earlierFailures, acceptanceLog, written outcomes (no lastRound key),
Run Deck and deck.ts. Examples 1–7 hold unchanged (main's tests/runloop/transaction.examples.test.ts stays green).

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/runloop/transaction.ts`, `src/runloop/types.ts` | PATCH | probe only | NEW `tests/runloop/transaction.p24.examples.test.ts` (Run Transaction 8–11) |

The judge names its tests "Run Transaction example 8: …" … "Run Transaction example 11: …"; at most 6 own tests.

### 2.4. What must not break

- Byte for byte: every file but the 2 code targets and the judge's new file; `tests/runloop/transaction.examples.test.ts`
  (Run Transaction 1–7) green unchanged.
- 920 tests in 151 files green (measured at fa9b168 + data); after the run 920 + 4..10 in 152 files.

## 3. Acceptance

Built by `morph plan --checks decks/p24/checks.json`. `ownGit: true`, `frozen` the defaults + `templates`, `fullExclude`
the judge's new file.

- run-transaction: tsc → eslint → guard → the probe `decks/p24/parts/run-transaction.probe.ts` (Run Transaction 8–11, 4
  tests, one whole-summary `toStrictEqual` each) → full → own git → frozen → untracked.
- run-transaction-judge: `tests/runloop/transaction.p24.examples.test.ts`, new, min 4, max 10, lits `Run Transaction
  example 8` … `11`, `retry cap: a (2 retries)`, `retry cap: a (maxRetryBatches 1)`, `j.r1.v1`.

## 4. Constraints

- NodeNext, `.js` imports, `import type`, no `any`. transaction.ts adds one import, `layerGenerations` from
  "../cards/layer.js"; it runs no git, reads no clock but deps.now, no process.env.
- One generation per card: run-transaction (gen 0), run-transaction-judge (gen 1, reads transaction.ts and types.ts).
- Tests write only under `tmpRoot()` and remove it; no JS timer; no network; the judge writes only its file.

## 7. Out of scope

- **Issue #16 items 4–5 → the next phase (P24b):** `morph run` resuming a transaction from archived answers (Morph-Model
  kept, no Morph-Debt), the explicit `--transaction` flag, and `deck check` naming an import between subset targets that
  is no dependsOn edge.
- Run Deck (unmarked decks) and its per-generation cap; best-of-N inside a transaction; a smarter blame; a stop key for the
  deadline (its outcomes' reason "deadline" names it).
