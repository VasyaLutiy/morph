# TASK_P15 — golang: the Go profile, the Go acceptance builder, `plan --checks` by the Component's language, Go tests in the primer (`src/language/{types,profiles}.ts`, `src/builder/{goAcceptance,buildAcceptances}.ts`, `src/cli/{planCommand,readPlanChecks}.ts`, `src/primer/primerCommand.ts`)

> Phase P15 of `docs/PLAN.md` ("Фазы по записи": `P15 | language + builder + primer (golang) | issue #6`), operator 08.10.
> Issue VasyaLutiy/morph#6 (label `P15-golang`, the only open issue with a P15 label, 08.10) is built into the record:
> its §1 profile table, its §2 TypeScript-assuming places and its §3 go-mini validation; its §3 "small real project" is
> NOT in P15 (the operator names it later). Components of `contour.yaml`: **language** (Resolve Profile: the go profile),
> **builder-go** (NEW: Go Acceptance, layer builder — builder is 25 821 bytes, the Go branch 8 588 more would pass the
> 30 000 rule; the P13b/P14b pattern), **builder** (Build Acceptances: the go branch, probeFile), **cli** (Plan Command,
> Read Plan Checks; compacted first), **primer** (Primer Command: the go rule; compacted first), **planner** (two
> examples follow the known-language list). The deck is cut by V2 (`morph plan --component language --component
> builder-go --component builder --component cli --component primer --component planner --judge --checks
> decks/p15/checks.json`), filtered to this phase's 12 cards by `decks/p15/filter.py`. No split (12 cards, the bound).
> After the merge: the smoke stop of AUTONOMY (§8, go-mini end to end).

## 1. Why this

- **MorphV2 cuts and accepts TypeScript only.** `PROFILES` holds typescript and python (P8); `buildAcceptances`
  refuses every profile but typescript (`no acceptance builder for language 'python' (only typescript)`); `morph plan
  --checks` takes its profile from the map alone (`resolveProfile(null, map.language)`), so a record whose Components
  say `language: go` would get TypeScript acceptances; the primer counts 0 Go tests (`testCallPattern` knows two ids).
- **The risk the issue names is "who checks the checker".** A wrong profile would accept bad code silently. Measured
  at this gate on `tests/fixtures/go-mini/` with the reference: a Go deck of **6 cards in 4 generations** cut by V2,
  every probe red on Go stubs per example (5 + 6 + 4 FAIL lines), five broken attempts red at their own stage (build,
  vet, gofmt, probe, guard), the reference green in 3.7 s for the six chains, **29 Go mutants, 26 killed, 3 equivalent**
  (§11).
- **Ripple, measured** (the 7 reference files in a scratch worktree from 932e73f, full suite): **5 of 736** red in 4
  files — `tests/language/profiles.examples.test.ts` (Resolve Profile example 4: `go` is now known; the own test of a
  whitespace-only value: the known list), `tests/planner/cut.examples.test.ts` (Cut Component example 4),
  `tests/planner/plan.examples.test.ts` (Plan Spec example 4) — the list `(known: typescript, python)` gains `go` —
  and `tests/builder/buildAcceptances.examples.test.ts` (example 4: `(only typescript, go)`). Every other shape is new.
- **Record sizes** (bytes of each Component block): cli 29 861 → **28 934** (compaction first: Run Command 4, 6, 7 and
  Plan Command 5 moved to `tests/fixtures/cli/examples.json` by key, every long ref shortened to the file name; then
  Plan Command, Read Plan Checks and example 9); primer 29 880 → **29 161** (Primer Command 6 moved to the new
  `tests/fixtures/primer/examples.json`; then the go rule and example 7); language 15 186 → 15 622; builder 24 000 →
  25 821; builder-go new **8 588**; planner 29 497 → 29 509.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main** (module → what the new code calls or constructs): `src/language/types.ts` — `LanguageProfile`
  `{id, extensions, testDirs, testFilePattern, nameCase, codeTarget, testTarget, judgeTarget, parseLine,
  parseTakesFiles, lintLine, ownTestLine, fullRunLine, finale, judgeInstruction, helpersModule}`, `ProfileId`;
  `src/language/paths.ts` — `codeTargets(profile, targets)`, `testTarget(profile, targets)`, `hasExtension(profile,
  path)` (the path's lower-cased posix extension among `profile.extensions`); `src/builder/steps.ts` — `heredoc(path,
  body, tag)`, `wrapScript(id, phase, targets, body)`, `frozenStep(paths)`, `untrackedStep(targets)`, `OWN_GIT_BEFORE`,
  `OWN_GIT_AFTER`; `src/builder/compose.ts` — `litsJson(lits)`, `codeAcceptance(ctx, probe, smoke, extra)`,
  `judgeAcceptance(ctx, files)`; `src/builder/types.ts` — `CardContext {id, phase, targets, siblings, frozen,
  fullExclude, ownGit, profile, guard, firstdiff}`, `JudgeFile {file, min, max, lits, drop, new}`, `Checks`,
  `BuildInput`, `BuildResult`; `src/builder/readChecks.ts` — `DEFAULT_FROZEN`; `src/contour/types.ts` —
  `ContourRecord` (`system.groups: Component[]`, each `{name, language: string | null, …}`), `ContourMap` (`language:
  string | null`); `src/language/profiles.ts` — `resolveProfile(componentLanguage, mapLanguage)`, `TYPESCRIPT`.
- **Preconditions of the callees.** planner · Plan Spec has already refused an unknown language of the map and of
  every selected Component before planCommand resolves the checks' profile (PC 9: the resolve cannot fail there).
  builder · wrapScript puts the body inside `( set -e … )`, so `F=$(…)` of a failing command ends the script (GA 1:
  the gofmt step ends in `|| true`). git · the tmpRepo of `tests/helpers.ts` commits "init" first (PrC 7: files 5 are
  the five written, no more).
- **The Go profile** — `tests/fixtures/language/go.json`, the whole object (keys in the type's order): id `go`,
  extensions `[".go"]`, testDirs `[]`, testFilePattern `^.*_test\.go$`, nameCase `snake`, codeTarget
  `{component}/{name}.go`, testTarget `{component}/{name}_test.go`, judgeTarget `{component}/{name}_examples_test.go`,
  parseLine `go build ./...`, parseTakesFiles false, lintLine `go vet ./...`, ownTestLine `go test -count=1
  ./$(dirname {test})/`, fullRunLine `go test -count=1 ./...`, finale and judgeInstruction (Go 1.22, standard library
  only, gofmt, `func Test<Function>Example<n>`, `testhelp.Equal` of the module's `internal/testhelp`), helpersModule
  `internal/testhelp/testhelp.go`.
- **Fixtures** (`tests/fixtures/`), each by the type the Function takes:

| file | type | what it is | what the Function returns on it |
|---|---|---|---|
| `language/go.json` | ONE profile object | the go profile, verbatim | Resolve Profile 5: `{ok: true, profile}` equal to it |
| `builder/go/code1.txt`, `code2.txt` | text, no final newline | two whole Go code scripts (32 and 37 lines) | Go Acceptance 1, 2; Build Acceptances 5 (code1) |
| `builder/go/judge1.txt`, `judge2.txt` | text, no final newline | two whole Go judge scripts (30, 38 lines) | Go Acceptance 3, 4 |
| `builder/go/steps.txt` | text, 3 lines with newlines | goTestStep + two goNamesKept | Go Acceptance 5 |
| `go-mini/` | a TREE (8 files used) | the Go module of the gate: `contour.yaml` (Components calc: Clamp Value, Percent Of; report: Format Share; both `language: go`), `morph-map.json` (no language; docs `["go.mod"]`; code-only targets, `intent: generate`), `go.mod` (`module mini`, go 1.22), `internal/testhelp/testhelp.go` (Equal, WriteFile), `decks/m1/checks.json` (6 cards), `decks/m1/parts/_<id>_probe_test.go` ×3; also `.gitignore` (`probe/`) and `decks/tools/layers.json` (the Go guard's table) | Plan Command 9: the deck of `cli/goMini.deck.json` |
| `cli/goMini.deck.json` | text: the deck file (JSON array of 6 cards, indent 2, final newline) | V2's cut of go-mini with `// guard\n` and `// firstdiff\n` as the tools | Plan Command 9: cards equal its parse; the deck file equals its text |
| `cli/examples.json` | ONE object | key `"Plan Command 9"` added (and Run Command 4, 6, 7, Plan Command 5 moved from the record) | Plan Command 9 |
| `primer/examples.json` | ONE object, NEW | `"Primer Command 6"` (moved) and `"Primer Command 7"`: the file texts | Primer Command 7: `{language "go", files 2, tests 4}`, files 5 |

- **Harness skeletons** (only `tests/helpers.ts`, `node:fs`, `node:path`):

```ts
// Go Acceptance (the judge's ctx helper, verbatim):
const ctx = (over: Partial<CardContext>): CardContext => ({
  id: "percent-of", phase: "m1", targets: ["calc/percent_of.go"], siblings: ["calc/clamp_value_examples_test.go"],
  frozen: ["go.mod", "internal"], fullExclude: [], ownGit: false, profile: GO, guard: "// guard\n",
  firstdiff: "// firstdiff\n", ...over,
});
// Plan Command 9 (the go-mini root): r = tmpRoot(); for f of MINI: r.write(f, fixture("go-mini/" + f));
//   MINI = ["contour.yaml", "morph-map.json", "go.mod", "internal/testhelp/testhelp.go", "decks/m1/checks.json",
//     "decks/m1/parts/_clamp-value_probe_test.go", "decks/m1/parts/_percent-of_probe_test.go",
//     "decks/m1/parts/_format-share_probe_test.go"];
//   r.write("decks/tools/guard.mjs", "// guard\n"); r.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
//   args = {name "plan", root ".", pretty false, spec "contour.yaml", components ["calc", "report"], map "morph-map.json",
//     judge true, out "decks/m1/deck.json", checks "decks/m1/checks.json"}; planCommand(r.root, args)
//   then: r.write("contour.yaml", <its text without the two "      language: go\n" lines>);
//   r.write("morph-map.json", JSON.stringify({language: "go", ...<the map parsed>}, null, 2) + "\n"); out "decks/m1/deck2.json"
// Primer Command 7: t = tmpRepo(); t.write each file of examples.json["Primer Command 7"] with its exact text;
//   primerCommand(t.root, false, {env: {PATH: process.env.PATH ?? ""}, now: () => 1791400000000})
```

**Distinct markers.** Card ids `percent-of`, `clamp-value-judge`, `a`, `b`, `ab-judge`, `m7`, `z9`, `w`, `v`; phases
`m1`, `p2`, `p3`, `q2`, `q4`; packages `./calc`, `./report`, `./q`, `./k`, `.`; probe paths `calc/percent-of_probe_test.go`,
`m7_probe_test.go`; test names `TestPercentOfExample1`, `TestAExample4`, `TestA_old`, `TestBExample2`. The code
hard-codes none of them: ids, phases, targets, siblings, excludes and the probe text are arguments; GO_ENV,
GO_LINT_VERDICT, the stage names, the go commands and flags are the contract.

### 2.2. OUTPUT data shapes

**`src/language/types.ts`, `src/language/profiles.ts`** (PATCH; one card owns the two):

```ts
export type ProfileId = "typescript" | "python" | "go";
export const GO: LanguageProfile;   // tests/fixtures/language/go.json verbatim, after PYTHON
export const PROFILES: readonly LanguageProfile[] = [TYPESCRIPT, PYTHON, GO];
```

Everything else unchanged: `TYPESCRIPT`, `PYTHON`, `DEFAULT_LANGUAGE`, `resolveProfile` (its known list comes from
PROFILES: `unknown language '<choice>' (known: typescript, python, go)`), `fillTemplate`. Through the unchanged
functions the go profile gives: `cutTargets(GO, "calc", "Clamp Value")` → `calc/clamp_value.go`,
`calc/clamp_value_test.go`, `calc/clamp_value_examples_test.go`; `isTest(GO, p)` by `*_test.go` only (testDirs `[]`);
`profileForPath("x/y.GO")` → go; `acceptanceLines(GO, ["report/f.go", "report/f_test.go"])` → `["go build ./...", "go vet
./...", "go test -count=1 ./$(dirname report/f_test.go)/", "go test -count=1 ./..."]` (the planner's default script;
`--checks` replaces it).

| Resolve Profile example | given | result |
|---|---|---|
| 4 (changed) | `"rust"`, `"python"` | `{ok: false, error: "unknown language 'rust' (known: typescript, python, go)"}` |
| 5 | `"Go"`, null | `{ok: true, profile}` equal to `language/go.json` (the registry object GO) |

**`src/builder/goAcceptance.ts`** (NEW, layer builder; imports `heredoc`, `wrapScript`, `frozenStep`, `untrackedStep`,
`OWN_GIT_BEFORE`, `OWN_GIT_AFTER` from `./steps.js`, `litsJson` from `./compose.js`, `codeTargets`, `hasExtension`,
`testTarget` from `../language/paths.js`, `posix` from `node:path`; no other Node module, no clock, no process) —
exports, in this order:

```ts
export const GO_ENV: string;            // 'export GOFLAGS=-mod=mod GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOWORK=off GOCACHE="${GOCACHE:-/tmp/morph/go-build}" GOPATH="${GOPATH:-/tmp/morph/go}"\n'
export const GO_LINT_VERDICT: string;   // '[ "$E" = 0 ] || { echo "== vet or gofmt failed (see above); every step between it and here passed"; exit 1; }\n'
export function goPackages(paths: readonly string[]): string[];
export function overlayJson(hidden: readonly string[]): string;
export function goProbePath(id: string, code: string): string;
export function goDir(id: string, guard: string, firstdiff: string, siblings: readonly string[],
  fullExclude: readonly string[], probePath: string | null): string;
export function goTestStep(args: string): string;
export function goLintSteps(targets: readonly string[]): string;
export function goNamesKept(file: string, drop: readonly string[]): string;
export function goCodeAcceptance(ctx: CardContext, probe: string, smoke: number | null, extra: string | null): string;
export function goJudgeAcceptance(ctx: CardContext, files: readonly JudgeFile[]): string;
```

| function | value |
|---|---|
| goPackages | per path: `d = posix.dirname(path)`; `d === "." ? "." : "./" + d`; distinct, first seen first |
| overlayJson | `JSON.stringify({Replace: R}) + "\n"`, R = an object with key `p` → `""` for each p ending ".go", in order (go's `-overlay`: an empty replacement deletes the file for that command) |
| goProbePath | `d = posix.dirname(code)`; `d === "." ? id + "_probe_test.go" : d + "/" + id + "_probe_test.go"` |
| goDir | `"P=$PWD/probe/" + id + "; rm -rf $P; mkdir -p $P; trap 'rm -rf $P" + (probePath ? " " + probePath : "") + "' EXIT\n"` + heredoc("$P/guard.mjs", guard, "MORPH_GUARD_EOF") + heredoc("$P/firstdiff.mjs", firstdiff, "MORPH_FIRSTDIFF_EOF") + heredoc("$P/overlay.json", overlayJson(siblings), "MORPH_CONF_EOF") + heredoc("$P/full.json", overlayJson(fullExclude), "MORPH_CONF_EOF") |
| goTestStep | `"go test -count=1 " + args + " > $P/gt.log 2>&1 \|\| { if grep -q '^--- FAIL' $P/gt.log; then awk '/^--- FAIL/{p=1} p' $P/gt.log \| grep -vE '^(ok[[:space:]]\|PASS$\|FAIL$)' \| head -200; else tail -60 $P/gt.log; fi; node $P/firstdiff.mjs $P/gt.log; exit 1; }\n"` |
| goLintSteps | f = the targets ending ".go" joined by " "; `"echo '== vet'; E=0; go vet -overlay $P/overlay.json " + goPackages(those).join(" ") + " \|\| E=1\n"` + `"echo '== gofmt'; F=$(gofmt -l " + f + ' 2>&1) \|\| true; [ -z "$F" ] \|\| { echo "gofmt -l lists: $F"; gofmt -d ' + f + " 2>&1 \| head -60; E=1; }\n"` |
| goNamesKept | `"echo '== names " + file + "'; git show HEAD:" + file + " \| grep -oE '^func Test[A-Za-z0-9_]*' \| sed -E 's/^func //'"` + `" \| grep -vxF " + JSON.stringify(name)` per dropped name + `" > $P/names \|\| true; while IFS= read -r n; do grep -qE \"^func $n\\(\" " + file + ' \|\| { echo "test removed: $n"; exit 1; }; done < $P/names\n'` |

**goCodeAcceptance(ctx, probe, smoke, extra)**: code = codeTargets(ctx.profile, ctx.targets); test = smoke !== null ?
testTarget(ctx.profile, ctx.targets) : null; probePath = goProbePath(ctx.id, code[0]). The body, in order:

1. GO_ENV; goDir(ctx.id, ctx.guard, ctx.firstdiff, ctx.siblings, ctx.fullExclude, probePath); OWN_GIT_BEFORE when ctx.ownGit;
2. `"echo '== build'; go build -overlay $P/overlay.json " + goPackages(code).join(" ") + "\n"`;
3. goLintSteps(the targets with hasExtension(ctx.profile, t));
4. `"echo '== guard'; node $P/guard.mjs src " + code.join(",")` + (test ? `"; node $P/guard.mjs tests " + test + " 1 " + smoke` : "") + "\n";
5. `"echo '== probe'; " + heredoc(probePath, probe, "MORPH_PROBE_EOF")` + goTestStep("-overlay $P/overlay.json -run '^TestProbe' " + goPackages([probePath]).join(" ")) + `"rm -f " + probePath + "\n"`;
6. with a test: `"echo '== own'; " + goTestStep("-overlay $P/overlay.json " + goPackages([test]).join(" "))`;
7. GO_LINT_VERDICT; extra when not null; `"echo '== full'; " + goTestStep("-overlay $P/full.json ./...")`;
8. OWN_GIT_AFTER when ctx.ownGit; frozenStep(ctx.frozen); untrackedStep(ctx.targets).

→ wrapScript(ctx.id, ctx.phase, ctx.targets, body).

**goJudgeAcceptance(ctx, files)**: GO_ENV; goDir(…, null); OWN_GIT_BEFORE when ownGit; goLintSteps(ctx.targets); for
the n-th file heredoc("$P/lits" + n + ".json", litsJson(f.lits), "MORPH_LITS_EOF") + `"echo '== guard " + f.file + "';
node $P/guard.mjs tests " + f.file + " " + f.min + " " + f.max + " $P/lits" + n + ".json\n"`; goNamesKept(f.file,
f.drop) for every file not new; `"echo '== own'; " + goTestStep("-overlay $P/overlay.json " +
goPackages(ctx.targets).join(" "))`; GO_LINT_VERDICT; the full step; OWN_GIT_AFTER when ownGit; frozenStep;
untrackedStep → wrapScript. No build and no probe.

| Go Acceptance example | given | result |
|---|---|---|
| 1 | ctx() (§2.1); probe "package calc\n", smoke null, extra null | `builder/go/code1.txt`: build, vet, gofmt, guard, probe written to `calc/percent-of_probe_test.go` and removed, verdict, full, frozen, untracked; overlay `{"Replace":{"calc/clamp_value_examples_test.go":""}}` |
| 2 | ctx({id "a", phase "p2", targets ["report/a.go", "report/a_test.go"], siblings [], frozen DEFAULT_FROZEN, fullExclude ["calc/old_test.go"], ownGit true}); probe "package report\n", smoke 5, extra "echo '== bin'; true\n" | `builder/go/code2.txt` |
| 3 | ctx({id "percent-of-judge", targets ["calc/percent_of_examples_test.go"], siblings ["report/format_share.go"]}); files [{calc/percent_of_examples_test.go, 5, 11, lits ["TestPercentOfExample1", "0% (0 of 0)"], drop [], new true}] | `builder/go/judge1.txt` |
| 4 | ctx({id "ab-judge", phase "p3", targets ["calc/a_examples_test.go", "report/b_examples_test.go"], siblings [], frozen DEFAULT_FROZEN, fullExclude ["report/b_examples_test.go"], ownGit true}); files [{a, 3, 11, ["TestAExample1"], [], true}, {b, 4, 4, [], ["TestBExample2"], false}] | `builder/go/judge2.txt` |
| 5 | goTestStep("-overlay $P/overlay.json ./calc") + goNamesKept("calc/a_examples_test.go", ["TestAExample4", "TestA_old"]) + goNamesKept("report/b_test.go", []); goPackages(["calc/a.go", "calc/a_test.go", "main.go", "x/y/z.go"]); overlayJson(["calc/b.go", "README.md", "x/c_test.go"]); goProbePath("a", "calc/a.go"), goProbePath("m", "main.go") | `builder/go/steps.txt`; `["./calc", ".", "./x/y"]`; `{"Replace":{"calc/b.go":"","x/c_test.go":""}}` + "\n"; `calc/a_probe_test.go`, `m_probe_test.go` |

Rows (probe only): the two constants; `overlayJson([])` = `{"Replace":{}}` + "\n"; goLintSteps over `q/x.go`, `README.md`,
`q/x_test.go`; goDir's first line with and without a probe path and its two overlays; a root-package card `main.go`
(`go build … .`, probe `m7_probe_test.go`, no own step).

**`src/builder/buildAcceptances.ts`** (PATCH; imports `goCodeAcceptance`, `goJudgeAcceptance` from `./goAcceptance.js`,
`hasExtension` beside `testTarget`, the type `LanguageProfile`) — additions only, every other check, message and order
unchanged:

```ts
export function probeFile(profile: LanguageProfile, id: string): string;   // go: "_" + id + "_probe_test.go"; else id + ".probe.ts"
```

| rule | value |
|---|---|
| refused profile | `profile.id` neither "typescript" nor "go" → `{ok: false, errors: ["no acceptance builder for language '<id>' (only typescript, go)"]}` |
| wrong target | per checks card, right after "checks card '<id>' is not in the deck" (that card then has no other check): no target t with hasExtension(profile, t) → `card '<id>' has no <profile.id> target`; the judge and probe checks of that card follow as before |
| the go branch | profile go: a code member gets goCodeAcceptance(ctx, probe, smoke, extra), a judge goJudgeAcceptance(ctx, files) — the same ctx (siblings by generation, frozen, fullExclude, ownGit, the texts) |
| probeFile | the leading "_" makes the go tool ignore the probe where it is kept (`decks/<phase>/parts` is inside the module: a `_test.go` file there would be compiled by `go test ./...` as a package of its own) |

| Build Acceptances example | given | result |
|---|---|---|
| 4 (changed) | the python profile | `{ok: false, errors: ["no acceptance builder for language 'python' (only typescript, go)"]}` |
| 5 | go; cards percent-of (`calc/percent_of.go`), clamp-value-judge (`calc/clamp_value_examples_test.go`); checks phase m1, frozen ["go.mod", "internal"], files [{…examples_test.go, 4, 10, ["TestClampValueExample1"], new}]; probes {percent-of: "package calc\n"} | ok; percent-of = `builder/go/code1.txt`; the judge = goJudgeAcceptance(ctx with siblings ["calc/percent_of.go"]) |
| 6 | go; cards a (`src/x/a.ts`), b (`calc/b.go`); checks a, b; probes {a}; probeFile(go, "percent-of"), probeFile(typescript, "a") | `{ok: false, errors: ["card 'a' has no go target", "code card 'b' has no probe"]}`; `_percent-of_probe_test.go`; `a.probe.ts` |

**`src/cli/readPlanChecks.ts`, `src/cli/planCommand.ts`** (PATCH; one card owns the two: planCommand passes the profile
the reader gains):

```ts
export function readPlanChecks(root: string, checksPath: string, profile: LanguageProfile = TYPESCRIPT): PlanChecksResult;
```

- readPlanChecks: a code card's probe is `path.resolve(root, checks.parts, probeFile(profile, card.id))` when regular;
  every other check, message and order byte for byte (its examples 1–3 keep passing with the default).
- planCommand, with args.checks, right after Plan Spec succeeded: `first` = the record's Component whose name is
  `plan.components[0]` (none → undefined); `profiled = resolveProfile(first?.language ?? null, map.language)`; not ok →
  `{code 2, DeckError "the map: " + error}` (unreachable after Plan Spec, kept for the type); then
  `readPlanChecks(root, args.checks, profiled.profile)`; `buildAcceptances({…, profile: profiled.profile, …})`. Without
  args.checks nothing changes. A deck of two languages builds by the first selected Component's (a card of the other
  language is refused by Build Acceptances: `card '<id>' has no <id> target`).

| Plan Command example | given (`examples.json`) | result |
|---|---|---|
| 9 | the go-mini root (§2.1); then the language moved from the Components to the map, out `decks/m1/deck2.json` | code 0; components ["calc", "report"]; generations `[["clamp-value"], ["clamp-value-judge", "percent-of"], ["format-share", "percent-of-judge"], ["format-share-judge"]]`; cards = `goMini.deck.json` parsed; `decks/m1/deck.json` = its text; then code 0 and `deck2.json` = the same text |

Rows (probe only): `--component report` alone with a one-card checks file → format-share's acceptance holds its Go probe;
the percent-of Go probe deleted (a `percent-of.probe.ts` beside it) → `acceptances not built (1 error):\ncode card
'percent-of' has no probe` and no deck file; readPlanChecks with go reads `_a_probe_test.go`, by default `b.probe.ts`.

**`src/primer/primerCommand.ts`** (PATCH): the call rule of profile id `go` is `/^func Test(?:[A-Z0-9_]\w*)?\s*\(/gm`
(go test's rule: `Test` then nothing or a character that is not a lower-case letter; an indented or commented `func`
does not count), beside typescript's and python's; every other line unchanged.

| Primer Command example | given (`primer/examples.json`) | result |
|---|---|---|
| 7 | tmpRepo: go.mod, calc/a.go, calc/a_test.go (TestA, TestB_2, Testable, helper, a commented TestC), report/r_test.go (Test, an indented TestIndented, Test9), web/x.ts; then countTests(go, [calc/a_test.go, calc/a.go "func TestZ…"]) | code 0; tests `{language: "go", files: 2, tests: 4}`; files 5; then `{language: "go", files: 1, tests: 2}` |

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P15 golang"; #6 = issue VasyaLutiy/morph#6):

- **The profile (#6 §1)** · the issue's table kept except: lintLine `go vet ./...` alone and gofmt a builder stage (a
  profile line is one shell line; `gofmt -l` exits 0 on unformatted files); ownTestLine `go test -count=1 ./$(dirname
  {test})/` (go tests a package, not a file; `-run '<names>'` would need the file read); testDirs `[]` (`testdata/` holds
  data, not tests); finale/judgeInstruction name `testhelp.Equal`, `Test<Function>Example<n>`, Go 1.22, stdlib only.
- **Own package only (#6 §2, risk 3)** · every narrow stage (build, vet, probe, own) runs on the card's own packages
  (`./<dir>`) under `-overlay $P/overlay.json`, which deletes the same generation's other targets for that command —
  the Go analogue of the per-card tsconfig; the full stage is `go test ./...` of the whole module with only fullExclude
  hidden (`full.json`). Measured: relative overlay paths work; a sibling's broken file in the package does not redden
  build, vet or probe.
- **The guard (#6 §2)** · the builder still calls `node $P/guard.mjs src|tests …`; a Go module keeps V2's
  `decks/tools/goguard.mjs` as its `decks/tools/guard.mjs`: imports read by `go list -e -f '{{join .Imports …}}'`
  per package (never grep), the layer table and the pure packages in the module's `decks/tools/layers.json`, a pure
  package may not import os, os/exec, net, net/http, time, math/rand(/v2), syscall, unsafe (the clock is the import of
  time); tests: `func Test` count within min..max, the literals, no Skip/Skipf/SkipNow/testing.Short, imports only the
  standard library and the module's own. Direct imports, not `go list -deps` (#6's draft): the standard library's own
  closure (fmt → os) would make every pure table unwritable.
- **The locator and the trim (#6 §2, issue #3 B)** · testhelp.Equal prints `got:  <%#v>` / `want: <%#v>` on the two lines
  under the failing test; goTestStep prints from the first `--- FAIL` (dropping `ok …`, `PASS`, `FAIL`), else the build
  error's tail 60; a Go module keeps V2's `decks/tools/gofirstdiff.mjs` as its `decks/tools/firstdiff.mjs` (it prints the
  first difference of every got/want pair). V2's own `firstdiff.mjs` is not touched: Plan Command example 8 pins it.
- **The probe** · Go probes live in `decks/<phase>/parts/_<id>_probe_test.go` (probeFile), are written by the probe stage
  into the card's package as `<id>_probe_test.go`, run with `-run '^TestProbe'`, removed right after the stage and by the
  trap; never stored under `$P` with a .go name (`$P` is inside the module).
- **Network isolation (#6 acceptance)** · GO_ENV: `GOPROXY=off GOFLAGS=-mod=mod GOSUMDB=off GOTOOLCHAIN=local GOWORK=off`,
  `GOCACHE` default `/tmp/morph/go-build` and `GOPATH` default `/tmp/morph/go` (outside the tree, shared across
  acceptances: cold 14.7 s, warm 0.3 s for go-mini), an environment's own GOCACHE/GOPATH kept; a module with
  requirements is out of scope (a stdlib module needs no go.sum). An import outside the standard library fails the build
  with `module lookup disabled by GOPROXY=off`.
- **Go in V2's own suite** · no vitest test spawns `go`: Go Acceptance, Build Acceptances, Plan Command 9 compare text;
  the scripts are validated at the gate on go-mini (§11) and by the smoke after the merge · V2's suite stays runnable
  without a Go toolchain and never skips; a `go` in vitest would either redden or skip on a machine without it.
- **The profile of --checks** · the first selected Component's language, else the map's (the cut's rule); a card of
  another language is refused by Build Acceptances (`card '<id>' has no <id> target`), never built with the wrong tools.
- **Primer (#6 §2)** · `^func Test(?:[A-Z0-9_]\w*)?\s*\(` per line, the profile picked by the most files as before.

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/language/types.ts`, `profiles.ts` | PATCH | probe only | PATCH `tests/language/profiles.examples.test.ts` (RP 4 changed, 5 added) |
| `src/builder/goAcceptance.ts` | NEW | probe only | NEW `tests/builder/goAcceptance.examples.test.ts` (GA 1–5) |
| `src/builder/buildAcceptances.ts` | PATCH | probe only | PATCH `tests/builder/buildAcceptances.examples.test.ts` (BA 4 changed, 5, 6 added) |
| `src/cli/planCommand.ts`, `readPlanChecks.ts` | PATCH | probe only | NEW `tests/cli/planCommand.p15.examples.test.ts` (PC 9) |
| `src/primer/primerCommand.ts` | PATCH | probe only | NEW `tests/primer/primerCommand.p15.examples.test.ts` (PrC 7) |
| — (ripple) | — | — | PATCH `tests/planner/cut.examples.test.ts` (Cut Component 4), `tests/planner/plan.examples.test.ts` (Plan Spec 4) |

- `profiles.examples` (patched): "Resolve Profile example 4: …" now rust (its old name, saying 'go', may go: `drop`);
  every `(known: typescript, python)` becomes `(known: typescript, python, go)`; "Resolve Profile example 5: …" compares
  `resolveProfile("Go", null)` whole with `{ok: true, profile: fixtureJson("language/go.json")}`.
- `goAcceptance.examples`: "Go Acceptance example 1: …" … "5: …"; each whole script `toBe(fixture("builder/go/<name>.txt"))`,
  the ctx helper of §2.1 verbatim.
- `buildAcceptances.examples` (patched): example 4's message; examples 5 and 6 appended with the file's own `card` and
  `checks` helpers (`checks` gives phase p1 and DEFAULT_FROZEN: example 5 spreads its own phase "m1" and frozen).
- `planCommand.p15.examples`: "Plan Command example 9: …", the §2.1 go-mini root, removed in finally.
- `primerCommand.p15.examples`: "Primer Command example 7: …", the tmpRepo removed in finally.
- `cut.examples`, `plan.examples` (patched): one expected message each (Cut Component 4 also the Component's language
  "rust"); every other line unchanged.

### 2.4. What must not break

- Byte for byte: every file outside the 7 code targets and the 7 test files of §2.3 — `src/builder/{steps,compose,
  probeDir,readChecks,types}.ts`, `src/language/{paths,naming,template}.ts`, the planner, the other cli and primer files,
  `tests/helpers.ts`, `decks/tools/{guard,firstdiff}.mjs`; `contour.yaml`, `morph-map.json`, `docs/`, `decks/`,
  `tests/fixtures/` — untouched by every card.
- 736 tests in 110 files: 731 green at every card (the four ripple files excluded deck-wide, `fullExclude`); after the
  run **736 + RP 1 + GA 5 + BA 2 + PC 1 + PrC 1 = 746** in 113 files (± the judges' own tests).

## 3. Acceptance

Built by `morph plan --checks decks/p15/checks.json`, narrow to broad, every stage printing `== <stage>`. `ownGit:
true` (primer's judge spawns git in its tmpRepo), `fullExclude` the four ripple files of §1.

Code cards (no test file; `intent: generate` for the new goAcceptance.ts): `probe/<card>/` → `tsc` (per-card tsconfig
excluding the generation's other targets) → `eslint <targets>` → `guard.mjs src <targets>` →
`decks/p15/parts/<card>.probe.ts` (profiles RP 4–5 + 3 rows = 4 tests; go-acceptance GA 1–5 + 1 = 4; build-acceptances BA
4–6 + 1 = 4; plan-command PC 9 + 1 = 2; primer-command PrC 7 + 1 = 2; **16 tests**) → eslint's verdict → full `vitest
run` → own git → frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs tests <file> <min> <max> lits<n>.json` (+ the names
kept for a patched file) → `vitest run <targets>` → eslint's verdict → full run → own git → frozen → untracked.

| file | new | min | max | lits |
|---|---|---|---|---|
| `tests/language/profiles.examples.test.ts` | no (drop: the old example 4 name) | 15 | 17 | `Resolve Profile example 4`, `… example 5`, `unknown language 'rust' (known: typescript, python, go)`, `language/go.json` |
| `tests/builder/goAcceptance.examples.test.ts` | yes | 5 | 11 | `Go Acceptance example 1` … `5`, `builder/go/code1.txt`, `code2.txt`, `judge1.txt`, `judge2.txt`, `steps.txt`, `m_probe_test.go`, `./x/y`, `TestA_old` |
| `tests/builder/buildAcceptances.examples.test.ts` | no | 8 | 10 | `Build Acceptances example 5`, `… 6`, `(only typescript, go)`, `builder/go/code1.txt`, `card 'a' has no go target`, `_percent-of_probe_test.go` |
| `tests/planner/cut.examples.test.ts` | no | 12 | 13 | `Component 'ledger': unknown language 'rust' (known: typescript, python, go)` |
| `tests/planner/plan.examples.test.ts` | no | 11 | 12 | `the map: unknown language 'cobol' (known: typescript, python, go)` |
| `tests/cli/planCommand.p15.examples.test.ts` | yes | 1 | 5 | `Plan Command example 9`, `cli/goMini.deck.json`, `decks/m1/parts/_percent-of_probe_test.go`, `decks/m1/deck2.json` |
| `tests/primer/primerCommand.p15.examples.test.ts` | yes | 1 | 5 | `Primer Command example 7`, `func TestB_2(t *testing.T) {}`, `func Testable(t *testing.T) {}`, `report/r_test.go` |

min = the file's tests now + the new examples; max = min + 2 (patched) or + 6 (new).

**Output budget** (`max_tokens`, before the session's ×3 for `ds`; a ds answer ≥ 10 KB gets ≥ 16 000, DECISIONS P12a/P14):

| card | returns | `max_tokens` |
|---|---|---|
| profiles | types.ts + profiles.ts ≈ 8 KB, two whole files | 16 000 |
| go-acceptance | goAcceptance.ts ≈ 6.5 KB (reference) | 16 000 |
| build-acceptances | buildAcceptances.ts ≈ 6 KB whole | 14 000 |
| plan-command | planCommand.ts + readPlanChecks.ts ≈ 7.5 KB | 16 000 |
| primer-command | primerCommand.ts ≈ 8.8 KB whole | 16 000 |
| profiles-judge | ≈ 4 KB whole | 12 000 |
| go-acceptance-judge | ≈ 5 KB new | 16 000 |
| build-acceptances-judge | ≈ 8.5 KB whole | 20 000 |
| cut-component-judge, plan-spec-judge | ≈ 8.7 KB whole each | 20 000 |
| plan-command-judge, primer-command-judge | ≈ 2–3 KB new | 12 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- **Layer builder** (guard): goAcceptance.ts imports `./steps.js`, `./compose.js`, `../language/paths.js` and `node:path`
  only; no process, console, Date, Math.random, file read. buildAcceptances.ts imports `./goAcceptance.js`. Layer cli:
  readPlanChecks.ts imports `../builder/buildAcceptances.js` and `../language/profiles.js`. Layer primer unchanged.
- Every shell line of goAcceptance.ts exactly as §2.2 writes it: the fixtures compare whole scripts.
- A file a card writes is in no sibling's slice in the same generation: generation 0 (profiles, go-acceptance) reads no
  P15 target; generation 1 (build-acceptances reads goAcceptance.ts; the judges of profiles and go-acceptance, the two
  planner patch judges and primer-command read only generation-0 files); generation 2 (plan-command reads
  buildAcceptances.ts; build-acceptances-judge reads it and goAcceptance.ts; primer-command-judge reads primerCommand.ts);
  generation 3 (plan-command-judge reads the cli files).
- Tests write only under `tmpRoot()` / `tmpRepo()` and remove them in finally; no network; no `go` spawned by any test;
  a judge writes only its targets.

## 7. Out of scope

- **The small real Go project of issue #6 §3** (the operator names it later; its measurement against the TS ccledger).
- The reviewer on Go (test titles `TestXExampleN` ↔ "X example N" for obligations, Go mutants) — `testTitles` keeps
  answering `[]` for go (Check Guardrails example's "go" row unchanged).
- The planner's language-neutral judge line (`EXAMPLES_LINE` still says `e.g. "Clamp Value example 1"`; the go profile's
  judge instruction, first in the card, names `TestClampValueExample1`).
- Go modules with requirements (go.sum, a module proxy), golangci-lint, a Go scout seed, a `--checks` deck of two
  languages (refused per card, §2.2).

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component language --component builder-go \
  --component builder --component cli --component primer --component planner --judge --checks decks/p15/checks.json \
  --out decks/p15/deck.json
python3 decks/p15/filter.py decks/p15/deck.json                  # keeps the 12 cards of the phase
node dist/cli.js deck check --root . --deck decks/p15/deck.json                                   # errors 0
python3 decks/tools/scale_tokens.py decks/p15/deck.json 3        # the session, for processor ds
rm -rf /tmp/v2bin-p15 && mkdir -p /tmp/v2bin-p15 && cp -r dist /tmp/v2bin-p15/ && ln -s $PWD/node_modules /tmp/v2bin-p15/node_modules
node /tmp/v2bin-p15/dist/cli.js run --root . --deck decks/p15/deck.json --processor ds --deadline 2400
```

Cross-check (dry): from `morph-lab`, `venv/bin/mrph plan --spec <repo>/contour.yaml --map <repo>/morph-map.json
--component language --component builder-go --component builder --component cli --component primer --component planner
--judge --root <repo>`.

**The P15 smoke (after the merge; AUTONOMY's smoke stop: go-mini end to end)** — a copy of go-mini outside `~/MorphV2`
(`/tmp/smoke-go/M`), the merged binary copied to `/tmp/v2bin-smoke-go` (`dist/` + `node_modules` symlinked), the ds
environment by indirection (`decks/p10b2/smoke/run.sh`'s recipe with `ds`, never printed), `go version` go1.22.x,
ceiling **$0.20** in all.

1. **M, base.** `cp -r tests/fixtures/go-mini /tmp/smoke-go/M`; `cp decks/tools/goguard.mjs M/decks/tools/guard.mjs`;
   `cp decks/tools/gofirstdiff.mjs M/decks/tools/firstdiff.mjs`; `git init`, commit → **B0** (`probe/` is gitignored).
2. **plan.** `plan --root M --spec contour.yaml --map morph-map.json --component calc --component report --judge --checks
   decks/m1/checks.json --out decks/m1/deck.json` exit 0: **6 cards in 4 generations** `[clamp-value] [clamp-value-judge,
   percent-of] [format-share, percent-of-judge] [format-share-judge]`, Go targets (`calc/clamp_value.go`, …), every
   acceptance starting with GO_ENV and holding `== build`/`== probe` (code) or `== guard <file>` (judges); `deck check
   --root M --deck decks/m1/deck.json` errors 0; `scale_tokens.py … 3`; commit the deck → **B1**.
3. **run on ds.** `run --root M --deck decks/m1/deck.json --processor ds --deadline 1200`: exit 0, **6 / 6 written**, the
   branch `morph/<runId>` with 6 card commits (Morph-Card trailers) + the archive commit; then on it `go vet ./...`,
   `gofmt -l .` empty, `go test -count=1 ./...` ok for `mini/calc` and `mini/report`, `git status --short` empty (no probe
   file left); ≤ $0.10. A red card: its class by AUTONOMY's table; the acceptance log must show the Go stage
   (`== build`/`== vet`/`== probe` with `--- FAIL` and a `first difference` line).
4. **primer.** `primer --root M --write`: exit 0; `document.tests` = `{language: "go", files: 3, tests: ≥ 12}` (the three
   judges' `func Test…`: 4 + 5 + 3 examples, more with their own); `.morph/primer.md` holds "## File ownership" with the
   6 cards' paths.

`mrph` reads `.env` from the current directory: run it from `morph-lab`, never from the repo.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 12 (5 code, 7 judges) / 4: [profiles, go-acceptance] [build-acceptances, primer-command, profiles-judge, go-acceptance-judge, cut-component-judge, plan-spec-judge] [plan-command, build-acceptances-judge, primer-command-judge] [plan-command-judge] |
| executor bill | ≈ $0.25–0.45 on ds ×3 (P14b: 7 cards $0.28; P13b: 9 cards $0.41); ≤ $0.70 with a re-cut; cap $5 |
| cards with regeneration | 2–4 of 12 (go-acceptance: a shell line off by a character against code1.txt — the escaped `\\(` of goNamesKept, the `2>&1` of gofmt -d; the patch judges: a whole 8.7 KB file returned with another line changed — the names guard and the full run catch it) |
| tests after the run | 746 ± 8 in 113 files |
| first red | go-acceptance: the probe heredoc tag or the overlay key order; build-acceptances: the new error before the not-in-deck check; plan-command: the profile resolved after readPlanChecks |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no answer cut at its `max_tokens`; (3) the V2 cut equals
the old mrph's dry cut in ids, dependsOn, generations, targets, slices and max_tokens; (4) after the run no file outside
§2.3's fourteen changed; (5) goAcceptance.ts imports no Node module but node:path; (6) no vitest test spawns go.

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the MEASURE row
with its `прогоны` cell and, for this first phase of the fresh session, the preparation minutes, the number of
preparation agents and the tokens (cache read / output) of the session and the agents; the vitest log of every verify
run; DECISIONS lines "P15 golang".

## 11. Actual

### Gate (preparation)

08.10, on the VPS, by the preparing orchestrator (Opus 5.5, a fresh session with no memory of P3–P14, no sub-agents); no
paid run, no call to any model. Data commits 35386fc (spec, record, map, fixtures, go-mini, decks/tools/{goguard,
gofirstdiff}.mjs, checks, probes, filter, deck, DECISIONS), 6f315b9 (plan-command-judge's literal by the §2.1 skeleton),
8f59b1e (3 probe rows closing the first mutation pass's survivors; deck re-cut) and the gate commit (this section).
Component sizes: cli 29 861 → 28 934 (compacted first), primer 29 880 → 29 161 (compacted first), language 15 622,
builder 25 821, builder-go new 8 588, planner 29 509. Issues labelled P15-golang: #6 only. No split: 12 cards ≤ 12.

The deck **cut by V2**: `plan --component language --component builder-go --component builder --component cli
--component primer --component planner --judge --checks decks/p15/checks.json` exit 0, 50 cards, `decks/p15/filter.py`
keeps 12; generations `[go-acceptance, profiles] [build-acceptances, go-acceptance-judge, primer-command, profiles-judge,
cut-component-judge, plan-spec-judge] [build-acceptances-judge, plan-command, primer-command-judge] [plan-command-judge]`;
`deck check` **0 errors, 0 warnings**, no hazards; max slice + targets 60 258 bytes (build-acceptances-judge). Cross-check:
the old `mrph plan --spec` on the same six Components (dry, exit 0) gives the same 50 ids in the same order and the same 4
generations; targets, slices, dependsOn, intent, max_tokens and reasoning (2 500) equal on all 50, variants equal (mrph
omits 1); instructions differ on all 50 (the P10a design), acceptances on 24 (the 12 phase cards from checks.json among
them).

Scratch worktree from 8f59b1e (references of the 7 code files and 7 probe-shaped judge files, deleted afterwards), cards
run in deck order with the deck's own acceptances, each accepted card committed before the next: **12 of 12 chains green,
58.0–67.2 s each (728.5 s in all; limit 250 s per chain)**; the first pass from 6f315b9 also 12 of 12 (59.0–63.4 s, 726.4 s).
Ripple: 5 of 736 in 4 files (excluded deck-wide). Baseline of the data commit: vitest 736 / 736 in 110 files. The final
tree: `tsc`, `eslint src tests`, guard clean, `vitest run` **749 / 749** in 113 files in 3 of 3 full runs (736 + 13 of the
reference judges); logs kept: /tmp/p15-prep-vt-{0,1,2,3}.log. Typed one-line throwing stubs (`Error: stub <fn> <args JSON,
cut at 160>`; types and constants as specified; GO a wrong copy, PROFILES without it): every code card red at the probe —
profiles 4/4, go-acceptance 4/4, build-acceptances 4/4, plan-command 2/2, primer-command 2/2 (**16/16**), each FAIL with
its stub line or an expected/received pair. Judges before their card: the new files red at the guard ("… missing", 3 of 3),
the patched files at their old text red at the guard (count 14 vs 15..17, 6 vs 8..10, the new literals missing; 4 of 4).
Mutation check: **113 mutations** of the references (V2's own Plan Mutants rules on the new file and the changed lines,
plus 47 hand mutants of the shell text: GOPROXY, -count=1, the overlay of the full step, `-run '^TestProbe'`, the probe
removal, the gofmt `|| true`, the names grep, the probe file's "_", the profile order, testDirs, the go rule's anchor, …),
each under a 120 s subprocess timeout against its probe: first pass 109 killed, 4 survivors, 3 closed by the probe rows of
8f59b1e; second pass **112 killed, 0 by timeout (max 1.6 s), 1 not killed by the probe**: `"the map: " + error` → `-` on
the unreachable branch of planCommand (rejected by the chain's `tsc`).

**The go-mini validation of issue #6 §3** (the reference binary on a copy of `tests/fixtures/go-mini` with
`decks/tools/goguard.mjs` and `gofirstdiff.mjs` as its tools, go1.22.2, GOPROXY=off; no paid call): `plan --component calc
--component report --judge --checks decks/m1/checks.json` exit 0, **6 cards in 4 generations** `[clamp-value]
[clamp-value-judge, percent-of] [format-share, percent-of-judge] [format-share-judge]`, `deck check` 0 errors; the Go
reference green in deck order, **6 of 6 chains, 0.5–0.7 s each (3.5 s)**, tree clean after; Go stubs (a sentinel return)
red at the probe per example: clamp-value 5/5, percent-of 6/6, format-share 4/4 FAIL functions, each with got/want and a
`first difference` line; judges with the file absent red at the guard (3/3); reference judges on stubbed code red at own
per example (4, 5, 3); deliberately broken percent-of attempts red at their stage — **build** (a syntax error, `== build`),
**vet** (a self-assignment, the held vet verdict after the probe), **test** (rounding down: `--- FAIL:
TestProbePercentOfExample2`, `got: 66`/`want: 67`), plus gofmt (verdict, with the diff), guard (`imports time in a pure
package`) and a printf misuse (go test's own vet at the probe); **29 Go mutants, 26 killed, 3 equivalent** (`>`/`>=`,
`<`/`<=` at ClampValue's bounds, where both branches return the same value), one survivor of the first pass
(`whole <= 0` → `<= 1`) closed by the probe row PercentOf(1, 1) = 100. Cold build cache 14.7 s, warm 0.3 s.

**Forecast** on `ds` with every maxTokens × 3: 12 cards of 48–60 KB in, 17 first requests (5 code × 2 variants + 7
judges), answers 3–9 KB; P14b ran 7 cards for $0.2834 (11 requests), P13b 9 for $0.4122: ≈ 17–25 requests ≈
**$0.35–0.60**, ≤ $0.80 with a re-cut; ≤ $1. **Gate holds.**

**Run command** (from the repo root, the binary copied first; the session applies maxTokens × 3 first, as the operator
ordered):

```
python3 decks/tools/scale_tokens.py decks/p15/deck.json 3
npm run build && rm -rf /tmp/v2bin-p15 && mkdir -p /tmp/v2bin-p15 && cp -r dist /tmp/v2bin-p15/ && ln -s $PWD/node_modules /tmp/v2bin-p15/node_modules
node /tmp/v2bin-p15/dist/cli.js run --root . --deck decks/p15/deck.json --processor ds --deadline 2400 > /tmp/p15-run.json
```

After the merge: the P15 smoke of §8 (go-mini end to end), then stop.
