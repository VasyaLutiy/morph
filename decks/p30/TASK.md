# TASK_P30 — issue #41: the layer rules come from the record (`src/rules/layers.ts`, `src/builder/{types,buildAcceptances,compose,goAcceptance}.ts`, `src/cli/planCommand.ts`)

Old-Morph scheme (README.md, Morph-Orchestrator v1). Plan: `docs/Plan_Epic2_Fixes.md` §P30. Record: NEW Component
**rules** (Functions Layer Edges, Card Layers, Layers Arg, Plan Layers; Data Objects Layer Edges Result, Plan Layers
Result); Component builder (Code Acceptance example 4, Build Acceptances example 11, Card Context `layers?`);
builder-go (Go Acceptance example 8); cli (Plan Command example 15). Cut with `--only` (the Components hold other
Functions): the deck is a transaction. The template guards and `layers.json` are data of this phase's data commit.

## 1. Why this

- MorphStudio P9a (#40 item 2): the record gained the Component `users`; the hand table `decks/tools/layers.json`
  did not. Every `users` card went red at `guard: users is not a package of decks/tools/layers.json`, which no answer
  can fix (one run lost). Reproduced 11.10 for $0: the real acceptances on the P9a stubs stop at `== guard` for the
  three `users` code cards.
- Measured 11.10 on MorphStudio `f85a8e7` (spike, `tests/fixtures/rules/morphstudio*`): the record's `uses:
  <Component>` steps give 34 Component pairs = 30 directory pairs over 18 code directories; every one is allowed by
  `layers.json`. The table is WIDER than the record in 5 directories (api, cmd/morphd, daemon, mcpserver, registry:
  18 pairs the record does not state) and lacks `users`. The record is the source (operator, 11.10); the gaps of the
  MorphStudio record are its data, not this phase's (§7).

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main**: `src/contour/types.ts` — `ContourRecord` (`record.system.groups: Component[]`, each
  `{name, language: string | null, functions: ContourFunction[]}`, a Function's `steps: {verb, target}[]` with verb
  `"uses"`, `record.system.dependencies: {name}[]`), `ContourMap` (`language: string | null`, `groups: {name,
  functions: string[]}[]`, `cards: {id, targets: string[] | null, …}[]`); `src/contour/select.ts` — `componentSlug`;
  `src/contour/load.ts` — `loadContour(text, name)` / `loadMap(text, name)` → `{ok: true, record}` / `{ok: true, map}`
  | `{ok: false, error}`; `src/language/profiles.ts` — `resolveProfile(componentLanguage, mapLanguage)` →
  `{ok: true, profile} | {ok: false, error}`, `GO`, `TYPESCRIPT`; `src/language/naming.ts` — `slugName(name)`,
  `cutTargets(profile, component, name)` → `{ok: true, slug, targets: {code, test, judge}} | {ok: false, error}`
  (the record's Name Targets); `src/language/paths.ts` — `codeTargets(profile, targets)`; `src/builder/compose.ts`
  — `allowArg(allowed)`; `src/cli/planCommand.ts` — `EMPTY_MAP`, `planCommand(root, args)`.
- **Fixtures** (all committed in the data commit):

| file | type | what the Function returns on it |
|---|---|---|
| `tests/fixtures/ts-rename.json` | object path → text; `"contour.yaml"`, `"morph-map.json"` | Layer Edges: `{"src/report": ["src/units"], "src/units": []}` |
| `tests/fixtures/rules/morphstudio/contour.yaml`, `morph-map.json` | record text (19 Components, 33 Functions, f85a8e7's steps), map text (33 cards, targets only, `"language": "go"`) | Layer Edges: the object of `morphstudio.edges.json` (18 keys, 30 pairs) |
| `tests/fixtures/rules/morphstudio.edges.json` | one object directory → sorted directories | the expected edges, measured by the spike |
| `tests/fixtures/rules/morphstudio/layers.json` | `{"layers": {…18 keys, no users}, "pure": []}` (f85a8e7's) | each edges list but users' ⊆ its `layers` entry |
| `tests/fixtures/rules/union/contour.yaml`, `morph-map.json` | record text, map text (Go; groups `{"gamma-pair": ["Gamma One", "Gamma Two"]}`) | `{"gamma": ["pkg"], "pkg": ["x", "y"], "x": [], "y": []}` |
| `tests/fixtures/rules/both.yaml` | record text (Components yaml, config; dependency yaml) | with `EMPTY_MAP`: the one error of Layer Edges example 4 |
| `tests/fixtures/builder/examples.json` `"Code Acceptance 4"`, `"Build Acceptances 11"` | given/then texts | Code Acceptance 4, Build Acceptances 11 (§2.2) |
| `tests/fixtures/cli/examples.json` `"Plan Command 15"` | given/then texts | Plan Command 15 (§2.2) |

- **Harnesses (verbatim, the judges build from them).**
  - Records: `const ts = fixtureJson("ts-rename.json") as Record<string, string>;` then
    `const R = loadContour(ts["contour.yaml"], "contour.yaml"); const M = loadMap(ts["morph-map.json"], "morph-map.json");`
    and `if (!R.ok || !M.ok) throw new Error("fixture");` — then `R.record`, `M.map`. The same with
    `fixture("rules/morphstudio/contour.yaml")`, `fixture("rules/union/contour.yaml")`, `fixture("rules/both.yaml")`
    (both: map `EMPTY_MAP`).
  - Guards (Layers Arg examples 2 and 3): `const ROOT = path.resolve(fixturePath("."), "..", "..");`
    `const GUARD = (lang: string): string => path.join(ROOT, "templates", lang, "decks", "tools", "guard.mjs");`
    `const ENV = { ...process.env, GOFLAGS: "-mod=mod", GOPROXY: "off", GOTOOLCHAIN: "local", GOWORK: "off" };`
    `const run = (cwd: string, lang: string, args: string[]) => spawnSync("node", [GUARD(lang), ...args], { cwd, encoding: "utf8", env: ENV });`
    → `{status, stdout}`; the args are `["src", <file>, "", JSON.stringify(L)]` (allowArg([]) + layersArg([], L) as shell
    words). The trees on a `tmpRoot()`: Go — `go.mod` `"module m\n\ngo 1.22\n"`, `x/x.go` `"package x\n\nconst X = 1\n"`,
    `y/y.go` `"package y\n\nconst Y = 2\n"`, `queue/q.go` `"package queue\n\nconst Q = 3\n"`, `users/u.go`
    `"package users\n\nconst U = 4\n"`, `pkg/a.go` `"package pkg\n\nimport \"m/x\"\n\nconst A = x.X\n"`, `pkg/b.go`
    `"package pkg\n\nimport \"m/y\"\n\nconst B = y.Y\n"`, `registry/x.go`
    `"package registry\n\nimport (\n\t\"m/queue\"\n\t\"m/users\"\n)\n\nconst R = queue.Q + users.U\n"`,
    `decks/tools/layers.json` `"{\"layers\":{\"registry\":[\"queue\",\"users\"]},\"pure\":[]}\n"`; TypeScript —
    `src/units/convert.ts` `"export const METRE = \"m\";\n"`, `src/report/line.ts` `"import { METRE } from
    \"../units/convert.js\";\n\nexport function lengthLine(label: string): string {\n  return label + \" \" + METRE;\n}\n"`.
    Measured on the committed guards (11.10): stdout of a red is the one line + `"\n"`; a green prints nothing.
  - Plan Command 15: the go-mini root of `tests/cli/planCommand.p15.examples.test.ts` (its `MINI` list written from
    `fixture("go-mini/" + f)`, `decks/tools/guard.mjs` `"// guard\n"`, `decks/tools/firstdiff.mjs` `"// firstdiff\n"`)
    plus `r.write("decks/tools/layers.json", "{\"pure\": []}\n")`; golden `JSON.parse(fixture("cli/goMini.deck.json"))`.
    The heredoc of the guard in every acceptance is `"cat > $P/guard.mjs <<'MORPH_GUARD_EOF'\n// guard\nMORPH_GUARD_EOF\n"`.

### 2.2. OUTPUT data shapes

**`src/rules/layers.ts`** (NEW, layer rules). Imports: `node:path` (posix), `componentSlug` from
`"../contour/select.js"`, `resolveProfile` from `"../language/profiles.js"`, `cutTargets, slugName` from
`"../language/naming.js"`, `codeTargets` from `"../language/paths.js"`, types with `import type`. Exports:

```ts
export const GUARD_CONTRACT = "morph-guard-contract: 2";
export type LayerEdgesResult = { ok: true; edges: Record<string, string[]> } | { ok: false; errors: string[] };
export type PlanLayersResult = { ok: true; layers: Record<string, string[]> | null } | { ok: false; error: string };
export function layerEdges(record: ContourRecord, map: ContourMap): LayerEdgesResult;
export function cardLayers(profile: LanguageProfile, targets: readonly string[], edges: Record<string, string[]>): Record<string, string[]>;
export function layersArg(allowed: readonly string[], layers: Record<string, string[]> | undefined): string;
export function planLayers(record: ContourRecord, map: ContourMap, layersFile: boolean, guard: string, language: string): PlanLayersResult;
```

The behaviour of each is its record Function (Component rules), word for word. Pinned:
- error texts `Component '<C>': <error>`; `Function '<F>': 'uses: <X>' names the Component '<name>' and the
  dependency '<X>'`; `decks/tools/guard.mjs speaks contract 1: copy templates/<language>/decks/tools/guard.mjs from
  MorphV2`; Plan Layers joins Layer Edges' errors with `"\n"`;
- the edges' keys and lists sorted with the default `Array.prototype.sort()` (code units), a new object built in that
  key order; Card Layers' keys in first-seen order of the code targets;
- `layersArg(allowed, undefined)` = `""`; else `(allowed.length === 0 ? " ''" : "") + " '" + JSON.stringify(layers) + "'"`.

**`src/builder/types.ts`** (PATCH): `CardContext` gains `layers?: Record<string, string[]>` after `vendor?`;
`BuildInput` gains `layers?: Record<string, string[]>` as its LAST field (after `transaction?`). Nothing else.

**`src/builder/buildAcceptances.ts`** (PATCH): when `input.layers !== undefined`, every member's ctx gets
`layers: cardLayers(input.profile, card.targets, input.layers)` (import from `"../rules/layers.js"`), as the last key;
when it is undefined the ctx object is built exactly as today (no `layers` key). Nothing else.

**`src/builder/compose.ts`** (PATCH): codeAcceptance's guard line =
`"echo '== guard'; node $P/guard.mjs src " + code.join(",") + allowArg(ctx.allowed ?? []) + layersArg(ctx.allowed ?? [], ctx.layers)`
then the tests part and `"\n"` as today. judgeAcceptance, allowArg and litsJson unchanged.

**`src/builder/goAcceptance.ts`** (PATCH): goCodeAcceptance's guard line the same way (`layersArg` from
`"../rules/layers.js"` right after `allowArg(ctx.allowed ?? [])`). goJudgeAcceptance unchanged.

**`src/cli/planCommand.ts`** (PATCH): in the `args.checks` branch, right after `readPlanChecks` succeeded:
`const layers = planLayers(record, map, hasFile("decks/tools/layers.json"), read.texts.guard, profiled.profile.id);`
`!layers.ok` → `{code: 2, document: errorDocument(2, "DeckError", layers.error)}`; the input object passed to
buildAcceptances gains `layers: layers.layers` ONLY when it is not null (spread `...(layers.layers !== null ? {
layers: layers.layers } : {})` after vendor), so without layers.json the input — and every deck — is byte for byte.

**Examples (the expected values).**

| example | given | then |
|---|---|---|
| Layer Edges 1–4, Card Layers 1, Layers Arg 1–3, Plan Layers 1–3 | the record (Component rules) | the record; fixtures above |
| Code Acceptance 4 | `examples.json["Code Acceptance 4"].given`; ctx of example 1 = the `ctx(over)` helper of `tests/builder/compose.p19.examples.test.ts` | code1.txt line 40 `echo '== guard'; node $P/guard.mjs src src/x/a.ts` + ` '' '{"src/x":["src/y"]}'`; + ` 'zod' '{"src/x":[]}'`; code2.txt line 39 `guard.mjs src src/x/a.ts; node` → `guard.mjs src src/x/a.ts '' '{"src/x":[]}'; node` |
| Go Acceptance 8 | the record (builder-go); ctxs of `tests/builder/goAcceptance.p19.examples.test.ts` | go/code1.txt line 23 `echo '== guard'; node $P/guard.mjs src calc/percent_of.go` + ` '' '{"calc":[]}'`; + ` 'github.com/dustin/go-humanize' '{"calc":["report"]}'`; go/code2.txt line 25 `guard.mjs src report/a.go; node` → `guard.mjs src report/a.go '' '{"report":["calc"]}'; node`; go/judge1.txt exactly |
| Build Acceptances 11 | `examples.json["Build Acceptances 11"]` | as its then; percent-of's = go/code1.txt with line 23 + ` '' '{"calc":["report"]}'` |
| Plan Command 15 | `examples.json["Plan Command 15"]` (go-mini, layers {"calc": [], "report": ["calc"]}) | as its then |

### 2.3. Names and the tests each judge writes

| module | change | code card | judge's file |
|---|---|---|---|
| `src/rules/layers.ts` | NEW | `layer-edges`, probe only | NEW `tests/rules/layers.examples.test.ts` (Layer Edges 1–4, Card Layers 1, Layers Arg 1–3, Plan Layers 1–3: 11 tests) |
| `src/builder/types.ts`, `src/builder/buildAcceptances.ts` | PATCH | `build-acceptances` | NEW `tests/builder/buildAcceptances.p30.examples.test.ts` (Build Acceptances 11) |
| `src/builder/compose.ts` | PATCH | `compose` | NEW `tests/builder/compose.p30.examples.test.ts` (Code Acceptance 4) |
| `src/builder/goAcceptance.ts` | PATCH | `go-acceptance` | NEW `tests/builder/goAcceptance.p30.examples.test.ts` (Go Acceptance 8) |
| `src/cli/planCommand.ts` | PATCH | `plan-command` | NEW `tests/cli/planCommand.p30.examples.test.ts` (Plan Command 15) |

Test names: `"<Function> example <N>: <what>"`.

### 2.4. What must not break

- Byte for byte: every file but the 6 code targets and the 5 new judge files. With no `decks/tools/layers.json`
  nothing changes: every MorphV2 deck, Plan Command 1–14 (goldens `goMini.deck.json`, Plan Command 8), Build
  Acceptances 1–10, Code/Go Acceptance 1–7, the identity corpus (`tests/gate/identity.examples.test.ts`, F8).
- The identity corpus entries go-mini and go-p7b: their trees held `decks/tools/layers.json` (with MorphV2's
  contract-1 `goguard.mjs`), which would now refuse the cut. This phase's data commit deletes both fixture
  `layers.json` files (no test reads them) and moves the two entries' `commit` to that commit; the cut of a tree
  without layers.json is the old one, so bytes and sha256 stay.
- The suite of main green, plus the 5 new files.

## 3. Acceptance

Built by `morph plan --checks decks/p30/checks.json --only <10 ids>`. `ownGit: true`, `frozen` the defaults +
`templates`, `fullExclude` the five new judge files. Code cards: tsc → eslint → guard → probe
`decks/p30/parts/<id>.probe.ts` → full. Judges: new file, lits = example names and literals (checks.json).

## 4. Constraints

- NodeNext, `.js` imports, `import type`, no `any`. Layer **rules** (MorphV2's guard `LAYERS`: `rules: ["contour",
  "language"]`, node:path only, no clock, no env): no file read, no process. builder may import rules (`LAYERS` builder
  gains rules); cli is `*`.
- Generations: layer-edges (0); build-acceptances, layer-edges-judge (1); compose, go-acceptance, plan-command,
  build-acceptances-judge (2)… as `dependsOn` gives; each judge writes only its file; tests write only under
  `tmpRoot()`; the guard tests spawn `node` (the guard) — the precedent of `tests/cli/main.examples.test.ts`.

## 7. Out of scope

- MorphV2's own hand guard (`decks/tools/guard.mjs`, `LAYERS`): its record declares fewer edges (issue #41 §6); P33.
  This phase only adds the `rules` layer to it (data).
- `pure`, `entry`, `packages` of layers.json and the imports whitelist: P31a/P31b (#42).
- The MorphStudio record's own gaps (registry → queue, api → queue, daemon → queue/runner, mcpserver → queue,
  cmd/morphd → claude/control/registry/runner/supervisor/telegram, imports of its code at 0e8d7b7 with no `uses`
  step): MorphStudio data, its operator's phase.
- A directory name holding `'` (the argument is single-quoted): no record has one; not checked.
- The guard naming the importing FILE in Go: `go list` reports imports per package; the red names the package.
