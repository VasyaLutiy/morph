# TASK_P31a — issues #42 and #46: canonical Guardrails become guard rules; the guard's contract line is the switch (`src/language/guardrails.ts`, `src/rules/guardrails.ts`, `src/builder/{types,buildAcceptances,compose,goAcceptance}.ts`, `src/cli/planCommand.ts`)

Old-Morph scheme (Morph-Orchestrator v1, `mrph/cards/plan_spec_guards.py`: a Guardrail NAME → a guard line, an unknown
name stays prose). Plan: `docs/Plan_Epic2_Fixes.md` §1, §P31a, §6. Record: Component **language** (new Function
Canonical Guardrail); Component **rules** (new Functions Guardrail Rules, Card Rules, Rules Arg, Guard Contract, Plan
Rules; Data Objects Guardrail Rules Result, Plan Rules Result; Layers Arg's guard text and examples 2–3); builder (Build
Acceptances example 12, Code Acceptance example 5, Card Context `rules?`); builder-go (Go Acceptance example 9); cli
(Plan Command example 19). Cut with `--only` (the Components hold other Functions): the deck is a transaction. The
template guards (contract 3) and the template `layers.json` files are data of this phase's data commit.

## 1. Why this

- The record's Guardrails reach the model only as prose (`src/planner/render.ts`); the machine rules live beside the
  record (`layers.json` `pure`/`entry`, `checks.json` `imports` extras, MorphStudio's hand `stdlib_rules` note and its
  `gofmt -r` extras in `decks/P8b/checks.json`). Operator 11.10: a rule the acceptance enforces comes from the record,
  never from a hand copy beside it. Parity with old mrph = the same logic (a small table of exact names), not bytes.
- Issue #46 (beta tester, MorphStudio d92a8b3, $0): with `decks/tools/layers.json` deleted, `plan --checks` stops
  passing the record's edges, and the contract-2 guard with no argument and no file allows every import — the layer
  check is silently off. Both halves are fixed here: the plan side keys on the guard's `morph-guard-contract: <n>` line
  (#42 ledger item 1), the guard side fails closed.
- Measured 11.10 (spikes in `/tmp`, outputs quoted in the record's Rules Arg examples 2–5): the contract-3 guards give
  per-file, per-line reds naming the Guardrail and where it is attached; the old file-driven guard (P30's template,
  kept byte for byte as `tests/fixtures/rules/guard2/<language>.guard.txt`) and the new record-driven one give the same
  red/green per file on `tests/fixtures/rules/parity/trees.json` (go 0,1,1,0; typescript 0,1,1,1,0,0).

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main**: `src/contour/types.ts` — `ContourRecord` (`record.system.{name, guardrails: string[], groups}`;
  a Component `{name, language, guardrails: string[], functions, interfaces: ContourInterface[]}`; a Function
  `{name, guardrails: string[], steps}`; `ContourInterface {name, exposes: string[], guardrails?: string[]}`),
  `ContourMap` (`language`, `groups: {name, functions}[]`, `cards: {id, targets: string[] | null}[]`);
  `src/language/types.ts` — `LanguageProfile` (`id: ProfileId`), `ProfileId = "typescript" | "python" | "go"`;
  `src/language/profiles.ts` — `resolveProfile`, `TYPESCRIPT`, `PYTHON`, `GO`; `src/language/naming.ts` — `cutTargets`,
  `slugName`; `src/language/paths.ts` — `codeTargets`; `src/rules/layers.ts` — `GUARD_CONTRACT`, `layerEdges`,
  `cardLayers`, `layersArg`, `planLayers` (P30; unchanged by this phase: Plan Rules calls Plan Layers);
  `src/builder/types.ts` — `CardContext`, `BuildInput` (P30 `layers?` last); `src/cli/planCommand.ts` — `EMPTY_MAP`.
- **Fixtures** (all committed in the data commit):

| file | type | what it gives |
|---|---|---|
| `tests/fixtures/rules/parity/go/contour.yaml`, `morph-map.json` | record (calc, clock, shell Pure; app none), map (go) | Guardrail Rules 1; Layer Edges `{"app": [], "calc": [], "clock": [], "shell": []}` |
| `tests/fixtures/rules/parity/typescript/contour.yaml`, `morph-map.json` | record (core, clock, net Pure; app, util No Process; main uses app), map | Guardrail Rules 2; Layer Edges `{"src/app": [], …, "src/main": ["src/app"], …}` |
| `tests/fixtures/rules/parity/trees.json` | `{"go": {path: text}, "typescript": {path: text}}`, each with its old `decks/tools/layers.json` | Rules Arg 4 (ledger item 2) |
| `tests/fixtures/rules/guard2/go.guard.txt`, `typescript.guard.txt` | P30's contract-2 template guards, byte for byte (`.txt`: eslint lints `.mjs` under tests/) | the old file-driven guard of Rules Arg 4 |
| `tests/fixtures/rules/guarded.yaml` | record text (System, Component, Function, Interface guardrails; ts + go) | Guardrail Rules 3, with `EMPTY_MAP` |
| `tests/fixtures/rules/badLanguage.yaml` | record text (Component language cobol) | Guardrail Rules 4 |
| `tests/fixtures/rules/issue46/contour.yaml`, `morph-map.json`, `tree.json` | #46's negative case: daemon imports runner, no `uses: runner`; `tree.json` `{"tree": {path: text}, "layersJson": {"with layers": text, "layers key removed": text}}` | Plan Rules 3, Rules Arg 5 |
| `tests/fixtures/cli/goMiniGuarded.yaml`, `goMiniGuarded.deck.json` | go-mini's record + System [No Shell, Frozen Tree During Run], calc [Pure]; its cut with guard `"// guard\n"` (measured with the binary at 3407569) | Plan Command 19 |
| `tests/fixtures/builder/examples.json` `"Build Acceptances 12"`, `"Code Acceptance 5"` (and 2, 3, 5, 6 moved there verbatim from the record: a compaction, no test reads them) | given/then texts | §2.2 |
| `tests/fixtures/cli/examples.json` `"Plan Command 19"` | given/then texts | §2.2 |
| `tests/fixtures/rules/examples.json` `"Guardrail Rules 2"`, `"Guardrail Rules 3"`, `"Rules Arg 2"`–`"Rules Arg 5"`, `"Plan Rules 3"` | given/then texts (moved out of the record: rules would be 34 KB, now 26.8 KB) | §2.2 |

- **Harnesses (verbatim; the judges build from them).**
  - Records: `const R = loadContour(fixture("rules/guarded.yaml"), "guarded.yaml"); if (!R.ok) throw new Error("fixture");`
    and for a directory fixture `loadMap(fixture("rules/parity/go/morph-map.json"), "morph-map.json")` the same way
    (`if (!M.ok) …`); the ts-rename record as in `tests/rules/layers.examples.test.ts` (`fixtureJson("ts-rename.json")`).
  - Guards (Rules Arg 2–5), as `tests/rules/layers.examples.test.ts`:
    `const ROOT = path.resolve(fixturePath("."), "..", "..");`
    `const GUARD = (lang: string): string => path.join(ROOT, "templates", lang, "decks", "tools", "guard.mjs");`
    `const ENV = { ...process.env, GOFLAGS: "-mod=mod", GOPROXY: "off", GOTOOLCHAIN: "local", GOWORK: "off" };`
    `spawnSync("node", [GUARD(lang), ...args], { cwd, encoding: "utf8", env: ENV })` → `{status, stdout}`; trees written
    with `tmpRoot().write(path, text)`. Rules Arg 4's old guard: `r.write("old-guard.mjs", fixture("rules/guard2/" + lang +
    ".guard.txt"))` and `fs.symlinkSync(path.join(ROOT, "node_modules"), r.path("node_modules"))` (the TypeScript guard
    imports `typescript`), run `["src", file]` from the root; the new one `["src", file, "", JSON.stringify(edges),
    JSON.stringify(rules)]` with `edges` = `layerEdges(R, M)` and `rules` = `guardrailRules(R, M)` of the parity record.
  - Plan Command 19: the go-mini root of `tests/cli/planCommand.p30.examples.test.ts` (its `MINI` list from
    `fixture("go-mini/" + f)`, then `r.write("contour.yaml", fixture("cli/goMiniGuarded.yaml"))`,
    `decks/tools/firstdiff.mjs` `"// firstdiff\n"`); golden `JSON.parse(fixture("cli/goMiniGuarded.deck.json")) as Card[]`.

### 2.2. OUTPUT data shapes

**`src/language/guardrails.ts`** (NEW). Imports types only (`import type { LanguageProfile, ProfileId } from "./types.js"`).

```ts
export const GUARDRAIL_RULES: Record<ProfileId, Record<string, string>>;
export function guardrailKey(name: string): string;
export function guardrailRule(profile: LanguageProfile, name: string): string | null;
```

**`src/rules/guardrails.ts`** (NEW). Imports: `node:path` (posix), `resolveProfile` from `"../language/profiles.js"`,
`cutTargets, slugName` from `"../language/naming.js"`, `codeTargets` from `"../language/paths.js"`, `guardrailKey,
guardrailRule` from `"../language/guardrails.js"`, `GUARD_CONTRACT, planLayers` from `"./layers.js"`, types with
`import type`.

```ts
export type GuardrailRulesResult =
  | { ok: true; rules: Record<string, Record<string, string>>; proseOnly: string[] } | { ok: false; errors: string[] };
export type PlanRulesResult =
  | { ok: true; layers: Record<string, string[]> | null; rules: Record<string, Record<string, string>> | null; proseOnly: string[] }
  | { ok: false; error: string };
export function guardrailRules(record: ContourRecord, map: ContourMap): GuardrailRulesResult;
export function cardRules(profile: LanguageProfile, targets: readonly string[], rules: Record<string, Record<string, string>>): Record<string, Record<string, string>>;
export function rulesArg(rules: Record<string, Record<string, string>> | undefined): string;
export function guardContract(guard: string): number;
export function planRules(record: ContourRecord, map: ContourMap, layersFile: boolean, guard: string, language: string): PlanRulesResult;
```

The behaviour of each is its record Function, word for word. Pinned: the rule text `Guardrail '<name as written>' of
<System|Component|Function|Interface> <its name>`; errors as Layer Edges' (`Component '<C>': <error>`); Plan Rules'
refusal `decks/tools/guard.mjs speaks contract <n>: copy templates/<language>/decks/tools/guard.mjs from MorphV2`
(n = the guard's contract, 1 when it has none); `rulesArg` = `" '" + JSON.stringify(rules).replaceAll("'", "\\u0027") +
"'"` (the six characters `\u0027`); keys sorted with the default `Array.prototype.sort()`, new objects built in that
order; Card Rules' keys in first-seen order of the code targets.

**`src/builder/types.ts`** (PATCH): `CardContext` gains `rules?: Record<string, Record<string, string>>` after
`layers?`; `BuildInput` gains the same `rules?` as its LAST field (after `layers?`). Nothing else.

**`src/builder/buildAcceptances.ts`** (PATCH): when `input.rules !== undefined`, every member's ctx gets
`rules: cardRules(input.profile, card.targets, input.rules)` (import from `"../rules/guardrails.js"`) as the last key,
after `layers`; undefined → the ctx exactly as today (no `rules` key). Nothing else.

**`src/builder/compose.ts`** (PATCH): codeAcceptance's guard line appends `rulesArg(ctx.rules)` right after
`layersArg(ctx.allowed ?? [], ctx.layers)` (import from `"../rules/guardrails.js"`). judgeAcceptance unchanged.

**`src/builder/goAcceptance.ts`** (PATCH): goCodeAcceptance's guard line the same way. goJudgeAcceptance unchanged.

**`src/cli/planCommand.ts`** (PATCH): the `planLayers(...)` call becomes
`const planned2 = planRules(record, map, hasFile("decks/tools/layers.json"), read.texts.guard, profiled.profile.id);`
(import `planRules` from `"../rules/guardrails.js"`; the `planLayers` import goes), the error branch as today; the
build input spreads `...(r.layers !== null ? { layers: r.layers } : {})` then `...(r.rules !== null ? { rules: r.rules }
: {})` after vendor; the document gains `...(proseOnly.length > 0 ? { proseOnly } : {})` right after `out` and before
the warnings (proseOnly = Plan Rules' when `--checks` was given, else none).

**Examples (the expected values).**

| example | given | then |
|---|---|---|
| Canonical Guardrail 1–3, Guardrail Rules 1–4, Card Rules 1, Rules Arg 1–5, Guard Contract 1, Plan Rules 1–3, Layers Arg 2–3 | the record (Components language, rules) | the record; fixtures above |
| Code Acceptance 5 | `examples.json["Code Acceptance 5"]`; ctx of example 1/2 = the `ctx(over)` helper of `tests/builder/compose.p19.examples.test.ts` | as its then |
| Go Acceptance 9 | the record (builder-go); ctxs of `tests/builder/goAcceptance.p19.examples.test.ts` | as its then |
| Build Acceptances 12 | `examples.json["Build Acceptances 12"]` (its inputs = those of `tests/builder/buildAcceptances.p30.examples.test.ts`) | as its then |
| Plan Command 19 | `examples.json["Plan Command 19"]` | as its then |

### 2.3. Names and the tests each judge writes

| module | change | code card | judge's file |
|---|---|---|---|
| `src/language/guardrails.ts` | NEW | `canonical-guardrail` | NEW `tests/language/guardrails.examples.test.ts` (Canonical Guardrail 1–3) |
| `src/rules/guardrails.ts` | NEW | `guardrail-rules` | NEW `tests/rules/guardrails.examples.test.ts` (Guardrail Rules 1–4, Card Rules 1, Rules Arg 1–5, Guard Contract 1, Plan Rules 1–3: 14 tests) and PATCH `tests/rules/layers.examples.test.ts` (Layers Arg 2–3: the guard args gain `"{}"`; 11 tests kept) |
| `src/builder/types.ts`, `buildAcceptances.ts` | PATCH | `build-acceptances` | NEW `tests/builder/buildAcceptances.p31a.examples.test.ts` (Build Acceptances 12) |
| `src/builder/compose.ts` | PATCH | `compose` | — (probe only; Build Acceptances 12 checks its guard line) |
| `src/builder/goAcceptance.ts` | PATCH | `go-acceptance` | — (probe only; Build Acceptances 12 checks its guard line) |
| `src/cli/planCommand.ts` | PATCH | `plan-command` | NEW `tests/cli/planCommand.p31a.examples.test.ts` (Plan Command 19) |

One test per example. Test names: `"<Function> example <N>: <what>"`.

### 2.4. What must not break

- Byte for byte: every file but the 7 code targets, the 4 new judge files and `tests/rules/layers.examples.test.ts`.
  A guard with no contract line and no `decks/tools/layers.json` (MorphV2's own hand guard) gets nothing: every MorphV2
  deck and the identity corpus (`tests/gate/identity.examples.test.ts`) stay byte for byte; Plan Command 1–18, Build
  Acceptances 1–11, Code Acceptance 1–4, Go Acceptance 1–8 unchanged; Plan Layers 1–3 unchanged (Plan Rules calls it).
- A contract-2 guard with no canonical Guardrail in the record: the deck of P30 byte for byte (Plan Command 15).
- The suite of main green, plus the 4 new files; `tests/rules/layers.examples.test.ts` keeps its 11 names.

## 3. Acceptance

Built by `morph plan --checks decks/p31a/checks.json --only <10 ids>`. `ownGit: true`, `frozen` the defaults +
`templates`, `fullExclude` the four new judge files and `tests/rules/layers.examples.test.ts` (red on main after the data
commit: the contract-3 guard refuses its P30 call without the rules argument, until its judge patches it). Code cards:
tsc → eslint → guard → probe `decks/p31a/parts/<id>.probe.ts` → full. Judges: lits = example names and literals.

## 4. Constraints

- NodeNext, `.js` imports, `import type`, no `any`. **language** and **rules** are pure (MorphV2's guard: no clock, no
  env, no process, no file read; node:path only). rules imports contour, language and itself; builder and cli import
  rules (`LAYERS` of MorphV2's guard already allows both).
- Generations as `dependsOn` gives: canonical-guardrail (0); guardrail-rules, canonical-guardrail-judge (1);
  build-acceptances, guardrail-rules-judge (2); compose, go-acceptance, plan-command (3); build-acceptances-judge,
  plan-command-judge (4). Each judge writes only its files; tests write only under `tmpRoot()`; the guard tests spawn
  `node` (the precedent of `tests/rules/layers.examples.test.ts`).

## 7. Out of scope

- **P31b** (#42 Must hold 3, #40 item 3): the imports whitelist from the record (stdlib narrowed by the rules + the
  record's dependencies), blamed per importing file; `checks.json` `imports` extras flagged redundant.
- **P31b** (ledger 3): `layers.json` removed from the templates (`morph init` writes none; a grep test that no template
  guard opens it; a `plan` note for a project that still has one). This phase only empties it: Go `{}`, TypeScript
  `{"packages": []}` (`packages` → `System.dependencies` is P31b's).
- **P31b** (ledger 4): the single-source invariant tests per rule kind (change only the record → the verdict changes;
  change only a file beside it → it does not).
- **P31b** (ledger 5): MorphStudio P9a run 1 and run 2 replays kept as fixtures.
- **P31b** (ledger 8, last part): the record Guardrail "Frozen Tree During Run" → `checks.json` `frozen`. Here it is a
  name with no rule: it is listed `prose only` (Plan Command 19).
- **P33** (ledger 6): MorphV2's own hand guard (`decks/tools/guard.mjs`, no contract line: `NO_CLOCK`, `NO_ENV`, `NET`, …)
  and its record's Guardrails per Component. Until then MorphV2 decks get no argument (§2.4).
- Old mrph's "interfaces share one core" (Interface cards only, `plan_spec.py`:73, 665–667): no canonical name covers it,
  so it stays prose and is listed `prose only` (Guardrail Rules 3). A future canonical name would need its own rule id.
- Aliases ("Standard Library Only" for "Stdlib Only", MorphStudio's record): the table never guesses; such a name is
  listed `prose only`. Adding a name is a change of the binary's table, with its rule in every template guard.
- Test files: rules apply to code files only (v1). Data Object, Event and Actor guardrails are not read.
- Go `No Process`: no rule (prose only) — the Go guard has no process/console notion; TypeScript only.
- Go rules are per FILE (the given code targets) where the old `pure` was per package; blame per file is the point.
- A directory name holding `'` (the layers argument is single-quoted as in P30): not checked; the rules argument
  escapes `'` as `\u0027`.
- Card count: `compose` and `go-acceptance` have no judge in this deck (10-card cap with #46's guard side folded in):
  their probes test Code Acceptance 5 and Go Acceptance 9, and Build Acceptances 12's judge checks both guard lines
  through buildAcceptances. Their example tests (compose.p31a, goAcceptance.p31a) → the next phase that re-cuts them.

## 9. Pre-registration

10 cards, 5 generations, transaction. First reds expected: judges (guardrail-rules-judge is the largest: 14 tests + a
patch of an 11-test file); the Go guard examples need `go` on PATH (1.22 on the laptop). Bill: ≈ $0.3–0.6 on ds ×3.
