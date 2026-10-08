# TASK_P16 — primer-go: the primer counts only the Go tests `go test ./...` runs (`src/primer/primerCommand.ts`)

> Phase P16 of `docs/PLAN.md` ("Фазы по записи": `P16 | primer (go) | issue #7`), operator 08.10. Issue
> VasyaLutiy/morph#7 (label `P15-golang`; `gh issue list --label P16-primer` and every `P16-*` label: none, 08.10) is
> built into the record of Component **primer**, Function **Primer Command** only (examples 8 and 9). The deck is cut by
> V2 (`morph plan --component primer --judge --checks decks/p16/checks.json`), filtered to this phase's 2 cards by
> `decks/p16/filter.py`. The first phase of the "one phase, one session" flow and the first without the mrph cross-check.
> After the merge: stop for the operator (no next phase queued).

## 1. Why this

- **The P15 smoke counted 6 files / 27 tests where `go test ./...` runs 3 / 12** (run 20261008-080344,
  `decks/p15/smoke/out/primer.json`: `tests {language "go", files 6, tests 27}`). Measured again at this gate on the
  smoke tree `/tmp/smoke-go/M` (branch `morph/20261008-080344`): the three judges' `*_examples_test.go` hold 4 + 5 + 3 =
  **12** `func Test`, all run by `go test -count=1 -v ./...` (go1.22.2); the other **3 files / 15 tests** are the probes
  `decks/m1/parts/_<id>_probe_test.go` (5 + 6 + 4), which the go tool ignores (a leading `_`). The error is 125 % on
  the tests, 100 % on the files.
- **`TestMain(m *testing.M)` counts as a test** under the P15 rule `^func Test(?:[A-Z0-9_]\w*)?\s*\(` (issue #7 §2);
  so do `TestX(b *testing.B)` and `TestX()`, which go test never runs as tests.
- **TypeScript, checked (issue #7 §1 last line):** the TS profile's pattern `^.*\.(test|spec)\.tsx?$` already leaves
  `decks/p*/parts/*.probe.ts` out — on this repository `git ls-files` lists **0** `.test.ts`/`.spec.ts` files outside
  `tests/` (113 in `tests/`, all counted; 0 probe files counted). Pinned cheaply: three lines of example 8.
- **Ripple, measured** (the reference patch of §2.2 in a scratch worktree from c447114, full `vitest run`): **0 of 746**
  red in 113 files. Primer Command example 7 stays true (all its tests take `(t *testing.T)`, no path rule applies).
- **Record size:** Component primer 29 160 → **29 805** bytes (≤ 30 000): Primer Command example 2 moved to
  `tests/fixtures/primer/examples.json` by key (as example 6 in P15) to make room for the two rules and examples 8, 9.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main** (module → what the code calls or constructs): `src/language/types.ts` — `LanguageProfile`
  (`id`, `extensions`, `testFilePattern`, …); `src/language/paths.ts` — `hasExtension(profile, path)`,
  `normalizePath(path)` (backslashes → `/`, leading `./` dropped); `src/language/profiles.ts` — `GO`, `TYPESCRIPT`,
  `PYTHON`, `PROFILES`; `src/primer/primerCommand.ts` — `isTestFile`, `countTests`, `primerCommand`, `PrimerDeps`,
  `TestCount` (all exported, unchanged in shape).
- **Preconditions of the callees.** git · `tmpRepo()` of `tests/helpers.ts` commits "init" with no file, so
  `document.files` counts exactly the files the test writes (examples 8: 11, 9: 13). git · `ls-files --others
  --exclude-standard` lists files and directories beginning with `.` or `_` (`calc/.swap_test.go` is listed; the
  go-mini `.gitignore` holds only `probe/`). language · `pickProfile` picks go in both examples (8: 10 `.go` files and
  no `.ts`; 9: 7 `.go`, no `.ts`).
- **Fixtures** (`tests/fixtures/`), each by the type the Function takes:

| file | type | what it is | what the Function returns on it |
|---|---|---|---|
| `primer/examples.json` key `"Primer Command 8"` | ONE object: `given`, `then` (text), `files` = 11 `[path, text]` pairs, `ts` = 3 `[path, text]` pairs | a go module with every ignore case (`_`, `.`, `testdata`, `vendor`, `decks/`) and three typescript paths | primerCommand: files 11, tests `{go, 2, 5}`; countTests(GO, files) `{go, 2, 5}`; countTests(TYPESCRIPT, ts) `{typescript, 1, 1}` |
| `primer/examples.json` key `"Primer Command 9"` | ONE object: `given`, `then`, `mini` = 10 paths, `smoke` = 3 paths | the P15 smoke tree: the 10 files of `go-mini/` (incl. `.gitignore` and the 3 probes) and the 3 judges' test files | primerCommand: files 13, tests `{go, 3, 12}`; countTests(GO, the 13) `{go, 3, 12}` |
| `go-mini/<path>` (each of `mini`) | text, one file each | the P15 gate module, unchanged | — (read with `fixture("go-mini/" + path)`) |
| `primer/go-smoke/calc/clamp_value_examples_test.go`, `calc/percent_of_examples_test.go`, `report/format_share_examples_test.go` | text, one file each, NEW | verbatim from the smoke run's branch (`git show`), 4, 5 and 3 `func Test…(t *testing.T)` | — (read with `fixture("primer/go-smoke/" + path)`) |
| `primer/examples.json` key `"Primer Command 2"` | ONE object, moved | the record's example 2 verbatim | unchanged |

  Example 8, counted: go test runs `calc/c_test.go` (`TestSum`, `TestEdge(*testing.T)`; `TestMain(m *testing.M)` is
  not a test) and `report/r_test.go` (`TestShare`, `TestRound`, `TestPad`) = 2 files, 5 tests; measured with go1.22.2
  `go test -count=1 -v ./...`, which also runs `decks/m1/smoke/s_test.go` (`TestSmoke`) — not counted by the decks rule
  (§2.2). Not counted: `calc/_old_test.go`, `calc/.swap_test.go`, `_attic/a_test.go`, `decks/m1/parts/_p_probe_test.go`
  (a `_`/`.` segment), `calc/testdata/fix_test.go`, `vendor/v/v_test.go` (directory), `decks/m1/smoke/s_test.go` (decks).
  The 11th file is `go.mod`, the 10th `calc/c.go`. ts: `tests/a.test.ts` (1 test) counts; `decks/p9/parts/a.probe.ts`
  (not a test-file name) and `decks/p9/smoke/b.test.ts` (decks) do not.
- **Harness skeleton** (the judge's, only `tests/helpers.ts`):

```ts
type Pair = [string, string];
const EX = fixtureJson("primer/examples.json") as Record<string, { files?: Pair[]; ts?: Pair[]; mini?: string[]; smoke?: string[] }>;
const deps = { env: { PATH: process.env.PATH ?? "" }, now: () => 1791400000000 };
// example 8: t = tmpRepo(); for (const [p, text] of EX["Primer Command 8"].files ?? []) t.write(p, text);
//   primerCommand(t.root, false, deps); countTests(GO, files as {path, text}); countTests(TYPESCRIPT, ts as {path, text})
// example 9: pairs = mini.map(p => [p, fixture("go-mini/" + p)]) then smoke.map(p => [p, fixture("primer/go-smoke/" + p)]);
//   t = tmpRepo(); write each; primerCommand(t.root, false, deps); countTests(GO, pairs as {path, text})
// both: try { … } finally { t.rm(); }
```

**Distinct markers.** Paths `calc/_old_test.go`, `_attic/a_test.go`, `decks/m1/smoke/s_test.go`, `vendor/v/v_test.go`,
`calc/testdata/fix_test.go`; counts 11/2/5, 13/3/12, and example 7's 5/2/4 differ, so no count can be hard-coded.

### 2.2. OUTPUT data shapes

**`src/primer/primerCommand.ts`** (PATCH), two changes, every other line unchanged:

1. **`isTestFile(profile, file)`**: after `hasExtension`, split `normalizePath(file)` on `/`:
   - for **every** profile, a path whose first segment is `decks` and has more segments is no test file;
   - for profile id **`go`**, a path is no test file when **any** segment (a directory or the file) begins with `_` or
     `.`, or when any segment **but the last** is `testdata` or `vendor`;
   - otherwise the base name against `profile.testFilePattern`, as before.
2. **The go call rule**: `/^func Test(?:[A-Z0-9_]\w*)?\s*\(\s*(?:\w+\s+)?\*testing\.T\s*\)/gm` — `Test` then nothing or a
   non-lower-case letter, exactly one parameter of type `*testing.T`, named or not (`t`, `_`, none); `TestMain(m
   *testing.M)`, `*testing.B`, `*testing.F`, two parameters and no parameter do not count; an indented or commented
   `func` does not count (the `^`). typescript and python rules unchanged.

| Primer Command example | given (`primer/examples.json`) | result |
|---|---|---|
| 8 | `files` written to a tmpRepo; then countTests(GO, files) and countTests(TYPESCRIPT, ts) | code 0; files 11; tests `{language: "go", files: 2, tests: 5}`; the same from countTests(GO); `{language: "typescript", files: 1, tests: 1}` |
| 9 | the 10 `mini` paths from `go-mini/`, the 3 `smoke` paths from `primer/go-smoke/` | code 0; files 13; tests `{language: "go", files: 3, tests: 12}`; the same from countTests(GO) |

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P16 primer-go"; #7 = issue VasyaLutiy/morph#7):

- **Where the rule lives (#7)** · in Primer Command's `isTestFile` keyed on the profile id, like the call rule — not a
  new `LanguageProfile` field: a field would change `types.ts`, the three profiles, `language/go.json` and Resolve
  Profile example 5 (a second Component and three more cards) for one consumer.
- **decks/ for every profile (#7)** · Morph's deck data (probes, smoke copies) is never the project's tests, even where
  a toolchain would run it (`decks/m1/smoke/s_test.go` runs under `go test ./...`); only the top-level `decks/`
  (`src/decks/a_test.go` counts). TypeScript: 0 files of this repository change count (measured).
- **The Go toolchain's ignore rules (#7 §1)** · a `_`/`.` prefix on any segment, `testdata` as a directory (go's
  documented rules) and `vendor` as a directory (`./...` never matches vendored packages; measured: `vendor/v/v_test.go`
  not run). Nested modules (a directory with its own `go.mod`, also not under `./...`) are out of scope (§7).
- **TestMain (#7 §2)** · the rule requires the one parameter `*testing.T` (the issue's second proposal) rather than
  excluding the name: it also drops `*testing.B`/`*testing.F` and parameterless funcs, which go test does not run;
  an unnamed `(*testing.T)` counts (go runs it). A `testing` import under another name is out of scope.
- **TypeScript probes (#7 §1)** · already excluded by the name pattern (`.probe.ts` is no `.test.ts`); pinned by the
  three `ts` paths of example 8, no code change for TS.
- **Record size** · Primer Command example 2 moved to `examples.json` by key: 29 160 + the rules and examples 8, 9
  would pass 30 000.

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/primer/primerCommand.ts` | PATCH | probe only (`decks/p16/parts/primer-command.probe.ts`) | NEW `tests/primer/primerCommand.p16.examples.test.ts` (PrC 8, 9) |

- `primerCommand.p16.examples`: "Primer Command example 8: …", "Primer Command example 9: …", the skeleton of §2.1, every
  expected count a literal, each tmpRepo removed in finally.

### 2.4. What must not break

- Byte for byte: every file but the target and the new test file — `src/primer/{readRuns,readStory,renderPrimer}.ts`,
  `src/language/*`, `tests/helpers.ts`, every existing `tests/primer/*.test.ts`, `contour.yaml`, `morph-map.json`,
  `docs/`, `decks/`, `tests/fixtures/`.
- 746 tests in 113 files green at every card (ripple 0, `fullExclude` empty); after the run **746 + 2 = 748** in 114
  files (± the judge's own rows).

## 3. Acceptance

Built by `morph plan --checks decks/p16/checks.json`, narrow to broad, every stage printing `== <stage>`. `ownGit: true`
(the judge spawns git in its tmpRepo), `fullExclude` empty (ripple 0).

Code card (no test file): `probe/<card>/` → `tsc` (per-card tsconfig) → `eslint <target>` → `guard.mjs src <target>` →
`decks/p16/parts/primer-command.probe.ts` (PrC 8, PrC 9 + 2 rows = **4 tests**: the path rules per profile, 27 paths;
the go call rule on 12 funcs, 5 counted) → eslint's verdict → full `vitest run` → own git → frozen → untracked.

Judge card: `probe/<card>/` → `tsc` → `eslint <target>` → `guard.mjs tests <file> 2 8 lits.json` → `vitest run <file>` →
eslint's verdict → full run → own git → frozen → untracked.

| file | new | min | max | lits |
|---|---|---|---|---|
| `tests/primer/primerCommand.p16.examples.test.ts` | yes | 2 | 8 | `Primer Command example 8`, `Primer Command example 9`, `primer/examples.json`, `primer/go-smoke/`, `go-mini/` |

min = 2 examples; max = min + 6 (new file).

**Output budget** (`max_tokens`, before the session's ×3 for `ds`):

| card | returns | `max_tokens` |
|---|---|---|
| primer-command | primerCommand.ts ≈ 7.3 KB whole (reference 7 296 bytes) | 16 000 |
| primer-command-judge | ≈ 2.5–3.5 KB new (the probe's two example tests: 2.3 KB) | 12 000 |

## 4. Constraints

- NodeNext: relative imports carry `.js`; types with `import type`. No `any`.
- Layer primer unchanged: primerCommand.ts imports nothing new.
- A file a card writes is in no sibling's slice in its generation: generation 0 (primer-command) reads no P16 target;
  generation 1 (primer-command-judge) reads `src/primer/primerCommand.ts`.
- Tests write only under `tmpRepo()` and remove it in finally; no network; no `go` spawned by any test (V2's suite stays
  runnable without a Go toolchain, P15 decision); a judge writes only its target.

## 7. Out of scope

- Nested Go modules (a subdirectory with its own `go.mod`), build tags and `//go:build ignore`, a renamed `testing`
  import, `ExampleXxx`/`FuzzXxx`/`BenchmarkXxx` counts — the count stays "tests".
- Python's own runner rules (pytest's `norecursedirs`) — only `decks/` applies to python.
- Primer's profile choice (`pickProfile` still counts `.go` files under `decks/` and `testdata/`): unchanged, issue #7
  does not name it.
- The reviewer on Go (P15 §7).

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component primer --judge \
  --checks decks/p16/checks.json --out decks/p16/deck.json
python3 decks/p16/filter.py decks/p16/deck.json                  # keeps the 2 cards of the phase
python3 decks/tools/scale_tokens.py decks/p16/deck.json 3        # processor ds
node dist/cli.js deck check --root . --deck decks/p16/deck.json                                   # errors 0
rm -rf /tmp/v2bin-p16 && mkdir -p /tmp/v2bin-p16 && cp -r dist /tmp/v2bin-p16/ && ln -s $PWD/node_modules /tmp/v2bin-p16/node_modules
node /tmp/v2bin-p16/dist/cli.js run --root . --deck decks/p16/deck.json --processor ds --deadline 2400
```

No mrph cross-check (operator 08.10).

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 2 (1 code, 1 judge) / 2: [primer-command] [primer-command-judge] |
| executor bill | ≈ $0.03–0.08 on ds ×3 (3 first requests: 2 variants + 1 judge; P15 12 cards ran for ≈ $0.10–0.40); ≤ $0.15 with a re-cut; cap $5 |
| cards with regeneration | 0–1 of 2 (primer-command: `vendor`/`testdata` checked on the last segment too, or the decks rule only for go) |
| tests after the run | 748 ± 6 in 114 files |
| first red | primer-command: the rows test (an edge path); the judge: a count taken from the fixture instead of a literal (the guard's lits pass, own run green — no red expected) |

**Falsifiable claims:** (1) no answer cut at its `max_tokens`; (2) after the run no file outside §2.3's two changed;
(3) primerCommand.ts imports nothing new; (4) the primer on the smoke tree gives `{go, 3, 12}`.

## 10. What to record

Attempts and first red per variant, minutes, $ (provider), truncations, judge defects, the MEASURE row with its
`прогоны` cell, the preparation's tokens/calls/minutes; DECISIONS lines "P16 primer-go".

## 11. Actual

### Gate (preparation)
