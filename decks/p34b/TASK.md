# TASK_P34b — issue #44 (part b): the planner renders Events and the Interface contract, gaps are plan warnings (`src/planner/{render,judges,cut,types,plan}.ts`, `src/cli/planCommand.ts`)

Plan: `docs/Plan_Epic2_Fixes.md` §7. Contract: issue #44 "Must hold" 2 (planner part), 3, 4, 5 and its first comment (the
parity audit); `decks/p34a/TASK.md` §7 is this phase's list. Parity = the same logic and functions as old mrph
(`mrph/cards/plan_spec.py`: Events PS:293, Interface PS:322–330 and PS:661, undefined target PS:303–304, behaviour
PS:284), not the same bytes. Record: Component planner (Render Function, Render Context, Cut Component, Cut Judges, Plan
Spec, Data Object Cut Card) and cli (Plan Command, examples 1, 6, 16, 17 changed, 18 new). Cut with `--only` (the
Components hold other Functions): a transaction of 10 cards.

**Decision of the operator's session (replaces P34a §7's proposal).** A step `reads/modifies/produces` naming no Data
Object or Event of the record is a plan WARNING, every such target, no list of type words, no heuristic. The card
instruction does not change for it: the identity corpus and every committed deck stay byte for byte.

## 1. Why this

- Measured 11.10 with the binary at 1169ea1 (P34a merged): ccledger and contour-engine load and cut like the old decks,
  but no card carries their Events (ccledger 2, contour-engine 6) or the Interface schema and bounds (contour-engine:
  both Interfaces have a schema, both have requirements or guardrails). A Function without examples still gets the empty
  heading "Examples (the tests must prove each one):" (ccledger: all 6 cards) and a judge with no criterion.
- Spike 11.10 (a scratch worktree, deleted after): with the rules of §2.2 the full suite is red only in Plan Command 1, 6
  (the ledger fixture has 2 undefined targets, `number` and `string`: the document gains `warnings`), 16 (the
  expected.json warnings) and 17 (two Functions without examples); the identity corpus and every other test green.
  MorphV2's own Component contour gives no warning.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main**: `src/contour/types.ts` (P34a: `ContourEvent {name, description, requirements, guardrails,
  schema: string | null}`, `Component.events`, `ContourInterface` OPTIONAL `requirements?`, `guardrails?`, `schema?:
  string | null`, `Example`), `src/planner/types.ts` (`CutCard`, `PlanResult`, `JudgeInput`, `Plan`), `src/planner/render.ts`,
  `src/planner/judges.ts`, `src/planner/cut.ts`, `src/planner/plan.ts`, `src/cli/planCommand.ts` (P34a's `warnings`),
  `src/language/profiles.ts` (`TYPESCRIPT`), `src/contour/load.ts` (`loadContour(text, name)`, `loadMap(text, name)`).
- **Fixtures** (committed in the data commit; every value measured by the spike):

| file | type | what the Function returns on it |
|---|---|---|
| `tests/fixtures/planner/events.yaml` | record text (two Components orders, catalog, typescript) | orders: Place Order (reads Cart, calls Price Cart, produces Order Placed, produces string; 1 example), Price Cart (no behavior, no examples; reads Cart, modifies Price Table), Cancel Order (produces Order Cancelled; guardrails One Writer, No Network; 1 example), Interface orders API (exposes Place Order, Cancel Order; schema a nested map; requirements [Exact Totals]; guardrails [One Writer, Missing Rule]), Event Order Placed (schema); catalog: List Prices (1 example), Format Price (no examples; reads number, produces string), Data Objects Cart (schema), Price Table, Event Order Cancelled (no schema) |
| `tests/fixtures/planner/events.map.json` | map text | typescript, docs [], group `prices` = [List Prices, Format Price] |
| `tests/fixtures/planner/events.texts.json` | object of 5 keys | `"functionSection Place Order"`, `"functionSection Price Cart"` (strings), `"dataBlocks Place Order, Cancel Order"` (3 strings), `"interfaceSection orders API"`, `"interfaceSection orders API, no record"` (strings) |
| `tests/fixtures/planner/events.plan.json` | Plan (5 keys) | planSpec on events.yaml/events.map.json, spec `"events.yaml"`, components [orders, catalog], judge true, hasFile true only for `tests/helpers.ts`: 9 cards, generations [[cancel-order, price-cart, prices], [cancel-order-judge, place-order, prices-judge], [orders-api, place-order-judge], [orders-api-judge]] |
| `tests/fixtures/planner/events.warnings.json` | 5 strings | its warnings |
| `tests/fixtures/planner/examples.json` | "Render Function 4", "5", "Render Context 5", "Cut Component 7", "Cut Judges 5", "Plan Spec 8" | given/then |
| `tests/fixtures/contour/parity/expected.json` | P34a's, `warnings` updated | ccledger 7 lines (language + 6 "no examples, no judge"), contour-engine 16 (language + 15) |
| `tests/fixtures/contour/parity/lines.json` | `{ccledger, "contour-engine"}: {<customId>: string[]}` | texts the card's instruction must hold: ccledger load (1), ledger (1); contour-engine engine (2 Event blocks), rest (1, its Interface section), mcp (1) |
| `tests/fixtures/cli/examples.json` | "Plan Command 1", "6", "16", "17" changed, "18" new | given/then |

- **Harnesses (the judges build from them).**
  - Planner: `const R = loadContour(fixture("planner/events.yaml"), "events.yaml"); if (!R.ok) throw new Error(R.error);`
    `const M = loadMap(fixture("planner/events.map.json"), "events.map.json"); if (!M.ok) throw new Error(M.error);`
    `const ORDERS = R.record.system.groups[0]; const CATALOG = R.record.system.groups[1];`
    `const fn = (c: Component, n: string) => c.functions.find((f) => f.name === n) as ContourFunction;`
    `const T = fixtureJson("planner/events.texts.json") as Record<string, string | string[]>;`
  - Cut Judges 5: `const cuts = [ORDERS, CATALOG].flatMap((c) => { const r = cutComponent({ record: R.record, component: c,
    map: M.map, docs: [], spec: "events.yaml" }); if (!r.ok) throw new Error(r.error); return r.cuts; });` then
    `cutJudges({ record: R.record, cuts, map: M.map, docs: [], defaultProfile: TYPESCRIPT, hasFile: (p) => p === "tests/helpers.ts" })`.
  - Plan Spec 8: `planSpec({ record: R.record, map: M.map, spec: "events.yaml", components: ["orders", "catalog"], judge:
    true, hasFile: (p) => p === "tests/helpers.ts" })`; the ledger as Plan Spec example 1 (planner/ledger.yaml,
    planner/ledger.map.json, spec "ledger.yaml", components ["ledger", "store"]); the own record with
    `fixture("../../contour.yaml")`, `fixture("../../morph-map.json")`.
  - Plan Command 18: P34a's Plan Command 16 harness (`tmpRoot()`, `r.write("contour.yaml", …)`, `planCommand(r.root, args)`,
    `r.rm()` in finally) with judge true; `const L = fixtureJson("contour/parity/lines.json") as Record<string,
    Record<string, string[]>>;` and per id `expect(doc.cards.find((c) => c.customId === id)?.instruction).toContain(text)`.

### 2.2. OUTPUT data shapes

**`src/planner/render.ts`** (PATCH). Render Function and Render Context, word for word:
- `dataBlocks`: a step target that names no Data Object of any Component is looked up among the Events of every
  Component (record order); found → the block `Event <name>: <description>` + `\nSchema:\n<schema>` when its schema is not
  null, taken like a Data Object (a target is rendered once). A Data Object wins over an Event of the same name. Any
  other target is skipped as today.
- `functionSection`: the block `EXAMPLES_HEADING + "\n" + renderExamples(fn.examples)` only when `fn.examples.length > 0`.
- `interfaceSection(iface: ContourInterface, modules: readonly string[], record?: ContourRecord): string`: blocks
  `## Interface <name>`, the description, `Schema:\n<schema>` when `iface.schema` is neither null nor undefined,
  `Exposes:` as today, then `Requirements:` and `Guardrails:` with one definition line per name of `iface.requirements`,
  `iface.guardrails` (each only when the list is defined and not empty), looked up in `record.requirements` /
  `record.guardrails` as Render Function's lines; with no record every line is `- <name> (definition not found in the
  record)`. Joined by `"\n\n"`. An Interface without the three fields renders exactly as today.

**`src/planner/judges.ts`** (PATCH). Cut Judges: after `code.length === 0`, a Cut Card whose `functions` is not empty and
none of which has an example gets no judge. The examples line names the first Function WITH examples; one
`Examples of Function <name>:` block per Function with examples (a Function without examples in a group adds no
block). A callee block is `Callee <name>: <description>`, plus `\nBehaviour: <behavior>` only when `behavior !== ""`.
An Interface card (no Functions) keeps its judge as today. Nothing else.

**`src/planner/types.ts`** (PATCH). `CutCard` gains OPTIONAL `guardrails?: string[]` after `slicedByMap` (hand-built
CutCards in tests/planner/judges.examples.test.ts must still compile); `PlanResult`'s ok variant becomes
`{ ok: true; plan: Plan; uses: Record<string, string[]>; warnings: string[] }`. `Plan` keeps its five keys. Nothing else.

**`src/planner/cut.ts`** (PATCH). Cut Component: `interfaceSection(entry.iface, modules, record)`; every Cut Card it
makes gets `guardrails` = the names of its Functions' guardrails (function order), then its Interface sections'
guardrails (`iface.guardrails ?? []`), then `record.system.guardrails`, then `component.guardrails`, distinct, first place
kept (old mrph PS:653–664 without its Interface-only filter, which is #42's). Nothing else.

**`src/planner/plan.ts`** (PATCH). Plan Spec returns `warnings`: for each selected Component in selection order, for each
of its Functions in record order: for each step with verb `reads`, `modifies` or `produces` (step order) whose target is
the name of no Data Object and no Event of any Component of the record, the line `<Component>/<Function>: step <verb>
'<target>' names no Data Object or Event of the record` (a line already present is not repeated); then, when the
Function has no examples, `<Component>/<Function>: no examples, no judge`. The lines do not depend on `judge`. `[]` when
none. Nothing else.

**`src/cli/planCommand.ts`** (PATCH). The document's `warnings` = loadContour's, then P34a's language lines, then
`planned.warnings` (Plan Spec's, computed before `--only`); still the LAST key and only when non-empty. Nothing else.

**Examples (the expected values).**

| example | given | then |
|---|---|---|
| Render Function 4 | events, [Place Order, Cancel Order] | `T["dataBlocks Place Order, Cancel Order"]` |
| Render Function 5 | events, Price Cart; Place Order | `T["functionSection Price Cart"]`; `T["functionSection Place Order"]` |
| Render Context 5 | orders API, modules `["src/orders/placeOrder.ts", "src/orders/cancelOrder.ts"]`, R.record; no record | `T["interfaceSection orders API"]`; `T["interfaceSection orders API, no record"]` |
| Cut Component 7 | events, Component orders, docs [], spec "events.yaml" | ids `["place-order", "price-cart", "cancel-order", "orders-api"]`; guardrails `["No Network"]`, `["No Network"]`, `["One Writer", "No Network"]`, `["One Writer", "Missing Rule", "No Network"]`; orders-api's instruction contains `T["interfaceSection orders API"]` |
| Cut Judges 5 | the harness | ids `["place-order-judge", "cancel-order-judge", "orders-api-judge", "prices-judge"]`, each card toStrictEqual the card of that id in events.plan.json; place-order-judge's instruction ends `"\n\nCallee Price Cart: Prices every item of a cart."`; prices-judge's contains `e.g. "List Prices example 1".` and `Examples of Function List Prices:`, not `Examples of Function Format Price` |
| Plan Spec 8 | events; ledger; own record (components ["contour"]) | ok, `plan` toStrictEqual events.plan.json, `warnings` events.warnings.json; ledger: plan toStrictEqual ledger.plan.json, warnings the two lines of examples.json "Plan Spec 8"; own: warnings `[]` |
| Plan Command 1 | as before | the document = ledger.plan.json + `out` + `warnings: ["ledger/Sum Entries: step produces 'number' names no Data Object or Event of the record", "ledger/Format Report: step produces 'string' names no Data Object or Event of the record"]` (last key) |
| Plan Command 6 | as before | as before, the document also ends with those `warnings` |
| Plan Command 16 | as before | unchanged test: expected.json's new warnings |
| Plan Command 17 | as before | warnings = the 10 lines of contourKeys.warnings.json, `"no language on Component catalog and none in the map: typescript assumed"`, `"orders/Place Order: no examples, no judge"`, `"catalog/List Prices: no examples, no judge"` (13); last key "warnings"; generations as before |
| Plan Command 18 | ccledger (components []) and contour-engine (components ["contour-engine"]), judge true | code 0; every text of lines.json in its card's instruction; contour-engine card ids `["diagram", "schema", "store", "diagram-judge", "engine", "schema-judge", "store-judge", "mcp", "rest"]` |

### 2.3. Names and the tests each judge writes

| module | change | code card | judge's file |
|---|---|---|---|
| `src/planner/render.ts` | PATCH | `render` | NEW `tests/planner/render.p34b.examples.test.ts` (Render Function 4, 5; Render Context 5) |
| `src/planner/judges.ts` | PATCH | `cut-judges` | NEW `tests/planner/judges.p34b.examples.test.ts` (Cut Judges 5) |
| `src/planner/types.ts`, `src/planner/cut.ts` | PATCH | `cut-component` | NEW `tests/planner/cut.p34b.examples.test.ts` (Cut Component 7) |
| `src/planner/plan.ts` | PATCH | `plan-spec` | NEW `tests/planner/plan.p34b.examples.test.ts` (Plan Spec 8) |
| `src/cli/planCommand.ts` | PATCH | `plan-command` | PATCH `tests/cli/planCommand.examples.test.ts` (example 1's expected document gains the two warnings), `tests/cli/planChecks.examples.test.ts` (example 6's the same), `tests/cli/planCommand.p34.examples.test.ts` (example 17's literal list of §2.2; example 18 added); every other test, name and line kept |

### 2.4. What must not break

- The identity corpus (`tests/gate/identity.examples.test.ts`) and every committed deck byte for byte; the golden
  fixtures (ledger.plan.json, ledger.cut.json, ledger.judges.json, goMini.deck.json, …) unchanged; every planner test
  of main unchanged and green; MorphV2's own record loads with no warning and its contour Component plans with none.
- The suite of main green, plus the new and patched files.

## 3. Acceptance

Built by `morph plan --checks decks/p34b/checks.json --only <10 ids>`. `ownGit: true`, `frozen` the defaults +
`templates`, `fullExclude` the judges' files. Code cards: tsc → eslint → guard → probe `decks/p34b/parts/<id>.probe.ts` → full.

## 4. Constraints

NodeNext, `.js` imports, `import type`, no `any`. planner stays pure (node:path only, as today). Each judge writes only
its files; tests write only under `tmpRoot()`.

## 7. Out of scope

- The "Interfaces Share One Core"-style Interface-only guard filter (PS:73, PS:665–667) and every Guardrail → guard rule:
  #42 (it reads `CutCard.guardrails`).
- Probes and judge bounds from examples: #45.
- Rendering an undefined step target in the card text ("(definition not found in the record)", PS:303–304): replaced by
  the plan warning (operator's decision 11.10).
- Event `requirements`/`guardrails` in the card (the old planner did not render them either).
