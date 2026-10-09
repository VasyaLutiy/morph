# TASK_P21b — the breaking re-cut, part b: `morph deck check` builds every Go card's stub tree and names `file:line` outside its targets (`src/planner/stubTrees.ts`, `src/acceptance/vetTree.ts`, `src/cli/checkBuilds.ts`, `src/cli/{deckCheck,types,main}.ts`)

> Phase P21b of `docs/PLAN.md` (issue VasyaLutiy/morph#12, label `P21-breaking-recut`), operator 09.10, comment
> 6077412737 (scope) and MorphStudio's amended request 4efde92 §6. **Split** (§2.2 "Split", DECISIONS "P21b"): the
> operator's item 1 (requirement 3.5, `deck check` builds each generation's stub tree) is this phase, **8 cards, 4
> generations**; item 2 (the subset transaction, direction B over the whole `--only` subset, a change of the run loop,
> with the forced-retry demo of 4efde92 §6) is **P21c** (§7). Code cards in Components **planner-subset** (Stub Trees,
> Check Builds — NEW), **acceptance** (Vet Tree — NEW) and **cli** (Deck Check, Main's one argument). One gate (≤ $1,
> slices ≤ 200 KB, chains < 250 s, §11).

## 1. Why this

- **The gate cannot see a record break of an `--only` deck by itself.** MorphStudio P7b (09.10, MorphV2 179c795, 12
  cards, $0): every red was `== build`/`== vet`/`== full` on ANOTHER card's or an outside file
  (`supervisor/guard.go:20:22: l.Resumes undefined`); the preparation's stub checks were per card and never compiled
  the module the way `== full` does. P21a added `decks/tools/fullvet.mjs`, a hand step of the regulation; MorphStudio's
  amendment (eb52a5a, comment 6075790078) requires the check **in the tool**: the PM's pre-flight runs `deck check`.
- **Measured on go-p7b** (reference code in a scratch worktree, never committed; `tests/fixtures/go-p7b` with its 8
  stubs in `decks/b1/_stubs/`): the deck cut the old way (binary f6cf44d, before P21a; `decks/b1/deck.p20.json`) →
  **code 2, 7 breaks over 5 of 8 cards**, phase-loop's `supervisor/guard.go:20:23: l.Resumes undefined (type *Loop has
  no field or method Resumes)`; the deck cut by main (P21a; `deck.p21.json`) → **code 0, 0 breaks**. 16 go vets in
  **3.9 s** (warm cache). Same numbers as `fullvet.mjs` on the demo's stub trees (main's binary 5/8, P21a 0/8).
- **A first-attempt model.** Each card's tree = its acceptance's own `$P/full.json` overlay (what it hides), the
  targets of every EARLIER generation and its own targets replaced by their stubs, everything else as on disk. Stubbing
  the generation's siblings too would flag the P21a deck (control-contract-judge: `guard.go:20:23` beside phase-loop's
  new `loop.go`) — that is the retry-after-sibling tree of the P21a smoke RED, which P21c's transaction replaces; measured
  and rejected here (§2.2 "Siblings").
- **Size.** 4 code cards + 4 judges = **8 cards**, 4 generations, code-only targets (probes, no smoke test). Reference:
  stubTrees.ts 1.9 KB new, vetTree.ts 2.0 KB new, checkBuilds.ts 1.5 KB new; deckCheck.ts 1.0 → 1.3 KB, types.ts +2
  lines, main.ts 1 argument.
- **Ripple, measured** (reference code + this phase's data, full suite): **0 of 812** red; Deck Check 1–3 and Main 2
  unchanged (no `_stubs/` beside their decks → no `builds` key).
- **Record sizes** (bytes of each Component block): planner-subset 11 694 → **19 070**; acceptance 15 197 → **19 383**;
  cli 29 857 → **29 850** (≤ 30 KB rule: Parse Command's "done {…}" shapes left to the Command schema, Plan Command's
  P15/P19/P20/P21 asides and the Component's command list (Main holds it) dropped; no rule removed).

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main** (module → what the new code calls or constructs): `src/cards/types.ts` — `Card` (`customId`,
  `targets`, `acceptance: string | null` …), `Deck` (`{cards}`); `src/cards/layer.ts` — `layerGenerations(deck)`;
  `src/cli/document.ts` — `readDeckFile(root, deckPath)` → `{ok: true, deck} | {ok: false, result}`;
  `src/cli/types.ts` — `CommandResult`, `DeckCheckDocument`, `CliDeps`, `CliIo`; `src/cli/main.ts` — routes `deck
  check` to `deckCheckCommand(root, command.deck, command.sliceCapBytes)`; `src/builder/goAcceptance.ts` — a Go
  acceptance holds `export GOFLAGS=-mod=… GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOWORK=off GOCACHE="${GOCACHE:-…}"
  GOPATH="${GOPATH:-…}"` on one line and the heredoc `cat > $P/full.json <<'MORPH_CONF_EOF'\n{"Replace":{…}}\nMORPH_CONF_EOF\n`
  (the `== full` overlay: paths → "").
- **Preconditions of the callees.** go · `-overlay` resolves relative paths against the working directory; an empty
  replacement deletes the file; a type error in a replaced file is printed with the REPLACEMENT's path
  (`vet: ./decks/b1/_stubs/supervisor/loop_examples_test.go:5:6: …`), a file on disk with its own path; the same
  error is printed twice (`<file>:…` by the build, `vet: <file>:…` by vet) — measured. go · a directory whose name
  starts with "_" is skipped by `./...`, so `_stubs/` beside a deck inside the module is never compiled itself. go ·
  with neither GOPATH nor HOME set, `-overlay` fails ("Files beneath GOMODCACHE () must not be replaced"): the env line
  sets GOPATH, so the examples use the full builder line. sh · `/bin/sh` with no PATH finds `/usr/local/bin/go` by its
  default path, so only a `go` script earlier on env's PATH proves env reaches the child (Vet Tree 3, Check Builds 3,
  Deck Check 6).
- **Fixtures** (`tests/fixtures/`), each by the type the Function takes:

| file | type | what it is | what the Function returns on it |
|---|---|---|---|
| `planner/stub.cards.json` (NEW) | ONE array of 7 `Card` | a, n (acceptance null), t (no Go acceptance), b, c, v (GOFLAGS line, no full.json), j — targets and Replace objects in the planner-subset description | Stub Trees 1–3 |
| `planner/stub.trees.json` (NEW) | ONE object "1", "2" → `StubTree[]` | the results of Stub Trees 1 (4 trees a, b, c, j) and 2 (2 trees a, j) | Stub Trees 1, 2 |
| `acceptance/vetOutput.txt` (NEW) | ONE text, 14 lines | a go vet output: `#` lines, a build line and its `vet:` twin (guard.go:20:23), daemon.go:9:81 with two tab lines, two stub-path lines under `./decks/q9/_stubs/`, `supervisor/loop.go:30: missing return` (no column), an mcp/session.go package line, a `go:` line | Vet Tree 1: 5 breaks, then 7 |
| `acceptance/vet/` (NEW) | files of a tmp root | `go.mod` (module example.com/vq), `b/b.go` (func Old), `a/a.go` (calls b.Old, line 6), `_stubs/b/b.go` (func New) | Vet Tree 2, 3 |
| `go-p7b/decks/b1/deck.p20.json` (NEW) | ONE deck file (8 cards) | go-p7b cut `--only` its 8 ids by binary f6cf44d (before Hide Later), 100 388 B | Check Builds 1 (7 breaks), Deck Check 4 (code 2) |
| `go-p7b/decks/b1/deck.p21.json` (NEW) | ONE deck file (8 cards) | the same cut by main (P21a), 102 206 B | Check Builds 1–3, Deck Check 4 (code 0), 6 |
| `go-p7b/decks/b1/_stubs/` (NEW) | 8 files of a tree | the gate's stubs of the 8 targets (= `decks/p21/break/stub/`, each stub test function renamed `TestStub<File>`: two stub tests of one package otherwise redeclare `TestStub`, measured) | Check Builds 1–3, Deck Check 4, 6 |
| `cli/checkBuilds.json` (NEW) | ONE object "p20", "p21", "p21 without the guard.go stub" → `BuildCheck[]` | Check Builds 1, 2 measured | Check Builds 1, 2; Deck Check 4 |
| `cli/examples.json` (keys "Deck Check 4", "5", "6" added) | ONE object | given/then of Deck Check 4–6 | — |

- **Harness skeletons** (only `tests/helpers.ts`, node:fs and the modules named; every test that runs go gets the
  vitest timeout 120000 as its third argument):

```ts
// Stub Trees
const cards = (): Card[] => fixtureJson("planner/stub.cards.json") as Card[];
const trees = (k: string): StubTree[] => (fixtureJson("planner/stub.trees.json") as Record<string, StubTree[]>)[k];
// Vet Tree, Check Builds, Deck Check: a tmp copy of a fixture tree; a go script first on PATH
function copyOf(name: string): TmpRoot { const r = tmpRoot(); fs.cpSync(fixturePath(name), r.root, { recursive: true }); return r; }
const G = 'export GOFLAGS=-mod=mod GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOWORK=off GOCACHE="${GOCACHE:-/tmp/morph/go-build}" GOPATH="${GOPATH:-/tmp/morph/go}"';
const pathEnv = (): Record<string, string> => ({ PATH: process.env.PATH ?? "" });
function goScript(r: TmpRoot, lines: string[]): Record<string, string> {
  r.write("bin/go", "#!/bin/sh\n" + lines.map((l) => 'echo "' + l + '"\n').join("") + "exit 1\n"); fs.chmodSync(r.path("bin/go"), 0o755);
  return { PATH: r.path("bin") + ":" + (process.env.PATH ?? "") }; }
// Check Builds: deck and generations as Deck Check computes them
function load(r: TmpRoot, deckPath: string): { deck: Deck; generations: string[][] } {
  const l = readDeckFile(r.root, deckPath); if (!l.ok) throw new Error(deckPath); return { deck: l.deck, generations: layerGenerations(l.deck) }; }
const builds = (k: string): BuildCheck[] => (fixtureJson("cli/checkBuilds.json") as Record<string, BuildCheck[]>)[k];
// Deck Check 6: io collecting
const out: string[] = [], err: string[] = []; const io: CliIo = { stdout: (t) => { out.push(t); }, stderr: (t) => { err.push(t); } };
// every root: try { … } finally { r.rm(); }
```

**Distinct markers.** Card ids a, n, t, b, c, v, j, zz; stub dirs "decks/q9/_stubs", "/abs/st", "decks/b1/_stubs",
"_stubs"; the module example.com/vq; the fake go line "fake go ran with $GOFLAGS"; timeouts 60000 and 700 (Vet Tree)
against the fixed 120000 (Check Builds). The code hard-codes none of them but "_stubs" and 120000, which the record fixes.

### 2.2. OUTPUT data shapes

**`src/planner/stubTrees.ts`** (NEW; layer planner; pure, node:path only) — **Stub Trees**:

```ts
import path from "node:path";
import type { Card } from "../cards/types.js";
export interface StubTree { card: string; generation: number; env: string; overlay: Record<string, string>; own: string[]; missing: string[] }
export function stubTrees(cards: Card[], generations: string[][], stubDir: string, stubs: string[]): StubTree[];
```

- For every g and every id of `generations[g]`, in order: the card with that customId (none → skipped) whose
  acceptance is a string holding the full.json heredoc (`/cat > \$P\/full\.json <<'MORPH_CONF_EOF'\n([\s\S]*?)\nMORPH_CONF_EOF\n/`)
  and a line starting `export GOFLAGS=` (`/^export GOFLAGS=.*$/m`); else skipped; a heredoc text that is not JSON →
  skipped.
- overlay = a copy of its `Replace` ({} when absent); then, for every card of `generations[0..g-1]` (flattened, in
  order, unknown ids skipped) and then the card itself, every target ending ".go" not yet a key (`Object.hasOwn`): in
  `stubs` → `path.posix.join(stubDir, target)`; else pushed to missing once.
- → `{card, generation: g, env: the whole GOFLAGS line, overlay, own: a copy of the card's targets, missing}`.

| example | given | result |
|---|---|---|
| Stub Trees 1 | stub.cards.json, generations [[a, n, t], [b, c, v], [j]], "decks/q9/_stubs", stubs [calc/a.go, calc/a_examples_test.go, calc/b.go, extra/z.go, report/c.go] | stub.trees.json["1"]: a (0) overlay {calc/b.go: "", report/c.go: "", calc/a.go: stub}, missing []; b (1) {report/c.go: "", calc/a.go, calc/b.go stubs}, missing [calc/n.go, calc/b_test.go]; c (1) {calc/b.go: "", calc/b_test.go: "", calc/a.go, report/c.go stubs}, missing [calc/n.go]; j (2) {report/c.go: "" (stays hidden), calc/a.go, calc/b.go, calc/a_examples_test.go stubs}, missing [calc/n.go, calc/b_test.go, calc/v.go] |
| Stub Trees 2 | generations [[a], [zz, j]], "/abs/st", stubs [calc/a_examples_test.go] | stub.trees.json["2"]: a (0) missing [calc/a.go]; j (1) {report/c.go: "", calc/a_examples_test.go: "/abs/st/calc/a_examples_test.go"}, missing [calc/a.go] |
| Stub Trees 3 | generations []; then [[t, n, v]] | []; then [] |

**`src/acceptance/vetTree.ts`** (NEW; layer acceptance — the one layer that may spawn besides git; env a parameter) —
**Vet Tree**:

```ts
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
export interface VetResult { exit: number | null; timedOut: boolean; breaks: string[] }
export function vetBreaks(output: string, overlay: Record<string, string>, own: string[]): string[];
export function vetTree(root: string, envLine: string, overlay: Record<string, string>, own: string[], env: Record<string, string>, timeoutMs: number): VetResult;
```

- vetTree: `fs.mkdtempSync(path.join(os.tmpdir(), "morph-vet-"))`, `overlay.json` there = `JSON.stringify({Replace:
  overlay})`; `spawnSync("/bin/sh", ["-c", envLine + "\ngo vet -overlay '" + file + "' ./... 2>&1"], {cwd: root, env,
  encoding: "utf8", timeout: timeoutMs})`; the directory removed in `finally`. timedOut = the spawn error's code
  "ETIMEDOUT"; exit = null when timed out, else the status; breaks = vetBreaks(stdout, overlay, own), then "go vet timed
  out after <timeoutMs> ms" when timed out.
- vetBreaks (pure): per line — blank, "#…" and lines starting with white space skipped; "vet: " removed, trimmed;
  `/^(?:\.\/)?([^\s:]+\.go):(\d.*)$/` → file mapped back (a non-empty overlay value → its first key), own skipped, else
  `file + ":" + rest`; any other line kept whole; a Set, then `sort()`.

| example | given | result |
|---|---|---|
| Vet Tree 1 | vetOutput.txt, the overlay of the record, own [supervisor/loop.go]; then {}, [] | 5 breaks (daemon.go:9:81, the go: line, mcp/session.go:6:2, guard.go:20:23 once, `supervisor/loop_examples_test.go:5:6: TestStub redeclared in this block` named by its target); then 7 (both stub lines by their stub paths, `supervisor/loop.go:30: missing return`) |
| Vet Tree 2 | acceptance/vet copied, G, env {PATH}, 60000: overlay {b/b.go: _stubs/b/b.go}, own [b/b.go]; own [a/a.go, b/b.go]; overlay {} | {1, false, ["a/a.go:6:25: undefined: b.Old"]}; {1, false, []}; {0, false, []} |
| Vet Tree 3 | envLine "export GOFLAGS=-mod=vendor", a go script on env's PATH; then "sleep 3", 700 | {1, false, ["x/fake.go:3:1: fake go ran with -mod=vendor"]}; {null, true, ["go vet timed out after 700 ms"]} under 3000 ms |

**`src/cli/checkBuilds.ts`** (NEW; layer cli; node:fs, node:path) — **Check Builds**:

```ts
import type { Deck } from "../cards/types.js";
export interface BuildCheck { card: string; generation: number; hidden: number; stubbed: number; missing: string[]; breaks: string[] }
export function checkBuilds(root: string, deckPath: string, deck: Deck, generations: string[][], env: Record<string, string>): BuildCheck[] | null;
```

- stubDir = `path.posix.join(path.posix.dirname(deckPath), "_stubs")`; `path.resolve(root, stubDir)` not a directory →
  null. stubs = every regular file under it (readdirSync withFileTypes, links not followed), relative, "/"-joined,
  `sort()`. Per Stub Trees(deck.cards, generations, stubDir, stubs) tree: hidden / stubbed = overlay values "" / not ""
  counted; breaks = vetTree(root, tree.env, tree.overlay, tree.own, env, 120000).breaks.

| example | given | result |
|---|---|---|
| Check Builds 1 | go-p7b copied; deck.p20.json; then deck.p21.json; env {PATH} | checkBuilds.json["p20"] (phase-loop breaks [guard.go:20:23 …], 7 breaks over 5 cards); then ["p21"] (no break, hidden [5, 4, 6, 4, 4, 2, 2, 0], stubbed [1, 2, 2, 4, 4, 6, 6, 8]) |
| Check Builds 2 | that root minus `decks/b1/_stubs/supervisor/guard.go`; deck.p21.json | ["p21 without the guard.go stub"]: runtime-guard missing it, no break (own); the three later cards missing it and breaking at guard.go:20:23 |
| Check Builds 3 | tiny.json as d.json + src/a.ts; then + `_stubs/src/a.ts`; then go-p7b deck.p21.json with a go script on env's PATH | null; []; 8 checks, each breaks ["x/fake.go:3:1: fake go ran with -mod=mod"] |

**`src/cli/deckCheck.ts`, `src/cli/types.ts`, `src/cli/main.ts`** (PATCH) — **Deck Check**, **Main**:
`deckCheckCommand(root, deckPath, sliceCapBytes, env: Record<string, string> = {})`; after today's document: builds =
checkBuilds(root, deckPath, deck, generations (the same Layer Generations), env); not null → `builds` is the
document's last key and errors += every missing and every break; code 2 when errors > 0. `DeckCheckDocument` gains
`builds?: BuildCheck[]` (`import type { BuildCheck } from "./checkBuilds.js"`). Main passes `deps.env` as the 4th
argument. Nothing else changes.

| example | given | result |
|---|---|---|
| Deck Check 4 | go-p7b copied, env {PATH}; deck.p20.json; then deck.p21.json | code 2, errors 7, warnings 0, builds = checkBuilds.json["p20"]; then code 0, errors 0, builds = ["p21"] |
| Deck Check 5 | Deck Check 2's tree + `_stubs/src/a.ts` | code 0, Deck Check 2's document + `builds: []` |
| Deck Check 6 | main, deck.p21.json, deps.env PATH with a go script first | 2; errors 8, every breaks ["x/fake.go:3:1: fake go ran with -mod=mod"]; stderr ["morph deck check: exit 2\n"] |

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P21b deckcheck"; #12 = issue VasyaLutiy/morph#12):

- **Split** · P21b = item 1 (3.5, 8 cards, forecast ≤ $0.20); P21c = item 2, the subset transaction (deferred
  acceptances over the whole `--only` subset, blame by file ownership, outside-subset stop, fixed-point re-check, every
  stage incl. probes on the full new tree, the forced judge retry of MorphStudio 4efde92 §6) · item 2 changes the run
  loop (Process Generation, Run Deck, Build Retry, Verify Card's caller, the report), ≥ 8 more cards; together over the
  12-card bound.
- **Where the stubs come from** · `<deck's directory>/_stubs/`, the gate's stub files at their targets' paths · the
  gate writes them anyway (AUTONOMY step 1); "_" keeps the go tool off them; no flag, so the PM's pre-flight needs no
  new argument; no directory → today's document byte for byte.
- **Per card, first attempt** · each Go card's own full.json + stubs of earlier generations and its own targets · the
  tree its first attempt's `== full` sees (the widest stage); a check per generation would ignore each card's own hide.
- **Siblings** · a card's generation siblings are not stubbed · stubbing them flags the P21a deck (control-contract-judge
  at guard.go:20:23 beside phase-loop's stub loop.go), the retry-after-sibling tree P21c replaces; acceptance of #12:
  0 on the P21a cut.
- **Own** · a line naming one of the card's own targets (by path or by its stub's path) is not a break · the stubs are
  the gate's; the card's own build is the stub run's business (stubcheck).
- **Missing stub** · an error (counted) · an earlier or own `.go` target without a stub leaves the old file on disk: a
  false green or a false red, never an honest tree.
- **The go runner** · in src/acceptance (Vet Tree), the layer that may spawn; env a parameter, Main passes deps.env ·
  no guard layer change (guard SHELL = acceptance, git); cli calls it, as Run Command calls the run loop.
- **vet only** · `go vet ./...` (type-checks every package with its tests, so it covers build) · one spawn per card.
- **Breaks deduped and sorted** · go prints a type error twice and orders packages by build completion.
- **Timeout** · 120 000 ms per card, a timeout is a break · a hung go never hangs the gate.
- **cli record** · compacted in place, no new Component · the Deck Check logic lives in Check Builds (planner-subset),
  so cli grows by 2 lines of text; shapes left to the Command schema.
- **Main** · a 4th argument `deps.env` · the child needs PATH/HOME; owned by the deck-check card (one invariant across
  deckCheck.ts and main.ts).

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/planner/stubTrees.ts` | NEW | probe only | NEW `tests/planner/stubTrees.examples.test.ts` (Stub Trees 1–3) |
| `src/acceptance/vetTree.ts` | NEW | probe only | NEW `tests/acceptance/vetTree.examples.test.ts` (Vet Tree 1–3) |
| `src/cli/checkBuilds.ts` | NEW | probe only | NEW `tests/cli/checkBuilds.examples.test.ts` (Check Builds 1–3) |
| `src/cli/deckCheck.ts`, `types.ts`, `main.ts` | PATCH | probe only | NEW `tests/cli/deckCheck.p21b.examples.test.ts` (Deck Check 4–6) |

- Each judge: "<Function> example <n>: <what>", one per example in record order, the skeleton's helpers, expected
  results from the named fixture or written out; at most 6 own tests; every go-running test with timeout 120000.

### 2.4. What must not break

- Byte for byte: every file outside the 6 code targets and the 4 new test files — every other `src/` file,
  `tests/helpers.ts`, every existing test file, `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/`,
  `templates/` (frozen).
- Every cut byte for byte (no planner or builder change): go-mini `--checks decks/m1/checks.json`, the P15 re-cut from
  0365336, go-p7b with and without `--only` — main's binary vs the run's (§11).
- 812 tests in 132 files green at every card; after the run **812 + 3 × 4 = 824** in 136 files (± the judges' own).

## 3. Acceptance

Built by `morph plan --checks decks/p21b/checks.json`, narrow to broad, every stage printing `== <stage>`. `ownGit:
true`, `frozen` the defaults + `templates`, no `fullExclude` (ripple 0).

Code cards (code-only targets): `probe/<card>/` → `tsc` (per-card tsconfig) → `eslint <targets>` → `guard.mjs src
<targets>` → the probe `decks/p21b/parts/<card>.probe.ts` (stub-trees ST 1–3 + 2 rows = 5; vet-tree VT 1–3 + 2 rows = 5;
check-builds CB 1–3 = 3; deck-check DC 4–6 + 1 row = 4; **17 tests**) → eslint's verdict → full `vitest run` → own git →
frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs tests <file> <min> <max> lits0.json` → `vitest
run <targets>` → eslint's verdict → full run → own git → frozen → untracked.

| file | new | min | max | lits |
|---|---|---|---|---|
| `tests/planner/stubTrees.examples.test.ts` | yes | 3 | 9 | `Stub Trees example 1` … `3`, `planner/stub.cards.json`, `planner/stub.trees.json`, `decks/q9/_stubs`, `/abs/st` |
| `tests/acceptance/vetTree.examples.test.ts` | yes | 3 | 9 | `Vet Tree example 1` … `3`, `acceptance/vetOutput.txt`, `acceptance/vet`, `a/a.go:6:25: undefined: b.Old`, `go vet timed out after 700 ms` |
| `tests/cli/checkBuilds.examples.test.ts` | yes | 3 | 9 | `Check Builds example 1` … `3`, `cli/checkBuilds.json`, `decks/b1/deck.p20.json`, `p21 without the guard.go stub`, `fake go ran with` |
| `tests/cli/deckCheck.p21b.examples.test.ts` | yes | 3 | 9 | `Deck Check example 4` … `6`, `decks/b1/deck.p20.json`, `_stubs/src/a.ts`, `morph deck check: exit 2` |

min = the record's new examples; max = min + 6.

**Output budget** (`max_tokens`, before the session's ×3 for `ds`):

| card | returns | `max_tokens` |
|---|---|---|
| stub-trees, vet-tree, check-builds | ≈ 1.5–2 KB new each | 8 000 |
| deck-check | deckCheck.ts + types.ts + main.ts ≈ 8 KB, three whole files | 14 000 |
| stub-trees-judge, vet-tree-judge | ≈ 4–5 KB new | 16 000 |
| check-builds-judge, deck-check-judge | ≈ 5–6 KB new, tmp roots, go runs | 20 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- **Layers** (guard unchanged): stubTrees.ts in planner imports `node:path` and the `Card` type only — no file read, no
  clock, no environment; vetTree.ts in acceptance imports `node:child_process`, `node:fs`, `node:os`, `node:path`, never
  reads `process.env` (env is a parameter); checkBuilds.ts in cli imports `node:fs`, `node:path`, `../planner/stubTrees.js`,
  `../acceptance/vetTree.js` and types; no `process`, no console in src/cli/* but the entry.
- A file a card writes is in no sibling's slice in the same generation: 0 [stub-trees, vet-tree]; 1 [check-builds,
  stub-trees-judge, vet-tree-judge] read stubTrees.ts and vetTree.ts; 2 [check-builds-judge, deck-check] read
  checkBuilds.ts; 3 [deck-check-judge] reads deckCheck.ts.
- Tests write only under `tmpRoot()` and remove it; no JS timer; no network (GOPROXY=off in every env line); a judge
  writes only its target.

## 7. Out of scope

Data of this phase (orchestrator, committed before the run): the fixtures of §2.1; `decks/p21b/` (checks, probes, deck).
After the merge the session (data): AUTONOMY step 1/2 and the templates' AUTONOMY/TASK_TEMPLATE — the gate puts its stubs
in `decks/<phase>/_stubs/` and `deck check` replaces the hand `fullvet.mjs` step for a Go deck.

**P21c (next phase, issue #12 item 2, MorphStudio 4efde92 §6):** the subset transaction, direction B over the WHOLE
`--only` subset — cards written by generations as today (later cards still see earlier code in slices); every acceptance
stage of every card (build, vet, probe, own, full) deferred until every subset card is written, then run on the full new
tree (latest versions); a build/vet line blames the card owning the file, only it is retried, against that full tree;
after every retry all acceptances re-run to a fixed point, rounds bounded like today's attempts; a line in a file
outside the subset = a record break: stop, named "outside the subset"; only `--only` decks switch, full cuts and existing
decks byte for byte; keeping later files hidden at run time is rejected. Its gate includes a **forced judge retry after
its generation-2 sibling has written**: a P21c demo on go-p7b (stub processor) whose control-contract-judge is red once
after phase-loop is written and green on the retry on the full tree, and the live go-p7b smoke on ds forcing the same
without a hand edit of code — candidate: the smoke's map gives control-contract-judge's first answer a red-once step
(a marker file under `/tmp/morph/<run>` created on the first acceptance run, data of the smoke deck cut by `plan`),
decided by P21c. Fixtures for blame (a red line in card X's file retries X only) and an outside-subset break.

Also out: TypeScript stub trees (a TS deck with `_stubs/` gets `builds: []`); a `--stubs` flag; checking a sibling's
retry tree (P21c).

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component planner-subset --component acceptance \
  --component cli --judge --checks decks/p21b/checks.json \
  --only stub-trees,vet-tree,check-builds,deck-check,stub-trees-judge,vet-tree-judge,check-builds-judge,deck-check-judge \
  --out decks/p21b/deck.json
python3 decks/tools/scale_tokens.py decks/p21b/deck.json 3         # processor ds
node dist/cli.js deck check --root . --deck decks/p21b/deck.json                                  # errors 0
rm -rf /tmp/v2bin-p21b && mkdir -p /tmp/v2bin-p21b && cp -r dist /tmp/v2bin-p21b/ && ln -s $PWD/node_modules /tmp/v2bin-p21b/node_modules \
  && ln -s $PWD/templates /tmp/v2bin-p21b/templates
node /tmp/v2bin-p21b/dist/cli.js run --root . --deck decks/p21b/deck.json --processor ds --deadline 2400
```

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 8 (4 code, 4 judges) / 4: [stub-trees, vet-tree] [check-builds, stub-trees-judge, vet-tree-judge] [check-builds-judge, deck-check] [deck-check-judge] |
| executor bill | ≈ $0.08–0.15 on ds ×3 (P21a: 8 cards $0.1969); ≤ $0.35 with a re-cut; cap $5 |
| cards with regeneration | 0–2 of 8 (vet-tree: the stub-path mapping or the dedup; deck-check: types.ts import or the key order; judges: a go test without the 120000 timeout) |
| tests after the run | 824 ± 6 in 136 files |
| first red | stub-trees: siblings stubbed, or a hidden key overwritten by a stub; vet-tree: a stub path left unmapped, "vet: " kept, tab lines kept, no sort; check-builds: links followed or stubs unsorted; deck-check: errors not counting missing, builds key present without `_stubs/` |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no answer cut at its `max_tokens`; (3) after the run no
file outside §2.3's ten changed; (4) every cut byte for byte; (5) this repository's HEAD and refs unchanged by every
card; (6) after the merge `deck check` on go-p7b exits 2 naming `supervisor/guard.go:20` on deck.p20.json and 0 on
deck.p21.json with the run's binary.

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the MEASURE row
with its `прогоны` cell, the vitest log of every verify run; DECISIONS lines "P21b deckcheck"; after the merge the byte
identity re-cuts against main's binary and claim 6; then the stop for the operator (`~/.morph-wait-operator`); P21c is
prepared after the operator's word.

## 11. Actual

### Gate (preparation)

(filled at the gate)
