# TASK_P28b — issue #22 M3: deck check says what its build did not prove (`src/cli/unprovenStubs.ts`, `src/cli/deckCheck.ts`, `src/cli/types.ts`)

Old-Morph scheme (README.md, Morph-Orchestrator v1). Second part of P28 (P28a = M2, the kept-neighbour blame).
Record: Component planner-subset, Function Unproven Stubs (NEW, example 1, Data Object Unproven); Component cli,
Function Deck Check (the `unproven` key, example 7 in `tests/fixtures/cli/examples.json`), Data Object Deck Check
Document. Cut with `--only` (both Components hold other Functions): the deck is a transaction.

## 1. Why this

- MorphStudio P8b: `decks/P8b/_stubs/mcpserver/pm.go` was byte-identical to the committed `pm.go`; `deck check`
  exited 0 with every build green — a tree where the rewritten file is replaced by itself compiles whatever the
  processor will drop. With a stub holding only the record's names the same command named
  `mcpserver/session.go:66:11: undefined: errorResult` (issue #22 §R3).
- MorphStudio P7c run 20261011-093033: `decks/P7c/` had no `_stubs/` at all, so `deck check` built nothing and said
  nothing; the run faulted on `supervisor/guard.go:140:12: l.currentCaps undefined`.
- A data rule the orchestrator follows only sometimes is not a defence: the tool has to say it.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main**: `src/cli/deckCheck.ts` — `deckCheckCommand(root, deckPath, sliceCapBytes, env = {})`;
  `src/cli/types.ts` — `DeckCheckDocument {deck, cards, generations, errors, warnings, hazards, weights, builds?}`;
  `src/cli/document.ts` — `readDeckFile(root, deckPath)` → `{ok: true, deck}` | `{ok: false, result}`;
  `src/cards/transaction.ts` — `isTransactionDeck(cards)`; `src/cards/types.ts` — `Deck`, `Card`.
- **The fixture** `tests/fixtures/cli/unproven.json`: a map path → text. `calc/a.go` `package calc\n`, `src/b.ts`,
  `src/c.ts`; `decks/q/deck.json` three cards `a` [calc/a.go] generate, `b` [src/b.ts, src/c.ts] patch, `n`
  [calc/new.go] generate, acceptances `exit 0`; `decks/q/_stubs/` holds `calc/a.go` (equal to the tree's),
  `src/b.ts` (different), `calc/new.go` (no file in the tree); `decks/t/deck.json` the same cards with
  `# morph: subset transaction\n` before each acceptance, no `_stubs/`; `decks/u/deck.json` the plain cards, no
  `_stubs/`.
- **The documents, measured on main** (b9bb6d2 binary, 11.10) are `tests/fixtures/cli/deckCheck.unproven.json`
  keys `q`, `t`, `u` with the P28b additions written in: q warnings 6 → 8 and `unproven` last; t warnings 3 → 6 and
  `unproven` last; u exactly main's.
- **Harness**: load the fixture with `for (const [p, t] of Object.entries(fixtureJson("cli/unproven.json") as
  Record<string, string>)) r.write(p, t);` on a `tmpRoot()`; env `{ PATH: process.env.PATH ?? "" }`.

### 2.2. OUTPUT data shapes

**`src/cli/unprovenStubs.ts`** (NEW, layer cli): `export interface Unproven { card: string; path: string; reason:
string }`, `export function unprovenStubs(root: string, deckPath: string, deck: Deck): Unproven[]`. Imports:
`node:fs`, `node:path`, `isTransactionDeck` from `"../cards/transaction.js"`, `import type { Deck }`.

| target t of a card (deck order, target order) | `_stubs/` beside the deck | no `_stubs/` |
|---|---|---|
| root/t not a regular file (a new file) | — | — |
| stub missing | `no stub: the build used the committed file` | transaction deck: `no _stubs/ beside the deck: no build ran`; plain deck: — |
| stub bytes equal to root/t | `the stub equals the committed file: the build proved nothing about its names` | (as above) |
| stub differs | — | (as above) |

**`src/cli/deckCheck.ts`** (PATCH): after builds, `unproven = unprovenStubs(root, deckPath, loaded.deck)`;
`warnings += unproven.length`; when not empty `document.unproven = unproven`, the LAST key (after builds, or after
weights when there is no builds key). The code stays `errors > 0 ? 2 : 0`.

**`src/cli/types.ts`** (PATCH): `DeckCheckDocument` gains `unproven?: Unproven[]` after `builds?`, with
`import type { Unproven } from "./unprovenStubs.js";`. Nothing else changes.

**Choice.** A separate key, not a Build Check note: `builds` is shared with the gate (`morph gate` reads Check
Builds), and a note there means "not built". A plain deck without `_stubs/` stays silent (every existing Deck Check
example and document holds byte for byte); the transaction is the case the skill makes `_stubs/` mandatory for.
A patch target whose stub is the current file is listed too: the build proved nothing about it either (issue #22 M1
"either intent"); the warning does not change the exit.

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/cli/unprovenStubs.ts` | NEW | probe only | NEW `tests/cli/unprovenStubs.examples.test.ts` (Unproven Stubs 1) |
| `src/cli/deckCheck.ts`, `src/cli/types.ts` | PATCH | probe only | NEW `tests/cli/deckCheck.p28.examples.test.ts` (Deck Check 7) |

### 2.4. What must not break

- Byte for byte: every file but the 3 code targets and the 2 new judge files. Deck Check 1–6, Main, the gate
  (`tests/cli/deckCheck*.examples.test.ts`, `tests/cli/main.examples.test.ts`, `tests/gate/**` unchanged): their
  decks have no `_stubs/`, or stubs that differ from their trees, or targets not on disk.
- After P28a: the suite of P28a's run green; after this run + the two judges' tests.

## 3. Acceptance

Built by `morph plan --checks decks/p28b/checks.json`. `ownGit: true`, `frozen` the defaults + `templates`,
`fullExclude` the two new judge files.

- unproven-stubs: tsc → eslint → guard → probe `decks/p28b/parts/unproven-stubs.probe.ts` → full.
- deck-check: probe `decks/p28b/parts/deck-check.probe.ts` (Deck Check 7) → full.
- Judges: new file, lits = the example names and the reasons (checks.json).

## 4. Constraints

- NodeNext, `.js` imports, `import type`, no `any`. Layer cli: `unprovenStubs.ts` imports `node:fs`, `node:path`
  and the cards layer only; nothing is written to disk.
- Generations: unproven-stubs (0); deck-check and unproven-stubs-judge (1); deck-check-judge (2).
- Tests write only under `tmpRoot()` and remove it; no JS timer; no network; each judge writes only its file.

## 7. Out of scope

- M1's pre-run naming of `K:<line>` and `h` for a stub equal to the tree: `deck check` already names it when the
  stub holds only the record's names (issue #22 §R3); this phase makes the other case visible, it does not build a
  symbol table. Python: Check Builds already notes "python has no compile or typecheck step: not built".
- A plain (unmarked) deck without `_stubs/`: silent as on main.
- M4 (the reference §4/§5 and the skill): documents, written by the orchestrator after this run.
- Issue #22 §8.
