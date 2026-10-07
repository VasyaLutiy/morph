# TASK_P10c2 — runner parity, the last item: every variant's request and raw answer in the run archive, one stderr line per variant (`src/runloop/`, `src/git/archive.ts`, `src/cli/runCommand.ts`, `src/cli/main.ts`)

> Phase P10c of `docs/PLAN.md` ("Фазы по записи (после P2)", row P10c), second half **P10c2** (the split is
> TASK_P10c §7). It answers issue #3 (label `P10c-runner`), list C, item **C4**; C1 was done in P9c, C2/C3/C5/C6/C7 in
> P10c1. Components of `contour.yaml`: `runloop` (Process Generation; Run Deck one sentence, no code), `git` (Archive
> Run) and `cli` (Run Command, Main; the record compacted first). Every change is a **patch** of code written in P5,
> P6, P7, P9b, P10c1; three judges write NEW test files, one patches the e2e test whose stderr changes. The deck is cut
> by V2 (`morph plan --checks decks/p10c2/checks.json`), filtered to this phase's 8 cards by `decks/p10c2/filter.py`.

## 1. Why this

- **C4.** A V2 run keeps no answer text: `report.json` has one Request Usage row per variant (`finishReason`,
  tokens), the outcome keeps the acceptance logs, and a rejected answer is rolled back. In P9c **2 of 10** first
  answers had an unclosed fence with `finish_reason: "stop"`, and nothing told an answer that stopped mid-file from one
  that was whole and only forgot its closing fence: the text was gone. Old mrph keeps each attempt's raw
  answer and its request under the run directory. During a 17-minute run (P10c1: 1025 s, 12 requests) the V2 binary
  prints nothing on stderr until the exit line: the stage each variant reached (`== tsc`, `== probe`, …; P10c1 exported
  `stageCount` for it) is known only after the run, from the report's logs.
- **cli size.** Component `cli` was at **29 999** of the 30 000-byte rule (P10b2); compacted first (commit a17098f:
  two whole-result literals sets moved to `tests/fixtures/cli/{parse,deckCheck.writeWrite}.json`, two behaviours
  reworded with every rule kept) to **28 450**, then this phase brings it to **29 836**. runloop 26 223 → **29 179**,
  git 13 387 → **15 186**.

**Ripple, measured** (reference of the 6 code files in a scratch worktree, full suite): **1 of 578** tests red —
`tests/cli/main.examples.test.ts` "Main example 4" (the e2e binary's stderr now carries the two variant lines). Every
other shape is optional or additive: `RunDeps.onVariant?`, `ArchiveInput.answers?`, `runCommand(…, log?)`; the Run
Report, the Run Document, the Archive Result and every trailer are unchanged.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Card**, **Deck** — `src/cards/types.ts`; **Request**, **Message** — `src/compiler/types.ts` (`Request = {customId,
  model, maxTokens, reasoning, messages}`, customId `"<cardId>.v<n>"`, a retry's `"<cardId>.r<k>.v<n>"`).
- **Answer** — `src/processor/types.ts`: `{customId, text: string | null, finishReason: string | null, error: string |
  null}`. The stub answers request `<id>` from `<answersDir>/<id>.md`, else `<answersDir>/<id without .v<n>>.md`, with
  `finishReason "stop"`; none → `{text: null, finishReason: null, error: "stub has no answer: " + path.join(answersDir,
  "<id>.md")}`.
- **VariantResult**, **VerifyOutcome** — `src/acceptance/types.ts`: Verify Card tries the variants in order and STOPS
  at the first accepted one (later variants get no result); an accepted result has `diff: null`, a rejected one a diff
  string, a corrupt or truncated one `{exit: null, diff: null}`.
- **RunDeps**, **VariantRecord** — `src/runloop/types.ts` (§2.2); **ArchiveInput**, **ArchivedAnswer** —
  `src/git/types.ts` (§2.2); **CliDeps**, **CliIo**, **RunArgs** — `src/cli/types.ts` (unchanged).

**Fixtures**: none new for the judges (every literal is in the record and below). `tests/fixtures/cli/parse.json` and
`deckCheck.writeWrite.json` are data of the compaction only (no test reads them yet; checked equal to the live
results of Parse Command 1, 2, 9, 10, 12 and Deck Check 1).

**A judge's setup across Components** (TASK_TEMPLATE §2.1):

- **F1** processor · the stub has no answer file for `d.v1` (and none for `d.md`) → text null, finishReason null, error
  "stub has no answer: <answersDir>/d.v1.md" · Process Generation 13 (a corrupt record).
- **F2** compiler · a contextSlice file must exist or Compile Card faults before the stale check (P5 lesson): in PG 13
  `shared.ts` is written BEFORE the generation; card e's missing `docs/missing.md` is the compile fault · PG 13.
- **F3** acceptance · Verify Card stops at the first accepted variant: in PG 13 a.v2 is "untried" (its record still
  carries a.v2.md's text); the stage headers are the lines that begin `== ` (`echo '== tsc'` logs `== tsc\n`) · PG 12, 13.
- **F4** git · `tmpRepo()` of `tests/helpers.ts` starts on `main` with one commit; `r.git([...])` returns trimmed stdout;
  `git show --name-only --format= HEAD` lists the committed paths sorted by path · Archive Run 4, Run Command 8.
- **F5** runloop · a retry is card `a.r1` with requests `a.r1.v1`…; its last message holds `<acceptance_output>`; the
  stub answers `a.r1.v1` from `a.r1.md` · Run Command 8.

**Distinct markers.** Answers `ONE`, `TWO`, `B` and the 30-char `"```ts\nexport const a = 1;\n```\n"`; record ids
`a.v1`, `a.v2`, `b.v1`, `c.v1`, `d.v1`, `b.r1.v2`; none is a substring of another where a test greps.

**Harness skeletons** (each judge writes a NEW file, ≤ 10 lines of setup, only from `tests/helpers.ts`):

```ts
// generation.p10c2: a RunDeps literal over the stub, recording the hook's calls
const t = tmpRoot("morph-p10c2-"); const records: VariantRecord[] = [];
const deps: RunDeps = { config: { id: "stub", type: "stub", model: "stub", apiKey: null, baseUrl: "https://openrouter.ai/api/v1",
  route: "sync", concurrency: 4, providerOrder: null, reasoning: null, timeoutMs: 600000, maxRetries: 0, answersDir: t.path("answers") },
  transport: { fetch: fakeFetch().fetch, sleep: async (): Promise<void> => {} },
  commit: (id, targets) => ({ commit: "sha-" + id, diffstat: { files: targets.length, insertions: 1, deletions: 0 } }),
  now: (): number => 1000, env: { PATH: process.env.PATH ?? "" }, onVariant: (r) => { records.push(r); } };
// archive.p10c2 / runCommand.p10c2: the git env of every P6/P7 test
const gitEnv = (home: string): Record<string, string> => ({ PATH: process.env.PATH ?? "", HOME: home, GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Ada", GIT_AUTHOR_EMAIL: "ada@example.invalid", GIT_COMMITTER_NAME: "Ada", GIT_COMMITTER_EMAIL: "ada@example.invalid" });
// runCommand.p10c2 adds MORPH_PROCESSOR_s_TYPE "stub", MORPH_PROCESSOR_s_ANSWERS_DIR side.path("answers"); the deck file and the
// answers live in a side tmpRoot; CliDeps {env, now: () => 1791310149000, cwd: r.root, transport: null}
```

### 2.2. OUTPUT data shapes

**`src/runloop/types.ts`** — two new exports and ONE optional last member of RunDeps; nothing else changes:

```ts
import type { Request } from "../compiler/types.js";
export type VariantVerdict = "accepted" | "rejected" | "corrupt" | "truncated" | "untried" | "stale";
export interface VariantRecord {
  request: Request; text: string | null; finishReason: string | null; error: string | null;
  verdict: VariantVerdict; stages: number; lastStage: string | null;
}
export interface RunDeps {
  config: ProcessorConfig; transport: Transport; commit: CommitHook;
  now: () => number; env: Record<string, string>; acceptanceTimeoutMs?: number;
  onVariant?: (record: VariantRecord) => void;
}
```

**`processGeneration`** (`src/runloop/generation.ts`) — every P5–P10c1 rule unchanged; when `deps.onVariant` is set,
it is called once per request SENT, with `request` = that Request object (the one compileCard returned and
sendGeneration got), `text`/`finishReason`/`error` = its Answer's. When: right after the card is decided — a stale
card after its stale outcome; a verified card after verifyCard and, if accepted, after its commit hook — and before the
next card is verified; within a card in variant order. Verdict, in this order: the card is stale → `"stale"`; the
parsed answer is `{corrupt}` (a null text included) → `"corrupt"`; `{truncated}` → `"truncated"`; no VariantResult for
it → `"untried"`; it is `outcome.accepted.variant` → `"accepted"`; else `"rejected"`. For accepted and rejected,
`stages = stageCount(result.log)` and `lastStage = lastStage(result.log)`; for the others `0` and `null`. A compile
fault sends nothing: no record. The file exports

```ts
export function lastStage(log: string): string | null   // the text after "== " of the LAST line that starts with "== "
```

`lastStage("== tsc\n== probe\nred\n")` = `"probe"`, `lastStage("")` = `null`, `lastStage("a == b\n== eslint failed (see
above)\n")` = `"eslint failed (see above)"`, `lastStage("== tsc\n ==x\n==full\n")` = `"tsc"`, `lastStage("x\n== full")` =
`"full"`. A timed-out acceptance is a rejected variant whose log holds its headers (`echo '== tsc'; sleep 30` under a
300 ms timeout → stages 1, lastStage "tsc").

| record (PG 13, cards a v2, b, c, d, e) | verdict | stages, lastStage | text |
|---|---|---|---|
| a.v1 (acceptance `grep -q ONE shared.ts` passes) | accepted | 0, null | a.v1.md |
| a.v2 (Verify Card stopped at a.v1) | untried | 0, null | a.v2.md |
| b.v1 (contextSlice shared.ts, written by a) | stale | 0, null | b.v1.md |
| c.v1 (`"```ts\nexport const x = 2;\n"`) | truncated | 0, null | that text |
| d.v1 (no answer file) | corrupt | 0, null | null (finishReason null, error "stub has no answer: …/d.v1.md") |
| e (contextSlice docs/missing.md) | — no record | | |

**`runDeck`** — no code change: `deps` reaches every processGeneration call as given, so the retries' variants are
recorded too (record sentence only).

**`src/git/types.ts`** — one new type and ONE optional last member:

```ts
export interface ArchivedAnswer { request: { customId: string }; text: string | null }
export interface ArchiveInput { runId: string; deck: Deck; report: ArchivedReport; answers?: ArchivedAnswer[] }
```

(structural: runloop's `VariantRecord[]` is assignable; git imports nothing of runloop.)

**`archiveRun`** (`src/git/archive.ts`) — in order: the runId check (unchanged); then every answer's
`request.customId` against `^[A-Za-z0-9._-]+$`, the first that fails → `{ok: false, error: "invalid answer id: <id>"}`;
then "already exists" (**unchanged**: the answers travel in memory to the archive, so the directory never exists before
it). No refusal writes anything. Then deck.json, report.json as before; then, per answer in order,
`<dir>/answers/<customId>.request.json` = `JSON.stringify(answer.request, null, 2) + "\n"` (the whole object it is
given) and, when `text !== null`, `<dir>/answers/<customId>.answer.txt` = `text` byte for byte (no newline added; `""`
gives an empty file). `answers` absent or `[]` → no `answers/` directory, the P6 archive exactly. Commit Paths over
`[deck.json, report.json, then each answer's request.json and answer.txt in the order written]`, same subject, same
trailers (no new trailer); the Archive Result shape is unchanged.

**`runCommand`** (`src/cli/runCommand.ts`) — signature `runCommand(root: string, args: RunArgs, deps: CliDeps, log?:
(text: string) => void): Promise<CommandResult>`; steps 1–5 unchanged; step 6 adds to Run Deck's deps
`onVariant: (record) => { records.push(record); if (log !== undefined) log(variantLine(record)); }` (records collected
with or without a log); step 7 `archiveRun(root, {runId, deck, report: result.report, answers: records}, deps.env)`.
The Run Document is unchanged. The file exports

```ts
export function variantLine(record: VariantRecord): string
// "morph run: " + request.customId + " " + verdict + " stage " + stages + (lastStage === null ? "" : " " + lastStage)
//   + " finish " + (finishReason ?? "none") + " chars " + (text === null ? "none" : String(text.length)) + "\n"
```

`morph run: a.v1 rejected stage 4 probe finish stop chars 30`, `morph run: b.r1.v2 corrupt stage 0 finish none chars
none`. A `truncated … finish stop` line points at its `answers/<variant>.answer.txt`: whether the file body ends whole
(a forgotten closing fence) or mid-statement (stopped mid-file) is read off its tail — the purpose of C4; `finish
length` names a cut at `max_tokens` at once.

**`main`** (`src/cli/main.ts`) — one change: `result = await runCommand(root, command, deps, io.stderr)`. A run's
stderr is then one line per variant, in the order recorded, then `morph run: exit <code>\n`; deck check, plan and the
usage errors keep their one line. `src/cli.ts` is unchanged.

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P10c2 runner", naming #3 C4):

- Layout: two files per variant under `.morph/runs/<id>/answers/`, named by the request id (`a.v1`, `a.r1.v2`):
  `<id>.request.json` (the Request as sent, JSON) and `<id>.answer.txt` (the raw text, only when not null) — not one
  JSON per variant: the raw text must be readable with `tail` as the processor returned it, escaping hides an unclosed
  fence; finishReason and tokens are already in report.json's `requests` rows.
- Transport: a hook `RunDeps.onVariant?` fired by Process Generation (real time: the stderr line appears while the run
  goes), the records kept by Run Command and passed to Archive Run as `answers?`; not a Run Report field (report.json
  would carry every prompt twice and the P5–P10c1 tests compare reports whole) and not a separate return of runDeck
  (RunResult is compared whole in the runloop tests). Optional members: ripple 1 test (the e2e stderr), measured.
- Archive Run: "already exists" unchanged (the directory is written once, at the end); a new refusal "invalid answer
  id" (an id becomes a path); no new trailer (the P6 examples compare the message whole).
- The stderr line: `morph run: <variant> <verdict> stage <n>[ <last stage>] finish <reason|none> chars <n|none>`, printed
  by Run Command through an optional `log` that Main sets to `io.stderr`; `CliDeps` unchanged (its literals are built
  whole in the P7 tests).
- `--acceptance-timeout`: **not added** — Parse Command's tests compare whole run commands (a new key reddens 2) and cli
  would pass 30 000 bytes; the acceptance keeps RunDeps' default 300 s.

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/runloop/types.ts`, `src/runloop/generation.ts` | VariantRecord, onVariant, lastStage | probe only | NEW `tests/runloop/generation.p10c2.examples.test.ts` (PG 12–13) |
| `src/git/types.ts`, `src/git/archive.ts` | answers/ | probe only | NEW `tests/git/archive.p10c2.examples.test.ts` (AR 4–5) |
| `src/cli/runCommand.ts` | log, records, variantLine | probe only | NEW `tests/cli/runCommand.p10c2.examples.test.ts` (RC 7–8) |
| `src/cli/main.ts` | io.stderr to runCommand | probe only | PATCH `tests/cli/main.examples.test.ts` (Main 4's stderr) |

- `generation.p10c2.examples.test.ts`: "Process Generation example 12: …" (records `toStrictEqual` the two records,
  `request` = `compileCard(card a, t.root)` requests taken before the generation; the five `lastStage` values) and
  "Process Generation example 13: …" (the verdict table above; stages 0 and lastStage null for every record; a.v2's
  text; d.v1's error; no record whose request id starts with `e.`).
- `archive.p10c2.examples.test.ts`: "Archive Run example 4: …" (`git checkout -q -b morph/r1` first; the three answer
  files' texts; no b.v1.answer.txt; the committed paths; the HEAD message of example 1) and "Archive Run example 5: …".
- `runCommand.p10c2.examples.test.ts`: "Run Command example 7: …" (two `toBe`) and "Run Command example 8: …" (one card
  a, acceptance `exit 1`, maxRetryBatches 1, answers `a.md` and `a.r1.md` in the side root; the log `toStrictEqual`; the
  archive commit's paths; the retry request's last message).
- `main.examples.test.ts` (5 tests, unchanged count): in "Main example 4" only the stderr expectation changes, to
  `"morph run: a.v1 accepted stage 0 finish stop chars 30\nmorph run: b.v1 accepted stage 0 finish stop chars 30\nmorph
  run: exit 0\n"` (the file's a.md and b.md are 30 chars each). Nothing else changes.

Strings with `toBe`; a whole record or result with `toStrictEqual`; a literal holding a single quote goes in a
double-quoted string. No `vi.*`, no timers, no variable named `fetch` or `Fake*`; import only what you use (eslint).

### 2.4. What must not break

- Byte for byte: every file outside the 6 code targets and the 4 test files of §2.3 — `src/runloop/{deck,resolve,
  retry}.ts`, `src/git/{run,branch,commit}.ts`, `src/cli/{parse,types,document,deckCheck,planCommand,readPlanChecks}.ts`,
  `src/cli.ts`, `tests/helpers.ts`, every existing test file but `main.examples`.
- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/` — untouched by every card.
- The 578 tests stay green except Main example 4 (red from the main card to its judge); after the run **578 + 2–3 + 2 +
  2 = 584–585** in 64 files (the reference judges: 585).

## 3. Acceptance

Built by `morph plan --checks decks/p10c2/checks.json` (Component `builder`; the checks document in the form of Read
Checks), narrow to broad, every stage printing `== <stage>`. `ownGit: true` (every git and run test spawns git in a tmp
repo; the chain checks this repository's HEAD and refs before and after). `fullExclude` = `tests/cli/main.examples.test.ts`
(the one rippled file: red from the main card, generation 2, to main-judge, generation 3).

Code cards (no test file, code-only targets, no smoke cap): `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs src
<targets>` → `decks/p10c2/parts/<card>.probe.ts` (process-generation: PG 12 (2 tests), 13 + 3 rows = 6;
archive-run: AR 4, 5 + 4 rows = 6; run-command: RC 7, 8 + 3 rows = 5; main: 3 rows; **20 tests**) → eslint's verdict →
full `vitest run` minus fullExclude → own git → frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs tests <file> <min> <max> lits<n>.json` → (main
only) every test name at HEAD still there → `vitest run <targets>` → eslint's verdict → full run → own git → frozen →
untracked.

| file | new | min | max | lits |
|---|---|---|---|---|
| `tests/runloop/generation.p10c2.examples.test.ts` | yes | 2 | 8 | `Process Generation example 12`, `Process Generation example 13`, `onVariant`, `lastStage`, `untried`, `stale`, `truncated`, `stub has no answer` |
| `tests/git/archive.p10c2.examples.test.ts` | yes | 2 | 8 | `Archive Run example 4`, `Archive Run example 5`, `a.v1.request.json`, `a.v1.answer.txt`, `invalid answer id: ../x` |
| `tests/cli/runCommand.p10c2.examples.test.ts` | yes | 2 | 8 | `Run Command example 7`, `Run Command example 8`, `variantLine`, `morph run: a.v1 rejected stage 4 probe finish stop chars 30`, `morph run: b.r1.v2 corrupt stage 0 finish none chars none`, `a.r1.v1.request.json` |
| `tests/cli/main.examples.test.ts` | no | 5 | 9 | `morph run: a.v1 accepted stage 0 finish stop chars 30`, `morph run: b.v1 accepted stage 0 finish stop chars 30` |

min = the file's record examples; max = min + 6 (new files) or its tests + 4 (main).

**Output budget per card** (`max_tokens`): code = the reference targets in tokens (≈ bytes / 3.5) × 2 + 2 500
reasoning, rounded up; judges by the file they return (the judge with the most examples, Process Generation's 13,
20 000).

| card | returns | `max_tokens` |
|---|---|---|
| process-generation | types.ts 2.4 KB + generation.ts 9.4 KB | 16 000 |
| archive-run | types.ts 1.0 KB + archive.ts 2.7 KB | 8 000 |
| run-command | runCommand.ts ≈ 4.4 KB | 10 000 |
| main | main.ts ≈ 1.3 KB | 6 000 |
| process-generation-judge | ≈ 5.5 KB | 20 000 |
| archive-run-judge | ≈ 4.8 KB | 16 000 |
| run-command-judge | ≈ 4.5 KB | 16 000 |
| main-judge | main.examples ≈ 6.8 KB | 16 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- Layers unchanged: `git` imports `cards` only (ArchivedAnswer is structural, no runloop import); `runloop` writes no
  file (the hook is the caller's); `cli` writes through git and its `log`. No new `src/` folder (guard layers unchanged).
- A file a card writes is in no sibling's slice in the same generation: run-command (gen 1) depends on
  process-generation and archive-run (their types.ts); main (gen 2) depends on run-command; no gen-1 judge has
  `src/cli/runCommand.ts` in its slice, no gen-2 card has `src/cli/main.ts` but main itself.
- Tests write only under a `tmpRoot()` / `tmpRepo()` and remove it in `finally`; a judge writes only its test file.
- Exact strings of the record and §2.2 (the line format, "invalid answer id: ", the file names): the executor copies them.

## 7. Out of scope

- A `--acceptance-timeout` flag (gap above); renaming `--max-retry-batches`.
- Usage (tokens, provider) in the answer files: report.json's `requests` rows hold them, keyed by the same id.
- Pruning or compressing answers/ (a run of P10c1's size: 12 requests, ≈ 0.4–1 MB of request JSON; measured after the
  first run, a later phase if it matters).
- Archive Run before the run ends (a crash keeps no answers; the stderr lines survive in the log).
- The judge harness generated from `tests/helpers.ts` (P10b2 deferred it; issue #3 `P10-planner` items stay open there).

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component runloop --component git \
  --component cli --judge --checks decks/p10c2/checks.json --out decks/p10c2/deck.json
python3 decks/p10c2/filter.py decks/p10c2/deck.json            # keeps the 8 cards of the phase
node dist/cli.js deck check --root . --deck decks/p10c2/deck.json                                  # errors 0
rm -rf /tmp/v2bin-p10c2 && mkdir -p /tmp/v2bin-p10c2 && cp -r dist /tmp/v2bin-p10c2/ && ln -s $PWD/node_modules /tmp/v2bin-p10c2/node_modules
node /tmp/v2bin-p10c2/dist/cli.js run --root . --deck decks/p10c2/deck.json --processor glm53 --deadline 2400
```

Cross-check (dry): from `morph-lab`, `venv/bin/mrph plan --spec <repo>/contour.yaml --map <repo>/morph-map.json
--component runloop --component git --component cli --judge --root <repo>`.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 8 (4 code, 4 judges) / 4: [archive-run, process-generation] [archive-run-judge, process-generation-judge, run-command] [main, run-command-judge] [main-judge] |
| executor bill | ≈ $0.10 nominal (12 first requests of 8–25k in / 2–6k out, ≈ 3 retries), ≤ $0.35 with a re-cut; cap $5 |
| cards with regeneration | 1–3 of 8 (process-generation: the record fired before the commit hook, or a.v2 "rejected" instead of "untried"; process-generation-judge: the compileCard request equality; run-command-judge: the sorted path list) |
| tests after the run | 584–585 in 64 files |
| first red | process-generation: `"corrupt"` decided from `result.log` instead of the parsed answer; archive-run: `\n` appended to answer.txt; run-command: the log line without its `\n` |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no judge cut off at its `max_tokens`; (3) the V2 cut
equals the old mrph's dry cut in ids, dependsOn, generations, targets, slices and max_tokens; (4) after the run no test
file outside §2.3's four changed; (5) the run's own archive (`.morph/runs/<id>/answers/`) is still the P6 one — the
binary that runs the deck is today's.

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the row of
`docs/MEASURE.md`; the DECISIONS lines name issue #3 C4; **the merge of this phase closes issue #3 list C** (C1–C7 all
built), so the merge closes issue #3.

## 11. Actual

### Gate (preparation)

07.10, on the VPS, by the preparing orchestrator (Opus 5.5); no paid run. Data commits a17098f (cli compaction 29 999 →
28 450 bytes), e08e9b6 (spec, record, map, checks, probes, deck), b58259c (archive-run probe row moved out, deck re-cut).
Component sizes after the patch: runloop 29 179, git 15 186, cli 29 836 (≤ 30 000 each).

The deck **cut by V2**: `node dist/cli.js plan --component runloop --component git --component cli --judge --checks
decks/p10c2/checks.json --out decks/p10c2/deck.json` exit 0, 30 cards, filtered by `decks/p10c2/filter.py` to 8;
generations `[archive-run, process-generation] [archive-run-judge, process-generation-judge, run-command] [main,
run-command-judge] [main-judge]`; `node dist/cli.js deck check` 0 errors / 0 warnings / 0 hazards. Cross-check: the old
`mrph plan --spec … --component runloop --component git --component cli --judge` (dry) gives the same 30 ids and the same
4 generations; dependsOn, targets, slices, intent, variants equal on all 30; max_tokens equal on the 8 phase cards (1
card outside the phase differs, resolve-judge: V2's P10a judge formula); reasoning 2 500 everywhere; instructions differ
on all 30 (the P10a design). Acceptances: the 8 phase cards have no map override, so mrph prints its old default
(`npx tsc --noEmit`) and V2 the builder's acceptance from checks.json — checked by the chains below, as in P10c1; outside
the phase run-deck and run-deck-judge differ the same way (their overrides were removed in P10c1), the other 20 equal.

Scratch worktree from b58259c (references of the 6 code targets and the 4 test files, deleted afterwards), cards run in
deck order with the deck's own acceptances, each accepted card committed before the next: **8 of 8 chains green, 32.2–39.6 s
each (274.1 s in all; limit 250 s per chain)**; the final tree `tsc`, `eslint src tests`, `npm run build` clean, `vitest
run` **585 / 585** in 64 files (578 + 7). Ripple as measured (§1): 1 test (Main example 4, the one fullExclude file), no
other old test red in any full step. Typed one-line throwing stubs (`Error: stub <fn> <args>`; both types.ts as
specified): every code card red at the probe — process-generation 5 of 6, archive-run 5 of 6, run-command 4 of 5 (the type
row passes on typed stubs each), main 3 of 3; **all 6 new record examples red** (PG 12 in two tests, PG 13, AR 4, AR 5, RC
7, RC 8) and the Main row, each with a readable line; chains 8.1–8.6 s. Judges: the three new files absent → red at the
guard ("… missing", 5.4–6.0 s); main-judge with main.examples unpatched (HEAD) → red at the guard (both example
literals, 7.1 s). Mutation check: 22 single-rule mutations of the references (process-generation 10, archive-run 6,
run-command 5, main 1) — **21 killed** by the card's probe; the survivor (`ran = verdict !== "untried"`) is equivalent on
every reachable input (a corrupt or truncated variant's log is one line without a `== ` header, a stale one has no
result). One probe defect found by the first chain and fixed as data (b58259c): archive-run's probe imported
`VariantRecord`, a generation-0 sibling's target; the assignability is checked by run-command's tsc instead.

Max slice + targets: process-generation-judge 43 157 bytes (gate 200 KB). Forecast ≈ $0.12 (P10c1: 8 cards, 12 requests,
$0.1289; here 12 first requests, slices 33–43 KB, ≈ 2–3 retries), ≤ $1. Gate holds.

**Retry cap.** Today's binary (main 36dd9aa = P10c1 merged; b58259c adds data only) caps the retry batches per
generation, 2 retries per card: the default `--max-retry-batches 2` gives every generation the old runner's 2 rounds, so
the flag is **not** passed (recommended: the default; the run is also the first live check of C2 on a red card).

**Run command** (from the repo root, the binary copied first):

```
npm run build && rm -rf /tmp/v2bin-p10c2 && mkdir -p /tmp/v2bin-p10c2 && cp -r dist /tmp/v2bin-p10c2/ && ln -s $PWD/node_modules /tmp/v2bin-p10c2/node_modules
node /tmp/v2bin-p10c2/dist/cli.js run --root . --deck decks/p10c2/deck.json --processor glm53 --deadline 2400 > /tmp/p10c2-run.json
```

The merge of this phase's run closes issue #3: list C (C1–C7) is then built in full.
