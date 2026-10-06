# TASK_P3 — the acceptance (`src/acceptance/`)

> Phase P3 of `docs/PLAN.md` ("Фазы по записи (после P2)"), Component `acceptance` of
> `contour.yaml` (four Functions: Snapshot Targets, Run Acceptance, Verify Card, Build
> Attempt Diff; three Data Objects: Target Snapshot, Acceptance Result, Verify Outcome;
> Guardrail No Shell Outside Acceptance). TypeScript under `src/acceptance/`: remember the
> targets' bytes, write a parsed variant, run the card's acceptance command in a shell
> with a timeout that kills the whole process group, keep the first green variant, roll
> back otherwise, and build the diff the retry will carry. The first `node:child_process`
> of the tree. Built by the old Morph (`mrph`) on glm; judge cards write the example tests.
>
> Reconciliation with the PLAN: the draft P6 row (snapshotTargets, runCommand,
> diffAttempt, verifyBestOfN) is this Component; the record's names win (`runAcceptance`,
> `buildAttemptDiff`, `verifyCard`). The draft's "syntax check by the language profile"
> before the command is not in the record and stays with P8 `language` (§7).

## 1. Why this

Every card of every run is judged here; a fault in this Component turns correct code red
or wrong code green for the whole deck. The old Morph paid for each rule below:

- **Timeout without the process group.** `cards/acceptance.py`, `run_acceptance(...,
  timeout=300.0)` kills the shell only; a `vitest` or `sleep` grandchild keeps the pipe
  open and survives. The visible symptom, "acceptance failed (exit None)" printed over a
  green log, is the third bullet of `docs/AUTONOMY.md` "Failure" and one of the
  environment reds that stop a phase. The record's example 3 of Run Acceptance asserts no
  orphan: measured on this machine (spike, 06.10), a group kill returns in 208–210 ms
  (6 of 6 runs) with the backgrounded `sleep` gone; killing only the shell returns after
  the sleep ends (3008 ms for `sleep 3`).
- **Diagnosis lost in clipping.** The old Morph once kept only the tail of the log and a
  card "burned every retry on a cause it was never shown" (`cards/acceptance.py`,
  `clip_output` docstring: the dropped middle held `intent must be one of ...`); it now
  keeps head and tail by whole lines and rescues diagnosis lines, with several exact
  elision markers. V2 keeps the rule and simplifies the arithmetic to one marker and
  fixed char budgets, so the record can pin the result byte for byte: head 1500 + the
  diagnosis lines of the middle (≤ 800 chars) + tail 1500. The P2 logs were 60–473 bytes
  (`/tmp/morph/parse-answer-p2/acc-*.log`, filtered by `build.py`), so the clip matters
  for unfiltered commands (P0's `npm install` and `tsc` steps).
- **Rollback.** A rejected variant must leave the tree byte for byte; P2 burned 5
  variants (`docs/TASK_P2_compiler.md` §11), each of which was written and rolled back by
  the old Morph's equivalent of Verify Card. A missing rollback of a *new* target leaves
  an untracked file that reddens the next variant's "files left in the tree" step.
- **Retry diagnosis.** The P2 regeneration of `parse-answer.r1` carried the previous
  attempt's diff; the old Morph caps it at 6000 chars (`<previous_attempt_diff>`), kept.

PLAN row P6: 8 cards, forecast $0.9; this cut is 8 cards (4 code, 4 judge), 14 record
examples (3 + 4 + 3 + 4).

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **A root** — every Function takes `root`, an absolute directory; a path `p` of a target
  is `path.join(root, p)`. Never `process.cwd()`. Tests use `r = tmpRoot()` from
  `tests/helpers.ts` (`r.root` is already `realpath`ed), write into it with
  `r.write(rel, text)` (text) or `fs.writeFileSync(r.path(rel), Buffer.from([...]))`
  (bytes), and `r.rm()` at the end.
- **Targets** — `string[]`, repo-relative, distinct (as `Card.targets` of
  `src/cards/types.ts`). Snapshot Targets example 1: `["src/a.ts", "src/b.ts"]`;
  example 2: `["src/deep/a.ts"]`; example 3: `["bin.dat"]`. No fixture: the literals are
  in the record (Component acceptance, Function Snapshot Targets, examples 1–3).
- **An environment** — `Record<string, string>`, passed by the caller; the code never
  reads `process.env`. Every example passes `{PATH: "/usr/bin:/bin"}` (plus `FOO` and
  `NO_COLOR` in Run Acceptance example 2). A command is one `string` for `sh -c`.
- **A Parsed Answer** — the type `ParsedAnswer` of `src/compiler/types.ts` (P2, accepted):
  exactly one of `{files: Record<string, string>}`, `{corrupt: string}`,
  `{truncated: true}`. Verify Card takes an array of `{variant, answer}` (§2.2
  `VariantAnswer`); the examples build them inline, no file:
  - example 1: `c.v1` `{corrupt: "missing section for src/a.ts"}`, `c.v2`
    `{files: {"src/a.ts": "bad\n"}}`, `c.v3` `{files: {"src/a.ts": "good\n"}}` → accepted
    `c.v3`, **three** results, exits `null, 1, 0`;
  - example 2: targets `["src/a.ts", "src/b.ts"]`, `c.v1` `{truncated: true}`, `c.v2`
    `{files: {"src/a.ts": "bad\n", "src/b.ts": "x\n"}}` → accepted `null`, **two**
    results, exits `null, 1`;
  - example 3: `c.v1` and `c.v2` both `{files: {"src/a.ts": "good\n"}}` → accepted
    `c.v1`, **one** result.
  The root of every Verify Card example holds `src/a.ts` = `old\n` (4 bytes) and nothing
  else; the command of every example is
  `grep good src/a.ts || { echo "FAIL: no good in src/a.ts"; exit 1; }` (exit 0 and log
  `good\n` when the file holds a line with `good`, else exit 1 and log
  `FAIL: no good in src/a.ts\n`).
- **Fixtures** `tests/fixtures/acceptance/` — three text files, nothing else, none of them
  `.ts` (so `tsc` never reads them):
  - `longLog.txt` — 6403 chars (ASCII, so also bytes), 200 lines, each ending `\n`.
    Line n is `ok line NNN` padded with `.` to 31 chars, except three diagnosis lines:
    line 80 ` FAIL  tests/a.test.ts > adds..` (31), line 100
    `AssertionError: expected 3 to be 4` (34), line 120 `Error: boom at src/a.ts:7......`
    (31). It is **not** the input of Run Acceptance example 4: the input is the command
    string `cat '<fixturePath("acceptance/longLog.txt")>'`; the file is what the child
    prints. No other line matches `/FAIL|Error|assert|expected/`.
  - `longLogClipped.txt` — 3154 chars, 99 newlines: exactly `clipLog` of `longLog.txt`,
    so exactly the `log` of Run Acceptance example 4: chars 0–1499 of `longLog.txt`, then
    `\n[... 3403 chars clipped; diagnosis lines kept:]\n`, then the three diagnosis lines
    above each followed by `\n`, then `[...]\n`, then the last 1500 chars of `longLog.txt`.
  - `bigAfter.txt` — 9890 chars, 400 lines `export const v000 = 0;` …
    `export const v399 = 399;` (`v` + the index zero-padded to 3, ` = `, the index
    unpadded, `;`), each ending `\n`. It is the **value** of `after["src/big.ts"]` in Build
    Attempt Diff example 4 (`before` is `{"src/big.ts": null}`); the full diff would be
    10339 chars (header 49 + 400 × (1 + line + 1)), the result is 6000.
- **Build Attempt Diff examples 1–3 have no file**: their `before`/`after` literals are in
  the record (Component acceptance, Function Build Attempt Diff, examples 1–3); a test
  builds the 10- and 20-line texts as `"line 1\nline 2\n…"` with a loop.
- **Types**: everything in §2.2 is defined in `src/acceptance/types.ts`, written in this
  phase by the card that owns `src/acceptance/snapshot.ts`; `ParsedAnswer` comes from
  `src/compiler/types.ts`. Modules import with `import type { ... } from "./types.js"`;
  tests from `../../src/acceptance/types.js`.
- **Test helpers**: `tests/helpers.ts` (P0): `tmpRoot()`, `fixture(name)` text,
  `fixturePath(name)` absolute path. No other stub; no `vi.mock`; no `setTimeout`.

### 2.2. OUTPUT data shapes

`src/acceptance/types.ts` exports exactly these names (types only, no values):

```ts
import type { ParsedAnswer } from "../compiler/types.js";
export interface SnapshotEntry { path: string; bytes: Uint8Array | null }   // null = absent
export interface TargetSnapshot { root: string; entries: SnapshotEntry[] }  // targets order
export interface RunOptions { env: Record<string, string>; timeoutMs?: number }
export interface AcceptanceResult { exit: number | null; log: string; timedOut: boolean }
export interface VariantAnswer { variant: string; answer: ParsedAnswer }
export interface VerifyInput {
  root: string;
  targets: string[];
  command: string;
  variants: VariantAnswer[];
  env: Record<string, string>;
  timeoutMs?: number;
}
export interface VariantResult { variant: string; exit: number | null; log: string; diff: string | null }
export interface VerifyOutcome { accepted: { variant: string } | null; results: VariantResult[] }
```

**`snapshotTargets(root: string, targets: string[]): TargetSnapshot`** and
**`restoreSnapshot(snapshot: TargetSnapshot): void`** (`src/acceptance/snapshot.ts`).
`snapshotTargets` returns `{root, entries}` with one entry per target in the array's
order: `path` is the target string as given; `bytes` is `fs.readFileSync(abs)` (a
`Buffer`, which is a `Uint8Array`; never decoded) when `fs.statSync(abs,
{throwIfNoEntry: false})?.isFile()` is true, else `null`. `restoreSnapshot` walks the
entries in order: bytes → `fs.mkdirSync(path.dirname(abs), {recursive: true})` then
`fs.writeFileSync(abs, bytes)`; `null` → `fs.rmSync(abs, {force: true})` (no error when
the file is already gone). The snapshot is never mutated, so restoring twice equals
restoring once. `node:fs`, `node:path` only.

**`runAcceptance(command: string, root: string, options: RunOptions):
Promise<AcceptanceResult>`**, **`clipLog(text: string): string`**, and the constants
**`DEFAULT_TIMEOUT_MS = 300000`**, **`LOG_CAP = 4000`** (`src/acceptance/run.ts`).

1. `spawn("/bin/sh", ["-c", "exec 2>&1\n" + command], { cwd: root, env: {
   ...options.env, NO_COLOR: "1", CI: "1" }, detached: true, stdio: ["ignore", "pipe",
   "pipe"] })` from `node:child_process`. The prefix line makes the shell send stderr into
   stdout, so the two are merged in write order; chunks of both pipes are appended to one
   `Buffer[]` in arrival order. The environment is exactly the given one with the two
   keys laid over it: `process.env` is never read (the guard rejects it in this layer).
2. `timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS`; a `setTimeout` of that length
   sets `timedOut = true` and calls `process.kill(-child.pid, "SIGKILL")` (the negative
   pid is the process group of the detached child) inside `try/catch` (a group already
   gone is no error).
3. The promise resolves on the child's `"close"` event (every pipe closed, so no
   grandchild holds the output): `clearTimeout`; `text = Buffer.concat(chunks)
   .toString("utf8")`; `log = clipLog(text)`; when `timedOut`, append
   `acceptance timed out after <timeoutMs> ms\n`, preceded by `\n` when `log` is
   non-empty and does not end in `\n`; `exit` is `null` when `timedOut`, else the exit
   code of `"close"` (itself `null` when a signal ended the shell). So example 3 gives
   exactly `{exit: null, log: "started\nacceptance timed out after 200 ms\n", timedOut:
   true}`.
4. An `"error"` event (the shell could not start, e.g. `root` missing) resolves
   `{exit: null, log: "acceptance could not start: <error.message>\n", timedOut: false}`.
   The promise never rejects.

`clipLog(text)`: `text.length <= 4000` → `text` unchanged. Otherwise `head =
text.slice(0, 1500)`, `tail = text.slice(text.length - 1500)`, `middle =
text.slice(1500, text.length - 1500)`; `kept` = the lines of `middle.split("\n")` that
match `/FAIL|Error|assert|expected/` (case-sensitive), in order, each cut to its first
200 chars, taken while the running sum of `(line.length + 1)` stays ≤ 800 (the first
line that would pass 800 stops the walk); result = `head + "\n[... " + middle.length +
" chars clipped; diagnosis lines kept:]\n" + kept.map((l) => l + "\n").join("") +
"[...]\n" + tail`. Always ≤ 4000 chars; `longLog.txt` → `longLogClipped.txt` (§2.1).

**`buildAttemptDiff(before: Record<string, string | null>, after: Record<string,
string>): string`** and **`DIFF_CAP = 6000`** (`src/acceptance/diff.ts`; no imports).

1. For each key `p` of `after`, in `Object.keys` order: `old = before[p] ?? null`
   (missing = absent). Lines of a text: `[]` for `null` or `""`; else `s.split("\n")`
   without the last element when `s` ends in `\n`. When the old and new line arrays are
   equal, `p` contributes nothing (so `"a"` vs `"a\n"`, or absent vs `""`, is no change).
2. Header: `--- a/<p>\n` (or `--- /dev/null\n` when `old` is `null`), then `+++ b/<p>\n`.
3. Edit script by LCS: `L[i][j]` = LCS length of `a[i..]`, `b[j..]`; walk `i = j = 0`:
   `a[i] === b[j]` → context ` ` + line, `i++, j++`; else if `L[i+1][j] >= L[i][j+1]` →
   `-` + `a[i]`, `i++`; else `+` + `b[j]`, `j++`; then the rest of `a` as `-`, of `b` as
   `+`. (So within a changed region deletions come before additions.)
4. Hunks: every changed op with up to 3 context ops before and after; two changes with 6
   or fewer context ops between them share a hunk. Header `@@ -<os>,<on> +<ns>,<nn> @@\n`
   with both counts always printed: `on`/`nn` = old/new lines in the hunk; `os` = the
   1-based old line number of the hunk's first old line, or, when `on` is 0, the number of
   old lines before the hunk (0 at the top); `ns` likewise, counted on the NEW side on
   its own: `ns` = the 1-based new line number of the hunk's first `+` or context op
   (whatever op opens the hunk; a leading `-` op does not move it), or, only when `nn`
   is 0, the number of new lines before the hunk. So `os` and `ns` are both 1 for any
   hunk that starts at the top of a non-empty file on both sides, even when its first op
   is a deletion: `"a\nb\n"` → `"b\n"` gives `@@ -1,2 +1,1 @@\n-a\n b\n`, never `+0,1`.
   Every op line ends in `\n`. No `\ No newline at end of file` marker.
5. The pieces are concatenated; nothing changed → `""`. Over 6000 chars: `m = "[diff
   clipped: " + total + " chars]\n"`, result `= text.slice(0, 6000 - m.length - 1) + "\n"
   + m`, exactly 6000 chars.

Illustrations, every one computed by a reference implementation of rules 1–5 before the
gate: example 1 → `--- a/src/a.ts\n+++ b/src/a.ts\n@@ -2,7 +2,7 @@\n line 2\n line 3\n
line 4\n-line 5\n+LINE 5\n line 6\n line 7\n line 8\n`; example 3 (lines 2 and 18 of 20
changed) → two hunks `@@ -1,5 +1,5 @@` (5 + 1 lines) and `@@ -15,6 +15,6 @@`; lines 2
and 9 of 20 changed (6 unchanged between) → ONE hunk, the whole text `--- a/t\n+++
b/t\n@@ -1,12 +1,12 @@\n line 1\n-line 2\n+LINE 2\n line 3\n line 4\n line 5\n line 6\n
line 7\n line 8\n-line 9\n+LINE 9\n line 10\n line 11\n line 12\n` (every changed line is
a `-` then a `+`: a test's expected text never shows a changed old line as context);
line 1 of 10 changed → `@@ -1,4 +1,4 @@\n-line 1\n+LINE 1\n line 2\n line 3\n line 4\n`;
`{"src/a.ts":
"old\n"}` vs `{"src/a.ts": "bad\n"}` → `--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,1 +1,1 @@\n
-old\n+bad\n`; example 4 → 6000 chars ending `+export const v231 = 231;\n\n[diff clipped:
10339 chars]\n`. A test of one's own uses inputs whose diff is unique (one changed region
per hunk, changed lines unlike their neighbours).

**`verifyCard(input: VerifyInput): Promise<VerifyOutcome>`** (`src/acceptance/verify.ts`).

1. `snap = snapshotTargets(root, targets)`; `before` = for each entry, `path` →
   `Buffer.from(bytes).toString("utf8")` or `null`.
2. For each `{variant, answer}` in order:
   - `"corrupt" in answer` → push `{variant, exit: null, log: "answer corrupt: " +
     answer.corrupt, diff: null}`; nothing is written; next.
   - `"truncated" in answer` → push `{variant, exit: null, log: "answer truncated", diff:
     null}`; next.
   - `files`: for each `[p, content]` of `Object.entries(answer.files)`: mkdir the parent
     (recursive), `fs.writeFileSync(path.join(root, p), content, "utf8")`; then `r = await
     runAcceptance(command, root, {env, timeoutMs})`.
   - `r.exit === 0` → push `{variant, exit: 0, log: r.log, diff: null}` and return
     `{accepted: {variant}, results}` at once: the files stay, later variants are not run.
   - else push `{variant, exit: r.exit, log: r.log, diff: buildAttemptDiff(before,
     answer.files)}` (computed before the rollback), then `restoreSnapshot(snap)`; next.
3. After the last variant (or for `variants: []`) → `{accepted: null, results}`; the tree
   equals the snapshot.

The keys of `files` are the targets by Parse Answer's contract; Verify Card does not
re-check them (§7). Imports: `./types.js` and `../compiler/types.js` (types only),
`./snapshot.js`, `./run.js`, `./diff.js`; `node:fs`, `node:path`.

### 2.3. Names

| module | exports | card writes no test | judge's test |
|---|---|---|---|
| `src/acceptance/types.ts` | the types of §2.2, no values | — | — |
| `src/acceptance/snapshot.ts` | `snapshotTargets`, `restoreSnapshot` | probe | `tests/acceptance/snapshot.examples.test.ts` |
| `src/acceptance/run.ts` | `runAcceptance`, `clipLog`, `DEFAULT_TIMEOUT_MS`, `LOG_CAP` | probe | `tests/acceptance/run.examples.test.ts` |
| `src/acceptance/diff.ts` | `buildAttemptDiff`, `DIFF_CAP` | probe | `tests/acceptance/diff.examples.test.ts` |
| `src/acceptance/verify.ts` | `verifyCard` | probe | `tests/acceptance/verify.examples.test.ts` |

A code card covered by a probe writes **no test file** (operator's rule after P2: the
smoke test was the only link that reddened correct code, `parse-answer.r1`). The judge's
file holds one `test(...)` per example of its Function, in record order, named
`<Function> example <n>: <what>`, then at most twelve tests of its own on §2.2. Results
are compared with `toBe` on fields (`r.exit`, `r.log`, `r.timedOut`, `results.length`,
`results[i].diff`), never `toEqual` on a fixture-sized string other than through `toBe`
against `fixture(...)`. Every test that spawns uses a `tmpRoot()` as root and env
`{PATH: "/usr/bin:/bin"}`. The no-orphan check of Run Acceptance example 3 is exactly:
`const pid = Number(r.read("sleep.pid").trim())`, then gone = `!fs.existsSync("/proc/" +
pid)` or the state letter after `") "` in `/proc/<pid>/stat` is `Z`; elapsed time is
`Date.now()` before and after the call, `< 2000`. No `setTimeout`, no `vi.useFakeTimers`
(the guard rejects both under `tests/`): the only timer is the product's own.

### 2.4. What must not break

- P0–P2 untouched byte for byte: the scaffold, `src/cards/*`, `src/compiler/*`,
  `tests/cards/*`, `tests/compiler/*`.
- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/` — untouched by
  every card.
- `tsc --noEmit`, `eslint src tests`, `vitest run` green on the whole tree after every
  generation; the 114 tests of P0–P2 stay green.

## 3. Acceptance

Built by `decks/tools/build.py p3` into the `acceptance` of every P3 card in
`morph-map.json`; `mrph plan --spec` copies it onto the card. Narrow to broad, every step
printing a readable line on failure; the first red is the regeneration's diagnosis.

Code cards (targets under `src/acceptance/` only; `snapshot-targets` also writes
`types.ts`):

1. `probe/<card>/`: the guard, a vitest config, `tsconfig.card.json` extending
   `../../tsconfig.json` and **excluding the targets of the other cards of the same
   generation**; removed on exit.
2. `node_modules/.bin/tsc --noEmit -p probe/<card>/tsconfig.card.json` (project + probe).
3. `node_modules/.bin/eslint <the card's targets>`.
4. `guard.mjs src <the card's targets>`: layer `acceptance` imports `cards`, `wait`,
   `compiler` only; `node:child_process` and `process` allowed here; `process.env`
   rejected in this layer; no `any`, no `console`, no `process.exit`, no package imports.
5. `decks/p3/parts/<card>.probe.ts` under vitest: one `test` per record example of the
   card's Function, values **and** types (`const r: AcceptanceResult = ...`), plus the
   constants of §2.2.
6. `vitest run` — everything in the tree.
7. Frozen: `git diff --quiet HEAD -- contour.yaml morph-map.json docs decks tests/fixtures`;
   untracked files other than the targets: none.

Judge cards (`tests/acceptance/<m>.examples.test.ts`):

1. `probe/<card>/` as above (no probe file); 2. the same `tsc`; 3. `eslint <target>`;
4. `guard.mjs tests <target> <min> <max> lits.json` — `min` = the examples of the
   Function (Snapshot Targets 3, Run Acceptance 4, Verify Card 3, Build Attempt Diff 4),
   `max` = `min + 12`; `lits.json`: snapshot `src/b.ts`, `src/deep/a.ts`, `ff00fe0a`;
   run `echo out; echo err >&2; exit 3`, `1 1 bar unset`, `sleep.pid`,
   `acceptance timed out after 200 ms`, `longLogClipped.txt`; verify `c.v3`,
   `answer corrupt: missing section for src/a.ts`, `answer truncated`, `@@ -1,1 +1,1 @@`;
   diff `@@ -2,7 +2,7 @@`, `--- /dev/null`, `@@ -15,6 +15,6 @@`,
   `[diff clipped: 10339 chars]`, `bigAfter.txt`;
5. `vitest run <target>`; 6. `vitest run`; 7. frozen and untracked as above.

Dense output: `--reporter=dot`, failures filtered to `^ FAIL |Error|expected|received`,
80 lines. Timeout of the whole chain 300 s (Morph's own limit; the old Morph's own
`run_acceptance` is the one this phase replaces); measured on a dry tree with stubs (§9).

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`. The
  Node typings carry no DOM globals.
- **Layer change** (`decks/tools/guard.mjs`, `LAYERS.acceptance` = `cards`, `wait`,
  `compiler`): Verify Card reads a Parsed Answer (the record's step `reads: Parsed
  Answer`), and the template forbids a second serialisation of a shape that exists in the
  tree; the import is `import type` only. Runloop already imports both layers.
- **`process.env` is rejected in `src/acceptance/`** by the guard (`NO_ENV`): the child's
  environment is a parameter, so a test controls it completely (Run Acceptance example 2:
  `HOME` of the parent never leaks). `process.kill` is the only use of `process`.
- `node:child_process` only in `run.ts`; `spawn` only (no `exec`, no `execSync`, no
  `shell: true`): the shell is the explicit `/bin/sh -c`. `setTimeout`/`clearTimeout` only
  in `run.ts`. No `Date`, no `Math.random`, no `console`, no git, no network.
- Requirement Deterministic Core names `acceptance`: `snapshot.ts`, `diff.ts` and
  `clipLog` are pure functions of their inputs (and the files under `root`); the timer in
  `run.ts` is the child's limit, not a clock read, and decides only `timedOut`.
- Every test writes only under a `tmpRoot()` and removes it; fixtures are read, never
  written; no `vi.mock`, no real timers.
- A judge writes only its test file and never touches the module it tests.
- A file a card writes is in no sibling's slice in the same generation; a judge depends
  on its code card.
- Exact strings of §2.2 (`exec 2>&1\n`, `acceptance timed out after <ms> ms`,
  `acceptance could not start: `, the clip marker, `answer corrupt: `, `answer truncated`,
  the diff headers and the clip line): the executor copies them, it does not rephrase.

## 7. Out of scope

- A syntax check of the written files by the language profile before the command; the
  python profile (P8 `language`).
- Writing the attempt into `/tmp/morph/<card>/` (that is the acceptance command's own
  first line, `decks/tools/build.py`); `.morph/` state, the run report (P5 `runloop`).
- The retry conversation that carries the log and the diff (P5 `runloop`); git commit of
  the accepted variant (P6 `git`).
- A key of `answer.files` outside `targets` (Parse Answer guarantees none); a target that
  is a directory; empty parent directories left after a rollback of a new file (git does
  not list them); symlinks; file modes.
- Killing on SIGTERM first, a grace period, Windows, a shell other than `/bin/sh`, a
  `stdin` for the command; a background job that outlives a green shell keeps the call
  open until it ends or the timeout kills the group (by design).
- Word-level or patience diffs, `\ No newline at end of file`, binary diffs (bytes are
  decoded as UTF-8 for the diff only); context other than 3.
- Concurrency between cards (one card's variants are sequential; parallel cards are the
  runloop's).

## 8. How to run

```
python3 decks/tools/build.py p3                       # injects acceptances into morph-map.json
cd /home/john/Documents/Work2026/MorphProject/morph-lab
venv/bin/mrph plan --root <repo> --spec contour.yaml --map morph-map.json --component acceptance --judge          # dry
venv/bin/mrph deck clear --root <repo> && venv/bin/mrph deck reset --root <repo>
venv/bin/mrph plan --root <repo> --spec contour.yaml --map morph-map.json --component acceptance --judge --add
venv/bin/mrph deck check --root <repo>
venv/bin/mrph run --root <repo> --processor glm53   # operator only
```

`mrph` reads `.env` from the current directory: run it from `morph-lab`, never from the repo.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards in the deck | 8 (4 code, 4 judge) |
| generations | 4 (snapshot-targets + build-attempt-diff; run-acceptance + their two judges; verify-card + run-acceptance-judge; verify-card-judge) |
| executor bill | ≤ $0.30 (nominal ≈ $0.13: P2 was $0.1087 for 8 cards; run-acceptance and verify-card are async and slightly larger) |
| cards with regeneration | 2 of 8 |
| `write-write` / `read-write` at `deck check` | 0 / 0 |
| tests after the run | 114 + 4 judge files; ≥ 14 judge example tests |
| chain on a dry tree with stubs | < 60 s per card (measured before the gate on one-line throwing stubs: 3.4–4.1 s code cards, red at the probe on every example, 14 of 14; 2.4 s judges, red at the guard; a broken sibling of generation 0 left `snapshot-targets` green at `tsc`) |
| first red | run-acceptance: the probe's example 3 (resolving on `"exit"` instead of `"close"`, or `child.kill` instead of the group) or example 4 (the clip marker); build-attempt-diff: the hunk start when a hunk begins at line 1 or has no old lines (`@@ -0,0`); verify-card: the diff of a failed variant computed after the rollback (empty) |

**Falsifiable claims:** (1) no card goes red on a sibling's file; (2) no judge red traces
to §2.1 (every example input is named by the type the Function takes, with its counted
result); (3) no acceptance of this phase leaves a `sleep` behind (`pgrep -f 'sleep 30'`
empty after the run).

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), judge tests
written, defects the judge found that the probe did not (and the reverse), the row of
`docs/MEASURE.md`.

## 11. Actual


Two runs on the VPS, processor glm53, both on decks that passed the gate (8 cards, 0 errors).

**Run 1** `20261006-135524-8c114477`, 13:55:24 → 14:15:44 (20.3 min), 11 requests, 154 845 in /
51 875 out, **$0.0879**. 1 written (build-attempt-diff.v2), 2 failed, 5 skipped behind them;
10 variants burned.

| card | outcome | first red |
|---|---|---|
| snapshot-targets | failed, 3 attempts | probe example 1: `src/b.ts with bytes null: expected 'missing entry' to be null` — a **probe defect** (orchestrator data): the probe's `entry?.bytes ?? 'missing entry'` turned a correct `null` into the marker |
| build-attempt-diff-judge | failed, 3 attempts | own test `lines 2 and 9 of 20 … share one hunk`: the judge's expected value dropped `-line 9` (judge defect); its other tests caught a **real code defect** the probe missed: a hunk opening with a deletion printed `+0,1` instead of `+1,1` |

**Re-cut** (AUTONOMY "Failure", one only; commit `358a1a3`, data only): snapshot probe checks
`null` explicitly; build-attempt-diff probe pins the top-of-file hunk start; TASK §2.2 rule 4
spells the new-side start for a hunk opening with a deletion. Card instructions unchanged. The
re-cut deck re-ran all 8 cards: build-attempt-diff because its accepted code carried the defect,
the rest because they failed or were skipped.

**Run 2** `20261006-141841-4f95dce8`, 14:18:41 → 14:40:41 (22.0 min), 14 requests, 182 373 in /
71 619 out, **$0.1375**. **8 of 8 written**, 0 failed, 0 skipped; 6 variants burned.

| card | gen | attempts | winning variant | commit |
|---|---|---|---|---|
| build-attempt-diff | 1 | 1 (v1 truncated at 12 000 tokens) | v2 | 44bdfc4 |
| snapshot-targets | 1 | 1 | v1 | e5d1302 |
| build-attempt-diff-judge | 2 | 1 | — | 17785cc |
| run-acceptance | 2 | 1 | v1 | f1c0dea |
| snapshot-targets-judge | 2 | 1 | — | 55935d7 |
| verify-card | 3 | 1 (v1 red at eslint) | v2 | feccd0b |
| run-acceptance-judge | 3 | 2 (own test on clipLog of 4001 chars, judge's expectation) | r1 | ec55a7e |
| verify-card-judge | 4 | 2 (eslint: `'ParsedAnswer' is defined but never used`) | r1 | 31ef422 |

Phase total: **$0.2254** executor (prediction ≤ $0.30), 42.3 min of runs, 25 requests, 16 burned
variants. tsc-first-red: 0 (the known first reds were probe, own test, eslint). neighbour-red: 0.

§9 check: cards 8 / generations 4 — as predicted. Regeneration 2 of 8 in run 2 (predicted 2).
Judge example tests: 46 (`diff` 13, `snapshot` 8, `run` 14, `verify` 11), ≥ 14 holds. Tests after
the run: 160 in 20 files, all green. First red: predicted for build-attempt-diff at the hunk start —
it was exactly there, but the probe did not pin it; the judge did. Falsifiable claims: (1) no card
red on a sibling's file — holds; (2) no judge red traced to §2.1 — holds (judge reds were its own
expected values and an unused import); (3) no `sleep 30` left by an acceptance — holds (the only
`sleep 30` on the host belongs to an unrelated `ethsc` loop).

Max slice + targets, measured on the finished tree: verify-card-judge 60 876 bytes (gate 200 KB).

Verification on `morph/20261006-141841-4f95dce8` by the session: `git status --short` empty;
`tsc --noEmit`, `eslint src tests` clean; `vitest run` 160/160 in 20 files; `npm run build` ok;
`buildAttemptDiff({a:"old\n"},{a:"bad\n"})` gives `@@ -1,1 +1,1 @@`. Read against §2.2: group kill
by `process.kill(-pid)`, resolve on `close`, env without `process.env`, diff before rollback,
first green variant returns at once — no defect found. Lessons: a probe written with `??` against
a nullable field lies; the judge, not the probe, caught the diff defect — the probe of a
formatting Function should pin every boundary row of §2.2.
