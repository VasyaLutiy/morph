# The old-Morph scheme — rules v1 (operator 10.10)

**Status.** Version 1, final. Built from the replays of P20, P21a and P21b under this scheme on 10.10
(`/tmp/oldscheme/`, measured against the original phases). Every rule below is a MUST. Where this
file is silent, `docs/ORCHESTRATOR_REFERENCE.md` (the data and the exit codes) and the
`morph-orchestrator` skill apply, in that order. Where they disagree with this file, this file wins.

**Scope.** Every phase prepared and run with the MorphV2 binary under this scheme: other
projects (`docs/OTHER_PROJECT.md` has the commands and the task header), and MorphV2 itself on the
local branch `old-scheme`. On `main`, MorphV2's own `docs/AUTONOMY.md` cycle is unchanged until the
operator switches it.

**Why this scheme.** The heavy gate (reference code, mutants, chain timing, byte identity) did not
catch what mattered: the original P21a passed it, and its live smoke still went red. The scheme
replaces it with recon by tools, stubs, an auto gate and a live smoke. The replays measured:

| phase | prep, min (old scheme / original) | orchestrator $ (old / original) |
|---|---|---|
| P20 | 15 / ~30 | 4.8 / 12.3 |
| P21a | 9.5 / ~87 | 3.0 / 29.6 |
| P21b | 26 / ~74 | 6.0 / 34 |

A paid retry on ds costs cents. Do not add a check whose only gain is fewer retries.

---

## 1. Roles and prohibitions

1. **The orchestrator writes data only.** The data is the record, the map, the spec
   `docs/TASK_<phase>.md`, fixtures, `decks/<phase>/checks.json`, the probes, `_stubs/`, the deck.
   Code (`src/`, test files) comes from cards only. A hand edit of code breaks the experiment.
2. **Never read Morph's source or build** (`MorphV2/src/`, `dist/`, `--help` runs): the
   data format and the exit codes are in `docs/ORCHESTRATOR_REFERENCE.md` (issue #17).
3. **Not in this scheme, never during preparation:**
   - reference implementations;
   - mutants;
   - chain timing against 250 s;
   - byte-identity re-cuts with two binaries;
   - fullvet over stub trees;
   - MEASURE / TASK §11 / DECISIONS / State-at-handoff bookkeeping.
4. **No merge, no push.** The run branch stays as the run left it. Merging is the operator's
   (or the regulation's own merge step, where one exists).
5. **Paid calls** (scout, run, smoke) only through the wrapper the task names. If the wrapper is
   denied, stop at once and report. Do not work around it, and do not prepare without the scout.

## 2. Recon — before any code is read

1. `morph primer --root . --write`, alone in its call; read `.morph/primer.md` whole. Skip it
   only on a founding phase (no code yet).
2. `contour.yaml` by its outline, the phase's groups only. A new Component or group: the record
   edit comes before the spec.
3. **The scout.** The question goes in a file OUTSIDE the tree, 3–6 lines:
   - what changes;
   - where the contract is (group, Function, commit);
   - what does not change;
   - what is out of scope.

   Run `morph scout --root . --issue <file> --processor <P>`. One question per scout: a task
   with several items gets its main item only (P20: a whole-issue question spent 30 of 30 calls
   with no answer).
4. **A scout with no answer, or with `reads 0`:** run it once more with a narrow
   `--seed-file seed.json` (`{"files": [3–5 modules], "notes": [...]}`, outside the tree). Still
   none: go on by address and say so in the report.
5. **Roles of test files are yours.** Decide target or context from the primer's ownership
   table, not from the scout.
6. **Read code by address only:** `grep -n` the symbol, then the lines around it. A file over
   ~600 lines is never read whole. Twenty reads is the ceiling.
7. **A spike is allowed when an expected value cannot be read off the code:** a crude mutation,
   or a real build or test run in a scratch worktree, deleted after. It never reaches the tree,
   a commit or a card. Use it to measure the expected values (§3.4), not to design the code.

## 3. Spec and data

1. **The spec follows the project's TASK_TEMPLATE.** §7 (out of scope) is an explicit list.
2. **Splitting a phase.**
   - Split only when the task or the handoff allows it, or when the deck would exceed 10 cards.
   - The split goes in §7 of the spec ("item N → next phase"), and it is the first line of the report.
   - Nobody confirms it at an auto gate, so it must be written where the operator reads first.
3. **Every Function has `behavior:`.** For a Python project, the map carries `"language": "python"`.
4. **Expected values in probes and examples are measured, never recalled.**
   - Take each value from the current code, from a fixture, or from a spike's real output (§2.7).
   - P20 replay: one value written from memory (`acceptance: null`) cost 6 attempts and a re-run.
5. **A judge's `lits` must appear verbatim in the text the judge is given.** Check each against
   the record example and the skeleton in the spec. A path built by concatenation is not a literal
   (P21b replay: 1 retry).
6. **Commit the data before cutting:** `plan`, `deck check` and `run` read the committed tree.

## 4. The deck

1. Cut:
   ```
   morph plan --root . --spec contour.yaml --map morph-map.json --component <C>… --judge
     --checks decks/<phase>/checks.json --out decks/<phase>/deck.json
   ```
   - `--checks` builds the acceptances, for TypeScript and Go only. A Python project uses the map's own acceptances.
   - Cards outside the phase: `--only <ids>`. With `--checks`, that makes a **transaction**: everything is rolled back on one red.
   - Use `--only` for a re-cut of code already on `main`, not for a first cut of new code.
2. For processor `ds`: every card's maxTokens ×3, `scale_tokens.py <deck> 3`, committed with the deck.
3. `morph deck check --root . --deck <deck>`. It must report **errors 0**. With `_stubs/` beside the
   deck it also compiles each card's stub tree. A break it names is a data defect: fix it before
   the run.
4. Commit the deck.

## 5. Stubs — the only dry check

1. **Each card's acceptance runs once** in a scratch worktree, with stubs in place of its targets:
   - a new code file: its typed exports, every body throwing `stub <name>`;
   - a patch target: the current file, plus only the declarations the probe needs to compile
     (a new optional key or type), with no behaviour;
   - a judge's test file: one passing test.
2. **Earlier generations' stubs stay in place** for later cards.
3. **The verdict:**
   - every probe example red, each with a readable line (not a crash at import);
   - a judge red at its guard;
   - `decks/tools/stubcheck.mjs` exit 0 on each log, where the tree has it.

   A row that is green on the current code by design (an "unchanged" row) is named in the report.
   A probe that imports what an earlier card writes cannot be checked this way: name it in the report.
4. **`node_modules` in a scratch worktree** is a real directory of per-entry symlinks, so the
   project's `.gitignore` covers it. Never edit `.git/info/exclude`: it is shared with the repo.

## 6. Gate — auto-approve, no human

The run starts at once, nobody asked and nothing waited for, when ALL hold:
1. `plan` exit 0;
2. `deck check` errors 0;
3. the stub check of §5 is done, every red per example, or each exception named;
4. the forecast is ≤ $5 for the phase.

Any of the four fails: fix the data and check again. A second failure: stop and report.

## 7. Run

```
morph run --root . --deck decks/<phase>/deck.json --processor <P> --deadline 2400 > <dir>/run-1.json 2> <dir>/run-1.err
```
- Start it in the background. Do not touch the tree while it runs, and do not poll in a tight loop.
- Run the binary from a COPY of `dist/`, so that a card cannot rebuild the binary in the middle of the run.

## 8. Verify and the live reproduction

1. On the run branch:
   - `git status --short` is empty;
   - typecheck, lint, the full test suite and the build are green (TypeScript: `tsc --noEmit`, `eslint src tests`, `vitest run`, `npm run build`).

   Read the diff once against the spec.
2. **Live reproduction.**
   - When the task names a smoke, a demo or a scenario on a real or fixture project, it runs
     right after the run, as part of Verify, with the binary or code the run produced.
   - A red smoke counts as a red card (§9).
   - When the task names none, the report says so.
   - The P21a replay passed its own run 4/4, and its smoke went red 0/8. A run without its smoke is not a result.

## 9. Failure: one fix, one re-run, then stop

1. **Classify each red card** by its attempts' reasons, verbatim:
   - **data**: the spec, a record example, a probe or a lit is wrong;
   - **budget**: an answer cut at maxTokens with the data right: ×1.5;
   - **environment**: the provider, the network or a timeout: a plain re-run;
   - **code defect**: re-cut the code card.
2. **One fix.** Commit it, re-cut the red cards and their dependants with
   `--checks … --only <ids>` into `decks/<phase>/deck-fix.json`, and run once more (`run-2`). The
   smoke runs again after it.
3. **Still red: stop.** Report the card, its class and the reasons verbatim. No second fix, no
   Fable debt, no next phase.

## 10. Report — numbers, ≤ 40 lines

1. **Times** (UTC), one line per event:
   start, primer, scout, spec+record, deck cut, stubs, gate, run end, verify end, smoke start and
   end, re-run start and end, end.
   Prep is start → gate.
2. **Scout:** $ and minutes; the deck targets it named, out of the total; the roles you changed. Two numbers, never one merged.
3. **Deck:** cards, generations, largest slice.
4. **Stubs:** reds per example, out of the total; the exceptions.
5. **Run:** cards written out of the total; attempts; $ from the run document; minutes; exit code.
6. **Verify:** the counts. **Smoke:** what ran, and the result.
7. **Red cards:** class and reasons, verbatim.
8. **The split**, if any, as the first line.
9. **What in this file was unclear.** It goes into v2 of this file, never into a workaround.
