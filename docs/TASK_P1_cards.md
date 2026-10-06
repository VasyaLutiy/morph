# TASK_P1 — the card and deck model (`src/cards/`)

> Phase P1 of `docs/PLAN.md`, Component `cards` of `contour.yaml`. Pure TypeScript under
> `src/cards/`: validate a card, load a deck, layer it into generations, find ownership
> hazards, weigh slices on disk. Built by the old Morph (`mrph`) on glm; judge cards
> write the example tests. No network, no git, no clock, no `process`.

## 1. Why this

Every later Component consumes `Card`, `Deck` and `Hazard` (PLAN: P2–P18, ≈140 cards,
`store`, `compiler`, `planner`, `cli` all import `src/cards/`). A shape that drifts here
is paid by every card after it: on the previous TypeScript deck of this builder a
helpers type written as `string` instead of a union cost two downstream `tsc` reds, and
`tsc` was the first red on 8 of 19 failed variants (lessons, ETHSC ph. 16). P0 repeated
the pattern: `tsc` first red on 3 of 4 burned variants. So P1 fixes the types in one
file owned by one card, every union is literal, every fault message is a pinned string,
and the acceptance type-checks each card alone (its own `tsconfig`) before anything runs.
PLAN row P1: 8 cards, forecast $0.7, 3 code cards in parallel in generation 1.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **A card object** (`Deck File` of the record, flat form): a JSON object with the keys
  of §2.2 `Card`. Valid minimal example, `tests/fixtures/decks/tiny.json` (91 bytes):
  `[{"customId": "a", "intent": "generate", "targets": ["src/a.ts"], "instruction": "x"}]`.
  Untrusted input is `unknown`; the validator narrows it. Three invalid cards are
  `tests/fixtures/cards/badId.json`, `threeFaults.json`, `repeatTarget.json` (the
  record's Validate Card examples 2–4, verbatim).
- **Deck files** under `tests/fixtures/decks/`: `tiny`, `duplicate` (a, b, b), `cycle`
  (a→b→a), `external` (a→zzz), `layered` (a; b→a; c→a; d→b,c), `layeredExternal`
  (a→ext; b), `hazardsWriteWrite` (a and b both target `src/x.ts`, slices `docs/a.md` /
  `docs/b.md`), `hazardsReadWrite` (a targets `src/x.ts`, b targets `src/y.ts` and reads
  `src/x.ts`), `hazardsUnordered` (a reads `src/b.ts`; b→a targets `src/b.ts`), `weigh`
  (card a: slice `tests/fixtures/weigh/ten.txt` = 10 bytes and `hundred.txt` = 100 bytes,
  target `tests/fixtures/weigh/missing.txt` which does not exist). Read them with
  `fixture("decks/<name>.json")` / `fixtureJson(...)` from `tests/helpers.ts`.
- **Types**: everything in §2.2 is defined in `src/cards/types.ts`, written in this
  phase by the card that owns `src/cards/model.ts`. Every other module imports its types
  from there with `import type { ... } from "./types.js"`; tests import from
  `../../src/cards/types.js`.
- **Test helpers**: `tests/helpers.ts` (P0, accepted): `tmpRoot()` gives a directory to
  write into (`write(rel, text)` returns the absolute path; `rm()`); `fixture`,
  `fixtureJson`, `fixturePath` read `tests/fixtures/`. Tests write nowhere else.

### 2.2. OUTPUT data shapes

`src/cards/types.ts` exports exactly these names (and nothing with a value: types only):

```ts
export type Intent = "generate" | "patch";
export type Effort = "low" | "medium" | "high";
export type Reasoning = { maxTokens: number } | { effort: Effort };
export interface Card {
  customId: string;            // matches ^[A-Za-z0-9._-]+$
  intent: Intent;
  targets: string[];           // non-empty, normalised, distinct
  contextSlice: string[];      // default [] = "instruction only"
  instruction: string;         // non-empty
  acceptance: string | null;   // default null
  model: string | null;        // default null
  maxTokens: number | null;    // default null
  reasoning: Reasoning | null; // default null
  variants: number;            // integer >= 1, default 1
  dependsOn: string[];         // default []
}
export interface Deck { cards: Card[]; externalDependsOn: string[] }
export interface Fault { key: string; message: string }
export type CardResult = { ok: true; card: Card } | { ok: false; faults: Fault[] };
export type DeckResult = { ok: true; deck: Deck } | { ok: false; faults: Fault[] };
export type HazardKind = "write-write" | "read-write" | "implicit-read" | "unordered-read" | "oversized-slice";
export type Severity = "error" | "warning";
export interface Repair { addDependsOn: { card: string; on: string } }
export interface Hazard {
  kind: HazardKind; severity: Severity; cards: string[]; path: string | null;
  repair: Repair | null; bytes?: number; cap?: number;   // bytes and cap only on oversized-slice
}
export interface SliceWeight { card: string; bytes: number; missing: string[] }
export interface Weighing { weights: SliceWeight[]; hazards: Hazard[] }
```

**`validateCard(input: unknown): CardResult`** (`src/cards/model.ts`). A `Fault` is
`{key, message}`; `message` is one line and starts with the key. Keys are checked in
**schema order** — customId, intent, targets, contextSlice, instruction, acceptance,
model, maxTokens, reasoning, variants, dependsOn — then unknown keys in input order; all
faults are returned at once. Per key, the first failing rule in the order listed stops
that key's checks, except the per-element rules, which report every offending element.
`<v>` is the offending value as given (a string without quotes added by the code unless
the message shows quotes).

| key | rule | message |
|---|---|---|
| (whole input) | not a plain object (null, array, primitive) | key `card`: `card is not an object` (the only fault) |
| customId | absent / not a string / no match | `customId is required` / `customId is not a string` / `customId '<v>' does not match ^[A-Za-z0-9._-]+$` |
| intent | absent / not a string / not generate or patch | `intent is required` / `intent is not a string` / `intent '<v>' is not generate\|patch` |
| targets | absent / not an array of strings / empty / element not repo-relative / element repeats an earlier one after normalisation | `targets is required` / `targets is not a list of strings` / `targets is empty` / `targets '<p>' is not repo-relative` / `targets repeat <p> after normalisation` (`<p>` normalised) |
| contextSlice | absent → `[]`; not an array of strings / element not repo-relative / repeat | `contextSlice is not a list of strings` / `contextSlice '<p>' is not repo-relative` / `contextSlice repeat <p> after normalisation` |
| instruction | absent / not a string / empty after trim | `instruction is required` / `instruction is not a string` / `instruction is empty` |
| acceptance, model | absent or null → `null`; otherwise not a string | `acceptance is not a string or null`, `model is not a string or null` |
| maxTokens | absent or null → `null`; otherwise not an integer ≥ 1 | `maxTokens is not a positive integer or null` |
| reasoning | absent or null → `null`; otherwise not exactly `{maxTokens: integer ≥ 1}` or exactly `{effort: "low"\|"medium"\|"high"}` | `reasoning is not {maxTokens} or {effort} or null` |
| variants | absent → `1`; otherwise not an integer ≥ 1 | `variants is not an integer >= 1` |
| dependsOn | absent → `[]`; not an array of strings / element not matching the customId pattern / repeat | `dependsOn is not a list of strings` / `dependsOn '<v>' does not match ^[A-Za-z0-9._-]+$` / `dependsOn repeat <v>` |
| any other key `k` | present | key `k`: `k is not a Card key` |

Path normalisation: `path.posix.normalize(p)`, then a leading `./` removed. A path is
repo-relative when, after normalisation, it is not empty, not `.`, does not start with
`/` and does not start with `../`. The `Card` holds the **normalised** strings. So
`{"targets": ["src/a.ts", "./src/a.ts"]}` gives one fault
`targets repeat src/a.ts after normalisation`; `{"intent": "todo", "targets": [],
"instruction": ""}` gives exactly three faults with keys `intent`, `targets`,
`instruction` in that order. A valid minimal card comes back with `contextSlice []`,
`acceptance null`, `model null`, `maxTokens null`, `reasoning null`, `variants 1`,
`dependsOn []`.

**`loadDeck(text: string): DeckResult`** (`src/cards/model.ts`). `text` is the content
of a deck file; the caller reads the file (this module reads none).

- Not JSON → one fault, key `deck`, message `deck is not valid JSON: ` + the
  `SyntaxError` message. Not an array → key `deck`, `deck is not a JSON array`.
- Element `i` is validated with `validateCard`; each of its faults is re-keyed
  `cards[<i>].<key>` (message unchanged), so a bad id in the first element reads
  key `cards[0].customId`.
- Duplicate: an element whose `customId` equals an earlier element's gets the fault
  key `cards[<i>].customId`, message `duplicate customId <id>` (a, b, b → one fault,
  key `cards[2].customId`, `duplicate customId b`).
- Cycle: over the valid cards, `dependsOn` edges to cards in the deck; a depth-first
  walk from each card in deck order, following `dependsOn` in list order; the **first**
  back edge met names the cycle from the repeated card around to itself, one fault, key
  `dependsOn`, message `dependsOn cycle a -> b -> a`; the walk stops at the first cycle.
- Order of faults: per element in element order (validation faults, then the duplicate
  fault), then the cycle fault last.
- No faults → `{ok: true, deck}` with `cards` in file order (normalised) and
  `externalDependsOn` = the distinct `dependsOn` names that are not a `customId` of the
  deck, in first-appearance order (deck order, then list order). `[]` loads as an empty
  deck. a (dependsOn [zzz]) alone → no fault, `externalDependsOn` `["zzz"]`.

**`layerGenerations(deck: Deck): string[][]`** (`src/cards/layer.ts`). Generation of a
card = 0 with no in-deck dependency, else 1 + the max generation of its in-deck
dependencies; names in `externalDependsOn` do not count. Within a generation, deck
order. No empty inner list; an empty deck gives `[]`. layered → `[["a"],["b","c"],["d"]]`;
layeredExternal → `[["a","b"]]`. A hand-built `Deck` with a cycle (loadDeck never
returns one) throws an `Error` whose message starts with `dependsOn cycle`.

**`findHazards(deck: Deck): Hazard[]`** (`src/cards/hazards.ts`), with generations from
`layerGenerations`. Paths compare as strings (already normalised). Output order: all
`write-write`, then all `read-write`, then all `unordered-read`, then all `implicit-read`.
`bytes` and `cap` are absent on all of them.

- `write-write`, `error`: a path targeted by two or more cards of **one** generation;
  one hazard per such (generation, path) with `cards` = every owner in deck order,
  `repair: null`; ordered by the deck position of the first owner, then by that owner's
  `targets` order. hazardsWriteWrite → exactly one hazard `{kind: "write-write",
  severity: "error", cards: ["a","b"], path: "src/x.ts", repair: null}`.
- `read-write`, `error`: card R's `contextSlice` names a path that a card W of the
  **same** generation targets; one hazard per (R, slice entry, W) with `cards: [R, W]`,
  `repair: {addDependsOn: {card: R, on: W}}`; R in deck order, then slice order, then W
  in deck order. hazardsReadWrite → exactly one hazard `{kind: "read-write", severity:
  "error", cards: ["b","a"], path: "src/x.ts", repair: {addDependsOn: {card: "b", on:
  "a"}}}`.
- `unordered-read`, `warning`: R's slice names a path targeted by a card W of a **later**
  generation (which implies no dependsOn path from R to W); `cards: [R, W]`, `repair:
  null`, same ordering. hazardsUnordered → exactly one hazard, cards `["a","b"]`, path
  `src/b.ts`.
- `implicit-read`, `warning`: a card with `contextSlice []`; `cards: [id]`, `path: null`,
  `repair: null`; deck order. tiny → exactly one, cards `["a"]`.

**`weighSlices(deck: Deck, root: string, cap = 500000): Weighing`**
(`src/cards/weigh.ts`). For every card in deck order, the files are `contextSlice` then
`targets`, distinct by string; each is `path.join(root, file)`; a regular file counts
`fs.statSync(...).size`, anything else (missing, directory) counts 0 and is appended to
`missing` in that order. `weights[i]` is `{card, bytes, missing}` for `deck.cards[i]`.
`hazards` holds one `{kind: "oversized-slice", severity: "warning", cards: [id], path:
null, repair: null, bytes, cap}` per card with `bytes > cap`, deck order. A card whose
one target is a 600001-byte file under `root`, default cap → one hazard with `bytes
600001`, `cap 500000`. `weigh.json` with `root` = the repository root → `bytes 110`,
`missing ["tests/fixtures/weigh/missing.txt"]`, no hazard; with `cap` 100 → one hazard,
`bytes 110`, `cap 100`. `root` is always a parameter: the module never reads
`process.cwd()` or any environment.

### 2.3. Names

| module | exports | author's smoke test | judge's test |
|---|---|---|---|
| `src/cards/types.ts` | the types of §2.2, no values | — | — |
| `src/cards/model.ts` | `validateCard`, `loadDeck` | `tests/cards/model.test.ts` | `tests/cards/model.examples.test.ts` |
| `src/cards/layer.ts` | `layerGenerations` | `tests/cards/layer.test.ts` | `tests/cards/layer.examples.test.ts` |
| `src/cards/hazards.ts` | `findHazards` | `tests/cards/hazards.test.ts` | `tests/cards/hazards.examples.test.ts` |
| `src/cards/weigh.ts` | `weighSlices` | `tests/cards/weigh.test.ts` | `tests/cards/weigh.examples.test.ts` |

Imports between them: `model`, `layer`, `hazards`, `weigh` import `./types.js` (types
only); `hazards` imports `layerGenerations` from `./layer.js`; nothing under
`src/cards/` imports anything else of `src/`. Node modules: `node:path` in `model`
(normalisation) and `weigh`; `node:fs` only in `weigh`.

A judge's test file holds one `test(...)` per example of its Function(s), in record
order, named `<Function> example <n>` (e.g. `Validate Card example 1`), then at most
twelve more tests of its own. Lists are compared as `JSON.stringify(got)` against the
literal from the record (`[["a"],["b","c"],["d"]]`); faults as `faults.length`,
`faults[0].key`, `faults[0].message` with `toBe`; hazards field by field.

### 2.4. What must not break

- The P0 scaffold: `package.json`, `package-lock.json`, `tsconfig*.json`,
  `vitest.config.ts`, `eslint.config.js`, `tests/setup.ts`, `tests/helpers.ts`,
  `src/index.ts` — untouched, byte for byte.
- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/` — untouched.
- `tsc --noEmit`, `eslint src tests`, `vitest run` green on the whole tree after every
  generation.

## 3. Acceptance

Built by `decks/tools/build.py p1` into the `acceptance` of every card in
`morph-map.json`; `mrph plan --spec` copies it onto the card. Narrow to broad, every
step printing a readable line on failure; the first red is the regeneration's diagnosis.

Code cards (`src/cards/<m>.ts` + `tests/cards/<m>.test.ts`; `card-model` also
`src/cards/types.ts`):

1. `probe/<card>/`: the guard, a vitest config, and `tsconfig.card.json` extending
   `../../tsconfig.json` that **excludes the targets of the other cards of the same
   generation** (a sibling's broken file cannot redden this card) — the operator's
   decision for P1; removed on exit.
2. `node_modules/.bin/tsc --noEmit -p probe/<card>/tsconfig.card.json` (project + probe).
3. `node_modules/.bin/eslint <the card's targets>`.
4. `guard.mjs src <the card's code targets>` (layers, no `any`, no `process`, no `Date`,
   no `child_process`, no package imports) and `guard.mjs tests tests/cards/<m>.test.ts 1 5`
   (smoke: 1–5 tests, no own stubs, no timers, no `.skip/.only`).
5. `decks/p1/parts/<card>.probe.ts` under vitest: one `test` per record example of the
   card's Function(s), values **and** types, plus the §2.2 rules the record leaves open.
6. `vitest run tests/cards/<m>.test.ts`.
7. `vitest run` — everything in the tree.
8. Frozen: `git diff --quiet HEAD -- contour.yaml morph-map.json docs decks tests/fixtures`;
   untracked files other than the targets: none.

Judge cards (`tests/cards/<m>.examples.test.ts`):

1. `probe/<card>/` as above (no probe file); 2. the same `tsc`; 3. `eslint <target>`;
4. `guard.mjs tests <target> <min> <max> lits.json` — `min` = the number of examples of
   the Function(s), `max` = `min + 12`; `lits.json` = the literals of the examples the
   test must mention (model: `bad id`, `^[A-Za-z0-9._-]+$`, `todo`, `./src/a.ts`,
   `duplicate customId b`, `a -> b -> a`, `zzz`; layering: `[["a"],["b","c"],["d"]]`,
   `[["a","b"]]`; hazards: `write-write`, `read-write`, `src/x.ts`, `addDependsOn`;
   weigh: `600001`, `500000`, `oversized-slice`); 5. `vitest run <target>`;
6. `vitest run`; 7. frozen and untracked as above.

Dense output: `--reporter=dot`, failures filtered to `^ FAIL |Error|expected|received`,
80 lines. Timeout of the whole chain 300 s (Morph's own limit); measured on a dry tree
with stubs in §11.

## 4. Constraints

- `module`/`moduleResolution` NodeNext: every relative import carries `.js`; types are
  imported with `import type`. No `any`: `unknown` and narrowing.
- `src/cards/` is the bottom layer: imports only `node:path`, `node:fs` (weigh only)
  and its own files. No `process`, no `Date`, no `Math.random`, no `console`, no git,
  no network: byte-identical results for the same inputs (Deterministic Core).
- A code card's own test is **smoke only**: at most five `test(...)`, an import, one
  happy path per exported function, one tolerant case, `toBe` on scalars and short
  strings. Completeness is the probe's and the judge's job.
- Every test writes only under a `tmpRoot()` from `tests/helpers.ts` and removes it;
  stubs come from that module; no `vi.mock`, no real timers.
- A judge writes only its test file and never touches the module it tests.
- A file a card writes is in no sibling's slice in the same generation
  (`deck check` refuses `read-write`); a judge depends on its code card.
- Exact message strings of §2.2: the executor copies them, it does not rephrase.

## 7. Out of scope

- Reading deck files from disk, `.morph/` state, deck ids (P3 `store`).
- Compiling a card into a request, slice contents, token counting (P2, P4).
- The `morph deck check` command and its JSON envelope (P10 `cli`); the planner's own
  hazard repair (`repair_deck`) — P1 only reports `repair`.
- Nested or non-flat deck forms, YAML decks, `meta` wrappers of the old Morph.
- Glob patterns in `targets`/`contextSlice`; symlink resolution in `weighSlices`.

## 8. How to run

```
python3 decks/tools/build.py p1                       # injects acceptances into morph-map.json
cd /home/john/Documents/Work2026/MorphProject/morph-lab
venv/bin/mrph plan --root /home/john/Documents/Work2026/MorphV2 --spec contour.yaml --map morph-map.json --component cards --judge          # dry
venv/bin/mrph deck clear --root ... && venv/bin/mrph deck reset --root ...
venv/bin/mrph plan --root ... --spec contour.yaml --map morph-map.json --component cards --judge --add
venv/bin/mrph deck check --root ...
venv/bin/mrph run --root /home/john/Documents/Work2026/MorphV2 --processor glm53   # operator only
```

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards in the deck | 8 (4 code, 4 judge) |
| generations | 4 |
| executor bill | ≤ $0.30 (nominal ≈ $0.12: 12 requests at P0's ≈ $0.006, ×1.5 for regenerations, larger slices) |
| cards with regeneration | 2 of 8 |
| `write-write` / `read-write` at `deck check` | 0 / 0 |
| tests after the run | ≥ 4 smoke files + 4 judge files; ≥ 12 judge tests |
| first red | `tsc` on at least one code card (NodeNext `.js` or a non-literal union); a judge mentioning a literal the guard requires in another spelling |

**Falsifiable claim:** the per-card `tsconfig` exclusion makes no card of generation 1
or 2 go red on a sibling's file; if any acceptance log shows an error in a file the
card does not own, the decision (1) of the gate was wrong.

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), judge tests
written, defects the judge found that the probe did not (and the reverse), the row of
`docs/MEASURE.md`.

## 11. Actual

(filled after the run)
