# TASK_P19a — dependencies, the record half: `System.dependencies`, `Component.uses`, the finale and the doc in the slice (`src/contour/{types,record}.ts`, `src/language/dependencyFinale.ts`, `src/planner/{cut,types,plan}.ts`)

> Phase P19a of `docs/PLAN.md` ("Фазы по записи (после P2)": `P19 | contour + language + planner + builder
> (dependencies) | issue #10`), operator 08.10. Issue VasyaLutiy/morph#10 (label `P19-deps`; `gh issue list --label
> P19-deps`: #10 only; no other `P19-*` label). **Split P19a / P19b** (§7): this half builds issue #10 items 1–3 into the
> record — Component **contour** (Validate Record: the declaration and its faults), **language** (NEW: Dependency
> Finale), **planner** (Cut Component: the finale and the language check; Plan Spec: the doc check, the docs in the
> slices, the per-card `uses` the builder will read). P19b holds item 4 (builder: guards and the Go vendor flag; cli: the
> wiring) and item 5 (templates and regulation, MorphV2's own `yaml` declared) plus both smokes. The deck is cut by V2
> (`morph plan --component contour --component language --component planner --judge --checks decks/p19a/checks.json`),
> filtered to this phase's 8 cards by `decks/p19a/filter.py`; one gate (≤ $1, slices ≤ 200 KB, chains < 250 s, §11).

## 1. Why this

- **Every profile pins "standard library only"** (issue #10): the go finale "the standard library only (go.mod requires
  nothing; the build runs with GOPROXY=off)", the python finale "standard library only", and the TypeScript guard rejects
  every package import but `node:*` (`decks/tools/guard.mjs`: `package import "<x>" (node:* only)`). A project that needs
  one real library cannot be built: Morph Studio's MCP server would re-implement MCP on the Go standard library. MorphV2
  itself imports one package, `yaml`, allowed by a hand rule of its guard in exactly one file (`YAML_FILE =
  "src/contour/load.ts"`); the record says nothing about it.
- **The record half first, by size and risk.** Issue #10 touches four Components and the templates. Cut whole it is 13+
  cards in five Components (contour, language, planner, builder + builder-go, cli) — beyond the 12-card bound of P15 — and
  the record half must be merged before the second half can be prepared: MorphV2's own `contour.yaml` cannot declare
  `yaml` while the binary that cuts the deck rejects `dependencies` as an unknown key. P19a: **8 cards** (4 code, 4
  judges), 3 Components, no builder change; every dependency-free deck byte for byte (§2.4).
- **Ripple, measured** (the 4 reference code files in a scratch worktree from 44aaf8d, full suite): with the code alone
  **5 of 766** red — record.examples 1, 2, 5 and load.examples 1, 2 (the typed record gains `dependencies: []` and
  `uses: []`, the Component key table names `uses`); with this phase's data (`mini.typed.json`, `badRecord.problems.json`
  updated; the map's validate-record entries lose their P9 acceptance) **2 of 766**: record.examples 5 (a literal in the
  test) and plan.examples 5 (it compares each contour card's acceptance with the map's). Before the code lands, 4 more of
  the same two files plus load.examples 1–2 are red on the data: the three files are excluded deck-wide (§3).
- **Record sizes** (bytes of each Component block, from its `- name:` line to the next): contour 20 178 → **23 606**;
  language 15 621 → **19 178** (the new Function); planner 29 508 → **29 359** (compaction first: 21 examples of Render
  Examples, Render Function, Render Context, Card Budget, Cut Units, Cut Judges, Order Deck moved whole to
  `tests/fixtures/planner/examples.json` by key, values identical; then Cut Component 6–7, Plan Spec 6–7, Plan Spec 1 and
  5 changed).

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main** (module → what the new code calls or constructs): `src/contour/types.ts` — `ContourRecord`,
  `ContourSystem`, `Component` (both gain a field, §2.2); `src/contour/record.ts` — the `RecordWalker` the patch extends
  (`checkKeys`, `readText`, `stringList`, `elementList`); `src/language/types.ts` — `LanguageProfile` (`id`, `finale`);
  `src/language/profiles.ts` — `TYPESCRIPT`, `PYTHON`, `GO`; `src/planner/cut.ts` — `cutComponent` (its last block today
  `profile.finale`); `src/planner/plan.ts` — `planSpec` (the cross-Component slice pass, the spec filter);
  `src/planner/types.ts` — `PlanResult`, `Plan`, `CutCard`.
- **Preconditions of the callees.** contour · Validate Record · every `uses` name is a declared dependency, so the planner
  never meets an undeclared one (a typed record built by hand may: `componentDependencies` simply does not find it).
  planner · Cut Judges · a judge's id is `<code card customId>-judge` and it keeps the override's slice as given — the doc
  is appended to it after the judges are cut (Plan Spec 6: `check-config-judge`). language · Resolve Profile · the
  Component's own `language` is lower-cased ("Go" → go), a dependency's `language` is compared exactly with the profile id.
- **Fixtures** (`tests/fixtures/`), each by the type the Function takes:

| file | type | what it is | what the Function returns on it |
|---|---|---|---|
| `contour/mini.typed.json` (changed) | ONE object, the typed record | `system.dependencies: []` added after `groups`; `uses: []` after `guardrails` in both Components | VR 1, Load Spec 1: equal |
| `contour/badRecord.problems.json` (changed) | an array of 19 lines | line 4's Component table names `uses` after `guardrails` | VR 2, Load Spec 2: equal |
| `contour/deps.json` | ONE object, the record document | 3 Components: conf (typescript, `uses [" zod ", "yaml"]`), diff (go, `[github.com/google/go-cmp]`), plain (`uses []`, no language); 6 dependencies after `groups`: yaml 2.8.1 (doc docs/deps/yaml.md), " zod" "3.23.8 " (no doc), go-cmp v0.7.0 (doc " docs/deps/go-cmp.md "), golang.org/x/mod v0.0.0-20240521000000-abcdef123456, pyyaml 6.0 (python), rc 1.0.0-rc.1+build.5 | VR 7: ok, equal to `deps.typed.json` (names, versions and docs trimmed; zod's doc null; uses `["zod", "yaml"]`, `["github.com/google/go-cmp"]`, `[]`) |
| `contour/badDeps.json` | ONE object | Component a uses `[yaml, zod, yaml, "", 7]`, b uses `"yaml"`; dependencies: `^2.8.1` + unknown key url; pyyaml `latest` without language; yaml again `1.x` with doc ""; the string "left-pad"; one without name; `>=1.0.0 <2` | VR 8: the **15** lines of `badDeps.problems.json`, groups first (5), then dependencies (10) |
| `planner/deps.yaml` | the record TEXT (YAML) | System deps: yaml 2.8.1 typescript (doc docs/deps/yaml.md), github.com/google/go-cmp v0.7.0 go (doc docs/deps/go-cmp.md), zod 3.23.8 typescript (no doc); Components conf (typescript, uses [zod, yaml]: Read Config, Check Config calls Read Config), diff (go, uses go-cmp: Diff Values), plain (typescript: Pad Left), wrong (typescript, uses go-cmp: Mix) | CC 6, 7; PS 6, 7 |
| `planner/deps.map.json` | the map TEXT (JSON) | docs `["docs/TASK.md"]`; one override `check-config` with `context_slice ["docs/X.md"]` | PS 6: check-config's slice `["docs/X.md", "docs/deps/yaml.md"]` |
| `planner/examples.json` | ONE object | `"<Function> <n>"` → `{given, ref?, then}`: 21 planner examples moved out of the record (no new value) | none in this phase |
| `language/finale.go.txt` | text, no final newline | Dependency Finale 3's whole Go text (765 bytes) | DF 3: equal |

- **Harness skeletons** (only `tests/helpers.ts` and the modules named):

```ts
// Cut Component 6-7 / Plan Spec 6-7: const r = loadContour(fixture("planner/deps.yaml"), "deps.yaml"); if (!r.ok) throw …;
//   const m = loadMap(fixture("planner/deps.map.json"), "deps.map.json"); if (!m.ok) throw …;
//   const conf = r.record.system.groups.find((g) => g.name === "conf") as Component;
//   cutComponent({ record: r.record, component: conf, map: m.map, docs: ["docs/TASK.md"], spec: "deps.yaml" })
//   planSpec({ record, map, spec: "deps.yaml", components: ["conf", "diff", "plain"], judge: true, hasFile: () => true })
// Validate Record 7-8: validateRecord(fixtureJson("contour/deps.json")); fixtureJson("contour/badDeps.problems.json")
// Dependency Finale: dependencyFinale(GO, [...]) toBe fixture("language/finale.go.txt")
```

**Distinct markers.** Dependency names yaml, zod, ajv, ajv-formats, pyyaml, github.com/google/go-cmp, golang.org/x/text,
golang.org/x/mod, rc, a, b, q, r, s, m; versions 2.8.1, 3.23.8, 8.17.1, 3.0.1, 6.0.2, 6.0, v0.7.0, v0.21.0, v1.2.3, 1, 2, 3,
4; docs docs/deps/yaml.md, docs/deps/go-cmp.md, docs/deps/ajv.md, d/a.md, x.md, y.md; Components conf, diff, plain, wrong.
The code hard-codes none of them: names, versions, docs and languages are the record's; the clause table, the message
texts and the key tables are the contract.

### 2.2. OUTPUT data shapes

**`src/contour/types.ts`** (PATCH) — two fields and one interface, nothing else changes:

```ts
export interface Dependency { name: string; version: string; language: string; doc: string | null }
export interface Component {
  name: string; description: string; language: string | null;
  requirements: string[]; guardrails: string[]; uses: string[];
  functions: ContourFunction[]; dataObjects: DataObject[]; interfaces: ContourInterface[];
}
export interface ContourSystem {
  name: string; description: string; requirements: string[]; guardrails: string[]; groups: Component[];
  dependencies: Dependency[];
}
```

**`src/contour/record.ts`** (PATCH) — **Validate Record**, additions only (every other table, check, message and order
unchanged):

- `SYSTEM_KEYS` = name, description, requirements, guardrails, groups, **dependencies**; `COMPONENT_KEYS` = name,
  description, language, requirements, guardrails, **uses**, functions, dataObjects, interfaces; NEW `DEPENDENCY_KEYS` =
  name, version, language, doc (required: name, version, language). The unknown-key message lists the table as today.
- `export const EXACT_VERSION = /^v?[0-9]+(\.[0-9]+)*([-+][0-9A-Za-z.+-]+)?$/;`
- **Declared names** are read from the document before the groups are walked: the trimmed `name` of every item of
  `System.dependencies` (when it is a list) that is a plain object with a non-empty string name, distinct, in order.
- **System**: after groups, `dependencies` by the existing `elementList` (not a list → `System.dependencies: must be a
  list`; an item not an object → `System.dependencies[i]: must be an object`). Absent → `[]`.
- **A dependency** (path `System.dependencies[i]`): the existing order — required keys missing, unknown keys, then the
  values in the table's order: name (`readText`; a name already seen in an earlier dependency → `<path>.name: duplicate
  dependency name '<n>'`), version (`readText`, then the trimmed value not matching EXACT_VERSION → `<path>.version: must be
  an exact version (got '<trimmed value>')`), language (`readText`), doc (`readText`, null when absent). Typed `{name,
  version, language, doc}` (a missing text "").
- **A Component's uses** (after guardrails): absent → `[]`; not a list → `<path>.uses: must be a list`; per item in
  order: not a string or blank → `<path>.uses[i]: must be a non-empty string`; its trimmed text not declared →
  `<path>.uses[i]: unknown dependency '<n>' (declared: <declared names joined by ", ">)`, `none` when nothing is
  declared; a name already listed earlier in this uses → `<path>.uses[i]: dependency '<n>' repeated`. Typed: the trimmed
  names in order.
- The planner, not the record, checks that a dependency's language is the Component's (gap below).

| Validate Record example | given | result |
|---|---|---|
| 1, 2 (fixtures changed) | mini.json; badRecord.json | equal to mini.typed.json (dependencies [], uses []); the 19 lines, line 4 with `uses` |
| 5 (changed) | `{System: {name: " s ", description: "d", groups: []}}` | `{ok: true, record: {version: 1, system: {name: "s", description: "d", requirements: [], guardrails: [], groups: [], dependencies: []}, actors: [], requirements: [], guardrails: []}}` |
| 7 | deps.json | `{ok: true, record: deps.typed.json}` |
| 8 | badDeps.json; `{System: {name: "s", description: "d", groups: [{name: "c", description: "C.", uses: ["yaml"], functions: [one valid Function]}]}}`; `{System: {name: "s", description: "d", groups: [], dependencies: {}}}` | the 15 lines of badDeps.problems.json, first `System.groups[0].uses[1]: unknown dependency 'zod' (declared: yaml, pyyaml, ok)`, last `System.dependencies[5].version: must be an exact version (got '>=1.0.0 <2')`; `["System.groups[0].uses[0]: unknown dependency 'yaml' (declared: none)"]`; `["System.dependencies: must be a list"]` |

**`src/language/dependencyFinale.ts`** (NEW; layer language; imports only types from `./types.js`):

```ts
export interface FinaleDependency { name: string; version: string; doc: string | null }
export interface StdlibClause { clause: string; replacement: string }
export const STDLIB_CLAUSES: Readonly<Record<string, StdlibClause>>;   // exactly python and go, below
export function dependencyDirective(deps: readonly FinaleDependency[]): string;
export function dependencyFinale(profile: LanguageProfile, deps: readonly FinaleDependency[]): string;
```

- `STDLIB_CLAUSES` = `{python: {clause: "standard library only, ", replacement: ""}, go: {clause: "the standard library
  only (go.mod requires nothing; the build runs with GOPROXY=off)", replacement: "the standard library and the modules
  named at the end (go.mod requires them; the build runs with GOPROXY=off)"}}`; typescript has none (its finale names no
  library rule).
- `dependencyDirective(deps)` = `"the standard library plus "` + each `<name>@<version>` joined by `", "`, then `"; their
  API is in "` + the docs that are not null, distinct, first place kept, joined by `", "` (left out when there is none),
  then `"; no other import"`. The deps in the order given; nothing sorted.
- `dependencyFinale(profile, deps)`: deps empty → `profile.finale` itself. Else: the finale with the FIRST occurrence of
  its profile's clause (by `profile.id`) replaced, the replacement taken literally, no clause → unchanged; then `"
  Imports: " + dependencyDirective(deps) + "."` appended.

| Dependency Finale example | given | result |
|---|---|---|
| 1 | TYPESCRIPT, PYTHON, GO; `[]` | each profile's finale, the same string |
| 2 | TYPESCRIPT; zod 3.23.8 (no doc), ajv 8.17.1 (docs/deps/ajv.md), ajv-formats 3.0.1 (docs/deps/ajv.md) | TYPESCRIPT.finale + `" Imports: the standard library plus zod@3.23.8, ajv@8.17.1, ajv-formats@3.0.1; their API is in docs/deps/ajv.md; no other import."` |
| 3 | GO; github.com/google/go-cmp v0.7.0 (docs/deps/go-cmp.md), golang.org/x/text v0.21.0 (no doc) | exactly `language/finale.go.txt`: begins `Go 1.22, the standard library and the modules named at the end (go.mod requires them; the build runs with GOPROXY=off). gofmt-formatted`, ends `Imports: the standard library plus github.com/google/go-cmp@v0.7.0, golang.org/x/text@v0.21.0; their API is in docs/deps/go-cmp.md; no other import.` |
| 4 | PYTHON; pyyaml 6.0.2 (no doc); then dependencyDirective of a 1 (d/a.md) | `"Python 3.10 or later, type hints on every public function. Tests are pytest: plain `assert` on scalars and short values; fixtures and stubs come from `tests/conftest.py`, never your own. Imports: the standard library plus pyyaml@6.0.2; no other import."`; `"the standard library plus a@1; their API is in d/a.md; no other import"` |

**`src/planner/cut.ts`** (PATCH) — **Cut Component**, additions only:

```ts
export function componentDependencies(record: ContourRecord, component: Component): Dependency[];
```

- `componentDependencies` = `record.system.dependencies` filtered to the names `component.uses` holds, in **record**
  order (not uses order).
- In `cutComponent`, right after the profile is resolved (before Function Links): the first of the Component's
  dependencies whose `language` is not exactly `profile.id` → `{ok: false, error: "Component '<component name>' uses
  '<dep name>', a <dep language> dependency (the Component is <profile id>)"}`.
- The last block of every code card's instruction is `dependencyFinale(profile, componentDependencies(record,
  component))` (an Interface card of the Component too); with none it is `profile.finale`, so every dependency-free
  instruction is byte for byte what it was.

| Cut Component example | given | result |
|---|---|---|
| 6 | deps record and map, docs `["docs/TASK.md"]`, spec `deps.yaml`; conf, diff, plain | conf: read-config, check-config end `"\n\n" + TYPESCRIPT.finale + " Imports: the standard library plus yaml@2.8.1, zod@3.23.8; their API is in docs/deps/yaml.md; no other import."`; diff-values ends `…no goroutine left running. Imports: the standard library plus github.com/google/go-cmp@v0.7.0; their API is in docs/deps/go-cmp.md; no other import.` and holds `Go 1.22, the standard library and the modules named at the end (go.mod requires them;`; pad-left ends `"\n\n" + TYPESCRIPT.finale`; componentDependencies(plain) `[]` |
| 7 | Component wrong | `{ok: false, error: "Component 'wrong' uses 'github.com/google/go-cmp', a go dependency (the Component is typescript)"}` |

**`src/planner/types.ts`, `src/planner/plan.ts`** (PATCH) — **Plan Spec**, additions only:

```ts
export type PlanResult = { ok: true; plan: Plan; uses: Record<string, string[]> } | { ok: false; error: string };
```

- `Plan` keeps its five keys (spec, components, cards, generations, externalDependsOn): the plan document of `morph plan`
  and every deck it writes are unchanged; `uses` rides beside `plan` for the builder of P19b.
- **The doc check**: per selected Component, right after its Cut Component succeeded, its dependencies
  (componentDependencies, record order): the first whose `doc` is not null and `hasFile(doc)` is false → `{ok: false,
  error: "dependency '<name>' of Component '<component name>': doc file not found: <doc>"}`.
- **The docs in the slices and uses**: after the judges are appended, before the spec is dropped from the slices: for every
  card Cut Component made (not the extra cards) whose Component has dependencies, in card order: `uses[customId]` = their
  names (record order); their docs (not null, distinct, record order) appended — each when absent — to that card's
  `contextSlice` and to the slice of the card whose id is `<customId>-judge`, when there is one, **also when the map set
  the slice**, as a NEW list (`card.contextSlice = [...card.contextSlice, ...missing]`): a slice the map set is the map's own
  array (Cut Component and Cut Judges take it by reference), and pushing into it would change the map for every later
  call (the reference's first draft did; the probe's last row holds it). No dependency anywhere → `uses` is `{}`.

| Plan Spec example | given | result |
|---|---|---|
| 1 (changed) | the ledger record and map (no dependency) | the whole plan equals ledger.plan.json (unchanged); `uses` `{}` |
| 5 (changed) | this repository's record and map, components contour | generations unchanged; each card whose map entry sets an acceptance (not null) carries exactly it — validate-record and validate-record-judge have none since P19a |
| 6 | deps record and map, components conf, diff, plain, judge true, hasFile always true | slices: read-config `["docs/TASK.md", "docs/deps/yaml.md"]`, check-config `["docs/X.md", "docs/deps/yaml.md"]`, read-config-judge `["docs/TASK.md", "src/conf/readConfig.ts", "tests/helpers.ts", "docs/deps/yaml.md"]`, check-config-judge `["docs/TASK.md", "src/conf/checkConfig.ts", "tests/helpers.ts", "docs/deps/yaml.md"]`, diff-values `["docs/TASK.md", "docs/deps/go-cmp.md"]`, diff-values-judge `["docs/TASK.md", "diff/diff_values.go", "internal/testhelp/testhelp.go", "docs/deps/go-cmp.md"]`, pad-left `["docs/TASK.md"]`, pad-left-judge `["docs/TASK.md", "src/plain/padLeft.ts", "tests/helpers.ts"]`; uses `{"read-config": ["yaml", "zod"], "check-config": ["yaml", "zod"], "diff-values": ["github.com/google/go-cmp"]}`; generations `[["diff-values", "pad-left", "read-config"], ["check-config", "diff-values-judge", "pad-left-judge", "read-config-judge"], ["check-config-judge"]]` |
| 7 | conf, diff, judge false, hasFile false only for docs/deps/go-cmp.md; conf, hasFile always false; plain, judge true, hasFile always false | `dependency 'github.com/google/go-cmp' of Component 'diff': doc file not found: docs/deps/go-cmp.md`; `dependency 'yaml' of Component 'conf': doc file not found: docs/deps/yaml.md` (zod has no doc); ok with uses `{}` |

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P19 deps"; #10 = issue VasyaLutiy/morph#10):

- **Split (#10)** · P19a = record (contour, language, planner), P19b = enforcement (builder, builder-go, cli wiring),
  templates and regulation, MorphV2's `yaml` declared, both smokes · 13+ cards in five Components whole; MorphV2's own
  record cannot use the new keys until the binary that cuts accepts them.
- **Key places** · `dependencies` after `groups` in System's table, `uses` after `guardrails` in Component's (so a
  Component's problems keep their order before functions) · a known-key message lists the table in order; the record
  author writes dependencies last.
- **Exact version** · `^v?[0-9]+(\.[0-9]+)*([-+][0-9A-Za-z.+-]+)?$` on the trimmed text: npm `2.8.1`, Go `v0.7.0` and
  pseudo-versions, PEP 440 `6.0`, pre-release/build suffixes pass; `^ ~ > < = * x`, spaces, `latest` fail · issue #10
  "versions are exact (no ranges)"; one rule for three ecosystems. A YAML author quotes versions (`"6.0"` unquoted is a
  number: "must be a non-empty string").
- **Where the language is checked** · the record checks that a uses name is declared; the planner checks the language
  (exactly the resolved profile id) · a Component's language may come from the map (Resolve Profile), which the record does
  not see.
- **Duplicate names** · a name declared twice is a fault whatever the languages · the guard of P19b allows by name.
- **Record order** · the finale, the docs and `uses` list dependencies in System.dependencies order, never uses order ·
  issue #10 "deterministic and in record order"; reordering `uses` changes no byte.
- **The finale text** · no dependency → the profile's finale itself; else the profile's "standard library only" clause
  (python, go) replaced and `" Imports: the standard library plus <name>@<version>, …; their API is in <docs>; no other
  import."` appended; typescript has no clause · issue #10's text; Go keeps GOPROXY=off in the sentence.
- **Docs in the slice** · appended at the end of every code card's and its judge's slice, also over a map slice; extra
  cards get none; a doc equal to the spec is dropped like the spec · issue #10 "every card of a Component that uses it";
  an extra card's slice is the map's verbatim.
- **A missing doc** · checked per selected Component right after its cut (first missing, record order), so a Component's
  own fault (language) comes first · issue #10 "a plan fault naming the dependency".
- **uses beside plan** · `PlanResult` ok gains `uses` (code cards only, non-empty only); `Plan` unchanged · the plan
  document (cli) and the decks stay byte-identical; judges keep their import rules (P19b's guard reads `uses`).
- **Plan Spec 5** · the map's validate-record entries lose their P9 acceptance (the cards are rebuilt by `--checks`);
  the example compares only acceptances the map sets · the example's point is the P9 deck shape, kept.
- **Record size** · 21 planner examples moved to `tests/fixtures/planner/examples.json` by key, values identical: planner
  29 508 → 29 359 with the P19 text (31 005 without the move).

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/contour/types.ts`, `record.ts` | PATCH | probe only | PATCH `tests/contour/record.examples.test.ts` (VR 5 changed, 7, 8 added) |
| `src/language/dependencyFinale.ts` | NEW | probe only | NEW `tests/language/dependencyFinale.examples.test.ts` (DF 1–4) |
| `src/planner/cut.ts` | PATCH | probe only | NEW `tests/planner/cut.p19.examples.test.ts` (CC 6, 7) |
| `src/planner/types.ts`, `plan.ts` | PATCH | probe only | PATCH `tests/planner/plan.examples.test.ts` (PS 1, 5 changed, 6, 7 added) |

- `record.examples` (patched): example 5's system gains `dependencies: []`; "Validate Record example 7: …" and "8: …"
  appended, documents from fixtures, problem lists compared whole; every other test and line unchanged.
- `dependencyFinale.examples`: "Dependency Finale example 1: …" … "4: …"; texts with toBe, the profiles' own finales
  taken from the profile objects.
- `cut.p19.examples`: "Cut Component example 6: …", "7: …"; the skeleton of §2.1.
- `plan.examples` (patched): example 1 adds `expect(r.uses).toStrictEqual({})`; example 5 compares an acceptance only when
  the map entry's is not null; "Plan Spec example 6: …", "7: …" appended, slices and uses literal; every other test and
  line unchanged.

### 2.4. What must not break

- Byte for byte: every file outside the 6 code targets and the 4 test files of §2.3 — every other `src/` file,
  `tests/helpers.ts`; `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/`, `templates/` — untouched by
  every card (frozen).
- **Dependency-free decks byte-identical**: the cut of `tests/fixtures/go-mini` (Plan Command 9's `cli/goMini.deck.json`
  stays green) and the P15 deck re-cut, by main's binary and by this phase's reference binary on the same tree (§11).
- 766 tests in 119 files: 730 green at every card (record.examples 14, load.examples 11, plan.examples 11 excluded
  deck-wide, §3); after the run **766 + VR 2 + DF 4 + CC 2 + PS 2 = 776** in 121 files.

## 3. Acceptance

Built by `morph plan --checks decks/p19a/checks.json`, narrow to broad, every stage printing `== <stage>`. `ownGit: true`
(the full suite spawns git in its tmpRepos), `frozen` the defaults (+ `templates` is not needed: no template changes),
`fullExclude` `tests/contour/record.examples.test.ts`, `tests/contour/load.examples.test.ts`,
`tests/planner/plan.examples.test.ts` (the ripple of §1).

Code cards (no test file; code-only targets, `intent: generate` for the new file): `probe/<card>/` → `tsc` (per-card
tsconfig excluding the generation's other targets) → `eslint <targets>` → `guard.mjs src <targets>` → the probe
`decks/p19a/parts/<card>.probe.ts` (validate-record VR 1, 2, 5, 7, 8 + 3 rows = 8; dependency-finale DF 1–4 + 1 row = 5;
cut-component CC 1, 6, 7 + 1 row = 4; plan-spec PS 1, 6, 7 + 1 row = 4; **21 tests**) → eslint's verdict → full `vitest
run` → own git → frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs tests <file> <min> <max> lits<n>.json` (+ the names
kept for a patched file) → `vitest run <targets>` → eslint's verdict → full run → own git → frozen → untracked.

| file | new | min | max | lits |
|---|---|---|---|---|
| `tests/contour/record.examples.test.ts` | no | 16 | 18 | `Validate Record example 7`, `… 8`, `contour/deps.json`, `contour/deps.typed.json`, `contour/badDeps.json`, `contour/badDeps.problems.json`, `unknown dependency 'yaml' (declared: none)`, `System.dependencies: must be a list` |
| `tests/language/dependencyFinale.examples.test.ts` | yes | 4 | 10 | `Dependency Finale example 1` … `4`, `language/finale.go.txt`, `zod@3.23.8, ajv@8.17.1, ajv-formats@3.0.1; their API is in docs/deps/ajv.md; no other import.`, `Imports: the standard library plus pyyaml@6.0.2; no other import.`, `the standard library plus a@1; their API is in d/a.md; no other import` |
| `tests/planner/cut.p19.examples.test.ts` | yes | 2 | 8 | `Cut Component example 6`, `… 7`, `planner/deps.yaml`, `planner/deps.map.json`, `Imports: the standard library plus yaml@2.8.1, zod@3.23.8; their API is in docs/deps/yaml.md; no other import.`, `github.com/google/go-cmp@v0.7.0; their API is in docs/deps/go-cmp.md; no other import.`, `Component 'wrong' uses 'github.com/google/go-cmp', a go dependency (the Component is typescript)` |
| `tests/planner/plan.examples.test.ts` | no | 13 | 15 | `Plan Spec example 6`, `… 7`, `planner/deps.yaml`, `planner/deps.map.json`, `internal/testhelp/testhelp.go`, `dependency 'github.com/google/go-cmp' of Component 'diff': doc file not found: docs/deps/go-cmp.md`, `dependency 'yaml' of Component 'conf': doc file not found: docs/deps/yaml.md` |

min = the file's tests + the new examples (record 14 + 2, plan 11 + 2) or the record's examples (new files); max = min +
2 (patched) or + 6 (new).

**Output budget** (`max_tokens`, before the session's ×3 for `ds`):

| card | returns | `max_tokens` |
|---|---|---|
| validate-record | types.ts + record.ts ≈ 19 KB, two whole files | 28 000 |
| dependency-finale | dependencyFinale.ts ≈ 1.6 KB (reference 1.5 KB) | 12 000 |
| cut-component | cut.ts ≈ 8.9 KB whole | 16 000 |
| plan-spec | types.ts + plan.ts ≈ 8 KB whole | 16 000 |
| validate-record-judge | the whole patched file ≈ 8 KB | 20 000 |
| dependency-finale-judge | ≈ 3 KB new file | 16 000 |
| cut-component-judge | ≈ 3 KB new file | 16 000 |
| plan-spec-judge | the whole patched file ≈ 12 KB | 24 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- **Layers** (guard, unchanged): contour imports cards only and no Node module; language imports cards only, node:path at
  most (dependencyFinale imports only types from `./types.js`); planner imports cards, contour, language and node:path. No
  clock, no environment, no file system in any of the three.
- A file a card writes is in no sibling's slice in the same generation: generation 0 [dependency-finale, validate-record]
  reads no P19a file; generation 1 [cut-component, dependency-finale-judge, validate-record-judge] reads generation 0's
  files; generation 2 [cut-component-judge, plan-spec] read cut.ts (generation 1), not each other's target; generation 3
  [plan-spec-judge] reads plan.ts and types.ts.
- Tests write nothing (the planner and the record are pure); no JS timer; no network; a judge writes only its targets.

## 7. Out of scope — P19b holds exactly this

P19b (queued after P19a's merge by `~/.morph-phase-done`; prepared by a fresh session from the merged binary):

1. **builder** (Component builder + builder-go): `BuildInput` gains the per-card allowed names (`PlanResult.uses`) and
   whether `vendor/modules.txt` exists; the TypeScript code acceptance passes a card's allowed packages to the guard only
   when the list is not empty (a dependency-free acceptance byte for byte as today), the guard allowing exactly those
   packages in that card's `src` files and keeping `node:*` only elsewhere; the Go guard (`go list -deps`) the declared
   module paths (a path or a path + "/…") per card; `GO_ENV` with `GOFLAGS=-mod=vendor` exactly when
   `vendor/modules.txt` exists at plan time, else today's `-mod=mod` line byte for byte; `GOPROXY=off` always. Python: the
   directive only (no builder).
2. **cli**: Plan Command passes `planned.uses` and `hasFile("vendor/modules.txt")` to Build Acceptances.
3. **guard data**: `decks/tools/goguard.mjs`, `templates/{typescript,go}/decks/tools/guard.mjs` read the allowed list the
   builder passes; MorphV2's `decks/tools/guard.mjs` keeps its one-file `yaml` rule.
4. **MorphV2's own `yaml`**: `contour.yaml` declares `{name: yaml, version: <package-lock's exact>, language: typescript,
   doc: docs/deps/yaml.md}` and Component contour `uses: [yaml]`; `docs/deps/yaml.md` (2–5 KB digest).
5. **templates/common** docs (AUTONOMY, TASK_TEMPLATE, PLAN template): the architect declares dependencies, the operator
   approves them with the plan, P0 installs them once with the network (Go `go mod vendor` + commit `vendor/`; TypeScript
   manifest + lockfile + `npm ci`; Python venv + pinned requirements), every acceptance after P0 offline; the 2–5 KB API
   digest rule (signatures + one example, from the library's own docs).
6. **Issue #10's smokes** (`decks/p19b/smoke/`, run by the main session after P19b's merge): Go live on ds with one
   small vendored module, `GOPROXY=off`, no network, and an undeclared import rejected by the guard; TypeScript with one
   npm package up to plan --checks + deck check + a stub run. Then 🧪 and the stop for the operator.

Also out: a dependency's transitive imports (the guard reads direct imports), version resolution or download by Morph,
dependency checks of a Component's language set by the map in Validate Record.

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component contour --component language \
  --component planner --judge --checks decks/p19a/checks.json --out decks/p19a/deck.json
python3 decks/p19a/filter.py decks/p19a/deck.json                 # keeps the 8 cards of the phase
python3 decks/tools/scale_tokens.py decks/p19a/deck.json 3        # processor ds
node dist/cli.js deck check --root . --deck decks/p19a/deck.json                                  # errors 0
rm -rf /tmp/v2bin-p19a && mkdir -p /tmp/v2bin-p19a && cp -r dist /tmp/v2bin-p19a/ && ln -s $PWD/node_modules /tmp/v2bin-p19a/node_modules \
  && ln -s $PWD/templates /tmp/v2bin-p19a/templates
node /tmp/v2bin-p19a/dist/cli.js run --root . --deck decks/p19a/deck.json --processor ds --deadline 2400
```

No mrph cross-check (operator 08.10). The `templates` link is the P18 recipe (the run never calls `init`).

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 8 (4 code, 4 judges) / 4: [dependency-finale, validate-record] [cut-component, dependency-finale-judge, validate-record-judge] [cut-component-judge, plan-spec] [plan-spec-judge] |
| executor bill | ≈ $0.10–0.25 on ds ×3 (P17: 7 cards $0.2032; P18: 5 cards $0.1054); ≤ $0.40 with a re-cut; cap $5 |
| cards with regeneration | 1–2 of 8 (validate-record: two whole files, the declared names read before the groups; plan-spec: the judge's slice also over a map slice) |
| tests after the run | 776 ± 8 in 121 files |
| first red | validate-record: the version checked before trimming, or uses checked against the validated (later) list; dependency-finale: the clause replaced in every profile or the docs not distinct; cut-component: uses order instead of record order; plan-spec: the doc skipped on a map slice |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no answer cut at its `max_tokens`; (3) after the run no
file outside §2.3's ten changed; (4) dependencyFinale.ts imports nothing but types; (5) this repository's HEAD and refs
unchanged by every card; (6) after the merge the go-mini cut and the P15 re-cut are byte for byte main's.

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the MEASURE row with
its `прогоны` cell, the vitest log of every verify run; DECISIONS lines "P19 deps"; the byte-identity re-cuts after the
merge (cmp of go-mini and P15 against the pre-P19 binary).

## 11. Actual

### Gate (preparation)

08.10, on the VPS, by the preparing orchestrator (Opus 5.5, fresh context, no sub-agents); no paid run, no model call.
One data commit (spec, record, map, fixtures, checks, probes, filter, deck, DECISIONS). Component sizes: contour 20 178 →
**23 606**, language 15 621 → **19 178**, planner 29 508 → **29 359** (compacted first). Issues: #10 only (`P19-deps`).
**Split**: P19a here (8 cards), P19b = §7.

The deck **cut by V2** (main's binary, 44aaf8d): `plan --component contour --component language --component planner
--judge --checks decks/p19a/checks.json` **exit 0**, 26 cards, `decks/p19a/filter.py` keeps 8; `scale_tokens.py … 3`
(maxTokens: dependency-finale 36 000, validate-record 84 000, cut-component 48 000, plan-spec 48 000, dependency-finale-judge
48 000, validate-record-judge 60 000, cut-component-judge 48 000, plan-spec-judge 72 000); `deck check` **0 errors, 0
warnings**, no hazards; generations `[dependency-finale, validate-record] [cut-component, dependency-finale-judge,
validate-record-judge] [cut-component-judge, plan-spec] [plan-spec-judge]`. Slices (deck check, slice + existing
targets, with this spec at its final size): 48.4–71.4 KB, the largest validate-record-judge **71 399 B**. No mrph cross-check (operator 08.10).

Scratch worktrees from 44aaf8d + this phase's data (removed afterwards; no watcher or worker left), the deck's own
acceptances, cards in deck order, each accepted reference committed before the next:
- **Stubs, red per example at the probe (21/21):** typed throwing stubs (`Error: stub validateRecord [{"System":…}]`,
  `stub dependencyFinale ["go",[{"name":"github.com/google/go-cmp",…}]]`, `stub cutComponent [{"record":…}]`, `stub
  componentDependencies …`, `stub planSpec [{"record":…}]`; `EXACT_VERSION` stubbed to `/^stub$/`: `expected [ [ '1', false
  ], …] to strictly equal [ [ '1', true ], …]`; the clause table `expected {} to strictly equal { python: …, go: … }`):
  validate-record 8/8, dependency-finale 5/5, cut-component 4/4, plan-spec 4/4.
- **Judges before their file:** red at the guard (2 new files `… missing`; the two patched files at their old text:
  `… does not mention the example literal "Validate Record example 7"` …, `11 test/it calls, expected 13..15`).
- **References green, chain seconds** (limit 250; the machine shared with another session's replay): dependency-finale
  101.4, validate-record 69.2, cut-component 64.9, dependency-finale-judge 92.8, validate-record-judge 87.7, plan-spec 71.5
  (97.1 with the final probe), cut-component-judge 106.4, plan-spec-judge 116.7 — **max 116.7 s**. Final tree: `tsc`,
  `eslint src tests` clean, `vitest run` **776 / 776 in 121 files** (766 + the reference judges' 2 + 4 + 2 + 2); `git
  status` clean. Ripple 2 of 766 with the data (record.examples 5, plan.examples 5; both files excluded).
- **Mutants** (the changed contracts only: Validate Record's dependency and uses rules, Dependency Finale, the Cut
  Component and Plan Spec additions), each under a 120 s subprocess timeout against its probe: **30 mutants, 31 runs, 0.9
  min, max 2.7 s, 0 timeouts**; 29 killed at once; 1 survivor closed by data (plan.ts without the docs made distinct: a
  probe row with two dependencies sharing one doc now kills it). The reference's first draft pushed a doc into the map's own
  slice array; a probe row now checks the map unchanged and the push-in-place mutant is killed. No known risk left.
- **Byte identity of dependency-free decks** (main's binary 44aaf8d vs the P19a reference binary, same trees): go-mini cut
  with `--checks decks/m1/checks.json` (goguard/gofirstdiff installed) **identical** (6 cards, 65 750 B; plan documents
  identical); the P15 deck re-cut from its own tree 0365336 (plan, filter, ×3) **identical** (12 cards, 398 622 B) and
  identical to the deck committed there; the plan documents equal but for the `out` path given. Today's tree no longer
  re-cuts P15's card set (primer-command-judge moved to p16 in P16; cut-component-judge to cut.p19 here), hence its own
  tree. Plan Command 9 (`cli/goMini.deck.json`) green in the final suite.

**Forecast** on `ds` with every maxTokens × 3: P17 ran 7 cards (a two-file patch, a whole-file judge, 2 new files) for
$0.2032, P18 5 cards for $0.1054; here 12 first requests (4 code × 2 variants + 4 judges), 48–71 KB in, answers 1.5–19 KB:
**≈ $0.12–0.25**, ≤ $0.40 with a re-cut; ≤ $1. **Gate holds.**

**Run command** (from the repo root, the binary copied first; the deck is already scaled ×3):

```
npm run build && rm -rf /tmp/v2bin-p19a && mkdir -p /tmp/v2bin-p19a && cp -r dist /tmp/v2bin-p19a/ && ln -s $PWD/node_modules /tmp/v2bin-p19a/node_modules && ln -s $PWD/templates /tmp/v2bin-p19a/templates
node /tmp/v2bin-p19a/dist/cli.js run --root . --deck decks/p19a/deck.json --processor ds --deadline 2400 > /tmp/p19a-run.json
```

After the merge: P19b is queued (`~/.morph-phase-done`), prepared by a fresh session from the merged binary (§7); issue
#10's smokes belong to P19b.

### Run

08.10, main session on the VPS. Binary copy `/tmp/v2bin-p19a` (`node_modules` and `templates` linked beside its dist/),
processor `ds`, run **20261008-141116**, exit 0, **1082 s**: 8 / 8 written, 13 requests, 267 753 in / 98 673 out tokens,
**$0.0935** (usageTotals.cost 0.09350883). First attempts: dependency-finale, validate-record, cut-component, plan-spec v1
accepted (their v2 answered or untried, not needed), validate-record-judge, cut-component-judge, plan-spec-judge v1.
One retry won: dependency-finale-judge v1 red at `tsc` (no `import { test, expect } from "vitest"`: TS2593/TS2304), r1.v1
accepted. No fix, no truncation.

Verify on `morph/20261008-141116`: `git status --short` empty; `tsc --noEmit`, `eslint src tests` clean; `vitest run`
**776 / 776 in 121 files** (the three deck-wide exclusions green again); `npm run build` green. Own read against §2.2 and
the record: `record.ts` accepts `System.dependencies` (keys name/version/language/doc, exact-version regex, duplicate
names) and `Component.uses` (a list, non-empty strings, declared names only, "declared: none" when nothing is declared,
repeats refused), reading the declared names before walking groups so `uses` resolves whatever the key order;
`dependencyFinale` returns `profile.finale` untouched for no dependency, else swaps the Go/Python stdlib clause and appends
" Imports: the standard library plus name@version, …; their API is in <docs, deduplicated>; no other import." in record
order; `cutComponent` refuses a dependency of another language before anything else and uses the new finale;
`planSpec` faults a missing doc naming the dependency and Component, appends used docs to the code card's and its judge's
slice as NEW lists (no in-place push into the map), and returns `uses` beside an unchanged `Plan`. No defect found.

**Byte identity after the merge** (§10): the merged binary vs the pre-P19 binary (44aaf8d, built in a scratch worktree):
go-mini cut with `--checks decks/m1/checks.json` (goguard/gofirstdiff installed) **identical**, 65 750 B; the P15 deck
re-cut in its own tree 0365336 (plan, filter, ×3) **identical**, 398 622 B, and equal to the deck committed there.

P19b (§7: builder/builder-go guards and `-mod=vendor`, cli wiring, MorphV2's `yaml` declared, templates docs, issue #10's
two smokes) is queued for a fresh session.
