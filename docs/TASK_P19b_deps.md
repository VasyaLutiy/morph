# TASK_P19b — dependencies, the enforcement half: the guard line names a card's declared packages, Go builds from `vendor/` (`src/builder/{types,compose,goAcceptance,buildAcceptances}.ts`, `src/cli/planCommand.ts`)

> Phase P19b of `docs/PLAN.md` ("Фазы по записи (после P2)": `P19 | contour + language + planner + builder
> (dependencies) | issue #10`), operator 08.10. Issue VasyaLutiy/morph#10 (label `P19-deps`, #10 only). P19a (the record
> half, run 20261008-141116) is merged; this half is exactly `docs/TASK_P19a_deps.md` §7: Components **builder** (Code
> Acceptance, Build Acceptances), **builder-go** (Go Acceptance) and **cli** (Plan Command) as code cards; the guards,
> MorphV2's own `yaml`, the templates' regulation and issue #10's two smoke recipes as data. The deck is cut by V2
> (`morph plan --component builder --component builder-go --component cli --judge --checks decks/p19b/checks.json`),
> filtered to this phase's 8 cards by `decks/p19b/filter.py`; one gate (≤ $1, slices ≤ 200 KB, chains < 250 s, §11).

## 1. Why this

- **P19a made dependencies a part of the record but nothing enforces them.** After the merge a Component may `uses:
  [zod]` and its cards are told "the standard library plus zod@3.23.8 …; no other import", yet every TypeScript code
  acceptance still runs `node $P/guard.mjs src <files>`, whose template guard rejects every package import but `node:*`
  (`package import "zod" (allowed: node:*)`), and every Go acceptance runs `GOFLAGS=-mod=mod GOPROXY=off` with an empty
  module cache (`/tmp/morph/go`), so a declared module fails at build: measured in a scratch module (go 1.22.2,
  github.com/dustin/go-humanize v1.0.1): `-mod=mod` → `module lookup disabled by GOPROXY=off`; `-mod=vendor` with
  `vendor/` committed → `go vet` and `go test ./...` green with an empty GOPATH, GOPROXY=off and a dead HTTP(S) proxy.
- **Size.** 4 code cards + 4 judges = **8 cards**, 5 generations, all code-only targets (probes, no smoke test); 26
  changed lines of reference code in 5 files (2 optional fields in each of two types, one exported helper, one constant +
  one function, two lines of wiring) — under the 12-card bound in one deck, no split.
- **Ripple, measured** (the reference code in a scratch worktree from a4e53ef with this phase's data, full suite):
  **0 of 776** red — the new fields are optional (§2.2), so every existing `ctx`/`buildAcceptances` literal still
  type-checks and every existing fixture is byte for byte; no `fullExclude`. The record with `yaml` declared and Component
  contour `uses: [yaml]` (and `docs/deps/yaml.md`): **0 of 776** red; `morph plan --component contour` on main's binary
  exit 0 (the contour cards gain the finale sentence and `docs/deps/yaml.md` in their slices; no deck of this repository
  is re-cut from it, §2.4).
- **Record sizes** (bytes of each Component block, from its `- name:` line to the next): builder 25 820 → **29 240**;
  builder-go 8 587 → **10 315**; cli 28 035 → **28 554** (the Plan Command examples' text lives in
  `tests/fixtures/cli/examples.json`, keys "Plan Command 10" and "Plan Command 11"); contour 23 606 → **23 625**.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main** (module → what the new code calls or constructs): `src/builder/types.ts` — `CardContext`,
  `BuildInput` (both gain two optional fields, §2.2), `Checks`, `JudgeFile`, `BuildResult`; `src/builder/compose.ts` —
  `codeAcceptance`, `judgeAcceptance`, `litsJson`; `src/builder/goAcceptance.ts` — `GO_ENV`, `goCodeAcceptance`,
  `goJudgeAcceptance`; `src/builder/buildAcceptances.ts` — `buildAcceptances` (the `ctx` literal it builds per member);
  `src/planner/types.ts` — `PlanResult` (since P19a its ok variant carries `uses: Record<string, string[]>`, code cards of
  Components with dependencies only, names in record order); `src/cli/planCommand.ts` — `planCommand`, its local
  `hasFile` (a regular file under root).
- **Preconditions of the callees.** planner · Plan Spec · `uses` keys are code cards' customIds and its lists are already
  in **record order** (System.dependencies order, P19a), so Build Acceptances keeps a list as given and never sorts.
  builder · Read Checks · a code card with a test target needs a smoke cap (`code card '<id>' targets the test … but has
  no smoke cap`), hence the smoke caps in the Plan Command examples (the deps fixture's default targets add a test file).
  builder · Build Acceptances · only the cards the checks name get an acceptance; any other card keeps the plan's.
- **Fixtures** (`tests/fixtures/`), each by the type the Function takes — **no new fixture file**; the expected scripts
  are existing fixtures with named lines changed:

| file | type | what it is | what the Function returns on it |
|---|---|---|---|
| `builder/code1.txt` | text, one whole script | Code Acceptance 1's script; line 40 `echo '== guard'; node $P/guard.mjs src src/x/a.ts` | CA 3: equal with that line ending in ` 'yaml,@scope/pkg'`; with allowed [] equal |
| `builder/code2.txt` | text | Code Acceptance 2's; line 39 `… guard.mjs src src/x/a.ts; node $P/guard.mjs tests tests/x/a.test.ts 1 5` | CA 3: `src/x/a.ts 'ajv'; node` |
| `builder/judge1.txt` | text | Judge Acceptance 1's | JA 4: equal (allowed and vendor not read) |
| `builder/go/code1.txt` | text | Go Acceptance 1's; line 6 the GO_ENV line, line 23 `echo '== guard'; node $P/guard.mjs src calc/percent_of.go` | GA 7, BA 8: line 6 → GO_ENV_VENDOR's text, line 23 + ` '<paths>'` |
| `builder/go/judge1.txt` | text | Go Acceptance 3's; line 6 the GO_ENV line | GA 7: only line 6 changed |
| `builder/go/code2.txt` | text | Go Acceptance 2's; line 25 `… guard.mjs src report/a.go; node $P/guard.mjs tests report/a_test.go 1 5` | GA 7: `report/a.go 'golang.org/x/mod'; node` |
| `planner/deps.yaml` | the record TEXT (P19a) | dependencies yaml 2.8.1 (typescript, doc docs/deps/yaml.md), github.com/google/go-cmp v0.7.0 (go, doc docs/deps/go-cmp.md), zod 3.23.8 (typescript, no doc), in that order; conf uses [zod, yaml]; diff uses [go-cmp]; plain none | PC 10: read-config's and check-config's allowed `["yaml", "zod"]`; PC 11: diff-values' `["github.com/google/go-cmp"]` |
| `planner/deps.map.json` | the map TEXT (P19a) | docs `["docs/TASK.md"]`; check-config's slice `["docs/X.md"]` | PC 10, 11 |
| `cli/examples.json` (2 keys added) | ONE object | "Plan Command 10", "Plan Command 11": given/then of §2.2's table | — |

- **Harness skeletons** (only `tests/helpers.ts` and the modules named). The ctx helpers are the existing test files'
  own, verbatim:

```ts
// compose (TypeScript): ctx of Code Acceptance 1; example 2's overrides {id "a", phase "p2", targets ["src/x/a.ts", "tests/x/a.test.ts"], siblings [], fullExclude ["tests/x/old.test.ts"], ownGit true}
const ctx = (over: Partial<CardContext>): CardContext => ({
  id: "a", phase: "p1", targets: ["src/x/a.ts"], siblings: ["src/x/b.ts"], frozen: DEFAULT_FROZEN, fullExclude: [], ownGit: false,
  profile: TYPESCRIPT, guard: "// guard\n", firstdiff: "// firstdiff\n", ...over,
});
// go: ctx of Go Acceptance 1; example 2 {id "a", phase "p2", targets ["report/a.go", "report/a_test.go"], siblings [], frozen DEFAULT_FROZEN, fullExclude ["calc/old_test.go"], ownGit true};
//     example 3 (judge) {id "percent-of-judge", targets ["calc/percent_of_examples_test.go"], siblings ["report/format_share.go"]}, files [{file "calc/percent_of_examples_test.go", min 5, max 11, lits ["TestPercentOfExample1", "0% (0 of 0)"], drop [], new true}]
const goCtx = (over: Partial<CardContext>): CardContext => ({
  id: "percent-of", phase: "m1", targets: ["calc/percent_of.go"], siblings: ["calc/clamp_value_examples_test.go"],
  frozen: ["go.mod", "internal"], fullExclude: [], ownGit: false, profile: GO, guard: "// guard\n", firstdiff: "// firstdiff\n", ...over,
});
// buildAcceptances: const card = (id, targets, dependsOn = []) => ({customId: id, intent: "patch", targets, contextSlice: [], instruction: "x",
//   acceptance: null, model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn}); checks(phase, cards, frozen = DEFAULT_FROZEN) =
//   {version: 1, phase, parts: "decks/<phase>/parts", frozen, fullExclude: [], ownGit: false, cards}; a code card {id, smoke: null, extra: null, files: null}
// Plan Command 10-11 (the deps root): const r = tmpRoot(); r.write("contour.yaml", fixture("planner/deps.yaml"));
//   r.write("morph-map.json", fixture("planner/deps.map.json")); r.write("docs/deps/yaml.md", "# yaml\n"); r.write("decks/tools/guard.mjs", "// guard\n");
//   r.write("decks/tools/firstdiff.mjs", "// firstdiff\n"); r.write("decks/d1/checks.json", JSON.stringify({phase: "d1", cards: [{id: "read-config", smoke: 3}, {id: "pad-left", smoke: 2}]}));
//   probes decks/d1/parts/read-config.probe.ts, pad-left.probe.ts "// probe\n"; for 11 also docs/deps/go-cmp.md "# go-cmp\n",
//   decks/d2/checks.json {phase: "d2", cards: [{id: "diff-values", smoke: 4}]}, decks/d2/parts/_diff-values_probe_test.go "package diff\n";
//   planCommand(r.root, {name: "plan", root: ".", pretty: false, spec: "contour.yaml", map: "morph-map.json", components, judge: false, out, checks}); r.rm() in finally
```

**Distinct markers.** Packages zod, yaml, ajv, @scope/pkg, x, q, p; module paths github.com/dustin/go-humanize,
golang.org/x/text, golang.org/x/mod, github.com/google/go-cmp, x.org/y, z.org/b, a.org/c; phases p1, p2, p7, m1, d1, d2;
smoke caps 2, 3, 4, 5. The code hard-codes none of them: names come from `uses`, the vendor flag from the input; the
quoting, the `,` join and the two env lines are the contract.

### 2.2. OUTPUT data shapes

**`src/builder/types.ts`** (PATCH) — two optional fields in each of two types, nothing else changes:

```ts
export interface CardContext {
  id: string; phase: string; targets: string[]; siblings: string[]; frozen: string[];
  fullExclude: string[]; ownGit: boolean; profile: LanguageProfile; guard: string; firstdiff: string;
  allowed?: string[]; vendor?: boolean;
}
export interface BuildInput {
  cards: Card[]; checks: Checks; profile: LanguageProfile; texts: BuildTexts;
  uses?: Record<string, string[]>; vendor?: boolean;
}
```

**`src/builder/compose.ts`** (PATCH) — **Code Acceptance**, additions only:

- `export function allowArg(allowed: readonly string[]): string` = `""` when empty, else `" '" + allowed.join(",") +
  "'"` (the order given; nothing sorted or made distinct).
- codeAcceptance's guard line: `"echo '== guard'; node $P/guard.mjs src " + code.join(",") + allowArg(ctx.allowed ??
  [])`, then (with a test) `"; node $P/guard.mjs tests <test> 1 <smoke>"`, then `"\n"`. Nothing else reads
  `ctx.allowed`; nothing reads `ctx.vendor`. `judgeAcceptance` and `litsJson` unchanged (judges keep their import rules).

| example | given | result |
|---|---|---|
| Code Acceptance 3 | `allowArg([])`, `allowArg(["zod"])`, `allowArg(["yaml", "@scope/pkg"])`; codeAcceptance of example 1's ctx + `allowed ["yaml", "@scope/pkg"]`; of example 2's ctx + `allowed ["ajv"], vendor true` (probe, smoke 5, extra `"echo '== bin'; true\n"`); of example 1's ctx + `allowed [], vendor false` | `""`; `" 'zod'"`; `" 'yaml,@scope/pkg'"`; code1.txt with `echo '== guard'; node $P/guard.mjs src src/x/a.ts` + `" 'yaml,@scope/pkg'"`, nothing else changed; code2.txt with `guard.mjs src src/x/a.ts; node` → `guard.mjs src src/x/a.ts 'ajv'; node`; exactly code1.txt |
| Judge Acceptance 4 | judgeAcceptance of example 1's ctx and files + `allowed ["zod"], vendor true` | exactly judge1.txt |

**`src/builder/goAcceptance.ts`** (PATCH) — **Go Acceptance**, additions only:

```ts
export const GO_ENV: string;          // unchanged, byte for byte
export const GO_ENV_VENDOR: string =  // GO_ENV with "-mod=mod" become "-mod=vendor", nothing else
  'export GOFLAGS=-mod=vendor GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOWORK=off GOCACHE="${GOCACHE:-/tmp/morph/go-build}" GOPATH="${GOPATH:-/tmp/morph/go}"\n';
export function goEnv(vendor: boolean): string;   // vendor ? GO_ENV_VENDOR : GO_ENV
```

- goCodeAcceptance and goJudgeAcceptance begin with `goEnv(ctx.vendor === true)` in place of `GO_ENV`; goCodeAcceptance's
  guard line is `"echo '== guard'; node $P/guard.mjs src " + code.join(",") + allowArg(ctx.allowed ?? [])` (allowArg
  from `./compose.js`) before the tests part; the judge's reads no `allowed`. GOPROXY=off in both lines.

| example | given | result |
|---|---|---|
| Go Acceptance 6 | `GO_ENV_VENDOR`; `goEnv(false)`; `goEnv(true)` | the literal above (one line with its newline); GO_ENV; GO_ENV_VENDOR |
| Go Acceptance 7 | goCodeAcceptance of example 1's ctx + `allowed ["github.com/dustin/go-humanize"], vendor true` (probe `"package calc\n"`); goJudgeAcceptance of example 3's ctx and files + `allowed ["golang.org/x/text"], vendor true`; goCodeAcceptance of example 2's ctx + `allowed ["golang.org/x/mod"]` (probe `"package report\n"`, smoke 5, extra `"echo '== bin'; true\n"`); of example 1's ctx + `allowed [], vendor false` | go/code1.txt with its GO_ENV line → GO_ENV_VENDOR's and `node $P/guard.mjs src calc/percent_of.go` + `" 'github.com/dustin/go-humanize'"`, nothing else; go/judge1.txt with only its GO_ENV line → GO_ENV_VENDOR's; go/code2.txt with `guard.mjs src report/a.go; node` → `guard.mjs src report/a.go 'golang.org/x/mod'; node`; exactly go/code1.txt |

**`src/builder/buildAcceptances.ts`** (PATCH) — **Build Acceptances**, additions only: every member's ctx gains
`allowed` = `input.uses[card.customId]` as given when `input.uses` is not undefined and has that **own** key
(`Object.prototype.hasOwnProperty.call`, as the probes lookup does; a card named `constructor` gets `[]` from `{}`), else
`[]`; and `vendor` = `input.vendor === true`. Every error, its order, the members, generations and siblings unchanged.

| example | given | result |
|---|---|---|
| Build Acceptances 7 | cards a (`["src/x/a.ts"]`), b (`["src/x/b.ts"]`), acceptances null; checks phase "p7", code cards a, b; probes a, b `"// probe\n"`; guard `"// guard\n"`, firstdiff `"// firstdiff\n"`; uses `{"a": ["zod", "yaml"], "a-judge": ["ajv"], "c": ["x"]}`, vendor true; then the same input without uses and vendor | ok; a's acceptance = codeAcceptance(ctx {id "a", phase "p7", targets ["src/x/a.ts"], siblings ["src/x/b.ts"], frozen DEFAULT_FROZEN, fullExclude [], ownGit false, TYPESCRIPT, the texts, allowed ["zod", "yaml"]}, "// probe\n", null, null), holding `node $P/guard.mjs src src/x/a.ts 'zod,yaml'\n`; b's = codeAcceptance with siblings ["src/x/a.ts"], holding `node $P/guard.mjs src src/x/b.ts\n`; then a's holds `node $P/guard.mjs src src/x/a.ts\n`, b's the same as before |
| Build Acceptances 8 | the go input of example 5 (percent-of `["calc/percent_of.go"]`, clamp-value-judge `["calc/clamp_value_examples_test.go"]`, checks phase "m1", frozen ["go.mod", "internal"], the judge's file {calc/clamp_value_examples_test.go, 4, 10, lits ["TestClampValueExample1"], new true}, probes {percent-of: "package calc\n"}) + uses `{"percent-of": ["github.com/dustin/go-humanize", "golang.org/x/text"]}`, vendor true | ok; percent-of's = go/code1.txt with `export GOFLAGS=-mod=mod ` → `export GOFLAGS=-mod=vendor ` and `node $P/guard.mjs src calc/percent_of.go` + `" 'github.com/dustin/go-humanize,golang.org/x/text'"`; the judge's = goJudgeAcceptance(its ctx: siblings ["calc/percent_of.go"], vendor true, no allowed; files), holding `export GOFLAGS=-mod=vendor ` and no `-mod=mod` |

**`src/cli/planCommand.ts`** (PATCH) — **Plan Command**: the Build Acceptances call gains `uses: planned.uses` and
`vendor: hasFile("vendor/modules.txt")` (a regular file under root: a directory of that name is no vendor tree). Without
`--checks` nothing changes; every other step, message and order unchanged.

| example | given (tests/fixtures/cli/examples.json) | result |
|---|---|---|
| Plan Command 10 | the deps root (§2.1), components ["conf", "plain"], judge false, checks decks/d1/checks.json, out decks/d1/deck.json; then vendor/modules.txt `"# github.com/google/go-cmp v0.7.0\n"` written, out decks/d1/deck2.json | code 0; cards pad-left `[src/plain/padLeft.ts, tests/plain/padLeft.test.ts]`, read-config `[src/conf/readConfig.ts, tests/conf/readConfig.test.ts]`, check-config `[src/conf/checkConfig.ts, tests/conf/checkConfig.test.ts]` in that order; read-config's acceptance = codeAcceptance(ctx {id "read-config", phase "d1", its two targets, siblings pad-left's two, DEFAULT_FROZEN, [], false, TYPESCRIPT, the texts, allowed ["yaml", "zod"]}, "// probe\n", 3, null), holding `node $P/guard.mjs src src/conf/readConfig.ts 'yaml,zod'; node $P/guard.mjs tests tests/conf/readConfig.test.ts 1 3\n` (record order, not uses order); pad-left's = codeAcceptance of its ctx (siblings read-config's two, no allowed), smoke 2, holding `node $P/guard.mjs src src/plain/padLeft.ts; node`; check-config keeps the plan's acceptance; then deck2.json equal to deck.json byte for byte (a TypeScript acceptance does not read vendor) |
| Plan Command 11 | the deps root + docs/deps/go-cmp.md, decks/d2 (diff-values, smoke 4), no vendor/modules.txt; components ["diff"], checks decks/d2/checks.json, out decks/d2/deck.json; then vendor/modules.txt `"# github.com/google/go-cmp v0.7.0\n## explicit; go 1.11\ngithub.com/google/go-cmp/cmp\n"`, out decks/d2/deck2.json | code 0; one card diff-values `[diff/diff_values.go, diff/diff_values_test.go]`, its acceptance = goCodeAcceptance(ctx {id "diff-values", phase "d2", those targets, siblings [], DEFAULT_FROZEN, [], false, GO, the texts, allowed ["github.com/google/go-cmp"], vendor false}, "package diff\n", 4, null): GO_ENV once and `node $P/guard.mjs src diff/diff_values.go 'github.com/google/go-cmp'; node $P/guard.mjs tests diff/diff_values_test.go 1 4\n`; then the card equal but its acceptance, which is the first with `export GOFLAGS=-mod=mod ` → `export GOFLAGS=-mod=vendor `, nothing else |

**The guards (data, written by the orchestrator; not a card's target).** `node guard.mjs src <file,file,…> [<name,name,…>]`:
the optional third argument is the card's allowed list (the builder writes it only when non-empty, single-quoted).
- `templates/typescript/decks/tools/guard.mjs`: a package import of these files is allowed when it is a layers.json
  `packages` entry or an allowed name (the spec itself or `<name>/…`), else `package import "<spec>" (allowed: node:*,
  <packages and names joined by ", ">)`; `node:*` rules unchanged.
- `decks/tools/goguard.mjs` (= MorphV2's Go guard) and `templates/go/decks/tools/guard.mjs`: a non-standard direct
  import (`go list … .Imports`) is allowed when it equals an allowed module path or begins with `<path>/`, else
  `guard: package <dir> imports <imp> (the standard library only)` with no list, `(the standard library and <paths joined
  by ", "> only)` with one.
- MorphV2's own `decks/tools/guard.mjs` is unchanged: its `src` mode ignores a third argument and keeps its one-file
  `yaml` rule (`YAML_FILE = "src/contour/load.ts"`), stricter than the declaration.

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P19b deps"; #10 = issue VasyaLutiy/morph#10):

- **Optional fields** · `CardContext.allowed?`, `CardContext.vendor?`, `BuildInput.uses?`, `BuildInput.vendor?`; absent =
  `[]`, `false`, `{}` · every existing caller, test literal (`ctx(over): CardContext` of three test files) and fixture
  stays valid and byte for byte; ripple 0 of 776.
- **The guard's argument** · a third positional argument `'<names joined by ",">'`, single-quoted, written only when the
  list is not empty, after the code files and before `; node $P/guard.mjs tests …` · a dependency-free acceptance is byte
  for byte; npm names and Go module paths hold no `'` or `,`; old guards ignore an extra argument.
- **The order** · the builder keeps `uses` as given (record order from Plan Spec); nothing sorted or deduplicated ·
  P19a "record order"; one owner of the order.
- **Judges** · a judge's acceptance never names packages and its Go env follows `vendor` · P19a "judges keep their import
  rules"; a Go judge still builds the vendored code it tests.
- **Vendor flag** · `vendor/modules.txt` a regular file under root at plan time → every Go acceptance of the deck
  (code and judge) exports `GOFLAGS=-mod=vendor`; else today's `GO_ENV` byte for byte; `GOPROXY=off` in both · issue
  #10; the deck is cut after P0 vendored the modules; a TypeScript deck ignores it.
- **Direct imports** · the Go guard checks a package's direct imports (`go list -e -f {{.Imports}}`), not `-deps` · the
  transitive imports of a declared module are its own (P19a §7 "Also out"); `-deps` would list the standard library and
  the module's internals.
- **Prefix rule** · an import is allowed when it equals a declared path or starts with `<path>/` (TypeScript: the package
  or a subpath export) · issue #10 "the declared module paths"; `github.com/dustin/go-humanize/english` is the same module.
- **MorphV2's guard** · unchanged; `yaml` declared in `contour.yaml` with `uses: [yaml]` on Component contour reaches its
  cards as the finale sentence, the doc in the slice and the guard argument, which this guard ignores · the operator's
  P19 scope (#10): the one-file rule stays, stricter than the Component-wide declaration.
- **MorphV2's `yaml`** · `{name: yaml, version: "2.9.1", language: typescript, doc: docs/deps/yaml.md}` (package-lock's
  exact version; quoted) after the groups; `docs/deps/yaml.md` 4 437 B, from the package's README and `.d.ts` files, every
  value measured on 2.9.1 · issue #10 item 5.
- **Templates** · `templates/common/docs/{AUTONOMY,TASK_TEMPLATE,PLAN}.md` gain the dependency regulation (§7 of this
  spec lists it as data); no phase number, project name or date in templates (`decks/p18/smoke/leak.sh` 0 lines) · P18.
- **Go P0 recipe** · `go get <path>@<version>` for each declared module, a `internal/deps/tools.go` with `//go:build tools`
  importing each module's package (`go mod vendor` ignores build tags, so the packages are vendored before any card
  imports them; the package is never built), `go mod tidy`, `go mod vendor`, commit go.mod, go.sum, vendor/ and
  tools.go · measured: without the importing file `vendor/modules.txt` lists the module with no package and a card's
  import fails under `-mod=vendor`.

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/builder/types.ts`, `compose.ts` | PATCH | probe only | NEW `tests/builder/compose.p19.examples.test.ts` (CA 3, JA 4) |
| `src/builder/goAcceptance.ts` | PATCH | probe only | NEW `tests/builder/goAcceptance.p19.examples.test.ts` (GA 6, 7) |
| `src/builder/buildAcceptances.ts` | PATCH | probe only | NEW `tests/builder/buildAcceptances.p19.examples.test.ts` (BA 7, 8) |
| `src/cli/planCommand.ts` | PATCH | probe only | NEW `tests/cli/planCommand.p19.examples.test.ts` (PC 10, 11) |

- `compose.p19.examples`: "Code Acceptance example 3: …", "Judge Acceptance example 4: …"; the ctx helper of §2.1; each
  expected script `fixture("builder/code1.txt").replace(<the old line text>, <the new line text>)`, both written out.
- `goAcceptance.p19.examples`: "Go Acceptance example 6: …", "7: …"; GO_ENV_VENDOR's line written out whole; the go ctx
  helper; expected scripts from `fixture("builder/go/code1.txt")`, `judge1.txt`, `code2.txt` with `.replace`.
- `buildAcceptances.p19.examples`: "Build Acceptances example 7: …", "8: …"; the card and checks helpers of §2.1; a's
  expected acceptance from codeAcceptance, the judge's from goJudgeAcceptance, percent-of's from the fixture.
- `planCommand.p19.examples`: "Plan Command example 10: …", "11: …"; the deps root skeleton of §2.1, every root removed in
  finally; acceptances compared with toBe against codeAcceptance / goCodeAcceptance of the ctx the table gives.
- A judge's own tests: at most 6 more, only on values this section, the record or a fixture prints for that exact input.

### 2.4. What must not break

- Byte for byte: every file outside the 5 code targets and the 4 new test files of §2.3 — every other `src/` file,
  `tests/helpers.ts`, every existing test file; `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/`,
  `templates/` — untouched by every card (frozen).
- **Dependency-free decks byte-identical**: the cut of `tests/fixtures/go-mini` (Plan Command 9's `cli/goMini.deck.json`
  stays green) and the P15 deck re-cut, by main's binary (a4e53ef) and by this phase's reference binary on the same tree
  (§11).
- The decks of this repository are not re-cut by this phase: a re-cut of a deck holding contour cards would now carry the
  `yaml` finale sentence and `docs/deps/yaml.md` (by design, P19a); P9's and P19a's decks stay as committed.
- 776 tests in 121 files green at every card (no deck-wide exclusion); after the run **776 + CA 1 + JA 1 + GA 2 + BA 2 +
  PC 2 = 784** in 125 files (± the judges' own tests).

## 3. Acceptance

Built by `morph plan --checks decks/p19b/checks.json`, narrow to broad, every stage printing `== <stage>`. `ownGit: true`
(the full suite spawns git in its tmpRepos), `frozen` the defaults + `templates`, `fullExclude` none (ripple 0).

Code cards (no test file; code-only targets): `probe/<card>/` → `tsc` (per-card tsconfig excluding the generation's
other targets) → `eslint <targets>` → `guard.mjs src <targets>` → the probe `decks/p19b/parts/<card>.probe.ts`
(compose CA 1, 3, JA 4 + 1 row = 4; go-acceptance GA 1, 6, 7 + 1 row = 4; build-acceptances BA 7, 8 + 2 rows = 4;
plan-command PC 10, 11 + 1 row = 3; **15 tests**) → eslint's verdict → full `vitest run` → own git → frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs tests <file> <min> <max> lits0.json` → `vitest
run <targets>` → eslint's verdict → full run → own git → frozen → untracked.

| file | new | min | max | lits |
|---|---|---|---|---|
| `tests/builder/compose.p19.examples.test.ts` | yes | 2 | 8 | `Code Acceptance example 3`, `Judge Acceptance example 4`, `builder/code1.txt`, `builder/code2.txt`, `builder/judge1.txt`, `@scope/pkg`, `ajv` |
| `tests/builder/goAcceptance.p19.examples.test.ts` | yes | 2 | 8 | `Go Acceptance example 6`, `… 7`, `GOFLAGS=-mod=vendor`, `github.com/dustin/go-humanize`, `golang.org/x/text`, `golang.org/x/mod`, `builder/go/code1.txt`, `builder/go/judge1.txt`, `builder/go/code2.txt` |
| `tests/builder/buildAcceptances.p19.examples.test.ts` | yes | 2 | 8 | `Build Acceptances example 7`, `… 8`, `'zod,yaml'`, `a-judge`, `github.com/dustin/go-humanize,golang.org/x/text`, `builder/go/code1.txt` |
| `tests/cli/planCommand.p19.examples.test.ts` | yes | 2 | 8 | `Plan Command example 10`, `… 11`, `planner/deps.yaml`, `planner/deps.map.json`, `vendor/modules.txt`, `'yaml,zod'`, `'github.com/google/go-cmp'`, `GOFLAGS=-mod=vendor` |

min = the record's new examples; max = min + 6 (new files).

**Output budget** (`max_tokens`, before the session's ×3 for `ds`):

| card | returns | `max_tokens` |
|---|---|---|
| compose | types.ts + compose.ts ≈ 4.4 KB, two whole files | 12 000 |
| go-acceptance | goAcceptance.ts ≈ 6.4 KB whole | 16 000 |
| build-acceptances | buildAcceptances.ts ≈ 5.7 KB whole | 14 000 |
| plan-command | planCommand.ts ≈ 4.3 KB whole | 12 000 |
| compose-judge, go-acceptance-judge, build-acceptances-judge | ≈ 3–5 KB new file each | 16 000 |
| plan-command-judge | ≈ 6 KB new file (two tmp roots) | 20 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- **Layers** (guard, unchanged): builder imports cards, language and node:path only (goAcceptance imports compose for
  allowArg, as it imports litsJson); cli imports what it imports today. No clock, no environment, no file system in the
  builder; planCommand reads files only through what it uses today (`hasFile`).
- A file a card writes is in no sibling's slice in the same generation: generation 0 [compose]; 1 [compose-judge,
  go-acceptance] read types.ts and compose.ts (generation 0); 2 [build-acceptances, go-acceptance-judge] read
  goAcceptance.ts (generation 1), not each other's target; 3 [build-acceptances-judge, plan-command] read
  buildAcceptances.ts (generation 2) and builder/types.ts; 4 [plan-command-judge] reads planCommand.ts.
- Tests write only under `tmpRoot()` and remove it; no JS timer; no network; a judge writes only its target.

## 7. Out of scope

The data of this phase (written by the orchestrator, committed before the run, no card touches it):
1. the guards (§2.2): `decks/tools/goguard.mjs`, `templates/go/decks/tools/guard.mjs`, `templates/typescript/decks/tools/guard.mjs`;
2. MorphV2's `contour.yaml` declaring `yaml` 2.9.1 with Component contour `uses: [yaml]`; `docs/deps/yaml.md`;
3. `templates/common/docs/AUTONOMY.md`, `TASK_TEMPLATE.md`, `PLAN.md`: the architect declares dependencies in the record,
   the operator approves them with the plan, P0 installs them once with the network (Go: `go get`, a tools.go with
   `//go:build tools`, `go mod tidy`, `go mod vendor`, commit vendor/; TypeScript: exact versions in package.json +
   package-lock.json, `npm ci`; Python: a venv + a pinned requirements file), every acceptance after P0 offline, the
   2–5 KB API digest (signatures + one example, from the library's own docs and types, values measured);
4. issue #10's two smokes, recipes in `decks/p19b/smoke/` (run by the main session **after the merge**, §8).

Also out: a dependency's transitive imports; version resolution or download by Morph; a Python acceptance builder
(Python gets the directive only, P19a); a TypeScript judge importing a declared package (judges keep their rules); a
`vendor/` check at run time (the flag is read at plan time; a deck cut before P0 vendored is re-cut).

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component builder --component builder-go \
  --component cli --judge --checks decks/p19b/checks.json --out decks/p19b/deck.json
python3 decks/p19b/filter.py decks/p19b/deck.json                 # keeps the 8 cards of the phase
python3 decks/tools/scale_tokens.py decks/p19b/deck.json 3        # processor ds
node dist/cli.js deck check --root . --deck decks/p19b/deck.json                                  # errors 0
rm -rf /tmp/v2bin-p19b && mkdir -p /tmp/v2bin-p19b && cp -r dist /tmp/v2bin-p19b/ && ln -s $PWD/node_modules /tmp/v2bin-p19b/node_modules \
  && ln -s $PWD/templates /tmp/v2bin-p19b/templates
node /tmp/v2bin-p19b/dist/cli.js run --root . --deck decks/p19b/deck.json --processor ds --deadline 2400
```

After the merge, the smokes (`decks/p19b/smoke/README.md`): `npm run build`, a fresh binary copy
`/tmp/v2bin-p19b-smoke` (dist + node_modules + templates linked), then `BIN=/tmp/v2bin-p19b-smoke OUT=/tmp/p19b-smoke
decks/p19b/smoke/run.sh go typescript` (dry: init, P0 with the network once, plan --checks, deck check, the planted
imports, the TypeScript stub run) and `S1_RUN=1 … run.sh go` (the live Go run on ds, cap $0.02, then the offline
verification).

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 8 (4 code, 4 judges) / 5: [compose] [compose-judge, go-acceptance] [build-acceptances, go-acceptance-judge] [build-acceptances-judge, plan-command] [plan-command-judge] |
| executor bill | ≈ $0.06–0.15 on ds ×3 (P19a: 8 cards $0.0935; P18: 5 cards $0.1054); ≤ $0.30 with a re-cut; cap $5 |
| cards with regeneration | 0–2 of 8 (go-acceptance: the env line of the judge forgotten; plan-command-judge: the smoke caps or the card order of example 10) |
| tests after the run | 784 ± 6 in 125 files |
| first red | compose: the argument written for an empty list, or after the tests part; go-acceptance: `-mod=vendor` only in the code card; build-acceptances: `uses[id]` without the own-key check, or a sorted list; plan-command: `existsSync` (a directory passes) |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no answer cut at its `max_tokens`; (3) after the run no
file outside §2.3's nine changed; (4) every dependency-free acceptance byte for byte (Plan Command 9 green, the go-mini
and P15 re-cuts identical); (5) this repository's HEAD and refs unchanged by every card.

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the MEASURE row with
its `прогоны` cell, the vitest log of every verify run; DECISIONS lines "P19b deps"; the byte-identity re-cuts after the
merge (go-mini and P15 against main's binary a4e53ef); the two smokes' numbers (🧪) and then the stop for the operator.

## 11. Actual

### Gate (preparation)

(filled below by the preparing orchestrator)
