# TASK_P9b — the retry with its own diff, usage per request, the output rules (`src/runloop/`, `src/compiler/directive.ts`)

> Phase P9b, inserted after P9 by the operator (07.10) before the switch to V2. It closes three gaps
> of the V2 runner against the old one, found by replaying the P9 deck on the V2 binary. Components
> `runloop` (Functions Process Generation, Build Retry, Run Deck; Data Objects Run Report, Request
> Usage, Retry Context) and `compiler` (Function Output Directive) of `contour.yaml`. Every change is
> a **patch** of code written in P2 and P5; the new examples get judges in **new** test files, and
> the two P2 test files that pin the old directive text are rewritten/patched by their judges. Built
> by the old Morph (`mrph`) on glm.

## 1. Why this

The switch test of 07.10: the P9 deck cut by old `mrph` (converted by `decks/tools/v2deck.py`) ran
on the V2 binary, glm53, from commit 17f2b74. **V2: 0 of 8** — `validate-record` red after 3 rounds
× 2 variants, 7 cards skipped behind it; $0.075, 6 requests, 5.7 min. **Old mrph on the same deck:
8 of 8**, $0.1556, 20 requests, 12.3 min; `validate-record` passed on round r2.

1. **The retry rewrote from scratch.** V2's six reds of `validate-record` (2 variants × 3 rounds)
   had five different first reds — round 0: the steps/schema row, the walk order; r1: the
   duplicates' path, an unused import; r2: `prefer-const`, the walk order again — every round
   started over and round 2 fell back to round 0's fault.
   `runDeck` passes `previousDiff = null` to `buildRetry` (DECISIONS "P5 · Run Deck ·
   previousDiff is passed null"); nobody threaded it. The old runner sends the acceptance output
   AND the diff of what the failed attempt wrote: its r2 requests carried 21 803 input tokens
   against 13 001 for r1 — the 8 802 tokens of r1's diff — and r2 passed. V2's acceptance already
   computes that diff (P3, Build Attempt Diff) and drops it.
2. **The Run Report has no usage per request.** The old report has one row per request (model,
   provider, generation id, input/output tokens, cost, finish reason): it is how the line above was
   measured, and how a truncation (finish reason `length`, P5 debt: three of them) is seen. V2 has
   `usageTotals` only (4 numbers for 6 requests).
3. **The output directive is one line.** The old directive (`mrph/cards/compiler.py`,
   SINGLE/MULTI_TARGET_DIRECTIVE, 9 984 vs V2's 9 300 chars in the last message of the same
   request) carries format rules paid for by failures: exactly one fenced block, what happens to a
   second fence, prose outside fences, every target once in order. P9's `validate-record` lost its
   first two answers to the file-set rule (a file missing, a file twice).

PLAN: ≈ 8 cards at ≈ $0.1–0.2. This cut: 9 cards (4 code, 5 judges), 3 generations, 11 new record
examples (Process Generation 4–7, Build Retry 4, Run Deck 4–5, Output Directive 1–4 rewritten).

## 2. Contract

### 2.1. INPUT data shapes the code must build

No fixture files: every example builds its inputs inline in a `tmpRoot()`; the literals are in the
record (Component runloop / compiler, the Function's example `given`).

- **Card, Deck** — `src/cards/types.ts`: every field set by the test (no defaults).
- **ProcessorConfig, Transport, Answer, Usage** — `src/processor/types.ts`. `Answer = {customId,
  text, finishReason, error}`, `Usage = {customId, inputTokens, outputTokens, cost, provider,
  generationId}`; `sendGeneration` returns `{answers, usage}` index-aligned with the requests sent.
- **VariantResult** — `src/acceptance/types.ts`: `{variant, exit, log, diff: string | null}`;
  `verifyCard` returns `{accepted, results}`, one result per variant tried, in order.
- **RunDeps, RunInput** — `src/runloop/types.ts` (unchanged): `{config, transport, commit, now,
  env}`; `{root, runId, branch, deck, budget: {maxCards, maxRetryBatches, deadline}}`.

**A judge's setup across Components** (TASK_TEMPLATE §2.1, P5 debt). The judged Functions call
compiler, processor and acceptance. Facts a test's setup depends on:

- **C1** compiler · Compile Card faults on a `contextSlice` file that does not exist, with the
  message `contextSlice '<path>' does not exist`, before any request is sent · without it Process
  Generation 6's card `c` would reach the stub. A stale-input test must therefore create the shared
  file BEFORE the generation (P5 debt). Cited by PG 6 and the stale row.
- **C2** processor · Stub Answer reads `<answersDir>/<requestId>.md`, else the id with a final
  `.v<n>` stripped; its Answer has `finishReason "stop"`, `error null`; its Usage `provider "stub"`,
  `generationId "stub-<requestId>"`, tokens 0, cost 0 · PG 7, RD 5.
- **C3** compiler · Parse Answer: an odd number of lines starting with three backticks is
  `{truncated: true}`; acceptance · Verify Card then logs `answer truncated`, runs no acceptance and
  sets `diff: null` · PG 4, 6.
- **C4** acceptance · Verify Card snapshots the targets once, runs the variants in order, rolls the
  targets back after every rejected one and builds each rejected variant's diff against that one
  snapshot (so each diff is from the original, never from the previous variant) · PG 4, 5.
- **C5** acceptance · Run Acceptance runs the command under `/bin/sh` in `root` with exactly the
  given env (so `env.PATH` is needed for `grep`, `cat`, `touch`); the log is stdout and stderr
  merged; `echo "red: $(cat out/a.ts)"` logs `red: export const x = "ONE";\n` (`$( )` drops the
  file's last newline, `echo` adds one) · PG 4, 5.
- **C6** acceptance · Build Attempt Diff: `--- a/<p>` (or `--- /dev/null` for an absent file), `+++
  b/<p>`, both hunk counts always printed: `@@ -1,1 +1,1 @@`, `@@ -0,0 +1,1 @@` · PG 4, 5, RD 4.
- **C7** processor · on an `openrouter` config Send Generation calls `transport.fetch(<baseUrl
  without trailing />/chat/completions, {method: "POST", headers, body})` once per request
  (concurrency 1: in send order), with `body` the JSON of `{model, messages, …}`; the card's
  instruction is the content of the LAST message (followed by "\n\n" and the output directive).
  Read Response takes `id` → generationId, `provider`, `usage.prompt_tokens`/`completion_tokens`/
  `cost`, `choices[0].message.content`, `choices[0].finish_reason` · RD 4.
- **C8** helpers · `fakeFetch(routes)` answers every call to a route with the same reply and
  records each call in `calls` (`body` a string) · RD 4.

**Distinct markers.** The answers hold `OLD`, `ONE`, `TWO`, `MARK`, `MARK_A`, `MARK_B`; the
acceptances look for `PASS` (which no failing answer holds) or for the card's own marker. `MARK_A`
and `MARK_B` contain `MARK`: never grep `MARK` in a deck that also writes `MARK_A`/`MARK_B`.
`first-red` is printed only by RD 4's first acceptance run.

**Harness skeletons** (the probes use them verbatim, from `probe/<card>/` with `../../tests/` and
`../../src/`; a judge in `tests/runloop/` imports `../helpers.js` and `../../src/…`):

Process Generation (stub):
```ts
import { fakeFetch, tmpRoot, type TmpRoot } from "../helpers.js";
function harness(): { t: TmpRoot; deps: RunDeps } {
  const t = tmpRoot("morph-p9b-");
  const deps: RunDeps = {
    config: { id: "stub", type: "stub", model: "stub", apiKey: null, baseUrl: "https://openrouter.ai/api/v1", route: "sync",
      concurrency: 4, providerOrder: null, reasoning: null, timeoutMs: 600000, maxRetries: 0, answersDir: t.path("answers") },
    transport: { fetch: fakeFetch().fetch, sleep: async (): Promise<void> => {} },
    commit: (customId, targets) => ({ commit: "sha-" + customId, diffstat: { files: targets.length, insertions: 1, deletions: 0 } }),
    now: (): number => 1000,
    env: { PATH: process.env.PATH ?? "" },
  };
  return { t, deps };
}
const fenced = (marker: string): string => '```ts\nexport const x = "' + marker + '";\n```\n';
const card = (customId: string, target: string, acceptance: string, variants = 1, model: string | null = null,
  contextSlice: string[] = []): Card => ({ customId, intent: "generate", targets: [target], contextSlice,
  instruction: "write " + target, acceptance, model, maxTokens: null, reasoning: null, variants, dependsOn: [] });
// each test: const { t, deps } = harness(); try { t.write("answers/a.v1.md", fenced("ONE")); ... } finally { t.rm(); }
```

Run Deck (OpenRouter over fakeFetch, example 4; the stub config of the skeleton above for 5):
```ts
const CHAT = "https://openrouter.ai/api/v1/chat/completions";
const reply = (content: string): { body: unknown } => ({ body: { id: "gen-1", provider: "Novita",
  choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
  usage: { prompt_tokens: 100, completion_tokens: 20, cost: 0.001 } } });
const f = fakeFetch({ [CHAT]: reply(fenced("MARK")) });
const config: ProcessorConfig = { id: "glm", type: "openrouter", model: "z-ai/glm-5.3", apiKey: "k", baseUrl: "https://openrouter.ai/api/v1",
  route: "sync", concurrency: 1, providerOrder: null, reasoning: null, timeoutMs: 600000, maxRetries: 0, answersDir: null };
const lastMessage = (i: number): string => {
  const body = JSON.parse(f.calls[i]?.body ?? "{}") as { messages?: { content: string }[] };
  const ms = body.messages ?? [];
  return ms[ms.length - 1]?.content ?? "";
};
// input: { root: t.root, runId: "r1", branch: "morph/r1", deck: { cards, externalDependsOn: [] },
//          budget: { maxCards: 10, maxRetryBatches: 1, deadline: 1e15 } }
```

### 2.2. OUTPUT data shapes

**`src/runloop/types.ts`** — every P5 type unchanged except these additions (the P5 block stays
byte for byte otherwise; keys in this order):

```ts
export interface RequestUsage {
  customId: string; model: string; provider: string | null; generationId: string | null;
  inputTokens: number; outputTokens: number; cost: number | null;
  finishReason: string | null; error: string | null;
}
export interface RunReport {
  runId: string; completedAt: number; branch: string; processor: string;
  generations: number; outcomes: CardOutcome[]; usageTotals: UsageTotals;
  requests?: RequestUsage[];
}
export interface RetryContext { acceptanceOutput: string; previousDiff: string | null }
export interface GenerationOutcome {
  outcomes: CardOutcome[]; usage: Usage[]; requests: RequestUsage[];
  retryContexts: Record<string, RetryContext>;
}
```

`RunReport.requests` is optional in the type only: `runDeck` always sets it; report literals in
the P6/P7 tests (`tests/git/archive.examples.test.ts`, `tests/cli/document.examples.test.ts`) stay
valid without a card touching them. `CardOutcome` is unchanged (no diff in the report).

**`processGeneration`** (`src/runloop/generation.ts`) — every P5 rule unchanged (compile, ONE
`sendGeneration`, stale re-check before verify, the outcomes); it returns `{outcomes, usage,
requests, retryContexts}`:

1. `requests`: for every request sent, in send order (the order of the one `sendGeneration` call),
   `{customId: request.customId, model: request.model ?? deps.config.model, provider:
   usage.provider, generationId: usage.generationId, inputTokens: usage.inputTokens, outputTokens:
   usage.outputTokens, cost: usage.cost, finishReason: answer.finishReason, error: answer.error}`
   with `usage`, `answer` at the same index. A compile-failed card sends nothing and adds no row.
2. `retryContexts`: one entry per **failed** outcome, keyed by the outcome's `customId` (a retry
   round's id, e.g. `a.r1`, as processGeneration got it), inserted in outcome order; none for a
   written card.
   - compile fault → `{acceptanceOutput: <the outcome's acceptanceLog> (the fault messages joined
     by "\n"), previousDiff: null}`;
   - stale inputs → `{acceptanceOutput: "stale inputs: <paths>", previousDiff: null}`;
   - acceptance failed → let `ran` be the **last** result of `verifyCard` whose `diff !== null`
     (a variant whose acceptance ran). `ran` exists → `{acceptanceOutput: ran.log, previousDiff:
     ran.diff === "" ? null : ran.diff}`; none (every answer corrupt or truncated) →
     `{acceptanceOutput: <the last result's log>, previousDiff: null}`.
   The output and the diff always describe the same attempt. Illustration (PG 4): v1 ran and
   failed, v2 truncated → the outcome's acceptanceLog is `answer truncated` (the last result, P5
   rule, unchanged) but the context is v1's log and v1's diff.

**`buildRetry`** (`src/runloop/retry.ts`) — P5 rules unchanged; when `previousDiff !== null` the
instruction is `card.instruction + "\n\nYour previous attempt failed its acceptance. Fix exactly
what the acceptance reports and return the whole file again.\nAcceptance output:\n" +
acceptanceOutput + "\n\nYour previous attempt (rejected):\n" + previousDiff + "\n\nThe diff above
is your own previous edit: correct it where it went wrong instead of rewriting the files from
scratch."` (one line in the code; the sentence is the old runner's `<previous_attempt_diff>`
closing). `previousDiff === null` → exactly as P5 (no diff block, no closing sentence). An empty
string is not null: it gets the block (processGeneration never passes `""`).

**`runDeck`** (`src/runloop/deck.ts`) — P5 rules unchanged, plus:

1. A `requests: RequestUsage[]` accumulator: after every `processGeneration` call (a generation or
   a retry batch) append its `requests`, so the rows are in send order.
2. A `Map<originalId, RetryContext>`: after every `processGeneration` call, for each outcome with
   an entry in its `retryContexts`, store it under the ORIGINAL card id (the outcome's customId for
   a generation; `retryCard.customId` with the trailing `.r<n>` removed for a retry batch). A later
   round's context replaces the earlier one.
3. The retry: `buildRetry(original, retryNumber, ctx.acceptanceOutput, ctx.previousDiff)` with
   `ctx` the stored context of that card; when there is none (cannot happen for a failed outcome of
   processGeneration), `buildRetry(original, retryNumber, previous.acceptanceLog, null)` as P5.
4. The Run Report gains `requests` as its last key: `{runId, completedAt, branch, processor,
   generations, outcomes, usageTotals, requests}`.

**`outputDirective`** (`src/compiler/directive.ts`) — no imports; `targets.length === 0` →
`throw new Error("outputDirective: targets is empty")`. The fence lines are three backticks, bare.

One target `p` — exactly (`\n` is a line break; no trailing newline):

```
"Return the complete content of " + p + " as ONE fenced block, and nothing else:\n\n```\n<the complete content of " + p + ">\n```\n\nThe opening fence may name the file's language. Only the FIRST fenced block of the answer becomes the file: a second block (a diff, an edit summary, an example) is dropped, and every line outside the fence is discarded. An answer with no fence at all is written to the file verbatim, prose and all. An answer whose fences do not pair up is discarded unread as cut off, so no line of the file may begin with three backticks. No preamble, no closing commentary, no diff, no elision: the whole file."
```

Several targets (`n` = `targets.length`, written in decimal) — exactly:

```
"This card writes " + n + " files. Return each one as a line `FILE: <path>` followed by ONE fenced block holding its complete content:\n\nFILE: <path>\n```\n<the complete content of that file>\n```\n\nOne such pair per file, every file exactly once, in this order:\n" + targets.join("\n") + "\n\nUse exactly these paths, each file whole: no diff, no elision. An answer that misses a file, gives one twice or names a file not in this list is discarded whole. Only the first fenced block after a FILE: line is that file's content: a second block (a diff, an edit summary, an example) is dropped. Lines outside the fenced blocks are ignored, but no other line may begin with FILE:. An answer whose fences do not pair up is discarded unread as cut off, so no line of a file may begin with three backticks."
```

The two backtick sentences differ by one word: the single text says "so no line of **the** file may
begin with three backticks", the several text "so no line of **a** file may begin with three
backticks". A test that pins a whole text copies it from its own block above, character for
character, never from the other one (P9b re-cut: the judge wrote "a file" into the single text three
times).

In the code, build the three-backtick line from a constant (`const FENCE = "```";`) so no source
line of `directive.ts` itself begins with three backticks. Every rule the texts state is what Parse
Answer (P2, unchanged) does; the old runner's "a second block is concatenated" is NOT V2's
behaviour and is not copied.

### 2.3. Names

| module | change | card writes no test | judge's test |
|---|---|---|---|
| `src/runloop/types.ts` | RequestUsage, RetryContext, GenerationOutcome, RunReport.requests | — (process-generation) | — |
| `src/runloop/generation.ts` | requests, retryContexts | probe | `tests/runloop/generation.p9b.examples.test.ts` (PG 4–7) |
| `src/runloop/retry.ts` | the closing sentence | probe | `tests/runloop/retry.p9b.examples.test.ts` (BR 4) |
| `src/runloop/deck.ts` | the context threaded, report.requests | probe | `tests/runloop/deck.p9b.examples.test.ts` (RD 4–5) |
| `src/compiler/directive.ts` | the two texts | probe + its smoke `tests/compiler/directive.test.ts` (≤ 5 tests) | `tests/compiler/directive.examples.test.ts` rewritten (OD 1–4) |
| — | — | — | `tests/compiler/compile.examples.test.ts` patched: its three directive literals |

The runloop judges write **new** files holding the NEW examples only (examples 1–3 of each stay in
the P5 files, untouched); a test per example, named `<Function> example <n>: <what>`, in record
order, then at most 8 of their own on §2.2. The directive judge rewrites its P2 file (every test of
it pinned the old text): OD 1–4, then at most 8 of its own. The compile judge **patches**: in
`Compile Card example 1` and `example 2` (`messages[2]`) and `several targets get the section
directive`, the literal directive text becomes `outputDirective([...])` imported from
`../../src/compiler/directive.js` (`"Write src/a.ts.\n\n" + outputDirective(["src/a.ts"])`,
`"Patch src/x.ts.\n\n" + outputDirective(["src/x.ts"])`, `"Patch src/x.ts and add src/z.ts.\n\n" +
outputDirective(["src/x.ts", "src/z.ts"])`); nothing else changes and all 10 test names stay.

Compare outcomes, rows, contexts and reports whole with `toStrictEqual`; strings with `toBe`;
a nullable field is never reached with a method (`reason.startsWith` → TS18047, P5); a record
entry is read as `g.retryContexts.a` only inside `toStrictEqual`, or compare `g.retryContexts`
whole. `ff.calls[i]` may be undefined: `f.calls[i]?.body ?? "{}"` (the skeleton). No `vi.*`, no
timers, no variable named `fetch` or `Fake*`; import only what you use (eslint).

### 2.4. What must not break

- Byte for byte: everything outside the targets of §2.3 — `src/runloop/resolve.ts`, the P5 judge
  files `tests/runloop/{resolve,generation,retry,deck}.examples.test.ts`, `src/compiler/*` other
  than `directive.ts`, `src/acceptance/*`, `src/processor/*`, `src/git`, `src/cli`, `tests/helpers.ts`.
- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/` — untouched by every card.
- The 464 tests of P0–P9 stay green, except the 12 that pin the old directive text (ripple spike,
  §11): `compile.examples` 3, `directive.examples` 7, `directive.test` 2 — rewritten by their owners.
  The runloop changes redden none (spike: 464/464 with the reference runloop and the old directive).

## 3. Acceptance

Built by `decks/tools/build.py p9b` into the `acceptance` of the 9 cards in `morph-map.json`.
Narrow to broad; the first red is the regeneration's diagnosis.

Code cards: `probe/<card>/` (guard, vitest config, `tsconfig.card.json` excluding the targets of
the same generation's other cards) → `tsc` → `eslint <targets>` → `guard.mjs src <src targets>`
(output-directive also `guard tests directive.test.ts 1 5`) → `decks/p9b/parts/<card>.probe.ts`
(process-generation 4 + 3 §2.2 = 7 tests; build-retry 1 + 2 = 3; run-deck 2 + 3 = 5;
output-directive 4 + 2 = 6) → output-directive: its smoke test → full `vitest run` → frozen →
untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <target>` → `guard.mjs tests <target> <min> <max>
lits.json` (min = the new examples: PG 4, BR 1, RD 2, OD 4, compile 3; max = all the Function's
examples + 8: 15, 12, 13, 12, and 10 for compile) → compile-card-judge only: every test name of the
file at HEAD is still in it → `vitest run <target>` → full `vitest run` → frozen → untracked.

**Known red, deselected deck-wide**: the full step of every card runs `--exclude
tests/compiler/compile.examples.test.ts --exclude tests/compiler/directive.examples.test.ts` — both
pin the old text and go red the moment output-directive is accepted (generation 1), until their
judges (generation 2) rewrite them; each judge runs its own file in its own step.

Dense output: `--reporter=dot`, failures filtered to `^ FAIL |Error|expected|received`, 80 lines.
The chain is timed on a dry tree (§11 Gate), limit 300 s.

**Output budget** (`max_tokens`): estimate = target bytes / 3.5 × 2 + 2 500 reasoning, from a scratch
reference (§11).

| card | expected answer | `max_tokens` |
|---|---|---|
| process-generation | types.ts 1.9 KB + generation.ts 6.7 KB ≈ 2 460 tok | 14 000 |
| build-retry | retry.ts 1.1 KB ≈ 320 tok | 8 000 |
| run-deck | deck.ts 6.7 KB ≈ 1 910 tok | 12 000 |
| output-directive | directive.ts 2.0 KB + smoke 1.0 KB ≈ 860 tok | 8 000 |
| process-generation-judge | ≈ 7.5 KB (7 tests) ≈ 2 150 tok; the P5 card: 25 500 truncated once | 28 000 |
| build-retry-judge | ≈ 2.5 KB ≈ 710 tok | 16 000 |
| run-deck-judge | ≈ 6 KB ≈ 1 700 tok | 24 000 |
| output-directive-judge | ≈ 4 KB ≈ 1 150 tok | 16 000 |
| compile-card-judge | the whole file ≈ 6.1 KB ≈ 1 750 tok | 16 000 |

## 4. Constraints

- NodeNext (`.js` in relative imports, `import type`); no `any`; layer `runloop` imports only what
  P5 imported (`types.ts`, `retry.ts` types only); `compiler/directive.ts` imports nothing.
- A patch card returns each target whole; every rule of P5/P2 not named in §2.2 stays as it is.
- Tests write only under `tmpRoot()` and remove it; no fixture is written; a judge writes only its
  test file. A file a card writes is in no sibling's slice in the same generation.
- Exact strings of §2.2 are copied, not rephrased.

## 7. Out of scope

- A stand-in wording for a retry after an answer discarded unread (the old runner's "discarded
  before acceptance could run"): V2 keeps one header for both; the context carries no diff then.
- Diffs or request rows inside `CardOutcome`; writing the per-request rows anywhere but the Run
  Report (the archive writes the report whole, P6, unchanged).
- Usage the response does not carry (no generation-stats fetch); the response's own `model` field
  (the row's model is the request's).
- The planner (P10): judge slices with callee contracts (#3) — this phase still carries them in
  §2.1 by hand.
- The cli: `morph run` prints the Run Document, which carries the report — no cli change.

## 8. How to run

```
python3 decks/tools/build.py p9b
cd /home/john/Documents/Work2026/MorphProject/morph-lab
venv/bin/mrph plan --root <repo> --spec contour.yaml --map morph-map.json --component runloop --component compiler --judge   # dry
venv/bin/mrph deck clear --root <repo> && venv/bin/mrph deck reset --root <repo>
# deck add of the 9 P9b cards of that dry payload (the cut also yields resolve, capture-inputs,
# parse-answer, compile-card and their judges: not part of P9b)
venv/bin/mrph deck check --root <repo>
venv/bin/mrph run --root <repo> --processor glm53 --deadline 2400   # on the operator's word
```

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 9 (4 code, 5 judges) / 3: [process-generation, build-retry, output-directive] [run-deck, the four judges of gen 1] [run-deck-judge] |
| executor bill | ≈ $0.18 nominal (13 first requests of ≈ 9–14k in / ≈ 3–6k out, + ≈ 40 % retries), ≤ $0.40 with a re-cut |
| cards with regeneration | 3 of 9 (process-generation: two files; compile-card-judge: a patch of a whole file; process-generation-judge) |
| tests after the run | 464 − 10 (directive.examples rewritten) + the new files; ≥ 11 new example tests |
| first red | process-generation: the context of the truncated-last case (PG 4), `""` diff; run-deck: the context keyed by the retry id not the original; output-directive: one word of the texts; judges: a hand-written diff literal off by one line |

**Falsifiable claims:** (1) no judge red traces to a fact of §2.1 C1–C8; (2) no card red on a
sibling's file; (3) no judge cut off at `max_tokens`; (4) no answer of this run loses a file to the
file-set rule after the new directive is accepted (generation 2 on).

## 10. What to record

Attempts and first red per variant (now from the V2-style report rows of the old runner: finish
reasons), minutes per generation, $, judge tests written, the row of `docs/MEASURE.md`.

## 11. Actual

### Gate (preparation)

07.10, on the laptop, by the preparing orchestrator (Opus 5.5); no paid run. Record validated by a dry
`mrph plan --spec --component runloop --component compiler --judge` (exit 0; 16 cards: the 9 of
P9b + resolve, capture-inputs, parse-answer, compile-card and their judges, not added) and by the
repository's own Load Spec example 4 (48/48 contour tests). `deck clear`, `deck reset`, `deck add`
of the 9 cards, `deck check`: 9 cards, 0 errors, 0 warnings, 0 hazards; generations
`[build-retry, output-directive, process-generation] [build-retry-judge, output-directive-judge,
process-generation-judge, run-deck, compile-card-judge] [run-deck-judge]`; every card's
acceptance in `.morph/deck.json` equals the map's. compile-card-judge keeps the planner's
`depends_on` compile-card, absent from the deck (external).

Ripple spike (scratch worktree, crude reference): the new runloop alone 464/464; the new directive
alone reddens exactly 12 tests in 3 files (compile.examples 3, directive.examples 7, directive.test
2), all owned by cards of this deck.

Stubs (scratch worktree, the data commit; the patch targets at HEAD with the new types and
`requests: []`, `retryContexts: {}` as typed stubs): process-generation red at the probe on 6 of 7
tests (PG 4–7 each with a readable `AssertionError: retryContexts|requests: expected …` line;
the types test passes on typed stubs); build-retry red on BR 4 (+1 §2.2 row); output-directive red
on OD 1–3 (OD 4, the throw, holds on the old code: unchanged behaviour) + the multi-text row;
run-deck red on RD 4, RD 5 and both §2.2 rows; judges with their file absent red at eslint (`No
files matching the pattern`); output-directive-judge on the old file red at the guard (3 example
literals missing); compile-card-judge on the old file red at the guard (`outputDirective` missing),
and with the import added but the literals unchanged red at its own step (3 tests), with a test
removed red at the names step (`test removed: "patchNew inputs digest"`). Stub chains 1.0–2.6 s.

Reference (scratch, per card in generation order, each card's targets committed after its
acceptance as Morph would): 9 of 9 chains green, 4.5–7.0 s each (limit 250 s); the tree after:
475 tests in 48 files green. Mutations: 20 single-rule mutations of the reference (process-generation
9: first ran variant, last result regardless of ran, "" diff kept, no context for a compile fault /
for stale, a context for a written card, the last log with the ran diff, model always the
config's, finishReason dropped; build-retry 2; run-deck 4: previousDiff null as in P5, a later
round not replacing, retry rows dropped, the output taken from acceptanceLog; output-directive 5:
a language tag, comma-joined targets, no count, a trailing newline, the old placeholder) — 20 of 20
killed by the card's probe (the acceptanceLog one survived the first probe; a §2.2 row was added).

Max slice + targets + instruction on the finished tree: process-generation 51 114 bytes,
process-generation-judge 51 106 (gate 200 KB). Forecast ≈ $0.15–0.18 nominal (≤ $1 gate, cap $5).
