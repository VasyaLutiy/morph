# TASK_P10c — runner parity: retries per card, the furthest variant, tagged slices, the acceptance's own timeout, the old truncation text (`src/runloop/`, `src/compiler/compile.ts`, `src/acceptance/verify.ts`)

> Phase P10c of `docs/PLAN.md` ("Фазы по записи (после P2)", row P10c), prepared as **P10c1** (the split is in
> §7). It answers issue #3 (label `P10c-runner`), list C: **C2, C3, C5, C6, C7**; C1 was done in P9c; **C4** (raw
> answers under `.morph/runs/<id>/answers/` + one stderr line per variant) is P10c2. Components of `contour.yaml`:
> `runloop` (Process Generation, Run Deck; Build Retry's description only), `compiler` (Compile Card) and
> `acceptance` (Verify Card: the truncation stand-in lives there). Every change is a **patch** of code written in
> P2, P3, P5, P9b, P9c; the test files that pin the old behaviour are patched by their judges. The deck is cut by V2
> (`morph plan --checks decks/p10c/checks.json`), filtered to this phase's 8 cards by `decks/p10c/filter.py`.

## 1. Why this

The switch test (07.10, P9 deck replayed on the V2 binary, `/tmp/p9replay{,2,3}`) and the P9c/P10a–P10b2 runs
measured five differences between V2's runner and the old one (issue #3 C2–C7):

- **C2.** `--max-retry-batches` defaults to **2 for the whole run**: in replay 3 the last generation got no retry
  and `load-spec-judge` failed on attempt 1. Every V2 run since P10a needed `--max-retry-batches 8` (MEASURE rows
  P10a, P10b1, P10b2, the P10b2 smoke). The old runner: 2 retries per card in every generation.
- **C3.** The retry context is the LAST variant that ran. In the P10b2 control run the first attempt of a card was
  probe-green 13/13 and red only at eslint, and the retry was built from a variant red at tsc. The acceptance prints
  `== <stage>` before every stage (tsc, eslint, guard, probe, full, frozen): the furthest variant is countable.
- **C5.** Slice files go into the prompt as ```` ```md ```` fences. TASK files carry fences of their own (TASK_P9b
  and TASK_P10b2: **12** fence lines each, TASK_P10a 10), so the exhibit is visibly unpaired. Old mrph wraps every
  slice file in a named tag for a measured reason (`cards/compiler.py:467-484`, run `store-v6` 2026-09-28).
- **C6.** `runloop/generation.ts` passes the processor's HTTP `timeoutMs` (**600 000 ms**) to the acceptance; the
  old runner's acceptance timeout is its own, **300 s** (`run_acceptance(..., timeout=300.0)`).
- **C7.** A cut-off answer is retried with the two words `answer truncated`; 2 of 10 first answers in P9c had an
  unclosed fence. The old runner says what happened and what to do (`TRUNCATED_RESPONSE_MESSAGE`, 3 sentences,
  `cards/generations.py:336`).

**Ripple, measured** (crude mutation of the four targets in a scratch worktree, full suite): **9 of 571** tests
red, all in **5 files**: `compile.examples` 3 (C5), `verify.examples` 2, `generation.p9b.examples` 2,
`deck.p9b.examples` 1 (C7), `generation.examples` 1 (C6: an own test pins the old HTTP-timeout rule). C2 and C3 redden
nothing (C3's tie rule keeps P9b/P9c's "the last one" whenever no stage header is printed).

PLAN: P10c1 = **8 cards** (4 code patches, 4 judge patches), 3 generations, **9 new record examples** (Compile Card
4–5, Verify Card 4, Process Generation 9–11, Run Deck 6–7) and **4 rewritten** (Compile Card 1–2, Verify Card 2's
stand-in, Process Generation 4 and 6's stand-in).

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Card** — `src/cards/types.ts`: every field set by the test (no defaults in the run loop).
- **Request**, **Message**, **ParsedAnswer** — `src/compiler/types.ts`: `ParsedAnswer = {files} | {corrupt: string} |
  {truncated: true}`.
- **VariantResult**, **VerifyInput** — `src/acceptance/types.ts`: `VariantResult = {variant, exit: number | null, log:
  string, diff: string | null}`; `VerifyInput.timeoutMs?: number`.
- **DEFAULT_TIMEOUT_MS** — exported by `src/acceptance/run.ts`, `export const DEFAULT_TIMEOUT_MS = 300000;` (Run
  Acceptance's default; `runAcceptance` uses it when `timeoutMs` is undefined).
- **RunDeps, RunInput, RunBudget, RetryContext** — `src/runloop/types.ts` (RunDeps changes, §2.2).

**Fixtures** (data, committed before the run; read with `fixtureJson` / `fixturePath` of `tests/helpers.ts`):

| file | type | what it is | used by |
|---|---|---|---|
| `tests/fixtures/compiler/project/docs/F.md` | text, 28 bytes | `"# F\n\n```ts\nconst f = 1;\n```"`: a fence inside, **no final newline** | Compile Card 4 (a slice file of the root `compiler/project`) |
| `tests/fixtures/compiler/cards/fencedF.json` | one card (validated by `validateCard`) | `{customId "f", generate, targets [src/f.ts], contextSlice [docs/F.md], instruction "Write src/f.ts."}` | Compile Card 4 |
| `tests/fixtures/compiler/cards/{generateA,patchP,missingSlice,patchNew}.json` | one card each | unchanged (P2) | Compile Card 1, 2, 3, 5 |

`compiler/project` holds `docs/A.md` = `"# A\n\nAlpha doc.\n"`, `docs/B.md` = `"# B\n\nBeta doc.\n"`, `src/x.ts` =
the 3 lines `export const x = 1;` / `y = 2` / `z = 3`, each with `\n` (60 bytes), and now `docs/F.md`. No test globs
the directory.

**A judge's setup across Components** (TASK_TEMPLATE §2.1):

- **F1** acceptance · Run Acceptance runs the command under `/bin/sh` in `root`, stdout and stderr merged; `echo '==
  tsc'` logs `== tsc\n`. A command killed at its timeout logs, after its output, `acceptance timed out after <ms>
  ms\n` · Process Generation 9, 11.
- **F2** acceptance · Verify Card tries the variants in order and gives a variant that ran a `diff` string (`""`
  when the file did not change), a corrupt or truncated one `diff: null` · Process Generation 9 and the §2.2 tie rows.
- **F3** processor · the stub processor answers request `<id>.v<n>` from `<answersDir>/<id>.v<n>.md`, else
  `<answersDir>/<id>.md`; a retry's requests are `<id>.r<k>.v<n>` (answers `<id>.r<k>.md`) · Run Deck 6, 7.
- **F4** runloop · a marker file that is not a target survives the rollback of a rejected variant (Verify Card
  restores only the targets): `if [ ! -f mark-a ]; then touch mark-a; exit 1; fi` fails once, then passes · Run Deck 6.

**Distinct markers.** Stage headers are lines that begin `== ` (equals, equals, space); `a == b` and ` == tsc` and
`==tsc` are not headers. The judges' markers `ONE`, `TWO`, `PASS`, `MARK_A`, `MARK_B`, `MARK_C` are distinct and none
is a substring of another (`mark-a`/`mark-b` are file names).

**Each judge PATCHES a file that already holds its harness** — reuse it, write no second one:

- `tests/compiler/compile.examples.test.ts`: `loadCard(name)`, `root` (= `fixturePath("compiler/project")`),
  `outputDirective`, `CompileResult`.
- `tests/acceptance/verify.examples.test.ts`: `COMMAND`, `ENV`, `freshRoot()`.
- `tests/runloop/generation.examples.test.ts`: `harness()` (`h.deps`, `h.fired`, `h.answer(requestId, text)`,
  `h.write`, `h.read`, `h.rm`), `card(customId, targets, acceptance, contextSlice = [], variants = 1)`,
  `fenced(marker)` (a ts fence holding `fileOf(marker)` = `'export const x = "<marker>";\n'`), `failed(...)`,
  `written(...)`.
- `tests/runloop/deck.examples.test.ts`: `harness(now, answersDir)` (`h.deps`, `h.commits`), `makeCard(customId,
  target, acceptance, dependsOn = [])`, `deckOf(cards)`, `answerBody(marker)` (a ts fence holding `'export const
  value = "<marker>";\n'`), the pattern of its example 2 (answers in a `tmpRoot` `t`, `harness(() => 100, t.root)`,
  the run root `t.root`).

The two constants the runloop judges add (verbatim):

```ts
const STAGES = "grep -q ONE out/a.ts && { echo '== tsc'; echo '== probe'; echo 'red: one'; exit 1; }; echo '== tsc'; echo 'red: two'; exit 1";
const once = (mark: string, marker: string, target: string): string =>
  "if [ ! -f " + mark + " ]; then touch " + mark + "; exit 1; fi\ngrep -q " + marker + " " + target;
```

### 2.2. OUTPUT data shapes

**`compileCard`** (`src/compiler/compile.ts`, issue #3 C5) — signature, faults, their order and messages, the
variants and `inputs` unchanged. Only the two exhibits change; no slice or target text is ever fenced:

```ts
function tagged(tag: "file_contents" | "original_file", p: string, content: string): string {
  const body = content === "" || content.endsWith("\n") ? content : content + "\n";
  return "<" + tag + ' path="' + p + '">\n' + body + "</" + tag + ">";
}
// slice file p:          "Contents of file " + p + ":\n" + tagged("file_contents", p, text)
// existing patch target: "Original file " + p + ":\n" + tagged("original_file", p, text)
// absent patch target:   "Target " + p + " is a new file: it does not exist yet."   (unchanged)
```

The path goes between double quotes as it is (no escaping); the closing tag ends the message (no `\n` after it);
`fenceTag` and `fencedBlock` are removed (eslint rejects an unused function). Record Compile Card 1:
`messages[0]` = `Contents of file docs/A.md:\n<file_contents path="docs/A.md">\n# A\n\nAlpha doc.\n</file_contents>`;
Compile Card 2: `Original file src/x.ts:\n<original_file path="src/x.ts">\nexport const x = 1;\nexport const y =
2;\nexport const z = 3;\n</original_file>` = **132** chars (24 + 32 + 60 + 16); Compile Card 4: `Contents of file
docs/F.md:\n<file_contents path="docs/F.md">\n# F\n\n```ts\nconst f = 1;\n```\n</file_contents>` (the fence kept,
one `\n` added). An empty file gives `<file_contents path="<p>">\n</file_contents>`.

**`verifyCard`** (`src/acceptance/verify.ts`, issue #3 C7) — unchanged except the truncated stand-in's log; the file
exports, exactly (one line in the source is fine; the text has single spaces and three backticks):

```ts
export const TRUNCATED_RESPONSE_MESSAGE =
  "The previous answer was cut off mid-file: it opened a ``` code fence and never closed it, so the file body could not be extracted. Answer again with the COMPLETE file, and close the fence.";
```

(**188** chars, old mrph `cards/generations.py:336` word for word.) A `{truncated: true}` variant gives `{variant,
exit: null, log: TRUNCATED_RESPONSE_MESSAGE, diff: null}`; nothing is written, nothing run. The corrupt stand-in
`"answer corrupt: <reason>"` is unchanged.

**`src/runloop/types.ts`** (issue #3 C6) — `RunDeps` gains ONE optional last member, nothing else changes:

```ts
export interface RunDeps {
  config: ProcessorConfig; transport: Transport; commit: CommitHook;
  now: () => number; env: Record<string, string>; acceptanceTimeoutMs?: number;
}
```

**`processGeneration`** (`src/runloop/generation.ts`, issue #3 C3, C6) — every P5/P9b/P9c rule unchanged except two:

1. `verifyCard({..., timeoutMs: deps.acceptanceTimeoutMs ?? DEFAULT_TIMEOUT_MS})` (`DEFAULT_TIMEOUT_MS` imported from
   `../acceptance/run.js`): the acceptance has its own timeout, `deps.config.timeoutMs` is never passed to it.
2. A rejected card's Retry Context comes from the variant that got **furthest** among those whose acceptance ran
   (`diff !== null`): the greatest `stageCount(log)`, a tie → the **later** variant. The file exports

   ```ts
   export function stageCount(log: string): number   // lines of log.split("\n") that start with "== "
   ```

   `stageCount("== tsc\n== probe\nred: one\n")` = 2, `stageCount("== tsc\nred: two\n")` = 1, `stageCount("")` = 0,
   `stageCount("a == b\n")` = 0, `stageCount("x\n== full")` = 1, `stageCount(" == tsc\n==tsc\n")` = 0. No variant
   ran → `{acceptanceOutput: the last result's log, previousDiff: null}` (unchanged); compile fault and stale inputs
   unchanged. The outcome itself does not change: `acceptanceLog` = the LAST variant's log, `earlierFailures` = the
   earlier variants' logs, in order.

   | variants (acceptance ran?, stages) | context from |
   |---|---|
   | v1 (ran, 2), v2 (ran, 1) — record PG 9 | v1 |
   | v1 (ran, 0), v2 (ran, 0) — PG 5 | v2 (tie → later) |
   | v1 (ran, 0), v2 (truncated) — PG 4 | v1 (the only one that ran) |
   | v1 (ran, 1), v2 (ran, 2), v3 (ran, 2) | v3 (tie → later) |

**`runDeck`** (`src/runloop/deck.ts`, issue #3 C2) — every rule unchanged except the retry budget: each card may be
retried **2 times** (unchanged, `buildRetry` takes attempt 1 or 2), and `input.budget.maxRetryBatches` caps the retry
batches of **one generation**: `retryBatches` is `0` at the start of every generation (`let retryBatches = 0` inside
the generation loop), and a retry batch runs while some failed card has been retried fewer than 2 times and
`retryBatches < maxRetryBatches`. With the CLI's default 2, every generation gets the old runner's 2 rounds;
`maxRetryBatches 0` retries nothing. Record Run Deck 6: `[a, then b dependsOn a]`, each failing once (F4), cap 1 →
both `written`, attempts 2, winningVariant `a.r1.v1` / `b.r1.v1`, 4 requests, commits `[a, b]` (the old run-wide cap
left b failed after 1 attempt and 3 requests). Run Deck 7: one card, `exit 1`, cap 8, answers `c.md`, `c.r1.md`,
`c.r2.md` (+ `c.r3.md` in the probe) → `failed`, attempts 3, earlierFailures length 2, 3 requests.

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P10c runner"):

- C2: `--max-retry-batches` is **kept, as a per-generation cap**, default 2 (unchanged in `src/cli/parse.ts`); the
  per-card budget is the existing 2 retries. Not removed or renamed: Component `cli` is at **29 998** of the 30 KB
  rule and a rename reddens the Parse Command tests that compare whole commands; the per-generation reading needs no
  cli change and makes the flag unnecessary for the old behaviour.
- C3: "furthest" = the most `== ` stage headers in the variant's (clipped) log, tie → later; not "every variant's
  log" (the retry prompt stays one log + one diff, ≤ 4 000 + 6 000 chars per file). The outcome's logs are not
  reordered (Card Outcome literals are compared whole by P5–P9c judges).
- C5: both exhibits are tagged — slice files `<file_contents path="…">` and patch originals `<original_file
  path="…">` (old mrph's two tags), the message's first line kept (`Contents of file <p>:` / `Original file <p>:`).
- C6: the setting is `RunDeps.acceptanceTimeoutMs`, optional, default `DEFAULT_TIMEOUT_MS` (300 000) of Run
  Acceptance; no CLI flag in P10c1 (cli at its size limit; `runCommand` builds RunDeps without it and so gets 300 s).
- C7: the constant lives in `src/acceptance/verify.ts`, where the stand-in is built (Component acceptance joins the
  phase for one line); the record's Build Retry example 5 keeps "answer truncated" as an arbitrary input literal.

### 2.3. Names and the tests each judge patches

| module | change | code card's tests | judge's file(s) |
|---|---|---|---|
| `src/compiler/compile.ts` | C5 tags | probe only | `tests/compiler/compile.examples.test.ts` |
| `src/acceptance/verify.ts` | C7 text | probe only | `tests/acceptance/verify.examples.test.ts` + `tests/runloop/generation.p9b.examples.test.ts` + `tests/runloop/deck.p9b.examples.test.ts` |
| `src/runloop/types.ts`, `src/runloop/generation.ts` | C6 setting, C3 furthest | probe only | `tests/runloop/generation.examples.test.ts` |
| `src/runloop/deck.ts` | C2 per generation | probe only | `tests/runloop/deck.examples.test.ts` |

Every judge **patches**: it returns its file(s) whole and keeps every other test, name and line as it is (the
acceptance checks the names).

- `compile.examples.test.ts` (10 tests → 12): **Compile Card example 1** — messages[0] and [1] `toBe` the tagged
  texts of §2.2; **example 2** — messages[0] `toBe` the 132-char text, the `startsWith` check becomes
  `'Original file src/x.ts:\n<original_file path="src/x.ts">\n'`, the length 93 becomes 132, messages[1] the tagged
  docs/A.md; **"patch with a new target sends the new-file line"** — messages[0] the 132-char text; then, after
  example 3 in the same `describe`, **"Compile Card example 4: …"** (`loadCard("fencedF")`, messages[0] `toBe` the
  §2.2 text; no message has a line that is exactly "```md") and **"Compile Card example 5: …"** (`loadCard("patchNew")`,
  the three messages `toStrictEqual` [the 132-char text, the new-file line, `"Patch src/x.ts and add src/z.ts.\n\n" +
  outputDirective(["src/x.ts", "src/z.ts"])`]).
- `verify.examples.test.ts` (11 → 12): import `TRUNCATED_RESPONSE_MESSAGE` with `verifyCard`; in **"Verify Card example
  2: …"** and **"corrupt and truncated stand-ins write nothing and are never run"** `toBe("answer truncated")` becomes
  `toBe(TRUNCATED_RESPONSE_MESSAGE)`; after example 3, **"Verify Card example 4: …"**: the constant `toBe` the text of
  §2.2 written out in full, its `length` 188.
- `generation.p9b.examples.test.ts` (7 tests, unchanged count): import `TRUNCATED_RESPONSE_MESSAGE` from
  `"../../src/acceptance/verify.js"`; in **example 4** `acceptanceLog: "answer truncated"` and in **example 6** `b:
  { acceptanceOutput: "answer truncated", … }` use the constant. Nothing else changes.
- `deck.p9b.examples.test.ts` (4 tests, unchanged count): the same import; in **"Run Deck §2.2: the retry after a
  truncated answer has no diff block"** the acceptanceLog and earlierFailures checks use the constant, and the
  `includes` string becomes `"<acceptance_output>\nA previous attempt was discarded before acceptance could run:\n" +
  TRUNCATED_RESPONSE_MESSAGE + "\n</acceptance_output>\nProduce the complete file again, from the context given above."`.
- `generation.examples.test.ts` (14 → 16): import `stageCount` with `processGeneration`; the own test **"Process
  Generation: the config's timeoutMs bounds the acceptance"** is REMOVED (it pins the rule C6 replaces); at the end of
  the file, in order: **"Process Generation example 9: …"** (`STAGES`, variants 2, `h.write("out/a.ts", fileOf("OLD"))`,
  `h.answer("a.v1", fenced("ONE"))`, `h.answer("a.v2", fenced("TWO"))`; the outcome `toStrictEqual(failed("a",
  "acceptance failed", "== tsc\nred: two\n", ["== tsc\n== probe\nred: one\n"]))`, the retryContexts of the record,
  `out/a.ts` back to `fileOf("OLD")`, and the six `stageCount` values of §2.2), **"Process Generation example 10: …"**
  (`h.deps.config.timeoutMs = 100`, acceptance `"sleep 1; grep -q PASS out/a.ts"`, `fenced("PASS")` → status
  `"written"`, winningVariant `"a.v1"`), **"Process Generation example 11: …"** (`h.deps.acceptanceTimeoutMs = 200`,
  acceptance `"sleep 30"` → `failed`, reason `"acceptance failed"`, the log `toContain("acceptance timed out after 200
  ms")`, `h.fired` `[]`).
- `deck.examples.test.ts` (7 → 9): at the end, **"Run Deck example 6: …"** and **"Run Deck example 7: …"** with the
  values of §2.2 and the record (`once` of §2.1; answers `a.md`, `a.r1.md`, `b.md`, `b.r1.md` / `c.md`, `c.r1.md`,
  `c.r2.md` written with `answerBody`; budget `{maxCards: 100, maxRetryBatches: 1 | 8, deadline: 1_000_000}`; RD 6
  also checks `h.commits` `["a", "b"]` and `report.usageTotals.requests` 4).

Strings with `toBe`; a whole outcome or context with `toStrictEqual`; a literal holding a single quote goes in a
double-quoted string. No `vi.*`, no timers, no variable named `fetch` or `Fake*`; import only what you use (eslint).

### 2.4. What must not break

- Byte for byte: every file outside the 4 code targets and the 6 test files of §2.3 — `src/runloop/{resolve,retry}.ts`,
  `src/acceptance/{run,snapshot,diff,types}.ts`, `src/compiler/{capture,directive,parse,types}.ts`, `src/cli/*`,
  `tests/helpers.ts`, `tests/compiler/compile.test.ts` (it checks first lines only: green on the new texts, measured).
- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/` — untouched by every card.
- The 571 tests stay green except the 9 the ripple spike reddens (§1), all in the five files of §2.3 their judges
  patch; after the run **571 − 1 + 2 + 1 + 2 + 2 = 577**.

## 3. Acceptance

Built by `morph plan --checks decks/p10c/checks.json` (Component `builder`, P10b1; the checks document in the form of
Read Checks): narrow to broad, every stage printing `== <stage>`; the first red is the regeneration's diagnosis.
`fullExclude` = the five files of §1's ripple (`compile.examples`, `verify.examples`, `generation.examples`,
`generation.p9b.examples`, `deck.p9b.examples`): each is red from its code card's acceptance (generation 0 or 1) to its
judge's (generation 1 or 2), so every full step leaves them out and their judges run them in their own step.

Code cards (no test file, code-only targets, no smoke cap): `probe/<card>/` (guard, locator, vitest config,
`tsconfig.card.json` minus the other targets of the generation) → `tsc` → `eslint <targets>` → `guard.mjs src
<targets>` → `decks/p10c/parts/<card>.probe.ts` (compile-card: CC 1–5 + 2 rows = 7; verify-card: VC 2, 4 + 1 row = 3;
process-generation: PG 9 (2 tests), 10, 11 + 5 rows = 9; run-deck: RD 6, 7 + 3 rows = 5; **24 tests**) → eslint's
verdict → full `vitest run` minus fullExclude → frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <targets>` → per file `guard.mjs tests <file> <min> <max> lits<n>.json`
→ per file every test name at HEAD still there except `drop` → `vitest run <targets>` → eslint's verdict → full run →
frozen → untracked.

| file | min | max | drop | lits |
|---|---|---|---|---|
| `tests/compiler/compile.examples.test.ts` | 5 | 16 | — | `<file_contents path=`, `<original_file path=`, `</original_file>`, `fencedF`, `Compile Card example 4`, `Compile Card example 5` |
| `tests/acceptance/verify.examples.test.ts` | 4 | 16 | — | `TRUNCATED_RESPONSE_MESSAGE`, `Verify Card example 4`, `code fence and never closed it`, `Answer again with the COMPLETE file` |
| `tests/runloop/generation.p9b.examples.test.ts` | 5 | 9 | — | `TRUNCATED_RESPONSE_MESSAGE` |
| `tests/runloop/deck.p9b.examples.test.ts` | 2 | 6 | — | `TRUNCATED_RESPONSE_MESSAGE` |
| `tests/runloop/generation.examples.test.ts` | 6 | 20 | `Process Generation: the config's timeoutMs bounds the acceptance` | `Process Generation example 9`, `Process Generation example 10`, `Process Generation example 11`, `stageCount`, `acceptanceTimeoutMs`, `acceptance timed out after 200 ms`, `== probe` |
| `tests/runloop/deck.examples.test.ts` | 5 | 13 | — | `Run Deck example 6`, `Run Deck example 7`, `mark-a`, `mark-b`, `c.r2` |

min = the file's record examples after the patch; max = its tests after the patch + 4. Literals are
quote-agnostic (a judge may write `path="…"` inside single or double quotes).

**Output budget per card** (`max_tokens`): code = the reference target in tokens (≈ bytes / 3.5) × 2 + 2 500
reasoning, rounded up with margin; judges by the files they return (the judge with the most examples, Process
Generation's 11, 24 000).

| card | returns | `max_tokens` |
|---|---|---|
| compile-card | compile.ts ≈ 3.0 KB | 10 000 |
| verify-card | verify.ts ≈ 3.6 KB | 10 000 |
| process-generation | types.ts 2.0 KB + generation.ts 7.5 KB | 14 000 |
| run-deck | deck.ts ≈ 7.3 KB | 12 000 |
| compile-card-judge | ≈ 7.5 KB | 16 000 |
| verify-card-judge | three files ≈ 27 KB | 24 000 |
| process-generation-judge | ≈ 20 KB | 24 000 |
| run-deck-judge | ≈ 13 KB | 20 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- Layers unchanged: `compiler` pure (no clock, no env; `node:fs`/`node:path` reads only), `acceptance` spawns only in
  `run.ts`, `runloop` imports cards, compiler, processor, acceptance. No new `src/` folder (guard layers unchanged).
- A file a card writes is in no sibling's slice in the same generation: run-deck (generation 1) depends on
  process-generation (types.ts); no generation-1 judge has `src/runloop/deck.ts` in its slice; verify-card-judge's
  targets are in no other card's slice.
- Tests write only under a `tmpRoot()` and remove it in `finally`; a judge writes only its test file(s) and never the
  module it tests.
- Exact strings of the record and §2.2 (the tags, the 188-char text): the executor copies them.

## 7. Out of scope

- **P10c2** (the split): issue #3 **C4** — each variant's raw answer and exact request messages under
  `.morph/runs/<id>/answers/` and one stderr line per variant with the stage reached (`stageCount`, exported here for
  it). It needs runloop (the per-variant records), git (Archive Run: the directory exists before the archive, its
  "already exists" rule and the committed paths change) and cli (Run Command wires the log line to stderr and the
  records to the archive; `--acceptance-timeout` if wanted) — 5–6 more cards (13–14 in all, over the ~12 ceiling),
  and cli is at 29 998 of 30 000 bytes, so its record must be compacted first. Reason for the split: C4 is a new
  archive layout across three Components; C2/C3/C5/C6/C7 are local patches of four files.
- Renaming or removing `--max-retry-batches`; a CLI flag for the acceptance timeout (P10c2 or later).
- The retry's acceptance output from every variant (C3's alternative); reordering the outcome's logs.
- Build Retry, Output Directive, Parse Answer, Run Acceptance, Build Attempt Diff: unchanged.

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component compiler --component acceptance \
  --component runloop --judge --checks decks/p10c/checks.json --out decks/p10c/deck.json
python3 decks/p10c/filter.py decks/p10c/deck.json            # keeps the 8 cards of the phase
node dist/cli.js deck check --root . --deck decks/p10c/deck.json                                   # errors 0
rm -rf /tmp/v2bin-p10c && mkdir -p /tmp/v2bin-p10c && cp -r dist /tmp/v2bin-p10c/ && ln -s $PWD/node_modules /tmp/v2bin-p10c/node_modules
node /tmp/v2bin-p10c/dist/cli.js run --root . --deck decks/p10c/deck.json --processor glm53 --max-retry-batches 8 --deadline 2400
```

The deck is run by a copy of TODAY's binary, not by the code it writes: its retry cap is still run-wide, so the run
needs `--max-retry-batches 8` (the last time; after the merge the default 2 is per generation).

Cross-check (dry): from `morph-lab`, `venv/bin/mrph plan --spec <repo>/contour.yaml --map <repo>/morph-map.json
--component compiler --component acceptance --component runloop --judge --root <repo>`.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 8 (4 code, 4 judges) / 3: [compile-card, process-generation, verify-card] [compile-card-judge, process-generation-judge, run-deck, verify-card-judge] [run-deck-judge] |
| executor bill | ≈ $0.10 nominal (≈ 14 first requests of 15–35k in / 2–8k out; ≈ 4 retries), ≤ $0.40 with a re-cut; cap $5 |
| cards with regeneration | 2–3 of 8 (verify-card-judge: three files whole; process-generation-judge: example 9's quoting; compile-card: a fence kept somewhere) |
| tests after the run | 577 in 61 files |
| first red | compile-card: `\n` after the closing tag; process-generation: `>` instead of `>=` (tie → earlier); run-deck: the reset outside the generation loop |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no judge cut off at its `max_tokens`; (3) the V2 cut
equals the old mrph's dry cut in ids, dependsOn, generations, targets, slices and max_tokens; (4) after the run no test
outside the five patched files changed; (5) run-deck green means a later generation retries under the default cap.

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the row of
`docs/MEASURE.md`; the DECISIONS lines name issue #3 C2, C3, C5, C6, C7, and the merge leaves #3 open for C4 (P10c2).

## 11. Actual

(filled at the gate and after the run)
