# TASK_P28a — issue #22 M2: a red naming a kept file of a target's package is the owner's red, retried (`src/cards/transaction.ts`, `src/language/treeProfiles.ts`, `src/runloop/transaction.ts`)

Old-Morph scheme (README.md, Morph-Orchestrator v1). Phase P28 is split: **P28a = M2** (this file); P28b = M3 (deck
check names a stub that proves nothing) and the M4 documents. Record: Component cards, Function Blame Log (Neighbour
Rules, examples 9–10, `NeighbourRule`); Component language, Function Tree Profiles (NEIGHBOUR_RULES, examples 5–6,
Data Object Neighbour Profile); Component runloop-subset, Function Run Transaction (NEIGHBOUR_RULES passed, examples
14–15). Cut with `--only` (the three code cards patch code on main, their Components hold other Functions): the deck
is a transaction.

## 1. Why this

- MorphStudio P8b run 20261010-190913 (0/9 written, $0.18): `pm-tools` re-cut `mcpserver/pm.go` and dropped the
  unexported helpers `errorResult`/`jsonResult`; the kept `mcpserver/session.go` (same package, no card's target)
  went red at `== build`: `mcpserver/session.go:66:11: undefined: errorResult`. Blame Log calls an existing unowned
  file "outside", Run Transaction faults "outside the subset" and rolls back without a retry.
- MorphStudio P7c run 20261011-093033 (0/2 written): the same class, `supervisor/guard.go:140:12: l.currentCaps
  undefined` after a re-cut of `supervisor/loop.go`.
- A plain run would have retried the card with the `undefined:` lines in its log (cents on ds). The transaction is the
  mandated mode for a re-cut and the one with no retry here.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main** (P24c): `src/cards/transaction.ts` — `Blame`, `TestLines`, `blameLog(log, card, owners,
  fileLines, exists, testLines = [])`; `src/language/treeProfiles.ts` — `TreeProfile`, `TREE_PROFILES`,
  `treeProfileFor`, `TestProfile`, `TEST_LINES`; `src/runloop/transaction.ts` — `runTransaction`, whose Blame Log call
  passes `TREE_PROFILES.map((profile) => profile.fileLine)`, the exists callback and `TEST_LINES`.
- **The lines, measured 11.10** (go 1.22.2, tsc of this repository):
  - Go, `go build ./...` then `go vet ./...` on a package `calc` whose `b.go` uses `okView` and `fmtOut` that `a.go`
    dropped: `# example.com/m/calc`, `calc/b.go:4:7: undefined: okView`, `calc/b.go:5:9: undefined: fmtOut`,
    `# example.com/m/calc`, `vet: calc/b.go:4:7: undefined: okView`.
  - TypeScript, `tsc` (NodeNext): `src/b.ts(1,10): error TS2305: Module '"./a.js"' has no exported member 'fmtOut'.`
    and from `src/cli/c.ts`: `… Module '"../a.js"' …`. The module is in single quotes around double quotes.
- **Blame Log harness** (examples 9–10): P24c's — `const FL = TREE_PROFILES.map((p) => p.fileLine)`, `TEST_LINES`,
  `NEIGHBOUR_RULES` from `src/language/treeProfiles.js`; exists `() => true`.
- **Run Transaction harness** (examples 14–15): the P24 skeleton in `tests/runloop/transaction.p24.examples.test.ts`
  (`M`, `fence`, `card`, `deps`, `input`) plus `onVariant` pushing each record into a list (as in
  `tests/runloop/transaction.examples.test.ts`). Example 15's log line holds both quote kinds: the test writes it to
  `k.log` with `r.write` and the acceptance `cat`s it, so no shell quoting is needed.

### 2.2. OUTPUT data shapes

**`src/cards/transaction.ts`** (PATCH): `export interface NeighbourRule { file: string; directory: boolean; testFile:
string | null; module: string | null }` next to `TestLines`; `blameLog(log, card, owners, fileLines, exists,
testLines = [], neighbours: readonly NeighbourRule[] = [])`. Only the column-0 branch's last case changes:

| column-0 line, path p | main | P28a |
|---|---|---|
| p an own key of owners | owner blamed | unchanged |
| p not on disk | card blamed | unchanged |
| p on disk, no card's target (a kept file) | outside line | the first rule whose `file` matches p gives its neighbours; some → the owner of each blamed; none → outside line |
| rule `directory: true` | — | every own key k that `file` matches with dir(k) = dir(p); when `testFile` is set and p is not a test file, test-file keys are left out |
| rule `module` set | — | each match of `new RegExp(module, "g")` on rest: group 1 resolved against dir(p); k = it, or it with `.js/.jsx/.mjs/.cjs` → `.ts/.tsx/.mts/.cts`, when an own key |

dir(x) is x before its last `/` (`""` when none); the resolution is string work (`""` and `.` segments dropped, `..`
removes the one before). Still no import but the Card type; no `node:` module. With `neighbours` `[]` every result is
main's (examples 1–8 hold).

**`src/language/treeProfiles.ts`** (PATCH): adds `export interface NeighbourProfile { id: string; file: string;
directory: boolean; testFile: string | null; module: string | null }` and `export const NEIGHBOUR_RULES: readonly
NeighbourProfile[]`, three entries in PROFILES order with the record's strings character for character:

```ts
{ id: "typescript", file: "\\.[cm]?tsx?$", directory: false, testFile: null, module: "'\"?(\\.\\.?/[^'\"]+)\"?'" },
{ id: "python", file: "\\.pyi?$", directory: false, testFile: null, module: null },
{ id: "go", file: "\\.go$", directory: true, testFile: "_test\\.go$", module: null },
```
Everything else in the file unchanged; no import.

**`src/runloop/transaction.ts`** (PATCH): the Blame Log call gets `NEIGHBOUR_RULES` as its seventh argument (imported
with TREE_PROFILES and TEST_LINES from `"../language/treeProfiles.js"`). Nothing else changes: an outside line still
faults, a blamed card is retried by the existing rounds, caps and layers.

**Choice.** Go is by directory (a package is a directory; an unexported name crosses files with no import edge), so
every red line of a kept file in a target's package is the owner's. TypeScript is by the module a red line names
(`TS2305`, `TS2724`, `TS2307` quote it); a kept file in a target's directory that names no target module stays
outside — Run Transaction example 3 (`out/legacy.ts`) holds as written. A Go importer in another package
(`cmd/tool/main.go`, Blame Log example 1) stays outside: a record break of an exported name, P21's case.

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/cards/transaction.ts` | PATCH | probe only | NEW `tests/cards/transaction.p28.examples.test.ts` (Blame Log 9–10) |
| `src/language/treeProfiles.ts` | PATCH | probe only | NEW `tests/language/treeProfiles.p28.examples.test.ts` (Tree Profiles 5–6) |
| `src/runloop/transaction.ts` | PATCH | probe only | NEW `tests/runloop/transaction.p28.examples.test.ts` (Run Transaction 14–15) |

### 2.4. What must not break

- Byte for byte: every file but the 3 code targets and the 3 new judge files. Blame Log 1–8 (called without
  neighbours), Tree Profiles 1–4, Run Transaction 1–13 (`tests/**/transaction*.examples.test.ts`,
  `tests/language/treeProfiles*.examples.test.ts` unchanged).
- 973 tests in 160 files green (measured at b9bb6d2); after the run 973 + the judges' tests in 163 files.

## 3. Acceptance

Built by `morph plan --checks decks/p28a/checks.json`. `ownGit: true`, `frozen` the defaults + `templates`,
`fullExclude` the three new judge files.

- transaction-deck: tsc → eslint → guard → probe `decks/p28a/parts/transaction-deck.probe.ts` (Blame Log 9–10; 5–8
  green by design) → full.
- tree-profiles: probe `decks/p28a/parts/tree-profiles.probe.ts` (Tree Profiles 5–6) → full.
- run-transaction: probe `decks/p28a/parts/run-transaction.probe.ts` (Run Transaction 14–15) → full.
- Judges: new file, lits = the example names and the values named in the examples (checks.json).

## 4. Constraints

- NodeNext, `.js` imports, `import type`, no `any`. `src/cards/transaction.ts` imports only the Card type;
  `src/language/treeProfiles.ts` imports nothing; `src/runloop/transaction.ts` adds `NEIGHBOUR_RULES` to its
  treeProfiles import.
- Generations: transaction-deck and tree-profiles (0); their judges and run-transaction (1); run-transaction-judge (2).
- Tests write only under `tmpRoot()` and remove it; no JS timer; no network; each judge writes only its file.

## 7. Out of scope

- M3 (deck check warns when a target's stub is missing or equals the committed file), M1's pre-run naming, M4's
  documents → **P28b**.
- A Go importer in another package, a TypeScript red in a kept file that names no module (a changed type's shape):
  outside as on main (a record break).
- Python: no transaction (`plan --checks` refuses it); its rule entry is data only (module null, directory false).
- Narrowing the blamed owners further (a package with several code targets blames each of them; a retry costs cents).
- Issue #22 §8: MorphStudio's data fix, the pump-judge red, the old `mrph`, the compiler's envelope.
