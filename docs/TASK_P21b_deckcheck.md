# TASK_P21b — the breaking re-cut, part b: `morph deck check` compiles every card's stub tree with its language's own step and names `file:line` outside its targets (`src/language/treeProfiles.ts`, `src/planner/stubTrees.ts`, `src/acceptance/treeCheck.ts`, `src/cli/checkBuilds.ts`, `src/cli/{deckCheck,types,main}.ts`)

> Phase P21b of `docs/PLAN.md` (issue VasyaLutiy/morph#12, label `P21-breaking-recut`), operator 09.10: scope comment
> 6077412737, MorphStudio's amended request 4efde92 §6, and the operator's generality amendment, comment 6077766447
> ("general, not fitted to P7b": per language profile, no P7b names in src/, a second fixture of another shape).
> **Split** (§2.2 "Split", DECISIONS "P21b"): item 1 (requirement 3.5) is this phase, **10 cards, 4 generations**;
> item 2 (the language-agnostic subset transaction in the run loop, with the forced judge retry of 4efde92 §6 and the
> fixtures green under it / red with blame without it) is **P21c** (§7). Code cards in Components **language** (Tree
> Profiles — NEW), **planner-subset** (Stub Trees, Check Builds — NEW), **acceptance** (Tree Check — NEW) and **cli**
> (Deck Check, Main's one argument). One gate (≤ $1, slices ≤ 200 KB, chains < 250 s, §11).

## 1. Why this

- **The gate cannot see a record break of a re-cut by itself.** MorphStudio P7b (09.10, MorphV2 179c795, 12 cards, $0):
  every red was `== build`/`== vet`/`== full` on ANOTHER card's or an outside file (`supervisor/guard.go:20:22:
  l.Resumes undefined`); the stub checks were per card and never compiled the tree the way the run does. P21a added
  `decks/tools/fullvet.mjs`, a Go-only hand step; the amendment (eb52a5a, comment 6075790078) requires the check **in
  the tool** (the PM's pre-flight runs `deck check`), and comment 6077766447 requires it **per language profile**: Go
  `go build` + `go vet`, TypeScript `tsc --noEmit`, a language without such a step said so plainly.
- **Measured** (reference code in a scratch worktree, never committed):

| deck (fixture) | language | code | breaks | first card's break |
|---|---|---|---|---|
| go-p7b `decks/b1/deck.p20.json` (cut by f6cf44d, before Hide Later) | go | **2** | 9 over 5 of 8 cards | phase-loop `supervisor/guard.go:20:23: l.Resumes undefined (type *Loop has no field or method Resumes)` |
| go-p7b `decks/b1/deck.p21.json` (cut by main, P21a) | go | **0** | 0 | — |
| ts-rename `decks/r1/deck.json` (a TypeScript rename across modules over 3 generations, cut by main) | typescript | **2** | 5 over 3 of 4 cards | to-metres `src/report/line.ts(1,17): error TS2724: … no exported member named 'toMeters'. Did you mean 'toMetres'?` |
| stub.cards.json (go, typescript, python cards; scripted `go` and `tsc`) | mixed | 2 | 8 + 9 missing | 3 notes: python "no compile or typecheck step", two Go cards whose acceptance writes no `$P/full.json` |

  go-p7b 16 trees in 5.0 s, ts-rename 4 trees in 7.8 s (a copy of the tree per card, warm caches). The TypeScript deck
  is red because TypeScript has no Hide Later: P21c's transaction is its fix; deck check names it before any spend.
- **A first-attempt model.** Each card's tree = a copy of the repository with the stubs of every EARLIER generation's
  and its own targets in place (only targets of its language), its own config file (`$P/full.json` for Go, `$P/
  tsconfig.card.json` for TypeScript — what its compile stage hides or excludes) and its acceptance's `export` lines,
  then its language's step. Stubbing the generation's siblings too would flag the P21a deck (control-contract-judge at
  `guard.go:20:23` beside phase-loop's new `loop.go`): that is the retry-after-sibling tree of the P21a smoke RED, which
  P21c's transaction replaces.
- **Size.** 5 code cards + 5 judges = **10 cards**, 4 generations, code-only targets (probes, no smoke test). Reference:
  treeProfiles.ts 0.8 KB, stubTrees.ts 2.8 KB, treeCheck.ts 2.6 KB, checkBuilds.ts 2.4 KB new; deckCheck.ts 1.0 → 1.4 KB,
  types.ts +2 lines, main.ts 1 argument.
- **Ripple, measured** (reference code + this phase's data, full suite): **0 of 812** red; no existing test reads the new
  fixtures; Deck Check 1–3 and Main 2 unchanged (no `_stubs/` beside their decks → no `builds` key); the language
  profiles and their fixtures untouched (the tree data is a table of its own).
- **Record sizes** (bytes of each Component block): language 19 178 → **21 336**; planner-subset 11 694 → **22 456**;
  acceptance 15 197 → **19 605**; cli 29 857 → **29 921** (≤ 30 KB rule: Parse Command's "done {…}" shapes left to
  the Command schema, Plan Command's phase asides and the Component's command list (Main holds it) dropped; no rule
  removed).

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main** (module → what the new code calls or constructs): `src/cards/types.ts` — `Card` (`customId`,
  `targets`, `acceptance: string | null` …), `Deck` (`{cards}`); `src/cards/layer.ts` — `layerGenerations(deck)`;
  `src/language/profiles.ts` — `PROFILES` (typescript, python, go; `id`, `extensions`); `src/cli/document.ts` —
  `readDeckFile(root, deckPath)` → `{ok: true, deck} | {ok: false, result}`; `src/cli/types.ts` — `CommandResult`,
  `DeckCheckDocument`, `CliIo`; `src/cli/main.ts` — routes `deck check` to `deckCheckCommand(root, command.deck,
  command.sliceCapBytes)`. A built acceptance (`src/builder/`): a Go one writes `cat > $P/full.json <<'MORPH_CONF_EOF'`
  (`{"Replace":{…}}`, the `== full` overlay) and holds `export GOFLAGS=…` and ` export NO_COLOR=1 CI=1` lines; a
  TypeScript one writes `cat > $P/tsconfig.card.json <<'MORPH_TSCONF_EOF'` (extends `../../tsconfig.json`, includes
  `../../src`, `../../tests`, `./*.probe.ts`, excludes the generation's siblings) and runs `node_modules/.bin/tsc
  --noEmit -p $P/tsconfig.card.json`; it also writes `export default defineConfig({` inside a heredoc (not an env line).
- **Preconditions of the callees.** go · `-overlay` resolves relative paths against the working directory, an empty
  replacement deletes the file; a type error is printed twice (`<file>:…` by build, `vet: <file>:…` by vet; build and
  vet columns can differ: `daemon/daemon.go:9:78` and `:9:81`) — measured. go · a directory starting with "_" is skipped
  by `./...`; tsconfig's include lists name `src` and `tests` only — so `<deck dir>/_stubs/` is compiled by neither.
  go · with neither GOPATH nor HOME set, `-overlay` fails ("Files beneath GOMODCACHE () must not be replaced"): the
  examples use the builder's whole GOFLAGS line. sh · `/bin/sh` with no PATH still finds `/usr/local/bin/go`, so only a
  `go` script first on env's PATH proves env reaches the child (Check Builds 3, Deck Check 6). sh · a killed shell's
  child keeps a stdout pipe open until it ends, so the step writes to a file, not a pipe (timeout 700 ms returned at
  708 ms, measured; with a pipe at 3 s).
- **Fixtures** (`tests/fixtures/`), each by the type the Function takes:

| file | type | what it is | what the Function returns on it |
|---|---|---|---|
| `planner/stub.cards.json` (NEW) | ONE array of 9 `Card` (also a deck file) | Go a, b, c, j (full.json + GOFLAGS), n (acceptance null), v (GOFLAGS, no full.json); TypeScript t, u (tsconfig.card.json); Python p (pytest only) — targets in the planner-subset description | Stub Trees 1–3; Check Builds 3; Deck Check 6 |
| `planner/stub.trees.json` (NEW) | ONE object "1", "2", "3" → `StubTree[]` | Stub Trees 1 (9 trees), 2 (a, j), 3 (a, t, u) | Stub Trees 1–3 |
| `acceptance/treeOutput.json` (NEW) | ONE object "go", "typescript" → text | a go build+vet output (14 lines: `#` lines, a build line and its `vet:` twin, tab continuations, an own file with `./`, a column-less own line, a package line, a `go:` line) and a tsc output (7 lines: an own file, a duplicate, an indented continuation, a line with no file) | Tree Check 1: 4, 3, 7 breaks |
| `acceptance/tree/` (NEW) | files of a tmp root | `go.mod` (module example.com/vq), `b/b.go` (func Old), `a/a.go` (calls b.Old, line 6), `_stubs/b/b.go` (func New) | Tree Check 2, 3 |
| `go-p7b/decks/b1/deck.p20.json`, `deck.p21.json`, `_stubs/` (NEW) | deck files (8 cards each); 8 stub files | the old cut (f6cf44d, 100 388 B) and the P21a cut (main, 102 206 B); the gate's stubs (= `decks/p21/break/stub/`, each stub test renamed `TestStub<File>`: two `TestStub` in one package redeclare, measured) | Check Builds 1, Deck Check 4 |
| `ts-rename.json` (NEW) | ONE object path → text (19 files) | a TypeScript project of `morph init`: contour.yaml (units: To Metres; report: Length Line), morph-map.json, package.json, tsconfig.json, tests/helpers.ts, tests/setup.ts, the OLD src/units/convert.ts (toMeters), src/report/line.ts, src/shelf/label.ts (no target; uses METRE), two old example tests, decks/r1/checks.json, two probes, decks/r1/deck.json (cut by main, `--only` its 4 cards), decks/r1/_stubs/ (4 stubs) | Check Builds 2, Deck Check 5 |
| `cli/checkBuilds.json` (NEW) | ONE object "p20", "p21", "p21 without the guard.go stub", "ts-rename", "cards" → `BuildCheck[]` | Check Builds 1–3 measured | Check Builds 1–3; Deck Check 4–6 |
| `cli/oneCard.deck.json` (NEW) | ONE deck file: a top-level JSON ARRAY holding one `Card` with every field of `src/cards/types.ts` (customId q, intent, targets [pkg/q.go], contextSlice, instruction, acceptance writing `$P/full.json` and a GOFLAGS line, model, maxTokens, reasoning, variants, dependsOn) | the base of every OWN test that writes a deck file: readDeckFile accepts it | — (own tests of Check Builds and Deck Check) |
| `cli/examples.json` (keys "Deck Check 4", "5", "6" added) | ONE object | given/then of Deck Check 4–6 | — |

- **Harness skeletons** (only `tests/helpers.ts`, node:fs, node:path and the modules named):

```ts
// Stub Trees
const cards = (): Card[] => fixtureJson("planner/stub.cards.json") as Card[];
const trees = (k: string): StubTree[] => (fixtureJson("planner/stub.trees.json") as Record<string, StubTree[]>)[k];
const L: TreeLanguage[] = [{ id: "typescript", extensions: [".ts", ".tsx"], config: "tsconfig.card.json" },
  { id: "python", extensions: [".py", ".pyi"], config: null }, { id: "go", extensions: [".go"], config: "full.json" }];
// Tree Check, Check Builds, Deck Check: tmp roots
function copyOf(name: string): TmpRoot { const r = tmpRoot(); fs.cpSync(fixturePath(name), r.root, { recursive: true }); return r; }
function rootOf(name: string): TmpRoot { const r = tmpRoot(); for (const [p, t] of Object.entries(fixtureJson(name) as Record<string, string>)) r.write(p, t);
  fs.symlinkSync(path.resolve(fixturePath("."), "../../node_modules"), r.path("node_modules")); return r; }
const G = 'export GOFLAGS=-mod=mod GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOWORK=off GOCACHE="${GOCACHE:-/tmp/morph/go-build}" GOPATH="${GOPATH:-/tmp/morph/go}"';
const GO_LINE = "^(?:vet: )?(?:\\./)?(\\S+?\\.go)(:\\d+.*)$", TS_LINE = "^(\\S+?\\.tsx?)(\\(\\d+,\\d+\\).*)$";
const GO_CMD = "go build -overlay {config} ./... ; go vet -overlay {config} ./...";
const pathEnv = (): Record<string, string> => ({ PATH: process.env.PATH ?? "" });
function scriptsRoot(): { r: TmpRoot; env: Record<string, string> } {      // Check Builds 3, Deck Check 6
  const r = tmpRoot(); r.write("d.json", fixture("planner/stub.cards.json"));
  for (const f of ["calc/a.go", "report/c.go", "src/t.ts", "tests/t.test.ts"]) r.write("_stubs/" + f, "x\n");
  r.write("bin/go", '#!/bin/sh\necho "vet: ./calc/zz.go:1:2: go ran with $GOFLAGS"\nexit 1\n');
  r.write("node_modules/.bin/tsc", '#!/bin/sh\necho "src/t.ts(1,1): error TS1: own"\necho "src/zz.ts(2,3): error TS2: tsc ran with $NO_COLOR $3"\nexit 2\n');
  fs.chmodSync(r.path("bin/go"), 0o755); fs.chmodSync(r.path("node_modules/.bin/tsc"), 0o755);
  return { r, env: { PATH: r.path("bin") + ":" + (process.env.PATH ?? "") } };
}
function load(r: TmpRoot, deckPath: string): { deck: Deck; generations: string[][] } {
  const l = readDeckFile(r.root, deckPath); if (!l.ok) throw new Error(deckPath); return { deck: l.deck, generations: layerGenerations(l.deck) }; }
// A deck file is a top-level JSON ARRAY of Cards, each with EVERY field of src/cards/types.ts Card (customId, intent, targets,
// contextSlice, instruction, acceptance, model, maxTokens, reasoning, variants, dependsOn) — never an object with "cards", never a card
// missing a field (readDeckFile refuses it). An own test that needs its own deck starts from cli/oneCard.deck.json:
function writeDeck(r: TmpRoot, rel: string, cards: Partial<Card>[]): void {
  const base = (fixtureJson("cli/oneCard.deck.json") as Card[])[0]; r.write(rel, JSON.stringify(cards.map((c) => ({ ...base, ...c })))); }
const builds = (k: string): BuildCheck[] => (fixtureJson("cli/checkBuilds.json") as Record<string, BuildCheck[]>)[k];
// Deck Check 5: Deck Check 2's document; Deck Check 6: io collecting
const DC2 = { deck: "d.json", cards: 1, generations: [["a"]], errors: 0, warnings: 1, hazards: [{ kind: "implicit-read", severity: "warning",
  cards: ["a"], path: null, repair: null }], weights: [{ card: "a", bytes: 20, missing: [] }] };
const out: string[] = [], err: string[] = []; const io: CliIo = { stdout: (t) => { out.push(t); }, stderr: (t) => { err.push(t); } };
// every test that runs a child process: test(name, fn, 120000); every root: try { … } finally { r.rm(); }
```

**Distinct markers.** Card ids a, n, t, p, b, c, v, u, j, zz, k1, k2, k3; stub dirs "decks/q9/_stubs", "/abs/st", "st",
"decks/b1/_stubs", "decks/r1/_stubs", "_stubs"; the module example.com/vq; script lines "go ran with $GOFLAGS", "tsc ran
with $NO_COLOR $3"; env names Q9, GOFLAGS; timeouts 60000 and 700 (Tree Check) against the fixed 120000 (Check
Builds). No name of P7b or go-p7b, no card id of a fixture, is in any `src/` file: only "_stubs", 120000 and the three
Tree Profiles are fixed by the record.

### 2.2. OUTPUT data shapes

**`src/language/treeProfiles.ts`** (NEW; layer language; pure data, no import) — **Tree Profiles**:

```ts
export interface TreeProfile { id: string; fileLine: string; config: string | null; command: string | null }
export const TREE_PROFILES: readonly TreeProfile[] = [
  { id: "typescript", fileLine: "^(\\S+?\\.tsx?)(\\(\\d+,\\d+\\).*)$", config: "tsconfig.card.json", command: "node_modules/.bin/tsc --noEmit -p {config}" },
  { id: "python", fileLine: "^(\\S+?\\.pyi?)(:\\d+.*)$", config: null, command: null },
  { id: "go", fileLine: "^(?:vet: )?(?:\\./)?(\\S+?\\.go)(:\\d+.*)$", config: "full.json", command: "go build -overlay {config} ./... ; go vet -overlay {config} ./..." },
];
export function treeProfileFor(id: string): TreeProfile | null;   // the entry with that id, else null
```

| example | given | result |
|---|---|---|
| Tree Profiles 1 | treeProfileFor of "typescript", "python", "go", "rust" | the three entries above (ids in PROFILES order); null |
| Tree Profiles 2 | each fileLine on "src/a/b.ts(12,5): error TS2304: x", "vet: ./pkg/q.go:3:7: y", "pkg/q.go:3: z", "tests/test_a.py:9: AssertionError", "  src/a.ts(1,1): continuation" | typescript ["src/a/b.ts", "(12,5): error TS2304: x"] on the first only; go ["pkg/q.go", ":3:7: y"], ["pkg/q.go", ":3: z"]; python ["tests/test_a.py", ":9: AssertionError"]; none matches the indented line |

**`src/planner/stubTrees.ts`** (NEW; layer planner; pure, node:path only) — **Stub Trees**:

```ts
import path from "node:path";
import type { Card } from "../cards/types.js";
export interface TreeLanguage { id: string; extensions: string[]; config: string | null }
export interface StubTree { card: string; generation: number; language: string | null; exports: string[];
  config: { name: string; text: string } | null; stubs: Record<string, string>; own: string[]; missing: string[] }
export function stubTrees(cards: Card[], generations: string[][], stubDir: string, stubs: string[], languages: TreeLanguage[]): StubTree[];
```

- For every g and every id of `generations[g]`, in order, the card with that customId (none → skipped); acceptance = its
  text, "" when null.
- config: the first language (in order) with a config whose heredoc the acceptance writes — a line exactly ``cat >
  $P/<config> <<'<TAG>'``, then the lines up to the next line exactly `<TAG>` → `{name: config, text: those lines
  "\n"-joined}`; that language is the card's. None → config null, language = the first whose extensions hold
  `path.posix.extname(targets[0])`, else null.
- exports: the acceptance's lines that, trimmed, match `/^export [A-Za-z_][A-Za-z0-9_]*=/`, trimmed, in order.
- With a config: for every card of `generations[0..g-1]` (flattened, unknown ids skipped) and then the card itself,
  every target whose extension the language holds, not yet in stubs: in `stubs` → `path.posix.join(stubDir, target)`,
  else into missing once. Without a config: `stubs {}`, `missing []`.
- → `{card, generation: g, language, exports, config, stubs, own: a copy of the targets, missing}`.

| example | given | result |
|---|---|---|
| Stub Trees 1 | stub.cards.json, generations [[a, n, t, p], [b, c, v, u], [j]], "decks/q9/_stubs", stubs [calc/a.go, calc/a_examples_test.go, calc/b.go, extra/z.go, report/c.go, src/t.ts, tests/t.test.ts], L | stub.trees.json["1"]: 9 trees; a go full.json, exports [`export NO_COLOR=1 CI=1`, `export GOFLAGS=-mod=mod GOPROXY=off`]; n go config null; t typescript; p python config null; b missing [calc/n.go, calc/b_test.go]; v go config null; u missing [tests/u.test.ts]; j 4 stubs, missing [calc/n.go, calc/b_test.go, calc/v.go] |
| Stub Trees 2 | generations [[a], [zz, j]], "/abs/st", stubs [calc/a_examples_test.go], L | stub.trees.json["2"]: a missing [calc/a.go]; j stubs {calc/a_examples_test.go: "/abs/st/calc/a_examples_test.go"}, missing [calc/a.go] |
| Stub Trees 3 | generations [[a, t, u]], "st", stubs [calc/a.go, src/t.ts, tests/t.test.ts, tests/u.test.ts], [the go entry of L] | stub.trees.json["3"]: a go {calc/a.go: "st/calc/a.go"}; t and u language null, config null, stubs {} |

**`src/acceptance/treeCheck.ts`** (NEW; layer acceptance — the layer that may spawn; env a parameter) — **Tree Check**:

```ts
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
export interface TreeRun { exit: number | null; timedOut: boolean; output: string }
export interface TreeInput { card: string; exports: string[]; config: { name: string; text: string }; stubs: Record<string, string>; command: string }
export function findBreaks(output: string, fileLine: string, own: string[]): string[];
export function treeCheck(root: string, input: TreeInput, env: Record<string, string>, timeoutMs: number): TreeRun;
```

- treeCheck: D = `fs.mkdtempSync(path.join(os.tmpdir(), "morph-tree-"))`, T = D/t; every entry of root copied to T
  (`fs.cpSync(…, {recursive: true, verbatimSymlinks: true})`) but `.git`, `.morph`, `probe`, `node_modules`; root's
  `node_modules` → a symbolic link at T/node_modules to its real path; each stubs entry: root/stub copied over T/target
  (parents created); `config.text + "\n"` written to T/probe/<card>/<config.name>; then `spawnSync("/bin/sh", ["-c",
  [...exports, "P='<T>/probe/<card>'", "{ " + command (every "{config}" → `"$P/<config.name>"`) + "\n} > '<D>/output.txt'
  2>&1"].join("\n")], {cwd: T, env, stdio: "ignore", timeout: timeoutMs})`; D removed in `finally`. → `{exit: null when
  timed out (error code ETIMEDOUT) else the status, timedOut, output: the output file's text ("" if none) with every
  "<T>/" removed}`.
- findBreaks (pure): `new RegExp(fileLine)`; per line — blank, "#…" and lines starting with white space skipped; trimmed;
  a match → skipped when group 1 is in own, else group 1 + group 2; no match → the line kept whole; a Set, `sort()`.

| example | given | result |
|---|---|---|
| Tree Check 1 | treeOutput.json: go with GO_LINE, own [supervisor/loop.go]; typescript with TS_LINE, own [src/units/convert.ts]; go with TS_LINE, own [] | 4 breaks (daemon.go:9:81, the go: line, mcp/session.go:6:2, guard.go:20:23 once); 3 (the TS5083 line, line.ts(1,17), line.examples.test.ts(5,44) once); 7 lines whole |
| Tree Check 2 | acceptance/tree copied; card k1, exports [G], GO_CMD, env {PATH}, 60000: full.json `{"Replace":{}}` + stubs {b/b.go: _stubs/b/b.go}; `{"Replace":{"a/a.go":""}}` + the stub; `{"Replace":{}}`, no stub | {1, false, "# example.com/vq/a\na/a.go:6:25: undefined: b.Old\n# example.com/vq/a\nvet: a/a.go:6:25: undefined: b.Old\n"}; {0, false, ""}; {0, false, ""}; the root unchanged |
| Tree Check 3 | + .git/HEAD, node_modules/q/, probe/old/; card k2, exports ["export Q9=-mod=vendor"], config c.json, the stub, a command printing $Q9, the config, the stub's line 3, `ls -a`, an absolute path line, `readlink node_modules`; then k3 `echo started; sleep 3; echo late`, 700 | {0, false, "a.go:1:1: -mod=vendor {\"q\": 9} // New is the API after the change.\n.\n..\n_stubs\na\nb\ngo.mod\nnode_modules\nprobe\nx.go:2:2: abs\nlinked\n"}; {null, true, "started\n"} under 3000 ms |

**`src/cli/checkBuilds.ts`** (NEW; layer cli; node:fs, node:path) — **Check Builds**:

```ts
import type { Deck } from "../cards/types.js";
export interface BuildCheck { card: string; generation: number; language: string | null; stubbed: number; missing: string[]; breaks: string[]; note: string | null }
export function checkBuilds(root: string, deckPath: string, deck: Deck, generations: string[][], env: Record<string, string>): BuildCheck[] | null;
```

- stubDir = `path.posix.join(path.posix.dirname(deckPath), "_stubs")`; `path.resolve(root, stubDir)` not a directory →
  null. stubs = every regular file under it (readdirSync withFileTypes, links not followed), relative, "/"-joined,
  `sort()`. languages = PROFILES mapped to `{id, extensions, config: treeProfileFor(id)?.config ?? null}`.
- Per tree of Stub Trees: base `{card, generation, language, stubbed: Object.keys(stubs).length, missing}`; then, in
  order: language null → `breaks [], note "no language profile claims <own[0] ?? "no target">: not built"`; its profile's
  command or config null → `note "<id> has no compile or typecheck step: not built"`; the tree's config null → `note
  "the acceptance writes no $P/<profile config>: not built"`; else `note null`, breaks = findBreaks(treeCheck(root,
  {card, exports, config, stubs, command}, env, 120000).output, fileLine, own) + `"the compile step timed out after
  120000 ms"` when timed out.

| example | given | result |
|---|---|---|
| Check Builds 1 | go-p7b copied, env {PATH}: deck.p20.json; deck.p21.json; deck.p21.json without `_stubs/supervisor/guard.go` | checkBuilds.json["p20"] (9 breaks over 5 cards, phase-loop `supervisor/guard.go:20:23 …`); ["p21"] (none); ["p21 without the guard.go stub"] (runtime-guard missing, no break; 3 later cards missing + guard.go:20:23) |
| Check Builds 2 | ts-rename.json root, decks/r1/deck.json, env {PATH} | ["ts-rename"]: to-metres 2 breaks (line.ts(1,17), the old judge test (2,10)), length-line 2, to-metres-judge 1, length-line-judge 0 |
| Check Builds 3 | scriptsRoot(), d.json | ["cards"]: 3 notes (n, p, v), 8 breaks, 9 missing; t's own `src/t.ts(1,1)` dropped, u's kept; `go ran with -mod=mod`/`-mod=vendor` by card; `tsc ran with 1 probe/t/tsconfig.card.json` |

**`src/cli/deckCheck.ts`, `src/cli/types.ts`, `src/cli/main.ts`** (PATCH) — **Deck Check**, **Main**:
`deckCheckCommand(root, deckPath, sliceCapBytes, env: Record<string, string> = {})`; after today's document: builds =
checkBuilds(root, deckPath, deck, generations (the same Layer Generations), env); not null → `builds` is the
document's last key, errors += every missing and every break, warnings += every note; code 2 when errors > 0.
`DeckCheckDocument` gains `builds?: BuildCheck[]` (`import type { BuildCheck } from "./checkBuilds.js"`). Main passes
`deps.env` as the 4th argument. Nothing else changes.

| example | given | result |
|---|---|---|
| Deck Check 4 | go-p7b copied, env {PATH}; deck.p20.json; then deck.p21.json | code 2, errors 9, warnings 0, builds = checkBuilds.json["p20"], last key; then code 0, errors 0, builds = ["p21"] |
| Deck Check 5 | ts-rename root, decks/r1/deck.json, {PATH}; then Deck Check 2's tree + `_stubs/src/a.ts` | code 2, errors 5, builds = ["ts-rename"]; then code 0, DC2 + `builds: [{card "a", generation 0, language "typescript", stubbed 0, missing [], breaks [], note "the acceptance writes no $P/tsconfig.card.json: not built"}]`, warnings 2 |
| Deck Check 6 | main on scriptsRoot(), argv [deck, check, --deck, d.json, --root, root], deps {env, now () => 0, cwd "/", transport null} | 2; errors 17, warnings 12 (9 hazards + 3 notes), builds = ["cards"]; stderr ["morph deck check: exit 2\n"] |

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P21b deckcheck"; #12 = issue VasyaLutiy/morph#12):

- **Split** · P21b = item 1, general per language (10 cards); P21c = item 2, the transaction (language-agnostic, in the
  run loop: groups, deferred acceptance, blame by `file:line` → owner through each profile's fileLine, fixed point),
  with the forced judge retry (4efde92 §6) and both fixtures green under it / red with blame without it · together over
  the 12-card bound; the operator's comments allow the split and forbid narrowing the generality to fit.
- **Per-language data** · a table of its own (Tree Profiles in src/language/treeProfiles.ts), not new LanguageProfile
  fields · the profiles are pinned whole by their fixtures and tests (Resolve Profile 1, 2, 5): new fields would redden
  3 existing tests at every card's full run; P21c's blame reads the same fileLine.
- **Where the stubs come from** · `<deck's directory>/_stubs/` at their targets' paths; no flag; none → today's document
  byte for byte · the gate writes stubs anyway; "_" keeps the go tool off them, tsconfig includes only src and tests.
- **A copy per card** · the tree is a copy of the repository (`.git`, `.morph`, `probe` left out, node_modules linked) with
  the stubs written in, never the user's tree · one mechanism for every language (Go's `-overlay` is Go's only), no write
  in the working tree; paths in the output are relative (the copy's prefix removed); MorphV2 copies 19 MB per card.
- **Per card, first attempt; siblings not stubbed** · its own config (full.json / tsconfig.card.json) decides what the
  step hides · the tree its first attempt's widest compile stage sees; stubbing siblings flags the P21a deck (the
  retry tree is P21c's); #12's acceptance: 0 on the P21a cut.
- **Which targets are stubbed** · only those of the card's language (by extension) · a stub of another language's file
  is nothing its step reads.
- **Own** · a line naming one of the card's own targets is no break · the stubs are the gate's; stubcheck owns them.
- **Missing stub** · an error · a target without a stub leaves the old file: never an honest tree.
- **No step** · a note per card, counted as a warning, never an error: "<id> has no compile or typecheck step" (python),
  "the acceptance writes no $P/<config>" (a card cut without --checks), "no language profile claims <target>" · the
  operator: said plainly, never skipped silently; a note cannot fail the gate by itself.
- **Exports** · the acceptance's `export NAME=` lines (trimmed), not every line starting "export" · a TypeScript
  acceptance writes `export default defineConfig({` inside a heredoc.
- **Go step** · `go build` then `go vet` (`;`, both always) · the operator names both; build covers non-test packages,
  vet the tests.
- **Output to a file, stdio ignored** · a pipe held by a killed shell's child makes spawnSync wait past its timeout.
- **Timeout** · 120 000 ms per card, a timeout is a break · a hung step never hangs the gate (its orphan may finish later).
- **Breaks deduped, sorted** · build and vet print one error twice; packages finish in any order.
- **cli record** · compacted in place, no new Component · the logic lives in Check Builds; cli grows by two clauses.
- **Main** · a 4th argument deps.env, owned by the deck-check card · one invariant across deckCheck.ts and main.ts.

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/language/treeProfiles.ts` | NEW | probe only | NEW `tests/language/treeProfiles.examples.test.ts` (Tree Profiles 1–2) |
| `src/planner/stubTrees.ts` | NEW | probe only | NEW `tests/planner/stubTrees.examples.test.ts` (Stub Trees 1–3) |
| `src/acceptance/treeCheck.ts` | NEW | probe only | NEW `tests/acceptance/treeCheck.examples.test.ts` (Tree Check 1–3) |
| `src/cli/checkBuilds.ts` | NEW | probe only | NEW `tests/cli/checkBuilds.examples.test.ts` (Check Builds 1–3) |
| `src/cli/deckCheck.ts`, `types.ts`, `main.ts` | PATCH | probe only | NEW `tests/cli/deckCheck.p21b.examples.test.ts` (Deck Check 4–6) |

- Each judge: "<Function> example <n>: <what>", one per example in record order, the skeleton's helpers, expected results
  from the named fixture or written out; at most 6 own tests; every child-process test with timeout 120000.

### 2.4. What must not break

- Byte for byte: every file outside the 7 code targets and the 5 new test files — every other `src/` file,
  `tests/helpers.ts`, every existing test file, `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/`,
  `templates/` (frozen).
- Every cut byte for byte (no planner or builder change): go-mini `--checks decks/m1/checks.json` (75 416 B), the P15
  re-cut from 0365336 (398 622 B), go-p7b without `--only` (100 388 B) — main's binary vs the run's (§11).
- 812 tests in 132 files green at every card; after the run **812 + 2 + 3 × 4 = 826** in 137 files (± the judges' own).

## 3. Acceptance

Built by `morph plan --checks decks/p21b/checks.json`, narrow to broad, every stage printing `== <stage>`. `ownGit:
true`, `frozen` the defaults + `templates`, no `fullExclude` (ripple 0).

Code cards (code-only targets): `probe/<card>/` → `tsc` (per-card tsconfig) → `eslint <targets>` → `guard.mjs src
<targets>` → the probe `decks/p21b/parts/<card>.probe.ts` (tree-profiles TP 1–2 + 1 row = 3; stub-trees ST 1–3 + 2 rows =
5; tree-check TC 1–3 + 2 rows = 5; check-builds CB 1–3 = 3; deck-check DC 4–6 + 1 row = 4; **20 tests**) → eslint's
verdict → full `vitest run` → own git → frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs tests <file> <min> <max> lits0.json` → `vitest
run <targets>` → eslint's verdict → full run → own git → frozen → untracked.

| file | new | min | max | lits |
|---|---|---|---|---|
| `tests/language/treeProfiles.examples.test.ts` | yes | 2 | 8 | `Tree Profiles example 1`, `2`, `tsconfig.card.json`, `full.json`, `rust`, `tests/test_a.py` |
| `tests/planner/stubTrees.examples.test.ts` | yes | 3 | 9 | `Stub Trees example 1` … `3`, `planner/stub.cards.json`, `planner/stub.trees.json`, `decks/q9/_stubs`, `/abs/st` |
| `tests/acceptance/treeCheck.examples.test.ts` | yes | 3 | 9 | `Tree Check example 1` … `3`, `acceptance/treeOutput.json`, `acceptance/tree`, `a/a.go:6:25: undefined: b.Old`, `Q9` |
| `tests/cli/checkBuilds.examples.test.ts` | yes | 3 | 9 | `Check Builds example 1` … `3`, `cli/checkBuilds.json`, `decks/b1/deck.p20.json`, `ts-rename.json`, `p21 without the guard.go stub` |
| `tests/cli/deckCheck.p21b.examples.test.ts` | yes | 3 | 9 | `Deck Check example 4` … `6`, `decks/b1/deck.p20.json`, `decks/r1/deck.json`, `_stubs/src/a.ts`, `morph deck check: exit 2` |

min = the record's new examples; max = min + 6.

**Output budget** (`max_tokens`, before the session's ×3 for `ds`):

| card | returns | `max_tokens` |
|---|---|---|
| tree-profiles, stub-trees, check-builds | ≈ 1–3 KB new each | 8 000 |
| tree-check | ≈ 2.6 KB new | 10 000 |
| deck-check | deckCheck.ts + types.ts + main.ts ≈ 8 KB, three whole files | 14 000 |
| tree-profiles-judge | ≈ 3 KB new | 12 000 |
| stub-trees-judge, tree-check-judge | ≈ 4–6 KB new | 16 000 |
| check-builds-judge, deck-check-judge | ≈ 5–6 KB new, tmp roots, child processes | 20 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- **Layers** (guard unchanged): treeProfiles.ts in language imports nothing; stubTrees.ts in planner imports `node:path`
  and the `Card` type only; treeCheck.ts in acceptance imports `node:child_process`, `node:fs`, `node:os`, `node:path`,
  never reads `process.env`; checkBuilds.ts in cli imports `node:fs`, `node:path`, language's profiles and treeProfiles,
  planner's stubTrees, acceptance's treeCheck; no `process`, no console in src/cli/* but the entry.
- **No fixture names in src/**: no identifier, path or card id of P7b, go-p7b or ts-rename (the operator, comment
  6077766447); every language-specific string lives in Tree Profiles.
- A file a card writes is in no sibling's slice in the same generation: 0 [stub-trees, tree-check, tree-profiles]; 1
  [check-builds, stub-trees-judge, tree-check-judge, tree-profiles-judge] read generation 0's files; 2 [check-builds-judge,
  deck-check] read checkBuilds.ts; 3 [deck-check-judge] reads deckCheck.ts.
- Tests write only under `tmpRoot()` and remove it; no JS timer; no network (GOPROXY=off in every Go env line); a judge
  writes only its target.

## 7. Out of scope

Data of this phase (orchestrator, committed before the run): the fixtures of §2.1; `decks/p21b/` (checks, probes, deck).
After the merge the session (data): AUTONOMY step 1/2 and the templates' AUTONOMY/TASK_TEMPLATE — the gate puts its stubs
in `decks/<phase>/_stubs/` and `deck check` replaces the hand `fullvet.mjs` step for every language with a step.

**P21c (next phase; issue #12 comment 6077412737 item 2, MorphStudio 4efde92 §6, operator comment 6077766447):** the
subset transaction, language-agnostic, in the run loop — the group is the WHOLE `--only` subset; cards written by
generations as today (later cards see earlier code in slices); EVERY acceptance stage of every card (build, vet, probe,
own, full — whatever the profile's stages are) deferred until every group card is written, then run on the full new
tree; blame = the `file:line` lines of ANY stage's output (each profile's fileLine, the table of this phase) mapped to the
card owning that file, only it retried, against that same tree; after every retry all acceptances re-run to a fixed
point, rounds bounded like today's attempts; a line in a file outside the subset = a record break, stop, named
"outside the subset"; only `--only` decks switch, full cuts and existing decks byte for byte; keeping later files hidden
at run time is rejected; nothing in it names Go, packages or `go vet`. Its gate: go-p7b AND ts-rename (at least), each
green under the transaction and red with the correct blame without it (a demo shows both), a **forced judge retry after
its generation-2 sibling has written** in the demo (stub processor) and in the live go-p7b smoke on ds without a hand
edit of code — candidate: the smoke's map gives that judge a red-once step (a marker file under `/tmp/morph/<run>`
created on its first acceptance run), decided by P21c; fixtures for blame (a red line in card X's file retries X only)
and an outside-subset break.

Also out: hiding later generations for TypeScript (P21c's transaction replaces hiding); a `--stubs` flag; a Python
compile step (none is declared; a builder for Python is not in V2); checking a sibling's retry tree (P21c).

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component language --component planner-subset \
  --component acceptance --component cli --judge --checks decks/p21b/checks.json \
  --only tree-profiles,stub-trees,tree-check,check-builds,deck-check,tree-profiles-judge,stub-trees-judge,tree-check-judge,check-builds-judge,deck-check-judge \
  --out decks/p21b/deck.json
python3 decks/tools/scale_tokens.py decks/p21b/deck.json 3         # processor ds
node dist/cli.js deck check --root . --deck decks/p21b/deck.json                                  # errors 0
rm -rf /tmp/v2bin-p21b && mkdir -p /tmp/v2bin-p21b && cp -r dist /tmp/v2bin-p21b/ && ln -s $PWD/node_modules /tmp/v2bin-p21b/node_modules \
  && ln -s $PWD/templates /tmp/v2bin-p21b/templates
node /tmp/v2bin-p21b/dist/cli.js run --root . --deck decks/p21b/deck.json --processor ds --deadline 2400
```

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 10 (5 code, 5 judges) / 4: [stub-trees, tree-check, tree-profiles] [check-builds, stub-trees-judge, tree-check-judge, tree-profiles-judge] [check-builds-judge, deck-check] [deck-check-judge] |
| executor bill | ≈ $0.10–0.20 on ds ×3 (P21a: 8 cards $0.1969); ≤ $0.45 with a re-cut; cap $5 |
| cards with regeneration | 0–3 of 10 (tree-check: the pipe vs file, the prefix strip, symlinked node_modules; stub-trees: the heredoc tag, the export filter; check-builds: the note order; judges: a child-process test without the 120000 timeout) |
| tests after the run | 826 ± 6 in 137 files |
| first red | tree-profiles: a regex escaped once too few; stub-trees: siblings stubbed, every "export" line taken, a non-language target stubbed; tree-check: `.git` copied, node_modules copied, output not stripped, timeout waits on the pipe; check-builds: notes in another order, missing not reported for no-config cards; deck-check: notes counted as errors, builds key without `_stubs/` |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no answer cut at its `max_tokens`; (3) after the run no
file outside §2.3's twelve changed; (4) every cut byte for byte; (5) this repository's HEAD and refs unchanged by every
card; (6) after the merge `deck check` with the run's binary exits 2 naming `supervisor/guard.go:20` on go-p7b
deck.p20.json, 0 on deck.p21.json, 2 naming `src/report/line.ts(1,17)` on ts-rename; (7) no P7b / go-p7b / ts-rename name
in `src/` (grep).

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the MEASURE row
with its `прогоны` cell, the vitest log of every verify run; DECISIONS lines "P21b deckcheck"; after the merge the byte
identity re-cuts against main's binary and claims 6, 7; then the stop for the operator (`~/.morph-wait-operator`); P21c
is prepared after the operator's word.

## 11. Actual

### Gate (preparation)

09.10, on the VPS, by the preparing orchestrator (Opus 5.5, fresh context, no sub-agents); no paid run, no model call.
Mid-preparation two operator amendments arrived (MorphStudio 4efde92 §6; issue #12 comment 6077766447): the first,
Go-only design (Vet Tree, 8 cards, data commit 8c77e09) was replaced by the per-language one (data commit b9057f8) before
any gate step counted; the numbers below are the second design's.

The deck **cut by V2** (main's binary, 6201b7e code): `plan --component language --component planner-subset --component
acceptance --component cli --judge --checks decks/p21b/checks.json --only <the 10 ids>` **exit 0**, 10 cards, generations
`[stub-trees, tree-check, tree-profiles] [check-builds, stub-trees-judge, tree-check-judge, tree-profiles-judge]
[check-builds-judge, deck-check] [deck-check-judge]`; `scale_tokens.py … 3` (maxTokens: tree-profiles, stub-trees,
check-builds 24 000; tree-check 30 000; deck-check 42 000; tree-profiles-judge 36 000; stub-trees-judge, tree-check-judge
48 000; check-builds-judge, deck-check-judge 60 000); `deck check` **0 errors, 0 warnings, 0 hazards** (no `_stubs/`
beside it: no builds). Slices (slice + existing targets): 40.6–57.8 KB, the largest stub-trees-judge **57 840 B** before
this section (≈ 61 KB with it).

Scratch worktree `/tmp/p21b/gate` from b9057f8 (removed afterwards; no watcher or worker left), the deck's own acceptances
run as Morph runs them (`/bin/sh`, 300 s cap), cards in deck order, each reference committed before the next:
- **Stubs, red per example at the probe (20/20)**, typed throwing stubs (`Error: stub treeProfileFor typescript`, `stub
  stubTrees [9,3,"decks/q9/_stubs",7,3]`, `stub treeCheck […]`, `stub checkBuilds [true,"decks/b1/deck.p20.json",8,5,["PATH"]]`,
  `stub deckCheckCommand […]`; Main's row reads `exit 3` against 2): tree-profiles 3/3, stub-trees 5/5, tree-check 5/5,
  check-builds 3/3, deck-check 4/4; judges red at `guard: <file> missing`. **stubcheck.mjs exit 0 on all 10 stub logs.**
  fullvet does not apply (a TypeScript deck).
- **References green, chain seconds** (limit 250): stub-trees 73.8, tree-check 74.9, tree-profiles 72.5, check-builds 85.4,
  stub-trees-judge 74.2, tree-check-judge 80.6, tree-profiles-judge 76.2, check-builds-judge 104.5, deck-check 106.3,
  deck-check-judge 116.7 — **max 116.7 s**. Final tree `vitest run` **832 / 832 in 137 files** (812 + the reference
  judges' 20); ripple **0 of 812**; `git status` clean.
- **Mutants** (the changed contracts only), each under a 120 s subprocess timeout against its probe: **30 mutants** (3
  treeProfiles.ts, 8 stubTrees.ts, 10 treeCheck.ts, 5 checkBuilds.ts, 4 deckCheck.ts/main.ts), **3.1 min**, max 16.3 s, 0
  timeouts; **29 killed**; survivor: stubTrees pushing a missing target twice (equivalent for a valid deck: a target
  repeats only across two owners, a write-write hazard, or twice in one card) — DECISIONS known risk.
- **Issue #12 item 3.5, measured with the reference code** (§1's table): go-p7b deck.p20.json code 2, 9 breaks over 5 of
  8 cards, phase-loop `supervisor/guard.go:20:23: l.Resumes undefined (type *Loop has no field or method Resumes)`;
  deck.p21.json code 0; ts-rename code 2, 5 breaks (to-metres `src/report/line.ts(1,17): error TS2724 …`); a Python card
  and two cards with no config named in notes (warnings), never skipped.
- **Byte identity baseline** (no cut code changes in this phase): main's binary (6201b7e) vs the binary built at this
  data (8c77e09/b9057f8, same code) — go-mini `--checks decks/m1/checks.json` **75 416 B identical**; the P15 deck re-cut
  from 0365336 (filter, ×3) **398 622 B identical**, equal to the committed deck; go-p7b without `--only` **100 388 B
  identical**. These are the references the session rechecks with the run's binary.

**Forecast** on `ds` with every maxTokens × 3: P21a ran 8 cards for $0.1969 (12 requests); here 15 first requests (5 code
× 2 variants + 5 judges), 41–61 KB in, answers 1–8 KB: **≈ $0.20–0.30**, ≤ $0.60 with a re-cut; ≤ $1. **Gate holds.**

**Run command** (from the repo root, the binary copied first; the deck is already scaled ×3):

```
npm run build && rm -rf /tmp/v2bin-p21b && mkdir -p /tmp/v2bin-p21b && cp -r dist /tmp/v2bin-p21b/ && ln -s $PWD/node_modules /tmp/v2bin-p21b/node_modules && ln -s $PWD/templates /tmp/v2bin-p21b/templates
node /tmp/v2bin-p21b/dist/cli.js run --root . --deck decks/p21b/deck.json --processor ds --deadline 2400 > /tmp/p21b-run.json
```
