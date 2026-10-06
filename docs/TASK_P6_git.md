# TASK_P6 — the run's git side (`src/git/`)

> Phase P6 of `docs/PLAN.md` ("Фазы по записи (после P2)"), Component `git` of `contour.yaml`
> (five Functions: Run Git, Open Run Branch, Commit Paths, Commit Card, Archive Run; four Data
> Objects: Git Result, Branch Result, Commit Info, Archive Result). TypeScript under `src/git/`:
> one synchronous git spawner with an explicit environment, the run branch `morph/<runId>`, the
> per-card commit with Morph trailers (plugged into runloop's `CommitHook` by `makeCommitHook`),
> and the run archive `.morph/runs/<runId>/{deck.json, report.json}` with its commit. Every test
> runs in a `tmpRepo()` under the OS tmpdir; no network. Built by the old Morph (`mrph`) on glm;
> judge cards write the example tests.
>
> Reconciliation with P5: runloop fires `deps.commit(customId, targets)` (type `CommitHook` of
> `src/runloop/types.ts`) for each accepted card and returns the Run Report; it writes and commits
> nothing. P6 provides the function that becomes `deps.commit` and the archive write; the wiring
> (open branch → runDeck → archive) is P7 `cli`.

## 1. Why this

The old Morph paid for each rule below (`mrph/cards/repo.py`, `cards/store.py`):

- **Provenance lives in git, not in a state file.** After a run, `git log` answers which card,
  which model and which acceptance produced a line: the 10 old-Morph runs of this repo
  (`.morph/runs/*`, 20 archive files) and every card commit since P0 carry `Morph-*` trailers;
  P12 `primer` reads ownership from exactly these trailers.
- **Stage exactly the targets.** A run that commits `-A` sweeps the operator's unrelated edits
  into a card's commit; the old Morph stages `-- <paths>` and repeats the pathspec on commit, so a
  hand-staged file stays staged (Commit Paths example 1 pins it).
- **A byte-identical rewrite is not a commit.** An empty provenance commit for code nobody
  generated poisons ownership; `null` instead (Commit Paths example 2, Commit Card example 3).
- **A run starts only on a clean tree.** A dirty tree outside `.morph/` makes the per-card commit
  ambiguous; Open Run Branch refuses it (example 3).
- **Tests must not depend on the host.** This VPS has **no global git identity**; a test that
  inherits `process.env` commits fine on a laptop and fails here. The environment is a parameter
  of every git call, given whole (Run Git example 2 proves nothing of the parent leaks).

PLAN: 8 cards per phase at ≈ $0.1–0.2. This cut: 8 cards (4 code, 4 judge), 15 record examples
(Run Git 3, Open Run Branch 4, Commit Paths 2, Commit Card 3, Archive Run 3).

## 2. Contract

### 2.1. INPUT data shapes the code must build

Every example builds its inputs inline in a `tmpRepo()`; **no fixture files** (every literal is a
few bytes and lives in the record, Component git, the example of its Function).

- **A repo** — `tmpRepo()` of `tests/helpers.ts` (P0): a fresh `git init -b main` under the OS
  tmpdir with a local `user.name`/`user.email`, `commit.gpgsign false` and one empty commit
  `init`; `r.git(args)` runs git there and returns its stdout **trimmed** (so a message read with
  `r.git(["log", "-1", "--format=%B"])` has no final newline); `r.write(rel, text)`, `r.read`,
  `r.exists`, `r.path`, `r.rm()` as `TmpRoot`. A test's setup (commit a file, stage by hand, make
  a branch) goes through `r.git`/`r.write`.
- **The env** — `Record<string, string>`, built inline by every test, exactly:
  `{PATH: process.env.PATH ?? "", HOME: r.root, GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "Ada",
  GIT_AUTHOR_EMAIL: "ada@example.invalid", GIT_COMMITTER_NAME: "Ada", GIT_COMMITTER_EMAIL:
  "ada@example.invalid"}`. A test file may read `process.env` (the guard forbids it only in
  `src/`). With it, `git log -1 --format="%an <%ae> %cn"` of a commit made by the module reads
  `Ada <ada@example.invalid> Ada`.
- **A `Deck` and a `Card`** — `src/cards/types.ts` (P1), every Card field set:
  `{customId, intent: "generate", targets: ["out/<id>.ts"], contextSlice: [], instruction: "x",
  acceptance: "true", model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn: []}`;
  `Deck = {cards, externalDependsOn}`.
- **A `RunReport` and `CardOutcome`** — `src/runloop/types.ts` (P5), built as **typed consts**
  (`const rep: RunReport = {...}`) with every field set and passed as a variable. `archiveRun`
  takes `ArchivedReport = {outcomes: {status: string}[]}`; a `RunReport` variable is assignable to
  it, but an inline object literal with more keys is rejected by tsc (excess property check).
- **`CardCommit`** — the input of `commitCard` (§2.2), built inline:
  `{customId: "a", targets: ["src/a.ts", "src/b.ts"], model: "glm53", variant: null, acceptanceExit: 0}`.

What each Function returns on these inputs is counted in the record's examples; the ones with a
count: Commit Card example 1 → diffstat `{files: 2, insertions: 3, deletions: 0}` (1 + 2 new
lines); example 2 → `{files: 1, insertions: 2, deletions: 1}`; Archive Run example 1 → trailers
`Morph-Cards: 2`, `Morph-Written: 1`, `Morph-Failed: 1`, `Morph-Skipped: 0`, `Morph-Budget-Exceeded: 0`.

### 2.2. OUTPUT data shapes

`src/git/types.ts` exports exactly these names (types only, no values). It imports `Deck` from
`../cards/types.js` with `import type` and exports none of the imported names. It does **not**
import `src/runloop` (layer `git` may import `cards` only): `CommitInfo` and `CardCommitter` are
structurally runloop's `CommitInfo` and `CommitHook`, which the probe checks at type level.

```ts
import type { Deck } from "../cards/types.js";

export interface GitResult { code: number | null; stdout: string; stderr: string }
export interface Diffstat { files: number; insertions: number; deletions: number }
export interface CommitInfo { commit: string; diffstat: Diffstat }
export type BranchResult = { ok: true; branch: string; base: string } | { ok: false; error: string };
export type Trailer = [string, string];
export interface CardCommit { customId: string; targets: string[]; model: string; variant: string | null; acceptanceExit: number }
export type CardCommitter = (customId: string, targets: string[]) => CommitInfo | null;
export interface ArchivedReport { outcomes: { status: string }[] }
export interface ArchiveInput { runId: string; deck: Deck; report: ArchivedReport }
export type ArchiveResult = { ok: true; dir: string; commit: string | null } | { ok: false; error: string };
```

Every object is built with its keys in the type's order. Every `env` parameter is
`Record<string, string>`. All functions are **synchronous** (runloop's hook returns
`CommitInfo | null`, not a promise).

**`runGit(root: string, args: string[], env: Record<string, string>): GitResult`** and
**`gitOk(root, args, env): string`** (`src/git/run.ts`; the only file of `src/git` that imports
`node:child_process`).

1. `spawnSync("git", args, {cwd: root, env: {...env, LC_ALL: "C", GIT_TERMINAL_PROMPT: "0"},
   encoding: "utf8", maxBuffer: 67108864})`. Nothing of the parent process environment is read
   or spread.
2. `result.error` set (git not found, bad cwd) → `{code: null, stdout: "", stderr: "git could not
   start: " + error.message}`. Else `{code: result.status, stdout: result.stdout, stderr:
   result.stderr}` (`status` is `null` when killed by a signal). runGit never throws.
3. gitOk: `code === 0` → `stdout` untouched (not trimmed). Else `throw new Error("git " + args[0] +
   " failed (exit " + String(code) + "): " + firstLine)`, `firstLine` = the first line of
   `stderr.trim()` (`""` when empty). E.g. `git checkout failed (exit 1): error: pathspec 'nope'
   did not match any file(s) known to git`; a spawn failure reads `git status failed (exit null):
   git could not start: …`. Git's English messages are pinned by **prefix** only.

**`openRunBranch(root: string, runId: string, env): BranchResult`** (`src/git/branch.ts`).

1. `runId` not matching `/^[A-Za-z0-9._-]+$/` → `{ok: false, error: "invalid runId: " + runId}`,
   no git call (so it answers even outside a repo).
2. `gitOk(root, ["status", "--porcelain", "--untracked-files=all"], env)`; for each non-empty
   line: `p = line.slice(3)`; if `p` contains `" -> "` (a staged rename) `p` = the text after it;
   `p` not starting with `".morph/"` is dirty. Any dirty → `{ok: false, error: "dirty tree outside
   .morph/: " + dirty.sort().join(", ")}` (code-unit order: `README.md` before `src/a.ts`).
3. `base = gitOk(root, ["rev-parse", "HEAD"], env).trim()` (40 hex chars).
4. `runGit(root, ["rev-parse", "--verify", "--quiet", "refs/heads/morph/" + runId], env).code
   === 0` → `{ok: false, error: "branch morph/" + runId + " already exists"}`.
5. `gitOk(root, ["checkout", "-q", "-b", "morph/" + runId], env)`; return `{ok: true, branch:
   "morph/" + runId, base}`.

A refusal (steps 1, 2, 4) changes neither the checkout nor the refs. A git fault (not a repo:
`git status failed (exit 128): fatal: not a git repository…`) is the Error thrown by gitOk.

**`commitPaths(root: string, paths: string[], subject: string, trailers: Trailer[], env):
CommitInfo | null`**, **`commitCard(root: string, input: CardCommit, env): CommitInfo | null`**,
**`makeCommitHook(root: string, model: string, env): CardCommitter`** (`src/git/commit.ts`; imports
`gitOk` from `./run.js` and types from `./types.js`).

1. commitPaths: `gitOk(["add", "-A", "--", ...paths])` (`-A` stages a deleted target too);
   `gitOk(["diff", "--cached", "--name-only", "--", ...paths]).trim() === ""` → return `null`, no
   commit.
2. `gitOk(["commit", "-q", "-m", subject, "-m", block, "--", ...paths])`, `block` =
   `trailers.map(([k, v]) => k + ": " + v).join("\n")`. Git joins the two `-m` paragraphs with a
   blank line, so the message is `subject + "\n\n" + block`. The repeated pathspec commits only
   `paths`: a file staged by hand stays staged, an untracked file stays untracked. Hooks are not
   bypassed (no `--no-verify`).
3. `commit = gitOk(["rev-parse", "HEAD"]).trim()`; `gitOk(["show", "--numstat", "--format=",
   commit])` → the non-empty lines `"<ins>\t<del>\t<path>"`: `files` = their count, `insertions`
   and `deletions` the sums of columns 1 and 2, a `"-"` (binary file) counting 0. Return
   `{commit, diffstat: {files, insertions, deletions}}`.
4. commitCard: subject `"morph " + customId + ": " + targets.join(", ")`; trailers in this order:
   `["Morph-Card", customId]`, `["Morph-Model", model]`, `["Morph-Variant", variant]` **only when
   `variant !== null`**, `["Morph-Acceptance-Exit", String(acceptanceExit)]`; returns
   `commitPaths(root, input.targets, subject, trailers, env)`. Example message:
   `"morph a: src/a.ts, src/b.ts\n\nMorph-Card: a\nMorph-Model: glm53\nMorph-Acceptance-Exit: 0"`.
5. makeCommitHook: `(customId, targets) => commitCard(root, {customId, targets, model, variant:
   null, acceptanceExit: 0}, env)`. runloop fires the hook only for an accepted card (exit 0) and
   does not pass the winning variant, so the hook writes no `Morph-Variant`. The returned function
   is assignable to `CommitHook` of `src/runloop/types.ts`.

**`archiveRun(root: string, input: ArchiveInput, env): ArchiveResult`** (`src/git/archive.ts`;
imports `commitPaths` from `./commit.js`, `node:fs`, `node:path`).

1. `input.runId` not matching `/^[A-Za-z0-9._-]+$/` → `{ok: false, error: "invalid runId: " +
   runId}`, nothing written.
2. `dir = ".morph/runs/" + runId`; `fs.existsSync(path.join(root, dir))` → `{ok: false, error:
   "archive " + dir + " already exists"}`, nothing written (append-only: a run id names one run).
3. `mkdirSync(recursive)`; write `dir/deck.json` = `JSON.stringify(input.deck.cards, null, 2) +
   "\n"` (the Deck File form of P1: a JSON array of cards) and `dir/report.json` =
   `JSON.stringify(input.report, null, 2) + "\n"` (every key of the object passed, not only
   `outcomes`), UTF-8.
4. `commitPaths(root, [dir + "/deck.json", dir + "/report.json"], "morph run " + runId + ": deck
   and report", trailers, env)` with trailers in this order: `Morph-Run` runId, `Morph-Cards`
   `String(deck.cards.length)`, `Morph-Written`, `Morph-Failed`, `Morph-Skipped`,
   `Morph-Budget-Exceeded` — each the number of `report.outcomes` with status `written`, `failed`,
   `skipped`, `budget-exceeded`, as a decimal string (0 included).
5. → `{ok: true, dir, commit: info === null ? null : info.commit}`. The commit call is inside
   `try/catch`: a thrown Error (an ignored `.morph/` makes `git add` exit 1) → `{ok: false, error:
   "archive " + dir + " written but not committed: " + error.message}`; the files stay on disk,
   HEAD is unchanged.

### 2.3. Names

| module | exports | card writes no test | judge's test |
|---|---|---|---|
| `src/git/types.ts` | the types of §2.2, no values | — | — |
| `src/git/run.ts` | `runGit`, `gitOk` | probe | `tests/git/run.examples.test.ts` |
| `src/git/branch.ts` | `openRunBranch` | probe | `tests/git/branch.examples.test.ts` |
| `src/git/commit.ts` | `commitPaths`, `commitCard`, `makeCommitHook` | probe | `tests/git/commit.examples.test.ts` |
| `src/git/archive.ts` | `archiveRun` | probe | `tests/git/archive.examples.test.ts` |

A code card covered by a probe writes **no test file**. The `run-git` card writes `types.ts` and
`run.ts`. A judge imports the module it tests from `../../src/git/<m>.js`, types from
`../../src/git/types.js` (archive also `../../src/cards/types.js` and `../../src/runloop/types.js`),
and `tmpRepo`/`tmpRoot` from `../helpers.js`. Its file holds one `test(...)` per example of its
Function(s), in record order (commit: Commit Paths 1–2, then Commit Card 1–3), named
`<Function> example <n>: <what>`, then at most twelve tests of its own on §2.2.

Compare results whole with `toStrictEqual`; strings and numbers with `toBe`. **Nullable values**
(`GitResult.code`, the `CommitInfo | null` of commitPaths/commitCard/the hook, `ArchiveResult.commit`)
and the `ok` unions (`BranchResult`, `ArchiveResult`) are **never** reached with a direct property
or method access — `commitCard(...).diffstat` and `got.error.startsWith(...)` before narrowing are
rejected by `tsc` strict-null (TS18047/TS2339). Assert the whole value with `toStrictEqual`, compare
`=== null`, or narrow first: `const e = got.ok ? "ok" : got.error;`, `info === null ? "null" :
info.diffstat`. Never through `??`. A thrown message is caught with `try/catch` into a string or
asserted with `toThrowError(/^git checkout failed \(exit 1\): /)`.

Git's own text (`error: pathspec 'nope' did not match…`, `fatal: not a git repository…`) is
matched by prefix. A sha is matched as `/^[0-9a-f]{40}$/` or against `r.git(["rev-parse",
"HEAD"])`, never as a literal (dates differ per run).

### 2.4. What must not break

- P0–P5 untouched byte for byte: the scaffold, `src/cards/*`, `src/compiler/*`,
  `src/acceptance/*`, `src/processor/*`, `src/runloop/*` and their tests.
- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/` — untouched by every card.
- **This repository's own `.git`**: no test passes the working directory or any path outside a
  `tmpRepo()`/`tmpRoot()` to a git function; every acceptance compares HEAD and every ref before
  and after the tests.
- `tsc --noEmit`, `eslint src tests`, `vitest run` green on the whole tree after every
  generation; the 245 tests of P0–P5 stay green.

## 3. Acceptance

Built by `decks/tools/build.py p6` into the `acceptance` of every P6 card in `morph-map.json`;
`mrph plan --spec` copies it onto the card. Narrow to broad; the first red is the regeneration's
diagnosis.

Code cards (targets under `src/git/` only; `run-git` also writes `types.ts`):

1. `probe/<card>/`: the guard, a vitest config, `tsconfig.card.json` extending
   `../../tsconfig.json` and **excluding the targets of the other cards of the same generation**;
   removed on exit. The repository's HEAD, symbolic HEAD and every ref are recorded (`G0`).
2. `tsc --noEmit -p probe/<card>/tsconfig.card.json` (project + probe).
3. `eslint <the card's targets>`.
4. `guard.mjs src <targets>`: layer `git` imports `cards` only (types). `node:child_process`
   only in `src/git/run.ts`; no `process` at all in `src/git` (so no `process.env`: the env is a
   parameter); no `fetch`, no `console`, no `any`, no package imports; `node:fs`, `node:path` allowed.
5. `decks/p6/parts/<card>.probe.ts` under vitest: one `test` per record example of the card's
   Function(s), values **and** types, then the §2.2 rows (run-git: gitOk's stdout, the first line of a
   multi-line stderr, a spawn failure; open-branch: dirty paths sorted against git's order, a staged rename, a modified tracked file under `.morph/`, no git call for an
   invalid id, a non-repo thrown; commit-card: a binary file counts 0, a deleted target,
   `Morph-Acceptance-Exit` as given, the hook is a `CommitHook`; archive-run: all four statuses
   counted, an invalid id writes nothing, `RunReport` is an `ArchivedReport`). 7 + 8 + 7 + 5 = 27 tests.
6. `vitest run` — everything in the tree.
7. Own git: HEAD, symbolic HEAD and refs equal `G0`, else `tests changed this repository's HEAD or refs:`.
8. Frozen: `git diff --quiet HEAD -- contour.yaml morph-map.json docs decks tests/fixtures`; no
   untracked file other than the targets.

Judge cards (`tests/git/<m>.examples.test.ts`):

1–3. `probe/<card>/` (no probe file) and `G0`; the same `tsc`; `eslint <target>`.
4. `guard.mjs tests <target> <min> <max> lits.json` — `min` = the examples (Run Git 3, Open Run
   Branch 4, Commit Paths + Commit Card 5, Archive Run 3), `max` = `min + 12`; `lits.json`: run
   `C 0 bar unset`, `error: pathspec 'nope' did not match`, `git checkout failed (exit 1): `,
   `ada@example.invalid`; branch `morph/r1`, `.morph/deck.json`, `dirty tree outside .morph/:
   README.md, src/a.ts`, `branch morph/r4 already exists`, `invalid runId: a b`; commit
   `other.txt`, `morph a: src/a.ts, src/b.ts`, `Morph-Variant: c.v2`, `Morph-Model: stub`,
   `makeCommitHook`; archive `morph run r1: deck and report`, `Morph-Budget-Exceeded: 0`,
   `archive .morph/runs/r1 already exists`, `written but not committed: git add failed (exit 1): `.
5. `vitest run <target>`; 6. `vitest run`; 7. own git; 8. frozen and untracked as above.

Dense output: `--reporter=dot`, failures filtered to `^ FAIL |Error|expected|received`, 80
lines. Timeout of the whole chain 300 s; measured on a dry tree with stubs (§9).

**Output budget per card** (`max_tokens` in `morph-map.json`, P5 lesson: the generation judge
truncated three times at 13 500). Estimate = the target file(s) in tokens (≈ bytes / 3.5) × 2
headroom + 2 500 reasoning:

| card | expected target | estimate | `max_tokens` |
|---|---|---|---|
| run-git | types.ts ≈ 1.0 KB + run.ts ≈ 1.1 KB ≈ 600 tok | ≈ 3 700 | 12 000 |
| open-branch | branch.ts ≈ 1.2 KB ≈ 350 tok | ≈ 3 200 | 12 000 |
| commit-card | commit.ts ≈ 1.9 KB ≈ 550 tok | ≈ 3 600 | 12 000 |
| archive-run | archive.ts ≈ 1.7 KB ≈ 500 tok | ≈ 3 500 | 12 000 |
| run-git-judge | ≈ 5 KB (3 examples + ≤ 12 own) ≈ 1 500 tok; worst case 15 tests ≈ 12 KB | ≈ 9 400 | 24 000 |
| open-branch-judge | ≈ 6.5 KB ≈ 1 900 tok; worst case ≈ 14 KB | ≈ 10 500 | 24 000 |
| commit-card-judge | ≈ 8 KB (5 examples, the largest) ≈ 2 300 tok; worst case 17 tests ≈ 17 KB | ≈ 12 200 | 28 000 |
| archive-run-judge | ≈ 7 KB ≈ 2 000 tok; worst case ≈ 15 KB | ≈ 11 100 | 24 000 |

Code cards keep the P5 value 12 000 (≥ 3× the estimate); every judge ≥ 20 000 (the brief's floor)
and ≥ 2× the worst case (17 KB ≈ 4 900 tok × 2 + 2 500 = 12 300 < 24 000).

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- **Layer** `git` (`decks/tools/guard.mjs`): imports `cards` only. P6 changes the guard: `NO_ENV`
  gains `git`; `PROCESS` loses `git` (git needs no `process`); `node:child_process` in `src/git`
  is allowed only in `src/git/run.ts` (Run Git is the Component's one spawner).
- All functions synchronous (`spawnSync`); no `Date`, timer, `fetch` or `console` in `src/git`.
- `types.ts` imports types only; `branch.ts` and `commit.ts` import `./run.js`; `archive.ts`
  imports `./commit.js`, `node:fs`, `node:path`.
- Every test writes only under a `tmpRepo()`/`tmpRoot()` under the OS tmpdir and removes it in
  `finally`; no fixture is written; no test touches this repository's `.git`.
- A judge writes only its test file and never touches the module it tests.
- A file a card writes is in no sibling's slice in the same generation; a judge depends on its
  code card; `archive-run` depends on `commit-card` (it calls `commitPaths`).
- Exact strings of §2.2 (`invalid runId: `, `dirty tree outside .morph/: `, `branch morph/<id>
  already exists`, `git <sub> failed (exit <code>): `, `git could not start: `, the subjects
  `morph <id>: ` and `morph run <id>: deck and report`, the seven trailer keys, `archive <dir>
  already exists`, `archive <dir> written but not committed: `): the executor copies them.

## 7. Out of scope

- The wiring (P7 `cli`): when to open the branch, passing `makeCommitHook` as `deps.commit`, calling
  `archiveRun` after `runDeck`, exit codes for a refused branch, the deck-as-submitted commit the old
  Morph made before the run (`decks/<runId>.json`).
- The winning variant in the hook (runloop's `CommitHook` passes `(customId, targets)` only;
  widening it is P10 with the planner) and a `Morph-Acceptance` trailer with the command text.
- Reading trailers back, ownership, the archive listing (P12 `primer`).
- Merge, push, deleting branches, worktrees, signing, hooks management; the run-id format and its
  minting (P7).
- A git binary other than the one on `PATH`; Windows paths.

## 8. How to run

```
python3 decks/tools/build.py p6
cd /home/morph/MorphProject/morph-lab
venv/bin/mrph plan --root <repo> --spec <repo>/contour.yaml --map <repo>/morph-map.json --component git --judge   # dry
venv/bin/mrph deck clear --root <repo> && venv/bin/mrph deck reset --root <repo>
venv/bin/mrph plan --root <repo> --spec <repo>/contour.yaml --map <repo>/morph-map.json --component git --judge --add
venv/bin/mrph deck check --root <repo>
venv/bin/mrph run --root <repo> --processor glm53 --deadline 2400   # by the gate of docs/AUTONOMY.md
```

`mrph` reads `.env` from the current directory: run it from `morph-lab`, never from the repo.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards in the deck | 8 (4 code, 4 judge) |
| generations | 4 (run-git; open-branch + commit-card + run-git-judge; archive-run + open-branch-judge + commit-card-judge; archive-run-judge) |
| executor bill | ≈ $0.15 nominal (≈ 230k in, 70k out at $0.31/M in, $1.13/M out: 12 first requests × ≈ 14k in + ≈ 4 retries), ≤ $0.30 with a re-cut |
| cards with regeneration | 2 of 8 |
| `write-write` / `read-write` at `deck check` | 0 / 0 |
| tests after the run | 245 + 4 judge files; ≥ 15 judge example tests |
| chain on a dry tree with stubs | code cards red at the probe per example (readable `Error: stub <fn> …`), judges red at eslint (`No files matching the pattern "tests/git/<m>.examples.test.ts"`); with a reference implementation every probe green and single-rule mutations redden it |
| first red | run-git: the env laid over (LC_ALL/USER) or gitOk's message; open-branch: the rename/.morph rule or sorting; commit-card: the pathspec on commit (hand-staged file swept in) or the diffstat of a binary; archive: the count trailers or the catch |

**Falsifiable claims:** (1) no card goes red on a sibling's file; (2) no judge red traces to §2.1;
(3) no test changes this repository's HEAD or refs (`own git` never fires); (4) no judge is cut off
at its `max_tokens`.

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), judge tests written,
truncations (finish reason `length`) per card, defects the judge found the probe did not (and the
reverse), the row of `docs/MEASURE.md`.

## 11. Actual

Filled after the run.
