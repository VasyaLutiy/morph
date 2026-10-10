# TASK_P24c — issue #19: a failing test's location blames its owner; an unattributed red stops; every round's log is kept (`src/cards/transaction.ts`, `src/language/treeProfiles.ts`, `src/runloop/transaction.ts`, `src/runloop/types.ts`)

Old-Morph scheme (README.md, Morph-Orchestrator v1). Record: Component cards, Function Blame Log (behaviour amended,
examples 5–8); Component language, Function Tree Profiles (TEST_LINES, examples 3–4, Data Object Test Profile);
Component runloop-subset, Function Run Transaction (unattributed stop, rounds, examples 12–13). Cut with `--only` (the
three code cards re-cut code on main, and their Components hold other Functions): the deck is a transaction.

## 1. Why this

- MorphStudio P7b run 20261010-133009 (ds, binary 90f10e4): the first group check was red on one go test assertion,
  `supervisor/guard_examples_test.go:136`, printed indented as `    guard_examples_test.go:136: …`. `blameLog` skips
  every indented line (`src/cards/transaction.ts:37`), so each card whose acceptance saw the red blamed itself: retry
  rounds r1 and r2 regenerated 7 cards of 12 each (attempts 3), 80 min, $0.7815, rolled back.
- The same run's compile and guard reds (column 0, full path) were blamed right: the narrow retry of #16 works when the
  blame does.
- The report keeps only each card's own red logs; the group's log per round (who was red, whom it blamed) is not in the
  archive, so the r1/r2 reds had to be read from the orchestrator's terminal.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main**: `src/cards/transaction.ts` — `Blame` ({cards, outside}), `blameLog(log, card, owners,
  fileLines, exists)`; `src/language/treeProfiles.ts` — `TreeProfile`, `TREE_PROFILES`, `treeProfileFor`;
  `src/runloop/types.ts` — `RunReport`, `CardOutcome`; `src/runloop/transaction.ts` — `runTransaction` (P24).
- **The logs, measured** (`tests/fixtures/cards/blameTestLogs.json`, real output, 10.10):
  - `go`: `go test ./...` on go-p7b's reference tree (module `morphlite`), one assertion broken in
    `daemon/daemon_examples_test.go` and one in `supervisor/guard_examples_test.go`:
    `--- FAIL: TestDaemonCoreExample2 (0.00s)` / `    daemon_examples_test.go:16: OnExit:` / … / `FAIL` /
    `FAIL\tmorphlite/daemon\t0.004s`, then the same for `morphlite/supervisor` (`guard_examples_test.go:18`).
    The location line is indented and holds the bare file name; its package is on the `FAIL\t<pkg>` line AFTER it.
  - `goPanic`: a nil dereference in `TestDaemonCorePanic`: tab-indented frames with absolute paths,
    `\t/usr/lib/go-1.22/src/testing/testing.go:1631 +0x24a`, `\t/tmp/morphlite/daemon/daemon_examples_test.go:22 +0x2`.
  - `typescript`: vitest `--reporter=dot`, `NO_COLOR=1`, from the first `^ FAIL ` line on (as every acceptance prints
    it): ` FAIL  tests/units/len.test.ts > one metre`, ` ❯ tests/units/len.test.ts:4:21`, ` ❯ toFeet
    src/units/len.ts:2:25`. Every location line starts with a space.
  - `python`: `pytest -q --tb=short`: `tests/test_calc.py:5: in test_half` (column 0) and
    `FAILED tests/test_calc.py::test_half - assert 2 == 4`.
- **Blame Log harness** (examples 5–8): `fixtureJson("cards/blameTestLogs.json") as Record<string, string>`;
  `const FL = TREE_PROFILES.map((p) => p.fileLine)`; `const on = (paths: string[]) => (p: string) => paths.includes(p)`;
  `blameLog(log, card, owners, FL, exists, TEST_LINES)`.
- **Run Transaction harness** (examples 12–13): the P24 skeleton (`docs/TASK_P24_transaction.md` §2.1, also in
  `tests/runloop/transaction.p24.examples.test.ts`): `M`, `fence`, `card`, `once`, the stub `deps`, `input`. The answers of
  example 12 are `a.md`, `c.md`, `j.md`, `j.r1.md`; `j` targets `out/j.test.ts`. Example 13's b acceptance is
  `M + 'touch out/zz.test.ts; echo " FAIL  out/zz.test.ts > zz"; exit 1'`.

### 2.2. OUTPUT data shapes

**`src/cards/transaction.ts`** (PATCH): `export interface TestLines { failLine: string | null; locationLine: string |
null; packageLine: string | null }`; `blameLog(log, card, owners, fileLines, exists, testLines: readonly TestLines[] =
[])` as the record's Blame Log says. The rest of the file is unchanged; still no import but the Card type.

| line | main | P24c (with testLines) |
|---|---|---|
| starts with `#`, or empty | skipped | skipped |
| column 0, a fileLine matches | owner / gone → card / else outside | unchanged |
| indented, or no fileLine matched | skipped | the first testLines pattern (entry order; failLine, locationLine, packageLine) |
| packageLine match | — | blames nothing; names the package of the bare names before it (else after) |
| failLine / locationLine path P | — | bare P from a locationLine joined to its package; candidates P, then minus leading segments; first owned → owner, first existing → nothing; none: relative P → card, absolute P → nothing |
| nothing blamed, nothing outside | card blamed | a testLines pattern matched → `{cards: [], outside: []}`; else card blamed |

**`src/language/treeProfiles.ts`** (PATCH): adds `export interface TestProfile` and `export const TEST_LINES`, the three
entries with the record's strings character for character; TREE_PROFILES, treeProfileFor and the file's other text
unchanged; no import.

**`src/runloop/types.ts`** (PATCH): adds `RoundRed` and `TransactionRound`; RunReport becomes
`… requests?: RequestUsage[]; rounds?: TransactionRound[]; stop?: string; fault?: string`.

**`src/runloop/transaction.ts`** (PATCH): against main (P24):

| where | main | P24c |
|---|---|---|
| Blame Log call | 5 arguments | + `TEST_LINES` (imported from "../language/treeProfiles.js") |
| a round with a red whose Blame names no card (after the outside check) | — (could not happen) | `stop = "unattributed red: " + those cards' ids, deck order, ", "`; rollback, no retry |
| every round | only per-card logs | `rounds.push({round, reds: [{customId, blamed: blame.cards, log}]})`, deck order; a green round `reds: []` |
| report keys | … requests, stop, fault | … requests, rounds (when a round ran), stop, fault |

Unchanged: the outside fault, the caps, the deadline, layers, reasons, attempts, earlierFailures, written outcomes,
Run Deck, deck.ts. An unattributed card's reason stays "transaction rolled back" (its Blame does not name it).

**Choice for item 2 (issue #19).** An unattributed red is a named stop, not a blame of the failing package's owners:
the package's owners are a guess (the P7b daemon package has a code card and a judge), and a stop costs no request.

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/cards/transaction.ts` | PATCH | probe only | NEW `tests/cards/transaction.p24c.examples.test.ts` (Blame Log 5–8) |
| `src/language/treeProfiles.ts` | PATCH | probe only | NEW `tests/language/treeProfiles.p24c.examples.test.ts` (Tree Profiles 3–4) |
| `src/runloop/transaction.ts`, `src/runloop/types.ts` | PATCH | probe only | NEW `tests/runloop/transaction.p24c.examples.test.ts` (Run Transaction 12–13) |

### 2.4. What must not break

- Byte for byte: every file but the 4 code targets and the 3 new judge files. Blame Log 1–4 hold as written (called
  without testLines); Tree Profiles 1–2; Run Transaction 1–11 (`tests/runloop/transaction*.examples.test.ts` unchanged).
- 927 tests in 152 files green (measured at 90f10e4); after the run 927 + the judges' tests in 155 files.

## 3. Acceptance

Built by `morph plan --checks decks/p24c/checks.json`. `ownGit: true`, `frozen` the defaults + `templates`,
`fullExclude` the three new judge files.

- transaction-deck: tsc → eslint → guard → probe `decks/p24c/parts/transaction-deck.probe.ts` (Blame Log 5–8) → full.
- tree-profiles: probe `decks/p24c/parts/tree-profiles.probe.ts` (Tree Profiles 3–4) → full.
- run-transaction: probe `decks/p24c/parts/run-transaction.probe.ts` (Run Transaction 12–13) → full.
- Judges: new file, lits = the example names and the values named in §2.3's examples (checks.json).

## 4. Constraints

- NodeNext, `.js` imports, `import type`, no `any`. src/cards/transaction.ts imports only the Card type (layer cards
  imports nothing); src/language/treeProfiles.ts imports nothing; transaction.ts adds `TEST_LINES` to its
  treeProfiles import.
- Generations: transaction-deck and tree-profiles (0); their judges and run-transaction (1); run-transaction-judge (2).
- Tests write only under `tmpRoot()` and remove it; no JS timer; no network; each judge writes only its file.

## 7. Out of scope

- Blaming the owners of a failing package when its location cannot be read (item 2's other option): not taken, §2.2.
- An outside line from a test line (an existing test file no card owns is an unattributed red, not an outside fault);
  Python's column-0 location lines keep the fileLine rule (outside when the file exists unowned).
- A judge's guard red hidden by a blamed test line in the same log (the "some line matched → no self-blame" rule of
  main); Run Deck (unmarked decks); deck check, the gate, the planner, the builder.
- The live acceptance on MorphStudio P7b (#19 "Re-run MorphStudio P7b on ds"): the operator side, after the merge.
