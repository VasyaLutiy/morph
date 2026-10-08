# TASK_P14b — the reviewer's session: mutant runs, `morph review <base> <head>`, the cli routing (`src/reviewer/{runMutants,reviewCommand}.ts`, `src/cli/{types,parse,main}.ts`)

> Phase P14b of `docs/PLAN.md` ("Фазы по записи (после P2)": `P14 | reviewer | obligations, envelope, guardrails,
> findings | последняя`), the part TASK_P14 §7 left: everything that needs git, the file system or a child process.
> Components of `contour.yaml`: **review-session** (NEW: Run Mutants, Review Command — the reviewer's second Component, the
> 30 000-byte rule: reviewer is 20 898 bytes, the two Functions 12 552; same directory `src/reviewer/`, same guard layer,
> the P13b pattern of scout-session) and **cli** (Parse Command, Main: the routing; compacted first). PLAN's rule
> "`review` lives in Component reviewer; cli only routes" holds: Review Command is a Function of the reviewer layer, cli
> parses and routes. No issue is labelled `P14-reviewer` or `P14b-reviewer` (`gh issue list --label … --state open`: both
> empty, 08.10). The deck is cut by V2 (`morph plan --component review-session --component cli --judge --checks
> decks/p14b/checks.json`), filtered to this phase's 7 cards by `decks/p14b/filter.py`. The FINAL smoke stop (§8) follows
> the merge of this phase.

## 1. Why this

- **P14a built the checks, nothing runs them.** Find Obligations, Check Envelope, Check Guardrails, Plan Mutants and Render
  Findings (10 cards, 724 tests) are pure; `morph review` still answers `NotYetError` (`src/cli/parse.ts`,
  `NOT_YET_WORDS`), so AUTONOMY step 4 is still a read of every run branch by the session itself.
- **The mutation check of every preparation is done by hand today.** P13b: 121 mutants, P14a: 119, each run under a
  120 s subprocess timeout by a throwaway script (operator 07.10, after a mutant made a batch-wait loop infinite and hung
  the P11b mutation run 28 min). Run Mutants makes that check a function of the deck's own tests: a green baseline first,
  every run under its timeout, a timeout counted as killed, the file restored in `finally`.
- **The envelope is measured, not read.** On this repository the reference `morph review 784e2fa afc5d8e` (the P14a run
  range: 11 commits, 10 Morph commits, 29 changed files) reads in **0.8 s**: 5 Functions touched, 17 examples, 0 missing;
  envelope applies with 0 findings (19 `.morph/` files exempt); 1 guardrail finding (§11).

**Ripple, measured** (the 5 reference files in a scratch worktree from 55bec36, full suite): **2 of 724** red —
`tests/cli/parse.examples.test.ts` "Parse Command example 4" (`review` is no longer a not-yet word) and "example 8" (the
no-command message lists eight commands). Every other shape is new: tsc, eslint and the guard (with the P14b rules) clean.

**Record sizes** (bytes of each Component block, from its `- name:` line to the next block): cli 29 809 → **29 783**
(compaction first: the given and then of 7 examples — Main 3, 10, 11, Run Command 2, 8, 12, Plan Command 6, Deck Check 2 —
moved whole to `tests/fixtures/cli/examples.json`, each example now names them by key, the parsed values identical; then
the routing and Main 12, 13 by key); reviewer 20 871 → 20 898 (its description names review-session); review-session new
**12 552**; Requirement Deterministic Core gains the P14b sentence.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main** (module → what the new code calls or constructs): `src/acceptance/run.ts` —
  `runAcceptance(command, root, {env, timeoutMs}): Promise<{exit, log, timedOut}>` (`/bin/sh -c`, detached, the group
  killed on timeout, exit null then; never rejects; the child env drops every key starting `MORPH_PROCESSOR_` or ending
  `_KEY`/`_TOKEN`); `src/acceptance/snapshot.ts` — `snapshotTargets(root, paths): TargetSnapshot` (`{root, entries:
  [{path, bytes: Uint8Array | null}]}`, null = absent), `restoreSnapshot(snapshot)` (writes bytes with mkdir -p, or
  removes); `src/reviewer/planMutants.ts` — `Mutant {path, line, column, rule, text}`, `planMutants(path, text, limit)`;
  `src/reviewer/checkEnvelope.ts` — `readDiff(nameStatus, numstat)`, `checkEnvelope({changed, commits, ownership,
  scout})`, `MORPH_DIR`, types `RangeCommit`, `ScoutScope`; `src/reviewer/checkGuardrails.ts` — `testTitles(text,
  profileId)`, `checkGuardrails({base, head})`, type `TestText`; `src/reviewer/findObligations.ts` —
  `findObligations({record, map, changed, cards, titles})`; `src/reviewer/renderFindings.ts` — `renderFindings(input):
  Review`, types `MutantRow`, `ReviewCounts`; `src/git/run.ts` — `gitOk(root, args, env)` (throws `git <verb> failed
  (exit <n>): <first stderr line>`), `runGit(root, args, env): {code, stdout, stderr}`; `src/git/log.ts` —
  `readMorphLog(root, env): MorphCommit[]` (`{sha, card, model, run, paths}`, HEAD's history, newest first, Morph-Card
  commits only); `src/git/ownership.ts` — `readOwnership(commits)`; `src/contour/load.ts` — `loadContour(text, name)`,
  `loadMap(text, name)`; `src/contour/types.ts` — `ContourRecord`, `ContourMap`; `src/language/paths.ts` —
  `profileForPath(path)`, `isTest(profile, path)` (a test dir among the parents, or the profile's file pattern);
  `src/scout/planFromScout.ts` — `SCOUT_SESSIONS` (`".morph/scout"`).
- **Preconditions of the callees.** acceptance · runAcceptance resolves `exit: null, timedOut: true` and appends
  `acceptance timed out after <ms> ms` to the log on a timeout (RM 3: the mutant is killed, the baseline is a finding).
  acceptance · restoreSnapshot of an entry with `bytes: null` removes the file (RM 4: a mutant on an absent path leaves it
  absent). git · readMorphLog gives a card commit the `run` of the nearest NEWER commit with a Morph-Run trailer (RC 1:
  owner `add-tax (m/x, run r7)` because the archive commit is newer). git · `rev-parse --verify -q <ref>^{commit}` exits 1
  for an unknown ref and 128 outside a repository (RC 3: "not a commit" vs the rejection).
- **The text F of Run Mutants** (3 lines, final newline): `"export function f(a: number, b: number): boolean {\n  return a
  === b && a > 0;\n}\n"`; `planMutants(<path>, F, 10)` = three mutants on line 2: column 12 `=== → !==`, 18 `&& → ||`, 23
  `> → >=`.
- **Fixtures** (`tests/fixtures/`), each by the type the Function takes:

| file | type | what it is | what the Function returns on it |
|---|---|---|---|
| `reviewer/record.yaml`, `reviewer/map.json` | text of ONE record, ONE map (P14a's) | committed as `contour.yaml` and `morph-map.json` of the tiny repo | RC 1, 2: one obligation (Add Tax, 3 examples, missing [2]) |
| `reviewer/review.tiny.md` | text, ends with one "\n" | the exact markdown of RC 2 (2 637 bytes: 9 findings, 5 changed files, 2 mutants) | RC 2: `markdown` and `review.md` equal it |
| `cli/parseArgv.json`, `cli/parse.json` | ONE object each | key 4 first argv now `["report"]`; key 8 second result names eight commands; key 19 (11 argv) added | Parse Command 4, 8, 19 |
| `cli/examples.json` | ONE object | `"<Function> <n>"` → `{given, then}`: 7 more cli examples moved out of the record, Main 12 and 13 added | Main 12, 13 (the record's text) |

- **Harness skeletons** (only `tests/helpers.ts` and `node:fs`):

```ts
// Run Mutants: p = tmpRoot(); p.write("src/f.ts", F) (RM 3: "lib/g.ts"); env = {PATH: process.env.PATH ?? ""} + an example's keys;
//   await runMutants({root: p.root, command, mutants: planMutants(path, F, 10), timeoutMs, env}); p.read(path) is F after.
// Review Command (the tiny repo; t = tmpRepo(), which commits "init" first):
//   t.write("contour.yaml", fixture("reviewer/record.yaml")); t.write("morph-map.json", fixture("reviewer/map.json"));
//   t.write("README.md", "till\n"); t.write("tests/shop/old.test.ts", 'test("kept", () => {});\ntest("gone", () => {});\n');
//   git add . ; commit -m base ; tag b0
//   t.write("src/shop/addTax.ts", ADD_TAX); git add . ; commit -m "morph add-tax: src/shop/addTax.ts\n\nMorph-Card: add-tax\nMorph-Model: m/x"
//   t.write("tests/shop/addTax.examples.test.ts", 'test("Add Tax example 1: the tax", () => {});\ntest("Add Tax example 3: negative", () => {});\n');
//   git add . ; commit -m "morph add-tax-judge.r1: tests/shop/addTax.examples.test.ts\n\nMorph-Card: add-tax-judge.r1\nMorph-Model: m/x"
//   t.write(".morph/runs/r7/report.json", "{}\n"); git add -f . ; commit -m "morph run r7: deck and report\n\nMorph-Run: r7" ; tag h1
//   t.write("README.md", "till v2\n"); t.write("tests/shop/old.test.ts", 'test("kept", () => {});\ntest.skip("new", () => {});\n');
//   git add . ; commit -m hand                                                          (HEAD)
//   t.write(".morph/scout/20261009-101500-0badc0de/scout.json", JSON.stringify({schema: 1, status: "ok", answer: {targets:
//     ["src/shop/addTax.ts"], context_slice: ["README.md"], reasoning: "r"}, stopReason: "the model answered on its own"}, null, 2) + "\n")
//   ADD_TAX = "export function addTax(price: number): number {\n  return price > 0 ? price + price / 5 : price;\n}\n"
//     (Plan Mutants: line 2 column 16 "> → >=", column 29 "+ → -")
//   args = {base: "b0", head: "h1", spec: null, map: null, scout: null, mutants: null, mutantTimeoutSeconds: 120, test: null,
//     write: false, ...over}; deps = {env: {PATH: process.env.PATH ?? ""}}
```

**Distinct markers.** Refs `b0`, `h1`, `HEAD`, `nope`, `v9`, `side`, `v1`, `4f2a9c1`, `morph/20261009-101500`; cards
`add-tax`, `add-tax-judge.r1`; run `r7`; model `m/x`; scout ids `20261009-101500-0badc0de`, `20991231-000000-ffffffff`,
`zz`; mutants 5, 3, 2, 8, 12; timeouts 5000, 400, 300 ms and 30, 1, 120, 7 s; commands `grep -q "a === b" src/f.ts`,
`echo run >> ran.txt; exit 3`, `sleep 5`, `exit 9`, `grep -q "price > 0" src/shop/addTax.ts`, `npm test`; env keys
`MARK` (`m1`, `m2`), `OPENAI_API_KEY`, `MORPH_PROCESSOR_Q_TYPE`; paths `src/f.ts`, `lib/g.ts`, `gen/new.ts`, `m.ts`,
`lib/two.ts`, `lib/three.ts`. The code hard-codes none of them: the refs, the commands, the timeouts and the counts are
arguments; `DEFAULT_MUTANT_TIMEOUT_MS`, `BASELINE_SOURCE`, `REVIEW_DIR`, `EMPTY_MAP`, the messages and the document's keys
are the contract.

### 2.2. OUTPUT data shapes

**`src/reviewer/runMutants.ts`** (NEW, layer reviewer; imports `runAcceptance` from `../acceptance/run.js`,
`snapshotTargets` and `restoreSnapshot` from `../acceptance/snapshot.js`, the type `Mutant` from `./planMutants.js`; no
Node module, no clock, no environment) — exports, in this order:

```ts
export interface Finding { kind: string; source: string; path: string | null; expected: string; got: string }
export interface MutantsInput {
  root: string; command: string; mutants: readonly Mutant[]; timeoutMs: number; env: Record<string, string>;
}
export interface Baseline { exit: number | null; timedOut: boolean }
export interface MutantResult {
  path: string; line: number; column: number; rule: string; killed: boolean; exit: number | null; timedOut: boolean;
}
export interface MutantsResult { baseline: Baseline; results: MutantResult[]; findings: Finding[] }
export const DEFAULT_MUTANT_TIMEOUT_MS = 120000;
export const BASELINE_SOURCE = "mutation baseline";
export function baselineFinding(command: string, baseline: Baseline, timeoutMs: number): Finding;
export function survivorFinding(result: MutantResult): Finding;
export async function runMutants(input: MutantsInput): Promise<MutantsResult>;
```

| rule | value |
|---|---|
| every run | `runAcceptance(input.command, input.root, {env: input.env, timeoutMs: input.timeoutMs})` — no other spawn |
| baseline | runs first, on the tree as it is; `{exit, timedOut}` of that run; `exit !== 0` (null included) → `{baseline, results: [], findings: [baselineFinding(command, baseline, timeoutMs)]}` and no mutant runs |
| baselineFinding | `{kind "mutation", source BASELINE_SOURCE, path null, expected "the test command passes before any mutant: " + command, got: timedOut ? "timed out after <timeoutMs> ms" : "exit " + String(exit)}` |
| per mutant, in order | `snapshot = snapshotTargets(root, [m.path])`; then in `try`: `restoreSnapshot({root, entries: [{path: m.path, bytes: new TextEncoder().encode(m.text)}]})` and the run; in `finally`: `restoreSnapshot(snapshot)` |
| result | `{path, line, column, rule}` of the mutant, `killed: exit !== 0` (a timeout's null kills), `exit`, `timedOut` of its run |
| survivorFinding | `{kind "mutation", source "mutation <path>:<line>", path, expected "a test fails on <rule> at line <line>", got "every test passed"}`; findings = one per survivor, results order |

| Run Mutants example | given | result |
|---|---|---|
| 1 | src/f.ts = F; command `grep -q "a === b" src/f.ts`, timeoutMs 5000 | baseline {0, false}; results [12 `=== → !==` killed exit 1], [18 `&& → \|\|` exit 0], [23 `> → >=` exit 0] (line 2, timedOut false); 2 survivor findings; src/f.ts is F |
| 2 | the same; command `echo run >> ran.txt; exit 3` | baseline {3, false}; results []; findings [the baseline finding, got `exit 3`]; ran.txt `"run\n"`; src/f.ts is F |
| 3 | lib/g.ts = F; `if grep -q "a !== b" lib/g.ts; then sleep 5; fi`, timeoutMs 400; then `sleep 5`, timeoutMs 300 | the first mutant killed with exit null, timedOut true; two survivors `mutation lib/g.ts:2`; then baseline {null, true}, results [], got `timed out after 300 ms` |
| 4 | `test "$MARK" = m1 && test -z "$OPENAI_API_KEY"`, env + MARK m1, OPENAI_API_KEY k, mutants []; then MARK m2; then command `true`, mutant `{gen/new.ts, 1, 1, "true → false", "x\n"}` | {0, false}, [], []; then the finding got `exit 1`; then one survivor `mutation gen/new.ts:1` and gen/new.ts absent |

Rows (probe only): the two constants; baselineFinding with exit null untimed (`exit null`) and timed (`timed out after 7
ms`); survivorFinding alone; two mutants of one file each seen by the command in turn (`cat m.ts >> seen.txt`) and the file
equal to its text after; a `MORPH_PROCESSOR_` key absent from the command's env.

**`src/reviewer/reviewCommand.ts`** (NEW, layer reviewer, its one node:fs file: `node:fs`, `node:path`; imports the five
P14a modules, `./runMutants.js`, git's `run`, `log`, `ownership`, contour's `load` and `types`, language's `paths`,
`SCOUT_SESSIONS` from `../scout/planFromScout.js`; no clock, no `process`, no `console`) — exports, in this order:

```ts
export interface ReviewOptions {
  base: string; head: string; spec: string | null; map: string | null; scout: string | null;
  mutants: number | null; mutantTimeoutSeconds: number; test: string | null; write: boolean;
}
export interface ReviewDeps { env: Record<string, string> }
export interface ReviewDocument {
  range: string; verdict: "clean" | "findings"; base: string; head: string; counts: ReviewCounts;
  findings: (Finding & { id: string })[]; envelope: boolean; scout: string | null; commits: number;
  morphCommits: number; testFiles: number; test: string | null; baseline: Baseline | null;
  written: string | null; markdown: string;
}
export interface ReviewResult {
  code: 0 | 1 | 4; document: ReviewDocument | { error: { code: 4; kind: "UsageError"; message: string } };
}
export const REVIEW_DIR = ".morph/review";
export const EMPTY_MAP: ContourMap;   // {version: 1, package: null, language: null, docs: [], groups: [], cards: [], extraCards: []}
export function reviewId(baseSha: string, headSha: string): string;   // base's first 8 + "-" + head's first 8
export function spreadMutants(all: readonly Mutant[], limit: number): Mutant[];
export async function reviewCommand(root: string, args: ReviewOptions, deps: ReviewDeps): Promise<ReviewResult>;
```

**Review Command, in order** (git always `gitOk`/`runGit(root, args, deps.env)`):

1. `gitOk(root, ["rev-parse", "--git-dir"], env)` — outside a repository it throws and the promise rejects (main: exit 3).
2. The refusals, each `{code 4, document {error {code 4, kind "UsageError", message}}}`, in this order, before any diff:
   base, then head: `runGit(["rev-parse", "--verify", "-q", ref + "^{commit}"])` not exit 0 → `not a commit: <ref>`, else
   its trimmed stdout is the sha; `runGit(["merge-base", "--is-ancestor", headSha, "HEAD"])` not exit 0 → `head <head> is
   not in the history of HEAD`; spec given: `path.resolve(root, spec)` not a regular file → `spec file not found: <spec>`,
   `loadContour(text, spec)` not ok → its error; map given: `map file not found: <map>`, `loadMap(text, map)`'s error (no
   map → EMPTY_MAP); scout given: the names under `<root>/SCOUT_SESSIONS` holding a regular `scout.json`, code-unit order;
   `latest` = the last (none → `no scout session under .morph/scout`), else the name itself (absent → `scout session not
   found: <id>`); at = `.morph/scout/<id>/scout.json`: JSON.parse fails → `<at> does not parse`; schema not 1 → `<at>:
   schema <JSON.stringify of it, null when absent>, expected 1`; status not "ok" or answer not an object → `scout session
   <id> has no answer (<status>): <stopReason>`; scope = `{scoutId: id, targets: answer.targets, contextSlice:
   answer.context_slice}` (strings only); mutants given: `gitOk(["rev-parse", "HEAD"])` trimmed ≠ headSha → `--mutants
   needs the head to be the checkout HEAD (<HEAD's first 8>)`; the paths of `gitOk(["status", "--porcelain",
   "--untracked-files=all"])` lines (`line.slice(3)`, after `" -> "` when present) not starting with MORPH_DIR, sorted →
   `--mutants needs a clean tree: dirty outside .morph/: <", "-joined>` when any.
3. The data: `range` = the set of lines of `gitOk(["rev-list", baseSha + ".." + headSha])`; `log = readMorphLog(root,
   env)`; `commits` = the log's entries whose sha is in range, as `{card, model, run, paths}`, log order; `ownership =
   readOwnership(log)` (the whole log); `changed = readDiff(gitOk(["diff", "--name-status", "-z", "--no-renames", baseSha,
   headSha]), gitOk(["diff", "--numstat", "-z", "--no-renames", baseSha, headSha]))` — **both** calls with `--no-renames`
   (Check Envelope reads them in pairs); `envelope = checkEnvelope({changed, commits, ownership, scout})`. A test file is
   a path p with `profile = profileForPath(p)` not null and `isTest(profile, p)`. `headTests` = the test files of
   `gitOk(["ls-tree", "-r", "-z", "--name-only", headSha])` split on "\0"; `titles` = `testTitles(gitOk(["show", headSha +
   ":" + p]), profile.id)` of each, in order. `guardrails = checkGuardrails({base: the changed test files not "added",
   texts at baseSha; head: those not "deleted", texts at headSha})` (git show). With a record: `findObligations({record,
   map, changed: the changed paths, cards: the commits' cards, titles})`, else `{obligations: [], findings: []}`.
   With mutants n: `code` = the changed files not "deleted", not under MORPH_DIR, with a profile, not a test; `all` = each
   one's `planMutants(path, readFileSync(join(root, path), "utf8"), n)` joined in changed order; `planned =
   spreadMutants(all, n)`; `test` = `args.test ?? profileForPath(code[0]).fullRunLine` (null without a code file); when
   planned is not empty and test is not null: `runMutants({root, command: test, mutants: planned, timeoutMs:
   mutantTimeoutSeconds × 1000, env})`, mutant rows `{path, line, rule, killed}` of its results, its baseline, its
   findings; else rows `[]`, baseline null. Without mutants: rows null, test null, baseline null.
4. `review = renderFindings({base: args.base, head: args.head, changed: the envelope rows as {path, status, added,
   deleted, writers, scope}, obligations, guardrails: guardrails.rows, mutants: the rows, findings: [...obligation,
   ...envelope (envelope and scope), ...guardrail, ...mutation]})`; `written` = args.write ? REVIEW_DIR + "/" +
   reviewId(baseSha, headSha) : null; document in the ReviewDocument key order: range, verdict, base (sha), head (sha),
   counts, findings (numbered), envelope (applies), scout (scoutId or null), commits (range size), morphCommits,
   testFiles (headTests' count), test, baseline, written, markdown. With write: the directory created (recursive),
   `review.json` = `JSON.stringify(document, null, 2) + "\n"`, `review.md` = the markdown. → `{code: verdict "clean" ? 0
   : 1, document}`.

| rule | value |
|---|---|
| spreadMutants | `limit ≤ 0` → `[]`; `all.length ≤ limit` → a copy of all; else `all[Math.floor(i * all.length / limit)]` for i = 0 … limit − 1 (Plan Mutants' limit rule over the joined list) |
| reviewId | `baseSha.slice(0, 8) + "-" + headSha.slice(0, 8)` |
| range text | the refs as given (`b0..h1`), never the shas; the shas are `base` and `head` |

| Review Command example | given | result |
|---|---|---|
| 1 | b0, h1, spec contour.yaml, map morph-map.json | code 1; range `b0..h1`; counts {files 3, obligations 1, examples 3, missing 1, mutants null, killed null, findings 1, byKind obligation 1}; F1 obligation `record: shop · Add Tax · example 2`, path `tests/shop/addTax.examples.test.ts`; envelope true, scout null, commits 3, morphCommits 2, testFiles 2, test null, baseline null, written null; writers `[]`, `["add-tax"]`, `["add-tax-judge.r1"]` (`.morph/runs/r7/report.json` first in diff order); the markdown's obligation row `card add-tax-judge, card add-tax, file src/shop/addTax.ts, file tests/shop/addTax.examples.test.ts` |
| 2 | b0, HEAD, spec, map, scout latest, mutants 5, mutantTimeoutSeconds 30, test `grep -q "price > 0" src/shop/addTax.ts`, write | code 1; F1 obligation; F2, F3 envelope README.md, tests/shop/old.test.ts `changed outside every card's targets; no Morph card ever wrote it`; F4 scope README.md `changed, though the scout named it as context`, F5 tests/shop/addTax.examples.test.ts and F6 tests/shop/old.test.ts `changed, though the scout did not name it` (expected `a target of the scout session (src/shop/addTax.ts)`); F7 Tests Kept `the test "gone" kept`; F8 No New Skips `1 at head`; F9 `mutation src/shop/addTax.ts:2` `a test fails on + → - at line 2`; counts {5, 1, 3, 1, 2, 1, 9, byKind 1, 2, 3, 2, 1}; commits 4, morphCommits 2, testFiles 2, baseline {0, false}; written `.morph/review/<b8>-<h8>`; markdown = review.md = `review.tiny.md`; review.json = the document + "\n"; src/shop/addTax.ts restored |
| 3 | base nope; head v9; spec none.yaml; map none.json; scout zz; mutants 3 (head h1); an untracked notes.txt with head HEAD, mutants 3; head side (a branch off b0); a root outside git | 4 `not a commit: nope`; `not a commit: v9`; `spec file not found: none.yaml`; `map file not found: none.json`; `scout session not found: zz`; `--mutants needs the head to be the checkout HEAD (<HEAD8>)`; `--mutants needs a clean tree: dirty outside .morph/: notes.txt`; `head side is not in the history of HEAD`; rejects `git rev-parse failed (exit 128): …` |
| 4 | b0, h1, no spec; b0, HEAD, mutants 2, no test; h1, HEAD, mutants 3, test `exit 9` | 0, clean, markdown beginning `# Review b0..h1\n\nClean: no findings.\n`; 1, test `node_modules/.bin/vitest run --reporter=dot` (the tiny repo has no node_modules), baseline {127, false}, F5 `mutation baseline` got `exit 127`, `## Mutants (0 of 0 killed)`; 1, envelope false (no Morph commit), no code file changed: baseline null, counts.mutants 0, killed 0, test `exit 9`, 2 findings (the two guardrails) |
| 5 | reviewId("4f2a9c1e0b", "8a663b37ff"); spreadMutants of 8 mutants with 3, 0, 9; REVIEW_DIR; EMPTY_MAP | `4f2a9c1e-8a663b37`; lines 1, 3, 6; []; all 8; `.morph/review`; the empty map |

Rows (probe only): scout.json `{` → `does not parse`; schema 2; status no_answer → `has no answer (no_answer): why`; a named
older session kept; no session left → `no scout session under .morph/scout`; spec `System: {}` → its loadContour error;
mutants 3 over `lib/three.ts` (`a || b`, `p === q`) and `lib/two.ts` (`a && b`) with a deleted code file and a new test file
in the range, mutantTimeoutSeconds 1, the command sleeping 5 s on `a || b` in lib/two.ts → `## Mutants (1 of 3 killed)` with
the rows three:1, three:2 survived, two:1 killed.

**`src/cli/types.ts`, `src/cli/parse.ts`, `src/cli/main.ts`** (PATCH; one card owns the three, the P13b pattern: the
routing must land with the widened Command, or tsc breaks main.ts):

```ts
export interface ReviewArgs {
  name: "review"; root: string; pretty: boolean; base: string; head: string; spec: string | null; map: string | null;
  scout: string | null; mutants: number | null; mutantTimeoutSeconds: number; test: string | null; write: boolean;
}
export type Command =
  | DeckCheckArgs | RunArgs | PlanArgs | SubmitArgs | CollectArgs | PrimerArgs | ScoutArgs | FromScoutArgs | ReviewArgs;
```

**Parse Command** — additions only, every other check, message, default and key unchanged: `--scout`, `--mutants`,
`--mutant-timeout`, `--test` are value flags (`--spec`, `--map`, `--write` exist); `review` is a command word with arity 3
(the word and two refs) and no longer a not-yet word (`report` stays one: `command report is not available yet`); an extra
word is the existing `unexpected argument: <first extra>`; allowed flags — review: `--root, --pretty, --spec, --map,
--scout, --mutants, --mutant-timeout, --test, --write`; the no-command message `no command (commands: deck check, plan,
run, submit, collect, primer, scout, review)`. Right after the flag check, review: fewer than three words → `review needs
two refs: <base> <head>`; `--scout` not matching `^[A-Za-z0-9._-]+$` → `--scout must match ^[A-Za-z0-9._-]+$ (got
'<v>')`; `--mutants`, then `--mutant-timeout`, not a positive integer → `<flag> must be a positive integer (got '<v>')`;
else done `{name "review", root, pretty, base: words[1], head: words[2], spec, map, scout (null when not given), mutants
(Number or null), mutantTimeoutSeconds (Number or 120), test (null), write: --write given}`, keys in the interface's order.

| Parse Command example | argv (`parseArgv.json`) | result (`parse.json`) |
|---|---|---|
| 4 (changed) | `[report]`; `[deck, status]` | NotYetError `command report is not available yet`; `command deck status is not available yet` |
| 8 (changed) | `[--root]`; `[]` | `flag --root needs a value`; `no command (commands: deck check, plan, run, submit, collect, primer, scout, review)` |
| 19 | `[review, v1, HEAD]`; `[--pretty, review, 4f2a9c1, morph/20261009-101500, --root, /r, --spec, c.yaml, --map, m.json, --scout, latest, --mutants, 8, --mutant-timeout, 30, --test, npm test, --write]`; `[review]`; `[review, a]`; `[review, a, b, c]`; `[review, a, b, --mutants, 0]`; `[review, a, b, --mutant-timeout, x]`; `[review, a, b, --scout, a/b]`; `[review, a, b, --deck, d]`; `[run, --deck, d, --processor, s, --mutants, 3]`; `[plan, --spec, c.yaml, --test, x]` | `{review, ".", false, v1, HEAD, null, null, null, null, 120, null, false}`; `{review, /r, true, 4f2a9c1, morph/20261009-101500, c.yaml, m.json, latest, 8, 30, "npm test", true}`; `review needs two refs: <base> <head>` twice; `unexpected argument: c`; `--mutants must be a positive integer (got '0')`; `--mutant-timeout must be a positive integer (got 'x')`; `--scout must match ^[A-Za-z0-9._-]+$ (got 'a/b')`; `flag --deck does not apply to review`; `flag --mutants does not apply to run`; `flag --test does not apply to plan` |

**Main** — one branch before the run branch (which stays the last else): `command.name === "review"` → `result = await
reviewCommand(root, command, deps)` (CliDeps passes as ReviewDeps, ReviewArgs as ReviewOptions). The stderr line is
`morph review: exit <code>\n`; a parse failure stays `morph: <message>\n`.

| Main example | given (`examples.json`) | result |
|---|---|---|
| 12 | tmpRepo t: the reviewer fixtures as contour.yaml and morph-map.json at tag b0; src/shop/addTax.ts in a commit with `Morph-Card: add-tax`, `Morph-Model: m/x` at tag h1; deps {env {PATH}, now () => 0, cwd t, transport null}; `[review, b0, h1, --spec, contour.yaml, --map, morph-map.json]`; then `[review, b0, h1, --root, t, --pretty]` with cwd `/` | 1, one chunk: range `b0..h1`, verdict findings, counts.missing 3, counts.findings 3; stderr `["morph review: exit 1\n"]`; then 0, one chunk beginning `{\n  "range": "b0..h1",\n  "verdict": "clean",`; stderr `["morph review: exit 0\n"]` |
| 13 | the same deps; `[review, HEAD, --root, t]`; `[review, nope, HEAD, --root, t]`; `[review, HEAD, HEAD, --root, e]` (e an empty tmpRoot) | 4, stdout exactly `{"error":{"code":4,"kind":"UsageError","message":"review needs two refs: <base> <head>"}}\n`, stderr `["morph: review needs two refs: <base> <head>\n"]`; 4 `not a commit: nope`, stderr `["morph review: exit 4\n"]`; 3 RuntimeError beginning `git rev-parse failed (exit 128): `, stderr `["morph review: exit 3\n"]` |

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P14b reviewer"):

- **Two Components, one layer.** review-session holds Run Mutants and Review Command in `src/reviewer/` · reviewer 20 898
  + 12 552 > 30 000; the P13b precedent (scout-session beside scout).
- **The mutant runner is acceptance's** · Run Mutants spawns nothing itself: every run is `runAcceptance` (detached group,
  SIGKILL on the timeout, the secret keys stripped), the mutant is written and the file restored by `restoreSnapshot` (bytes
  from `TextEncoder`), so runMutants.ts imports no Node module; layer reviewer may import acceptance (guard). A red or hung
  baseline is ONE mutation finding (`mutation baseline`) and no mutant runs, so the command keeps exits 0/1; a timeout
  kills (operator 07.10).
- **Exit codes 0/1/3/4 only** · every refusal is 4 UsageError (refs, spec, map, scout, the mutants' preconditions), a git
  fault throws (3 by main), 0 clean, 1 findings; no DeckError/RefusalError (2): review spends nothing and changes nothing
  in the tree but `.morph/review/`.
- **Mutants need head = HEAD and a clean tree outside `.morph/`** · the working tree is what the test command runs on; the
  dirty list is Open Run Branch's rule. `--mutants n` caps the total, spread over the changed code files joined (Plan
  Mutants' rule); the test command defaults to the first code file's profile `fullRunLine`; `--mutant-timeout` in seconds,
  default 120.
- **The guardrails read the range's test files only** · Tests Kept and No New Skips can only fire on a changed test file,
  so base/head texts are read for the changed ones (2 git shows each, not 2 × 110); the titles for the obligations come from
  every test file at head (an example may be named by an unchanged file).
- **The review's location** · `--write` → `.morph/review/<base8>-<head8>/review.json` (the document) and `review.md` (the
  markdown), the P13b layout of `.morph/scout/<id>/`; deterministic (no clock), one directory per range; `.morph/*` is
  gitignored here, untracked elsewhere, outside every dirty check.
- **One document out** · stdout carries the whole Review (counts, numbered findings, markdown) plus the provenance: the
  two shas, envelope applies, the scout id, commits and Morph commits of the range, test files at head, the test command
  and the baseline.

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/reviewer/runMutants.ts` | NEW | probe only | NEW `tests/reviewer/runMutants.examples.test.ts` (RM 1–4) |
| `src/reviewer/reviewCommand.ts` | NEW | probe only | NEW `tests/reviewer/reviewCommand.examples.test.ts` (RC 1–5) |
| `src/cli/types.ts`, `parse.ts`, `main.ts` | PATCH | probe only | PATCH `tests/cli/parse.examples.test.ts` (PC 4 and 8 changed, 19 added); NEW `tests/cli/main.p14b.examples.test.ts` (Main 12, 13) |

- `runMutants.examples`: "Run Mutants example 1: …" … "4: …"; each builds its tmpRoot (removed in finally) by §2.1's
  skeleton; examples 1 and 2 compare the whole result with toStrictEqual and read the file back.
- `reviewCommand.examples`: "Review Command example 1: …" … "5: …"; the §2.1 tiny repo per test, removed in finally;
  example 1 compares the counts, the findings and the provenance keys; example 2 the nine findings whole, the markdown with
  `fixture("reviewer/review.tiny.md")` by toBe and the two written files; example 3 every refusal whole.
- `parse.examples` (patched): "Parse Command example 4: report and deck status answer NotYetError" replaces "…: review and
  deck status answer NotYetError" (argv `["report"]`); example 8's message gains `, review`; "Parse Command example 19: the
  word review, its refs and flags" added, its eleven results literals compared whole with toStrictEqual; every other test
  and line unchanged.
- `main.p14b.examples`: "Main example 12: …", "Main example 13: …", in process, an io that pushes stdout and stderr chunks.

### 2.4. What must not break

- Byte for byte: every file outside the 5 code targets and the 4 test files of §2.3 — the P14a reviewer files,
  `src/acceptance/*`, `src/git/*`, `src/contour/*`, `src/language/*`, `src/scout/*`, `src/cli.ts` and the other
  `src/cli/*`, `tests/helpers.ts`; `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/` — untouched by
  every card.
- 724 tests in 107 files: 722 green at every card (`tests/cli/parse.examples.test.ts` excluded deck-wide, its two examples
  red from parse-command until parse-command-judge); after the run **724 + 1 + RM 4 + RC 5 + Main 2 = 736** in 110 files.

## 3. Acceptance

Built by `morph plan --checks decks/p14b/checks.json`, narrow to broad, every stage printing `== <stage>`. `ownGit: true`
(the tests spawn git in their own tmpRepo; the stage proves this repository's HEAD and refs unchanged), `fullExclude`
`tests/cli/parse.examples.test.ts` (the ripple).

Code cards (no test file; code-only targets, `intent: generate` for the 2 new files): `probe/<card>/` → `tsc` (per-card
tsconfig excluding the generation's other targets) → `eslint <targets>` → `guard.mjs src <targets>` →
`decks/p14b/parts/<card>.probe.ts` (run-mutants RM 1–4 + 1 row = 5; review-command RC 1–5 + 1 = 6; parse-command PC 4/8,
19, Main 12/13 + 1 = 4; **15 tests**) → eslint's verdict → full `vitest run` → own git → frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs tests <file> <min> <max> lits<n>.json` (+ the names
kept for the patched file) → `vitest run <targets>` → eslint's verdict → full run → own git → frozen → untracked.

| file | new | min | max | lits |
|---|---|---|---|---|
| `tests/reviewer/runMutants.examples.test.ts` | yes | 4 | 10 | `Run Mutants example 1` … `4`, `mutation baseline`, `every test passed`, `timed out after 300 ms`, `a test fails on && → \|\| at line 2`, `gen/new.ts`, `OPENAI_API_KEY` |
| `tests/reviewer/reviewCommand.examples.test.ts` | yes | 5 | 11 | `Review Command example 1` … `5`, `reviewer/review.tiny.md`, `record: shop · Add Tax · example 2`, `Morph-Card: add-tax-judge.r1`, `Morph-Run: r7`, `20261009-101500-0badc0de`, `head side is not in the history of HEAD`, `--mutants needs a clean tree: dirty outside .morph/: notes.txt`, `4f2a9c1e-8a663b37` |
| `tests/cli/parse.examples.test.ts` | no (drop: the old example 4 name) | 25 | 27 | `Parse Command example 19`, `command report is not available yet`, `primer, scout, review)`, `review needs two refs: <base> <head>`, `flag --test does not apply to plan`, `--mutant-timeout must be a positive integer (got 'x')` |
| `tests/cli/main.p14b.examples.test.ts` | yes | 2 | 8 | `Main example 12`, `Main example 13`, `morph review: exit 1`, `review needs two refs: <base> <head>`, `git rev-parse failed (exit 128): ` |

min = the record's examples (parse: the file's 24 tests + 1); max = min + 6 (parse + 2).

**Output budget** (`max_tokens`, before the session's ×3 for `ds`; a ds answer ≥ 10 KB gets ≥ 16 000, a ~20 KB answer ≥
28 000, DECISIONS P12a and P14):

| card | returns | `max_tokens` |
|---|---|---|
| run-mutants | runMutants.ts ≈ 2.6 KB (reference) | 12 000 |
| review-command | reviewCommand.ts ≈ 10.9 KB | 24 000 |
| parse-command | types.ts + parse.ts + main.ts ≈ 20 KB, three whole files | 28 000 |
| run-mutants-judge | ≈ 6 KB new file (4 tmp roots, shell commands) | 16 000 |
| review-command-judge | ≈ 11 KB new file (the tiny repo, 9 findings whole, refusals) | 24 000 |
| parse-command-judge | the whole patched file ≈ 18 KB | 28 000 |
| main-judge | ≈ 4 KB new file | 16 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- **Layer reviewer** (guard, P14b): may import cards, contour, primer, scout, git, language, **acceptance**; of the Node
  modules only `node:fs` and `node:path` in `src/reviewer/reviewCommand.ts` (`NODE_FILES`), nothing in any other reviewer
  file; NO_CLOCK (no `Date` anywhere in the layer: the review id is the shas'); NO_ENV (the environment is `deps.env` /
  `input.env`); no `fetch`, no `process`, no `console`, no `node:child_process` (git spawns through gitOk/runGit,
  the tests through runAcceptance).
- runMutants.ts imports no Node module; reviewCommand.ts calls no runAcceptance itself (only runMutants).
- A file a card writes is in no sibling's slice in the same generation: generation 0 (run-mutants) reads no P14b file;
  generation 1 (review-command reads runMutants.ts; run-mutants-judge reads runMutants.ts, not reviewCommand.ts);
  generation 2 (parse-command reads reviewCommand.ts; review-command-judge reads reviewCommand.ts and runMutants.ts, no cli
  file); generation 3 (parse-command-judge, main-judge read the cli files, not each other's test).
- Tests write only under `tmpRoot()` / `tmpRepo()` and remove them in `finally`; no JS timer (a shell `sleep` under a
  runAcceptance timeout is the only wait, ≤ 5 s and cut at ≤ 1 s); no network; a mutant-running test uses a tiny tmp root
  and shell commands, never vitest; a judge writes only its targets.

## 7. Out of scope

- A model judging the diff (P14 §1), a record Guardrail with a `check` field (P14 §7), mutating test files, renames.
- Reviewing a run archive without git, a range whose head is not in HEAD's history (refused), mutants on a head that is
  not the checkout (refused: the operator checks it out first).
- skipCount reading string literals as code (P14a's text rule; §11 shows its one false positive on this repository) — a
  later phase if a project asks.
- `morph report` (the last not-yet word), `deck add|status|reset|clear`.

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component review-session --component cli \
  --judge --checks decks/p14b/checks.json --out decks/p14b/deck.json
python3 decks/p14b/filter.py decks/p14b/deck.json                # keeps the 7 cards of the phase
node dist/cli.js deck check --root . --deck decks/p14b/deck.json                                  # errors 0
python3 decks/tools/scale_tokens.py decks/p14b/deck.json 3       # the session, for processor ds
rm -rf /tmp/v2bin-p14b && mkdir -p /tmp/v2bin-p14b && cp -r dist /tmp/v2bin-p14b/ && ln -s $PWD/node_modules /tmp/v2bin-p14b/node_modules
node /tmp/v2bin-p14b/dist/cli.js run --root . --deck decks/p14b/deck.json --processor ds --deadline 2400
```

Cross-check (dry): from `morph-lab`, `venv/bin/mrph plan --spec <repo>/contour.yaml --map <repo>/morph-map.json
--component review-session --component cli --judge --root <repo>`.

**The FINAL smoke (after the merge of P14b; the operator's smoke stop 3)** — replaces TASK_P14 §8's recipe (the
commands and flags below are the merged ones). A tiny TypeScript repository T outside `~/MorphV2` (`/tmp/smoke-final/T`),
the binary copy `/tmp/v2bin-smoke` (`dist/` + `node_modules` symlinked), the ds environment by indirection (the
`decks/p10b2/smoke/run.sh` recipe with `ds` for `glm53`, never printed), ceiling **$0.20** in all.

1. **T, base.** `git init`; from `decks/p10b2/smoke/`: `contour.yaml` (Component calc: Clamp Value, Clamp Percent, 3
   examples each), `morph-map.json`, `package.json`; `node_modules` symlinked from the repo AND `node_modules` in
   `.git/info/exclude` (a symlink is not matched by `node_modules/`: the run's dirty check and review's clean-tree check
   would see it); tsconfig, vitest config, `tests/setup.ts`, `tests/helpers.ts` copied; `decks/tools/{guard,firstdiff}.mjs`;
   `decks/s14/checks.json` = the P10b2 checks plus the two judges (`files` with `Clamp Value example 1`…`3` / `Clamp
   Percent example 1`…`3` as lits, min 3, max 9) and the two probes in `decks/s14/parts/`; commit, `git tag b0` → **B0**.
2. **plan --checks.** `plan --root T --spec contour.yaml --map morph-map.json --component calc --judge --checks
   decks/s14/checks.json --out decks/s14/deck.json` exit 0, 4 cards in 2 generations; `deck check --root T --deck
   decks/s14/deck.json` errors 0; `scale_tokens.py … 3`; commit the deck, `git tag b1` → **B1**.
3. **run on ds.** `run --root T --deck decks/s14/deck.json --processor ds --deadline 1200`: exit 0, 4 / 4 written, the branch
   `morph/<runId>` checked out with 4 card commits (Morph-Card trailers) + the archive commit; ≤ $0.10.
4. **primer.** `primer --root T --write`: exit 0; `.morph/primer.md` holds "## File ownership" with the 4 cards' paths.
5. **scout.** a task file outside T: "Make Clamp Percent round half down; name the file that must change." → `scout --root T
   --processor ds --issue <task> --deadline 300`: exit 0, status ok, `answer.targets` ⊆ T's files holding
   `src/calc/clampPercent.ts`; ≤ $0.05 (TASK_P13b §8). Then `plan --from-scout latest --root T --out /tmp/smoke-scout-deck.json`
   exit 0 and `deck check` errors 0.
6. **review.** `review b1 HEAD --root T --spec contour.yaml --map morph-map.json --scout latest --mutants 8 --mutant-timeout
   120 --write` (the test command defaults to `node_modules/.bin/vitest run --reporter=dot`): exit 0 or 1 (never 3/4), no
   model call ($0); it must show: obligations 2 Functions, 6 examples, missing 0; `envelope` true and 0 envelope findings
   (every changed file a card's, `.morph/` exempt); guardrails Tests Kept 0 and No New Skips 0 findings; the changed-files
   table with the scout's scope (`src/calc/clampPercent.ts` a target and changed, so no "unchanged in the range"); `counts.mutants`
   ≤ 8, `baseline` {0, false}, every run under 120 s, each survivor a `mutation src/calc/<file>:<line>` finding;
   `.morph/review/<b1 8>-<HEAD 8>/review.md` equal to the document's markdown and `review.json` to the document; the
   counts equal the markdown's. Then the seeded check: a hand commit of `README.md` on top → `review b1 HEAD --root T`
   exit 1 with exactly one envelope finding on `README.md` ("…; no Morph card ever wrote it").

`mrph` reads `.env` from the current directory: run it from `morph-lab`, never from the repo.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 7 (3 code, 4 judges) / 4: [run-mutants] [review-command, run-mutants-judge] [parse-command, review-command-judge] [main-judge, parse-command-judge] |
| executor bill | ≈ $0.12–0.25 on ds ×3 (P13b: 9 cards, $0.23 at 66–92 KB in); ≤ $0.45 with a re-cut; cap $5 |
| cards with regeneration | 2–3 of 7 (review-command: the refusal order, rows null vs [] without a run, the findings' concatenation order; parse-command: three whole files, review's arity; review-command-judge: the tiny repo's commits and tags, the nine findings) |
| tests after the run | 736 ± 6 in 110 files |
| first red | review-command: the scout read written before the spec/map refusals, `--no-renames` on one call only, the range text from the shas; run-mutants: the file restored outside `finally`, a timeout counted as survived |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no answer cut at its `max_tokens`; (3) the V2 cut equals
the old mrph's dry cut in ids, dependsOn, generations, targets, slices and max_tokens; (4) after the run no file outside
§2.3's nine changed; (5) runMutants.ts imports no Node module and node:fs appears in the reviewer layer only in
reviewCommand.ts; (6) this repository's HEAD and refs unchanged by every card (own git).

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the MEASURE row with
its `прогоны` cell, the vitest log of every verify run (a flake is named); DECISIONS lines "P14b reviewer".

## 11. Actual

### Gate (preparation)

(filled at the gate)
