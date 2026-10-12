# TASK_P9 — reading and validating the record and the map (`src/contour/`)

> Phase P9 of `docs/PLAN.md` ("Фазы по записи (после P2)"), Component `contour` of `contour.yaml`
> (six Functions: Validate Record, Validate Map, Parse Document, Load Spec, Select Components, Function
> Links; six Data Objects: Contour Record, Contour Map, Record Result, Map Result, Parsed Document,
> Function Link). TypeScript under `src/contour/`, **pure functions over text and plain objects**: no
> file system, no clock, no environment, no child process, no Node module; the one runtime package
> `yaml` is imported in `src/contour/load.ts` alone. Built by the old Morph (`mrph`) on glm; judge
> cards write the example tests.
>
> Reconciliation: the record had no Component `contour` (its Components were cards … language,
> primer, scout, planner, reviewer); P9 adds it after `language`, before the skeletons (DECISIONS "P9
> contour"). The schema validated is the one **this repository's** `contour.yaml` and
> `morph-map.json` actually use, which the old Morph's `plan --spec` accepts (`mrph/cards/record.py`,
> `cards/plan_spec.py`, read only): V2 is stricter in one way the old reader is not — an unknown key
> is a problem at every level — and both files of this repository pass (Load Spec example 4). Not
> wired into the cli: the planner (P10) is the first consumer. Issue #3 (label `P10-planner`) asks
> the planner for callee preconditions; the typed Function carries an optional `preconditions` list
> now, so P10 needs no change of this reader to read them.

## 1. Why this

- **The planner of P10 needs a typed record.** The old Morph validated 5 shapes (names, steps,
  examples, interfaces, version) and ignored every other key "at any depth"; a misspelt key
  (`behaviour`, `dataobjects`, `example`) was silently dropped and the card was cut without it. The
  record now holds 13 Components, 48 Functions and 160 examples (137 before P9 + 23); one typo there
  costs a phase. V2 names every problem of a document at once, one `<path>: <message>` line each.
- **The old reader passed untyped dicts to 997 lines of `plan_spec.py`.** Every consumer re-checked
  `isinstance(...)`. V2's planner gets `ContourRecord`/`ContourMap` with every list present and every
  optional text `null`.
- **A milestone: V2 reads its own record.** Load Spec example 4 loads this repository's
  `contour.yaml` (≈ 124 KB) and `morph-map.json` (≈ 1.2 MB, 66 + 8 card overrides) without a problem.

PLAN: ≈ 8 cards per phase at ≈ $0.1–0.2. This cut: 8 cards (4 code, 4 judge), 23 record examples
(Validate Record 6, Validate Map 4, Parse Document 3, Load Spec 4, Select Components 3, Function Links 3).

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Documents** reach Validate Record and Validate Map as `unknown` (what `JSON.parse` or yaml's
  `parse` returns). Tests build them two ways only: `fixtureJson("contour/<name>.json")` (returns
  `unknown`; pass it straight to the function) or an inline object literal typed by nothing (pass it
  straight; an inline literal needs no cast because the parameter is `unknown`).
- **Fixtures** (`tests/fixtures/contour/`, read with `fixture(name)` / `fixtureJson(name)` from
  `tests/helpers.ts`):

  | file | type | what it is | used by |
  |---|---|---|---|
  | `mini.yaml` | text | the mini record in YAML: 2 Components (tally, store), 4 Functions (Count Words, Report Count; Save Count, Load Counts), 2 Data Objects (Text File, Count Record — its schema a mapping), 1 Interface, 1 Actor, 1 Requirement, 1 Guardrail | Load Spec 1 |
  | `mini.json` | JSON object | the same document as JSON (generated from `mini.yaml`) | Validate Record 1; Select Components 1–3 and Function Links 1–2 (through validateRecord) |
  | `mini.typed.json` | JSON object | the whole typed record both give (5 386 bytes) | Validate Record 1, Load Spec 1 |
  | `badRecord.json` | JSON object, and its text | a record with 19 problems | Validate Record 2, Load Spec 2 |
  | `badRecord.problems.json` | JSON array of 19 strings | the problems, in order | Validate Record 2, Load Spec 2 |
  | `mini.map.json` | JSON object | a map: package, language, docs, 2 groups, 2 card overrides, 1 extra card | Validate Map 1 |
  | `mini.map.typed.json` | JSON object | the whole typed map | Validate Map 1 |
  | `badMap.json` | JSON object, and its text | a map with 15 problems | Validate Map 2, Load Spec 2 |
  | `badMap.problems.json` | JSON array of 15 strings | the problems, in order | Validate Map 2, Load Spec 2 |
  | `badCalls.json` | JSON object | a record valid in shape, Component `loop`, Functions A (calls B, C) and C (calls C) | Function Links 3 |

  Compare a result with a typed fixture whole: `expect(validateRecord(fixtureJson("contour/mini.json"))).toStrictEqual({ ok: true, record: fixtureJson("contour/mini.typed.json") })`.
  Load Spec 2 builds the expected message from the problems fixture:
  `"badRecord.json is not a valid record (19 problems):\n" + (fixtureJson("contour/badRecord.problems.json") as string[]).join("\n")`
  — the only cast a test needs.
- **This repository's own files** (Load Spec 4) are read with `fixture("../../contour.yaml")` and
  `fixture("../../morph-map.json")`: `fixturePath` resolves against `tests/fixtures/`, so `../../`
  is the repository root. Nothing else under the root is read.
- **Every other example has no file**: its literal is in the record (Component contour, the
  Function's example `given`), e.g. Validate Record 5 `{ System: { name: " s ", description: "d", groups: [] } }`.
  Load Spec 3 builds its text with `JSON.stringify({ System: { name: "s", description: "d", groups: Array.from({ length: 11 }, () => ({})) } })`.
- **A judge's setup across Components** (TASK_TEMPLATE §2.1, P5 debt). Select Components and Function
  Links take a typed record; the judge builds it with Validate Record, whose facts it depends on:
  1. contour · `validateRecord(fixtureJson("contour/mini.json"))` is `{ok: true}` and its
     `record.system.groups` are `[tally, store]` in that order · without it every select example
     fails at setup.
  2. contour · `validateRecord(fixtureJson("contour/badCalls.json"))` is `{ok: true}` (Validate
     Record checks shape only; calls are checked by Function Links) · Function Links 3 cites it.

  Harness skeleton (the probe uses it verbatim; built only from `tests/helpers.ts`):
  ```ts
  import { fixtureJson } from "../helpers.js";
  import { validateRecord } from "../../src/contour/record.js";
  import type { ContourRecord, Component } from "../../src/contour/types.js";
  function typed(name: string): ContourRecord {
    const r = validateRecord(fixtureJson(name));
    if (!r.ok) throw new Error(r.problems.join("\n"));
    return r.record;
  }
  const MINI = typed("contour/mini.json");
  const TALLY = MINI.system.groups[0] as Component;
  const STORE = MINI.system.groups[1] as Component;
  ```
  Select Components 1 builds the one-Component record as `{ ...MINI, system: { ...MINI.system, groups: [TALLY] } }`.

### 2.2. OUTPUT data shapes

`src/contour/types.ts` exports exactly these names (types only, no values, no imports):

```ts
export type StepVerb = "calls" | "reads" | "modifies" | "produces" | "uses";
export interface Step { verb: StepVerb; target: string }
export interface Example { given: string; when: string; then: string; ref: string | null }
export interface ContourFunction {
  name: string; description: string; behavior: string;
  requirements: string[]; guardrails: string[]; preconditions: string[];
  steps: Step[]; examples: Example[];
}
export interface DataObject { name: string; description: string; schema: string | null }
export interface ContourInterface { name: string; description: string; exposes: string[] }
export interface Component {
  name: string; description: string; language: string | null;
  requirements: string[]; guardrails: string[];
  functions: ContourFunction[]; dataObjects: DataObject[]; interfaces: ContourInterface[];
}
export interface ContourSystem {
  name: string; description: string; requirements: string[]; guardrails: string[]; groups: Component[];
}
export interface Definition { name: string; description: string }
export interface Actor { name: string; description: string; uses: string[] }
export interface ContourRecord {
  version: 1; system: ContourSystem; actors: Actor[]; requirements: Definition[]; guardrails: Definition[];
}
export type RecordResult = { ok: true; record: ContourRecord } | { ok: false; problems: string[] };
export interface CardFields {
  customId: string | null; intent: "generate" | "patch" | null; targets: string[] | null;
  contextSlice: string[] | null; dependsOn: string[] | null; instruction: string | null;
  acceptance: string | null; model: string | null; maxTokens: number | null;
  reasoningMaxTokens: number | null; variants: number | null;
}
export interface MapCard extends CardFields { id: string }
export interface ExtraCard extends CardFields { component: string | null }
export interface MapGroup { name: string; functions: string[] }
export interface ContourMap {
  version: 1; package: string | null; language: string | null; docs: string[];
  groups: MapGroup[]; cards: MapCard[]; extraCards: ExtraCard[];
}
export type MapResult = { ok: true; map: ContourMap } | { ok: false; problems: string[] };
export type DocResult = { ok: true; doc: Record<string, unknown> } | { ok: false; error: string };
export type LoadRecordResult = { ok: true; record: ContourRecord } | { ok: false; error: string };
export type LoadMapResult = { ok: true; map: ContourMap } | { ok: false; error: string };
export type SelectResult = { ok: true; components: Component[] } | { ok: false; error: string };
export interface FunctionLink { function: string; calls: string[]; dataObjects: string[]; uses: string[] }
export type LinksResult = { ok: true; links: FunctionLink[] } | { ok: false; errors: string[] };
```

Every object is built with its keys in the type's order (`toStrictEqual` against the typed fixtures
does not see key order, but `JSON.stringify` does and the planner prints it). A spread
`{ id, ...fields }` puts `id` first, as the type does.

**Paths and messages, shared by both validators.** A problem is `<path>: <message>`. The root's
path is printed `(root)`; a key below the root is `<parent>.<key>` (`System.groups`, `cards.x`; a key
of the root is just `version`, `Actor`); a list item is `<list>[<i>]` (`System.groups[0]`,
`Requirement[0]`, `groups.b[0]`). Messages, exactly:

| message | when |
|---|---|
| `a record must be an object` / `a map must be an object` | the root is not a plain object (null, an array, a scalar); this is the only problem then |
| `required` | a required key is missing (path = the missing key) |
| `unknown key '<k>' (known: <the table joined by ", ">)` | a key not in the object's table (path = the object) |
| `must be 1` | `version` present and not the number 1 (`"1"` is not 1) |
| `must be a non-empty string` | a text that is not a string or is only whitespace |
| `must be a list` / `must be an object` | wrong container (an element of an element list that is not an object: `must be an object`) |
| `must hold at least one example` / `must hold at least one name` | `examples: []` / `exposes: []` |
| `a step is an object with exactly one key` | a step that is not an object or has 0 or ≥ 2 keys |
| `unknown step verb '<k>' (known: calls, reads, modifies, produces, uses)` | its one key is not a verb |
| `duplicate Component name '<n>'` / `duplicate Function name '<n>'` / `duplicate Data Object name '<n>'` | path = the repeat's `.name`; Components unique in the record, Functions within their Component, Data Objects in the whole record; compared trimmed |

**`src/contour/record.ts`** — `validateRecord(doc: unknown): RecordResult`, plus `export const
STEP_VERBS: readonly StepVerb[] = ["calls", "reads", "modifies", "produces", "uses"]`. Imports
`import type` from `./types.js` only.

Key tables (order matters for the messages and the walk; * = required):

| object | keys |
|---|---|
| root | version, System*, Actor, Requirement, Guardrail |
| System | name*, description*, requirements, guardrails, groups* |
| Component (`System.groups[i]`) | name*, description*, language, requirements, guardrails, functions, dataObjects, interfaces |
| Function | name*, description*, behavior*, requirements, guardrails, preconditions, steps, examples* |
| example | given*, when*, then*, ref |
| Data Object | name*, description*, schema |
| Interface | name*, description*, exposes* |
| Actor (`Actor[i]`) | name*, description*, uses |
| Requirement, Guardrail (`Requirement[i]`) | name*, description* |

The walk, per object: (1) each missing required key in the table's order → `required`; (2) each key
not in the table, in the object's own key order (`Object.keys`) → `unknown key …`; (3) the present
keys' values in the table's order, depth first (a Component's functions are walked completely
before its dataObjects). Values:

- `version` (root): present and `!== 1` → `version: must be 1`; absent means 1.
- `System`: not a plain object → `System: must be an object` (nothing below it is walked).
- name, description, behavior, language, given, when, then, ref: a string with non-whitespace →
  stored **trimmed**; else `must be a non-empty string`. language and ref absent → `null`.
- requirements, guardrails, preconditions, uses, exposes: not an array → `must be a list`; each
  item a non-empty string (stored trimmed), else `<list>[<i>]: must be a non-empty string`.
  `exposes: []` → `<path>.exposes: must hold at least one name`.
- groups, functions, dataObjects, interfaces, examples, and the root's Actor, Requirement,
  Guardrail: not an array → `must be a list`; an item that is not a plain object → `<list>[<i>]:
  must be an object` (and it is skipped). `examples: []` → `<path>.examples: must hold at least one
  example`. Absent lists → `[]` (examples is required, so absent examples is `required`).
- steps: each item: not a plain object or `Object.keys(step).length !== 1` → `<steps>[<i>]: a step
  is an object with exactly one key`; one key not in STEP_VERBS → `<steps>[<i>]: unknown step verb
  '<k>' (known: calls, reads, modifies, produces, uses)`; its value not a non-empty string →
  `<steps>[<i>].<verb>: must be a non-empty string`. Stored `{ verb, target }`, target trimmed.
- schema: a string → stored trimmed (empty → `must be a non-empty string`); a plain object (a
  mapping, as the Data Objects of cards and compiler have) → each value must be a non-empty string
  (`<path>.schema.<key>: must be a non-empty string`) and the schema is stored as
  `JSON.stringify(<the mapping with trimmed values, keys in the document's order>, null, 2)`; any
  other value (a number, a list, null) → `<path>.schema: must be a non-empty string`; absent → `null`.
- Duplicates: checked when the name is read (right after it, before the description), so a
  duplicate's problem comes at the repeat's name.

Result: any problem → `{ok: false, problems}` (all, in walk order); none → `{ok: true, record:
{version: 1, system: {name, description, requirements, guardrails, groups}, actors, requirements,
guardrails}}` (the root's Actor/Requirement/Guardrail lists become `actors`/`requirements`/`guardrails`).
Illustrations (all in the record's examples): `{}` → `["System: required"]`; `{version: "1", System:
{… a Function without examples …}}` → `["version: must be 1", "System.groups[0].functions[0].examples:
required"]`; the 19 problems of `badRecord.problems.json` follow exactly this walk (root unknown key
`Extra` first, because step (2) of the root precedes its values).

**`src/contour/map.ts`** — `validateMap(doc: unknown): MapResult`, plus `export const MAP_KEYS =
["version", "package", "language", "docs", "groups", "cards", "extra_cards"] as const`, `export const
CARD_KEYS = ["custom_id", "intent", "targets", "context_slice", "depends_on", "instruction",
"acceptance", "model", "max_tokens", "reasoning_max_tokens", "variants"] as const`, `export const
EXTRA_KEYS = ["component", ...CARD_KEYS] as const`. Imports `import type` from `./types.js` only.

- Root: not a plain object → `["(root): a map must be an object"]`. Nothing is required. Order:
  unknown root keys (`(root): unknown key '<k>' (known: version, package, language, docs, groups,
  cards, extra_cards)`), then version, package, language, docs, groups, cards, extra_cards.
- version: as the record. package, language: non-empty strings (else `must be a non-empty string`),
  absent → `null`. docs: a list of non-empty strings (`docs: must be a list`, `docs[<i>]: must be a
  non-empty string`), absent → `[]`.
- groups: not a plain object → `groups: must be an object`. Each entry `<g>: <members>` in the
  document's order: not an array or empty → `groups.<g>: must be a non-empty list of Function names`
  (entry skipped); items non-empty strings (`groups.<g>[<i>]: must be a non-empty string`); a member
  already in an earlier group → `groups.<g>[<i>]: Function '<m>' is already in group '<first>'`.
  Each valid entry → `{name: <g>, functions: <members>}`.
- cards: not a plain object → `cards: must be an object`. Each entry `<id>: <override>` in order: not
  a plain object → `cards.<id>: must be an object` (skipped); unknown keys first (`cards.<id>: unknown
  key '<k>' (known: <CARD_KEYS>)`), then the fields below in CARD_KEYS order → `{id, ...fields}`.
- extra_cards: not an array → `extra_cards: must be a list`. Each item `extra_cards[<i>]`: not a
  plain object → `must be an object` (skipped); then each of custom_id, targets, instruction missing →
  `extra_cards[<i>].<key>: required`; then unknown keys (known: EXTRA_KEYS); then component
  (non-empty string, absent → `null`); then the fields → `{component, ...fields}`.
- Fields (`CardFields`, every one `null` when its key is absent): custom_id → customId, a string
  matching `^[A-Za-z0-9._-]+$` else `must match ^[A-Za-z0-9._-]+$`; intent → `"generate"` or
  `"patch"` else `must be generate or patch`; targets, context_slice, depends_on → targets,
  contextSlice, dependsOn: lists of non-empty strings (`must be a list`, `<key>[<i>]: must be a
  non-empty string`), and targets `[]` → `<path>.targets: must hold at least one path` (after its item
  checks); instruction, acceptance, model: non-empty strings; max_tokens, reasoning_max_tokens,
  variants → maxTokens, reasoningMaxTokens, variants: `Number.isInteger(v) && v > 0` else `must be a
  positive integer`.
- **Map values are kept verbatim** (never trimmed: an acceptance is a shell script with a final
  newline; Validate Map 1 pins `"  exit 0\n"`). Only the record trims.
- Result: problems → `{ok: false, problems}`; none → `{ok: true, map: {version: 1, package, language,
  docs, groups, cards, extraCards}}`.

**`src/contour/load.ts`** — imports `{ parse } from "yaml"` (the only file that may),
`validateRecord` from `./record.js`, `validateMap` from `./map.js`, types from `./types.js`.

- `export const MAX_LISTED_PROBLEMS = 20`.
- `parseDocument(text: string, name: string): DocResult` — `name.toLowerCase()` ends with `.yaml` or
  `.yml` → `parse(text)` of yaml, else `JSON.parse(text)`; a throw → `{ok: false, error: "cannot
  parse " + name + ": " + <the error's message up to its first "\n">}` (the message of a non-Error
  throw is `String(e)`); a value that is not a plain object (yaml gives `null` for empty text) →
  `{ok: false, error: name + " is not a mapping at the top level"}`; else `{ok: true, doc}`.
  The parser's own words after the prefix are pinned by nobody (they depend on the library).
- `loadContour(text: string, name: string): LoadRecordResult` — parseDocument; a failure is returned
  as it is (the same object shape `{ok: false, error}`); then validateRecord; problems → `{ok: false,
  error: name + " is not a valid record (" + n + " problem" + (n === 1 ? "" : "s") + "):\n" + lines}`,
  lines = the first 20 problems joined by `"\n"`, and when n > 20 one more line `"… and " + (n - 20) +
  " more"` (the character `…` is U+2026, written as the literal character). Else `{ok: true, record}`.
- `loadMap(text: string, name: string): LoadMapResult` — the same with validateMap and `"map"`.

**`src/contour/select.ts`** — imports `import type` from `./types.js` only.

- `componentSlug(name: string): string` = `name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w !== "").join("-")`.
- `selectComponents(record: ContourRecord, names: readonly string[]): SelectResult` — names empty:
  exactly one Component → `{ok: true, components: [it]}`; else `{ok: false, error: "the record has " +
  n + " Components (" + <names joined by ", "> + "): pass --component"}` (also for 0 Components:
  `the record has 0 Components (): pass --component`). Else per name in the given order: the first
  Component with `c.name === name || componentSlug(c.name) === componentSlug(name)`; none → `{ok: false,
  error: "no Component '" + name + "' in the record (have: " + <all names joined by ", "> + ")"}` (the
  first unmatched name stops the walk); a Component already selected is not added again. The
  components are the record's own objects (`toBe` holds).
- `functionLinks(record: ContourRecord, component: Component): LinksResult` — per Function of the
  component, in order, `{function: f.name, calls: [], dataObjects: [], uses: []}`; per step in order:
  `calls` → target `=== f.name` → error `Function '<f>' calls itself`; target not the name of a
  Function of the component → error `Function '<f>' calls unknown Function '<t>' of Component '<c>'`;
  else added to calls unless already there. `uses` → added to uses unless there. `reads`, `modifies`,
  `produces` → added to dataObjects (unless there) when the target is the name of a Data Object of
  **any** Component of the record, else ignored. Errors → `{ok: false, errors}` (in that order); else
  `{ok: true, links}`.

### 2.3. Names

| module | exports | card writes no test | judge's test |
|---|---|---|---|
| `src/contour/types.ts` | the types of §2.2, no values | — | — |
| `src/contour/record.ts` | `STEP_VERBS`, `validateRecord` | probe | `tests/contour/record.examples.test.ts` |
| `src/contour/map.ts` | `MAP_KEYS`, `CARD_KEYS`, `EXTRA_KEYS`, `validateMap` | probe | `tests/contour/map.examples.test.ts` |
| `src/contour/select.ts` | `componentSlug`, `selectComponents`, `functionLinks` | probe | `tests/contour/select.examples.test.ts` |
| `src/contour/load.ts` | `MAX_LISTED_PROBLEMS`, `parseDocument`, `loadContour`, `loadMap` | probe | `tests/contour/load.examples.test.ts` |

A code card covered by a probe writes **no test file**. A judge imports what it tests from
`../../src/contour/<m>.js`, types from `../../src/contour/types.js` with `import type`, and `fixture`
/ `fixtureJson` from `../helpers.js`. Its file holds one `test(...)` per example of its Function(s), in
record order (record: Validate Record 1–6; map: Validate Map 1–4; select: Select Components 1–3,
Function Links 1–3; load: Parse Document 1–3, Load Spec 1–4), named `<Function> example <n>: <what>`,
then at most 8 tests of its own on §2.2 rows.

Compare results whole with `toStrictEqual`; strings, numbers and booleans with `toBe`. **Typing
traps** (tsc strict):
- Every result is a union: compare it whole with `toStrictEqual`, or narrow before a field
  (`r.ok ? r.record.system.name : r.error`); never `r.record` unnarrowed (TS2339), never through `??`.
- `fixtureJson` returns `unknown`: pass it straight to the function or into `toStrictEqual`; the only
  cast is `as string[]` on a problems fixture before `.join("\n")`.
- `MINI.system.groups[0]` is typed `Component` already; write `as Component` anyway (the probe does).
- A prefix check is `expect(r.ok ? "" : r.error.startsWith("cannot parse m.json: ")).toBe(true)` or
  `expect(r.ok).toBe(false); if (!r.ok) expect(r.error.startsWith(…)).toBe(true);`.
- No `any`; import only what you use (eslint rejects an unused import); `test`, `expect` from `"vitest"`.

### 2.4. What must not break

- P0–P8 untouched byte for byte: the scaffold, `src/cards`, `src/compiler`, `src/acceptance`,
  `src/processor`, `src/runloop`, `src/git`, `src/cli`, `src/language`, `src/cli.ts`, `src/index.ts`
  and their tests.
- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/` — untouched by every card.
- `tsc --noEmit`, `eslint src tests`, `vitest run` green after every generation; the 416 tests of
  P0–P8 stay green.

## 3. Acceptance

Built by `decks/tools/build.py p9` into the `acceptance` of every P9 card in `morph-map.json`;
`mrph plan --spec` copies it onto the card. Narrow to broad; the first red is the regeneration's
diagnosis.

Code cards (targets under `src/contour/`; `validate-record` also writes `types.ts`):

1. `probe/<card>/`: the guard, a vitest config, `tsconfig.card.json` extending `../../tsconfig.json`
   and **excluding the targets of the other cards of the same generation**; removed on exit.
2. `tsc --noEmit -p probe/<card>/tsconfig.card.json` (project + probe).
3. `eslint <the card's targets>`.
4. `guard.mjs src <targets>`: layer `contour` imports only `./*` of its own layer and `cards` (it
   needs none), no `any`, no `process`, `console`, `Date`, `Math.random`, `fetch`; **no `node:*`
   module at all** and the package `yaml` only in `src/contour/load.ts` (P9 change).
5. `decks/p9/parts/<card>.probe.ts` under vitest: one `test` per record example of the card's
   Function(s), values **and** types, then the §2.2 rows. validate-record 6 + 6 = 12; validate-map
   4 + 4 = 8; select-components 6 + 4 = 10; load-spec 7 + 4 = 11. 41 tests.
6. `vitest run` — everything in the tree. 7. Frozen: `git diff --quiet HEAD -- contour.yaml
   morph-map.json docs decks tests/fixtures`; no untracked file other than the targets.

Judge cards (`tests/contour/<m>.examples.test.ts`):

1–3. `probe/<card>/` (no probe file); the same `tsc`; `eslint <target>`.
4. `guard.mjs tests <target> <min> <max> lits.json` — `min` = the examples (record 6, map 4, select
   6, load 7), `max` = `min` + 8; `lits.json`: record `mini.typed.json`, `badRecord.problems.json`,
   `(root): a record must be an object`, `System: required`, `System.groups[0].functions[0].examples:
   required`; map `mini.map.typed.json`, `badMap.problems.json`, `(root): a map must be an object`,
   `cards.g.context_slice[0]: must be a non-empty string`; select `the record has 2 Components (tally,
   store): pass --component`, `no Component 'nope' in the record (have: tally, store)`, `badCalls.json`,
   `Function 'C' calls itself`, `node:fs`; load `mini.yaml`, `is not a valid record (19 problems):`,
   `is not a valid map (15 problems):`, `… and 2 more`, `is not a mapping at the top level`,
   `../../contour.yaml`, `../../morph-map.json`, `validate-record`.
5. `vitest run <target>`; 6. `vitest run`; 7. frozen and untracked as above.

Dense output: `--reporter=dot`, failures filtered to `^ FAIL |Error|expected|received`, 80 lines.
Timeout of the whole chain 300 s; measured on a dry tree with stubs (§11 "Gate").

**Output budget per card** (`max_tokens` in `morph-map.json`). Estimate = the target file(s) in
tokens (≈ bytes / 3.5) × 2 headroom + 2 500 reasoning; the reference sizes are a scratch reference
implementation and the probes (the judge files have the probe's shape):

| card | expected target | estimate | `max_tokens` |
|---|---|---|---|
| validate-record | types.ts ≈ 2.8 KB + record.ts ≈ 8.6 KB ≈ 3 250 tok | ≈ 9 000 | 16 000 |
| validate-map | map.ts ≈ 5.8 KB ≈ 1 670 tok | ≈ 5 800 | 12 000 |
| select-components | select.ts ≈ 2.1 KB ≈ 610 tok | ≈ 3 700 | 12 000 |
| load-spec | load.ts ≈ 1.7 KB ≈ 480 tok | ≈ 3 500 | 12 000 |
| validate-record-judge | ≈ 8.2 KB (12 tests) ≈ 2 330 tok; worst 14 tests ≈ 9.5 KB | ≈ 8 000 | 20 000 |
| validate-map-judge | ≈ 5.7 KB (8 tests) ≈ 1 620 tok; worst 12 tests ≈ 8 KB | ≈ 7 100 | 20 000 |
| select-components-judge | ≈ 5.2 KB (10 tests) ≈ 1 490 tok; worst 14 tests ≈ 7 KB | ≈ 6 500 | 20 000 |
| load-spec-judge | ≈ 5.8 KB (11 tests) ≈ 1 660 tok; worst 15 tests ≈ 8 KB (the most examples, 7) | ≈ 7 100 | 24 000 |

Every judge ≥ 20 000 and ≥ 2× its worst case; the judge with the most examples (load, 7) 24 000; no single answer is expected
above ≈ 3 300 tokens, far under the ≈ 12 000 output tokens P5 showed a first answer can balloon to.

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- **Layer** `contour` (`decks/tools/guard.mjs`, P9 change): pure — no `process`, `console`, `Date`,
  `Math.random`, `fetch`, and no `node:*` module at all (no `node:fs`: the caller reads the file and
  passes the text); `yaml` only in `src/contour/load.ts`.
- `types.ts` imports nothing; `record.ts`, `map.ts`, `select.ts` import `./types.js` only; `load.ts`
  imports `yaml`, `./record.js`, `./map.js`, `./types.js`.
- Tests read files only through `fixture` / `fixtureJson`; they write nothing and spawn nothing.
- A judge writes only its test file and never touches the module it tests.
- A file a card writes is in no sibling's slice in the same generation; a judge depends on its code
  card; validate-map and select-components depend on validate-record; load-spec on validate-record
  and validate-map.
- Exact strings of §2.2 (every message of the table, `is not a valid record (`, `is not a mapping at
  the top level`, `pass --component`, `in the record (have: `, `calls itself`, `calls unknown
  Function '`): the executor copies them.

## 7. Out of scope

- Wiring into the cli (`morph plan`): P10's planner is the first consumer of loadContour/loadMap,
  selectComponents and functionLinks.
- Reading files: the caller (planner, cli) reads the text; contour has no `node:fs`.
- Cross-checks between the map and the record (a group naming an unknown Function or straddling
  two Components, an extra card's `component` unknown, an override for a card the cut does not
  produce): the old planner raises them while cutting (`_units`, `_extra_cards`); V2's planner (P10).
- Checks between record elements other than calls: a `requirements`/`guardrails` name with no
  definition, an Interface exposing an unknown Function, an Actor using an unknown Interface, cycles
  among calls (the planner's layering finds a cycle of cards).
- Contour v0.24 fields this repository's record does not use (`events`, an Actor as one object
  instead of a list, an Interface `schema`): rejected as unknown keys / a non-list, by decision.
- The card ids, targets and budget formula (planner P10, with `language`'s Name Targets).

## 8. How to run

```
python3 decks/tools/build.py p9
cd /home/morph/MorphProject/morph-lab
venv/bin/mrph plan --root <repo> --spec <repo>/contour.yaml --map <repo>/morph-map.json --component contour --judge   # dry
venv/bin/mrph deck clear --root <repo> && venv/bin/mrph deck reset --root <repo>
venv/bin/mrph plan --root <repo> --spec <repo>/contour.yaml --map <repo>/morph-map.json --component contour --judge --add
venv/bin/mrph deck check --root <repo>
venv/bin/mrph run --root <repo> --processor glm53 --deadline 2400   # by the gate of docs/AUTONOMY.md
```

`mrph` reads `.env` from the current directory: run it from `morph-lab`, never from the repo.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards in the deck | 8 (4 code, 4 judge) |
| generations | 4 (validate-record; validate-map + select-components + validate-record-judge; load-spec + validate-map-judge + select-components-judge; load-spec-judge) |
| executor bill | ≈ $0.13 nominal (≈ 230k in, 55k out at $0.31/M in, $1.13/M out: 12 first requests (4 code × 2 variants + 4 judges) of ≈ 11–17k in (slices 40–61 KB) / ≈ 3k out each incl. reasoning, + ≈ 35 % retries), ≤ $0.30 with a re-cut |
| cards with regeneration | 2 of 8 |
| `write-write` / `read-write` at `deck check` | 0 / 0 |
| tests after the run | 416 + 4 judge files; ≥ 23 judge example tests |
| first red | validate-record: the walk order (unknown keys before values, required before unknown), trimming, the mapping schema text; validate-map: trimming a map value, `variants: 1.5` accepted, the extra card's required order; load-spec: the `…` line, "1 problem" singular, the first line of a yaml message; select: slug matching, a repeat listed twice, self-call; judges: reading a field of an unnarrowed union, a hand-typed expected list instead of the problems fixture |

**Falsifiable claims:** (1) no card goes red on a sibling's file; (2) no judge red traces to §2.1;
(3) no judge is cut off at its `max_tokens`; (4) no test writes a file or reads one outside
`tests/fixtures/`, `contour.yaml`, `morph-map.json`.

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), judge tests written,
truncations (finish reason `length`) per card, defects the judge found the probe did not (and the
reverse), the row of `docs/MEASURE.md`.

## 11. Actual

### Gate (preparation, autonomous)

07.10, by the preparing orchestrator (Opus 5.5). Dry `mrph plan --spec --component contour --judge` exit 0;
`deck clear`, `deck reset`, `plan --add` (8 cards, generations `[validate-record] [select-components,
validate-map, validate-record-judge] [load-spec, select-components-judge, validate-map-judge]
[load-spec-judge]`), `deck check` 0 errors / 0 warnings / 0 hazards. Max slice + targets (reference
targets in place): validate-record-judge 61 068 bytes (gate 200 KB).

Scratch worktree outside the tree (data + a scratch reference of the five modules + reference judge
files shaped as the probes; deleted afterwards): every chain green on the reference, 23.3–27.8 s
(max validate-record 27.8 s; limit 250 s); the reference also loads this repository's contour.yaml
(13 Components) and morph-map.json (74 card overrides) without a problem. One-line throwing typed
stubs: each code card red at the probe, 23 of 23 record examples red with a readable `Error: stub
<fn> <args>` line, 40 of 41 probe tests red (the select types-only test passes on typed stubs), chains
5.7–6.3 s; judges with their file absent red at eslint (`No files matching the pattern`), 3.5–3.7 s.
Mutation check: 30 single-rule mutations of the reference (record: no trim, unknown-before-required,
loose version, behavior optional, empty examples, two-key step, compact schema, no duplicates, an extra
key, Function duplicates across Components, ref default; map: trimming, non-integer, double group,
extra-card order, id last, empty targets; select: a repeat twice, no slug, self call, every step target,
own Data Objects only, the first of many; load: the whole message, case-sensitive extension, the tail at
20, plural always, yaml for JSON, "record" for a map, a swallowed parse error) — 30 of 30 killed by the
card's probe. Reference answers: code 1.7–11.4 KB (≈ 480–3 250 tokens) against `max_tokens` 12 000 /
16 000 (≥ 4.9× headroom); judge files 5.2–8.2 KB (≈ 1 490–2 330 tokens) against 20 000 / 24 000 (≥ 8.6×).
Forecast ≈ $0.13 (≤ $1). Gate holds.

### Run

One run on the VPS, processor glm53, autonomous mode, on the deck that passed the autonomous gate
(8 cards, `deck check` 0 errors, 0 hazards). No re-cut was needed. "Burned" = every request that was
not a winning write (requests − written).

**Run 1** `20261007-055044-16e9b637`, branch `morph/20261007-055044-16e9b637`, 05:50:44 → 06:03:03
(12.3 min), 20 requests, 337 865 in / 78 076 out, **$0.1556**. 8 written, 0 failed, 0 skipped; 12
variants burned. Every finish reason `stop`: no truncation, but one near miss — validate-record.v2
used 15 494 of its 16 000 output tokens (and returned `record.ts` twice); every judge ≤ 1 824 of
20 000 / 24 000.

| card | gen | attempts | winning variant | commit | first red of each burned variant |
|---|---|---|---|---|---|
| validate-record (types+record) | 1 | 3 | r2.v1 | 8ae662f | v1: discarded unread, `types.ts` missing from the answer; v2: discarded unread, `record.ts` returned twice (15 494 out tokens); r1.v1: probe, Validate Record example 2 (the 19 problems not in walk order); r1.v2: eslint, `ContourRecord` imported and unused; r2.v2: losing variant (not surfaced) |
| select-components | 2 | 1 | v1 | 5a35485 | v2: losing variant (not surfaced) |
| validate-map | 2 | 2 | r1.v1 | 650695b | v1: eslint, `prefer-const` (`docs`); v2: eslint, `prefer-const` ×4 + `prefer-as-const` (`let version: 1`); r1.v2: losing variant (not surfaced) |
| validate-record-judge | 2 | 1 | — | 53c550a | — |
| load-spec | 3 | 1 | v1 | a7085e3 | v2: losing variant (not surfaced) |
| validate-map-judge | 3 | 1 | — | af401ff | — |
| select-components-judge | 3 | 2 | r1 | f6a9517 | 0: eslint, `r` assigned and unused |
| load-spec-judge | 4 | 2 | r1 | 761408b | 0: own expectation in Load Spec example 3 — the 11-group record's expected list built from the `.name: required` lines only, without the `.description: required` lines (the code's 22 problems are right; r1 built both) |

Minutes per generation: 6.6 / 2.6 / 1.9 / 1.2. Archive commit ab6f92e (old Morph's own).

Phase total: **$0.1556** executor (prediction ≈ $0.13 nominal, ≤ $0.30 with a re-cut — over the
nominal by 20 %, inside the ceiling; validate-record's three attempts are $0.087 of it), 12.3 min, 20
requests, 12 burned variants. tsc-first-red: 0 of 12. neighbour-red: 0.

§9 check: cards 8 / generations 4 — as predicted; `deck check` 0 / 0 hazards — as predicted. Cards
with a retry batch 4 of 8 (validate-record ×2, validate-map, select-components-judge,
load-spec-judge) vs predicted 2. Tests after: 464 in 45 files (416 + 48 judge tests in 4 files:
record 14, map 12, select 11, load 11); judge example tests 23 of 23 (6 + 4 + 6 + 7), ≥ 23 holds; own
tests 8 / 8 / 5 / 4, each within its cap of 8. First red: of the predicted code first reds only the
walk order showed (validate-record r1.v1, example 2); the rest were answer shape (a missing file, a
doubled body — glm's P5/P8 mode, here caught by the file-count check before tsc) and eslint
(unused import, `prefer-const`); the judges' reds an unused variable and one own expected list, never
the code. Falsifiable claims: (1) no card red on a sibling's file — holds; (2) no judge red traced to
§2.1 — holds (the load-spec-judge red is an inline literal of Load Spec 3, not a fixture); (3) no judge
cut off at `max_tokens` — holds; (4) no test writes a file or reads one outside `tests/fixtures/`,
`contour.yaml`, `morph-map.json` — holds (imports are vitest, `../helpers.js` and `src/contour/*` only;
no `vi.`, `writeFile`, `spawn`, `exec`, `process.`).

Max slice + targets, measured on the finished tree: select-components-judge 66 539 bytes (gate 200 KB).

Verification on `morph/20261007-055044-16e9b637` by the run session: `git status --short` empty;
`tsc --noEmit`, `eslint src tests` clean; `vitest run` 464/464 in 45 files; `npm run build` ok;
`git for-each-ref` and symbolic HEAD identical before and after `vitest run`. `src/contour/*` read
once against §2.2: types by the probe's type tests; record walk per object (required, then unknown
keys in object order, then values in table order, depth first), `(root)` paths, trimming, absent
lists `[]` and absent language/ref/schema `null`, version `!== 1`, steps (one key, verb table,
target trimmed), `examples: []` / `exposes: []` messages, a mapping schema as `JSON.stringify(…,
null, 2)` in document order, duplicates at the repeat's name (Components and Data Objects per record,
Functions per Component); map unknown root keys first, values verbatim, groups' first owner, cards
`{id, ...fields}`, extra cards required → unknown → component → fields, positive-integer and id
patterns; load yaml by lower-cased extension, first line of the parser's message, `is not a mapping
at the top level`, singular/plural, 20 listed + `… and <n> more`; select slug match, given order, a
repeat once, the record's own objects, first unmatched name stops, self/unknown calls as errors,
Data Objects of any Component. **No code defect found.** Judge defects (code defects a judge caught
that the probes did not): 0.

Lessons: (1) a two-file code card on glm is the expensive card again: validate-record (the largest
target, ≈ 13 KB) spent 6 requests and $0.087 — the first two answers broke the file-set rule
(a file missing, a file twice), and v2 ran to 97 % of its 16 000 ceiling; the P6 sizing rule (×2 of
the reference) held only because the reference was 11.4 KB against the written 16 KB. (2) eslint's
`prefer-const` / unused-import reds were 4 of 12 burned variants — cheap ($0.004–0.017 each), each
absorbed by the second variant or the retry.
