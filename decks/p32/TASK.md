# TASK_P32 — issue #43: one definition of a dirty tree (`src/git/branch.ts`)

Record: Component git, Function Open Run Branch (description, behavior, examples 2 and 3); Component cli, Function
Run Command example 4 (`tests/fixtures/cli/examples.json["Run Command 4"]`, the refusal text only). Cut with
`--only` (both Components hold other Functions): the deck is a transaction.

## 1. Why this

- Beta MorphStudio P7c-2 and P9a (11.10): `morph scout` left `.morph/scout/20261011-113938-082a9ea9/` untracked; the
  project's `.gitignore` does not cover `.morph/`. `morph run` started (Open Run Branch skips paths under `.morph/`),
  and every card went red at the acceptance's last stage, `files left in the tree: .morph/scout/<id>/scout.json`.
  2 runs lost; no retry can fix it.
- Two definitions of "dirty": Open Run Branch (`git status --porcelain --untracked-files=all` minus `.morph/`) and every
  acceptance's untracked step (`git ls-files --others --exclude-standard` minus the card's targets, no exemption).
  Where `.gitignore` covers `.morph/` (MorphV2, the templates) git lists nothing there, so the exemption never helps;
  where it does not, it only lets a run start red.
- Measured on main bc4527d (a crude mutation of `src/git/branch.ts`, full `vitest run`): 8 tests red, 989 green — 7 in
  `tests/git/branch.examples.test.ts` and `Run Command example 4` in `tests/cli/runCommand.examples.test.ts`. No other
  test and no other caller relies on the exemption. `runCommand` writes nothing under `.morph/` before Open Run
  Branch (step 5 of `src/cli/runCommand.ts`; the archive is written after the run).

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main**: `src/git/branch.ts` — `openRunBranch(root, runId, env): BranchResult`; `src/git/run.ts` —
  `runGit`, `gitOk`; `src/git/types.ts` — `BranchResult = {ok: true; branch; base} | {ok: false; error}`.
- **Tests**: a repo is `tmpRepo()` of `tests/helpers.ts` (`r.write`, `r.git` trims, `r.exists`, `r.rm()`); the env
  exactly as `decks/p6/TASK.md` §2.1 (`{PATH: process.env.PATH ?? "", HOME: r.root, GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Ada", GIT_AUTHOR_EMAIL: "ada@example.invalid", GIT_COMMITTER_NAME: "Ada", GIT_COMMITTER_EMAIL:
  "ada@example.invalid"}`). Ignoring `.morph/` in example 2: `r.write(".gitignore", ".morph/*\n")`, then
  `r.git(["add", ".gitignore"])` and `r.git(["commit", "-q", "-m", "ignore"])` (a committed `.gitignore`, so git
  status lists nothing).
- No fixture files for Open Run Branch: every literal lives in the record (Component git, Open Run Branch).

### 2.2. OUTPUT data shapes

**`openRunBranch`** (`src/git/branch.ts`, PATCH; steps 1, 3, 4, 5 of `decks/p6/TASK.md` §2.2 unchanged). Step 2:
`gitOk(root, ["status", "--porcelain", "--untracked-files=all"], env)`; for each non-empty line `p = line.slice(3)`;
for a staged rename (`p` contains `" -> "`) `p` = the text after it; **every** such `p` is dirty, `.morph/` paths
included. Any dirty →

```
{ok: false, error: "dirty tree: " + dirty.sort().join(", ") + " (commit, remove or ignore them: every acceptance fails on a file left in the tree)"}
```

e.g. `dirty tree: README.md, src/a.ts (commit, remove or ignore them: every acceptance fails on a file left in the
tree)`. Ignored files are never listed by git status, so a `.gitignore` covering `.morph/` keeps them out.

| example | given | result |
|---|---|---|
| Open Run Branch 2 | untracked `.morph/deck.json`, `.morph/runs/x/report.json`; runId r2; no `.gitignore` | `{ok: false, error: "dirty tree: .morph/deck.json, .morph/runs/x/report.json (commit, remove or ignore them: every acceptance fails on a file left in the tree)"}`, still main, no `morph/r2` |
| — then | `.gitignore` `.morph/*\n` committed; the same two files untracked | `{ok: true, branch: "morph/r2", base: <HEAD after the .gitignore commit>}` |
| Open Run Branch 3 | modified `README.md`, untracked `src/a.ts`; r3 | `{ok: false, error: "dirty tree: README.md, src/a.ts (commit, remove or ignore them: every acceptance fails on a file left in the tree)"}` |
| Run Command 4 | untracked `notes.txt` | code 2, RefusalError `dirty tree: notes.txt (commit, remove or ignore them: every acceptance fails on a file left in the tree)` |

The own tests of `tests/git/branch.examples.test.ts` that pin the exemption change meaning: "a staged rename into
.morph/ is not dirty" and "a modified tracked file under .morph/ is not dirty" are dropped; in their place "a staged
rename into .morph/ is dirty" (the same setup: untracked `.morph/.keep`, `git mv src/x.ts .morph/x.ts`; runId r6;
error `dirty tree: .morph/.keep, .morph/x.ts (…)`) and "a modified tracked file under .morph/ is dirty" (the same
setup: `.morph/deck.json` committed then modified; runId r7; error `dirty tree: .morph/deck.json (…)`), each also
checking the checkout is still main; `(…)` is the full remedy text above. The
other own tests keep their names; their expected texts take the new format.

### 2.3. Names

| module | change | judge's file |
|---|---|---|
| `src/git/branch.ts` | PATCH (step 2) | `tests/git/branch.examples.test.ts` PATCH (examples 2, 3, own tests) |
| — | — | `tests/cli/runCommand.examples.test.ts` PATCH (example 4's message literal only) |

### 2.4. What must not break

Byte for byte: every file but the three targets. The acceptance builder's text, `deck check`, `gate`: every committed
deck re-cut stays byte-identical. After the run the full suite green (997 tests at main).

## 3. Acceptance

Built by `morph plan --checks decks/p32/checks.json` (`ownGit: true`, frozen defaults + `templates`).

## 4. Constraints

The project's (NodeNext, `.js` imports, `import type`, no `any`); `src/git` imports only `./run.js` and
`./types.js` here; tests write only under `tmpRepo()`.

## 7. Out of scope

- The reviewer's `--mutants` clean-tree rule (`dirty outside .morph/` in `src/reviewer/reviewCommand.ts`): it runs no
  acceptance.
- The acceptance builder's untracked step, deck check, gate: unchanged.
- `docs/PLAN.md` line 689 and the DECISIONS P6 line are history; a P32 DECISIONS line is the operator session's.
