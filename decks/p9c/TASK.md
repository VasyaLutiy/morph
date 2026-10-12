# TASK_P9c — the retry says what the old one said: the command, the framing, the diff per file (`src/runloop/`, `src/acceptance/diff.ts`)

> Phase P9c, inserted after P9b by the operator (07.10) before the switch to V2. It closes the two
> gaps left between V2's retry and the old runner's, found by replaying the P9 deck on the V2 binary
> after P9b. Components `runloop` (Functions Build Retry, Process Generation; Run Deck example 4;
> Data Object Retry Context) and `acceptance` (Function Build Attempt Diff) of `contour.yaml`. Every
> change is a **patch** of code written in P3, P5 and P9b; the test files that pin the old behaviour
> are patched by their judges. Built by the old Morph (`mrph`) on glm.

## 1. Why this

The switch test, step 1, again after P9b: the P9 deck (old `mrph` cut, `decks/tools/v2deck.py`)
replayed by the V2 binary. **V2: 0 of 8** in 2 replays — `validate-record` red in all 6 attempts.
**Old mrph on the same deck: `validate-record` passed on r2.v1** (2 of 2 old runs).

The old retry prompt, rebuilt with old mrph's own code: **80 722 chars against 47 321** for the first
request (+9.2k tokens, matching the measured usage). V2's retry addendum is ~1.1k chars. The
difference:

1. **The acceptance command.** mrph `cards/generations.py::_retry_card` writes "A previous attempt
   failed its acceptance check (`<the card's acceptance>`):" — the WHOLE command, 23 032 chars for
   `validate-record` (the builder inlines the probe tests with their expected values, the guard, the
   tsconfig) — then the output inside `<acceptance_output>`, a closing sentence, and the diff inside
   `<previous_attempt_diff>` framed as "YOUR OWN previous edit, not a proposed change". An answer
   whose acceptance never ran gets "A previous attempt was discarded before acceptance could run:",
   "Produce the complete file again, from the context given above." and no diff. V2 sends "Your
   previous attempt failed its acceptance. …\nAcceptance output:\n" and a truncated AssertionError:
   the model guesses the test from one line.
2. **The diff cap.** Old `cards/attempt_diff.py`: `ATTEMPT_DIFF_CAP` 6000 **per file**, clipped head
   AND tail by whole lines with "... [N characters elided] ..." (`validate-record`: 2 884 + 5 921 =
   8 805 chars). V2 `src/acceptance/diff.ts`: 6000 for all files together, head only — the tail of
   `record.ts` (the walk-order logic, the fault P9's retries kept repeating) never reaches the retry.
3. A one-word difference deep in a long string is invisible in the acceptance output: the vitest
   assertion line is cut at `truncateThreshold: 200` and the builder's filter dropped the full
   "Expected:/Received:" lines (P9b, output-directive-judge, 3 attempts). Fixed in the builder (data,
   §3), not in a card.

PLAN: none (inserted phase). This cut: **7 cards** (3 code patches, 4 judge patches), 2 generations,
**5 new record examples** (Build Retry 5–6, Process Generation 8, Build Attempt Diff 5) and **4
rewritten** (Build Retry 1, 2, 4; Build Attempt Diff 4) plus Run Deck 4's `then`.

## 2. Contract

### 2.1. INPUT data shapes the code must build

No new fixture. Build Attempt Diff examples 4 and 5 take `tests/fixtures/acceptance/bigAfter.txt`
(text, 9 890 chars, 400 lines `export const v000 = 0;` … `export const v399 = 399;`, each ending in
`\n`) as the `after` content of one path (example 4: `src/big.ts`) or of two paths (example 5:
`src/a.ts` and `src/b.ts`, the same text under both keys), every `before` entry `null`. Every other
example builds its inputs inline; the literals are in the record (Component, Function, example `given`).

- **Card** — `src/cards/types.ts`: every field set by the test.
- **RetryContext** — `src/runloop/types.ts` (unchanged type): `{acceptanceOutput: string,
  previousDiff: string | null}`; the meaning of `null` is new (§2.2).
- **VariantResult** — `src/acceptance/types.ts`: `{variant, exit, log, diff: string | null}`.

**A judge's setup across Components** (TASK_TEMPLATE §2.1). Facts a test's setup depends on:

- **F1** acceptance · Verify Card runs the acceptance on an answer whose file equals the snapshot and
  returns its result with `diff: ""` (Build Attempt Diff: equal lines → nothing) · without it Process
  Generation 8 has no case to show. Cited by PG 8.
- **F2** acceptance · Run Acceptance runs the command under `/bin/sh` in `root` with exactly the given
  env; `echo "red: $(cat out/a.ts)"` logs `red: export const x = "ONE";\n` (`$( )` drops the file's
  last newline, `echo` adds one) · PG 8.
- **F3** runloop · Run Deck builds every retry from the ORIGINAL card (`buildRetry(original, n,
  ctx.acceptanceOutput, ctx.previousDiff)`), so the command in the header is the original card's
  `acceptance`, character for character · RD 4.
- **F4** processor + compiler · on an `openrouter` config the card's instruction is the start of the
  LAST message of the request body, followed by `"\n\n"` and the output directive (so a test checks
  `includes`, never `endsWith`, on the message) · RD 4.

Each judge patches a file that already holds its harness (`harness()`, `fenced()`, `card()`,
`fullCard()`, `CHAT`, `reply()`, `lastMessage()`): reuse it, write no second one.

**Distinct markers.** The retry texts are told apart by `<acceptance_output>`, `<previous_attempt_diff>`,
"failed its acceptance check" and "was discarded before acceptance could run"; none is a substring of
another. The clip marker is `... [<n> characters elided] ...`; the old V2 marker `[diff clipped:` no
longer exists anywhere.

### 2.2. OUTPUT data shapes

**`buildRetry`** (`src/runloop/retry.ts`) — the signature, the attempt check, the id rule and the
copied fields stay as P5 (byte for byte). `previousDiff === null` means the acceptance never ran
(answer discarded unread, compile fault, stale inputs); a string, `""` included, means it ran. With
`I` = `card.instruction`, `A` = `card.acceptance ?? ""` (the command processGeneration runs), `O` = `acceptanceOutput`, `D` = `previousDiff`
(`\n` is a line break):

| case | instruction, exactly |
|---|---|
| `D` null | `I + "\n\n<acceptance_output>\nA previous attempt was discarded before acceptance could run:\n" + O + "\n</acceptance_output>\nProduce the complete file again, from the context given above."` |
| `D` is `""` | ``I + "\n\n<acceptance_output>\nA previous attempt failed its acceptance check (`" + A + "`):\n" + O + "\n</acceptance_output>\nPlease fix the issues and produce the complete corrected file."`` |
| `D` non-empty | the `""` text + `"\n\n<previous_attempt_diff>\nYour previous attempt changed the file like this (unified diff):\n" + D + "\n</previous_attempt_diff>\nThe diff above is YOUR OWN previous edit, not a proposed change: correct it where it went wrong rather than rewriting the file from scratch."` |

The texts are the old runner's, word for word, capitals included ("YOUR OWN"), singular "the file"
even for a card with several targets. The command goes between two backticks as it is, never escaped
or clipped. Illustration (record Build Retry example 4, card `{instruction: "Write c.", acceptance:
"grep -q MARK src/c.ts"}`, `O = "red\n"`, `D = "@@ -1,1 +1,1 @@\n-a\n+b\n"`):

```
Write c.

<acceptance_output>
A previous attempt failed its acceptance check (`grep -q MARK src/c.ts`):
red

</acceptance_output>
Please fix the issues and produce the complete corrected file.

<previous_attempt_diff>
Your previous attempt changed the file like this (unified diff):
@@ -1,1 +1,1 @@
-a
+b

</previous_attempt_diff>
The diff above is YOUR OWN previous edit, not a proposed change: correct it where it went wrong rather than rewriting the file from scratch.
```

(an output ending in `\n` and a diff ending in `\n` each leave one empty line before the closing tag).

**`processGeneration`** (`src/runloop/generation.ts`) — every P5/P9b rule unchanged except ONE: a
rejected card's context is `{acceptanceOutput: ran.log, previousDiff: ran.diff}` — the diff as Verify
Card gave it, `""` kept (P9b turned `""` into `null`). So `previousDiff` is `null` exactly when no
acceptance ran (compile fault, stale inputs, every answer corrupt or truncated). Nothing else in the
file changes.

**`buildAttemptDiff`** (`src/acceptance/diff.ts`) — rules 1–4 of TASK_P3 §2.2 unchanged (LCS,
headers, hunks, counts); `DIFF_CAP = 6000` stays exported with the same value; rule 5 becomes:

5. Each file's **section** (its `---`/`+++` lines and its hunks, built by rules 2–4) is clipped on
   its own, then the sections are concatenated in key order, nothing between them. A section of
   `DIFF_CAP` chars or fewer is kept whole. A longer one, `L` chars, split into lines each keeping
   its `\n`: `u` = the length of `"... [" + L + " characters elided] ..."`; `budget` =
   `Math.floor(DIFF_CAP / 2) - u` (the same for head and tail); the head is the longest run of
   lines from the start whose total length is ≤ `budget`; the tail the longest run from the end,
   never reaching a head line, whose total is ≤ `budget`; `n` = `L` − head length − tail length;
   the result is head + `"... [" + n + " characters elided] ...\n"` + tail.

Illustration (record example 4): the section of the new 400-line `src/big.ts` is 10 339 chars; `u` =
33, budget 2 967; head = the 3 header lines and `+export const v000 = 0;` … `+export const v115 =
115;` (119 lines), tail = `+export const v286 = 286;` … `+export const v399 = 399;` (114 lines),
`n` = 4 420; the result is 5 952 chars, 234 lines. Example 5: the same text under `src/a.ts` and
`src/b.ts` gives two 10 337-char sections, each clipped to 5 950 chars with `n` = 4 420, 11 900
chars together; `src/a.ts`'s tail (`+export const v399 = 399;\n`) ends at char 5 950, where
`--- /dev/null\n+++ b/src/b.ts\n` begins. These numbers are the old runner's `_clip_diff` applied
to each section (checked against mrph's code, §11).

**`runDeck`** — no code change; record example 4's `then` now names the new texts (F3, F4).

### 2.3. Names and the tests each judge patches

| module | change | code card's tests | judge's file(s) |
|---|---|---|---|
| `src/runloop/retry.ts` | the texts of §2.2 | probe only | `tests/runloop/retry.examples.test.ts` + `tests/runloop/retry.p9b.examples.test.ts` |
| `src/runloop/generation.ts` | `""` kept | probe only | `tests/runloop/generation.p9b.examples.test.ts` |
| `src/acceptance/diff.ts` | rule 5 per section | probe only | `tests/acceptance/diff.examples.test.ts` |
| — (`src/runloop/deck.ts` unchanged) | — | — | `tests/runloop/deck.p9b.examples.test.ts` |

Every judge **patches**: it returns its file(s) whole, changes only the tests listed here, and keeps
every other test, name and line as it is (the acceptance checks the names).

- `retry.examples.test.ts` (Build Retry 1–3, all 8 names kept): **example 1** — the two `toContain`
  become ``"A previous attempt failed its acceptance check (`grep -q MARK src/c.ts`):\nexit 1\n"`` and
  `"Your previous attempt changed the file like this (unified diff):\n@@ -1,1 +1,1 @@"`; **example 2**
  — `endsWith("A previous attempt was discarded before acceptance could run:\nstill red\n</acceptance_output>\nProduce the complete file again, from the context given above.")`
  and no `"<previous_attempt_diff>"`; **"instruction addendum exact prefix"** — for `buildRetry(card,
  1, "boom", null)` it checks `toContain("<acceptance_output>\nA previous attempt was discarded before acceptance could run:\nboom\n</acceptance_output>")`.
- `retry.p9b.examples.test.ts` (Build Retry 4–6): **example 4** — the whole text of §2.2's
  illustration with `toBe`; the two tests "previousDiff null has no diff block and no closing
  sentence" and "an empty string diff is not null and gets the block" are **replaced** by
  "Build Retry example 5: …" (`D` null, the record's exact text) and "Build Retry example 6: …" (`D`
  `""`, the record's exact text); "the customId of a second retry strips one trailing .r<n>" stays.
  The file's `card()` already sets `acceptance: "grep -q MARK src/c.ts"`.
- `generation.p9b.examples.test.ts` (Process Generation 4–8): the test "Process Generation own: an
  attempt that changed nothing gets the block-less context (empty diff is null)" is **replaced** by
  "Process Generation example 8: …" with the record's values (`previousDiff: ""`); the file's `GREP`
  is example 8's acceptance. Nothing else changes.
- `diff.examples.test.ts` (Build Attempt Diff 1–5): the test "Build Attempt Diff example 4: a new
  400-line file is clipped to exactly DIFF_CAP" is **replaced** by "Build Attempt Diff example 4: …"
  (length 5952; `startsWith` the 4 lines of the record; `includes("+export const v115 = 115;\n... [4420 characters elided] ...\n+export const v286 = 286;\n")`;
  `endsWith("+export const v399 = 399;\n")`), its comment line with it, and "Build Attempt Diff
  example 5: …" is inserted right after it (length 11900; `diff.slice(0, 5950)` ends with
  `"+export const v399 = 399;\n"`; `diff.slice(5950)` starts with `"--- /dev/null\n+++ b/src/b.ts\n"`;
  the marker `"... [4420 characters elided] ...\n"` occurs exactly twice:
  `diff.split(marker).length` is 3). "DIFF_CAP is 6000" and every other test stay.
- `deck.p9b.examples.test.ts` (Run Deck 4–5, all 4 names kept): in **example 4** the
  `"Acceptance output:\nfirst-red\n"` check becomes the record's ``"A previous attempt failed its acceptance check (`if [ -f seen ]; then grep -q MARK out/a.ts; else touch seen; echo first-red; exit 1; fi`):\nfirst-red\n\n</acceptance_output>"``,
  the `"Your previous attempt (rejected):\n--- /dev/null…"` check becomes the record's
  `"<previous_attempt_diff>\nYour previous attempt changed the file like this (unified diff):\n--- /dev/null\n+++ b/out/a.ts\n@@ -0,0 +1,1 @@\n+export const x = \"MARK\";\n\n</previous_attempt_diff>"`,
  and the first call holds no `"<acceptance_output>"`; in **"the retry after a truncated answer has no
  diff block"** the second message `includes("<acceptance_output>\nA previous attempt was discarded before acceptance could run:\nanswer truncated\n</acceptance_output>\nProduce the complete file again, from the context given above.")`
  and holds neither `"<previous_attempt_diff>"` nor `"--- /dev/null"` nor `"failed its acceptance check"`.

Strings with `toBe` or `includes(...)` + `toBe(true)`; a literal with a backtick inside goes in a
double-quoted string (``"...(`grep -q MARK src/c.ts`)..."``), never a template literal. No `vi.*`, no
timers, no variable named `fetch` or `Fake*`; import only what you use (eslint).

### 2.4. What must not break

- Byte for byte: everything outside the targets of §2.3 — `src/runloop/{deck,resolve,types}.ts`,
  `src/acceptance/{run,snapshot,verify,types}.ts`, every other `src/`, `tests/helpers.ts`, every test
  file not in §2.3.
- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/` — untouched by every card.
- The 479 tests stay green except the 10 the ripple spike reddens (§11), all in the five files of §2.3:
  `diff.examples` 1, `retry.examples` 3, `retry.p9b.examples` 3, `generation.p9b.examples` 1,
  `deck.p9b.examples` 2.

## 3. Acceptance

Built by `decks/tools/build.py p9c` into the `acceptance` of the 7 cards in `morph-map.json`. Narrow
to broad; the first red is the regeneration's diagnosis.

Code cards: `probe/<card>/` (guard, firstdiff, vitest config, `tsconfig.card.json` excluding the
targets of the same generation's other cards) → `tsc` → `eslint <target>` → `guard.mjs src <target>`
→ `decks/p9c/parts/<card>.probe.ts` (build-retry: BR 1–6 + 3 §2.2 rows = 9 tests;
process-generation: PG 4, 5, 6, 8 + 1 row = 5; build-attempt-diff: BAD 1–5 + 3 rows = 8) → full
`vitest run` → frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <targets>` → per file `guard.mjs tests <file> <min>
<max> lits.json` → per file: every test name of the file at HEAD is still in it, except the names
§2.3 replaces → `vitest run <targets>` → full `vitest run` → frozen → untracked.

| file | min (its examples) | max | names dropped |
|---|---|---|---|
| `tests/acceptance/diff.examples.test.ts` | 5 | 17 | example 4's old name |
| `tests/runloop/retry.examples.test.ts` | 3 | 11 | none |
| `tests/runloop/retry.p9b.examples.test.ts` | 3 | 11 | the two replaced |
| `tests/runloop/generation.p9b.examples.test.ts` | 5 | 13 | the replaced own test |
| `tests/runloop/deck.p9b.examples.test.ts` | 2 | 13 | none |

**Known red, deselected deck-wide**: the full step of every card runs with `--exclude` of the five
files above — each goes red the moment its code card is accepted (generation 1) and green again only
when its judge patches it (generation 2); each judge runs its own file(s) in its own step.

**First difference** (from this phase on): when a vitest step fails, after the filtered lines the
acceptance prints, for every comparison vitest showed in full, `first difference at char <k> of
<len>/<len>: expected "…" received "…"` with 40 chars around it (`decks/tools/firstdiff.mjs`, inlined).

Dense output: `--reporter=dot`, failures filtered to `^ FAIL |Error|expected|received`, 80 lines.
The chain is timed on a dry tree (§11 Gate), limit 300 s.

**Output budget** (`max_tokens`): target bytes / 3.5 × 2 + 2 500 reasoning, rounded up.

| card | expected answer | `max_tokens` |
|---|---|---|
| build-attempt-diff | diff.ts ≈ 7.2 KB ≈ 2 060 tok | 12 000 |
| build-retry | retry.ts ≈ 1.7 KB ≈ 490 tok | 8 000 |
| process-generation | generation.ts 7.0 KB ≈ 2 010 tok | 12 000 |
| build-attempt-diff-judge | diff.examples ≈ 6.2 KB ≈ 1 770 tok | 16 000 |
| build-retry-judge | two files ≈ 3.9 + 2.9 KB ≈ 1 950 tok | 20 000 |
| process-generation-judge | ≈ 7.3 KB ≈ 2 090 tok | 24 000 |
| run-deck-judge | ≈ 8.4 KB ≈ 2 400 tok | 24 000 |

## 4. Constraints

- NodeNext (`.js` in relative imports, `import type`); no `any`; `retry.ts` imports only the Card
  type; `diff.ts` imports nothing; `generation.ts` keeps its imports.
- A patch card returns each target whole; every rule of P3/P5/P9b not named in §2.2 stays as it is.
- Tests write only under `tmpRoot()` and remove it; no fixture is written; a judge writes only its
  test file(s). A file a card writes is in no sibling's slice in the same generation.
- Exact strings of §2.2 are copied, not rephrased.

## 7. Out of scope

- The stand-in log texts (`answer truncated`, `answer corrupt: <reason>`): the old runner's longer
  sentences (`TRUNCATED_RESPONSE_MESSAGE`, the file-set messages) are not copied; the discarded
  framing carries V2's log as is.
- The acceptance log clip (`clipLog`, P3): the old runner kept a tail; V2's head + diagnosis + tail
  stays.
- The old runner's `"\n"` between two file diffs: V2 concatenates sections as P3 pinned (Verify Card
  example 2).
- The old clipper's character-cut fallback (no whole line fits either half): unreachable in V2 — a
  section always starts with its short `---` line.
- A plural "files" for several targets: the old text says "the file" for every card.
- The planner (P10): judge slices with callee contracts (#3) — still carried in §2.1 by hand.

## 8. How to run

```
python3 decks/tools/build.py p9c        # never re-run p3, p5 or p9b: their cards are now P9c's
cd /home/john/Documents/Work2026/MorphProject/morph-lab
venv/bin/mrph plan --root <repo> --spec contour.yaml --map morph-map.json --component runloop --component acceptance --judge   # dry
venv/bin/mrph deck clear --root <repo> && venv/bin/mrph deck reset --root <repo>
# deck add of the 7 P9c cards of that dry payload (the cut also yields resolve, run-deck, snapshot-targets,
# run-acceptance, verify-card and their judges but run-deck-judge: not part of P9c)
venv/bin/mrph deck check --root <repo>
venv/bin/mrph run --root <repo> --processor glm53 --deadline 2400   # on the operator's word
```

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 7 (3 code, 4 judges) / 2: [build-attempt-diff, build-retry, process-generation] [the four judges] |
| executor bill | ≈ $0.06 nominal (10 first requests — 3 code × 2 variants + 4 judges — of ≈ 8–12k in / ≈ 1–5k out; a retry now carries its 17–23k-char acceptance, ≈ +5k tokens), ≤ $0.15 with retries and a re-cut |
| cards with regeneration | 2 of 7 (build-attempt-diff: the budget arithmetic; build-retry-judge: two files and backticks inside strings) |
| tests after the run | 480 (479 + Build Attempt Diff 5; BR 5–6 and PG 8 replace three tests) — the reference tree's count |
| first red | build-attempt-diff: the head/tail budget off by the marker length, or a global clip left in place; build-retry: "the file" pluralised or the backticks escaped; judges: a hand-copied text one word off (the firstdiff line names it) |

**Falsifiable claims:** (1) no judge red traces to a fact of §2.1 F1–F4; (2) no card red on a
sibling's file; (3) no answer cut off at `max_tokens`; (4) every red of a vitest step that compares
long strings carries a `first difference at char` line.

## 10. What to record

Attempts and first red per variant (finish reasons from the old runner's report rows), minutes per
generation, $, judge tests written, the row of `docs/MEASURE.md`. Then the switch test, step 1 again:
the P9 deck replayed on the V2 binary built from this phase's tree.

## 11. Actual

### Gate (preparation)

07.10, on the laptop, by the preparing orchestrator (Opus 5.5); no paid run. Record validated by a dry
`mrph plan --spec --component runloop --component acceptance --judge` (exit 0; 16 cards: the 7 of P9c +
resolve, run-deck, snapshot-targets, run-acceptance, verify-card and their judges but run-deck-judge,
not added; per Component: runloop 5 of 8, acceptance 2 of 8). `deck clear`, `deck reset`, `deck add`
of the 7 cards, `deck check`: 7 cards, 0 errors, 0 warnings, 0 hazards; generations
`[build-attempt-diff, build-retry, process-generation] [build-attempt-diff-judge, build-retry-judge,
process-generation-judge, run-deck-judge]`; every card's acceptance in `.morph/deck.json` equals the
map's. run-deck-judge keeps the planner's `depends_on` run-deck, absent from the deck (external).

Old runner parity: the reference clip, applied to V2's section text of examples 4 and 5, equals mrph
`cards/attempt_diff.py::_clip_diff` on the same text, byte for byte (python import of mrph's module).

Ripple spike (scratch worktree, crude reference of the three code changes): exactly 10 tests red in 5
files — `diff.examples` 1 (example 4), `retry.examples` 3 (examples 1, 2, "exact prefix"),
`retry.p9b.examples` 3 (example 4 + the two replaced), `generation.p9b.examples` 1 (the replaced own
test), `deck.p9b.examples` 2 (example 4, the truncated row); every one in a file a judge of this deck
patches. verify.examples, the P5 deck/generation files: green.

Stubs (scratch worktree at the data commit; the patch targets at HEAD are the stubs): build-attempt-diff
red at the probe on 5 of 8 (examples 4, 5 and the three rows, each with a readable `AssertionError`
line and a `first difference at char` line; examples 1–3 hold: rules 1–4 unchanged); build-retry red on
8 of 9 (every example but 3, the throw, unchanged); process-generation red on PG 8 alone (`previousDiff:
null` vs `""`; examples 4–6 and the stale row hold: unchanged behaviour). Judges on the HEAD files (code
references in place): red at the guard, the new example literals missing; build-retry-judge with a
test name removed red at the names step (`test removed: "Build Retry: only the trailing retry suffix is
stripped"`); with one blank line dropped from example 6's expected text red at its own step with
`first difference at char 108 (line 6) of 191/192: expected "...src/c.ts`):\nred\n</acceptance_output>..."`.
Stub chains 1.7–2.6 s.

Reference (scratch, per card in generation order, each card's targets committed after its acceptance as
Morph would): 7 of 7 chains green, 4.8–7.8 s each (limit 250 s); the tree after: 480 tests in 48 files
green, `tsc --noEmit` and `eslint src tests` green. Mutations: 16 single-rule mutations of the reference
— build-attempt-diff 6 (one global clip, tail budget 0, head budget without the marker, marker without
its newline, `n` counting the marker, `<` for `<=` at the cap), build-retry 8 (backticks replaced,
`""` given the diff block, always the ran framing, "files", no newline before the closing tag, "your
own", the command clipped at 2 000, a null acceptance printed `null`), process-generation 2 (`""` →
null, the first ran variant) — 16 of 16 killed by the card's probe. The null-acceptance case was found
by the mutation run (`Card.acceptance` is `string | null`); §2.2 now pins `A = card.acceptance ?? ""`.

Max slice + targets + instruction: build-attempt-diff-judge 48 989 bytes, process-generation-judge
45 233 (gate 200 KB). Forecast ≈ $0.06 nominal, ≤ $0.15 (≤ $1 gate, cap $5).

### Run

07.10, on the laptop, processor glm53, on the operator's word (forecast $0.06–0.15, cap $5). "Burned"
= every request that was not a winning write (requests − written).

**Run** `20261007-105136-a1e1b533`, branch `morph/20261007-105136-a1e1b533`, 10:51:36 → 10:55:09
(3.6 min; generation 1 ≈ 2.2 min, generation 2 ≈ 1.4 min), 12 requests, 161 004 in / 31 352 out,
**$0.0873**. 7 written, 0 failed, 0 skipped; 5 variants burned; no fix, no re-cut. Every finish reason
`stop`; the largest answer build-attempt-diff.v1 9 540 of 12 000 out tokens.

| card | gen | attempts | winning variant | commit | first red of each burned variant |
|---|---|---|---|---|---|
| build-attempt-diff | 1 | 1 | v2 | c0390c2 | v1: cut off mid-file (unclosed fence, finish `stop`, 9 540 out), rejected before acceptance |
| build-retry | 1 | 1 | v1 | 4bc302b | v2: losing variant (not surfaced) |
| process-generation | 1 | 1 | v1 | e77edbe | v2: losing variant (not surfaced) |
| build-attempt-diff-judge | 2 | 1 | — | 03a05c3 | — |
| build-retry-judge | 2 | 2 | r1 | 3bfa9eb | first: did not return the card's files (both targets missing), rejected before acceptance |
| process-generation-judge | 2 | 2 | r1 | ceca363 | first: cut off mid-file (unclosed fence, finish `stop`, 2 165 out), rejected before acceptance |
| run-deck-judge | 2 | 1 | — | edef96b | — |

No acceptance went red: every burned variant was a format reject or a losing variant. On the run branch:
`git status --short` empty; `tsc --noEmit`, `eslint src tests`, `npm run build` green; `vitest run` 480
tests in 48 files green (predicted 480). Pre-registration: cards with regeneration 2 of 7 as predicted,
but other cards (build-retry-judge and process-generation-judge, not build-attempt-diff, whose v1 burned
and v2 won); claims (1)–(3) hold (no acceptance red, no `length` finish); claim (4) untested (no vitest
red). Local `main` fast-forwarded to the run archive 0138224; not pushed.

