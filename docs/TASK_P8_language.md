# TASK_P8 — language profiles (`src/language/`)

> Phase P8 of `docs/PLAN.md` ("Фазы по записи (после P2)"), Component `language` of `contour.yaml`
> (eight Functions: Resolve Profile, Fill Template, Classify Path, Detect Profile, Name Targets,
> Acceptance Lines, Acceptance Script, Judge Instruction; three Data Objects: Language Profile,
> Profile Result, Targets Result). TypeScript under `src/language/`, **pure data and pure
> functions**: no clock, no environment, no file system, no child process; the only Node module is
> `node:path` (its `posix` half). Built by the old Morph (`mrph`) on glm; judge cards write the
> example tests.
>
> Reconciliation: no module of the tree needs a profile today (`grep -rn profile src` is empty: the
> acceptance runs the card's own command, the compiler and the runloop are language-blind), so P8
> is **not wired** into the cli, the runloop or the acceptance. Its consumers come later: the planner
> (P10: a Component's profile, card ids, default targets, judge instruction, acceptance lines),
> primer and scout (which file is a test). The python profile is data only: its lines (py_compile,
> ruff, pytest) are strings, never run, and no test needs python. Decided, DECISIONS "P8 language".

## 1. Why this

- **The planner needs one table, not constants scattered in the cutter.** The old Morph cut every
  Python deck from four module-level constants of `cards/plan_spec.py` (`AST_LINE`,
  `FULL_RUN_LINE`, `FINALE`, `JUDGE_INSTRUCTION`) and needed a 212-line `cards/language.py`
  refactor to cut its first TypeScript deck; its typescript profile still called `npx` (MorphV2
  calls `node_modules/.bin/…`: `npx` is the lesson of P0, 3 of 4 burned variants).
- **Names decide ownership.** Every V2 card so far had its `targets` overridden by hand in
  `morph-map.json` (58 cards of P1–P7, 0 cut by a name rule), because the old planner names files
  in snake_case. PLAN: "TS-профиль режет camelCase, dogfood-фазы не нуждаются в override
  `targets`". Name Targets pins the rule with 4 examples.
- **The acceptance chain is text the planner writes into 2 × N cards per phase.** The old Morph's
  template (snapshot `$D/<i>-$S<ext>`, `set -e` subshell, the log printed) is pinned whole by two
  fixture scripts, so a planner of P10 cannot drift from it by one character.

PLAN: ≈ 8 cards per phase at ≈ $0.1–0.2. This cut: 8 cards (4 code, 4 judge), 25 record examples
(Resolve Profile 4, Fill Template 3, Classify Path 4, Detect Profile 2, Name Targets 4, Acceptance
Lines 4, Acceptance Script 2, Judge Instruction 2).

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **A profile** is never built by a test: it is `PROFILES[0]` (typescript) or `PROFILES[1]`
  (python), imported from `src/language/profiles.ts`, typed `LanguageProfile` (`const TS =
  PROFILES[0] as LanguageProfile;`). Comparisons with `toStrictEqual`.
- **Profile fixtures** (`tests/fixtures/language/`, JSON objects read with `fixtureJson(name)` from
  `tests/helpers.ts`, which returns `unknown`):
  - `typescript.json` — the whole typescript profile, 16 keys in the type's order: id `typescript`,
    extensions `[".ts", ".tsx"]`, testDirs `["tests", "test", "__tests__"]`, testFilePattern
    `^.*\.(test|spec)\.tsx?$`, nameCase `camel`, codeTarget `src/{component}/{name}.ts`, testTarget
    `tests/{component}/{name}.test.ts`, judgeTarget `tests/{component}/{name}.examples.test.ts`,
    parseLine `node_modules/.bin/tsc --noEmit`, parseTakesFiles `false`, lintLine
    `node_modules/.bin/eslint {files}`, ownTestLine `node_modules/.bin/vitest run {test}
    --reporter=dot`, fullRunLine `node_modules/.bin/vitest run --reporter=dot`, finale (prose),
    judgeInstruction (prose with `{test}`, `{module}` twice, `{docs}`), helpersModule
    `tests/helpers.ts`. Resolve Profile example 1 returns `{ok: true, profile}` with profile
    `toStrictEqual` to this file.
  - `python.json` — the python profile: extensions `[".py", ".pyi"]`, testDirs `["tests"]`,
    testFilePattern `^(test_.*\.py|.*_test\.py)$`, nameCase `snake`, codeTarget
    `{component}/{name}.py`, testTarget `tests/test_{name}.py`, judgeTarget
    `tests/test_{name}_examples.py`, parseLine `python3 -m py_compile`, parseTakesFiles `true`,
    lintLine `ruff check {files}`, ownTestLine `python3 -m pytest {test} -q --tb=short`,
    fullRunLine `python3 -m pytest -q --tb=short`, helpersModule `tests/conftest.py`. Resolve
    Profile example 2 returns it.
  - The code card copies both files **verbatim** into the two constants (every character of the
    two prose fields included); the fixture is the source of truth.
- **Script fixtures** (text, read with `fixture(name)`, each ending with one `"\n"`, which is the
  last character `acceptanceScript` returns): `scriptTs.txt` — 10 lines, Acceptance Script example
  1 (typescript, customId `parse-command`, targets `["src/cli/parse.ts", "tests/cli/parse.test.ts"]`);
  `scriptPy.txt` — 9 lines, example 2 (python, customId `a`, targets `["pkg/a.py", "Makefile"]`).
  Compare `toBe(fixture("language/scriptTs.txt"))` directly: no trimming, no added newline.
- **Every other example has no file**: its literal is in the record (Component language, the
  Function's example `given`). A path with a backslash is written in TypeScript source as
  `"tests\\a.py"` (one backslash in the string).
- **JudgeInputs** — `{test: string, module: string, docs: string[]}`, built inline.

### 2.2. OUTPUT data shapes

`src/language/types.ts` exports exactly these names (types only, no values, no imports):

```ts
export type ProfileId = "typescript" | "python";
export type NameCase = "camel" | "snake";
export interface LanguageProfile {
  id: ProfileId; extensions: string[]; testDirs: string[]; testFilePattern: string; nameCase: NameCase;
  codeTarget: string; testTarget: string; judgeTarget: string;
  parseLine: string; parseTakesFiles: boolean; lintLine: string; ownTestLine: string; fullRunLine: string;
  finale: string; judgeInstruction: string; helpersModule: string;
}
export type ProfileResult = { ok: true; profile: LanguageProfile } | { ok: false; error: string };
export interface CutTargets { code: string; test: string; judge: string }
export type TargetsResult = { ok: true; slug: string; targets: CutTargets } | { ok: false; error: string };
export interface JudgeInputs { test: string; module: string; docs: string[] }
```

Every object is built with its keys in the type's order.

**`src/language/profiles.ts`** (imports `import type { LanguageProfile, ProfileResult } from
"./types.js"` only):

- `export const TYPESCRIPT: LanguageProfile`, `export const PYTHON: LanguageProfile` — the two
  fixtures verbatim; `export const PROFILES: readonly LanguageProfile[] = [TYPESCRIPT, PYTHON]`;
  `export const DEFAULT_LANGUAGE = "typescript"`.
- `resolveProfile(componentLanguage: string | null, mapLanguage: string | null): ProfileResult`:
  `choice` = componentLanguage unless it is `null` or `""`, else mapLanguage unless `null` or `""`,
  else `DEFAULT_LANGUAGE`; `key = choice.trim().toLowerCase()`; the `PROFILES` entry with `id ===
  key` → `{ok: true, profile}` (**the registry object itself**, `=== PROFILES[i]`); none → `{ok:
  false, error: "unknown language '" + choice + "' (known: typescript, python)"}` (the choice as
  given, untrimmed: `"  "` → `unknown language '  ' (known: typescript, python)`; the known ids
  from `PROFILES` in order, joined by `", "`). A component value wins even when the map's is
  unknown (`("TypeScript", "go")` → ok).
- `fillTemplate(template: string, values: Record<string, string>): string` = `template.replace(
  /\{([A-Za-z]+)\}/g, (m, k) => Object.hasOwn(values, k) ? values[k] : m)` — a **function**
  replacer (a string replacer would read `$&`, `$1`, `$$` as patterns); keys are letters only
  (`{a1}`, `{ a}`, `{}` stay); an inherited key (`{toString}`) stays; one pass.

**`src/language/paths.ts`** (imports `path from "node:path"`, `PROFILES` from `./profiles.js`,
`import type { LanguageProfile }` from `./types.js`); use `path.posix` only:

- `normalizePath(path: string): string` — every `"\\"` becomes `"/"`, then **every** leading
  `"./"` is removed (`"././tests\\a\\b.ts"` → `"tests/a/b.ts"`); nothing else (`"src/./a.ts"` and
  `"../a.ts"` unchanged).
- `hasExtension(profile, path): boolean` — `path.posix.extname(normalizePath(path)).toLowerCase()`
  is in `profile.extensions` (`"src/.ts"` has none; `"src/a.d.ts"` is `.ts`).
- `isTest(profile, path): boolean` — of `normalizePath(path).split("/")`, any part **but the last**
  in `profile.testDirs`, or the last part matches `new RegExp(profile.testFilePattern)`
  (`"tests"` alone → false for python; `"test/x.py"` → false for python, true `"test/x.ts"` for
  typescript).
- `codeTargets(profile, targets: readonly string[]): string[]` — the targets with `hasExtension`
  and not `isTest`, **as given** (not normalised), order kept.
- `testTarget(profile, targets: readonly string[]): string | null` — the first target with
  `hasExtension` and `isTest`, as given; none → `null`.
- `profileForPath(path: string): LanguageProfile | null` — the first of `PROFILES` whose extensions
  hold the path's extension (as `hasExtension` computes it), else `null`.

**`src/language/naming.ts`** (imports `fillTemplate` from `./profiles.js`, types from
`./types.js`):

- `nameWords(name: string): string[]` = `name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w
  !== "")` (`"  Build  HTTP--Request "` → `["build", "http", "request"]`; ASCII letters and digits
  only).
- `slugName(name: string): string` = the words joined by `"-"`.
- `caseName(name: string, nameCase: NameCase): string` — camel: the first word, then each further
  word with its first character upper-cased (`"2nd pass x"` → `"2ndPassX"`, `"ALLCAPS"` →
  `"allcaps"`); snake: joined by `"_"`; no words → `""`.
- `cutTargets(profile, component: string, functionName: string): TargetsResult` — the component,
  then the function name: no words → `{ok: false, error: "no letters or digits in name '" + name +
  "'"}` (the name as given). Else `values = {component: caseName(component, profile.nameCase),
  name: caseName(functionName, profile.nameCase)}` → `{ok: true, slug: slugName(functionName),
  targets: {code: fillTemplate(profile.codeTarget, values), test: …testTarget…, judge:
  …judgeTarget…}}` (`("Run Loop", "Run Deck")` typescript → `src/runLoop/runDeck.ts`).

**`src/language/template.ts`** (imports `path from "node:path"`, `hasExtension` and `testTarget`
from `./paths.js`, `fillTemplate` from `./profiles.js`, types from `./types.js`):

- `acceptanceLines(profile, targets: readonly string[]): string[]` — `own` = the targets with
  `hasExtension` (code **and** tests), as given, order kept. If `own` is not empty: the parse line
  (`profile.parseLine`, plus `" " + own.join(" ")` when `parseTakesFiles`), then
  `fillTemplate(profile.lintLine, {files: own.join(" ")})`. If `testTarget(profile, targets)` is
  not null: `fillTemplate(profile.ownTestLine, {test})`. Always last: `profile.fullRunLine` (empty
  targets → `[fullRunLine]`).
- `acceptanceScript(profile, customId: string, targets: readonly string[]): string` — lines, each
  followed by `"\n"` (so the result ends with `"\n"`): `D=/tmp/morph/<customId>; mkdir -p $D;
  S=$(date +%s)-$$; L=$D/acc-$S.log`; per target `i` from 0: `cp <target> $D/<i>-$S<ext>
  2>/dev/null` with `ext = path.posix.extname(target)` of the target **as given** (case kept:
  `src/A.TS` → `.TS`; none → `""`); `(`; ` set -e`; `" " + line` per acceptance line; `) > $L 2>&1;
  rc=$?; cat $L; exit $rc`. The `$` characters are literal text of the script (in a template
  literal write `$D`, never `${D}`).
- `judgeInstruction(profile, inputs: JudgeInputs): string` = `fillTemplate(profile.judgeInstruction,
  {test: inputs.test, module: inputs.module, docs: [...inputs.docs, "this instruction"].join(", ")})`
  (every placeholder; `{module}` occurs twice in both profiles).

### 2.3. Names

| module | exports | card writes no test | judge's test |
|---|---|---|---|
| `src/language/types.ts` | the types of §2.2, no values | — | — |
| `src/language/profiles.ts` | `TYPESCRIPT`, `PYTHON`, `PROFILES`, `DEFAULT_LANGUAGE`, `resolveProfile`, `fillTemplate` | probe | `tests/language/profiles.examples.test.ts` |
| `src/language/paths.ts` | `normalizePath`, `hasExtension`, `isTest`, `codeTargets`, `testTarget`, `profileForPath` | probe | `tests/language/paths.examples.test.ts` |
| `src/language/naming.ts` | `nameWords`, `slugName`, `caseName`, `cutTargets` | probe | `tests/language/naming.examples.test.ts` |
| `src/language/template.ts` | `acceptanceLines`, `acceptanceScript`, `judgeInstruction` | probe | `tests/language/template.examples.test.ts` |

A code card covered by a probe writes **no test file**. A judge imports the module it tests from
`../../src/language/<m>.js`, `PROFILES` from `../../src/language/profiles.js`, types from
`../../src/language/types.js` with `import type`, and `fixture` / `fixtureJson` from
`../helpers.js`. Its file holds one `test(...)` per example of its Function(s), in record order
(profiles: Resolve Profile 1–4, Fill Template 1–3; paths: Classify Path 1–4, Detect Profile 1–2;
naming: Name Targets 1–4; template: Acceptance Lines 1–4, Acceptance Script 1–2, Judge Instruction
1–2), named `<Function> example <n>: <what>`, then at most 8 tests of its own on §2.2 rows.

Compare results whole with `toStrictEqual`; strings, numbers and booleans with `toBe`. **Typing
traps** (tsc strict):
- `PROFILES[i]` is typed `LanguageProfile` already; a profile constant is `const TS = PROFILES[0]
  as LanguageProfile;`. `profileForPath` returns `LanguageProfile | null`: compare the whole value
  (`toBe(PROFILES[1])`, `toBe(null)`), or map it `p === null ? "null" : p.id`; **never** `p?.id ??
  …` and never `p.id` unnarrowed (TS18047).
- `ProfileResult` and `TargetsResult` are unions: narrow before a field (`got.ok ? got.profile.id :
  got.error`) or compare whole with `toStrictEqual`; never through `??`.
- `fixtureJson` returns `unknown`: pass it straight to `toStrictEqual`, never read a field of it.
- No `any`; import only what you use (eslint rejects an unused import); import `test`, `expect`
  from `"vitest"`.

### 2.4. What must not break

- P0–P7 untouched byte for byte: the scaffold, `src/cards`, `src/compiler`, `src/acceptance`,
  `src/processor`, `src/runloop`, `src/git`, `src/cli`, `src/cli.ts`, `src/index.ts` and their tests.
- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/` — untouched by every card.
- `tsc --noEmit`, `eslint src tests`, `vitest run` green after every generation; the 349 tests of
  P0–P7 stay green.

## 3. Acceptance

Built by `decks/tools/build.py p8` into the `acceptance` of every P8 card in `morph-map.json`;
`mrph plan --spec` copies it onto the card. Narrow to broad; the first red is the regeneration's
diagnosis.

Code cards (targets under `src/language/`; `profiles` also writes `types.ts`):

1. `probe/<card>/`: the guard, a vitest config, `tsconfig.card.json` extending `../../tsconfig.json`
   and **excluding the targets of the other cards of the same generation**; removed on exit.
2. `tsc --noEmit -p probe/<card>/tsconfig.card.json` (project + probe).
3. `eslint <the card's targets>`.
4. `guard.mjs src <targets>`: layer `language` imports only `./*` of its own layer and `cards` (it
   needs none), no package import, no `any`, no `process`, no `console`, no `Date`, no
   `Math.random`, no `fetch`; **of `node:*` only `node:path`** (P8 change).
5. `decks/p8/parts/<card>.probe.ts` under vitest: one `test` per record example of the card's
   Function(s), values **and** types, then the §2.2 rows. profiles 7 + 5 = 12; paths 6 + 5 = 11;
   naming 4 + 4 = 8; template 8 + 4 = 12. 43 tests.
6. `vitest run` — everything in the tree. 7. Frozen: `git diff --quiet HEAD -- contour.yaml
   morph-map.json docs decks tests/fixtures`; no untracked file other than the targets.

Judge cards (`tests/language/<m>.examples.test.ts`):

1–3. `probe/<card>/` (no probe file); the same `tsc`; `eslint <target>`.
4. `guard.mjs tests <target> <min> <max> lits.json` — `min` = the examples (profiles 7, paths 6,
   naming 4, template 8), `max` = `min` + 8; `lits.json`: profiles `typescript.json`, `python.json`,
   `unknown language 'go' (known: typescript, python)`, `$&-$&-{c}`, `{b}x`; paths
   `src/__tests__/x.ts`, `pkg/a_test.py`, `./src/c.ts`, `x/y.PYI`, `Makefile`; naming
   `parse-command`, `run_loop/process_generation.py`, `buildHttpRequestV2`, `no letters or digits in
   name '--'`; template `scriptTs.txt`, `scriptPy.txt`, `python3 -m py_compile pkg/a.py
   tests/test_a.py`, `node_modules/.bin/eslint src/a.ts tests/a.test.ts`, `this instruction`.
5. `vitest run <target>`; 6. `vitest run`; 7. frozen and untracked as above.

Dense output: `--reporter=dot`, failures filtered to `^ FAIL |Error|expected|received`, 80 lines.
Timeout of the whole chain 300 s; measured on a dry tree with stubs (§9).

**Output budget per card** (`max_tokens` in `morph-map.json`). Estimate = the target file(s) in
tokens (≈ bytes / 3.5) × 2 headroom + 2 500 reasoning; the reference sizes are a scratch reference
implementation and the probes (the judge files have the probe's shape):

| card | expected target | estimate | `max_tokens` |
|---|---|---|---|
| profiles | types.ts ≈ 0.9 KB + profiles.ts ≈ 3.6 KB ≈ 1 300 tok | ≈ 5 100 | 12 000 |
| paths | paths.ts ≈ 1.4 KB ≈ 400 tok | ≈ 3 300 | 12 000 |
| naming | naming.ts ≈ 1.2 KB ≈ 350 tok | ≈ 3 200 | 12 000 |
| template | template.ts ≈ 1.5 KB ≈ 450 tok | ≈ 3 400 | 12 000 |
| profiles-judge | ≈ 4.2 KB (12 tests) ≈ 1 200 tok; worst 15 tests ≈ 5.5 KB | ≈ 5 600 | 20 000 |
| paths-judge | ≈ 4.4 KB (11 tests) ≈ 1 300 tok; worst 14 tests ≈ 5.6 KB | ≈ 5 700 | 20 000 |
| naming-judge | ≈ 3.5 KB (8 tests) ≈ 1 000 tok; worst 12 tests ≈ 5 KB | ≈ 5 400 | 20 000 |
| template-judge | ≈ 5.2 KB (12 tests) ≈ 1 500 tok; worst 16 tests ≈ 7 KB | ≈ 6 500 | 24 000 |

Every judge ≥ 20 000 and ≥ 3× its worst case; no single answer is expected above ≈ 2 000 tokens,
far under the ≈ 12 000 output tokens P5 showed a first answer can balloon to.

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- **Layer** `language` (`decks/tools/guard.mjs`, P8 change): pure — no `process`, `console`,
  `Date`, `Math.random`, `fetch`, `node:fs`, `node:child_process`; `node:path` is the only Node
  module. Profiles are data in code; the module reads no file (the fixtures are the tests' copy).
- `types.ts` imports nothing; `profiles.ts` imports `./types.js` only; `paths.ts` and `naming.ts`
  import `./profiles.js`; `template.ts` imports `./paths.js` and `./profiles.js`.
- Tests read fixtures only through `fixture` / `fixtureJson`; they write nothing (no `tmpRoot`
  needed) and spawn nothing; python is never run.
- A judge writes only its test file and never touches the module it tests.
- A file a card writes is in no sibling's slice in the same generation; a judge depends on its code
  card; paths and naming depend on profiles; template depends on paths.
- Exact strings of §2.2 (`unknown language '`, `' (known: `, `no letters or digits in name '`, the
  script lines, both profiles' fields): the executor copies them.

## 7. Out of scope

- Wiring into the cli or the runloop: no command uses a profile in P8; the planner (P10) is the
  first consumer and reads `resolveProfile`, `cutTargets`, `acceptanceScript`, `judgeInstruction`.
- Running any profile line (tsc, eslint, vitest, py_compile, ruff, pytest) — P8 writes text; the
  acceptance (P3) runs whatever command the card carries.
- Guard tables per profile (the old Morph's `plan_spec_guards`), the framing strip
  (`framing_strippable`; V2's response layer is language-neutral), a profile for any third language,
  a map-level profile override of single fields.
- Quoting of paths with spaces or shell metacharacters in the script (card targets are validated by
  `cards`); non-ASCII names (ASCII words only, as the old Morph's `slug`).
- Test counting per profile (primer, P12).

## 8. How to run

```
python3 decks/tools/build.py p8
cd /home/morph/MorphProject/morph-lab
venv/bin/mrph plan --root <repo> --spec <repo>/contour.yaml --map <repo>/morph-map.json --component language --judge   # dry
venv/bin/mrph deck clear --root <repo> && venv/bin/mrph deck reset --root <repo>
venv/bin/mrph plan --root <repo> --spec <repo>/contour.yaml --map <repo>/morph-map.json --component language --judge --add
venv/bin/mrph deck check --root <repo>
venv/bin/mrph run --root <repo> --processor glm53 --deadline 2400   # by the gate of docs/AUTONOMY.md
```

`mrph` reads `.env` from the current directory: run it from `morph-lab`, never from the repo.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards in the deck | 8 (4 code, 4 judge) |
| generations | 4 (profiles; paths + naming + profiles-judge; template + paths-judge + naming-judge; template-judge) |
| executor bill | ≈ $0.11 nominal (≈ 170k in, 50k out at $0.31/M in, $1.13/M out: 12 first requests (4 code × 2 variants + 4 judges) of ≈ 10.5k in / 3k out each, + ≈ 35 % retries), ≤ $0.25 with a re-cut |
| cards with regeneration | 2 of 8 |
| `write-write` / `read-write` at `deck check` | 0 / 0 |
| tests after the run | 349 + 4 judge files; ≥ 25 judge example tests |
| chain on a dry tree with stubs | filled in at the gate (§11 "Gate") |
| first red | profiles: a prose field of a profile not verbatim, or `fillTemplate` with a string replacer (`$&`); paths: a path not normalised before `extname` or the leading `./` removed once; naming: camel of the first word; template: `${D}` in a template literal, or the missing final newline; judges: `fixtureJson(...)` read as an object, or the backslash literal |

**Falsifiable claims:** (1) no card goes red on a sibling's file; (2) no judge red traces to §2.1;
(3) no judge is cut off at its `max_tokens`; (4) no test spawns a process or needs python.

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), judge tests written,
truncations (finish reason `length`) per card, defects the judge found the probe did not (and the
reverse), the row of `docs/MEASURE.md`.

## 11. Actual

### Gate (preparation, autonomous)

07.10, by the preparing orchestrator (Opus 5.5), data commit `f7dcc06`. Dry `mrph plan --spec
--component language --judge` exit 0; `deck clear`, `deck reset`, `plan --add` (8 cards, generations
`[profiles] [naming, paths, profiles-judge] [naming-judge, paths-judge, template] [template-judge]`),
`deck check` 0 errors / 0 warnings / 0 hazards. Max slice + targets (reference targets in place):
template-judge 44 222 bytes (gate 200 KB).

Scratch worktree outside the tree (data + a scratch reference of the four modules + reference judge
files shaped as the probes; deleted afterwards): every chain green on the reference, 24.8–32.6 s
(max naming-judge 32.6 s; limit 250 s). One-line throwing typed stubs: each code card red at the
probe, 25 of 25 record examples red with a readable `Error: stub <fn> <args>` line, 39 of 43 probe
tests red (the 4 type-only tests pass on typed stubs), chains 6.7–7.7 s; judges with their file
absent red at eslint (`No files matching the pattern`), 3.8–4.0 s. Mutation check: 22 single-rule
mutations of the reference (choice fall-through, trim, error quoting, own-property and letters-only
keys, registry order, a finale character; normalise loop, lower-case, dir parts, as-given return,
backslash; camel first word, component casing, check order, slug; final newline, full-run always,
lint over tests, ext case, "this instruction", parseTakesFiles) — 22 of 22 killed by the card's probe
(the check-order survivor of the first pass killed after the naming probe's row was strengthened to
two different wordless names). Reference judge files 3.5–5.2 KB ≈ 1 000–1 500 output tokens against
`max_tokens` 20 000 / 24 000 (≥ 13× headroom). Forecast ≈ $0.11 (≤ $1). Gate holds.
