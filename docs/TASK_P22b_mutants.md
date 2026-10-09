# TASK_P22b — `morph gate`, part b: the mutants inside the gate and the byte-identity corpus (`src/reviewer/runMutants.ts`, `src/gate/{gateMutants,identity,playGate,gateCommand}.ts`, `src/cli/{types,parse}.ts`)

> Phase P22b of `docs/PLAN.md` (issue VasyaLutiy/morph#13 items 2 and 3, label `P22-gate`), operator 09.10. **Not split**:
> both required items fit **10 cards, 4 generations** (5 code cards, 5 judges; ≤ 12 cards, forecast ≤ $1). Code cards in
> **review-session** (Run Mutants gains a stop time), the NEW Component **gate-proof** (Gate Mutants, Check Identity; layer
> gate, `src/gate/`), **gate** (Gate Command and Play Gate's `after`, one card) and **cli** (Parse Command: `gate
> --mutants <n>`). P22c (the optional items 4 and 5) stays queued (§7). One gate (≤ $1, slices ≤ 200 KB, chains < 250 s,
> §11).

## 1. Why this

- **Mutants are the last hand step of the gate.** From the P22a merge on `morph gate` plays stubs, references, retries,
  stubcheck and Check Builds; the mutants stayed a hand script per phase (AUTONOMY step 1): P15 a 72-min campaign, P21c
  29 mutants / 1.4 min after two passes, P22a 30 mutants / 32 runs / 3.1 min written as one more throwaway script. Issue
  #13 item 2: "The hand-written mutants.py goes away".
- **Byte identity is re-done by hand twice per phase.** P19a–P22a each re-cut go-mini, P15 at 0365336 and go-p7b with two
  binaries and compared by `cmp` (`/tmp/p21c-scratch/ident.sh`, 24 lines, rewritten per phase). Measured here with
  main's binary (0ded27b): the five cuts of the corpus take **2.0 s** in-process including the shared clones, so the
  identity can live in the suite.
- **Measured with the reference code of this phase** (a scratch clone, never committed; §11): the mutant phase of a
  one-card shell deck plays in < 1 s with 3 mutants (1 killed, 2 survivors named by card, file, line, column); the
  corpus test is 2.1 s; the new tests together 4.1 s; ripple §11.
- **Size.** Reference: runMutants.ts 2 992 → 4 251 B (a second export), gateMutants.ts 4 080 B NEW, identity.ts 2 896 B
  NEW, playGate.ts +4 lines, gateCommand.ts +61 lines, parse.ts +9 lines, types.ts +1 field.
- **Record sizes** (bytes of each Component block, P22a's measure): gate 18 859 → **22 454**; gate-proof NEW **9 857**
  (gate alone would be 31 640 B: the 30 KB rule); review-session 12 638 → **14 300**; cli 29 915 → **29 997** (the
  Command schema's spaces inside braces and around `|` dropped, two clauses shortened; no rule removed).

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main** (module → what the new code calls or constructs): `src/reviewer/planMutants.ts` —
  `planMutants(path, text, limit)` → `Mutant[]` ({path, line, column, rule, text}; spread inside one file when more than
  limit; skips comment, import and export-list lines; the 12 MUTATION_RULES: `===`, `!==`, ` <= `, ` >= `, ` < `, ` > `,
  ` + `, ` - `, `&&`, `||`, `true`, `false`); `src/reviewer/runMutants.ts` — `runMutants(input)`, `MutantsInput`
  {root, command, mutants, timeoutMs, env}, `MutantsResult` {baseline, results, findings}, `MutantResult`,
  `baselineFinding`, `survivorFinding`, `DEFAULT_MUTANT_TIMEOUT_MS = 120000`; `src/acceptance/run.ts` —
  `runAcceptance(command, root, {env, timeoutMs?})` → {exit, log, timedOut} (a timeout is exit null);
  `src/acceptance/snapshot.ts` — snapshotTargets, restoreSnapshot; `src/language/paths.ts` — `profileForPath(path)` →
  LanguageProfile | null, `isTest(profile, path)`; `src/git/run.ts` — `gitOk(root, args, env)` → stdout, throws `git
  <args[0]> failed (exit <n>): <first stderr line>`; `src/cards/types.ts` — `Card` (every field); `src/gate/playGate.ts`
  — `PlayRow`, `PlayDeps`; `src/gate/gateCommand.ts` — `GateArgs`, `GateDeps`, `GateDocument`, `gateCommand`;
  `src/cli/main.ts` — `main(argv, deps, io)` → Promise<ExitCode>; `src/cli/parse.ts` — `parseCommand(argv)`.
- **Preconditions of the callees.** acceptance · every builder acceptance holds its full suite on ONE line that starts
  `echo '== full'; ` (TypeScript `compose.ts`, Go `goAcceptance.ts`): `tests/fixtures/builder/code1.txt` (46 lines
  by split("\n")) and `builder/go/code1.txt` (33) hold one each. acceptance · Run Acceptance runs `/bin/sh -c <text>`
  without `set -e`: a red stage stops the shell only through its own `|| exit 1` / `|| { …; exit 1; }`. git · `git
  clone --shared --no-checkout` of a clone works (the alternates chain): the gate's scratch and this repository both hold
  the corpus commits (0ded27b, 0365336, 1912747, 1c8bc70; full shas in the corpus). planner · `plan --checks` needs
  `decks/tools/guard.mjs` and `decks/tools/firstdiff.mjs` in the tree it cuts (exit 4 "guard file not found: …" without
  them): a Go fixture tree gets `decks/tools/goguard.mjs` and `gofirstdiff.mjs` of the same commit installed under those
  names (`install`). language · `.ts`, `.go`, `.py` have profiles; `tests/…`, `*.test.ts`, `*_test.go` are tests; `.md`
  has no profile.
- **Fixtures** (`tests/fixtures/`), each by the type the Function takes:

| file | type | what it is | what the Function returns on it |
|---|---|---|---|
| `reviewer/untried.json` (NEW) | ONE object "stop", "zero", "red" → TimedMutantsResult | the results of Run Mutants 5 | Run Mutants 5 |
| `gate/mutantFiles.json` (NEW) | ONE object path → text (5 files) | the `read` of Gate Mutants 2: src/a.ts = H, tests/a.test.ts, src/b.ts = 40 lines `export const v<i> = (x: number): boolean => x === <i>;`, docs/x.md, lib/q.go (one `&&`, one ` > `) | Gate Mutants 2 |
| `gate/gateMutants.json` (NEW) | ONE object name → spot list or Gate Mutants | "only a" (3 spots), "two" (2), "cap" (30), "run", "stop", "baseline", "timeout" | Gate Mutants 2, 3 |
| `gate/gateCommand.p22b.json` (NEW) | ONE object name → {code, document} | "mutants", "one", "off", "stopped", "ref red", "baseline" | Gate Command 4, 5 |
| `identity/corpus.json` (NEW) | ONE ARRAY of 5 Identity Entries | the corpus (§2.2 Check Identity) | Check Identity 1–3 |
| `cli/parseArgv.json`, `cli/parse.json` (key "24" added) | ONE object | 10 argv lists and their results | Parse Command 24 |
| `builder/code1.txt`, `builder/go/code1.txt` (existing) | text | a TypeScript and a Go code card's acceptance | Gate Mutants 1 |

- **The text H** (one line, no run of two spaces): `export const h = (a: number, b: number): boolean => a === b && a > 0;\n`
  — Plan Mutants gives 3 mutants on line 1: column 55 "=== → !==", 61 "&& → ||", 66 "> → >=". A command `grep -q "a ===
  b" <file>` kills the first only.
- **Parse Command 24's argv, per word** (each a JSON array; `parseArgv.json["24"]` holds them in this order):
  1. `["gate", "--deck", "d.json", "--stubs", "s", "--refs", "r", "--mutants", "30"]` → ok, `{name: "gate", root: ".", pretty: false, deck: "d.json", stubs: "s", refs: "r", mutants: 30}`
  2. `["gate", "--mutants", "5", "--refs", "r", "--stubs", "s", "--deck", "d.json", "--root", "/w", "--pretty"]` → ok, root "/w", pretty true, mutants 5
  3. `["gate", "--deck", "d.json", "--stubs", "s", "--refs", "r", "--mutants", "0"]` → `--mutants must be a positive integer (got '0')`
  4. `["gate", "--deck", "d.json", "--stubs", "s", "--refs", "r", "--mutants", "x7"]` → `--mutants must be a positive integer (got 'x7')`
  5. `["gate", "--deck", "d.json", "--mutants", "3"]` → `missing --stubs`
  6. `["gate", "--deck", "d.json", "--stubs", "s", "--refs", "r", "--mutants"]` → `flag --mutants needs a value`
  7. `["gate", "--deck", "d.json", "--stubs", "s", "--refs", "r", "--mutants", "2", "--mutants", "3"]` → `flag --mutants given twice`
  8. `["gate", "--deck", "d.json", "--stubs", "s", "--refs", "r", "--mutant-timeout", "9"]` → `flag --mutant-timeout does not apply to gate`
  9. `["review", "a", "b", "--mutants", "0"]` → `--mutants must be a positive integer (got '0')` (review unchanged)
  10. `["gate", "--deck", "d.json", "--stubs", "s", "--refs", "r"]` → ok, the P22a command, NO key mutants
  Every failure is `{ok: false, error: {error: {code: 4, kind: "UsageError", message}}}`.
- **Harness skeletons** (only `tests/helpers.ts`, node:fs, node:path, node:child_process for `git status` and the
  modules named):

```ts
// shared
const H = "export const h = (a: number, b: number): boolean => a === b && a > 0;\n";
const env = (): Record<string, string> => ({ PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" });
const clock = (step: number): (() => number) => { let t = 0; return () => (t += step); };   // first call returns step
// a Card has EVERY field (loadDeck refuses a missing one); a deck file is a top-level JSON ARRAY of such cards
const card = (id: string, targets: string[], acceptance: string | null = null): Card => ({ customId: id, intent: "generate", targets,
  contextSlice: [], instruction: "w", acceptance, model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn: [] });
// Run Mutants 5: base = {root: r.root, command: 'grep -q "a === b" lib/h.ts', mutants: planMutants("lib/h.ts", H, 10),
//   timeoutMs: 5000, env: {PATH}}; runMutantsUntil({...base, now: clock(1000), stopAt: 2500}) → untried.json "stop";
//   stopAt 0 → "zero"; {...base, command: "exit 3", now: () => { calls += 1; return 0; }, stopAt: 99} → "red", calls 0
// Gate Mutants
const spots = (l: GateMutant[]): GateMutantSpot[] => l.map((g) => ({ card: g.card, path: g.mutant.path, line: g.mutant.line, column: g.mutant.column, rule: g.mutant.rule }));
const read = (t: string): string | null => (fixtureJson("gate/mutantFiles.json") as Record<string, string>)[t] ?? null;
// Gate Command 4, 5: one committed tmpRepo per acceptance (the gate plays HEAD)
const A = "echo '== probe'\ngrep -q 'a === b' src/a.ts || { echo 'FAIL probe/a.probe.ts > A example 1'; exit 1; }\necho '== full'; true";
function repo(acceptance: string, ref: string): TmpRepo { const r = tmpRepo(); r.write("d.json", JSON.stringify([card("a", ["src/a.ts"], acceptance)], null, 2) + "\n");
  r.write("s/src/a.ts", "s\n"); r.write("f/src/a.ts", ref); r.git(["add", "-A"]); r.git(["commit", "-q", "-m", "base"]); return r; }
const deps = (extra: Partial<GateDeps> = {}): GateDeps => ({ env: env(), now: clock(1000), readDeck: readDeckFile, builds: checkBuilds, ...extra });
const args = { deck: "d.json", stubs: "s", refs: "f" };     // + mutants: 30 | 1; none for "off"
// Check Identity: the repository itself is the root (the corpus pins its commits)
const ROOT = path.resolve(fixturePath("."), "..", "..");
const corpus = (): IdentityEntry[] => fixtureJson("identity/corpus.json") as IdentityEntry[];
const plan = (argv: string[]): Promise<number> => main(argv, { env: env(), now: () => 0, cwd: "/", transport: null }, { stdout: () => {}, stderr: () => {} });
const goMini = (): IdentityEntry => corpus().filter((e) => e.name === "go-mini")[0];
// "a changed planner output": plan: async (argv) => { fs.writeFileSync(argv[argv.indexOf("--out") + 1], "x\n"); return 0; }
// every test that runs a child process: test(name, fn, 120000); every root or repo: try { … } finally { r.rm(); }
```

**Literals and whitespace** (P22a's lesson): no example literal of this record holds two spaces in a row (H is one line;
Gate Mutants 1's indented full line has ONE leading space); an example's acceptance is typed exactly as the record shows.

**Distinct markers.** Card ids a, b, d, f, j; files src/a.ts, src/b.ts, src/c.ts, src/f.ts, lib/h.ts, lib/q.go,
docs/x.md, tests/a.test.ts, tests/j.examples.test.ts, full.txt, ok.txt; exit 7 (a full line that would kill everything),
exit 3; stopAt 2500, 0, 99; stopSeconds 3, 0; timeoutMs 5000, 400. No name of a phase, of go-mini, go-p7b, ts-rename or
of a fixture card is in any `src/` file: the corpus is data in `tests/fixtures/identity/`.

### 2.2. OUTPUT data shapes

**`src/reviewer/runMutants.ts`** (PATCH; layer reviewer; no Node module) — **Run Mutants** gains a stop time:

```ts
export interface MutantSpot { path: string; line: number; column: number; rule: string }
export interface TimedMutantsInput extends MutantsInput { now: () => number; stopAt: number }
export interface TimedMutantsResult extends MutantsResult { untried: MutantSpot[] }
export async function runMutantsUntil(input: TimedMutantsInput): Promise<TimedMutantsResult>;
```

- `runMutants` keeps its contract and its three keys exactly (P14b's tests compare it whole).
- runMutantsUntil: the baseline always runs (no now() call before it); a red baseline → results [], findings [the
  baseline finding], untried = every mutant's spot in order, now() never called. Else per mutant in order: once one is
  untried every later one is untried with no now() call; else `now() >= stopAt` → untried (nothing written, nothing
  run); else it runs exactly as in runMutants (snapshot, write, run, restore; result; a survivor's finding).

| example | given | result |
|---|---|---|
| Run Mutants 5 | lib/h.ts = H, 3 mutants, grep command, clock(1000); stopAt 2500; stopAt 0; exit 3 with a counting now | untried.json "stop" (2 results: killed 55, survived 61; untried [66]); "zero" (untried all 3); "red" (baseline {3, false}, untried all 3, 0 calls); runMutants' keys [baseline, results, findings] |

**`src/gate/gateMutants.ts`** (NEW; Component gate-proof, layer gate; imports language's paths, the reviewer's
planMutants and runMutants, the Card and Mutant types; no Node module) — **Gate Mutants**:

```ts
export const MUTANT_CAP = 30;
export const MUTANT_STOP_SECONDS = 1200;
export interface GateMutant { card: string; mutant: Mutant }
export interface GateMutantSpot { card: string; path: string; line: number; column: number; rule: string }
export interface GateBaseline { card: string; exit: number | null; timedOut: boolean }
export interface GateMutants { planned: number; tried: number; killed: number; timedOut: number; seconds: number;
  survivors: GateMutantSpot[]; untried: GateMutantSpot[]; baselines: GateBaseline[] }
export interface GateMutantDeps { env: Record<string, string>; now: () => number; timeoutMs?: number; stopSeconds?: number }
export function killCommand(acceptance: string): string;
export function planGateMutants(cards: readonly Card[], read: (target: string) => string | null, cap: number): GateMutant[];
export async function runGateMutants(root: string, cards: readonly Card[], planned: readonly GateMutant[], deps: GateMutantDeps): Promise<GateMutants>;
```

- killCommand: `acceptance.split("\n")` without every line whose `trimStart()` starts with `echo '== full'`, joined by
  "\n" (`echo '== fully'` is kept: the quote must follow "full").
- planGateMutants: n = Math.min(cap, MUTANT_CAP); n ≤ 0 → []. Per card in order, per target in order, each path once
  (a path a second card also targets belongs to the first): profileForPath null or isTest → skipped; read null →
  skipped; each of planMutants(target, text, n) → {card: customId, mutant}. ≤ n in all → all; else entry
  `all[Math.floor((i * all.length) / n)]` for i = 0 … n−1 (the reviewer's spreadMutants).
- runGateMutants: start = now(); stopAt = start + (stopSeconds ?? MUTANT_STOP_SECONDS) × 1000; planned grouped by card in
  first-seen order; per group: card missing → every spot into untried with no now() call; else one now() call, ≥
  stopAt → every spot into untried; else
  runMutantsUntil({root, command: killCommand(acceptance ?? ""), mutants, timeoutMs: timeoutMs ??
  DEFAULT_MUTANT_TIMEOUT_MS, env, now, stopAt}); baseline exit ≠ 0 → {card, exit, timedOut} into baselines; per result
  tried + 1; killed → killed + 1 and, when timedOut, timedOut + 1; not killed → its spot into survivors; its untried into
  untried. seconds = Math.round((now() − start) / 100) / 10 (one last now() call). Keys in the interface's order. With
  clock(1000) and one group of 3 mutants: start 1000, group 2000, three mutant checks 3000–5000, end 6000 → seconds 5.

| example | given | result |
|---|---|---|
| Gate Mutants 1 | killCommand of builder/code1.txt, builder/go/code1.txt; `"a\n echo '== full'; x\nb\necho '== fully'"` | 45 and 32 lines (the one full line gone); `"a\nb\necho '== fully'"` |
| Gate Mutants 2 | mutantFiles.json; cards a, b, j, d; cap 30 (a alone), 2, 99, 0 | gateMutants.json "only a" (3), "two" ([a 1 55 ===], [b 21 46 ===]), "cap" (30: 99 capped; src/a.ts once; no test, no .md; last [d lib/q.go 2 39 &&]); [] |
| Gate Mutants 3 | src/f.ts = H; card f with a full line `exit 7`; clock(1000), timeoutMs 5000; stopSeconds 3; a red killer `test -f ok.txt`; a sleeping killer at timeoutMs 400 | "run" (1 killed, 2 survivors, seconds 5); "stop" (1 tried, 2 untried, seconds 4); "baseline" (baselines [{f, 1, false}], 3 untried, seconds 2); "timeout" (killed 1, timedOut 1, 2 survivors); src/f.ts is H |

**`src/gate/identity.ts`** (NEW; Component gate-proof, layer gate; node:crypto, node:fs, node:os, node:path, git's
gitOk) — **Check Identity**:

```ts
export interface IdentityEntry { name: string; commit: string; dir: string; install: Record<string, string>; argv: string[]; bytes: number; sha256: string }
export interface IdentityRow { name: string; code: number; bytes: number; sha256: string; ok: boolean }
export interface IdentityDeps { env: Record<string, string>; plan: (argv: string[]) => Promise<number> }
export interface IdentityResult { rows: IdentityRow[]; errors: string[] }
export async function checkIdentity(root: string, entries: readonly IdentityEntry[], deps: IdentityDeps): Promise<IdentityResult>;
```

- base = `fs.mkdtempSync(path.join(os.tmpdir(), "morph-identity-"))`; one clone per distinct commit in first-seen order:
  `base/c<k>` (k = 0, 1, …), `gitOk(root, ["clone", "-q", "--shared", "--no-checkout", root, clone])`, `gitOk(clone,
  ["checkout", "-q", "--detach", commit])` (a failure throws gitOk's error, the promise rejects).
- Per entry i: tree = path.join(clone, dir); per install entry [dest, source] in key order: clone/source copied to
  tree/dest (parents created); out = base/out-<i>.json; code = await deps.plan([...argv, "--root", tree, "--out", out]);
  out exists → bytes = its length, sha256 = `crypto.createHash("sha256").update(bytes).digest("hex")`; else 0 and "".
  Row keys in the interface's order; ok = code === 0 && bytes === entry.bytes && sha256 === entry.sha256.
- errors in entry order: code ≠ 0 → `<name>: plan exit <code>`; else not ok → `<name>: <bytes> B, sha256 <sha256 first
  12>; the corpus has <entry.bytes> B, sha256 <entry.sha256 first 12>`.
- `finally` base removed; root never written.
- **The corpus** (`tests/fixtures/identity/corpus.json`, data of this phase; cut by main's binary at 0ded27b, the raw
  `plan --out` file, no filter, no ×3):

| name | commit | dir | install | argv after "plan" | bytes |
|---|---|---|---|---|---|
| go-mini | 0ded27b | tests/fixtures/go-mini | guard.mjs ← goguard.mjs, firstdiff.mjs ← gofirstdiff.mjs | `--component calc --component report --judge --checks decks/m1/checks.json` | 75 416 |
| go-p7b | 0ded27b | tests/fixtures/go-p7b | the same | `--component control --component supervisor --component daemon --judge --checks decks/b1/checks.json` | 100 388 |
| p15 | 0365336 | . | — | the P15 cut (6 Components, `--checks decks/p15/checks.json`; 12 cards after its filter) | 1 247 586 |
| p21c | 1912747 | . | — | the P21c `--only` cut (10 ids) | 362 610 |
| p22a | 1c8bc70 | . | — | the P22a `--only` cut (10 ids); ×3 it equals the committed decks/p22a/deck.json | 337 622 |

Every argv starts `["plan", "--spec", "contour.yaml", "--map", "morph-map.json", …]`. P21c's committed deck was cut by the
pre-P21c binary (no transaction mark); the corpus pins main's output, not the committed file.

| example | given | result |
|---|---|---|
| Check Identity 1 | ROOT, the corpus, the real plan | 5 rows ok, the corpus's bytes and sha256, errors []; git status unchanged |
| Check Identity 2 | go-mini; plan writes "x\n"; plan resolves 2 | {go-mini, 0, 2, 73cb3858a687…, false} + its error; {go-mini, 2, 0, "", false}, "go-mini: plan exit 2" |
| Check Identity 3 | go-mini with install {}; commit 0…0 (40 zeros) | {go-mini, 4, 0, "", false}, "go-mini: plan exit 4"; rejects "git checkout failed (exit …" |

**`src/gate/playGate.ts`, `src/gate/gateCommand.ts`** (PATCH, one card) — **Play Gate** (`after`), **Gate Command**:

- playGate.ts: `PlayDeps` gains `after?: (scratch: string, rows: readonly PlayRow[]) => Promise<void>`; after the last
  step `if (deps.after !== undefined) await deps.after(scratch, rows);`, then the rows are returned; the finally removes
  base as before. Nothing else changes.
- gateCommand.ts: `GateArgs` gains `mutants?: number`; `GateDeps` gains `mutantTimeoutMs?: number; mutantStopSeconds?:
  number`; `GateDocument` gains `mutants?: GateMutants | null` (last). Imports MUTANT_CAP, planGateMutants,
  runGateMutants and the GateMutants type from "./gateMutants.js".
- args.mutants undefined → nothing changes: no after, the document has NO key mutants, the codes 0/2 as in P22a (the
  P22a examples and gateCommand.json stay byte for byte).
- args.mutants given and plan.missing empty → Play Gate's after(scratch, rows): planned = planGateMutants(deck.cards,
  read, Math.min(args.mutants, MUTANT_CAP)) with read(t) = the UTF-8 text of `path.join(refDir, t)` when a regular file,
  else null; every row with phase ref or retry ok → mutants = await runGateMutants(scratch, deck.cards, planned, {env,
  now, timeoutMs: deps.mutantTimeoutMs, stopSeconds: deps.mutantStopSeconds}); else mutants = {planned:
  planned.length, tried: 0, killed: 0, timedOut: 0, seconds: 0, survivors: [], untried: every planned spot, baselines:
  []}. plan.missing not empty → mutants null.
- errors: after every P22a error, per baseline `mutants <card>: ` + (`timed out` when timedOut, else `red (exit
  <exit>)`) + ` on its references without a mutant`.
- document: the P22a keys in their order, then `mutants` (only when args.mutants is given). code: errors → 2; else
  mutants not null with a survivor or an untried mutant → **1**; else 0.

| example | given | result |
|---|---|---|
| Gate Command 4 | repo(A, H), mutants 30; mutants 1; none; mutants 30 with mutantStopSeconds 0 | gateCommand.p22b.json "mutants" (code 1, survivors [a src/a.ts 1 61 &&], [a src/a.ts 1 66 >], seconds 5); "one" (code 0, planned 1, killed 1); "off" (code 0, no key mutants); "stopped" (code 1, untried 3, seconds 2); git status "" |
| Gate Command 5 | repo(A, g with `!==`), mutants 30; the acceptance whose own stage needs the full line's file | "ref red" (code 2, "ref a: red (exit 1) at probe", untried the 3 spots of g: 55 "!== → ===", 61, 66, seconds 0); "baseline" (code 2, "mutants a: red (exit 1) on its references without a mutant", baselines [{a, 1, false}]) |

**`src/cli/types.ts`, `src/cli/parse.ts`** (PATCH, one card) — **Parse Command**:

- types.ts: `GateArgs` gains `mutants?: number` (last). Nothing else.
- parse.ts: GATE_FLAGS gains "--mutants" (already a value flag); after gate's "missing --refs" check, a given --mutants
  not a positive integer (isPositiveInteger) → `--mutants must be a positive integer (got '<v>')` (review's message);
  the gate command is `{name, root, pretty, deck, stubs, refs}` plus `mutants: Number(v)` as the LAST key only when
  --mutants is given. main.ts is NOT changed: it passes the command to gateCommand as args, so mutants reaches it.

| example | given | result |
|---|---|---|
| Parse Command 24 | parseArgv.json["24"] (§2.1, per word) | parse.json["24"]: 2 gate commands with mutants 30 / 5; 7 errors; the plain gate command without the key |

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P22b gate"):

- **No split** · items 2 + 3 in 10 cards / 4 generations (≤ 12, forecast ≤ $1) · the operator's "split rather than
  narrow" applies above 12; P22c stays the optional items 4–5.
- **A surviving or untried mutant is code 1, not an error** · issue #13's acceptance "a deck with a planted defect fails
  the gate: … a surviving mutant. The verdict names the card and the line": code 1 is non-zero (the gate fails) and every
  survivor is a spot {card, path, line, column, rule}; it is not code 2 because the regulation keeps equivalent mutants
  (P21c, P22a: `&&`-joined skips, a type literal) as a known risk in DECISIONS that does not block — code 1 is the
  named, recorded outcome: the session reads `mutants.survivors`/`untried`, writes each as a known risk or a probe row,
  and the gate holds. A red baseline (the killer red on the references) is code 2: no mutant was judged.
- **Opt-in `--mutants <n>`** · without it the P22a command, document and codes stay byte for byte (gateCommand.json,
  parse.json "23" pinned whole); the regulation passes `--mutants 30`; a value above 30 is capped (MUTANT_CAP), never
  refused (the cap is the gate's, the flag is review's rule).
- **The killer** · the owner card's acceptance without its `== full` line · the full suite is the phase's ripple
  (§11's ripple step), not the mutant's; with it every mutant run is a 100–150 s chain (P22a's refs: 131–152 s) and
  30 mutants do not fit 20 min; without it the P22a hand runs took 3.1 min for 32 runs against the probe.
- **The owner** · a code file belongs to the first card that targets it, in deck order · one killer per file; a judge's
  test file is never mutated (isTest), a file with no language profile neither.
- **Where mutants run** · Play Gate's scratch after the last step (every reference committed there, the tree a run
  ends with), through a new optional `after` hook · one clone, no second checkout; only when every ref and retry row is
  green (a red reference makes every mutant meaningless: they are listed untried).
- **Stop time** · checked before each card's group and before each mutant; a started run is never cut (its 120 s
  timeout bounds it) · worst case 20 min + one 120 s run; Run Mutants keeps runMutants unchanged and adds
  runMutantsUntil (P14b's examples compare runMutants' result whole: a new key would redden them).
- **A baseline per card** · Run Mutants' own (one green run of the killer before its mutants) · catches a killer that
  needs the dropped full line (Gate Command 5 "baseline").
- **Identity corpus** · tree@commit in a shared clone of the root (no worktree), the Go tools installed from the same
  commit, the raw `plan --out` bytes and sha256 · cuts never depend on the working tree; a planner or builder change
  reddens the suite (the test runs the real Main); filter and ×3 are not the planner's.
- **Identity as a vitest, not `plan --regress`** · the issue allows either; a cli flag would push cli over 30 KB; the
  suite runs it in 2.1 s.
- **Where** · a NEW Component gate-proof in src/gate/ (layer gate) · gate with both Functions would be 31 640 B.
- **Layer gate** (decks/tools/guard.mjs, data of this phase) · gains the reviewer and node:crypto.
- **Deck** · an `--only` cut with `--checks` is a transaction deck (P21c): the run writes all ten cards, then runs every
  acceptance on the whole tree; a transaction has no clean debt path (#15: a red card rolls back its dependencies with
  it) — the session would salvage as P22a did: the archived answers accepted card by card in IMPORT order (run-mutants,
  check-identity, parse-command, gate-mutants, gate-command, then the judges), `morph accept --commit` each.

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/reviewer/runMutants.ts` | PATCH | probe only | NEW `tests/reviewer/runMutants.p22b.examples.test.ts` (Run Mutants 5) |
| `src/gate/gateMutants.ts` | NEW | probe only | NEW `tests/gate/gateMutants.examples.test.ts` (Gate Mutants 1–3) |
| `src/gate/identity.ts` | NEW | probe only | NEW `tests/gate/identity.examples.test.ts` (Check Identity 1–3) |
| `src/gate/playGate.ts`, `gateCommand.ts` | PATCH | probe only | NEW `tests/gate/gateCommand.p22b.examples.test.ts` (Gate Command 4–5) |
| `src/cli/types.ts`, `parse.ts` | PATCH | probe only | NEW `tests/cli/gate.p22b.examples.test.ts` (Parse Command 24) |

- Each judge: "<Function> example <n>: <what>", one per NEW example in record order (the earlier examples are already
  tested in their P14b/P22a files, which stay byte for byte), the skeleton's helpers, expected values from the named
  fixture; at most 6 own tests; every child-process test with timeout 120000.

### 2.4. What must not break

- Byte for byte: every file outside the 7 code targets and the 5 judge files — every other `src/` file (main.ts
  included), `tests/helpers.ts`, every existing test file, `contour.yaml`, `morph-map.json`, `docs/`, `decks/`,
  `tests/fixtures/`, `templates/`.
- Every cut byte for byte (no planner or builder change): go-mini 75 416 B, P15 398 622 B (filter, ×3), go-p7b
  100 388 B — and now the corpus test itself.
- 895 tests in 146 files green on main; after the run **895 + 1 + 3 + 3 + 2 + 1 = 905** in 151 files (± the judges'
  own).

## 3. Acceptance

Built by `morph plan --checks decks/p22b/checks.json`, narrow to broad, every stage printing `== <stage>`. `ownGit:
true`, `frozen` the defaults + `templates`; `fullExclude` = the five new judge files (P22a's blame containment: a judge's
red stays its own). Every acceptance carries the transaction mark (an `--only` cut).

Code cards: `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs src <targets>` → the probe
`decks/p22b/parts/<card>.probe.ts` (run-mutants RM 5 + 1 row = 2; gate-mutants GM 1–3 + 1 row = 4; check-identity CI
1–3 = 3; gate-command GC 4–5 + 1 row = 3; parse-command PC 24 = 1; **13 tests**) → eslint's verdict → full
`vitest run` → own git → frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs tests <file> <min> <max> lits<i>.json` → `vitest
run <targets>` → eslint's verdict → full run → own git → frozen → untracked.

| file | new | min | max | lits |
|---|---|---|---|---|
| `tests/reviewer/runMutants.p22b.examples.test.ts` | yes | 1 | 7 | `Run Mutants example 5`, `reviewer/untried.json`, `stopAt: 2500` |
| `tests/gate/gateMutants.examples.test.ts` | yes | 3 | 9 | `Gate Mutants example 1` … `3`, `gate/mutantFiles.json`, `gate/gateMutants.json`, `builder/go/code1.txt`, `timeoutMs: 400` |
| `tests/gate/identity.examples.test.ts` | yes | 3 | 9 | `Check Identity example 1` … `3`, `identity/corpus.json`, `73cb3858a687`, `git checkout failed` |
| `tests/gate/gateCommand.p22b.examples.test.ts` | yes | 2 | 8 | `Gate Command example 4`, `Gate Command example 5`, `gate/gateCommand.p22b.json`, `mutantStopSeconds: 0`, `touch full.txt` |
| `tests/cli/gate.p22b.examples.test.ts` | yes | 1 | 7 | `Parse Command example 24`, `parseArgv.json`, `"24"` |

min = the NEW record examples in the file; max = min + 6.

**Output budget** (`max_tokens`, before the session's ×3 for `ds`):

| card | returns | `max_tokens` |
|---|---|---|
| check-identity | ≈ 2.9 KB new | 8 000 |
| run-mutants, gate-mutants | ≈ 4.1–4.3 KB whole file | 12 000 |
| gate-command | playGate.ts + gateCommand.ts ≈ 13.6 KB, two whole files | 24 000 |
| parse-command | types.ts + parse.ts ≈ 23.5 KB, two whole files | 28 000 |
| run-mutants-judge, parse-command-judge | ≈ 1.5–2 KB new | 16 000 |
| gate-mutants-judge, check-identity-judge, gate-command-judge | ≈ 3–4 KB new, tmp roots, child processes | 24 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- **Layers** (decks/tools/guard.mjs, data of this phase): src/gate/* imports cards, acceptance, git, language, reviewer
  and its own modules; of the Node modules node:fs, node:os, node:path, node:crypto; never reads `process.env` or the
  clock (deps.now), spawns nothing itself (runAcceptance through Run Mutants, gitOk). gateMutants.ts imports no Node
  module. runMutants.ts stays the reviewer's (no Node module).
- **No fixture names in src/**: no phase name, no corpus entry, no card id of a fixture.
- A file a card writes is in no sibling's slice in the same generation: 0 [check-identity, parse-command, run-mutants];
  1 [check-identity-judge, gate-mutants, parse-command-judge, run-mutants-judge] read generation 0's files; 2
  [gate-command, gate-mutants-judge] read gateMutants.ts; 3 [gate-command-judge] reads gateCommand.ts.
- Every IMPORT edge of a target is a dependsOn of its card (P22a, #15): gate-mutants → run-mutants (runMutantsUntil);
  gate-command → gate-mutants; each judge → its code card. check-identity-judge imports main.ts (no card's target).
- Tests write only under `tmpRoot()` / `tmpRepo()` / the clones of Check Identity and remove them; no JS timer; no
  network; a judge writes only its target.

## 7. Out of scope

Data of this phase (orchestrator, committed before the run): the fixtures of §2.1, the record (review-session, gate,
gate-proof NEW, cli), the map, the guard's layer, `decks/p22b/` (checks, probes, `_stubs/`, deck), and the regulation
text, written now and **in force from this phase's merge on**: `docs/AUTONOMY.md` steps 1–2,
`templates/common/docs/AUTONOMY.md`, `docs/TASK_TEMPLATE.md` and `templates/common/docs/TASK_TEMPLATE.md` replace the
hand mutants and the hand byte identity with `morph gate … --mutants 30` (code 0, or 1 with every survivor and untried
mutant recorded) and the corpus test in `vitest run`.

**P22c (optional, issue items 4 and 5):** `morph report --run … --deck … --gate <verdict>`; `morph plan --scale-tokens
<k>` and a hash of the cut's inputs in the deck. Also out: mutants of judge (test) files; a parallel mutant run; a
`plan --regress` command; growing the corpus beyond the five entries (a later phase adds its own deck's entry as data).

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component review-session --component gate-proof \
  --component gate --component cli --judge --checks decks/p22b/checks.json \
  --only run-mutants,check-identity,parse-command,gate-mutants,gate-command,run-mutants-judge,check-identity-judge,parse-command-judge,gate-mutants-judge,gate-command-judge \
  --out decks/p22b/deck.json
python3 decks/tools/scale_tokens.py decks/p22b/deck.json 3         # processor ds
node dist/cli.js deck check --root . --deck decks/p22b/deck.json   # errors 0 (builds over decks/p22b/_stubs)
rm -rf /tmp/v2bin-p22b && mkdir -p /tmp/v2bin-p22b && cp -r dist /tmp/v2bin-p22b/ && ln -s $PWD/node_modules /tmp/v2bin-p22b/node_modules \
  && ln -s $PWD/templates /tmp/v2bin-p22b/templates
node /tmp/v2bin-p22b/dist/cli.js run --root . --deck decks/p22b/deck.json --processor ds --deadline 7200
```

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 10 (5 code, 5 judges) / 4: [check-identity, parse-command, run-mutants] [check-identity-judge, gate-mutants, parse-command-judge, run-mutants-judge] [gate-command, gate-mutants-judge] [gate-command-judge] |
| executor bill | ≈ $0.25–0.45 on ds ×3 (P22a 10 cards $0.4599 + $0.1752); ≤ $0.80 with a fix; cap $5 |
| cards with regeneration | 1–3 of 10 (gate-command: two whole files, the optional key and code 1; parse-command: the key only when given; gate-mutants: the clock calls, the spread; judges: Check Identity's root, the 120000 timeouts) |
| tests after the run | 905 ± 6 in 151 files |
| first red | run-mutants: a now() call before the baseline or after the first untried; gate-mutants: the full line kept, a test file mutated, the cap not applied; gate-command: the key mutants always present (P22a's document), code 2 for survivors; parse-command: mutants: undefined as a key |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no answer cut at its `max_tokens`; (3) after the run no
file outside §2.3's twelve changed; (4) every cut byte for byte, and the corpus test green; (5) this repository's HEAD
and refs unchanged by every card; (6) after the merge `morph gate --mutants 30` with the run's binary on this phase's
deck gives code 0 or 1 with mutants planned ≤ 30, seconds ≤ 1 320; a planner change (a spike) reddens Check Identity 1;
(7) no phase or fixture name in `src/` (grep).

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the MEASURE row,
the vitest log of every verify run; DECISIONS lines "P22b gate"; after the merge claim 6 (the dogfood gate with mutants).

## 11. Actual

(filled at the gate and after the run)
