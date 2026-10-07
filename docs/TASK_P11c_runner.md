# TASK_P11c — runner hardening: a fault archived, a carried-over retry unblocks, no key in the acceptance env, the retry suffix, `..`, an empty deck, a capped diff (`src/runloop/`, `src/cli/runCommand.ts`, `src/git/commit.ts`, `src/acceptance/`, `src/cards/model.ts`)

> Phase P11c of `docs/PLAN.md` ("Фазы по записи (после P2)", row P11c; added by the operator 07.10), first part
> **P11c1** (the split is §7). It answers issue #5 (label `P11c-runner`, the code review of 07.10 by Claude Fable 5.1):
> findings **1, 2, 5** (mandatory, operator) and **3, 8, 9**; findings 4 and 6 are P11c2. Components of `contour.yaml`:
> `runloop` (Run Deck; Run Report), `cli` (Run Command), `git` (Commit Paths, Commit Card), `acceptance` (Run Acceptance,
> Build Attempt Diff) and `cards` (Validate Card); every change is a **patch** of code written in P1–P11b. runloop and cli
> were compacted first (no example's meaning changed). The deck is cut by V2 (`morph plan --checks
> decks/p11c/checks.json`), filtered to this phase's 12 cards by `decks/p11c/filter.py`.

## 1. Why this

Each item was reproduced by the reviewer on the stub processor (issue #5, "CONFIRMED"):

- **#5 1 — a thrown Error leaves no archive.** Any Error inside Run Deck propagates to main: exit 3 (RuntimeError), no
  report, no archive, the spend lost from the record, HEAD left on `morph/<runId>` with the accepted commits. Triggers:
  `gitOk` in the commit hook (a target under a `.gitignore`'d path: `git add failed (exit 1): The following paths are
  ignored…`), EISDIR in the answer write, `rmSync` on a directory target. The record licensed it ("A thrown Error
  propagates").
- **#5 2 — the dependants of a card written by a carried-over retry stay skipped.** Deck [a; b dependsOn a], a's
  answers bad/bad/good, cap 1 → a "written" after 3 attempts, b "skipped" "dependency a failed": generation 1 resolves
  b before its retry batch writes a (`deck.ts:98-109` vs `128-197`).
- **#5 3 — a card id ending in `.r<n>` collides with its own retry id.** Card "foo.r1" → 3 paid requests, the card
  "failed" after 1 attempt (`retry.ts:12`, `deck.ts:49` strip the suffix).
- **#5 5 — API keys reach the model-written tests.** Every acceptance shell inherits the whole process env, including
  `MORPH_PROCESSOR_*_API_KEY`; a test printing `process.env` puts the key into the log → report.json → the committed
  archive.
- **#5 8 — the attempt diff is O(n·m) in memory.** 8k × 8k lines: 524 MB of heap; 15k × 15k: 1.8 GB; ~20k lines runs out
  of memory, which then hits #1. Measured here on the reference: 4000 × 4000 lines diffs in 0.66 s, ~146 MB heap.
- **#5 9 — `..` passes the path check; an empty deck commits an archive.** `..` alone passes isRepoRelative; the deck
  `[]` opens a branch and commits an archive with exit 0.

**Ripple, measured** (references of the 7 code files in a scratch worktree, full suite): **0 of 610** tests red. Every
new shape is optional or additive: `RunReport.fault?` (absent when nothing was thrown, so whole-report tests stay equal),
`commitPaths(…, force = false)` (Archive Run example 3 keeps its refusal of an ignored `.morph/`), the child env (no test
passes a `*_KEY`), the diff cap (the largest diff in the tests is 400 lines), the new refusals (no test runs an empty deck
or a `.r<n>` id through Validate Card). tsc and eslint clean.

**Record sizes** (bytes of each Component block, the 30 000 rule), before → after: runloop 29 899 → **29 992**, cli
29 998 → **29 988**, git 17 202 → **17 825**, acceptance 12 642 → **14 017**, cards 7 321 → **8 048**. Compaction moved
literals to fixtures by `ref` (`runloop/stubRows.json`: Process Generation 7's and Run Deck 5's stub rows;
`runloop/glmRows.json`: Run Deck 4's two rows; `cli/parse.json` keys 3–8, 11, 13: Parse Command's error results, a list
for several argv — each generated from the code on main and equal to the old literal) and reworded behaviours of Run
Deck, Process Generation, Run Command, Read Deck File and Deck Check with every rule kept.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Card, Deck** — `src/cards/types.ts`; **RunDeps, RunInput, RunReport, CardOutcome, CommitHook** —
  `src/runloop/types.ts` (§2.2 adds `fault?`); **CliDeps, RunArgs, RunDocument** — `src/cli/types.ts`; **CardCommit,
  CommitInfo, Trailer** — `src/git/types.ts`; **RunOptions, AcceptanceResult** — `src/acceptance/types.ts`.
- **Fixtures**: none new for the new examples (every literal is in the record; the 4000-line inputs are built in the
  test). `runloop/stubRows.json` (ONE array, 2 Request Usage rows a.v1, b.v1 of the stub), `runloop/glmRows.json` (ONE
  array, Run Deck 4's 2 rows a.v1, a.r1.v1) and the new keys of `cli/parse.json` hold old literals moved out of the record
  (no test reads them yet).

**Distinct markers.** Fault texts `index.lock: File exists` (RD 9), `card commits refused` (RC 10), `boom` (probe);
marks `MARK_A`/`MARK_B` against `none`; run ids `r9`, `r10`, `r11`; models `m2`, `m3`; env values `k1`, `m/x`, `k2`, `t3`;
line counts 4001/4000 (BAD 6), 4000/4000 (BAD 7), 2/8000001, 5000/3201 (probe) — the code must hard-code none of them.

**A judge's setup across Components** (TASK_TEMPLATE §2.1):

- **F1** runloop · the stub processor answers request `<id>.v1` from `<answersDir>/<id>.v1.md`, else `<id>.md` (so
  `a.md`, `a.r1.md`, `a.r2.md` answer a.v1, a.r1.v1, a.r2.v1); a fenced ts block is the whole file of a one-target card;
  the commit hook is RunDeps.commit, called once per accepted card with the RETRY card's id ("a.r2") · RD 9, 10.
- **F2** git · Commit Card runs `git commit`, so the repo's `.git/hooks/commit-msg` runs; a hook that exits 1 makes
  gitOk throw `git commit failed (exit 1): <its first stderr line>`; Archive Run's subject "morph run <id>: deck and
  report" passes a hook that only refuses "morph a:" · RC 10.
- **F3** git · `tmpRepo()` starts on `main` with one commit; a test passes a gitEnv with its own HOME and
  `GIT_CONFIG_NOSYSTEM`, so no user config or hook template reaches it; `tmpRepo().git` trims its output · CC 4, RC 10–11.

**Harness skeletons** (each ≤ 10 lines, only from `tests/helpers.ts` and the types):

```ts
// deck.p11c (run-deck-judge): stub RunDeps whose commit hook records ids and throws for one
const card = (id: string, acceptance: string, dependsOn: string[] = []): Card => ({ customId: id, intent: "generate",
  targets: [id + ".ts"], contextSlice: [], instruction: "write " + id, acceptance, model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn });
const deps = (t: TmpRoot, fired: string[], throwOn: string | null): RunDeps => ({ config: { id: "stub", type: "stub", model: "stub",
  apiKey: null, baseUrl: "https://openrouter.ai/api/v1", route: "sync", concurrency: 4, providerOrder: null, reasoning: null, timeoutMs: 600000,
  maxRetries: 0, answersDir: t.path("answers") }, transport: { fetch: fakeFetch().fetch, sleep: async () => {} }, now: () => 0, env: { PATH: process.env.PATH ?? "" },
  commit: (id) => { fired.push(id); if (id === throwOn) throw new Error("index.lock: File exists"); return { commit: "sha-" + id, diffstat: { files: 1, insertions: 1, deletions: 0 } }; } });
// input: { root: t.root, runId: "r9", branch: "morph/r9", deck: { cards, externalDependsOn: [] }, budget: { maxCards: cards.length, maxRetryBatches: 1, deadline: 1e15 } }
// runCommand.p11c (run-command-judge): the P10c2 stubSetup; RC 10 adds the hook before the run
const gitEnv = (home: string): Record<string, string> => ({ PATH: process.env.PATH ?? "", HOME: home, GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Ada", GIT_AUTHOR_EMAIL: "ada@example.invalid", GIT_COMMITTER_NAME: "Ada", GIT_COMMITTER_EMAIL: "ada@example.invalid" });
const deps: CliDeps = { env: { ...gitEnv(r.root), MORPH_PROCESSOR_s_TYPE: "stub", MORPH_PROCESSOR_s_ANSWERS_DIR: side.path("answers") }, now: () => 1791310149000, cwd: r.root, transport: null };
fs.writeFileSync(r.path(".git/hooks/commit-msg"), "#!/bin/sh\nif grep -q '^morph a:' \"$1\"; then echo 'card commits refused' >&2; exit 1; fi\nexit 0\n", { mode: 0o755 });
// commit.p11c (commit-card-judge): the gitEnv above with home = r.root; .gitignore "out/\n" committed with r.git first
```

### 2.2. OUTPUT data shapes

**`src/runloop/types.ts`** — `RunReport` gains the optional LAST member `fault?: string`; nothing else changes.

**Run Deck** (`deck.ts`) — two additions; every P5–P11b rule stays.

1. **Finding 2, a carried-over retry before its dependants.** At a generation, after the boundary checks: when a
   not-yet-done card of the generation has a dependsOn id whose outcome is "failed" and that has been retried fewer than 2
   times, the retry loop runs FIRST — the same loop (same per-generation counter `retryBatches`, same deadline check
   before each batch, the same batch of every failed card with retries left); then the statuses are read, the generation
   resolves and runs, and the retry loop runs after it as before (what remains of the cap). With no such card nothing
   changes (the request order of P10c is kept: the probe pins `a.v1, x.v1, a.r1.v1, y.v1, a.r2.v1` for [a, x; y
   dependsOn x], cap 1). The carried-over batch counts against the generation's cap: [a; b dependsOn a], cap 1, a good at
   r2, b bad then good → a written (3), b "failed" (1): its retry waits for a next generation, which there is not.
2. **Finding 1, a fault caught.** The generation loop runs inside try/catch. A caught value (an Error from the commit
   hook, an answer write, git; anything thrown) ends the loop; fault = the Error's message, `String(value)` for a
   non-Error; every card of the deck with no outcome yet gets `{customId, status: "skipped", reason: "fault", attempts: 0,
   winningVariant: null, acceptanceLog: "", earlierFailures: [], commit: null, diffstat: null}` — the cards of the call in
   flight included (their usage and rows are lost: §7); a card decided before keeps its outcome. The report is built as
   always, with `fault` as its last key; with nothing caught the key is absent (never `fault: undefined`). runDeck never
   rejects.

| Run Deck example | deck, answers, hook | outcomes / report |
|---|---|---|
| 9 | [a; b dependsOn a; c dependsOn b] on the stub, `grep -q MARK_<X> <x>.ts` each, answers with the marks; the hook throws `new Error("index.lock: File exists")` for b | a written (commit sha-a), b and c skipped "fault" attempts 0; `fault` "index.lock: File exists", the last key; generations 3; usageTotals.requests 1; the hook fired a, b |
| 10 | [a; b dependsOn a], a.md and a.r1.md without MARK_A, a.r2.md with it, b.md with MARK_B; cap 1 | a written attempts 3 winningVariant "a.r2.v1"; b written attempts 1; request rows a.v1, a.r1.v1, a.r2.v1, b.v1; the hook fired a.r2, b; no `fault` key |

**Run Command** (`runCommand.ts`) — step 2: after Read Deck File succeeds, a deck with no cards → `{code: 2, document:
errorDocument(2, "RefusalError", "deck has no cards")}`, before the hazard check (so before any git call or spend; the
processor check and the deck file's own failures come first). Step 7: code = **3 when `report.fault` is set**, else
`runExitCode(report, archive)`; the archive is written in both cases (the partial report, its trailers counting the
skipped cards), the document is the Run Document. The record's "A thrown Error propagates" is gone: Run Deck no longer
throws; a throw before it (Open Run Branch outside a repo: Main example 3) still reaches main's classifyThrown.

| Run Command example | setup | result |
|---|---|---|
| 10 | example 1's deck (a → out/a.ts, b dependsOn a, `test -f`), runId "r10"; `.git/hooks/commit-msg` (755) refusing "morph a:" with "card commits refused" | code 3; Run Document; report.fault `git commit failed (exit 1): card commits refused`; a, b skipped "fault"; archive `{ok: true, dir: ".morph/runs/r10", commit: HEAD}`, report.json holds the fault, trailer `Morph-Skipped: 2`; the only commit since base is the archive's; HEAD on morph/r10 |
| 11 | deck file `[]` | `{code: 2, document: {error: {code: 2, kind: "RefusalError", message: "deck has no cards"}}}`; no `morph/*` branch; no `.morph` |

**Commit Paths / Commit Card** (`commit.ts`) — `commitPaths(root, paths, subject, trailers, env, force = false)`: `git
add -A -f -- <paths>` when force, else exactly as before (`git add -A -- <paths>`; an ignored path still throws `git add
failed (exit 1): …`, which Archive Run example 3 relies on). `commitCard` calls it with force true: a target under a
`.gitignore`'d path is committed (the card named it), so the commit hook never throws on it. makeCommitHook unchanged.
Example 4: `.gitignore` "out/\n" committed; `makeCommitHook(root, "m2", env)("g", ["out/g.ts"])` with out/g.ts "y\n" →
`{commit: HEAD, diffstat {files: 1, insertions: 1, deletions: 0}}`; `git show --name-only --format= HEAD` "out/g.ts";
message "morph g: out/g.ts\n\nMorph-Card: g\nMorph-Model: m2\nMorph-Acceptance-Exit: 0".

**Run Acceptance** (`run.ts`) — the child's env is a NEW object: every entry of `options.env` except a key whose
upper-cased name starts with `MORPH_PROCESSOR_` or ends with `_KEY` or `_TOKEN`; then `NO_COLOR: "1"`, `CI: "1"` laid
over. `options.env` is never changed. Kept: `KEYBOARD`, `TOKENS_LEFT`, `MY_KEY_ID`, `XTOKEN`, `KEY` (no `_KEY` suffix);
dropped: `MORPH_PROCESSOR_x_MODEL`, `OPENROUTER_API_KEY`, `MRPH_PROCESSOR_ds_API_KEY`, `api_key`, `Gh_Token`. Example 5:
env {PATH "/usr/bin:/bin", MORPH_PROCESSOR_x_API_KEY "k1", MORPH_PROCESSOR_x_MODEL "m/x", OPENROUTER_API_KEY "k2",
GH_TOKEN "t3", KEYBOARD "us", TOKENS_LEFT "7"}, command `env` → exit 0; the log has the lines `KEYBOARD=us`,
`TOKENS_LEFT=7`, `PATH=/usr/bin:/bin`, `NO_COLOR=1`, `CI=1` and holds none of `MORPH_PROCESSOR_`, `k1`, `m/x`, `k2`,
`t3` (`sh` adds PWD and the like: the test checks names, never the whole log).

**Build Attempt Diff** (`diff.ts`) — `export const DIFF_LCS_CAP = 16000000`. A changed file whose before and after line
counts (the lines rule 1 counts: `[]` for absent or "") multiply to MORE than DIFF_LCS_CAP gets, after its two header
lines, the single line `"... [diff skipped: " + <before lines> + " -> " + <after lines> + " lines] ...\n"` instead of its
hunks, and editOps is never called for it; the section is then clipped like any other (it is short). An unchanged file
still contributes nothing; an absent side multiplies to 0 (a new 20 000-line file is diffed and clipped as before).
Example 6: 4001 lines "old 0"… against 4000 lines "new 0"… → exactly `"--- a/big.txt\n+++ b/big.txt\n... [diff skipped:
4001 -> 4000 lines] ...\n"`. Example 7: 4000 lines "c 0"… "c 3999" against the same with "C 3999" → exactly `"--- a/src/c.ts\n
+++ b/src/c.ts\n@@ -3997,4 +3997,4 @@\n c 3996\n c 3997\n c 3998\n-c 3999\n+C 3999\n"` (16 000 000 is not over).

**Validate Card** (`model.ts`) — a customId that matches `^[A-Za-z0-9._-]+$` but also `/\.r[0-9]+$/` is ONE fault on key
`customId`: `customId '<id>' ends in .r<n>, the suffix of a retry` (the characters `.r<n>` literally). Refused: `a.r10`,
`deck.r0`; accepted: `a.r`, `a.r1x`, `a.rr1`, `a-r1`, `r1`, `x.R1`, `a.r1.v1`. isRepoRelative also refuses a normalised
path equal to `..` (`..`, `src/../..`): `targets '..' is not repo-relative`, `contextSlice '..' is not repo-relative`;
`..x/y.ts`, `a/..b` stay valid. Example 5: `{"customId":"lint.r2",…}` → one fault `customId 'lint.r2' ends in .r<n>, the
suffix of a retry`. Example 6: targets `[".."]`, contextSlice `["..","docs/x.md"]` → two faults in key order, targets then
contextSlice. Load Deck reports it as `cards[<i>].customId: …`.

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P11c runner"):

- **Split** P11c1 (this: #5 1, 2, 3, 5, 8, 9) / P11c2 (#5 4, 6; §7).
- **#5 1, where the catch lives**: in Run Deck, not Run Command — only Run Deck holds the outcomes so far; Run Command
  maps `report.fault` to code 3 and archives as always (the issue's "Run Command catches" gives the same exit and
  archive, with the outcomes). Undecided cards: "skipped", reason "fault" (not a new status: CardStatus is compared whole
  in P5–P11b tests); the fault text once, on the report.
- **#5 1, Commit Card on an ignored target**: `git add -f` for card targets only (the card named the file); Commit Paths
  keeps refusing an ignored path for its other caller, Archive Run (example 3 pins that refusal).
- **#5 2**: the carried-over retry loop runs before resolving only when a pending card waits on a failed-with-retries
  dependency (the issue's first option, narrowed): no other run changes its request order; the batch counts against the
  generation's cap.
- **#5 3**: refused at Validate Card (the deck's door), not by changing the retry id grammar (archives and trailers of
  P5–P11b name `<base>.r<n>`).
- **#5 5**: the filter lives in Run Acceptance (every acceptance, the probe stages included, goes through it), case
  insensitive, by name only (`MORPH_PROCESSOR_*`, `*_KEY`, `*_TOKEN`); git and the processor still get the full env.
- **#5 8**: the cap is the product of line counts (the LCS table's size), 16 000 000 = 4000 × 4000 (measured 0.66 s,
  ~146 MB); a cap on one side's lines would skip cheap diffs of new files.
- **#5 9**: `..` joins the not-repo-relative rule; the empty deck is a Run Command refusal (code 2, before any git
  call), not a Load Deck fault (`deck check` of `[]` stays a valid empty report).

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/runloop/types.ts`, `deck.ts` | `fault?`; carry-over first; the catch | probe only | NEW `tests/runloop/deck.p11c.examples.test.ts` (RD 9, 10) |
| `src/cli/runCommand.ts` | empty deck; code 3 on fault | probe only | NEW `tests/cli/runCommand.p11c.examples.test.ts` (RC 10, 11) |
| `src/git/commit.ts` | `force` | probe only | NEW `tests/git/commit.p11c.examples.test.ts` (CC 4) |
| `src/acceptance/run.ts` | the child env | probe only | NEW `tests/acceptance/run.p11c.examples.test.ts` (RA 5) |
| `src/cards/model.ts` | `.r<n>`, `..` | probe only | NEW `tests/cards/model.p11c.examples.test.ts` (VC 5, 6) |
| `src/acceptance/diff.ts` | DIFF_LCS_CAP | probe only | NEW `tests/acceptance/diff.p11c.examples.test.ts` (BAD 6, 7) |

- `deck.p11c`: "Run Deck example 9: …" (the outcomes, `fault` toBe, `Object.keys(report)` ending in `fault`, requests 1,
  the hook's ids), "Run Deck example 10: …" (outcomes, winningVariant, the rows' customIds in order, `"fault" in report`
  false).
- `runCommand.p11c`: "Run Command example 10: …" (code 3, the fault, the outcomes, the archive, the archived report.json's
  fault, `Morph-Skipped` trailer, HEAD's branch), "Run Command example 11: …" (the whole result `toStrictEqual`, no
  branch, no `.morph`).
- `commit.p11c`: "Commit Card example 4: …". `run.p11c`: "Run Acceptance example 5: …" (names of the log's lines; none of
  the five strings). `model.p11c`: "Validate Card example 5: …", "… example 6: …". `diff.p11c`: "Build Attempt Diff
  example 6: …", "… example 7: …" (inputs built with `Array.from`, results `toBe`).

### 2.4. What must not break

- Byte for byte: every file outside the 7 code targets and the 6 new test files; in particular `src/runloop/{generation,
  resolve,retry}.ts`, `src/git/{archive,branch,run,types}.ts`, every `src/cli/` file but runCommand.ts, `src/cli.ts`,
  `src/acceptance/{snapshot,verify,types}.ts`, `src/cards/{types,hazards,layer,weigh}.ts`, `tests/helpers.ts` and every
  existing test file.
- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/`, `.gitignore` — untouched by every card.
- The 610 tests stay green at every card (ripple 0, no fullExclude); after the run **610 + 10 = 620** in 77 files.

## 3. Acceptance

Built by `morph plan --checks decks/p11c/checks.json`, narrow to broad, every stage printing `== <stage>`. `ownGit: true`
(git and run tests spawn git). No fullExclude (ripple 0).

Code cards (no test file, code-only targets, no smoke cap): `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs
src <targets>` → `decks/p11c/parts/<card>.probe.ts` (run-deck RD 9, 10 + 1 row = 3; run-command RC 10, 11 + 1 = 3;
commit-card CC 4 + 1 = 2; run-acceptance RA 5 + 1 = 2; card-model VC 5, 6 + 1 = 3; build-attempt-diff BAD 6, 7 + 1 = 3;
**16 tests**) → eslint's verdict → full `vitest run` → own git → frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs tests <file> <min> <max> lits<n>.json` → `vitest
run <targets>` → eslint's verdict → full run → own git → frozen → untracked.

| file | min | max | lits |
|---|---|---|---|
| `tests/runloop/deck.p11c.examples.test.ts` | 2 | 8 | `Run Deck example 9`, `Run Deck example 10`, `index.lock: File exists`, `fault`, `a.r2.v1` |
| `tests/cli/runCommand.p11c.examples.test.ts` | 2 | 8 | `Run Command example 10`, `… 11`, `commit-msg`, `card commits refused`, `deck has no cards`, `Morph-Skipped` |
| `tests/git/commit.p11c.examples.test.ts` | 1 | 7 | `Commit Card example 4`, `makeCommitHook`, `out/g.ts`, `m2` |
| `tests/acceptance/run.p11c.examples.test.ts` | 1 | 7 | `Run Acceptance example 5`, `MORPH_PROCESSOR_x_API_KEY`, `OPENROUTER_API_KEY`, `GH_TOKEN`, `TOKENS_LEFT` |
| `tests/cards/model.p11c.examples.test.ts` | 2 | 8 | `Validate Card example 5`, `… 6`, `lint.r2`, `ends in .r<n>, the suffix of a retry`, `is not repo-relative` |
| `tests/acceptance/diff.p11c.examples.test.ts` | 2 | 8 | `Build Attempt Diff example 6`, `… 7`, `diff skipped: 4001 -> 4000 lines`, `@@ -3997,4 +3997,4 @@` |

min = the file's record examples; max = min + 6 (all new files).

**Output budget** (`max_tokens`, before the session's ×3 for `ds`): code = targets in tokens (≈ bytes / 3.5) × 2 + 2 500,
rounded up; judges from the file they return (≈ 2–5 KB each, none near the ~20 KB that needs ≥ 28 000).

| card | returns | `max_tokens` |
|---|---|---|
| run-deck | deck.ts ≈ 9.3 KB + types.ts 2.4 KB | 14 000 |
| run-command | runCommand.ts ≈ 5.0 KB | 10 000 |
| commit-card | commit.ts ≈ 2.0 KB | 8 000 |
| run-acceptance | run.ts ≈ 3.9 KB | 8 000 |
| card-model | model.ts ≈ 9.5 KB | 10 000 |
| build-attempt-diff | diff.ts ≈ 8.9 KB | 10 000 |
| run-deck-judge, run-command-judge | ≈ 4–5 KB new file | 16 000 |
| commit-card-, run-acceptance-, card-model-, build-attempt-diff-judge | ≈ 1.5–2.5 KB new file | 12 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- Layers unchanged: runloop writes nothing and imports no git; cli is the only one that wires git into the run; the
  acceptance env filter reads no `process.env` (the env is a parameter).
- A file a card writes is in no sibling's slice in the same generation: generation 0 (run-deck writes
  `src/runloop/types.ts`) — commit-card's slice no longer holds it; generation 1 (run-command writes runCommand.ts) — no
  judge of generation 1 reads it.
- Tests write only under `tmpRoot()` / `tmpRepo()` and remove it in `finally`; a judge writes only its test file.
- Exact strings of the record and §2.2: the executor copies them.

## 7. Out of scope

- **P11c2** (the split, with its reason): **#5 4** (`acceptance: null` counts as written: Process Generation → "failed",
  reason "no acceptance", nothing sent; Run Command's refusal before spend) and **#5 6** (SIGINT/SIGTERM: Run Acceptance
  kills the group while the child lives, Run Command archives the partial report on a signal). Reason: #4 contradicts
  two existing tests — `generation.examples` "a null acceptance is the empty command and accepts" (a 20 KB file a judge
  must return whole) and the decks of `runCommand.examples` 4–5, which carry no acceptance and would hit the refusal
  first (measured on the reference: 3 red); #6 needs process-level signal handlers in the cli entry and tests that send
  signals to a child process under a timeout. Both together are ~6 more cards over this phase's 12. The merge of
  **P11c2** closes issue #5.
- The usage and request rows of the processGeneration call in flight when a fault is thrown (lost: the send result
  dies with the throw); the cards of that call are "skipped" even when one was committed before the throw (the archive's
  `fault` marks the report partial).
- Any other secret name pattern (`*_SECRET`, `*_PASSWORD`) and the env of git and of the processor.
- A cheaper diff algorithm above the cap (Myers): the cap only bounds memory.

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component runloop --component acceptance \
  --component cli --component git --component cards --judge --checks decks/p11c/checks.json --out decks/p11c/deck.json
python3 decks/p11c/filter.py decks/p11c/deck.json            # keeps the 12 cards of the phase
node dist/cli.js deck check --root . --deck decks/p11c/deck.json                                  # errors 0
python3 decks/tools/scale_tokens.py decks/p11c/deck.json 3    # the session, for processor ds
rm -rf /tmp/v2bin-p11c && mkdir -p /tmp/v2bin-p11c && cp -r dist /tmp/v2bin-p11c/ && ln -s $PWD/node_modules /tmp/v2bin-p11c/node_modules
node /tmp/v2bin-p11c/dist/cli.js run --root . --deck decks/p11c/deck.json --processor ds --deadline 2400
```

Cross-check (dry): from `morph-lab`, `venv/bin/mrph plan --spec <repo>/contour.yaml --map <repo>/morph-map.json
--component runloop --component acceptance --component cli --component git --component cards --judge --root <repo>`.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 12 (6 code, 6 judges) / 3: [build-attempt-diff, card-model, commit-card, run-acceptance, run-deck] [5 judges + run-command] [run-command-judge] |
| executor bill | ≈ $0.08–0.15 on ds ×3 (P11b1: 14 cards, 22 requests, $0.1379; here 12 cards of 13–40 KB in), ≤ $0.30 with a re-cut; cap $5 |
| cards with regeneration | 1–3 of 12 (run-deck: the carry-over called always, or `fault: undefined`; run-acceptance: the caller's env mutated; run-deck-judge: the in-flight usage) |
| tests after the run | 620 ± 4 in 77 files |
| first red | run-deck: "no waiting dependant: the old order"; run-command: code 1 instead of 3; card-model: the suffix on `a.r` |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no judge cut off at its `max_tokens`; (3) the V2 cut
equals the old mrph's dry cut in ids, dependsOn, generations, targets, slices and max_tokens; (4) after the run no test
file outside §2.3's six changed; (5) the run's own archive is in the P11b layout (the running binary predates the
phase), and its acceptances run with the full env (the running binary predates the filter).

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the row of
`docs/MEASURE.md`; DECISIONS lines name "#5 <n>"; P11c2 (#5 4, 6) closes issue #5 at its merge.

## 11. Actual

### Gate (preparation)

(filled at the gate)
