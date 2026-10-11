# TASK_P34a — issue #44 (part a): the loader reads the whole Contour (`src/contour/{types,record,load}.ts`, `src/cli/planCommand.ts`, `src/rules/layers.ts`)

Plan: `docs/Plan_Epic2_Fixes.md` §1, §7. Contract: issue #44 "Must hold" 1–8 and its first comment (the parity audit,
old mrph file:line vs V2 file:line). Parity = the same logic and functions as old mrph (`mrph/cards/record.py`,
`plan_spec.py`; `mrph/contour-reference/contour.schema.json` is the Contour author's schema), not the same bytes.
**Split** (the whole of #44 is 15–16 cards): P34a = the loader, its warnings in the plan document, the language warning,
`Component.dependsOn` as a layer edge (Must hold 1, 2 for the loader, 6, 7, 8); P34b = the planner's rendering and judges
(§7). Record: Component contour (Validate Record examples 1, 2, 6, 8 changed, 9 and 10 new; Load Spec example 5 new;
Contour Record, Record Result), cli (Plan Command behaviour, examples 16 and 17, Plan Document), rules (Layer Edges
behaviour, example 5). Cut with `--only` (the Components hold other Functions): a transaction.

## 1. Why this

- Measured 11.10 (#44 body) and again 11.10 15:10 with the binary at 1bf292b: `morph plan` exits 2 on all four proven
  Contour records. ccledger (old mrph 6/6 cards, 27.09): 7 problems (`events` unknown, 6× `examples: required`);
  contour-engine (the Contour author's record, old mrph 8/8): 36 problems (25× examples, `events`, Interface `schema`,
  `requirements`, `guardrails`, Data Object `requirements`, `guardrails`); ETHSmartChecker: 3× `behavior: required`;
  Megatron: `System.dataObjects` unknown + 1× `behavior: required`. No record valid under contour.schema.json loads
  (Contour has no `examples` key).
- Spike 11.10 (a scratch worktree, the unknown-key check and the behavior/examples requirement switched off, deleted
  after): ccledger and contour-engine then cut with exactly the old decks' ids, targets and depends_on, generations
  [[classify, load, price, render], [ledger], [cli]] and [[diagram, schema, store], [engine], [mcp, rest]]; the full
  suite red only in the tests that pin the old loader (record.examples 4 tests, load.examples 1 test); a language
  warning in the plan document reddens no Plan Command test.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main**: `src/contour/types.ts` (`ContourRecord`, `Component`, `ContourFunction`, `DataObject`,
  `ContourInterface`, `Actor`, `RecordResult`, `LoadRecordResult`), `src/contour/record.ts` (`validateRecord`, the
  `RecordWalker` with `checkKeys`, `elementList`, `stringList`, `readText`, `readSchema`), `src/contour/load.ts`
  (`loadContour`), `src/cli/planCommand.ts` (`planCommand`, `EMPTY_MAP`), `src/rules/layers.ts` (`layerEdges`),
  `src/contour/select.ts` (`componentSlug`). `CommandResult.document` is `unknown` (`src/cli/types.ts`): no cli type
  changes; a test reads `document` as `PlanDocument & { warnings?: string[] }`.
- **Fixtures** (committed in the data commit):

| file | type | what the Function returns on it |
|---|---|---|
| `tests/fixtures/contour/mini.json`, `mini.yaml` → `mini.typed.json` | record document / text → typed record | unchanged document; the typed record gains `events`, `references`, `consumes`, `dependsOn` [] per Component, `requirements`/`guardrails` [] per Data Object, Interface and Actor, Interface `schema` null; no warnings key |
| `tests/fixtures/contour/badRecord.json` → `badRecord.problems.json` | document → 19 problem lines | still 19 (the two unknown keys Extra and owner are warnings now, dropped on a failure; new problems: a numeric Interface schema, a non-list Data Object guardrails, an Event without description, a string Actor "Actor: must be an object or a list"); first "version: must be 1" |
| `tests/fixtures/contour/deps.json` → `deps.typed.json` | document → typed | the same new empty lists |
| `tests/fixtures/contour/badDeps.json` → `badDeps.problems.json` | document → 15 problems | still 15: dependency 0's unknown key url is a warning, its new `doc: 3` is "System.dependencies[0].doc: must be a non-empty string" (after its version line); first and last lines unchanged |
| `tests/fixtures/contour/contourKeys.json` → `contourKeys.typed.json`, `contourKeys.warnings.json` | document → typed record + 10 warning lines | Validate Record 9, Load Spec 5, Plan Command 17 |
| `tests/fixtures/contour/parity/{ccledger,contour-engine}.{contour.yaml,map.json,deck.json}` | copies of mrph `tests/fixtures/plan_spec/` (public) | Plan Command 16 |
| `tests/fixtures/contour/parity/expected.json` | `{ccledger, "contour-engine"}: {cards: {customId, dependsOn, targets}[], generations, warnings}` | derived from the two old decks (generations by their depends_on, ids sorted per generation) and equal to the spike's cut |
| `tests/fixtures/rules/dependsOn.yaml`, `dependsOnBad.yaml` | record texts, typescript, map `EMPTY_MAP` | Layer Edges 5 |
| `tests/fixtures/cli/examples.json` "Plan Command 16", "Plan Command 17" | given/then texts | Plan Command 16, 17 |

- **Harnesses (the judges build from them).**
  - Plan Command 16/17: `const r = tmpRoot(); try { r.write("contour.yaml", fixture("contour/parity/ccledger.contour.yaml"));
    r.write("morph-map.json", fixture("contour/parity/ccledger.map.json")); const res = planCommand(r.root, args); … } finally { r.rm(); }`
    with `const args: PlanArgs = { name: "plan", root: ".", pretty: false, spec: "contour.yaml", components: [], map:
    "morph-map.json", judge: false, out: null };`; `const want = fixtureJson("contour/parity/expected.json") as Record<string,
    { cards: { customId: string; dependsOn: string[]; targets: string[] }[]; generations: string[][]; warnings: string[] }>;`;
    `const doc = res.document as PlanDocument & { warnings?: string[] };` then
    `doc.cards.map((c) => ({ customId: c.customId, dependsOn: c.dependsOn, targets: c.targets }))` toStrictEqual `want.ccledger.cards`.
    Plan Command 17: `r.write("contour.json", fixture("contour/contourKeys.json"))`, spec `"contour.json"`, map `null`,
    components `["orders", "catalog"]`; `Object.keys(doc).at(-1)` toBe `"warnings"`.
  - Validate Record / Load Spec: `fixtureJson("contour/<f>.json")` for documents and expected values; `fixture("contour/<f>")`
    for texts; `fixture("../../contour.yaml")` for this repository's record.
  - Layer Edges 5: `const R = loadContour(fixture("rules/dependsOn.yaml"), "dependsOn.yaml"); if (!R.ok) throw new Error("fixture");`
    then `layerEdges(R.record, EMPTY_MAP)` (`EMPTY_MAP` from `"../../src/cli/planCommand.js"`).

### 2.2. OUTPUT data shapes

**`src/contour/types.ts`** (PATCH). New `export interface ContourEvent { name: string; description: string; requirements:
string[]; guardrails: string[]; schema: string | null }`. `DataObject` gains `requirements: string[]; guardrails: string[]`
after `schema`. `ContourInterface` gains OPTIONAL `requirements?: string[]; guardrails?: string[]; schema?: string | null`
after `exposes` (a hand-built Interface in `tests/planner/cut.examples.test.ts:169` must still compile; Validate Record
always sets all three). `Component` gains `events: ContourEvent[]; references: string[]; consumes: string[]; dependsOn:
string[]` after `interfaces`. `Actor` gains `requirements: string[]; guardrails: string[]` after `uses`. `RecordResult` =
`{ ok: true; record: ContourRecord; warnings?: string[] } | { ok: false; problems: string[] }`; `LoadRecordResult` =
`{ ok: true; record: ContourRecord; warnings?: string[] } | { ok: false; error: string }`. Nothing else.

**`src/contour/record.ts`** (PATCH): the record's Validate Record, word for word. Pinned:
- key tables, in this order (the order of value checks): COMPONENT_KEYS name, description, language, requirements,
  guardrails, uses, functions, dataObjects, interfaces, events, references, consumes, dependsOn; DATA_OBJECT_KEYS name,
  description, schema, requirements, guardrails; EVENT_KEYS name, description, requirements, guardrails, schema;
  INTERFACE_KEYS name, description, exposes, requirements, guardrails, schema; ACTOR_KEYS name, description, uses,
  requirements, guardrails; the others unchanged;
- an unknown key → the walker's `warnings` gets `<path>: unknown key '<k>' (ignored)` (never `problems`), at the place
  the problem was pushed before (after the missing-required problems of that object, in the object's key order);
- required: a Function's name and description only (behavior absent → `""`, examples absent → `[]`; an empty examples
  list is still "must hold at least one example"); an Event's name and description;
- Actor: a plain object → `[walkActor(it, "Actor")]`; a list → as today; else the problem `Actor: must be an object or a list`;
- schema: a string as today; a plain object whose every value is a string → as today; a plain object with any other
  value → `JSON.stringify(sortKeys(v), null, 2)` where sortKeys rebuilds every plain object at every depth with its keys
  in `Object.keys(o).sort()` order and keeps arrays in order; else `<path>.schema: must be a non-empty string`;
- Event names repeated anywhere in the record: `<path>.name: duplicate Event name '<n>'` (a set of its own, apart from
  Data Objects);
- the result: problems → `{ ok: false, problems }`; else `warnings.length > 0 ? { ok: true, record, warnings } : { ok: true, record }`.

**`src/contour/load.ts`** (PATCH): in `loadContour`, a valid result with `warnings` → `{ ok: true, record, warnings }`,
without → `{ ok: true, record }` exactly as now. Nothing else.

**`src/cli/planCommand.ts`** (PATCH): the success document is built as now, then `warnings` = `loadedRecord.warnings ?? []`
followed by, for each name of `plan.components` (the plan after `--only`), when the record Component with that name has
`language === null` and `map.language === null`, the line `no language on Component <name> and none in the map:
typescript assumed`; when `warnings.length > 0` the document gets `warnings` as its LAST key (after `out`). With no
warning the document is byte for byte today's. Nothing else.

**`src/rules/layers.ts`** (PATCH): Layer Edges, after a Component's Functions' `uses` steps, per name X of `c.dependsOn`:
the first Component matching X (name equal, or `componentSlug` equal) → for each directory d of that Component's own
directories (the set `componentDirs` already holds), every directory of the matched Component but d joins `edges[d]`;
no match → the error `Component '<C>': dependsOn '<X>' names no Component of the record` (through `addError`, so once).
A Component whose profile failed (dirs null) adds nothing. Nothing else.

**Examples (the expected values).**

| example | given | then |
|---|---|---|
| Validate Record 1, 2, 5, 7, 8 | the record (contour) | the fixtures above (5: the inline literal, unchanged: no Component, so no new field shows) |
| Validate Record 6 | `{version: "1", System: {…functions: [{name: "f", description: "F.", behavior: "B."}]}}` | `{ok: false, problems: ["version: must be 1"]}` |
| Validate Record 9 | `fixtureJson("contour/contourKeys.json")` | `{ok: true, record: contourKeys.typed.json, warnings: contourKeys.warnings.json}` |
| Validate Record 10 | the record's inline document | the Data Object `d`'s schema `JSON.stringify({a: ["q", {c: null, d: true}], b: {a: "x", z: 1}}, null, 2)`; `"warnings" in result` false |
| Load Spec 5 | contourKeys.json's text; this repository's contour.yaml | `{ok: true, record: contourKeys.typed.json, warnings: contourKeys.warnings.json}`; ok and `"warnings" in result` false |
| Layer Edges 5 | dependsOn.yaml; dependsOnBad.yaml | `{ok: true, edges: {"src/app": ["src/store", "src/util"], "src/store": [], "src/util": ["src/store"]}}`; `{ok: false, errors: ["Component 'app': dependsOn 'nope' names no Component of the record"]}` |
| Plan Command 16 | examples.json "Plan Command 16" | as its then (expected.json) |
| Plan Command 17 | examples.json "Plan Command 17" | the warnings: the 10 lines of contourKeys.warnings.json + `no language on Component catalog and none in the map: typescript assumed`; generations `[["cancel-order", "list-prices", "place-order"], ["orders-api"]]` |

### 2.3. Names and the tests each judge writes

| module | change | code card | judge's file |
|---|---|---|---|
| `src/contour/types.ts`, `src/contour/record.ts` | PATCH | `validate-record` | PATCH `tests/contour/record.examples.test.ts`: example 6 rewritten (named "Validate Record example 6: version must be the number 1 and examples are optional"), the own test "unknown keys come after required and before values, in the object's key order" replaced by "Validate Record own: an unknown key is a warning, dropped when there is a problem" (`{extra: 1}` → `{ok: false, problems: ["System: required"]}`; `{System: {name: "s", description: "d", groups: []}, extra: 1}` → `{ok: true, record: <example 5's record>, warnings: ["(root): unknown key 'extra' (ignored)"]}`); examples 9 and 10 added after example 8; every other test and line kept (measured by the spike: examples 2 and 8 read the updated fixtures and stay as they are) |
| `src/contour/load.ts` | PATCH | `load-spec` | NEW `tests/contour/load.p34.examples.test.ts` (Load Spec 5) |
| `src/cli/planCommand.ts` | PATCH | `plan-command` | NEW `tests/cli/planCommand.p34.examples.test.ts` (Plan Command 16, 17) |
| `src/rules/layers.ts` | PATCH | `layer-edges` | NEW `tests/rules/layers.p34.examples.test.ts` (Layer Edges 5) |

### 2.4. What must not break

- MorphV2's own record loads with no problem and no warning; every committed deck and the identity corpus
  (`tests/gate/identity.examples.test.ts`) byte for byte; Plan Command 1–15 goldens (no warning on their fixtures:
  measured by the spike); `tests/contour/load.examples.test.ts` unchanged and green (badRecord keeps 19 problems).
- The suite of main green, plus the new and patched files.

## 3. Acceptance

Built by `morph plan --checks decks/p34a/checks.json --only <8 ids>`. `ownGit: true`, `frozen` the defaults + `templates`,
`fullExclude` the four judge files. Code cards: tsc → eslint → guard → probe `decks/p34a/parts/<id>.probe.ts` → full.

## 4. Constraints

NodeNext, `.js` imports, `import type`, no `any`. contour stays pure (no node: module, `yaml` in load.ts only); rules
node:path only. Each judge writes only its file; tests write only under `tmpRoot()`.

## 7. Out of scope

P34b (next phase, the planner, Components planner and cli):
- Events rendered via steps like Data Objects (description + schema), looked up in every Component (#44 Must hold 3);
- Interface schema, requirements, guardrails rendered in the Interface section; Interface guardrails into the card's
  guardrail list for #42 (Must hold 4);
- an undefined step target rendered "Data <name> (definition not found in the record)" and a plan warning (Must hold 5).
  Measured: MorphV2's own record has 17 such targets (`string` ×16, `Record<string, string[]>`), go-mini 3, go-p7b 4
  (`Phase`, `Loop`, `bool`, `string`; go-p7b has no Data Object at all), ledger.yaml 2: rendering them all changes the
  identity corpus. P34b needs a rule that keeps the corpus (proposal: a target naming no element is rendered only when
  the record declares at least one Data Object or Event and the target is not a value type word) — a departure to
  record there;
- a Function without examples gets no judge card and the plan warning `<Function>: no examples, no judge` (Must hold 2,
  planner part); the empty "Examples" heading of such a code card dropped; a callee without behavior renders no empty
  "Behaviour:" line;
- the plan document merging Plan Spec's warnings (plan-command re-cut in P34b).
Not in #44: the probe skeleton and judge bounds from examples (#45); Guardrail → guard rules (#42); a one-item System
list (Contour allows it; the old reader refused it too, RECORD.md §4).
