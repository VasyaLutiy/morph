# TASK_P21a — the breaking re-cut, part a: a Go `--only` cut hides, per card, the subset's files the run has not written yet (`src/planner/hideLater.ts`, `src/cli/goTree.ts`, `src/builder/{types,buildAcceptances}.ts`, `src/cli/planCommand.ts`)

> Phase P21 of `docs/PLAN.md` ("Фазы по записи (после P2)": `P21 | planner (subset overlay / generations) + checks +
> gate | issue #12`), operator 09.10. Issue VasyaLutiy/morph#12 (label `P21-breaking-recut`; `gh issue list --label
> P21-breaking-recut`: #12 only); the request is MorphStudio's `docs/MORPHV2_REQUEST_breaking-recut.md` (read through
> `gh api`). Direction **A** of the issue, measured and refined (§1, §2.2 "Direction"): code cards in Components
> **planner-subset** (Hide Later, Read Go Tree — NEW) and **builder** (Build Acceptances) and **cli** (Plan Command);
> a gate tool and the regulation are data. The deck is cut by V2 with `--only` (8 cards, 4 generations); one gate
> (≤ $1, slices ≤ 200 KB, chains < 250 s, §11). **Split** (operator 09.10, amendment of #12, comment 6075790078: item
> 3.5 is now REQUIRED — `morph deck check` on an `--only` deck builds each generation's tree with stubs and names
> `file:line` of a file outside the generation's targets failing build or vet): the overlay (8 cards) and that check
> (≥ 8 more: a stub-tree planner, a go runner outside src/acceptance, Deck Check and Parse Command in cli, which first
> needs a compaction at 29.9 KB) do not fit 12 cards; **P21a = the overlay (this file), P21b = `deck check` on an
> `--only` deck** (§7). The P7b-shaped fixture `tests/fixtures/go-p7b` serves both.

## 1. Why this

- **A re-cut that renames an API never reaches a run.** MorphStudio P7b (09.10, main beb955f, MorphV2 179c795, $0):
  `morph plan --only` of 12 cards over control, supervisor, daemon, pump, cmd, generations [1,2,2,2,1,3,1]; the record
  renames `Loop.Resumes` → `Restarts` and gives `Loop.Exited` a `stderr` argument. phase-loop (gen 2) red at `== build`:
  `supervisor/guard.go:20:22: l.Resumes undefined` (guard.go = runtime-guard, gen 3); runtime-guard red at `== vet`
  `supervisor/guard_examples_test.go:82:42: not enough arguments in call to l.Exited` (a later judge) and at `== full` on
  `daemon/daemon.go`, `daemon/pump.go:100` (gens 4, 5). P15's overlay hides only the same generation's other targets,
  P20 computes them over the subset — later generations stay visible, old. The workaround (compat names in the record)
  was dropped by MorphStudio's operator: P7b waits for this phase.
- **Reproduced here** on `tests/fixtures/go-p7b` (P7b's shape, module `morphlite`: Loop.Resumes → Restarts,
  Loop.Exited(code, now) → Exited(code, stderr, now); guard.go:20 reads `l.Resumes`; daemon.go calls Exited;
  mcp/session.go, no card's target, imports supervisor as MorphStudio's mcpserver test does; 8 cards, generations
  [control-contract] [control-contract-judge, phase-loop] [phase-loop-judge, runtime-guard] [daemon-core,
  runtime-guard-judge] [daemon-core-judge] — P7b's first five) by `decks/p21/demo.sh <bin> <variant>` (the stub run of
  every card with `stubcheck.mjs` and `fullvet.mjs`, then the reference answer accepted, in deck order). Main's binary
  (f6cf44d): **stubcheck red 4 / 8** — phase-loop at `== build` `supervisor/guard.go:20:23: l.Resumes undefined (type
  *Loop has no field or method Resumes)`, P7b's line —, **fullvet red 5 / 8**, **references red 6 / 8**.
- **Direction measured** (reference code in a scratch worktree, never committed; demo 10 s per binary):

| variant of the overlay | go-p7b stubcheck red | fullvet red | references red | P7b's own old tree (beb955f, 12 cards, 58 Go files): full-overlay vet red |
|---|---|---|---|---|
| P20 (main): same generation only | 4 / 8 | 5 / 8 | 6 / 8 | — (MorphStudio's gate reds, §1 first bullet) |
| A, later generations only (siblings visible in `full`) | 0 / 8 | 2 / 8 | 2 / 8 | — |
| A plain: every not-yet-written subset target (same generation and later) | 0 / 8 | 2 / 8 | 2 / 8 (`mcp/session.go:6:2: package morphlite/supervisor is not in std`) | **2 / 12** (`mcpserver/session_examples_test.go:14:2: package morphstudio/supervisor is not in std`) |
| **A + keep (this phase)**: as plain, but a package something visible imports is never hidden whole | **0 / 8** | **0 / 8** | **0 / 8** | **0 / 12**; the P7b files sit in the hide lists: guard.go for phase-loop; guard_examples_test.go, daemon.go, pump.go for runtime-guard; pump.go for daemon-core |

  Residual risks, each measured on a go-p7b variant with A + keep: **r1** an earlier card's code calls a method of a
  later file of its own package (loop.go calling Guard) → its reference red at `== build` `supervisor/loop.go:25:8:
  l.Guard undefined` (its own file, the retry's diagnosis), invisible to stubs; **r3** a file outside the subset reads the
  old name (mcp/count.go) → **named at the gate** by fullvet at phase-loop's stub (`mcp/count.go:6:52: l.Resumes
  undefined`); **r4** a command outside the subset imports a package only later cards rewrite (cmd/morphd/main.go →
  daemon) → the package stays visible, old, and is **named at the gate** by fullvet (`daemon/daemon.go:9:78: not enough
  arguments in call to d.Loop.Exited`) — only a joint acceptance (direction B) could pass r4.
- **Size.** 4 code cards + 4 judges = **8 cards**, 4 generations, code-only targets (probes, no smoke test). Reference
  code: hideLater.ts ≈ 1.6 KB new, goTree.ts ≈ 1.9 KB new, 14 changed lines in types.ts + buildAcceptances.ts, 3 in
  planCommand.ts.
- **Ripple, measured** (the reference code in the scratch worktree with this phase's data, full suite): **0 of 793** red —
  `hide` is an optional input key, Plan Command passes it only with `--only` and the go profile, and Hide Later returns
  {} for a one-generation subset, so Plan Command 12/13 (P20) and every cut without `--only` are byte for byte.
- **Record sizes** (bytes of each Component block): planner-subset 2 900 → **11 694**; builder 29 240 → **29 721** (Build
  Acceptances example 9's literals in `tests/fixtures/builder/examples.json`); cli 29 567 → **29 857** (≤ 30 KB rule).

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main** (module → what the new code calls or constructs): `src/planner/types.ts` — `Plan` (`{spec,
  components, cards, generations, externalDependsOn}`); `src/cards/types.ts` — `Card` (`customId`, `targets` …);
  `src/builder/types.ts` — `BuildInput`, `CardContext`, `Checks`; `src/builder/buildAcceptances.ts` — members, their
  generations (`layerGenerations` of the members) and siblings; `src/builder/goAcceptance.ts` — `goCodeAcceptance`,
  `goJudgeAcceptance` (ctx.siblings → `$P/overlay.json`, ctx.fullExclude → `$P/full.json`, `.go` paths only);
  `src/cli/planCommand.ts` — Plan Spec, Select Cards (P20), Resolve Profile, Read Plan Checks, Build Acceptances.
- **Preconditions of the callees.** builder · Build Acceptances · ctx.siblings becomes the Go overlay of build, vet,
  probe and own, ctx.fullExclude the overlay of `== full`; a path that does not exist is harmless to `-overlay` (go vet
  and go test exit 0, measured) — so a hidden later file that is new in the run costs nothing. planner · Select Cards ·
  the subset's generations are Order Deck's over the kept cards, so they equal Layer Generations of the members when the
  checks name every kept card (`decks/b1/checks.json` does). go · `-overlay` with an empty replacement deletes the file for
  that command; a directory left with no non-test file is no package (`package … is not in std` for an importer).
- **Fixtures** (`tests/fixtures/`), each by the type the Function takes:

| file | type | what it is | what the Function returns on it |
|---|---|---|---|
| `go-p7b/*` (NEW) | files of a tmp root | contour.yaml (Components control: Control Contract; supervisor: Phase Loop, Runtime Guard; daemon: Daemon Core — the NEW API: Restarts, Exited(code, stderr, now)), morph-map.json, go.mod (`module morphlite`), internal/testhelp/testhelp.go, decks/b1/checks.json (8 cards), four `decks/b1/parts/_<id>_probe_test.go`, decks/tools/layers.json, the eight Go files of control/, supervisor/, daemon/ holding the OLD API (Resumes, Exited(code, now); guard.go:20 `for _, at := range l.Resumes {`) and mcp/session.go (no card's target, imports supervisor for ErrPhaseMismatch) | Read Go Tree 1 (= cli/goP7b.tree.json); Plan Command 14 |
| `cli/goP7b.tree.json` (NEW) | ONE Go Tree | Read Go Tree of go-p7b: 10 files; daemon/daemon.go and mcp/session.go import ["supervisor"], supervisor/loop.go ["control"], the four `_test.go` ["internal/testhelp"] | Read Go Tree 1 |
| `planner/hide.plan.json` (NEW) | ONE `Plan` object | 7 cards s, f, r, sj, fj, m (targets summary/summary.go AND summary/README.md, dependsOn f and the external "kept"), mj; generations [["s"], ["f", "r", "sj"], ["fj", "m"], ["mj"]] | Hide Later 1–4 (§2.2) |
| `planner/hide.tree.json` (NEW) | ONE Go Tree | the Go Tree of a calc/report/summary module: 9 files, imports report/format_line.go → ["calc"], summary/summary.go → ["report"], every `_test.go` → ["internal/testhelp"], the rest [] | Hide Later 1, 3, 4 (2 and 3 add one file) |
| `cli/goTree.json` (NEW) | ONE object path → text | the synthetic root of Read Go Tree 2 (15 files: 6 listed, 9 skipped) | Read Go Tree 2 |
| `builder/examples.json` (NEW) | ONE object | given/then of Build Acceptances 9 | — |
| `cli/examples.json` (key "Plan Command 14" added) | ONE object | given/then of Plan Command 14 | — |

- **Harness skeletons** (only `tests/helpers.ts` and the modules named):

```ts
// Hide Later: fresh inputs per test (the function must not change them); "plus" adds one kept file, files sorted again
const plan = (): Plan => fixtureJson("planner/hide.plan.json") as Plan;
const tree = (): GoTree => fixtureJson("planner/hide.tree.json") as GoTree;
const plus = (t: GoTree, file: string, imports: string[]): GoTree => ({ files: [...t.files, file].sort(), imports: { ...t.imports, [file]: imports } });
// Read Go Tree: a tmp root from path → text; example 1 copies these go-p7b files
function rootOf(files: Record<string, string>): TmpRoot { const r = tmpRoot(); for (const [p, t] of Object.entries(files)) r.write(p, t); return r; }
const P7B1 = ["contour.yaml", "morph-map.json", "go.mod", "internal/testhelp/testhelp.go", "decks/b1/checks.json", "decks/b1/parts/_phase-loop_probe_test.go",
  "control/control.go", "control/control_examples_test.go", "supervisor/loop.go", "supervisor/guard.go", "supervisor/loop_examples_test.go",
  "supervisor/guard_examples_test.go", "daemon/daemon.go", "daemon/daemon_examples_test.go", "mcp/session.go"];
// Build Acceptances 9: cards and checks as literals
const card = (id: string, targets: string[], dependsOn: string[] = []): Card => ({ customId: id, intent: "generate", targets,
  contextSlice: [], instruction: "write " + targets[0], acceptance: null, model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn });
const ctx = (id: string, targets: string[], siblings: string[], fullExclude: string[]): CardContext => ({ id, phase: "p9", targets, siblings,
  frozen: DEFAULT_FROZEN, fullExclude, ownGit: false, profile: GO, guard: "// guard\n", firstdiff: "// firstdiff\n", allowed: [], vendor: false });
// Plan Command 14: the go-p7b root (P7B1 plus the three other probes); every root: try { … } finally { r.rm(); }
const P7B = [...P7B1, "decks/b1/parts/_control-contract_probe_test.go", "decks/b1/parts/_runtime-guard_probe_test.go", "decks/b1/parts/_daemon-core_probe_test.go"];
function p7bRoot(): TmpRoot { const r = tmpRoot(); for (const f of P7B) r.write(f, fixture("go-p7b/" + f));
  r.write("decks/tools/guard.mjs", "// guard\n"); r.write("decks/tools/firstdiff.mjs", "// firstdiff\n"); return r; }
const args = (over: Partial<PlanArgs>): PlanArgs => ({ name: "plan", root: ".", pretty: false, spec: "contour.yaml", map: "morph-map.json",
  components: ["control", "supervisor", "daemon"], judge: true, out: null, checks: "decks/b1/checks.json", ...over });
// mcp/session.go removed: fs.rmSync(r.path("mcp/session.go")) (node:fs in the test file is allowed)
```

**Distinct markers.** Card ids s, f, r, sj, fj, m, mj, a, b, c, zz; the external id "kept"; the module paths brk,
example.com/m, example.com/mother/q; the overlay lines of Plan Command 14 written out whole. The code hard-codes none.

### 2.2. OUTPUT data shapes

**`src/planner/hideLater.ts`** (NEW; layer planner; pure, node:path only) — **Hide Later**:

```ts
import path from "node:path";
import type { Plan } from "./types.js";
export interface GoTree { files: string[]; imports: Record<string, string[]> }
export function hideLater(plan: Plan, tree: GoTree): Record<string, string[]>;
```

- `plan.generations.length < 2` → `{}`.
- Else, for every card c of `plan.cards` (in order; g = the index of the generation holding `c.customId`): hide = the
  targets ending `".go"` of every OTHER card of `plan.cards` whose generation index is ≥ g, in `plan.cards` order then
  target order, each once (a path already in hide is skipped).
- Then, until no directory qualifies: a directory D (`path.posix.dirname` of a file in hide) qualifies when D's non-test
  files in `tree.files` (dirname D, not ending `"_test.go"`) are **at least one and all in hide**, and some file of
  `tree.files` **not in hide** lies in D or imports D (`tree.imports[file]` holds D). Its non-test files leave hide; its
  test files stay. (The removal only grows the visible set, so the order of the passes never changes the result.)
- → `{[c.customId]: hide}` for every card, an empty list included; the plan and the tree are never changed.

| example | given | result |
|---|---|---|
| Hide Later 1 | hide.plan.json, hide.tree.json | s: [format_line.go, ratio_of.go, scale_value_examples_test.go, format_line_examples_test.go, summary.go, summary_examples_test.go]; f: [ratio_of.go, scale_value_examples_test.go, format_line_examples_test.go, summary.go, summary_examples_test.go]; r: [format_line.go, scale_value_examples_test.go, format_line_examples_test.go, summary.go, summary_examples_test.go]; sj: [format_line.go, ratio_of.go, format_line_examples_test.go, summary.go, summary_examples_test.go]; fj: [summary.go, summary_examples_test.go]; m: [format_line_examples_test.go, summary_examples_test.go]; mj: [] (each path with its directory, as the record writes it) |
| Hide Later 2 | the tree plus `cmd/tool/main.go` importing ["summary"] | s: [ratio_of.go, scale_value_examples_test.go, format_line_examples_test.go, summary_examples_test.go]; f: the same; r: [scale_value_examples_test.go, format_line_examples_test.go, summary_examples_test.go]; sj: [ratio_of.go, format_line_examples_test.go, summary_examples_test.go]; fj: [summary_examples_test.go]; m: [format_line_examples_test.go, summary_examples_test.go]; mj: [] |
| Hide Later 3 | the tree plus `summary/legacy_test.go` importing [] | the result of example 2 |
| Hide Later 4 | the plan cut to its card s with generations [["s"]]; then the plan with the tree minus summary/summary.go plus cmd/tool/main.go → ["summary"] | {}; then the result of example 1 |

**`src/cli/goTree.ts`** (NEW; layer cli; node:fs, node:path) — **Read Go Tree**:

```ts
import fs from "node:fs";
import path from "node:path";
import type { GoTree } from "../planner/hideLater.js";
export function readGoTree(root: string): GoTree;
```

- Module path: the first line of `root/go.mod` matching `^module\s+(\S+)` (multiline); no go.mod or no such line → none.
- files: every regular file ending `".go"` under root (`readdirSync(…, {withFileTypes: true})`; a symbolic link is
  neither a directory nor a file there, so it is not followed), skipping every directory named `vendor` or `testdata` or
  starting with `.` or `_`, and every file starting with `.` or `_` (the go tool's rules); relative paths joined by `/`,
  sorted with JavaScript's default `sort()`.
- imports: a key for every file of files; the value lists the module's own packages it imports as directories, in
  first-seen order, each once: a path equal to the module path → `"."`; starting with module path + `"/"` → the rest;
  any other path is left out; no module path → `[]` for every file. The paths are read from the import declarations:
  a line starting with `import` followed by an optional name (an identifier, `.` or `_`) and a double-quoted path, and
  the lines of an `import (` … `)` block (the block closes at a line starting with `)`), each line holding a quoted
  path once its `//` comment is removed. A word `import` that does not start a line is no declaration.

| example | given | result |
|---|---|---|
| Read Go Tree 1 | the go-p7b files of the skeleton's P7B1 in a tmp root | equal to cli/goP7b.tree.json |
| Read Go Tree 2 | the files of cli/goTree.json in a tmp root | files ["main.go", "x/x.go", "y/deep/d.go", "y/y.go", "z/z.go", "z/z_test.go"]; imports {"main.go": ["x"], "x/x.go": ["y", "z", "."], "y/deep/d.go": [], "y/y.go": ["y/deep"], "z/z.go": [], "z/z_test.go": ["x"]} |
| Read Go Tree 3 | a/a.go importing "brk/calc", b.go, no go.mod | {files: ["a/a.go", "b.go"], imports: {"a/a.go": [], "b.go": []}} |

**`src/builder/types.ts`, `src/builder/buildAcceptances.ts`** (PATCH) — **Build Acceptances**: `BuildInput` gains
`hide?: Record<string, string[]>` (after `vendor`). A member whose customId is an OWN key of `input.hide` gets
`ctx.siblings` = its siblings followed by each path of `hide[customId]` not yet in that list, and `ctx.fullExclude` =
`checks.fullExclude` followed by each such path not yet in it (new arrays; `checks` unchanged). No hide, or no own key →
today's ctx byte for byte. A key that is no member is ignored. Every profile reads it the same way (Plan Command passes it
only for go).

| example | given / result |
|---|---|
| Build Acceptances 9 | `tests/fixtures/builder/examples.json["Build Acceptances 9"]`: go cards a (calc/a.go), b (calc/b.go, after a), c (report/c.go, after a); fullExclude ["calc/old_test.go"]; hide {"a": ["calc/b.go", "report/c.go"], "b": ["report/c.go", "calc/b_test.go"], "zz": ["x.go"]} → a: siblings ["calc/b.go", "report/c.go"], fullExclude ["calc/old_test.go", "calc/b.go", "report/c.go"]; b: ["report/c.go", "calc/b_test.go"], ["calc/old_test.go", "report/c.go", "calc/b_test.go"]; c: ["calc/b.go"], ["calc/old_test.go"]; without hide a: [], ["calc/old_test.go"], b: ["report/c.go"], ["calc/old_test.go"] — each acceptance = goCodeAcceptance(that ctx, "package calc\n", null, null) |

**`src/cli/planCommand.ts`** (PATCH) — **Plan Command**: with `args.only` given and the resolved profile `go`, the input
of Build Acceptances also holds `hide: hideLater(plan, readGoTree(root))` (plan = Select Cards' subset); otherwise the
input is today's object (no `hide` key) and the tree is not read. Nothing else changes.

| example | given (tests/fixtures/cli/examples.json) | result |
|---|---|---|
| Plan Command 14 | the go-p7b root; args with only the 8 ids; then without only; then mcp/session.go removed and only again | code 0; generations [[control-contract], [control-contract-judge, phase-loop], [phase-loop-judge, runtime-guard], [daemon-core, runtime-guard-judge], [daemon-core-judge]]; phase-loop's acceptance holds `{"Replace":{"control/control_examples_test.go":"","supervisor/loop_examples_test.go":"","supervisor/guard.go":"","daemon/daemon.go":"","supervisor/guard_examples_test.go":"","daemon/daemon_examples_test.go":""}}` twice (guard.go hidden: P7b's `guard.go:20` cannot redden phase-loop); control-contract's holds `{"Replace":{"control/control_examples_test.go":"","supervisor/loop_examples_test.go":"","daemon/daemon.go":"","supervisor/guard_examples_test.go":"","daemon/daemon_examples_test.go":""}}` twice (supervisor's loop.go and guard.go stay for mcp/session.go); without only the same generations and cards but the acceptances, phase-loop's holding `{"Replace":{"control/control_examples_test.go":""}}` and `{"Replace":{}}` once each — the --only one is it with both replaced by the first line; daemon-core-judge's acceptance equal in both cuts; without mcp/session.go control-contract's holds `{"Replace":{"control/control_examples_test.go":"","supervisor/loop.go":"","supervisor/loop_examples_test.go":"","supervisor/guard.go":"","daemon/daemon.go":"","supervisor/guard_examples_test.go":"","daemon/daemon_examples_test.go":""}}` twice |

**The gate tool (data, written by the orchestrator; not a card's target).** `decks/tools/fullvet.mjs` (=
`templates/go/decks/tools/fullvet.mjs`, Node only): `node decks/tools/fullvet.mjs <deck.json> <card-id>` from a Go
module root vets the WHOLE module under the card's `$P/full.json` overlay and `GOFLAGS` line (both read from the card's
acceptance) — the `== full` compile a stub run never reaches; exit 1 with one line per vet line naming a `.go` file
outside the card's targets (or a missing package), exit 0 `fullvet: <id> vets clean outside its targets (<n> files
hidden)`. The gate runs it on every Go stub tree after stubcheck (`docs/AUTONOMY.md` step 1, the templates' AUTONOMY).

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P21 breaking"; #12 = issue VasyaLutiy/morph#12):

- **Direction** · A (hide every subset target not yet written in this run) with a keep rule, measured above; not B (a
  joint group acceptance is new runloop semantics — outcome per card, retries, failure class — for the one case A cannot
  pass, r4, which the gate names), not C (it breaks P15L's "two code cards of one package never share a generation" and
  still leaves the later packages' old files visible in `full`).
- **Same generation in full** · with ≥ 2 generations a card's `full.json` also hides its generation's other targets ·
  measured: later-only leaves 2 / 8 go-p7b references red at `== full` on a sibling's old file (phase-loop-judge sees
  runtime-guard's old guard.go:20, daemon-core sees runtime-guard-judge's old test); the narrow overlay hid siblings
  already (P15).
- **One generation** · Hide Later returns {} · P20's re-run of failed cards (Plan Command 12, 13) stays byte for byte; such
  a subset has no later card.
- **Keep rule** · a package whose non-test files are all hidden stays (non-test files only) when a visible file is in it or
  imports it, to a fixed point · measured: plain A reddens 2 / 12 P7b cards (`mcpserver/session_examples_test.go` imports
  supervisor, hidden whole at gens 1–2); keep → 0 / 12; requirement 2 of #12 ("no package hidden whole") for every
  package something visible uses; a card's own package is never hidden whole (its own target is never in its hide).
- **Where** · Hide Later pure in planner-subset (`src/planner/hideLater.ts`), the file walk in `src/cli/goTree.ts` (the cli
  layer reads files), Build Acceptances takes the result as `hide` and folds it into siblings/fullExclude — builder-go is
  untouched (its overlays already come from those two lists) · cli is at 29.9 KB, builder at 29.7 KB of the 30 KB rule.
- **Import reading** · lines starting with `import` and `import ( … )` blocks, no Go parser · the keep rule needs the
  module's own imports only; `go list` would spawn from the planner side and fail on the broken trees it must describe.
- **Profiles** · hide only for the go profile · the issue is Go's whole-package build; a TypeScript cut keeps its bytes
  (P20's per-card tsconfig); Hide Later would list no `.ts` path anyway.
- **Kept files broken by the record** (#12 requirement 3) · never hidden; named before any paid run by the gate:
  stubcheck (a kept file in a target's package, at the card's narrow build/vet) and fullvet (anywhere in the module) ·
  r3 and r4 above; requirement 3.5 (now required: `morph deck check` names them, in the tool) is P21b (§7).
- **Residual risk r1** · an earlier card's code that calls a function of a later file of its package reddens at its own
  `== build` with "undefined: <name>" naming its own file · the record's `calls` order the cards, so only an undeclared
  call does this; the retry gets the line; DECISIONS known risk.
- **The verify step** · no card's `full` sees the whole final tree when the last generation holds two or more cards · the
  run's verify (`go test ./...` on the run branch, AUTONOMY step 4) does; go-p7b's and P7b's last generation is one card.

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/planner/hideLater.ts` | NEW | probe only | NEW `tests/planner/hideLater.examples.test.ts` (Hide Later 1–4) |
| `src/cli/goTree.ts` | NEW | probe only | NEW `tests/cli/goTree.examples.test.ts` (Read Go Tree 1–3) |
| `src/builder/types.ts`, `src/builder/buildAcceptances.ts` | PATCH | probe only | NEW `tests/builder/buildAcceptances.p21.examples.test.ts` (Build Acceptances 9) |
| `src/cli/planCommand.ts` | PATCH | probe only | NEW `tests/cli/planCommand.p21.examples.test.ts` (Plan Command 14) |

- `hideLater.examples`: "Hide Later example 1: …" to "… 4: …" with the skeleton's `plan()`, `tree()`, `plus()`; each
  expected map written out as a literal (full paths); at most 6 own tests (e.g. inputs unchanged).
- `goTree.examples`: "Read Go Tree example 1: …" to "… 3: …" on tmp roots (`rootOf`); example 1 compares with
  `fixtureJson("cli/goP7b.tree.json")`, example 2 writes the literal; at most 6 own tests.
- `buildAcceptances.p21.examples`: "Build Acceptances example 9: …", the skeleton's `card` and `ctx`, each acceptance
  compared with `goCodeAcceptance(ctx(…), "package calc\n", null, null)`; at most 6 own tests.
- `planCommand.p21.examples`: "Plan Command example 14: …" on `p7bRoot()`, the overlay lines written out; at most 6 own
  tests.

### 2.4. What must not break

- Byte for byte: every file outside the 5 code targets and the 4 new test files of §2.3 — every other `src/` file,
  `tests/helpers.ts`, every existing test file; `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/`,
  `templates/` — untouched by every card (frozen).
- **A cut without `--only` byte-identical**, and a one-generation `--only` cut too: go-mini (`--checks
  decks/m1/checks.json`, Plan Command 9's `cli/goMini.deck.json`), the P15 deck re-cut from its own tree 0365336, the
  P20 identity procedure (DECISIONS "P20 · byte identity") — main's binary vs this phase's reference binary (§11).
- 793 tests in 128 files green at every card (no deck-wide exclusion); after the run **793 + 4 + 3 + 1 + 1 = 802** in 132
  files (± the judges' own tests).

## 3. Acceptance

Built by `morph plan --checks decks/p21/checks.json`, narrow to broad, every stage printing `== <stage>`. `ownGit: true`,
`frozen` the defaults + `templates`, `fullExclude` none (ripple 0).

Code cards (no test file; code-only targets): `probe/<card>/` → `tsc` (per-card tsconfig excluding the generation's other
targets) → `eslint <targets>` → `guard.mjs src <targets>` → the probe `decks/p21/parts/<card>.probe.ts` (hide-later HL
1–4 + 1 row = 5; read-go-tree RGT 1–3 + 1 row = 4; build-acceptances BA 9 + 1 row = 2; plan-command PC 14 + 1 row = 2;
**13 tests**) → eslint's verdict → full `vitest run` → own git → frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs tests <file> <min> <max> lits0.json` → `vitest run
<targets>` → eslint's verdict → full run → own git → frozen → untracked.

| file | new | min | max | lits |
|---|---|---|---|---|
| `tests/planner/hideLater.examples.test.ts` | yes | 4 | 10 | `Hide Later example 1` … `4`, `planner/hide.plan.json`, `planner/hide.tree.json`, `cmd/tool/main.go`, `summary/legacy_test.go` |
| `tests/cli/goTree.examples.test.ts` | yes | 3 | 9 | `Read Go Tree example 1` … `3`, `cli/goTree.json`, `cli/goP7b.tree.json`, `y/deep`, `brk/calc` |
| `tests/builder/buildAcceptances.p21.examples.test.ts` | yes | 1 | 7 | `Build Acceptances example 9`, `calc/b_test.go`, `calc/old_test.go`, `zz` |
| `tests/cli/planCommand.p21.examples.test.ts` | yes | 1 | 7 | `Plan Command example 14`, `go-p7b/`, `mcp/session.go`, `daemon-core-judge`, `supervisor/guard.go` |

min = the record's new examples; max = min + 6 (new files).

**Output budget** (`max_tokens`, before the session's ×3 for `ds`):

| card | returns | `max_tokens` |
|---|---|---|
| hide-later, read-go-tree | ≈ 1.6–2 KB new each | 8 000 |
| build-acceptances | types.ts + buildAcceptances.ts ≈ 7 KB, two whole files | 14 000 |
| plan-command | planCommand.ts ≈ 5 KB whole | 12 000 |
| read-go-tree-judge, build-acceptances-judge | ≈ 4–6 KB new file each | 16 000 |
| hide-later-judge (the most examples), plan-command-judge | ≈ 6–8 KB new file, long literals | 20 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- **Layers** (guard, unchanged): hideLater.ts in planner imports `node:path` and `./types.js` only — no file read, no
  clock, no environment; goTree.ts in cli imports `node:fs`, `node:path` and the type from `../planner/hideLater.js`;
  buildAcceptances.ts imports what it imports today; planCommand.ts adds `../planner/hideLater.js` and `./goTree.js`.
- A file a card writes is in no sibling's slice in the same generation: generation 0 [build-acceptances, hide-later];
  1 [build-acceptances-judge, hide-later-judge, read-go-tree] read buildAcceptances.ts, types.ts and hideLater.ts
  (generation 0), not each other's target; 2 [plan-command, read-go-tree-judge] read goTree.ts (generation 1); 3
  [plan-command-judge] reads planCommand.ts.
- Tests write only under `tmpRoot()` and remove it; no JS timer; no network; a judge writes only its target.

## 7. Out of scope

The data of this phase (written by the orchestrator, committed before the run, no card touches it):
1. the gate tool `decks/tools/fullvet.mjs` and `templates/go/decks/tools/fullvet.mjs`;
2. the regulation: MorphV2's `docs/AUTONOMY.md` (step 1: a Go `--only` cut runs fullvet on every stub tree) and
   `templates/common/docs/AUTONOMY.md`, `TASK_TEMPLATE.md` (the same, without phase numbers);
3. the go-p7b fixture, its demo `decks/p21/demo.sh` and the demo's stubs, references and risk files `decks/p21/break/`.

**P21b (next phase, issue #12 item 3.5, REQUIRED by the operator's amendment of 09.10):** `morph deck check` on an
`--only` deck of the go profile builds, per generation, the tree that generation's acceptances would see — earlier
generations' targets and the generation's own targets as stubs (overlay replacements, no tree write), every other file
as on disk, each card's own hiding applied — and runs `go build` and `go vet`; a line naming a file that is not that
generation's own target makes `deck check` exit non-zero with `file:line`. Its acceptance: on go-p7b, the deck cut the
old way (P20's binary) names `supervisor/guard.go:20`, the P21a cut exits 0. Open there: where the stubs come from (the
gate's stub files as a `decks/<phase>/stubs/` tree is the candidate), the go spawn outside src/acceptance (a guard layer
change), cli's compaction (29.9 KB). P21a's `decks/tools/fullvet.mjs` is the hand-run stand-in until then.

Also out: direction B (a joint acceptance of a generation group; r4 is named at the gate instead); TypeScript hiding;
re-cutting MorphStudio's P7b (the PM re-checks it in a scratch copy); `morph run --only`.

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component planner-subset --component builder \
  --component cli --judge --checks decks/p21/checks.json \
  --only hide-later,read-go-tree,build-acceptances,plan-command,hide-later-judge,read-go-tree-judge,build-acceptances-judge,plan-command-judge \
  --out decks/p21/deck.json
python3 decks/tools/scale_tokens.py decks/p21/deck.json 3         # processor ds
node dist/cli.js deck check --root . --deck decks/p21/deck.json                                  # errors 0
rm -rf /tmp/v2bin-p21 && mkdir -p /tmp/v2bin-p21 && cp -r dist /tmp/v2bin-p21/ && ln -s $PWD/node_modules /tmp/v2bin-p21/node_modules \
  && ln -s $PWD/templates /tmp/v2bin-p21/templates
node /tmp/v2bin-p21/dist/cli.js run --root . --deck decks/p21/deck.json --processor ds --deadline 2400
```

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 8 (4 code, 4 judges) / 4: [build-acceptances, hide-later] [build-acceptances-judge, hide-later-judge, read-go-tree] [plan-command, read-go-tree-judge] [plan-command-judge] |
| executor bill | ≈ $0.06–0.12 on ds ×3 (P20: 6 cards $0.0629); ≤ $0.30 with a re-cut; cap $5 |
| cards with regeneration | 0–2 of 8 (hide-later: the fixed point or the test files kept hidden; read-go-tree: the block regex or the sort; plan-command-judge: an overlay line) |
| tests after the run | 802 ± 6 in 132 files |
| first red | hide-later: siblings left out (`>` for `>=`), the test files of a kept package unhidden, or no fixed point (example 2's cascade); read-go-tree: a commented or out-of-module import kept, `y/deep/d.go` sorted after `y/y.go`; build-acceptances: hide appended to checks.fullExclude in place, or duplicates kept; plan-command: hide passed for typescript or without --only |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no answer cut at its `max_tokens`; (3) after the run no
file outside §2.3's nine changed; (4) every cut without `--only` byte for byte (Plan Command 9 green, the go-mini and P15
re-cuts identical); (5) this repository's HEAD and refs unchanged by every card; (6) after the merge `decks/p21/demo.sh` on
the run's binary gives 0 / 8 stubcheck, 0 / 8 fullvet and 0 / 8 references red on go-p7b.

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the MEASURE row with
its `прогоны` cell, the vitest log of every verify run; DECISIONS lines "P21 breaking"; after the merge the byte-identity
re-cuts (go-mini and P15 against main's binary f6cf44d), `decks/p21/demo.sh` with the merged binary (none, r1, r3, r4)
and a live smoke on ds of the go-p7b re-cut (issue #12's acceptance); then 🧪 and the stop for the operator
(`~/.morph-wait-operator`, never `~/.morph-phase-done`); P21b is prepared after the operator's word.

## 11. Actual

### Gate (preparation)

09.10, on the VPS, by the preparing orchestrator (Opus 5.5, fresh context, no sub-agents); no paid run, no model call.
Data commit 151df02 (spec, record, map, go-p7b, probes, checks, deck, fullvet, regulation, DECISIONS) and gate commit
e11edeb (two probe rows, the re-cut deck, PLAN row P21b); this section and the gate DECISIONS lines in the last commit.
Mid-preparation the operator's amendment of #12 (comment 6075790078, MorphStudio eb52a5a) made item 3.5 required and
asked for a P7b-shaped fixture: the first fixture (go-break, calc/report/summary) was replaced by go-p7b before any
commit, and the phase split (P21a here, P21b = `deck check`, §7).

The deck **cut by V2** (main's binary, f6cf44d): `plan --component planner-subset --component builder --component cli
--judge --checks decks/p21/checks.json --only <the 8 ids>` **exit 0**, 8 cards; `scale_tokens.py … 3` (maxTokens:
hide-later 24 000, read-go-tree 24 000, build-acceptances 42 000, plan-command 36 000, read-go-tree-judge and
build-acceptances-judge 48 000, hide-later-judge and plan-command-judge 60 000); `deck check` **0 errors, 0 warnings, 0
hazards**; generations `[build-acceptances, hide-later] [build-acceptances-judge, hide-later-judge, read-go-tree]
[plan-command, read-go-tree-judge] [plan-command-judge]`. Slices (slice + existing targets): 36.7–57.4 KB, the largest
build-acceptances-judge **57 408 B**. The same cut by this phase's reference binary is byte-identical (TypeScript).

Scratch worktree `/tmp/p21-gate` from e11edeb (removed afterwards; no watcher or worker left), the deck's own
acceptances run as Morph runs them (`/bin/sh -c`, 300 s cap), cards in deck order, each accepted reference committed
before the next:
- **Stubs, red per example at the probe (13/13)**, typed throwing stubs: `Error: stub hideLater [["s","f","r","sj","fj",
  "m","mj"],9]` … `[["s"],9]`, `stub readGoTree true`, `stub buildAcceptances ["p9",["a","b","zz"]]`, `stub planCommand
  [true,["control","supervisor","daemon"],[…8 ids]]`: hide-later 5/5, read-go-tree 4/4, build-acceptances 2/2,
  plan-command 2/2. **stubcheck.mjs exit 0 on all 8 stub logs** (code cards red at `probe`, judges at `guard … missing`).
  fullvet does not apply (a TypeScript deck); it ran on go-p7b (§1).
- **References green, chain seconds** (limit 250): build-acceptances 128.8, hide-later 131.8, build-acceptances-judge
  132.0, hide-later-judge 134.3, read-go-tree 134.9, plan-command 139.6, read-go-tree-judge 132.3, plan-command-judge
  134.9 — **max 139.6 s**. Final tree `vitest run` **806 / 806 in 132 files** (793 + the reference judges' 13); ripple 0
  of 793; `git status` clean.
- **Mutants** (the changed contracts only), each under a 120 s subprocess timeout against its probe: **30 mutants** (13
  hideLater.ts, 10 goTree.ts, 4 buildAcceptances.ts, 3 planCommand.ts), 32 runs, **3.7 min**, max 120.1 s (one timeout:
  the fixed point without "at least one non-test file" loops forever — counted killed); **30 killed**, two of them only
  after a probe row each (goTree without `files.sort()`: Node's readdir is sorted, so only `b.go` beside `b/` tells the
  walk order from the sort; buildAcceptances keeping a duplicate in ctx.siblings: equal for Go, whose overlay is an
  object, killed by a TypeScript row).
- **Byte identity** (main's binary f6cf44d vs this phase's reference binary, same trees): go-mini cut with `--checks
  decks/m1/checks.json` (goguard/gofirstdiff installed) **identical** (6 cards, 75 416 B); the P15 deck re-cut from its
  own tree 0365336 (plan, filter, ×3) **identical** (12 cards, 398 622 B) and identical to the deck committed there; a
  one-generation `--only` cut of go-mini (percent-of-judge, format-share — P20's Plan Command 13) **identical**; go-p7b
  cut without `--only` **identical**.
- **Issue #12 on go-p7b** (`decks/p21/demo.sh <bin> <variant>`, §1's table): main's binary stubcheck 4/8, fullvet 5/8,
  references 6/8 red (phase-loop at `== build` `supervisor/guard.go:20:23: l.Resumes undefined`); the reference binary
  0/8, 0/8, 0/8; variants r1 (1 card red at its own `== build`), r3 and r4 (named by fullvet at phase-loop's stub).

**Forecast** on `ds` with every maxTokens × 3: P20 ran 6 cards for $0.0629 (9 requests); here 12 first requests (4 code
× 2 variants + 4 judges), 37–57 KB in, answers 1–8 KB: **≈ $0.07–0.15**, ≤ $0.35 with a re-cut; ≤ $1. **Gate holds.**

**Run command** (from the repo root, the binary copied first; the deck is already scaled ×3):

```
npm run build && rm -rf /tmp/v2bin-p21 && mkdir -p /tmp/v2bin-p21 && cp -r dist /tmp/v2bin-p21/ && ln -s $PWD/node_modules /tmp/v2bin-p21/node_modules && ln -s $PWD/templates /tmp/v2bin-p21/templates
node /tmp/v2bin-p21/dist/cli.js run --root . --deck decks/p21/deck.json --processor ds --deadline 2400 > /tmp/p21-run.json
```
