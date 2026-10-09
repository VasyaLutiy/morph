# TASK_P22a — `morph gate`, part a: the gate play in one headless command with one JSON verdict (`src/gate/{stubVerdict,gatePlan,playGate,gateCommand}.ts`, `src/cli/{types,parse,main}.ts`)

> Phase P22a of `docs/PLAN.md` (issue VasyaLutiy/morph#13, label `P22-gate`), operator 09.10. **Split** (§2.2 "Split",
> DECISIONS "P22a"): item 1 of the issue (the gate play: stubs and references per generation in a scratch tree, the
> stubcheck rule and deck check's stub trees inside the tool, chain times, the retry tree) is this phase, **10 cards, 4
> generations**; item 2 (mutants inside the gate through the reviewer's planMutants/runMutants, cap ≤ 30 / ≤ 20 min) and
> item 3 (byte identity as a committed corpus + a test) are **P22b**; the optional items 4 (`morph report`) and 5
> (`plan --scale-tokens`) are **P22c** (§7). Code cards in the NEW Component **gate** (Stub Verdict, Gate Plan, Play Gate,
> Gate Command) and **cli** (Parse Command and Main's route, one card). One gate (≤ $1, slices ≤ 200 KB, chains < 250 s,
> §11).

## 1. Why this

- **The gate is ritual.** Issue #13: over P20, P21a and P21b the main session spent 86–96 % of its work on mechanical
  steps; the gate play alone took 79 min and $14 over the three phases, and 23 % of the spend went to cache rebuilds after
  polling background gate scripts for more than 5 minutes. Every phase wrote its own `gate.py` / `play.sh`.
- **The hand gate missed a red the tool sees.** P21a's gate was clean and its live smoke RED (run 20261009-081603, 2/8):
  control-contract-judge retried after its generation sibling phase-loop wrote `supervisor/loop.go`. Measured with the
  reference code of this phase (a scratch worktree, never committed):

| deck (fixture) | language | `morph gate` code | rows | errors | wall |
|---|---|---|---|---|---|
| go-p7b `decks/b1/deck.p21.json` (the P21a cut, hiding) | go | **2** | 22 (8 stub, 8 ref, 6 retry) | `retry control-contract-judge: red (exit 1) at full: supervisor/guard.go:20:23: l.Resumes undefined …` — the P21a smoke RED | 17.9 s |
| go-p7b `decks/b1/deck.p21c.json` (the transaction cut, NEW fixture, cut by main) | go | **0** | 16 | — | 14.6 s |
| the same, stubs with control.go = its reference | go | 2 | 16 | `stub control-contract: green on its stubs` | 15.3 s |
| the same + `mcp/count.go` (reads Resumes, outside the subset) | go | 2 | 16 | 8 build breaks + 8 ref reds naming `mcp/count.go:6:52` | 15.4 s |
| ts-rename `decks/r1/deck.json` (cut by main at P21b, no transaction) | typescript | 2 | 10 | 5 build breaks; stubs red at `tsc` naming `src/report/line.ts(1,17)` | 34.8 s |
| ts-rename `decks/r1/deck.tx.json` (the transaction cut, NEW fixture) | typescript | **0** | 8 | — | 42.7–46.8 s |

- **Size.** 4 gate code cards + the cli card + 5 judges = **10 cards**, 4 generations, code-only targets (probes, no smoke
  test). Reference: stubVerdict.ts 1.6 KB, gatePlan.ts 2.5 KB, playGate.ts 3.6 KB, gateCommand.ts 5.3 KB new; parse.ts
  +27 lines, types.ts +2, main.ts +3.
- **Record sizes** (bytes of each Component block): gate NEW **18 859**; cli 29 868 → **29 915** (≤ 30 KB rule: the Parse
  Command flag lists say "every command takes --root and --pretty" once, the Command schema says it once, Plan Command's
  empty map and a P21c aside shortened — no rule removed).
- **Ripple**: see §11 (measured with the reference code and this phase's data on the full suite).

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main** (module → what the new code calls or constructs): `src/cards/types.ts` — `Card` (every field:
  customId, intent, targets, contextSlice, instruction, acceptance, model, maxTokens, reasoning, variants, dependsOn),
  `Deck` ({cards, externalDependsOn}); `src/cards/layer.ts` — `layerGenerations(deck)`; `src/cards/transaction.ts` —
  `isTransactionDeck(cards)`, `TRANSACTION_MARK`; `src/language/treeProfiles.ts` — `TREE_PROFILES` (typescript, python,
  go; `fileLine` a RegExp source, group 1 the path); `src/acceptance/run.ts` — `runAcceptance(command, root, {env,
  timeoutMs?})` → Promise<{exit, log, timedOut}> (`/bin/sh -c` in root; the log clipped to 4 000 characters: the first
  and last 1 500 kept, lines naming FAIL/Error/assert/expected kept from the middle; default timeout 300 000 ms);
  `src/git/run.ts` — `gitOk(root, args, env)` → stdout, throws `git <args[0]> failed (exit <n>): <first stderr line>`;
  `src/cli/document.ts` — `readDeckFile(root, deckPath)` → `{ok: true, deck} | {ok: false, result}`;
  `src/cli/checkBuilds.ts` — `checkBuilds(root, deckPath, deck, generations, env)` → `BuildCheck[] | null` (null when
  `<dirname(deckPath)>/_stubs` is not a directory under root); `src/cli/types.ts` — `Command`, `CliDeps` ({env, now, cwd,
  transport, interrupted?}), `CommandResult`.
- **Preconditions of the callees.** git · `git clone --shared --no-checkout <root> <dir>` borrows root's objects (no
  copy) and writes nothing into root; a checkout of the clone is the committed HEAD, never root's working files — a gate
  plays committed data only. git · an ignore line `node_modules/` (trailing slash) matches a directory only: a symbolic
  link named node_modules is listed by `git ls-files --others --exclude-standard` (measured), so the clone's own
  `.git/info/exclude` gets `/node_modules`. acceptance · every built acceptance echoes `== <stage>` (single-quoted, at the
  start of a line: `echo '== probe'; …`), a judge's guard stage is `== guard <file>`, a held lint verdict is `== eslint
  failed (see above); …` or `== vet or gofmt failed (see above); …`; a Go stub run prints `--- FAIL: TestX (0.00s)`, a
  vitest run ` FAIL  <file> > <test>` (one leading space). acceptance · runAcceptance runs the acceptance of the card as
  text: the transaction mark is a comment line. cli · Check Builds reads its stubs from `<dirname(deck)>/_stubs` under
  the root it is given: the gate gives it the scratch clone with the `--stubs` directory copied there.
- **Fixtures** (`tests/fixtures/`), each by the type the Function takes:

| file | type | what it is | what the Function returns on it |
|---|---|---|---|
| `gate/stubLogs.json` (NEW) | ONE object name → text (7 logs) | real acceptance logs of gate stub runs: "go probe" (go-p7b control-contract, red at probe, one `--- FAIL:` line, a panic trace with indented lines), "go judge" (red at `== guard control/control_examples_test.go`), "go vet outside" (runtime-guard on the P20 cut: a `vet:` line naming `supervisor/guard_examples_test.go`, red later at probe), "ts tsc" (ts-rename to-metres on the old cut: two tsc lines naming other files), "ts probe" (two vitest ` FAIL ` lines); "mixed" (written: build, vet and tsc stages, own files, a `#` line, a tab line, a line with no file, a probe stage, the held eslint verdict) and "none" (no header) | Stub Verdict 2, 3 |
| `gate/verdicts.json` (NEW) | ONE object name → `StubVerdict` | the verdicts of Stub Verdict 2–3 under the log's name, plus "mixed, every stage", "mixed, no pattern" | Stub Verdict 2, 3 |
| `gate/plans.json` (NEW) | ONE object "p21", "p21c", "missing", "small" → `GatePlan` | the plans of Gate Plan 1–3 | Gate Plan 1–3 |
| `gate/playGate.json` (NEW) | ONE object "shell", "node_modules", "timeout" → `PlayRow[]` | the rows of Play Gate 1–3 (8, 2, 4 rows) | Play Gate 1–3 |
| `gate/gateCommand.json` (NEW) | ONE object name → `{code, document}` (8 names: "p21", "tx", "planted", "deck not found", "stubs not found", "refs not found", "missing", "slow") | the results of Gate Command 1–3 | Gate Command 1–3 |
| `go-p7b/decks/b1/deck.p21c.json` (NEW) | deck file (8 cards, 102 026 B) | go-p7b cut by main `--only` the 8 ids with `--checks decks/b1/checks.json` (goguard/gofirstdiff installed): every acceptance carries the transaction mark | Stub Verdict 1, Gate Plan 2 |
| `go-p7b/decks/b1/_refs/` (NEW) | 8 files at their targets' paths | the reference targets of go-p7b (= `decks/p21/break/ref/`) | Gate Command 1, 3 |
| `go-p7b/decks/b1/deck.p21.json`, `_stubs/` (P21b) | deck file; 8 stub files | the P21a cut; the gate's stubs | Gate Plan 1, 3; Gate Command 1–3 |
| `cli/parseArgv.json`, `cli/parse.json` (key "23" added) | ONE object | 10 argv lists of `gate` and their results | Parse Command 23 |
| `cli/examples.json` (key "Main 17" added) | ONE object | given/then of Main 17 | — |

- **Harness skeletons** (only `tests/helpers.ts`, node:fs, node:os, node:path and the modules named):

```ts
// Stub Verdict, Gate Plan
const FL = TREE_PROFILES.map((p) => p.fileLine);
const logs = (): Record<string, string> => fixtureJson("gate/stubLogs.json") as Record<string, string>;
const verdict = (k: string): StubVerdict => (fixtureJson("gate/verdicts.json") as Record<string, StubVerdict>)[k];
function deck(name: string): Deck { const d = loadDeck(fs.readFileSync(fixturePath("go-p7b/decks/b1/" + name), "utf8")); if (!d.ok) throw new Error(name); return d.deck; }
const all = (d: Deck): string[] => d.cards.flatMap((c) => c.targets).sort();
const plan = (k: string): GatePlan => (fixtureJson("gate/plans.json") as Record<string, GatePlan>)[k];
// a Card has EVERY field (loadDeck refuses a missing one); a deck file is a top-level JSON ARRAY of such cards
const card = (id: string, targets: string[], acceptance: string | null, dependsOn: string[] = []): Card => ({ customId: id, intent: "generate",
  targets, contextSlice: [], instruction: "w", acceptance, model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn });
// Play Gate, Gate Command: committed tmp repositories (the gate plays HEAD), a clock of fixed steps, PATH and HOME only
const env = (): Record<string, string> => ({ PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" });
const clock = (step: number): (() => number) => { let t = 0; return () => (t += step); };   // now +step per call
function repo(files: Record<string, string>): TmpRepo { const r = tmpRepo(); for (const [p, t] of Object.entries(files)) r.write(p, t);
  r.git(["add", "-A"]); r.git(["commit", "-q", "-m", "base"]); return r; }                // history: base, init
function p7b(): TmpRepo { const r = tmpRepo(); fs.cpSync(fixturePath("go-p7b"), r.root, { recursive: true });
  r.git(["add", "-A"]); r.git(["commit", "-q", "-m", "base"]); return r; }
const rows = (k: string): PlayRow[] => (fixtureJson("gate/playGate.json") as Record<string, PlayRow[]>)[k];
const result = (k: string): { code: number; document: unknown } => (fixtureJson("gate/gateCommand.json") as Record<string, { code: number; document: unknown }>)[k];
const deps = (step = 1000): GateDeps => ({ env: env(), now: clock(step), readDeck: readDeckFile, builds: checkBuilds });
const B1 = { deck: "decks/b1/deck.p21.json", stubs: "decks/b1/_stubs", refs: "decks/b1/_refs" };
const M = TRANSACTION_MARK + "\n";                         // Gate Command 2: both acceptances start with it
// Main 17: examples.json["Main 17"] is PROSE for a reader — never parse its given or then; the calls, verbatim:
function io(): { io: CliIo; out: string[]; err: string[] } { const out: string[] = [], err: string[] = [];
  return { io: { stdout: (t) => { out.push(t); }, stderr: (t) => { err.push(t); } }, out, err }; }
const cliDeps = (): CliDeps => ({ env: { PATH: process.env.PATH ?? "" }, now: () => 0, cwd: "/", transport: null });
//   const r = tmpRoot(); const a = io();
//   expect(await main(["gate", "--deck", "nope.json", "--stubs", "s", "--refs", "r", "--root", r.root], cliDeps(), a.io)).toBe(4);
//   expect(a.out).toStrictEqual(['{"error":{"code":4,"kind":"UsageError","message":"deck file not found: nope.json"}}\n']);
//   expect(a.err).toStrictEqual(["morph gate: exit 4\n"]);
//   then ["gate", "--deck", "d.json", "--root", r.root] → 4, out ['{"error":{"code":4,"kind":"UsageError","message":"missing --stubs"}}\n'],
//   err ["morph: missing --stubs\n"]; r.rm() in finally
// every test that runs a child process: test(name, fn, 120000); every repo: try { … } finally { r.rm(); }
```

**Literals and whitespace** (fix of run 20261009-153356): the cut renders a record example into the judge's instruction
with runs of spaces collapsed to one, so no example literal of this record relies on two spaces in a row (vitest's
`FAIL  file` is only in the real logs of `gate/stubLogs.json`, read from the fixture, never retyped); a literal of an
example's acceptance is typed exactly as the record shows it.

**Distinct markers.** Card ids a, b, c, n, x, k, m, z, s, u, t1, t2, zz and the fixtures' ids; marks A1, B2, C3, N1, X1, X2, T1, T2, BROKEN, U1,
"old a", "kept"; dirs st, rf, st2, st3, rf3, s, s2, f, k; the clock steps 1000, 2500, 300000, 249000. No name of P7b, go-p7b,
ts-rename, supervisor or Resumes, no card id of a fixture, is in any `src/` file: only CHAIN_LIMIT_SECONDS, the stage
names, the commit identity and the messages below are fixed by the record.

### 2.2. OUTPUT data shapes

**`src/gate/stubVerdict.ts`** (NEW; layer gate; pure, no import) — **Stub Verdict**:

```ts
export interface StubVerdict { stage: string | null; expected: string; outside: string[]; failures: string[] }
export function expectedStage(acceptance: string): string;   // "probe" when a line starts with "echo '== probe'", else "guard"
export function stubVerdict(log: string, expected: string, targets: readonly string[], fileLines: readonly string[],
  stages: readonly string[] | null = ["build", "vet", "tsc"]): StubVerdict;
```

- Per line of `log.split("\n")`, `trimEnd()`ed: `/^== (\S+)/` → current = "verdict" when the line holds " failed (see
  above)", else group 1; nothing else for a header line. Before the first header nothing counts.
- t = the line trimmed; current === expected and t starts "FAIL " or "--- FAIL: " → t into failures once.
- Then, when stages is null or holds current, and the line is not "" and starts with neither " " nor "\t": the FIRST
  fileLine (`new RegExp`, in order) that matches the line; its group 1 not in targets → the line (trimEnd only) into
  outside once; none matches → nothing.
- stage = current at the end (null when no header). Lists in first-seen order.

| example | given | result |
|---|---|---|
| Stub Verdict 1 | expectedStage of builder/go/code1.txt, judge1.txt, deck.p21c.json's first acceptance, "", "  echo '== probe'; exit 1" | "probe", "guard", "probe", "guard", "guard" |
| Stub Verdict 2 | the five real logs (§2.1) with FL | verdicts.json: go probe {probe, [], [`--- FAIL: TestProbeControlContractExample1 (0.00s)`]}; go judge guard; go vet outside {probe, [`vet: supervisor/guard_examples_test.go:11:16: …`], []}; ts tsc {tsc, two lines}; ts probe {probe, [], two ` FAIL ` lines trimmed} |
| Stub Verdict 3 | "mixed" with targets [b/b.go, src/own.ts]; with stages null; with fileLines []; "none" | verdicts.json "mixed" {verdict, 4 lines, 2 failures}; "mixed, every stage" + the probe stage's `src/zz.ts(9,9)` line; "mixed, no pattern" outside []; "none" {null, [], []} |

**`src/gate/gatePlan.ts`** (NEW; layer gate; pure; imports the Card type and isTransactionDeck) — **Gate Plan**:

```ts
export type GatePhase = "stub" | "ref" | "retry";
export interface GateStep { phase: GatePhase; generation: number; card: string; put: Record<string, "stub" | "ref">; commit: string[] }
export interface GatePlan { transaction: boolean; steps: GateStep[]; missing: string[] }
export function gatePlan(cards: readonly Card[], generations: string[][], stubs: readonly string[], refs: readonly string[]): GatePlan;
```

- order = per g, per id of generations[g] whose card exists, {card, generation: g}; transaction = isTransactionDeck(cards).
- missing: per entry, per target: "no stub: <t>" when not in stubs, then "no reference: <t>" when not in refs, each
  once; not empty → steps [].
- Not a transaction: per g, per entry two steps in a row — its {stub, put targets → "stub", commit []} immediately
  followed by its {ref, put → "ref", commit the targets} (generation [a, b]: stub a, ref a, stub b, ref b, then retry a,
  retry b; never every stub of the generation first); then, when g has ≥ 2 entries, per entry {retry, put {}, commit []}. A transaction: a stub step per entry (the
  first puts every target of every entry → "stub", each once, first-seen order; the rest put {}), then a ref step per
  entry (the first puts them all → "ref"; the last commits them all); no retry.

| example | given | result |
|---|---|---|
| Gate Plan 1 | deck.p21.json, stubs = refs = every target sorted | plans.json "p21": 22 steps, retries after generations 1, 2, 3 |
| Gate Plan 2 | deck.p21c.json | "p21c": transaction, 16 steps |
| Gate Plan 3 | deck.p21.json without supervisor/guard.go (stubs) and daemon/daemon.go, control/control.go (refs); cards k, m, n | "missing": steps [], 3 lines; "small": 8 steps, zz skipped, one retry pair |

**`src/gate/playGate.ts`** (NEW; layer gate; node:fs, node:os, node:path; acceptance's runAcceptance, git's gitOk,
language's TREE_PROFILES, ./stubVerdict.js, the GateStep types) — **Play Gate**:

```ts
export interface PlayRow { phase: GatePhase; generation: number; card: string; exit: number | null; timedOut: boolean; seconds: number;
  stage: string | null; expected: string | null; outside: string[]; failures: string[]; ok: boolean }
export interface PlayInput { root: string; cards: readonly Card[]; steps: readonly GateStep[]; stubDir: string; refDir: string }   // dirs absolute
export interface PlayDeps { env: Record<string, string>; now: () => number; timeoutMs?: number; before?: (scratch: string) => void }
export async function playGate(input: PlayInput, deps: PlayDeps): Promise<PlayRow[]>;
```

1. base = `fs.mkdtempSync(path.join(os.tmpdir(), "morph-gate-"))`, scratch = base/w; `gitOk(root, ["clone", "-q",
   "--shared", "--no-checkout", root, scratch], env)`; `gitOk(scratch, ["checkout", "-q", "--detach", <gitOk(root,
   ["rev-parse", "HEAD"], env) trimmed>], env)`.
2. root/node_modules exists → `fs.symlinkSync(fs.realpathSync(it), scratch/node_modules)`; scratch/.git/info created and
   "/node_modules\n" appended to its exclude. Then `deps.before?.(scratch)`.
3. Per step (card by customId, none → skipped): each put entry copies `<stubDir | refDir>/<target>` over
   scratch/<target> (parents created); start = deps.now(); `runAcceptance(card.acceptance ?? "", scratch, {env,
   timeoutMs: deps.timeoutMs})`; seconds = `Math.round((deps.now() - start) / 100) / 10`.
4. stub: v = stubVerdict(log, expectedStage(acceptance ?? ""), targets, FL), ok = exit !== 0 && v.stage === v.expected
   && v.outside.length === 0; ref/retry: v = stubVerdict(log, "", targets, FL, null), ok = exit === 0. Row keys in the
   interface's order; expected = v.expected for a stub, else null.
5. A non-empty commit: `gitOk(scratch, ["add", "-A", "-f", "--", ...commit])`, then `gitOk(scratch, ["-c", "user.name=morph
   gate", "-c", "user.email=gate@morph.invalid", "commit", "-q", "--allow-empty", "-m", "gate: " + card])`.
6. `finally`: `fs.rmSync(base, {recursive: true, force: true})`. root is never written.

| example | given | result |
|---|---|---|
| Play Gate 1 | repo of d.json, src/a.txt "old a\n", st/, rf/; cards a, b, c (the record's acceptances); Gate Plan(cards, [[a, b], [c]], …); now +1000 | playGate.json "shell" (stub b NOT ok: stage tsc, outside the `src/zz.ts(1,1)` line); root's HEAD, refs, status, worktree list unchanged; src/a.txt "old a\n" |
| Play Gate 2 | node_modules ignored in root; card n; before records | "node_modules"; before once, a dir "w" under os.tmpdir() with d.json and the link, gone afterwards |
| Play Gate 3 | cards z (acceptance null), s (`sleep 5`); a step of an unknown card first; timeoutMs 700; now +100 | "timeout": the unknown card skipped; z's stub green (NOT ok), its ref ok; s's stub timed out at "probe" (ok), its ref timed out (NOT ok) |

**`src/gate/gateCommand.ts`** (NEW; layer gate; node:fs, node:path; cards' layerGenerations and the Deck type,
./gatePlan.js, ./playGate.js) — **Gate Command**:

```ts
export const CHAIN_LIMIT_SECONDS = 250;
export interface GateBuild { card: string; generation: number; language: string | null; stubbed: number; missing: string[]; breaks: string[]; note: string | null }
export interface GateArgs { deck: string; stubs: string; refs: string }
export type GateDeckRead = { ok: true; deck: Deck } | { ok: false; result: { code: 0 | 1 | 2 | 3 | 4; document: unknown } };
export interface GateDeps { env: Record<string, string>; now: () => number; timeoutMs?: number;
  readDeck: (root: string, deckPath: string) => GateDeckRead;
  builds: (root: string, deckPath: string, deck: Deck, generations: string[][], env: Record<string, string>) => GateBuild[] | null }
export interface GateDocument { deck: string; transaction: boolean; cards: number; generations: string[][]; missing: string[];
  builds: GateBuild[] | null; rows: PlayRow[]; maxSeconds: number; errors: string[] }
export async function gateCommand(root: string, args: GateArgs, deps: GateDeps): Promise<{ code: 0 | 1 | 2 | 3 | 4; document: unknown }>;
```

1. `deps.readDeck(root, args.deck)` not ok → its result. Then stubs, then refs: `path.resolve(root, v)` not a directory →
   `{code: 4, document: {error: {code: 4, kind: "UsageError", message: "stubs directory not found: <v>"}}}` /
   `"references directory not found: <v>"`.
2. generations = layerGenerations(deck); the regular files under each directory (readdirSync withFileTypes, a link not
   followed), relative, "/"-joined, sorted; plan = gatePlan(deck.cards, generations, stubs, refs).
3. plan.missing empty → rows = playGate({root, cards: deck.cards, steps, stubDir, refDir}, {env, now, timeoutMs, before})
   where before(scratch): at = scratch/<path.dirname(args.deck)>/_stubs; present → renamed to at + ".gate-kept"; the
   stub directory copied to at (`fs.cpSync(…, {recursive: true})`); builds = deps.builds(scratch, args.deck, deck,
   generations, env); `finally` at removed and the kept one renamed back. Else rows [] and builds null.
4. errors, in order: plan.missing; per build "build <card>: no stub for <m>" per missing, "build <card>: <line>" per
   break; per row with the prefix "<phase> <card>: ": stub — exit 0 → "green on its stubs", else stage ≠ expected →
   "red at <stage ?? "no stage">, expected <expected>"; then each outside line → "names a file outside its targets:
   <line>"; ref/retry — exit ≠ 0 → ("timed out" when timedOut, else "red (exit <exit>)") + " at <stage ?? "no stage">" +
   (": " + outside[0] when any); every row with seconds ≥ 250 → "<seconds> s, over the 250 s limit".
5. → `{code: errors.length > 0 ? 2 : 0, document: {deck: args.deck, transaction, cards: deck.cards.length, generations,
   missing, builds, rows, maxSeconds: the largest row seconds, 0 when none, errors}}`, keys in that order.

| example | given | result |
|---|---|---|
| Gate Command 1 | p7b(), B1, deps() | gateCommand.json "p21": code 2, the one retry error naming `supervisor/guard.go:20:23`; root status "" |
| Gate Command 2 | repo of d.json (the record's t1, t2 with M), s/, f/, s2/; stubs "s" then "s2", refs "f" | "tx" code 0, transaction, 4 rows, two build notes; "planted" code 2: ["stub t1: green on its stubs", "stub t2: red at tsc, expected probe", "stub t2: names a file outside its targets: lib/old.ts(3,4): error TS2304: Cannot find name q7."] |
| Gate Command 3 | deck nope.json; stubs nope; refs nope; st3 without supervisor/guard.go + rf3 without daemon/daemon.go; a repo with d.json = card x (src/x.txt), s/, f/, deps(300000) | "deck not found" 4; "stubs not found" 4; "refs not found" 4; "missing" 2 (no play); "slow" 2: two "300 s, over the 250 s limit", builds [x's note "no language profile claims src/x.txt: not built"] |

**`src/cli/types.ts`, `src/cli/parse.ts`, `src/cli/main.ts`** (PATCH) — **Parse Command**, **Main**:

- types.ts: `export interface GateArgs { name: "gate"; root: string; pretty: boolean; deck: string; stubs: string; refs:
  string }` (before `Command`), and `| GateArgs` last in the `Command` union.
- parse.ts: "--stubs" and "--refs" are value flags; the word "gate" is a command of arity 1; gate takes --root, --pretty,
  --deck, --stubs, --refs; right after the existing "missing --deck" check: gate without --stubs → "missing --stubs",
  without --refs → "missing --refs", else `{name: "gate", root, pretty, deck, stubs, refs}`. The "no command (commands:
  …)" message stays as it is. Every other check, message, default and key stays exactly as it is.
- main.ts: `else if (command.name === "gate") result = await gateCommand(root, command, {env: deps.env, now: deps.now,
  readDeck: readDeckFile, builds: checkBuilds});` before the final run branch; imports `gateCommand` from
  "../gate/gateCommand.js", `checkBuilds` from "./checkBuilds.js", `readDeckFile` added to the existing "./document.js"
  import (one import per module).

| example | given | result |
|---|---|---|
| Parse Command 23 | parseArgv.json["23"] (10 argv) | parse.json["23"]: two gate commands; missing --deck, --stubs, --refs; `flag --processor does not apply to gate`; `flag --stubs does not apply to deck check`; `unexpected argument: x`; `flag --stubs needs a value`; `flag --refs given twice` |
| Main 17 | examples.json["Main 17"] | 4, `deck file not found: nope.json`, stderr `morph gate: exit 4\n`; then 4, `missing --stubs`, stderr `morph: missing --stubs\n` |

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P22a gate"; #13 = issue VasyaLutiy/morph#13):

- **Split** · P22a = item 1 (the play, 10 cards); P22b = items 2 + 3 (mutants in the gate: a stop time for Run Mutants,
  the killer, the cap; the identity corpus and its test: ≈ 6–8 cards); P22c = the optional items 4 + 5 · together ≥ 18
  cards: over the ≈ 8–10 bound; the operator: "split rather than narrow".
- **Where** · a NEW Component and layer gate (src/gate/), the command in its own Component (PLAN 07.10 "Command CLI lives
  in its own Component"); cli only parses and routes · cli is at 29.9 KB.
- **Layer gate** · imports cards, acceptance, git, language; node:fs, node:os, node:path; no clock, no environment, no
  spawn of its own (decks/tools/guard.mjs, data of this phase) · like debt (P17); Check Builds and Read Deck File live in
  cli, so Main injects them (`deps.builds`, `deps.readDeck`): gate imports no cli module.
- **Scratch** · `git clone --shared --no-checkout` + a detached checkout of HEAD under os.tmpdir(), removed in finally ·
  the hand gates' `git worktree add` writes `.git/worktrees` into the user's repository; a clone writes nothing there
  and borrows the objects; the gate plays the committed deck and data (a dirty tree is not played).
- **node_modules** · linked to its real path, excluded in the clone's own info/exclude · measured: a link is listed as
  untracked by a `node_modules/` ignore line, and every acceptance's last step refuses an untracked file.
- **Play order** · per card in generation order: stub run, then reference run, then the reference committed in the
  scratch; after a generation of ≥ 2 cards every card of it runs again (retry) · the hand gates' order, plus the tree a
  retry after a sibling sees — issue #13 "the gate misses the retry scenario": go-p7b deck.p21.json, the P21a smoke RED,
  is named by the gate (§1). P21c's case is reused, not duplicated: a transaction deck's reference round already runs
  every acceptance on the whole subset (P21c's run), so it has no retry steps and no red-once step in src/.
- **Transaction deck** · two rounds: every stub in place then every acceptance; every reference in place then every
  acceptance; one commit at the end · the tree Run Transaction's rounds see.
- **Expected stage** · "probe" when the acceptance echoes `== probe`, else "guard" · the builder's two shapes (a code
  card's probe; a judge stops at its file's guard).
- **Stub rule** · red, stopped at the expected stage, no line of a build/vet/tsc stage naming a file outside the targets
  (stubcheck.mjs's rule, the file found by Tree Profiles' fileLine, not stubcheck's own regex) · language-general.
- **Failures** · the expected stage's ` FAIL ` / `--- FAIL: ` lines, trimmed, distinct · the session counts them against
  the probe's examples ("red per example"); a log is clipped at 4 000 characters by Run Acceptance, so a long red can
  list fewer (known limit).
- **Builds** · Check Builds (P21b) on the scratch with the stubs at `<deck dir>/_stubs`, a tracked one moved aside and
  put back · deck check's per-card stub trees in the tool (fullvet's job), without a new Check Builds parameter.
- **Missing files** · a target without a stub or without a reference: the plan stops, code 2, nothing played · an honest
  play needs both (P21b's missing stub rule).
- **Chain** · every run timed with deps.now(), one decimal; ≥ 250 s is an error · AUTONOMY step 2's limit; the
  acceptance's own 300 s timeout stays Run Acceptance's default.
- **Verdict** · one document, `errors` the gate's decision (code 2 when any, 0 when none) · exit 0 / non-zero as the
  issue asks; code 2 is "a refusal before spend" (Classify Error).
- **No-command message** · unchanged · two pins (parse.json "1" and tests/cli/parse.examples.test.ts:132); the listing
  is a help text, not a contract of this phase.
- **Test time** · the examples play real Go once (go-p7b deck.p21.json, 18 s) and shell decks otherwise; TypeScript is
  covered by real tsc/vitest logs (Stub Verdict 2) and by the dogfood gate of this deck · measured: with go-p7b's
  transaction, planted and outside plays and ts-rename's TypeScript play in the examples the four gate test files took
  113 s and the full suite 204 s on this 2-core VPS (100 s without them), every later chain over 250 s; those plays are
  §1's measurements and claim 6, not tests.
- **Dogfood** · this phase's own gate is played by hand (the tool exists after the run): the reference binary of this
  preparation runs the deck's acceptances, plus stubcheck.mjs on every stub log; after the run the session re-plays this
  deck with the run's binary (`morph gate --deck decks/p22a/deck.json --stubs decks/p22a/_stubs --refs <the run's
  targets>`) and its numbers go into §11 · issue #13 "this phase's gate is the first played by morph gate".

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/gate/stubVerdict.ts` | NEW | probe only | NEW `tests/gate/stubVerdict.examples.test.ts` (Stub Verdict 1–3) |
| `src/gate/gatePlan.ts` | NEW | probe only | NEW `tests/gate/gatePlan.examples.test.ts` (Gate Plan 1–3) |
| `src/gate/playGate.ts` | NEW | probe only | NEW `tests/gate/playGate.examples.test.ts` (Play Gate 1–3) |
| `src/gate/gateCommand.ts` | NEW | probe only | NEW `tests/gate/gateCommand.examples.test.ts` (Gate Command 1–3) |
| `src/cli/types.ts`, `parse.ts`, `main.ts` | PATCH | probe only | NEW `tests/cli/gate.examples.test.ts` (Parse Command 23, Main 17) |

- Each judge: "<Function> example <n>: <what>", one per example in record order, the skeleton's helpers, expected values
  from the named fixture; at most 6 own tests; every child-process test with timeout 120000.

### 2.4. What must not break

- Byte for byte: every file outside the 7 code targets and the 5 judge files — every other `src/` file, `tests/helpers.ts`,
  every existing test file, `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/`, `templates/` (frozen).
- Every cut byte for byte (no planner or builder change): go-mini `--checks decks/m1/checks.json` (75 416 B), the P15
  re-cut from 0365336 (398 622 B), go-p7b without `--only` (100 388 B) — main's binary vs the run's (§11).
- 862 tests in 141 files green at every card; after the run **862 + 3 × 4 + 2 = 876** in 146 files (± the judges' own).

## 3. Acceptance

Built by `morph plan --checks decks/p22a/checks.json`, narrow to broad, every stage printing `== <stage>`. `ownGit: true`,
`frozen` the defaults + `templates`, no `fullExclude` (ripple §11). Every acceptance carries the transaction mark (an
`--only` cut, P21c): the run writes all ten cards, then runs every acceptance on the whole tree.

Code cards (code-only targets): `probe/<card>/` → `tsc` (per-card tsconfig) → `eslint <targets>` → `guard.mjs src
<targets>` → the probe `decks/p22a/parts/<card>.probe.ts` (stub-verdict SV 1–3 + 1 row = 4; gate-plan GP 1–3 + 1 row = 4;
play-gate PG 1–3 + 1 row = 4; gate-command GC 1–3 + 1 row = 4; parse-command PC 23, Main 17 + 1 row
= 3; **19 tests**) → eslint's verdict → full `vitest run` → own git → frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs tests <file> <min> <max> lits<i>.json` → `vitest
run <targets>` → eslint's verdict → full run → own git → frozen → untracked.

| file | new | min | max | lits |
|---|---|---|---|---|
| `tests/gate/stubVerdict.examples.test.ts` | yes | 3 | 9 | `Stub Verdict example 1` … `3`, `gate/stubLogs.json`, `gate/verdicts.json`, `mixed, every stage`, `builder/go/judge1.txt` |
| `tests/gate/gatePlan.examples.test.ts` | yes | 3 | 9 | `Gate Plan example 1` … `3`, `gate/plans.json`, `deck.p21c.json`, `extra.ts` |
| `tests/gate/playGate.examples.test.ts` | yes | 3 | 9 | `Play Gate example 1` … `3`, `gate/playGate.json`, `gate: b,gate: a,base,`, `node_modules/q/index.js`, `timeoutMs: 700` |
| `tests/gate/gateCommand.examples.test.ts` | yes | 3 | 9 | `Gate Command example 1` … `3`, `gate/gateCommand.json`, `decks/b1/_refs`, `planted`, `BROKEN`, `300000` |
| `tests/cli/gate.examples.test.ts` | yes | 2 | 8 | `Parse Command example 23`, `Main example 17`, `missing --stubs`, `deck file not found: nope.json`, `morph gate: exit 4` |

min = the record's examples in the file; max = min + 6.

**Output budget** (`max_tokens`, before the session's ×3 for `ds`):

| card | returns | `max_tokens` |
|---|---|---|
| stub-verdict, gate-plan | ≈ 1.6–2.5 KB new | 8 000 |
| play-gate, gate-command | ≈ 3.6–5.3 KB new | 12 000 |
| parse-command | types.ts + parse.ts + main.ts ≈ 26 KB, three whole files | 28 000 |
| stub-verdict-judge, gate-plan-judge, parse-command-judge | ≈ 3–5 KB new | 16 000 |
| play-gate-judge, gate-command-judge | ≈ 6–9 KB new, committed tmp repositories, child processes | 24 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- **Layers** (decks/tools/guard.mjs gains the layer gate, data of this phase): src/gate/* imports cards, acceptance, git,
  language and its own modules only; of the Node modules node:fs, node:os, node:path; never reads `process.env` or the
  clock (deps.now), spawns nothing itself (runAcceptance, gitOk). stubVerdict.ts and gatePlan.ts import no Node module.
- **No fixture names in src/**: no identifier, path or card id of P7b, go-p7b or ts-rename; no language name in src/gate
  (the patterns are Tree Profiles').
- A file a card writes is in no sibling's slice in the same generation: 0 [gate-plan, parse-command, stub-verdict]; 1
  [gate-plan-judge, parse-command-judge, play-gate, stub-verdict-judge] read generation 0's files; 2 [gate-command,
  play-gate-judge] read playGate.ts; 3 [gate-command-judge] reads gateCommand.ts.
- Tests write only under `tmpRoot()` / `tmpRepo()` and remove them; no JS timer; no network (GOPROXY=off in every Go
  acceptance); a judge writes only its target.

## 7. Out of scope

Data of this phase (orchestrator, committed before the run): the fixtures of §2.1, the record, the map, the guard's layer,
`decks/p22a/` (checks, probes, `_stubs/`, deck), and the regulation text, written now and **in force from this phase's
merge on**: `docs/AUTONOMY.md` steps 1–2, `templates/common/docs/AUTONOMY.md`, `docs/TASK_TEMPLATE.md` and
`templates/common/docs/TASK_TEMPLATE.md` replace the hand stub/reference play, stubcheck.mjs and the chain timing with one
`morph gate --deck … --stubs … --refs …` and its verdict (mutants stay a hand step until P22b).

**P22b (next; issue #13 items 2 and 3, required):** mutants inside the gate — `morph gate` plans mutants over the
reference targets of the code cards (the reviewer's planMutants, spread to ≤ 30), runs each through Run Mutants with the
owning card's acceptance (its `== full` stage dropped, decided there) as the killing command under a 120 s timeout, stops
at 20 min (Run Mutants gains a stop time), and lists survivors and untried mutants in the verdict (code 1 when only they
remain); byte identity as a committed corpus (tree@commit + plan args + the cut's sha256: go-mini, P15, go-p7b, MorphV2's
own decks) and a test that runs it (red on a changed planner output).
**P22c (optional, issue items 4 and 5):** `morph report --run … --deck … --gate <verdict>` (the MEASURE row and §11's
numeric skeleton); `morph plan --scale-tokens <k>` and a hash of the cut's inputs in the deck.

Also out: a judge's extra assumptions (issue #13, a template matter); logs in the verdict (the rows carry stage, lines
and failures); parallel plays; a gate of a working tree that is not committed.

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component gate --component cli --judge \
  --checks decks/p22a/checks.json \
  --only stub-verdict,gate-plan,play-gate,gate-command,parse-command,stub-verdict-judge,gate-plan-judge,play-gate-judge,gate-command-judge,parse-command-judge \
  --out decks/p22a/deck.json
python3 decks/tools/scale_tokens.py decks/p22a/deck.json 3         # processor ds
node dist/cli.js deck check --root . --deck decks/p22a/deck.json   # errors 0 (builds over decks/p22a/_stubs)
rm -rf /tmp/v2bin-p22a && mkdir -p /tmp/v2bin-p22a && cp -r dist /tmp/v2bin-p22a/ && ln -s $PWD/node_modules /tmp/v2bin-p22a/node_modules \
  && ln -s $PWD/templates /tmp/v2bin-p22a/templates
node /tmp/v2bin-p22a/dist/cli.js run --root . --deck decks/p22a/deck.json --processor ds --deadline 7200
```

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 10 (5 code, 5 judges) / 4: [gate-plan, parse-command, stub-verdict] [gate-plan-judge, parse-command-judge, play-gate, stub-verdict-judge] [gate-command, play-gate-judge] [gate-command-judge] |
| executor bill | ≈ $0.25–0.40 on ds ×3 (P21c: 10 cards $0.4484 over two runs); ≤ $0.70 with a fix; cap $5 |
| cards with regeneration | 1–3 of 10 (parse-command: three whole files, the gate check's place; play-gate: the clone and the exclude, the seconds rounding; gate-command: the error texts' order; judges: a repository not committed before the play, a test without the 120000 timeout) |
| tests after the run | 876 ± 6 in 146 files |
| first red | stub-verdict: the header line counted as a failure, outside lines trimmed; gate-plan: retries for a one-card generation, the transaction's puts on every step; play-gate: a worktree instead of a clone, the link not excluded, seconds not rounded; gate-command: builds run on root, `_stubs` not put back |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no answer cut at its `max_tokens`; (3) after the run no
file outside §2.3's twelve changed; (4) every cut byte for byte; (5) this repository's HEAD and refs unchanged by every
card; (6) after the merge `morph gate` with the run's binary exits 2 on go-p7b `deck.p21.json` naming the retry of
control-contract-judge at `supervisor/guard.go:20:23`, 0 on `deck.p21c.json`, and on this phase's own deck reproduces §11's
gate (stubs red at their stage, references green, chains < 250 s); (7) no P7b / go-p7b / ts-rename name in `src/` (grep).

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the MEASURE row
with its `прогоны` cell, the vitest log of every verify run; DECISIONS lines "P22a gate"; after the merge the byte identity
re-cuts against main's binary, claims 6 and 7 (the dogfood gate); then P22b.

## 11. Actual

### Gate (preparation)

09.10, on the VPS, by the preparing orchestrator (Opus 5.5, fresh context, no sub-agents); no paid run, no model call.

The deck **cut by V2** (main's binary, f214357 code; data 5ff996f, 75880f4, 1c8bc70): `plan --component gate --component
cli --judge --checks decks/p22a/checks.json --only <the 10 ids>` **exit 0**, 10 cards, generations `[gate-plan,
parse-command, stub-verdict] [gate-plan-judge, parse-command-judge, play-gate, stub-verdict-judge] [gate-command,
play-gate-judge] [gate-command-judge]`, every acceptance with the transaction mark; `scale_tokens.py … 3` (maxTokens:
gate-plan, stub-verdict 24 000; play-gate, gate-command 36 000; parse-command 84 000; gate-plan-judge, parse-command-judge,
stub-verdict-judge 48 000; play-gate-judge, gate-command-judge 72 000); `deck check` **0 errors, 0 warnings, 0 hazards,
builds 10 trees over `decks/p22a/_stubs/` (12 stubs each), 0 breaks, 0 missing** (85 s). Slices (slice + existing
targets): 41.6–71.5 KB, the largest parse-command **71 495 B** (three whole cli files); ≈ 75 KB with the instruction. Deck
337 624 B.

**Played by hand** (the tool exists after the run): the reference `morph gate` of this preparation (`src/gate/*` and the
cli patch in a scratch, never committed; the same code as `/tmp/p22/refs`), with a log dump added for this play only, on
the committed deck: `gate --root . --deck decks/p22a/deck.json --stubs decks/p22a/_stubs --refs /tmp/p22/refs`, a shared
clone of 1c8bc70, 24.0 min wall; plus `decks/tools/stubcheck.mjs` on every stub log.
- **Stubs red per example at the expected stage (19/19)**, typed throwing stubs (`stub gatePlan [8,4,…]`, `stub
  stubVerdict …`, `stub playGate …`, `stub gateCommand …`; parse-command's stubs are main's files): gate-plan 4/4,
  stub-verdict 4/4, play-gate 4/4, gate-command 4/4 (the verdict's `failures`: 4 FAIL lines each), parse-command 3/3; the
  five judges red at `== guard <file>` (one-test stubs: "has 1 test/it calls, expected 3..9"). **stubcheck.mjs exit 0 on
  all 10 stub logs**; the verdict's stub rows all ok, no outside line. Stub chains 9.9–13.1 s.
- **References green, chain seconds** (limit 250): gate-plan 135.1, parse-command 133.8, stub-verdict 136.0, gate-plan-judge
  135.1, parse-command-judge 137.5, play-gate 132.6, stub-verdict-judge 131.2, gate-command 147.6, play-gate-judge 132.6,
  gate-command-judge **152.2** — **max 152.2 s**. The tool caught the preparation's own reference judge for gate-command
  red at its guard (`own stub "fake" (stubs come from tests/helpers.ts)`, a variable of a probe row copied into it): the
  reference renamed (the deck unchanged), its acceptance re-run alone in a clone of 1c8bc70: exit 0, 152.2 s. Final tree
  `vitest run` **881 / 881 in 146 files** (862 + the reference judges' 19), 120 s; **ripple 0 of 862**; `git status` of the
  repository untouched, no scratch or worker left.
- **Test time** (§2.2 "Test time"): the first example set (go-p7b transaction/planted/outside plays and ts-rename's TS play)
  made the full suite 204 s (100 s without the gate files) and every chain > 250 s; the examples were cut to one real Go
  play before the gate: full suite 120 s.
- **Mutants** (the changed contracts only; reviewer's `planMutants` over the reference targets, each against its card's
  probe under a 120 s subprocess timeout): **30 mutants** (6 stubVerdict.ts, 6 gatePlan.ts, 6 playGate.ts, 8
  gateCommand.ts, 3 parse.ts, 1 main.ts), 32 runs, **3.1 min**, max 21.8 s, 0 timeouts; first pass 26 killed; two gaps got
  probe rows (gatePlan.ts:31 a target owned twice listed once; gateCommand.ts:125 Check Builds' missing/breaks as errors)
  and were killed on the re-run: **28 killed**; survivors: stubVerdict.ts:33 a skip joined by `&&` (equivalent: every
  fileLine is anchored on `^\S`), gateCommand.ts:25 the `ok: true` type literal (no runtime effect; tsc in the acceptance) —
  DECISIONS known risk.
- **Issue #13's planted defects and real decks, measured with the reference binary** (§1's table): go-p7b deck.p21.json
  code 2 naming the P21a smoke RED on the retry row; deck.p21c.json code 0; a green stub, a non-own build line and a
  caller outside the subset each named; ts-rename old cut code 2 (tsc lines), transaction cut code 0.
- **Byte identity baseline** (no planner or builder change): main's binary (f214357 code) — go-mini `--checks
  decks/m1/checks.json` **75 416 B**, the P15 re-cut from 0365336 (filter, ×3) **398 622 B, equal to the committed deck**,
  go-p7b without `--only` **100 388 B**; the session rechecks them with the run's binary.
- No `src/` file of the reference names P7b, go-p7b, ts-rename, supervisor or Resumes (grep).

**Forecast** on `ds` with every maxTokens × 3: P21c ran 10 cards for $0.3927 + $0.0557; here 15 first requests (5 code ×
2 variants + 5 judges), 42–75 KB in, answers 1.6–26 KB: **≈ $0.25–0.40**, ≤ $0.70 with a fix; ≤ $1. **Gate holds.**

**Deadline.** The first MorphV2 deck run as a transaction: the write phase is 4 generations of requests (≈ 4 × 8 min on
ds), then one round of 10 acceptances one after another (≈ 10 × 140 s ≈ 23 min), and each retry batch adds a generation
of requests and a full round (≈ 30 min): **`--deadline 7200`** (one write, one round, two retry batches); P21c's 2400 s
cut its last generation.

**Run command** (from the repo root, the binary copied first; the deck is already scaled ×3):

```
npm run build && rm -rf /tmp/v2bin-p22a && mkdir -p /tmp/v2bin-p22a && cp -r dist /tmp/v2bin-p22a/ && ln -s $PWD/node_modules /tmp/v2bin-p22a/node_modules && ln -s $PWD/templates /tmp/v2bin-p22a/templates
node /tmp/v2bin-p22a/dist/cli.js run --root . --deck decks/p22a/deck.json --processor ds --deadline 7200 > /tmp/p22a-run.json
```

**Post-run dogfood (the session, numbers into this section):** `node dist/cli.js gate --root . --deck decks/p22a/deck.json
--stubs decks/p22a/_stubs --refs <the run's 12 targets copied out of the run branch>` with the run's binary on main after
the merge: expected code 0, 20 rows, stubs 19/19 failures at their probes and the judges at their guards, max chain < 250 s;
and claim 6 on go-p7b.

### Run 20261009-153356 (ds, `--deadline 7200`) — RED, and the one fix

- **Run**: transaction 0/10, every target rolled back; 113 min, 34 requests (15 first + 19 retries), **$0.4599**; archive
  afb650a on main. Round 0 was red on two tsc lines (gateCommand.ts:174, a closure-narrowed `never`; the cli judge without
  its vitest import), both closed by their owners' retries; after that the reds were four judge tests, each failing every
  card's full stage, so Blame Log (no file line) retried all ten cards; five retries were cut at `max_tokens`; one request
  of gate-command-judge timed out in transport.
- **Classes** (the final tree rebuilt from the archive's answers passes all **19/19 probe tests**: no code defect):
  gate-command-judge DATA[spec] (+ ENV[transport] on r1) — the cut collapses the double space of `FAIL  probe/t1…` in the
  rendered example, the judge typed one space against a two-space fixture; play-gate-judge DATA[record] — the record's
  Play Gate 1 said `git log --format=%s` where the probe and fixture used `git log -3` (tmpRepo's "init" commit);
  gate-plan-judge DATA[spec] (+ FIX[budget], r2 cut at 48 000) — the step order "per its entries {stub} then {ref}" read
  as every stub first; parse-command-judge DATA[spec] — examples.json's Main 17 prose parsed as argv (`unknown flag:
  --deck,`); play-gate (r1) and gate-command (r2) FIX[budget]; stub-verdict, stub-verdict-judge, gate-plan,
  parse-command: rolled back with the transaction, no fault of their own.
- **The one fix (P1b pattern, 1b6ba63; instructions unchanged)**: record — Play Gate 1 and Gate Command 2 echo `FAIL
  probe/…` with one space, Play Gate 1 says `git log -3`, Gate Plan's order worded "two steps in a row per entry … never
  every stub first"; fixtures gateCommand.json "tx"/"planted" and playGate.json "shell" with one space; probes likewise;
  §2.1 "Literals and whitespace" and the Main 17 skeleton (examples.json is prose); §2.2 Gate Plan bullet; checks
  `fullExclude` = the five judge files (a judge's red no longer retries the other nine cards); morph-map.json max_tokens
  ×2 for gate-plan-judge (32 000), play-gate and gate-command (24 000).
- **Fix deck** `decks/p22a/deck-fix.json` (same `--only`/`--checks`, ×3: gate-plan-judge 96 000, play-gate and
  gate-command 72 000, the rest unchanged): plan exit 0, deck check **0 errors, 0 warnings, 0 hazards, builds 0 breaks / 0
  missing**; slices ≤ 79.2 KB.
- **Re-gate** (every acceptance changed: fullExclude), played by a `morph gate` built from the run's own generated code
  (the archive's last answers, never committed), references = those code files + the probes as reference judges, on
  1b6ba63: **exit 0, errors []**; stubs 19/19 red at the probe (failures 4, 3, 4, 4, 4), judges at the guard;
  **stubcheck.mjs exit 0 on 10/10 stub logs**; references 10/10 green, chains 109.0–130.8 s, **max 130.8 s**; 22.7 min.
  Mutants not re-run: the contracts are unchanged (two probes changed an echoed literal only).
- **Forecast**: the first 15 requests of the red run cost $0.147; with the budget raised and the blame contained ≈ $0.20–0.35,
  ≤ $0.60 with retries. **Deadline**: `--deadline 7200` (the red run used 6780 s with 19 retry requests).

### Fix run 20261009-175810 (ds, `--deadline 7200`) — RED, emergency stop

- `decks/p22a/deck-fix.json`, 20 requests, **$0.1752**, 42.8 min, exit 1. Nine cards green; the transaction rolled
  everything back ("transaction rolled back"), so nothing is committed. Retries won: gate-plan-judge, gate-command,
  gate-command-judge (r1). The blame containment held: no shared red retried the other cards.
- **parse-command-judge red after the one fix** (v1 and r1 at `== own`, 5 of 6 tests green): its own test calls
  `parseCommand(["deck check", "--deck", "d.json", "--stubs", …])` — `"deck check"` as ONE argv element — and expects
  `flag --stubs does not apply to deck check`; the code answers `unknown command: deck check`, which is right for
  that argv. DATA (a judge's invented assumption, issue #13 "not in scope": stubs and mutants test probes, not those).
- **Emergency stop** (AUTONOMY "Failure"): issue #15 (label `debt`). The debt is not paid: on a transaction deck the
  nine green cards were rolled back with the judge, and the judge's acceptance needs parse-command's code on the tree,
  so `morph accept --commit` of the judge alone cannot be green — a gap of the regulation, for the operator.
- Phase spend $0.6351 (0.4599 + 0.1752); orchestrator opus55 prep 476k/166/106 min + fix 514k/27/29 min.
- **Not done**: the dogfood re-play of this deck by the run's `morph gate` (no run code on main); the merge.

### Salvage (operator 09.10, one-off, issue #15) — GREEN, 10/10 on a local branch

No live run, no processor call: the answers the fix run 20261009-175810 accepted, applied by V2's own `parseAnswer` (the
run's dist `/tmp/v2bin-p22a`) and written as `writeAnswerFiles` does, each card committed by `morph accept --root .
--deck decks/p22a/deck-fix.json --id <card> --model deepseek/deepseek-v4.1-flash --commit` (exit 0, every stage green).
- **Order = the imports, not the generations** (the first attempt in generation order was red at parse-command, TS2307 on
  `../gate/gateCommand.js`): on `salvage/p22a-2` from 48ff572 — gate-plan (v1; 72e9b2b cherry-picked clean → 065fea3),
  stub-verdict v1 b9a38ed, play-gate v1 00e48da, gate-command r1.v1 ebad726, parse-command v1 6f64d64, gate-plan-judge
  r1.v1 194529d, stub-verdict-judge v1 3ccfe58, play-gate-judge v1 88665c7, gate-command-judge r1.v1 7780568; 112–134 s
  per acceptance. Variant = the run's accepted one (`answers/lines.txt`; r1 where the run took 2 attempts).
- **Debt** parse-command-judge paid by Fable 5.1 xhigh (`morph-fable-debt`, ≈ 5.3 min, 113k tokens, 17 tool calls): only
  `tests/cli/gate.examples.test.ts`, 7 tests (Parse Command 23 with all ten argv split per word, Main 17 verbatim, 5 own on
  §2.2's rows), no defect found in other code; `accept --model claude-fable-5-1 --commit` exit 0 → 1cee67d.
- Every salvage commit carries `Morph-Debt: true` (accept's own trailer).
- **Verify** on 1cee67d: `git status` clean; `tsc --noEmit` 0 lines; `eslint src tests` exit 0; **vitest 895 / 895 in
  146 files** (126.7 s; 862 + the judges' 33); `npm run build` exit 0. Own read of the 7 code targets against §2.2: Stub
  Verdict, Gate Plan (two steps in a row per entry, retries after a generation of ≥ 2, transaction rounds), Play Gate
  (shared clone, node_modules link + info/exclude, rows, scratch commit, finally), Gate Command (errors in §2.2's order,
  code 2/0, `_stubs` kept aside and put back) and the cli patch (value flags, arity 1, missing --stubs/--refs after
  missing --deck, routing with readDeckFile/checkBuilds) as written; **no defect found**.
- **Byte identity** (binary built from 1cee67d, `/tmp/v2bin-p22a-salvage`, vs the run's `/tmp/v2bin-p22a`): go-mini
  `--checks decks/m1/checks.json` **75 416 B identical**; the P15 re-cut from 0365336 (filter, ×3) **398 622 B identical,
  equal to the committed deck**; go-p7b without `--only` **100 388 B identical**.
- **Dogfood not played**: `morph gate` on deck-fix.json measured 22.7 min at the re-gate (24.0 min at the gate), over this
  session's 10 min budget; left to P22b's gate (issue #13).
- Phase spend unchanged $0.6351; orchestrator opus55 salvage ≈ 130k/45/45 min; Fable debt on the subscription.
