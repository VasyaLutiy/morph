# The old-Morph scheme (operator 10.10) — steps 1–2 of "The cycle of one phase"

On `main` this file is the scheme for other projects (`docs/OTHER_PROJECT.md`) and for the replays of
P20–P21c; MorphV2's own `docs/AUTONOMY.md` cycle is unchanged here (the local branch `old-scheme` switches it).
The phase's data and exit codes: `docs/ORCHESTRATOR_REFERENCE.md`.

This replaces steps 1 (Prepare) and 2 (Gate) of `docs/AUTONOMY.md` "The cycle of one phase" and
every item they list. Steps 3 (Run), 4 (Verify) and "Failure" stay as written, except where
this file says otherwise. It is the order of the old mrph orchestrator, which prepared phases
fast: recon by primer and scout, the deck from the record, acceptances checked on stubs, and a
gate nobody sits at.

## 1. Recon — before any code is read
1. `node dist/cli.js primer --root . --write`, then read `.morph/primer.md`. Its ownership table
   names the test files and the cards that write them (judges included); the scout does not see them.
2. `contour.yaml` by its outline, the phase's groups only. A new Component or group: the record
   edit comes before the spec.
3. The scout, the question in a file OUTSIDE the tree (3–6 lines: what changes, where the contract
   is — group, Function, commit —, what does not change, what is out of scope):
   `node dist/cli.js scout --root . --processor ds --issue /tmp/<…>/issue-scout.md`, with the
   processor env (see the brief's run.sh). It stops by itself at `--deadline` (1800 s).
4. The roles of test files (target or context) are yours, read off the primer's ownership table,
   not the scout's. Read code where the primer and the scout point.
Report two numbers apart: deck targets the scout named; roles you changed.

## 2. Spec, record, deck
The spec by `docs/TASK_TEMPLATE.md`; the record and the map entries; fixtures; the phase's
`checks.json` and probes; the cut with `node dist/cli.js plan … --judge --checks … --out
decks/<phase>/deck.json` (`--only` when the cut holds cards outside the phase); maxTokens ×3
for `ds` (`python3 decks/tools/scale_tokens.py <deck> 3`); `node dist/cli.js deck check` with 0
errors. Commit the data and the deck.

## 3. Stubs — the only dry check
Run every card's acceptance once in a scratch worktree with stubs in place of its targets (a
typed throwing stub per new code file, the current file for a patch target, a one-test file per
judge file). Each probe must go red **per example** with a readable line, not a traceback, and a
judge red at its guard. Where the tree has `decks/tools/stubcheck.mjs`, run it on each stub log.
A probe that imports what an earlier card writes cannot be checked this way: say so in the
report and go on.

**Not done in this scheme:** reference implementations, mutants, chain timing against 250 s,
byte-identity re-cuts with two binaries, fullvet over stub trees, MEASURE/§11/DECISIONS/State
at handoff bookkeeping during preparation.

## 4. Gate — auto-approve, no human
The run starts at once when: `plan` exit 0, `deck check` 0 errors, the stub check above done
(every red per example, or the exceptions named), a forecast ≤ $5 for the phase. Nobody is
asked; nothing is waited for.

## 5. After the run
Step 4 Verify of AUTONOMY (tsc, eslint, vitest, build on the run branch). A red card: one fix by
its class (data / budget / environment), re-cut with `--only`, one re-run. Still red: stop and
report it — no Fable debt.
