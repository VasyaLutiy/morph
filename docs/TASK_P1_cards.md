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

- **A card object** — the input of `validateCard`: ONE JSON object with the keys of §2.2
  `Card`, never an array. Untrusted input is `unknown`; the validator narrows it. The
  input of every Validate Card example is the object literal in that example's `given`
  (`contour.yaml`, Component `cards`, Function `Validate Card`, `examples`; the card's
  instruction prints the same literals under "Examples of Function Validate Card").
  Example 1's object, `{"customId": "a", "intent": "generate", "targets": ["src/a.ts"],
  "instruction": "x"}`, has no file of its own under `tests/fixtures/cards/`: it is the
  only element of the deck file `tests/fixtures/decks/tiny.json` (an array, next
  bullet); a test that wants it from disk takes the first element of the parsed deck
  fixture, never the array itself. Examples 2–4 are `tests/fixtures/cards/badId.json`,
  `threeFaults.json`, `repeatTarget.json`: one object per file, verbatim.
- **Deck files** (`Deck File` of the record, flat form) — the input of `loadDeck` once
  the caller has read the file as text: a JSON **array** of card objects, an array even
  for one card. Every file under `tests/fixtures/decks/` is such an array;
  `fixture("decks/<name>.json")` from `tests/helpers.ts` gives the text for `loadDeck`,
  `fixtureJson(...)` the parsed array. The files, with what `findHazards` yields on the
  `hazards*` ones (every card of a file is in generation 0 unless a `dependsOn` is named):
  - `tiny` (91 bytes): one card, a, with no `contextSlice` (so `[]`) → exactly one
    hazard, `implicit-read` `["a"]`.
  - `duplicate` (a, b, b), `cycle` (a→b→a), `external` (a→zzz): Load Deck examples 1–3.
  - `layered` (a; b→a; c→a; d→b,c), `layeredExternal` (a→ext; b): the Layer Generations
    examples.
  - `hazardsWriteWrite`: a and b both target `src/x.ts`, slices `docs/a.md` / `docs/b.md`
    (both non-empty) → exactly one hazard, the `write-write` of Find Hazards example 1.
  - `hazardsReadWrite`: a targets `src/x.ts`, slice `docs/a.md`; b targets `src/y.ts`,
    slice `src/x.ts` → exactly one hazard, the `read-write` of Find Hazards example 2.
  - `hazardsUnordered`: a targets `src/a.ts`, slice `src/b.ts`; b (dependsOn a) targets
    `src/b.ts`, slice `src/a.ts`. Generations `[["a"],["b"]]` → exactly one hazard,
    `unordered-read` `["a","b"]`, path `src/b.ts`: a reads a target of a **later**
    generation, so it is not a `read-write`; b reading a's target is no hazard at all.
  - `hazardsTwoWriters`: a and b both target `src/x.ts` (slices `docs/a.md`, `docs/b.md`);
    c targets `src/y.ts`, slice `src/x.ts`; all three in generation 0 → exactly three
    hazards, in this order: `write-write` `["a","b"]`; `read-write` `["c","a"]`, repair
    `{addDependsOn: {card: "c", on: "a"}}`; `read-write` `["c","b"]`, repair on `"b"`.
    One `read-write` per writer, not one per slice entry.
  - `hazardsAllKinds`: the three cards of `hazardsTwoWriters`, then d (targets `src/z.ts`,
    slice `src/w.ts`) and e (dependsOn c, targets `src/w.ts`, slice `[]`). Generations
    `[["a","b","c","d"],["e"]]` → exactly five hazards, kinds in this order:
    `write-write` `["a","b"]`, `read-write` `["c","a"]`, `read-write` `["c","b"]`,
    `unordered-read` `["d","e"]` path `src/w.ts`, `implicit-read` `["e"]`.
  - `weigh`: card a, slice `tests/fixtures/weigh/ten.txt` = 10 bytes and `hundred.txt` =
    100 bytes, target `tests/fixtures/weigh/missing.txt` which does not exist.
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
`targets repeat src/a.ts after normalisation`; `{"customId": "a", "intent": "todo",
"targets": [], "instruction": ""}` gives exactly three faults with keys `intent`,
`targets`, `instruction` in that order. Four keys are required — `customId`, `intent`,
`targets`, `instruction` — and each absent one is a fault of its own: `{"instruction":
"x"}` gives exactly three faults, keys `customId`, `intent`, `targets`. A valid minimal
card comes back with `contextSlice []`,
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
  in deck order. A path targeted by two cards of R's generation gives R **two**
  `read-write` hazards, one per W, next to the writers' own `write-write`
  (hazardsTwoWriters → three hazards). hazardsReadWrite → exactly one hazard `{kind:
  "read-write", severity: "error", cards: ["b","a"], path: "src/x.ts", repair:
  {addDependsOn: {card: "b", on: "a"}}}`.
- `unordered-read`, `warning`: R's slice names a path targeted by a card W of a **later**
  generation (which implies no dependsOn path from R to W); `cards: [R, W]`, `repair:
  null`, same ordering. The kind is decided per (R, W) pair by their generations: a
  reader in generation 0 of a target in generation 1 is `unordered-read`, never
  `read-write`. hazardsUnordered → exactly one hazard, cards `["a","b"]`, path
  `src/b.ts`.
- `implicit-read`, `warning`: a card with `contextSlice []`; `cards: [id]`, `path: null`,
  `repair: null`; deck order. Reported in every deck, in addition to whatever other
  hazards the deck has: a card with an empty slice always adds one. tiny → exactly one,
  cards `["a"]`; hazardsAllKinds → five hazards, the fifth `implicit-read` `["e"]`.

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

Run `20261006-114825-18650295`, branch `morph/20261006-114825-18650295`, processor
glm53, 11:48:25 → 12:01:47 (13.4 min). Result: 6 of 8 cards written, 2 failed
(`card-model-judge`, `hazards-judge`), 0 skipped; mrph exit 1. 18 requests,
248 688 input / 47 671 output tokens, **$0.1438** (prediction ≤ $0.30, nominal $0.12).

| card | gen | attempts | outcome | winning variant | commit |
|---|---|---|---|---|---|
| card-model | 1 | 2 (v1, v2 burned; r1.v1) | written | card-model.r1.v1 | 3641ad3 |
| card-model-judge | 2 | 3 | **failed** | — | — |
| layering | 2 | 1 | written | layering.v1 | bd6e7e0 |
| weigh | 2 | 1 | written | weigh.v1 | 4e31b53 |
| hazards | 3 | 1 | written | hazards.v1 | db49aef |
| layering-judge | 3 | 1 | written | layering-judge | cd5e926 |
| weigh-judge | 3 | 1 | written | weigh-judge | 74cb604 |
| hazards-judge | 4 | 3 | **failed** | — | — |

Minutes per generation (deck commit → last acceptance of the generation):
gen 1 6.5; gen 2 3.0; gen 3 1.4; gen 4 2.5.

Burned variants: 8. Four more variants were paid for but never judged (the sibling
variant of each accepted code card: `card-model.r1.v2`, `layering.v2`, `weigh.v2`,
`hazards.v2`), so 18 requests = 6 winners + 8 burned + 4 spare.

First red per burned variant (`/tmp/morph/<card>-p1/acc-*.log`):

| variant | step | first red line |
|---|---|---|
| card-model.v1 | tsc | `src/cards/model.ts(102,27): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string'.` |
| card-model.v2 | tsc | `src/cards/model.ts(307,41): error TS2339: Property 'join' does not exist on type 'never'.` |
| card-model-judge | own | `Validate Card example 1 — AssertionError: expected "tiny card is valid" not to be reached` (+ `missing customId faults first in schema order: expected 3 to be 2`) |
| card-model-judge.r1 | guard | `guard: tests/cards/model.examples.test.ts does not mention the example literal "./src/a.ts"` |
| card-model-judge.r2 | own | `Validate Card example 1 — AssertionError: expected "tiny card is valid" not to be reached` |
| hazards-judge | own | `kind order: expected 'write-write,unordered-read,implicit-read,implicit-read,implicit-read' to be 'write-write,read-write,unordered-read,implicit-read,…'` (+2 more own tests) |
| hazards-judge.r1 | own | `kind order: expected 'write-write,read-write,read-write,unordered-read' to be 'write-write,read-write,unordered-read'` |
| hazards-judge.r2 | own | same as r1 |

**tsc-first-red: 2 of 8** (both card-model variants; §9 predicted tsc on at least one
code card — confirmed). **neighbour-red: 0 of 8** — every red line names a file the
card owns; the falsifiable claim of §9 (per-card `tsconfig` exclusion) holds.
Guard rejections of a judge: 1 (`card-model-judge.r1`, literal `./src/a.ts` missing —
the §9 "literal in another spelling" prediction, confirmed). Cards with regeneration:
3 of 8 (predicted 2). Judge files written: 2 of 4 (predicted 4); judge tests: 16
(layer 5, weigh 11; predicted ≥ 12). Tests after the run: 30 in 6 files, all green.

Judge defects (every judge red was the judge's own error; the code under test was
right by §2.2 in each case):

1. `card-model-judge`, all 3 attempts: `validateCard(fixtureJson("decks/tiny.json"))`
   passes the one-element **array** to the card validator → `card is not an object`.
   Root cause is §2.1 of this spec, which calls `tests/fixtures/decks/tiny.json` the
   "valid minimal example" of a card object while the file is a deck. Spec wording
   defect; the executor copied it three times.
2. `card-model-judge` attempt 1: `{instruction: "x"}` expected 2 faults; §2.2 gives
   3 (`customId`, `intent`, `targets` are all required).
3. `hazards-judge` r1, r2: R's slice entry targeted by two W's of the same generation
   expected **one** `read-write`; §2.2 says one hazard per (R, slice entry, W) → two.
4. `hazards-judge` attempt 1, two tests: `hazards.length` compared to 0 / 2 while the
   cards have `contextSlice []` → the `implicit-read` warnings were forgotten.
5. `hazards-judge` attempt 1, kind-order test: expected `read-write` for a reader in
   generation 0 of a target in generation 1 (`c` dependsOn `a`); §2.2: that is
   `unordered-read`.

Defects the judge found that the probe did not: 0. Defects the probe found that the
judge did not: 0 (no code variant reached the probe red; both code reds were `tsc`).
Found by reading the accepted code against §2.2, caught by neither probe nor judge:

- `src/cards/hazards.ts:28-35` — the `owned` loop that orders `write-write` hazards
  walks **all** deck cards, not the generation's. A card of another generation that
  targets the same path earlier in the deck can change the order between two
  write-write paths (§2.2: "deck position of the first owner, then that owner's
  targets order"). Edge case; no fixture exercises it.
- `tests/cards/weigh.examples.test.ts:33,59` — tests named `Weigh Slices example 2`
  and `example 3` are §2.2 cases, not record examples (the record has one Weigh Slices
  example); §2.3 naming rule. Cosmetic.

Verification on the run branch (`NO_COLOR=1 CI=1`): `tsc --noEmit` clean; `eslint src
tests` clean; `vitest run` 30 passed in 6 files; `npm run build` emits `dist/cards`,
`dist/index.js`; `git status --short` empty; §2.4 frozen files untouched (every card's
acceptance step 8 passed, and the run archive commit touches only `.morph/` and
`decks/`). Max slice + targets: 48 943 bytes (`weigh-judge`); `deck check` hazards 0.

Open for the next cut: `tests/cards/model.examples.test.ts` and
`tests/cards/hazards.examples.test.ts` (both judges failed) — fix §2.1's tiny.json
wording and add to the judge instruction that a card example is the object literal,
not a deck fixture; add a `read-write` fixture with two writers of one path.

### P1b — the two judges re-cut after a spec fix (06.10)

Experiment: does a correct §2.1 alone make the judges pass? Nothing was added to the
judge instructions or to the map `instruction` overrides; the map changed only in the
`hazards-judge` slice (two new fixtures). Deck `decks/p1b-judges.json`: the two judge
cards of a fresh dry `plan --spec` (external `depends_on` on `card-model` / `hazards`,
already merged). Wording changes, before → after:

1. §2.1 card object. Before: "**A card object** (`Deck File` of the record, flat
   form): a JSON object with the keys of §2.2 `Card`. Valid minimal example,
   `tests/fixtures/decks/tiny.json` (91 bytes): `[{"customId": "a", …}]`." After: the
   input of `validateCard` is ONE object, never an array; each Validate Card example's
   input is the literal in its `given` (address in the record and in the card's
   instruction); example 1 has no file under `tests/fixtures/cards/` and is the only
   element of the deck file `tiny.json` — a test that wants it from disk takes the
   first element of the parsed deck fixture, never the array.
2. §2.1 deck files. Before: a one-line list of names with their cards. After: deck
   files are JSON arrays, an array even for one card, the input of `loadDeck` after
   reading; one bullet per file with what `findHazards` yields, counted, with
   generations where they matter (`hazardsUnordered` `[["a"],["b"]]`).
3. New fixtures `tests/fixtures/decks/hazardsTwoWriters.json` (3 hazards:
   write-write, read-write ×2 — one per writer) and `hazardsAllKinds.json` (5 hazards,
   the four kinds in output order, two `read-write`), named in §2.1 with their yields;
   both verified on the accepted `src/cards/hazards.ts` before the cut.
4. §2.2 validateCard. Before: "`{"intent": "todo", "targets": [], "instruction": ""}`
   gives exactly three faults" — the literal omitted `customId`, which the table makes
   required (four faults by the table). After: the literal carries `"customId": "a"`,
   plus: "Four keys are required … each absent one is a fault of its own:
   `{"instruction": "x"}` gives exactly three faults, keys `customId`, `intent`,
   `targets`" (judge defect 2 of P1).
5. §2.2 read-write. Added: "A path targeted by two cards of R's generation gives R
   **two** `read-write` hazards, one per W, next to the writers' own `write-write`
   (hazardsTwoWriters → three hazards)" (judge defect 3).
6. §2.2 unordered-read. Added: "The kind is decided per (R, W) pair by their
   generations: a reader in generation 0 of a target in generation 1 is
   `unordered-read`, never `read-write`" (judge defect 5).
7. §2.2 implicit-read. Added: "Reported in every deck, in addition to whatever other
   hazards the deck has … hazardsAllKinds → five hazards, the fifth `implicit-read`
   `["e"]`" (judge defect 4).

No rule changed: every count above is what the accepted P1 code already returns.
