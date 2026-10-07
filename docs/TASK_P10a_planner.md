# TASK_P10a — the planner: record + map → deck (`src/planner/`, `morph plan --spec`)

> Phase P10a of `docs/PLAN.md` ("Фазы по записи (после P2)": P10 split into P10a and P10b, DECISIONS
> "P10 · split"). Component `planner` of `contour.yaml` (nine Functions: Render Examples, Render
> Function, Render Context, Card Budget, Cut Units, Cut Component, Cut Judges, Order Deck, Plan Spec;
> four Data Objects: Budget, Unit, Cut Card, Plan)
> and Component `cli` (new Function Plan Command, Data Object Plan Document; Parse Command and Main
> patched). TypeScript under `src/planner/` (**pure**: no file system, no clock, no environment; of
> the Node modules only `node:path`) and `src/cli/`. The deck is cut by the old Morph (`mrph plan
> --spec`) and **run by the V2 binary** (`node dist/cli.js run`), the first phase to be.
>
> Issue #3 (label `P10-planner`) is answered here for the planner's part: preconditions rendered on
> the code card, callee contracts and preconditions of the callees and of the used Components in the
> judge's instruction, the helpers module in the judge's slice, the judge budget from its examples.
> The acceptance builder in TypeScript (issue #3, A and B) is P10b; this deck's acceptances still come
> from `decks/tools/build.py p10` (with B on: full failure section, eslint's verdict after the probe).

## 1. Why this

- **V2 cannot cut its own decks.** Every one of the 10 phases so far (P0–P9c, 99 cards) was cut by the
  old `mrph plan --spec` (997 lines of Python, `mrph/cards/plan_spec.py`, frozen) and converted for the
  V2 runner by `decks/tools/v2deck.py`. The dogfooding switch (PLAN) needs `morph plan`.
- **The P5 debt (issue #3).** `process-generation-judge` went red 3 runs in a row on correct code: glm
  had no fact about the compiler and the rollback in its slice. Fable passed at once by reading the
  neighbours. Since P5 every spec carries those facts by hand (§2.1 "A judge's setup across
  Components", P9b C1–C8, P9c F1–F4); the planner now renders them from the record.
- **Judge truncations.** P5 truncated three times at 13 500; every phase since sets judge
  `max_tokens` by hand (20 000–28 000). The old formula (12 000 + 500 per example) gives 13 500 for
  three examples.
- **Golden cross-check.** On the planner's fixture record (2 Components, 6 Functions, 2 Interfaces, a
  group, 6 overrides, 3 extra cards) the old `mrph plan --spec --judge` gives 17 cards in 5
  generations; V2 must give the same ids, `dependsOn` and generations (`tests/fixtures/planner/ledger.golden.json`
  is the old Morph's own answer, 07.10). On this repository's record, Component `contour`, V2 must
  give the 4 generations of the P9 deck.

PLAN: P10 ≈ 1 phase; this cut 12 cards (6 code, 6 judges), 6 generations, **38 new record examples**
(planner 30: Render Examples 2, Render Function 3, Render Context 4, Card Budget 2, Cut Units 3, Cut
Component 4, Cut Judges 4, Order Deck 3, Plan Spec 5; cli 8: Parse Command 9–11, Plan Command 1–5)
and 3 changed (Parse Command 4 and 8, Main 4's `given`).

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Contour Record, Contour Map** — `src/contour/types.ts` (P9): the planner takes them typed; tests
  build them with `loadContour` / `loadMap` of `src/contour/load.ts` from fixture texts.
- **Card** — `src/cards/types.ts` (P1): every field is set by the planner, keys in the type's order
  `customId, intent, targets, contextSlice, instruction, acceptance, model, maxTokens, reasoning,
  variants, dependsOn` (`JSON.stringify` and the fixtures see the order).
- **Language Profile** — `src/language/types.ts` (P8); the planner uses `resolveProfile`,
  `fillTemplate` (`profiles.ts`), `cutTargets`, `slugName` (`naming.ts`), `codeTargets`,
  `testTarget`, `profileForPath` (`paths.ts`), `acceptanceScript`, `judgeInstruction`
  (`template.ts`), and from contour `selectComponents`, `componentSlug`, `functionLinks`
  (`select.ts`).

**Fixtures** (`tests/fixtures/planner/`, read with `fixture` / `fixtureJson` of `tests/helpers.ts`):

| file | type | what it is | used by |
|---|---|---|---|
| `ledger.yaml` | text (a record) | System ledger; Component **ledger** (typescript): Functions Parse Entry (2 examples), Sum Entries (1, a precondition, calls Parse Entry), Check Ledger (2, calls Parse Entry and Sum Entries, uses store), Format Report (1, calls Sum Entries); Data Object Entry; Interfaces ledger CLI (exposes Format Report, Check Ledger) and check API (exposes Check Ledger). Component **store** (python): Save Ledger (1, a precondition, modifies Ledger File, uses ledger), Load Ledger (1); Data Object Ledger File (a mapping schema). Requirement Exact Sums, Guardrails No Network, Pure Core | every planner test, through `loadContour` |
| `ledger.map.json` | text (a map) | language typescript, docs `["docs/TASK.md", "ledger.yaml"]`, group checks = [Sum Entries, Check Ledger], 6 card overrides (parse-entry → id parse, format-report, save-ledger, parse-judge, ledger-cli-judge, count-words of no cut), 3 extra cards (store-schema of store, notes of none, ledger-types of "Ledger") | every planner test, through `loadMap` |
| `sumEntries.section.txt`, `checkLedger.section.txt` | text, **no final newline** | the whole functionSection of Sum Entries / Check Ledger | Render Function 1, 2 |
| `ledger.cut.json` | JSON array of 4 Cards | cutComponent of ledger (docs `["docs/TASK.md"]`, spec "ledger.yaml"): parse, checks, format-report, ledger-cli | Cut Component 1 |
| `store.cut.json` | JSON array of 2 Cards | the same for store: save-ledger, load-ledger | Cut Component 2 |
| `ledger.judges.json` | JSON array of 6 Cards | cutJudges over the 6 cut cards above, hasFile true only for `tests/helpers.ts` | Cut Judges 1 |
| `extras.cards.json`, `extras.judges.json` | JSON arrays of 3 / 2 Cards | the three extra cards as planSpec makes them; their two judges (hasFile always false) | Cut Judges 4 |
| `ledger.plan.json` | JSON object, a Plan | planSpec over both Components, judge true, hasFile true only for `tests/helpers.ts`: 17 cards | Plan Spec 1, Plan Command 1 |
| `ledger.golden.json` | JSON object | `{source, cards: [{customId, dependsOn}] ×17, generations (5), externalDependsOn}` from the old mrph | Plan Spec 1 |

Every count above was checked against the reference implementation and the old mrph (§11 Gate).
Other fixtures used: `tests/fixtures/contour/badCalls.json` (Cut Component 4: a record valid in shape
whose Component loop has A calling the unknown B), `tests/fixtures/decks/layered.json` (Order Deck 1:
cards a; b, c → a; d → b, c, read with `loadDeck`), and this repository's own `contour.yaml` and
`morph-map.json` (Plan Spec 5, `fixture("../../contour.yaml")`). Every other example's literal is in
the record (Component planner or cli, the Function's example `given`).

**Harness skeleton** (the probes use it verbatim; built only from `tests/helpers.ts` and P9's loader):

```ts
import { fixture, fixtureJson } from "../helpers.js";
import { loadContour, loadMap } from "../../src/contour/load.js";
import type { Component, ContourMap, ContourRecord } from "../../src/contour/types.js";
function record(name: string): ContourRecord {
  const r = loadContour(fixture(name), name);
  if (!r.ok) throw new Error(r.error);
  return r.record;
}
function contourMap(name: string): ContourMap {
  const m = loadMap(fixture(name), name);
  if (!m.ok) throw new Error(m.error);
  return m.map;
}
const REC = record("planner/ledger.yaml");
const MAP = contourMap("planner/ledger.map.json");
const LEDGER = REC.system.groups[0] as Component;
const STORE = REC.system.groups[1] as Component;
const EMPTY_MAP: ContourMap = { version: 1, package: null, language: null, docs: [], groups: [], cards: [], extraCards: [] };
```

**Copy this skeleton, then delete every constant your file does not use** (`LEDGER`, `STORE`,
`EMPTY_MAP`, … and their now-unused type imports): eslint rejects an unused variable, and "verbatim"
means the text of what you keep, not keeping all of it (run 20261007-111944: plan-spec-judge was green
on every test and red only on an unused `EMPTY_MAP`).

Order Deck builds cards with `const card = (id: string, dependsOn: string[]): Card => ({ customId: id,
intent: "patch", targets: ["src/" + id + ".ts"], contextSlice: [], instruction: "x", acceptance: null,
model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn });`. Cut Judges builds its six
Cut Cards from the cut fixtures (they are what cutComponent gives; cut-judges does not wait for
cut-component), verbatim:

```ts
const fns = (c: Component, names: string[]): ContourFunction[] =>
  names.map((n) => c.functions.find((f) => f.name === n) as ContourFunction);
const [P, K, R, L] = fixtureJson("planner/ledger.cut.json") as Card[];
const [S, D] = fixtureJson("planner/store.cut.json") as Card[];
const cut = (card: Card | undefined, component: Component, profile: LanguageProfile, names: string[]): CutCard =>
  ({ card: card as Card, component, profile, functions: fns(component, names), slicedByMap: false });
const CUTS: CutCard[] = [
  cut(P, LEDGER, TYPESCRIPT, ["Parse Entry"]), cut(K, LEDGER, TYPESCRIPT, ["Sum Entries", "Check Ledger"]),
  cut(R, LEDGER, TYPESCRIPT, ["Format Report"]), cut(L, LEDGER, TYPESCRIPT, []),
  cut(S, STORE, PYTHON, ["Save Ledger"]), cut(D, STORE, PYTHON, ["Load Ledger"]),
];
```

(`TYPESCRIPT`, `PYTHON` from `src/language/profiles.ts`.) Cut Judges 4 wraps each card of
`extras.cards.json` as `{ card, component: null, profile: null, functions: [], slicedByMap: true }`.
Plan Command builds a tmp root: `const r = tmpRoot(); r.write("ledger.yaml", fixture("planner/ledger.yaml"));
r.write("ledger.map.json", fixture("planner/ledger.map.json")); r.write("tests/helpers.ts", "export {};\n");`
and removes it in `finally`.

**A judge's setup across Components** (TASK_TEMPLATE §2.1). The facts a test depends on:

- **F1** contour · `loadContour(fixture("planner/ledger.yaml"), …)` is ok and its `system.groups` are
  `[ledger, store]` in that order; `loadMap` of the map is ok · without it every planner test fails at
  setup.
- **F2** contour · a typed record is a plain object: an example that changes one field spreads it
  (`{ ...LEDGER, language: "go" }`, `{ ...REC, system: { ...REC.system, requirements: [], guardrails:
  [] } }`, `{ ...MAP, language: "cobol" }`, `MAP.cards.map((c) => c.id === "parse-entry" ? { ...c,
  dependsOn: ["checks"] } : c)`); Validate Record is not re-run on it.
- **F3** language · the profiles are registry objects: `cut.profile === TYPESCRIPT` (`toBe`) holds.
- **F4** cards · `loadDeck` rejects a cycle, so Order Deck 3 builds its cards with `card(...)`, never
  through a deck file.
- **F5** cli · `readDeckFile(root, path)` (`src/cli/document.ts`) loads a written deck file; its
  `deck.externalDependsOn` is a list of ids (`["outside"]`), unlike the Plan's record.
- **F6** cli · `main(argv, deps, io)` resolves `--root` against `deps.cwd`; with an absolute root any
  `cwd` works. Main writes exactly one stdout chunk and one stderr line `"morph plan: exit 0\n"`.

### 2.2. OUTPUT data shapes

**`src/planner/types.ts`** — exactly these exports (types only):

```ts
import type { Card } from "../cards/types.js";
import type { Component, ContourFunction, ContourMap, ContourRecord } from "../contour/types.js";
import type { LanguageProfile } from "../language/types.js";

export interface Budget { maxTokens: number; reasoningMaxTokens: number; variants: number }
export interface Unit { id: string; name: string; functions: ContourFunction[]; isGroup: boolean }
export type UnitsResult = { ok: true; units: Unit[] } | { ok: false; error: string };
export interface CutInput { record: ContourRecord; component: Component; map: ContourMap; docs: string[]; spec: string }
export interface CutCard {
  card: Card; component: Component | null; profile: LanguageProfile | null;
  functions: ContourFunction[]; slicedByMap: boolean;
}
export type CutResult = { ok: true; cuts: CutCard[] } | { ok: false; error: string };
export interface JudgeInput {
  record: ContourRecord; cuts: CutCard[]; map: ContourMap; docs: string[];
  defaultProfile: LanguageProfile; hasFile: (path: string) => boolean;
}
export type OrderResult =
  | { ok: true; cards: Card[]; generations: string[][]; externalDependsOn: Record<string, string[]> }
  | { ok: false; error: string };
export interface PlanInput {
  record: ContourRecord; map: ContourMap; spec: string; components: string[]; judge: boolean;
  hasFile: (path: string) => boolean;
}
export interface Plan {
  spec: string; components: string[]; cards: Card[]; generations: string[][];
  externalDependsOn: Record<string, string[]>;
}
export type PlanResult = { ok: true; plan: Plan } | { ok: false; error: string };
```

**Text rules shared by every instruction.** A *block* is text; blocks are joined by `"\n\n"`, lines
inside a block by `"\n"`. Every text is copied from the record as typed (already trimmed by P9); no
trailing newline anywhere. A *definition line* is `- <name>: <description>` from `record.requirements`
or `record.guardrails`, or `- <name> (definition not found in the record)`.

**`src/planner/render.ts`** — exports `EXAMPLES_HEADING = "Examples (the tests must prove each
one):"`, `MAX_TOKENS_CAP = 32000`, `REASONING_MAX_TOKENS = 2500` and:

- `renderExamples(examples: readonly Example[]): string` — record, Render Examples. A clause's
  whitespace: `text.split(/\s+/).filter((w) => w !== "").join(" ")`. The clauses are FOUR: `given`,
  `when`, `then` **and `ref`** — the ref is collapsed too (Render Examples example 1: ref `"R  1"` →
  `" (ref: R 1)"`, one space).
- `dataBlocks(record: ContourRecord, functions: readonly ContourFunction[]): string[]` and
  `functionSection(record: ContourRecord, fn: ContourFunction): string` — record, Render Function. A
  Data Object is looked up in **every** Component (`record.system.groups[*].dataObjects`), first match
  by name; a Data block is `Data <name>: <description>` or, with a schema, `Data <name>:
  <description>\nSchema:\n<schema>` (the schema text as typed, a mapping already JSON).
  functionSection's blocks, in order, each only when it has content: `## Function <name>` ·
  description · `Behaviour: <behavior>` · `Preconditions:` + `- <p>` lines · `Steps:` + `- <verb>:
  <target>` lines · `EXAMPLES_HEADING + "\n" + renderExamples(fn.examples)` (always) · the Data blocks
  of `[fn]`, one block each · `Requirements:` + definition lines · `Guardrails:` + definition lines.
- `preamble(docs: readonly string[], spec: string): string`, `inheritedSection(record: ContourRecord,
  component: Component): string`, `interfaceSection(iface: ContourInterface, modules: readonly
  string[]): string` — record, Render Context, word for word (the `--` of the second preamble is two
  hyphens).
- `codeBudget(steps: number, members: number, isGroup: boolean, examples: number): Budget`,
  `judgeBudget(examples: number): Budget` — record, Card Budget; `Math.min(MAX_TOKENS_CAP, …)`.

**`src/planner/cut.ts`** — `cutUnits(component: Component, groups: readonly MapGroup[]): UnitsResult`
and `cutComponent(input: CutInput): CutResult`, record Cut Units and Cut Component, plus:

- A unit's id is `slugName` of the Function's or the group's name (`naming.ts`); its `name` (for
  `cutTargets`) is the name as written. Group members are the Component's own Function objects in
  record order (`toBe` holds), whatever order the map lists them in.
- Deps of a unit come from the steps directly (each `calls` step whose target's owner is another
  unit), after `functionLinks` has passed; the owner map covers every Function of the Component.
- An Interface card has id `slugName(iface.name)`, targets `[code, test]` of `cutTargets(profile,
  component.name, iface.name)`, functions `[]`, and its instruction holds the preamble, its Interface
  section, the inherited section, the files line and the finale.
- Overrides are looked up by the **base** id (`map.cards.find((c) => c.id === baseId)`); a map card
  for an id this cut does not make is ignored (`count-words` in the fixture map). Final ids replace
  base ids in every `dependsOn`, including the override's own list; an id no card of this cut has is
  kept as given (`outside`, `format-report` seen from store).
- An override field `null` means "not set": use `override?.x ?? default` for every field (CardFields
  of P9 are `null` when absent).
- The dependency part of a slice uses the dependency's **final** targets[0]; a slice is never sorted.
- `intent` default `"patch"`; `reasoning` is always `{ maxTokens: … }` on a cut card.
- `instruction` with an override: `[override.instruction, ...the other blocks].join("\n\n")` — the
  preamble is the only block replaced; the record's text follows (P8/P9 rule: the map's opening).

**`src/planner/judges.ts`** — `judgeTarget(profile: LanguageProfile, code: string): string` =
`fillTemplate(profile.judgeTarget, { component: posix.basename(posix.dirname(code)), name:
posix.basename(code, posix.extname(code)) })` (`import { posix } from "node:path"`), and
`cutJudges(input: JudgeInput): Card[]`, record Cut Judges, plus:

- The examples line, exactly: `The examples below are the criterion, and you are its independent
  author: write one test per example (no fewer, no merging), each named after the Function and the
  example number, e.g. "<first Function's name> example 1".`
- Contract blocks, in this order after the examples blocks: `dataBlocks(record, functions)` · one
  `Callee <name>: <description>\nBehaviour: <behavior>` per callee · the preconditions block
  `Preconditions a test's setup depends on:` + lines `- <Component name> · <Function name> ·
  <precondition>` (the separator is " · ", U+00B7 between spaces). A used Component is found by
  `c.name === target || componentSlug(c.name) === componentSlug(target)`; the judged card's own
  Component (compared by name) is never a used one; a uses target that names no Component (`node:fs`) is skipped.
- A card without Functions (an Interface card, an extra card) gets the opening block only.
- The Card's keys and defaults as a code card; `variants` default 1.

**`src/planner/plan.ts`** — `orderDeck(cards: readonly Card[]): OrderResult` and `planSpec(input:
PlanInput): PlanResult`, record Order Deck and Plan Spec, plus:

- `orderDeck` returns new arrays (the input order is not changed); a layer is
  `[...ids].sort()`; `externalDependsOn` keys are inserted in the sorted card order (`JSON.stringify`
  shows `{"x":["ext2"],"z":["ext"]}` for Order Deck 2).
- `planSpec`: the map's profile is `resolveProfile(null, map.language)` (typescript when `null`); an
  extra card's Card: `customId`, `targets`, `instruction` are non-null for a valid map (Validate Map
  requires them), every other field `?? default` as the record says, `reasoning` `null` when
  `reasoningMaxTokens` is `null`; extra cards keep their map slice as is (never get dependency
  targets). The spec filter runs on every card (cut, extra, judge) after the judges are cut. The
  duplicate check runs after the filter, before `orderDeck`.

**`src/cli/types.ts`** (patch) — add, keeping everything else byte for byte:

```ts
import type { Plan } from "../planner/types.js";
export interface PlanArgs {
  name: "plan"; root: string; pretty: boolean; spec: string; components: string[]; map: string | null;
  judge: boolean; out: string | null;
}
export type Command = DeckCheckArgs | RunArgs | PlanArgs;
export interface PlanDocument extends Plan { out: string | null }
```

**`src/cli/planCommand.ts`** — `export const EMPTY_MAP: ContourMap` (the empty map of the record) and
`export function planCommand(root: string, args: PlanArgs): CommandResult`, record Plan Command. Error
results are `{ code, document: errorDocument(code, kind, message) }` (`document.ts`). A "regular
file" is `fs.statSync(abs).isFile()` inside try/catch (false on any throw). The document is
`{ ...plan, out: args.out }` (keys spec, components, cards, generations, externalDependsOn, out).

**`src/cli/main.ts`** (patch) — `command.name === "plan"` → `result = planCommand(root, command)`
(synchronous), between deck check and run; nothing else changes.

**`src/cli/parse.ts`** (patch) — record Parse Command. Concretely: `--spec`, `--component`, `--map`,
`--out` join the value flags; `--judge` is a boolean flag like `--pretty`; `--component` is the one
flag that repeats (every value kept, argv order); `plan` leaves the not-yet words (scout, primer,
review, report stay); the no-command message is `no command (commands: deck check, plan, run)`; plan
takes `--root --pretty --spec --component --map --judge --out`; for plan, after check 4 ("does not
apply"), a missing `--spec` → `missing --spec`, else the plan command is returned with keys in
PlanArgs order; deck check and run keep every check of P7 unchanged.

### 2.3. Names and the tests each judge writes

| module | exports | code card | judge's test (new or patched) |
|---|---|---|---|
| `src/planner/types.ts`, `src/planner/render.ts` | §2.2 types; render | render | `tests/planner/render.examples.test.ts` (new): Render Examples 1–2, Render Function 1–3, Render Context 1–4, Card Budget 1–2 = 11 |
| `src/planner/cut.ts` | `cutUnits`, `cutComponent` | cut-component | `tests/planner/cut.examples.test.ts` (new): Cut Units 1–3, Cut Component 1–4 = 7 |
| `src/planner/judges.ts` | `judgeTarget`, `cutJudges` | cut-judges | `tests/planner/judges.examples.test.ts` (new): Cut Judges 1–4 = 4 |
| `src/planner/plan.ts` | `orderDeck`, `planSpec` | plan-spec | `tests/planner/plan.examples.test.ts` (new): Order Deck 1–3, Plan Spec 1–5 = 8 |
| `src/cli/types.ts`, `src/cli/planCommand.ts`, `src/cli/main.ts` | PlanArgs, Command, PlanDocument; `EMPTY_MAP`, `planCommand`; main | plan-command | `tests/cli/planCommand.examples.test.ts` (new): Plan Command 1–5; **and** `tests/cli/main.examples.test.ts` (patched, below) |
| `src/cli/parse.ts` | `parseCommand` | parse-command | `tests/cli/parse.examples.test.ts` (patched): Parse Command 1–11 |

A code card covered by a probe writes **no test file**. A judge imports what it tests from
`../../src/<component>/<m>.js`, types with `import type`, `fixture` / `fixtureJson` / `tmpRoot` from
`../helpers.js`. A new file holds one `test(...)` per example in record order, named `<Function>
example <n>: <what>`, then at most 8 tests of its own. Compare a result with a fixture whole:
`expect(cutJudges(...)).toStrictEqual(fixtureJson("planner/ledger.judges.json"))`; a section with
`toBe(fixture("planner/sumEntries.section.txt"))`.

**The two patched files.**
- `tests/cli/parse.examples.test.ts` keeps every test name it has at HEAD except `Parse Command
  example 4: plan and deck status answer NotYetError` (replaced: `["scout"]` now); example 8's
  expected message becomes `no command (commands: deck check, plan, run)`; examples 9, 10, 11 are
  added after example 8 (before the own tests). 11 examples + the 8 own tests at HEAD.
- `tests/cli/main.examples.test.ts`: the built binary imports the package `yaml` since P10a (through
  `planCommand` → `src/contour/load.ts`), and the tmp out dir has no `node_modules`: Main examples 4
  and 5 go red (exit 1). The patch, and nothing else: in `beforeAll`, after `bin.write("package.json",
  …)`, `fs.symlinkSync(path.join(REPO, "node_modules"), path.join(bin.root, "node_modules"), "dir");`
  with `import fs from "node:fs";`. All 5 test names kept, 5 tests. (`bin.rm()` removes the link,
  never its target: `fs.rmSync` does not follow links.)

**Typing traps** (tsc strict):
- Every result is a union: compare it whole with `toStrictEqual`, or narrow first (`r.ok ? r.cuts :
  r.error`); never `r.cuts` unnarrowed.
- `fixtureJson` returns `unknown`: pass it straight into `toStrictEqual`; cast only to read a field
  (`fixtureJson("planner/ledger.plan.json") as Plan`, `… as Card[]`).
- `REC.system.groups[0]` is `Component`; write `as Component` anyway. A spread of a typed object keeps
  its type (`{ ...LEDGER, language: "go" }` is a Component).
- A `CutInput` / `JudgeInput` / `PlanInput` literal names every key; a helper `(over:
  Partial<PlanInput>): PlanInput => ({ ...defaults, ...over })` is the short way.
- No `any`; import only what you use (eslint rejects an unused import and `let` never reassigned);
  `test`, `expect` from `"vitest"`.

**A judge's own tests** (re-cut after run 20261007-110744: `cut-judges-judge` and `plan-spec-judge`
were red on correct code, every red in an own test or in a hand-built expected value):
- An own test asserts only a value this spec PRINTS for that exact input (a literal of §2.2 or a
  fixture). A path, a default, an order or an error text the spec does not print is not tested — when
  unsure, write no own test: zero own tests is allowed (the guard's minimum is the examples).
- Facts the reds guessed wrong, as the code (correctly) does them: `judgeTarget(TYPESCRIPT,
  "src/bare.ts")` = `"tests/src/bare.examples.test.ts"` (component = the code target's directory name,
  here `src`); `planSpec` with `components: []` on a record of two or more Components returns
  `{ok: false, error: "the record has 2 Components (ledger, store): pass --component"}` — it does not
  fall back to the map's extras; the selected Components are listed in the order given, not record order.
- An example's input AND expected value come from the same helper or fixture, never from two hand
  copies: Order Deck builds its input with the `card(id, dependsOn)` helper of §2.1 verbatim
  (`intent: "patch"`) and its expected cards with the same helper — orderDeck keeps every field, so
  the expected deck has `"intent": "patch"` (the red had input built as `"generate"`, expected as
  `"patch"`).

### 2.4. What must not break

- P0–P9c untouched byte for byte except the three patched modules (`src/cli/types.ts`, `main.ts`,
  `parse.ts`) and the two patched test files; `src/cards`, `src/contour`, `src/language` and their tests
  untouched.
- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/` — untouched by every card.
- Ripple (spike on the reference, §11): with the new parse.ts exactly Parse Command examples 4 and 8 of
  `parse.examples.test.ts` go red; with the new main.ts exactly Main examples 4 and 5 of
  `main.examples.test.ts` go red; nothing else of the 480 tests. Both files are deselected from every
  card's full run (`--exclude`) and run in their judges' own step.
- `tsc --noEmit`, `eslint src tests`, `vitest run` green after every generation (the two files
  aside until generation 5).

## 3. Acceptance

Built by `decks/tools/build.py p10` (`locate` and `full_report` on) into the `acceptance` of every
P10a card in `morph-map.json`; `mrph plan --spec` copies it onto the card. Narrow to broad; the first
red is the regeneration's diagnosis; a failed vitest step prints its whole failure section (Expected /
Received) and the first-difference line; a red eslint is reported after the probe / own test.

Code cards (no test file):
1. `probe/<card>/` with the guard, a vitest config and `tsconfig.card.json` (the project minus the
   targets of the other cards of the same generation); removed on exit.
2. `tsc --noEmit -p probe/<card>/tsconfig.card.json`.
3. `eslint <targets>` (verdict held).
4. `guard.mjs src <targets>`: layer `planner` imports only `cards`, `contour`, `language` and its own
   files; of the Node modules only `node:path` (P10a change of the guard); no `process`, `console`,
   `Date`, `Math.random`, `fetch`, no `any`. Layer `cli` as P7: `process`/`console` only in
   `src/cli.ts`.
5. `decks/p10/parts/<card>.probe.ts`: one test per record example of the card's Functions, values
   **and** types, then the §2.2 rows. render 11 + 2 = 13; cut-component 7 + 2 = 9; cut-judges 4 + 2 = 6;
   plan-spec 8 + 2 = 10; plan-command 4 + 2 = 6; parse-command 11 + 7 = 18, plus Plan Command 5 (main
   dispatches a plan argv: it needs this card's parser, generation 4) = 19. 63 tests.
6. eslint's verdict; `vitest run` minus the two patched files; frozen; untracked.

Judge cards:
1–3. `probe/<card>/` (no probe file); the same `tsc`; `eslint <targets>`.
4. `guard.mjs tests <file> <min> <max> lits.json` per file: render 11..19, cut 7..15, judges 4..12, plan
   8..16, planCommand 5..13, parse 19..23 (11 examples + 8 kept), main 5..5. Literals: render
   `sumEntries.section.txt`, `checkLedger.section.txt`, `Exact Sums`, `(definition not found in the
   record)`, `29500`; cut `ledger.cut.json`, `store.cut.json`, `badCalls.json`, `duplicate customId
   'parse-entry'`, `Interface 'x' exposes unknown Function 'Nope'`; judges `ledger.judges.json`,
   `extras.judges.json`, `Preconditions a test's setup depends on:`, `Write the CLI tests.`; plan
   `ledger.golden.json`, `ledger.plan.json`, `layered.json`, `dependency cycle among a, b`,
   `../../contour.yaml`, `validate-record`; planCommand `ledger.plan.json`, `spec file not found:
   nope.yaml`, `morph plan: exit 0\n` (as written in TS: `"morph plan: exit 0\\n"`), `decks/p.json`;
   parse `missing --spec`, `no command (commands: deck check, plan, run)`, `command scout is not
   available yet`, `flag --judge does not apply to run`, `Parse Command example 11`; main
   `symlinkSync`.
5. Patched files: every test name at HEAD kept (parse: but example 4's old name).
6. `vitest run <its files>`; eslint's verdict; the full run minus the two patched files; frozen;
   untracked.

**Output budget per card** (`max_tokens` in `morph-map.json`): the reference target in tokens (≈
bytes / 3.5) × 2 + 2 500 reasoning, rounded up; judges by Card Budget's own formula (16 000 + 1 000
per example) or more.

| card | reference target | estimate | `max_tokens` |
|---|---|---|---|
| render | types.ts 1.6 KB + render.ts 4.6 KB ≈ 1 770 tok | ≈ 6 000 | 16 000 |
| cut-component | cut.ts 6.8 KB ≈ 1 960 tok | ≈ 6 400 | 16 000 |
| cut-judges | judges.ts 4.8 KB ≈ 1 380 tok | ≈ 5 300 | 12 000 |
| plan-spec | plan.ts 4.3 KB ≈ 1 230 tok | ≈ 5 000 | 12 000 |
| plan-command | types 1.9 + planCommand 2.2 + main 1.3 KB ≈ 1 540 tok | ≈ 5 600 | 14 000 |
| parse-command | parse.ts 7.6 KB ≈ 2 170 tok | ≈ 6 800 | 14 000 |
| render-judge | ≈ 6 KB (13 tests) ≈ 1 720 tok | ≈ 6 000 | 28 000 (11 examples) |
| cut-component-judge | ≈ 6 KB ≈ 1 720 tok | ≈ 6 000 | 24 000 |
| cut-judges-judge | ≈ 5 KB ≈ 1 430 tok | ≈ 5 400 | 20 000 |
| plan-spec-judge | ≈ 7 KB ≈ 2 000 tok | ≈ 6 500 | 24 000 |
| plan-command-judge | planCommand ≈ 5 KB + main.examples 6.7 KB ≈ 3 350 tok | ≈ 9 200 | 28 000 |
| parse-command-judge | parse.examples ≈ 7.2 KB ≈ 2 060 tok | ≈ 6 600 | 24 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- **Layer** `planner`: pure, of the Node modules only `node:path`; imports `../cards/types.js`,
  `../contour/*.js`, `../language/*.js`, `./*.js`. `types.ts` imports types only. `render.ts` imports
  types only; `cut.ts` imports render, contour's `select.js`, language's `naming.js`, `profiles.js`,
  `template.js`; `judges.ts` imports render, `select.js`, `paths.js`, `profiles.js`, `template.js`,
  `node:path`; `plan.ts` imports cut, judges, `select.js`, `profiles.js`.
- Layer `cli`: `planCommand.ts` may use `node:fs`, `node:path`; it never touches `process`.
- Tests read files only through `fixture` / `fixtureJson`; Plan Command's tests write only under
  `tmpRoot()`. A judge writes only its test files and never the module it tests.
- A file a card writes is in no sibling's slice in the same generation. Dependencies: cut-component
  and cut-judges on render; plan-spec on both; plan-command on plan-spec; parse-command on
  plan-command (it needs `PlanArgs`); plan-command-judge also on parse-command (Plan Command 5 calls
  main with a plan argv).
- Exact strings of the record and §2.2 (every error text, the preamble, the examples line, the
  preconditions heading, the `·` separator): the executor copies them.

## 7. Out of scope

- **P10b — the acceptance builder in V2** (issue #3, A and B): the attempt snapshot with the phase
  suffix, the per-card tsconfig excluding siblings, the stage order with `== <stage>` lines, the guard
  (layers, test-file bounds, literals), probes inlined, names kept, full-suite excludes, frozen and
  untracked, own-git, `NO_COLOR=1 CI=1`; B1 the full Expected/Received section and the first
  difference, B2 the probe past a red eslint. Until then `decks/tools/build.py` writes every
  acceptance into the map and the planner copies it (an override's `acceptance`).
- **The harness skeleton generated from `tests/helpers.ts`** (issue #3, third item): P10a puts the
  helpers module into every judge's default slice; generating a skeleton from its exports needs the
  syntax tree of the helpers, which is the builder's (P10b).
- Runner parity (issue #3, C2–C7: retry budget per card, best-variant context, raw answers, file tags,
  the acceptance timeout, the truncation text): runloop / compiler, a later phase.
- `plan --from-scout` (scout, P13), `deck add|status|reset|clear` (no deck store in V2: `plan --out`
  writes the deck file `run` reads), the old guard table (`plan_spec_guards`), the old slice-cap
  fallback (`--slice-cap-bytes` of plan: `deck check` weighs slices), `--package` (the profile's
  templates own the layout; the map's `package` is read and not used).
- The map's `package` key in targets, a python test run in any acceptance (python lines are text).

## 8. How to run

```
python3 decks/tools/build.py p10
cd /home/john/Documents/Work2026/MorphProject/morph-lab
venv/bin/mrph plan --root <repo> --spec contour.yaml --map morph-map.json --component planner --component cli --judge > <dry.json>   # dry
venv/bin/mrph deck clear --root <repo> && venv/bin/mrph deck reset --root <repo>
# deck add of the 12 P10a cards of that dry payload (the cut also yields document, deck-check, run-command,
# main and their four judges: not part of P10a)
venv/bin/mrph deck check --root <repo>
python3 decks/tools/v2deck.py <the 12 cards> decks/p10/v2deck.json
npm run build && node dist/cli.js deck check --root . --deck decks/p10/v2deck.json   # errors 0
node dist/cli.js run --root . --deck decks/p10/v2deck.json --processor glm53 --max-retry-batches 8 --deadline 2400   # on the operator's word
```

`mrph` reads `.env` from the current directory: run it from `morph-lab`. The V2 binary reads the
processor from the environment (`MORPH_PROCESSOR_glm53_*`, the keys from `morph-lab/.env`, never
printed). `--max-retry-batches 8` is the workaround of issue #3 C2 (the budget is per run in V2).

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 12 (6 code, 6 judges) / 6: [render] [cut-component, cut-judges, render-judge] [plan-spec, cut-component-judge, cut-judges-judge] [plan-command, plan-spec-judge] [parse-command] [parse-command-judge, plan-command-judge] |
| executor bill | ≈ $0.33 nominal (18 first requests — 6 code × 2 variants + 6 judges — of ≈ 20–30k in (slice + targets 48–74 KB, instruction 3–11k chars) / ≈ 2–5k out, ≈ 400k in / 72k out; + ≈ 9 retries carrying their 18–29k-char acceptance, ≈ 270k in / 36k out; at $0.31/M in, $1.13/M out), ≤ $0.70 with a re-cut; cap $5 |
| cards with regeneration | 4 of 12 (cut-component: override `null` vs absent, the slice of an empty cut; render: a block order or a stray newline; plan-command-judge: two files; parse-command: the repeat exception) |
| tests after the run | 480 + 4 new judge files (≥ 30 example tests) + planCommand file; parse 19 (+3), main 5 |
| first red | render: whitespace of an example, the Data block of another Component; cut: `??` on `null` fields, dependsOn renaming inside an override list; judges: the `·` separator, a callee listed twice; plan: the cycle message lists all pending ids, the spec filter on extras; plan-command: the order of the four failures; parse: `--component` given twice refused |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no judge red traces to §2.1 F1–F6;
(3) no judge cut off at its `max_tokens`; (4) the V2 planner on the ledger fixture gives the old
mrph's ids, dependsOn and generations (Plan Spec 1 green on the merged tree).

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations per card, judge
defects (code defects a judge found that the probe did not, and the reverse), the V2 runner's own
behaviour on the first V2-run phase (retries, stage reached), the row of `docs/MEASURE.md`.

## 11. Actual

### Gate (preparation)

07.10, on the laptop, by the preparing orchestrator (Opus 5.5); the operator's word for P10. Dry `mrph plan
--spec --component planner --component cli --judge` exit 0 (20 cards; the 12 of P10a added with `deck add`);
`mrph deck check` 0 errors / 0 warnings / 0 hazards; `decks/tools/v2deck.py` → `decks/p10/v2deck.json`,
`node dist/cli.js deck check` 0 errors / 0 warnings, generations `[render] [cut-component, cut-judges,
render-judge] [cut-component-judge, cut-judges-judge, plan-spec] [plan-command, plan-spec-judge]
[parse-command] [parse-command-judge, plan-command-judge]`.

Scratch worktree (a reference of the six code targets and the six judge files shaped as the probes, deleted
afterwards), cards run in deck order, each accepted card committed before the next: **12 of 12 chains green,
6.4–9.2 s each** (85 s in all; limit 250 s). The final reference tree: `tsc`, `eslint src tests` clean,
`vitest run` **528 / 528** in 53 files (480 + 48). Ripple spike: exactly Parse Command 4, 8 and Main 4, 5 of
the 480 go red without the judges' patches.

Golden cross-check: the old mrph on `ledger.yaml` gives 17 cards / 5 generations (`ledger.golden.json`) and
the reference V2 the same ids, dependsOn, generations and externalDependsOn; the reference binary's `morph
plan --spec contour.yaml --map morph-map.json --component planner --component cli --judge` equals the old
mrph's dry cut of the same on all 20 cards in ids, dependsOn, generations, targets, slices, acceptances and
max_tokens.

Typed one-line throwing stubs (`Error: stub <fn> <args>`; types.ts as specified; parse.ts = the P7 file;
main.ts with the dispatch): every code card red at the probe — render 12 of 13, cut-component 8 of 9,
cut-judges 5 of 6, plan-spec 9 of 10, plan-command 5 of 6 (the types test passes on typed stubs);
parse-command 7 of 19 (Parse Command 8–11, Plan Command 5 and two plan rows; the 12 P7 tests pass on the old
parser, example 4 is reworded and true on it); every new record example red with a readable line; chains
4.0–4.8 s. Judges with their new file absent: red at eslint and the guard (2.3–3.0 s); the parse judge on
the HEAD file: red at the guard (16 tests, expected 19..23, five literals missing). Mutation check: 45
single-rule mutations of the reference (render 13, cut 10, judges 8, plan 7, planCommand 4, parse 3) — 45 of
45 killed by the card's probe (4 survivors of the first pass closed by new probe rows).

Max slice + targets (reference in place): plan-spec-judge 73 936 bytes (gate 200 KB). Reference answers:
code 4.3–7.6 KB (≈ 1 230–2 170 tokens) against 12 000–16 000; judge files 5–12 KB against 20 000–28 000.
Forecast ≈ $0.33 (≤ $1). Gate holds; the run waits for the operator.
