# TASK_P11c2 — runner hardening, part 2: no acceptance is no write, a signal stops the run with its archive (`src/runloop/`, `src/acceptance/run.ts`, `src/cli/runCommand.ts`, `src/cli.ts`)

> Phase P11c2 of `docs/PLAN.md` (row P11c, its second part; `docs/TASK_P11c_runner.md` §7 defines it). It answers the
> last two findings of issue #5 (label `P11c-runner`, the code review of 07.10 by Claude Fable 5.1): **4** (`acceptance:
> null` counts as written) and **6** (SIGINT/SIGTERM leaves the acceptance group running and no archive). Its merge
> closes #5. Components of `contour.yaml`: `runloop` (Process Generation, Run Deck), `acceptance` (Run Acceptance),
> `cli` (Run Command, Main); every change is a **patch** of code written in P3–P11c1. runloop and cli were compacted
> first (no example's meaning changed). The deck is cut by V2 (`morph plan --checks decks/p11c2/checks.json`), filtered
> to this phase's 10 cards by `decks/p11c2/filter.py`.

## 1. Why this

Both items were reproduced by the reviewer on the stub processor (issue #5, "CONFIRMED"):

- **#5 4 — `acceptance: null` counts as written.** `generation.ts` runs `card.acceptance ?? ""`: `sh -c ""` exits 0, so a
  card with no acceptance (or a blank one) is committed with `Morph-Acceptance-Exit: 0` after a paid request. Measured on
  main: a one-card deck with no acceptance → 1 request, "written", 1 commit.
- **#5 6 — a signal orphans the acceptance and loses the archive.** Run Acceptance spawns `detached` (its own process
  group, for the timeout kill), so a Ctrl-C to the orchestrator never reaches the group: after exit 130 the reviewer's
  `sleep 37` was alive; nothing was archived. Measured here (spike, unpatched main): a child node running
  runAcceptance(`sleep 30 & …; kill -TERM $PPID; wait`) dies by SIGTERM, its `sleep` stays in state S; `morph run` hit
  by SIGINT dies with no document, `out/` left untracked, no `.morph/runs/<id>`.

**Ripple, measured** (crude mutations of the 5 code files in a scratch worktree, full suite): **2 of 620** red —
`generation.examples` "Process Generation: a null acceptance is the empty command and accepts" (the contradicted
behaviour) and `runCommand.examples` "Run Command example 4: a dirty tree refuses …" (its one card has no acceptance,
so the new refusal comes before the dirty-tree check). Placing the refusal AFTER the hazard check keeps
`runCommand.examples` 5 (write-write hazard, cards without acceptance) green — P11c1 measured 3 red with it before the
hazards. Every other new shape is optional (`RunDeps.interrupted?`, `CliDeps.interrupted?`) or additive.

**Record sizes** (bytes of each Component block, the 30 000 rule), before → after: runloop 29 992 → **29 986**, cli
29 988 → **29 996**, acceptance 14 017 → **15 197**; git 17 825, cards 8 048 unchanged. Compaction moved literals to
fixtures by `ref`, each generated from the code on main (or copied from its test) and equal to the old literal:
`runloop/retryContexts.json` (Process Generation 4, 5, 6, 9's retryContexts), `runloop/retryInstructions.json` (Build
Retry 4–6's exact instructions, by `buildRetry`), `runloop/glmAnswer.json` and `runloop/glmMessage.json` (Run Deck 4's
answer body and its two message parts), `cli/parseArgv.json` (Parse Command 1–13's argv, each a list of argv lists),
`cli/literals.json` (Run Command 8's log, 9's env, Plan Command 3's messages, Main 4's stderr); Resolve Runnable 3 names the skipped shape of its behaviour, Classify
Error 2 and Main 5 refer to their sibling example, the Parse Command plan shape names the Command data object, two
schema notes shortened. No test reads the new fixtures yet.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Card, Deck** — `src/cards/types.ts` (`acceptance: string | null`); **RunDeps, RunReport, CardOutcome, RetryContext,
  GenerationOutcome** — `src/runloop/types.ts` (§2.2 adds `interrupted?`); **CliDeps, RunArgs, RunDocument,
  CommandResult** — `src/cli/types.ts` (§2.2 adds `interrupted?`); **RunOptions, AcceptanceResult** —
  `src/acceptance/types.ts`.
- **Fixtures**: none read by the new examples (every literal is in the record; the child scripts and decks are built in
  the test). The new fixture files of §1 hold old literals moved out of the record.

**Distinct markers.** Reasons/logs `no acceptance` (PG 15), refusal `deck has 2 card(s) with no acceptance: q,d` (RC 12;
probe: 1 and 3 cards); signal names `SIGTERM` (RD 11, RA 6) against `SIGINT` (RD 12, Main 6), probe rows swap them;
blank acceptances `" \n"` (PG 15, RC 12) and `"\t"` (probe); marks `MARK_C` (PG 15); run ids `sig` (Main 6), `p6`
(probe) — the code must hard-code none of them. Interrupt fault text = `"interrupted by " + <the string>`: the probe
passes `"STOP-7"` through Run Deck to prove the string is not a signal-name table.

**A judge's setup across Components** (TASK_TEMPLATE §2.1):

- **F1** runloop · the stub processor answers request `<id>.v1` from `<answersDir>/<id>.v1.md`, else `<id>.md`; a card
  whose acceptance is null or blank sends nothing, so it needs no answer file · PG 15, RD 11–12.
- **F2** acceptance · a shell started by Run Acceptance is `/bin/sh -c`, a direct child of the node process that called
  runAcceptance: inside the acceptance `$PPID` is that node process, so `kill -TERM $PPID` signals it (the vitest process
  is never signalled: the node process is a child the test spawned) · RA 6, Main 6.
- **F3** cli · `node --import tsx <file.ts|.mts>` runs TypeScript with the repository's `node_modules/tsx` when its cwd
  is the repository (`tsx` is a devDependency; it adds no signal listener: measured 0 before and after a call); a `.mts`
  script may use top-level `await` (a `.ts` script outside the repository is CommonJS for tsx and refuses it) · RA 6,
  Main 6.
- **F4** git · `tmpRepo()` starts on `main` with one empty commit; the run's env needs a git identity (`gitEnv(home)`
  below, home = the repo root) · Main 6.
- **F5** processes · a pid counts as gone when `/proc/<pid>/stat` is absent or its third field is `Z`; a test that saw
  a pid kills it in `finally` (`process.kill(pid, "SIGKILL")` in try/catch) so a red run leaves no `sleep 30` behind;
  the tests never use a timer: the bound is `spawnSync`'s `timeout`.

**Harness skeletons** (each ≤ 10 lines, only from `tests/helpers.ts`, `node:*` and the types):

```ts
// run.p11c2 (run-acceptance-judge): the child script, written into a tmpRoot as child.mts; REPO = the repository root
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
s.write("child.mts", 'import { runAcceptance } from ' + JSON.stringify(path.join(REPO, "src/acceptance/run.ts")) + ';\n' +
  'const result = await runAcceptance(process.argv[2], process.argv[3], { env: { PATH: "/usr/bin:/bin" } });\n' +
  'process.stdout.write(JSON.stringify({ result, listeners: process.listenerCount("SIGINT") + process.listenerCount("SIGTERM") }) + "\\n");\n');
const res = spawnSync(process.execPath, ["--import", "tsx", s.path("child.mts"), command, root.root],
  { cwd: REPO, encoding: "utf8", timeout: 20000 });   // then pid = Number(root.read("sleep.pid").trim())
// main.p11c2 (main-judge): the entry under tsx, signalled by its own acceptance
const res = spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts", "run", "--root", r.root, "--deck", side.path("deck.json"),
  "--processor", "s", "--run-id", "sig"], { cwd: REPO, encoding: "utf8", timeout: 30000,
  env: { ...gitEnv(r.root), MORPH_PROCESSOR_s_TYPE: "stub", MORPH_PROCESSOR_s_ANSWERS_DIR: side.path("answers") } });
```

`gitEnv(home)` is the P11c skeleton: `{PATH: process.env.PATH ?? "", HOME: home, GIT_CONFIG_NOSYSTEM: "1",
GIT_AUTHOR_NAME: "Ada", GIT_AUTHOR_EMAIL: "ada@example.invalid", GIT_COMMITTER_NAME: "Ada", GIT_COMMITTER_EMAIL:
"ada@example.invalid"}`. The generation and runCommand patches use the harness already in their file (`harness()`,
`h.answer`, `card(id, targets, acceptance, contextSlice?)`, `fenced`; `setupRun`, `makeRunArgs`, `card(id, target,
extra)`); deck.p11c2 uses the P11c deck.p11c skeleton (`card`, `deps`, the `input` comment), with `now: () => 0` and the
interrupted function added to deps.

### 2.2. OUTPUT data shapes

**Process Generation** (`generation.ts`) — finding 4. In step 1, BEFORE compileCard: a card whose `acceptance` is null
or `acceptance.trim() === ""` gets `failedOutcome(customId, "no acceptance", "no acceptance")` — `{customId, status:
"failed", reason: "no acceptance", attempts: 1, winningVariant: null, acceptanceLog: "no acceptance", earlierFailures:
[], commit: null, diffstat: null}` — on the path of a compile fault: not compiled (it wins over a compile fault), no
request, no usage, no request row, no Variant Record, the commit hook not fired; its place in the input order kept;
retryContexts `{acceptanceOutput: "no acceptance", previousDiff: null}`. Every other card exactly as before (`?? ""`
stays harmless: it is never reached with null). Example 15: cards a (null), b (`" \n"`), c (`grep -q MARK_C out/c.ts`,
c.v1.md holding MARK_C), d (null, contextSlice `[docs/missing.md]`) → a, b, d failed "no acceptance"; c written;
requests one row `c.v1`; hook fired `["c"]`; retryContexts exactly `{a, b, d}` each `{acceptanceOutput: "no
acceptance", previousDiff: null}`; out/b.ts absent.

**`src/runloop/types.ts`** — `RunDeps` gains the optional LAST member `interrupted?: () => string | null`; nothing else.

**Run Deck** (`deck.ts`) — finding 6, the stop. Inside the try of P11c1, right before each deadline check — at the
top of each generation boundary (before `deps.now()`) and in the retry loop before the deadline check of a batch that
would run (after the "nothing to retry / cap reached" break) — `const s = deps.interrupted?.() ?? null`; `s !== null`
→ `throw new Error("interrupted by " + s)`, which the P11c1 catch turns into the fault: every card with no outcome
"skipped" reason "fault", decided cards kept, `report.fault` = "interrupted by <s>" as the last key. deps.interrupted
absent or always null → nothing changes (no call order of `now` changes).

| Run Deck example | deck, interrupted | outcomes / report |
|---|---|---|
| 11 | [a; b dependsOn a] on the stub, a accepted (`grep -q MARK_A a.ts`); null on the 1st call, "SIGTERM" after | a written; b skipped "fault" attempts 0; fault "interrupted by SIGTERM", last key; usageTotals.requests 1; interrupted called 2 times |
| 12 | one card c → c.ts "exit 1", answers c.md, c.r1.md; maxRetryBatches 2; null on the 1st call, "SIGINT" after | c failed "acceptance failed" attempts 1; fault "interrupted by SIGINT"; usageTotals.requests 1 (no retry batch) |

**Run Acceptance** (`run.ts`) — finding 6, the group. BEFORE the spawn: one listener function `onSignal(signal)` added
with `process.on("SIGINT", …)` and `process.on("SIGTERM", …)`; it records the FIRST signal's name and kills the group
exactly as the timeout does (`process.kill(-child.pid, "SIGKILL")` in try/catch) when the child exists; right after the
spawn, a signal already recorded kills the new group at once (measured: with the listeners added after the spawn, a
`kill $PPID` in the first milliseconds of the acceptance killed the node process — 0 of 5 runs survived; before the
spawn, 30 of 30). Both listeners are removed (`process.off`) in the "close" handler, in the "error" handler and in the
catch of a spawn that throws, before resolving: no listener outlives the call. On close after a signal: `exit` null, `timedOut` as
is (false unless the timer fired), the log = the clipped output (+ the timeout line when timed out), then a "\n" when it
is non-empty and does not end in one, then `"acceptance interrupted by " + <signal name> + "\n"`. While a listener is
present Node does not exit on that signal: the caller decides (Run Command, through `deps.interrupted`). Example 6: the
child of §2.1 F2–F3 with command `echo started; sleep 30 & echo $! > sleep.pid; kill -TERM $PPID; wait` → `status 0`,
stdout exactly `{"result":{"exit":null,"log":"started\nacceptance interrupted by SIGTERM\n","timedOut":false},"listeners":0}\n`,
the sleep of `root/sleep.pid` gone.

**`src/cli/types.ts`** — `CliDeps` gains the optional LAST member `interrupted?: () => string | null`; nothing else.

**Run Command** (`runCommand.ts`) — step 3, after the hazard check (hazard errors first) and before `deps.now()`: the
cards whose acceptance is null or blank (`trim() === ""`), in deck order → `{code: 2, document: errorDocument(2,
"RefusalError", "deck has " + n + " card(s) with no acceptance: " + ids.join(","))}` — before any git call or spend.
Step 6: Run Deck's deps get `interrupted: deps.interrupted` (as given; undefined when absent). Nothing else: a fault
(the stop included) is already code 3 with the partial report archived (P11c1). Example 12: example 1's setup, deck [x →
out/x.ts "true", q → out/q.ts (no acceptance key), d → out/d.ts `" \n"`] → `{code: 2, document: {error: {code: 2, kind:
"RefusalError", message: "deck has 2 card(s) with no acceptance: q,d"}}}`; no `morph/*` branch; no `.morph`. Run Command
example 4 (dirty tree) gives its card `{acceptance: "test -f out/a.ts"}` (the only change to that test).

**Main / the entry** (`src/cli.ts`) — before calling main: `let signalled: string | null = null`; one listener
`(signal) => { if (signalled === null) signalled = signal; }` on SIGINT and SIGTERM (`process.on`); deps gains
`interrupted: () => signalled` (as the last key). Nothing else changes (`process.exitCode = code`, never
`process.exit`, main.ts untouched). So the first SIGINT/SIGTERM during a run kills the running acceptance group (Run
Acceptance), the run stops at its next check with `fault` "interrupted by <SIG>", the partial report is archived and
the exit is 3. Example 6: Main 6 of the record → `status 3`; stdout one Run Document, `report.fault` "interrupted by
SIGINT", a "failed" "acceptance failed" (acceptanceLog ending "acceptance interrupted by SIGINT\n"), b "skipped"
"fault", `archive.ok` true, `archive.dir` ".morph/runs/sig"; stderr ends "morph run: exit 3\n"; the sleep gone; HEAD on
`morph/sig` with subject "morph run sig: deck and report"; `git status --porcelain` "".

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P11c2 runner"):

- **#5 4, blank counts as none**: null or whitespace-only — `sh -c "  "` exits 0 the same way; checked before compile
  so nothing is sent; reason and log "no acceptance" (the issue's text); no new CardStatus.
- **#5 4, the ripple**: shaped to the minimum, not avoided — the refusal sits after the hazard check (runCommand ex 5
  stays green), the generation test that pins the old behaviour is REPLACED by example 15 in the same file (dropped by
  name, every other test name kept), runCommand ex 4's card gains an acceptance; both judges return the whole file
  (generation.examples ~20 KB → `max_tokens` 28 000; runCommand.examples ~10 KB → 20 000), the two files are
  `fullExclude` from the code cards' generation to their judges'.
- **#5 4, Run Deck**: a "no acceptance" card is retried like any failed card (retries send nothing); Run Command's
  refusal makes this unreachable through the cli.
- **#5 6, before the spawn**: the listeners are added before `spawn` so no signal can fall between the child's start
  and the listener (a node process with no SIGTERM listener dies of it: measured, the in-acceptance `kill $PPID` won
  that race every time with the listeners after the spawn).
- **#5 6, where the listeners live**: Run Acceptance for the group (the layer that spawns it, `process` allowed there),
  the entry `src/cli.ts` for the run (only the entry touches `process` in cli; guard), handed down as
  `CliDeps.interrupted` → `RunDeps.interrupted` (a parameter, like the clock).
- **#5 6, the stop**: cooperative, at the points Run Deck already checks the deadline, through P11c1's fault path (no
  new status, the same archive, exit 3): the issue's "archives the partial report" with the outcomes so far. The calls in
  flight finish first (§7).
- **#5 6, tests**: no test signals the vitest process — a child node process signals itself from inside its own
  acceptance (`kill -<SIG> $PPID`), bounded by `spawnSync`'s timeout, no timer (guard), every seen pid killed in
  `finally`.

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/runloop/generation.ts` | no acceptance | probe only | PATCH `tests/runloop/generation.examples.test.ts` (PG 15 replaces the null-acceptance test) |
| `src/runloop/types.ts`, `deck.ts` | `interrupted?`; the stop | probe only | NEW `tests/runloop/deck.p11c2.examples.test.ts` (RD 11, 12) |
| `src/acceptance/run.ts` | signal listeners | probe only | NEW `tests/acceptance/run.p11c2.examples.test.ts` (RA 6) |
| `src/cli/types.ts`, `runCommand.ts` | `interrupted?`; the refusal; pass-through | probe only | PATCH `tests/cli/runCommand.examples.test.ts` (RC 12 added, ex 4's card gets an acceptance) |
| `src/cli.ts` | listeners, `interrupted` | probe only | NEW `tests/cli/main.p11c2.examples.test.ts` (Main 6) |

- `generation.examples`: the test "Process Generation: a null acceptance is the empty command and accepts" becomes, at
  the same place, "Process Generation example 15: no acceptance fails before any request" (the outcomes `toStrictEqual`,
  `g.requests.map(r => r.customId)` `["c.v1"]`, fired ids `["c"]`, `g.retryContexts` `toStrictEqual`, out/b.ts absent).
- `deck.p11c2`: "Run Deck example 11: …" (outcomes, `report.fault`, `Object.keys(report)` ending in `fault`, requests 1,
  the call count 2), "Run Deck example 12: …" (c's status, reason, attempts; fault; requests 1).
- `run.p11c2`: "Run Acceptance example 6: …" (status 0, `JSON.parse(stdout)` `toStrictEqual` the object, pid gone).
- `runCommand.examples`: "Run Command example 12: …" after the last test (the whole result `toStrictEqual`, no branch,
  no `.morph`).
- `main.p11c2`: "Main example 6: …" (status 3, the document's fault, outcomes' statuses, archive ok, stderr's last
  line, pid gone, HEAD's branch and subject, status clean).

### 2.4. What must not break

- Byte for byte: every file outside the 7 code targets, the 2 patched and 3 new test files; in particular
  `src/runloop/{resolve,retry}.ts`, `src/acceptance/{snapshot,verify,diff,types}.ts`, `src/cli/{main,parse,document,
  deckCheck,planCommand,readPlanChecks}.ts`, `src/git/*`, `src/cards/*`, `tests/helpers.ts` and every other test file.
- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/`, `.gitignore` — untouched by every card.
- 618 tests stay green at every card (the 2 rippled ones in `fullExclude` until their judges); after the run
  **620 − 1 + 1 + 2 + 1 + 1 + 1 = 625** in 80 files.

## 3. Acceptance

Built by `morph plan --checks decks/p11c2/checks.json`, narrow to broad, every stage printing `== <stage>`. `ownGit:
true` (git and run tests spawn git). `fullExclude`: `tests/runloop/generation.examples.test.ts`,
`tests/cli/runCommand.examples.test.ts` (ripple 2, red from the code cards of generation 0–1 to their judges).

Code cards (no test file, code-only targets, no smoke cap): `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs
src <targets>` → `decks/p11c2/parts/<card>.probe.ts` (process-generation PG 15 + 2 rows = 3; run-deck RD 11, 12 + 2 = 4;
run-acceptance RA 6 + 2 = 3; run-command RC 12 + 2 = 3; main Main 6 + 1 = 2; **15 tests**) → eslint's verdict → full
`vitest run` → own git → frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs tests <file> <min> <max> lits<n>.json` → names
kept (patched files) → `vitest run <targets>` → eslint's verdict → full run → own git → frozen → untracked.

| file | min | max | lits | drop |
|---|---|---|---|---|
| `tests/runloop/generation.examples.test.ts` (patch) | 16 | 18 | `Process Generation example 15`, `no acceptance`, `docs/missing.md`, `MARK_C` | the null-acceptance test |
| `tests/runloop/deck.p11c2.examples.test.ts` | 2 | 8 | `Run Deck example 11`, `Run Deck example 12`, `interrupted by SIGTERM`, `interrupted by SIGINT` | — |
| `tests/acceptance/run.p11c2.examples.test.ts` | 1 | 7 | `Run Acceptance example 6`, `kill -TERM $PPID`, `acceptance interrupted by SIGTERM`, `spawnSync` | — |
| `tests/cli/runCommand.examples.test.ts` (patch) | 10 | 12 | `Run Command example 12`, `deck has 2 card(s) with no acceptance: q,d` | — |
| `tests/cli/main.p11c2.examples.test.ts` | 1 | 7 | `Main example 6`, `kill -INT $PPID`, `interrupted by SIGINT`, `src/cli.ts` | — |

min = the file's tests after the change (new files: its record examples); max = min + 2 (patched) or + 6 (new).

**Output budget** (`max_tokens`, before the session's ×3 for `ds`): code = targets in tokens (≈ bytes / 3.5) × 2 +
2 500, rounded up; judges from the file they return.

| card | returns | `max_tokens` |
|---|---|---|
| process-generation | generation.ts ≈ 11.2 KB | 10 000 |
| run-deck | deck.ts ≈ 11.8 KB + types.ts 2.4 KB | 12 000 |
| run-acceptance | run.ts ≈ 5.0 KB | 8 000 (floor: ds thinks before the code) |
| run-command | runCommand.ts ≈ 5.6 KB + types.ts 2.0 KB | 8 000 |
| main | cli.ts ≈ 0.8 KB | 8 000 (floor) |
| process-generation-judge | generation.examples.test.ts ≈ 20.7 KB, whole | **28 000** |
| run-command-judge | runCommand.examples.test.ts ≈ 9.9 KB, whole | 20 000 |
| run-deck-judge, main-judge | ≈ 3–4 KB new file | 14 000 |
| run-acceptance-judge | ≈ 2–3 KB new file | 12 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- Layers unchanged: runloop writes nothing and touches no `process`; acceptance may use `process` (signals) but never
  `process.env`; in cli only `src/cli.ts` touches `process` (guard `PROCESS`, `CLI_ENTRY`).
- A file a card writes is in no sibling's slice in the same generation: generation 0 (run-deck writes
  `src/runloop/types.ts`) — process-generation's slice does not hold it; generation 1 (run-command writes
  `src/cli/types.ts`, runCommand.ts) — no judge of generation 1 reads them; generation 2 (main writes `src/cli.ts`) —
  run-command-judge does not read it.
- Tests write only under `tmpRoot()` / `tmpRepo()` and remove it in `finally`; no timer (`setTimeout` & co. are a guard
  error under `tests/`); a judge writes only its test file.
- Exact strings of the record and §2.2: the executor copies them.

## 7. Out of scope

- The calls in flight when a signal arrives: the generation's send finishes, the generation's other cards still run
  their acceptances (each further signal kills the one running); the stop comes at the next boundary or retry batch.
- A second signal forcing an exit (`process.exit` is forbidden in the entry by the guard): a hung transport needs
  SIGKILL. SIGHUP and SIGQUIT keep Node's default.
- Exit code 130/143 for a signal: the run is a fault, exit 3 (ExitCode 0–4 is the cli contract).
- `deck check` and `plan` warning about acceptance-less cards (plan cuts without `--checks` may leave none; a deck with
  them is refused only at `run`).

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component runloop --component acceptance \
  --component cli --judge --checks decks/p11c2/checks.json --out decks/p11c2/deck.json
python3 decks/p11c2/filter.py decks/p11c2/deck.json            # keeps the 10 cards of the phase
node dist/cli.js deck check --root . --deck decks/p11c2/deck.json                                  # errors 0
python3 decks/tools/scale_tokens.py decks/p11c2/deck.json 3    # the session, for processor ds
rm -rf /tmp/v2bin-p11c2 && mkdir -p /tmp/v2bin-p11c2 && cp -r dist /tmp/v2bin-p11c2/ && ln -s $PWD/node_modules /tmp/v2bin-p11c2/node_modules
node /tmp/v2bin-p11c2/dist/cli.js run --root . --deck decks/p11c2/deck.json --processor ds --deadline 2400
```

Cross-check (dry): from `morph-lab`, `venv/bin/mrph plan --spec <repo>/contour.yaml --map <repo>/morph-map.json
--component runloop --component acceptance --component cli --judge --root <repo>`.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 10 (5 code, 5 judges) / 4: [process-generation, run-acceptance, run-deck] [process-generation-judge, run-acceptance-judge, run-command, run-deck-judge] [main, run-command-judge] [main-judge] |
| executor bill | ≈ $0.08–0.15 on ds ×3 (P11c1: 12 cards, 20 requests, $0.0941; here two whole-file judges of 10 and 20 KB), ≤ $0.30 with a re-cut; cap $5 |
| cards with regeneration | 1–3 of 10 (process-generation-judge: a test name changed or the harness rewritten in the 20 KB file; run-acceptance: listeners not removed on "error"; main-judge: tsx resolution from the wrong cwd) |
| tests after the run | 625 ± 3 in 80 files |
| first red | run-acceptance: exit kept as the signal's code; run-deck: the check after `now()`; process-generation-judge: names kept |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no judge cut off at its `max_tokens`; (3) the V2 cut
equals the old mrph's dry cut in ids, dependsOn, generations, targets, slices and max_tokens; (4) after the run no test
file outside §2.3's five changed; (5) the run's own acceptances still run without the signal listeners (the running
binary predates the phase).

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the row of
`docs/MEASURE.md`; DECISIONS lines name "#5 <n>"; the merge closes issue #5.

## 11. Actual

### Gate (preparation)

(filled at the gate)
