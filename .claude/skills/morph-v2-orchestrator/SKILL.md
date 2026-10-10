---
name: morph-v2-orchestrator
description: The MorphV2 orchestrator — one phase in one fresh session, from goal to verified run branch. Step 0 environment, recon with primer, Contour and scout, a spec and the phase data (checks.json, probes, _stubs), a deck cut by `morph plan`, stubs as the only dry check, an auto gate, the run, verify with the live smoke, salvage from the archive, a report in numbers. Use when asked to "prepare a phase", "cut a deck", "run a phase on MorphV2", "put Morph on" a task of any project that runs on the MorphV2 binary (MorphV2 itself included). The old mrph cycle is the skill `morph-orchestrator`.
---

# MorphV2 orchestrator: one phase, from goal to verified branch

You are the orchestrator of ONE phase. You write data; cards write code; the acceptance you
build judges them. Every rule below is a MUST and was paid for: the receipts are in
`references/lessons.md` — read it when a rule looks arbitrary, not before.

**Names used below.**
- `<morph>` — the MorphV2 binary the header names; by default the wrapper `~/bin/morphv2`
  (it maps the processor keys and runs a COPY of `dist/`, see `$MORPHV2/docs/OTHER_PROJECT.md` §1).
- `$MORPHV2` — the MorphV2 checkout: `/home/john/Documents/Work2026/MorphV2` on the laptop,
  `/home/morph/MorphV2` on the VPS.
- **The reference** — `$MORPHV2/docs/ORCHESTRATOR_REFERENCE.md`: the phase files, the
  `checks.json` schema with an example, probes, `_stubs/`, the transaction, every command with
  its exit codes. Read it whole once per session; it replaces reading MorphV2's `src/` or `dist/`.
- `/tmp/<p>/` — your scratch dir for the phase (issue text, logs, run documents, times).

**The header** of the task gives only the goal, the constraints and the processor. The order of
work is this file. A header that says "recon done" or "skip X" does not skip a step: do the step,
or record the departure (§1.3).

---

## 1. Roles and prohibitions

1. **Data only.** The data is: the record (`contour.yaml`), the map, the spec `docs/TASK_<p>.md`,
   fixtures, `decks/<p>/checks.json`, the probes, `_stubs/`, the deck. Code (`src/`, test files)
   comes from cards only. A hand edit of code breaks the experiment.
2. **Never read MorphV2's `src/` or `dist/`, never run `--help`.** The metric of this skill is
   0 such reads. A read you needed is a finding for the reference: name it in the report.
   **Exception — MorphV2's own phase:** there `src/` is the product, so reading it by address
   (§3.6) is recon; `dist/` and `--help` stay forbidden.
3. **A departure from the header or from this file is recorded** in the report, with its reason:
   which rule, what you did instead. Raising `--deadline`, skipping a step, a second fix — each is
   a departure, never "my one fix" in disguise.
4. **`deck.json` is never edited by hand**, except `scale_tokens.py` (maxTokens ×3 for `ds`)
   until the project config (#18) replaces it. Any other hand edit (effort, model, a field) is
   an experiment: its own branch, named so in the commit, no fix and no re-run counted on it.
5. **Not in this scheme, never during preparation:** reference implementations, mutants, chain
   timing against 250 s, byte-identity re-cuts with two binaries, fullvet over stub trees,
   MEASURE / TASK §11 / DECISIONS / State-at-handoff bookkeeping. `morph gate` is optional.
6. **Paid calls** (scout, run, smoke) only through the wrapper the header names. Wrapper denied:
   stop at once and report; no workaround, and no preparation without the scout.
7. **Keys are never printed**: no `env`, no `cat .env`, no echo of a `*_API_KEY`.

## 2. Step 0 — the environment, before recon

1. **The binary is a copy outside the repo** (`/tmp/morphbin/`, built at a known MorphV2 commit).
   Write that commit into `/tmp/<p>/times.txt` and the report. A rebuild during the run must not
   replace the running binary.
2. **The toolchain matches the project**, checked before any stub run:
   - Go: `go version` against the `go` line of `go.mod`. Acceptances run with `GOTOOLCHAIN=local`,
     so the `go` first on `PATH` is the one used (laptop: `/usr/bin/go` is 1.22; a project on
     1.25 needs its toolchain first on `PATH`, else every card goes red at build).
   - TypeScript: `node --version` against `engines` / `.nvmrc`; `node_modules` present (`npm ci`).
   - Python: `python3 --version` against the project's floor; the venv the acceptances name.
3. **The tree is clean** (`git status --short` empty) and on the branch you will cut from.
4. **Start the times file**: one UTC line per event (§12.2).

## 3. Recon — primer, Contour, scout; before the run, never during it

1. **Primer first, alone in its call:** `<morph> primer --root . --write`, then read
   `.morph/primer.md` WHOLE from disk (the stdout JSON is a preview and loses the ownership
   table). Skip only on a founding phase (no code yet). Primer writes `.morph/`: run it before
   the run, never while a run owns the tree (in a live tree it dirties the run's checkout).
2. **Contour by outline**, the phase's groups only:
   `grep -n -E '^  [A-Za-z]+:|^    - name:' contour.yaml`, then only the groups the task
   touches. A new Component or group: the record edit comes before the spec.
3. **The scout.** One question, in a file OUTSIDE the tree, 3–6 lines: what changes; where the
   contract is (group, Function, commit); what does not change; what is out of scope; last line
   "Name every test and caller that relies on the old behaviour <X>." A task of several items
   asks about its main item only.
   `<morph> scout --root . --issue /tmp/<p>/issue.md --processor <P>`.
   Read `spent` before `answer`.
4. **Scout with no answer, or `reads 0`:** once more with a narrow `--seed-file`
   (`{"files": [3–5 modules], "notes": [...]}`, outside the tree). Still none: go on by address and
   say so. An answer the scout REJECTED (it named a new or a missing file) still points: use its
   targets as a lead and count them apart in the report.
5. **Check the scout, do not trust it** — by grep or spike, not by reading:
   - tests that pin the old behaviour are targets; grep the helper names that build answers, not
     only the literal;
   - **roles of test files are yours**, from the primer's ownership table: a test written by a
     card this deck re-cuts is a target, its `-judge` test included;
   - every Function whose behaviour changes has its module among the targets; every module whose
     shapes a card must construct is in that card's slice.
6. **Read by address only:** `grep -n` the symbol, then the lines around it. A file over ~600
   lines is never read whole. Twenty reads is the ceiling.
7. **A spike** when an expected value cannot be read off the code: a crude mutation, or a real
   build/test run, in a scratch worktree deleted after. It never reaches the tree, a commit or a
   card. It measures values (§4.4); it does not design code.
8. **Semantic gap.** For each change: what does it make silent, lose or reorder? A gap goes into
   the spec — §7 out of scope, or a record change — never quietly into a card.

## 4. Spec and data

1. **The spec follows the project's `TASK_TEMPLATE`.** §7 (out of scope) is an explicit list. No
   cards in the spec. Every input shape a card must CONSTRUCT is named with its address.
2. **Splitting a phase:** only when the header allows it or the deck would exceed 10 cards. The
   split goes into §7 ("item N → next phase") and is the FIRST line of the report.
3. **The record.** Every Function has `behavior:`; a Python project's map carries
   `"language": "python"`. **A Component ≤ 30 KB of record** (raw bytes of its group in
   `contour.yaml`): a phase that would take one over first compacts it as its own data commit —
   literals to fixtures by `ref`, behaviours reworded with every rule kept, no example's meaning
   changed — or puts the new Functions into a new Component. Examples carry full values, never
   abbreviated.
4. **Expected values are measured, never recalled** — from the current code, a fixture, or a
   spike's real output.
5. **The phase data of V2** (schema and example: the reference §2–§4):
   - `decks/<p>/checks.json`: one entry per card; a judge lists its files with `min`/`max`,
     `lits`, `new`, `drop`. **For an `--only` cut it is required**: without `--checks` there is no
     transaction.
   - `decks/<p>/parts/<id>.probe.ts` (Go: `_<id>_probe_test.go`): one per code card, the record's
     examples as tests named after them ("<Function> example N: …").
   - `decks/<p>/_stubs/`: a stub per target. **For an `--only` cut it is required**: without it
     `deck check` builds no generation.
6. **A re-cut card's probe starts from its previous phase's probe**; only the changed and the new
   examples change. On stubs it must go red exactly on those, and green on the unchanged rows.
7. **Judges: say what they must contain.** A judge's `lits` appear verbatim in the text the judge
   is given — check each against the record example and the spec's skeleton (a path built by
   concatenation is not a literal). In the map instruction of a judge, list its guard literals and
   the TYPES of the example values (Go `int` vs `float64`, a pointer vs a value); name the imports
   it needs (`context`). Most reds of past runs were judges, not code.
8. **The Contour never goes into a slice whole**; a card that needs text outside its Function
   gets an excerpt. A map `instruction` override is the card's opening; the Function follows.
9. **Guards check code, not text** (AST / ESLint rules, never grep); never write a forbidden token
   as prose in an instruction.
10. **Commit the data before cutting**, explicit paths (§11): `plan`, `deck check` and `run` read
   the committed tree.

## 5. The deck

1. **Cut by file ownership**: one file, one owner card per generation; `dependsOn` only where a
   card reads what a neighbour writes; an edit of an existing file 20–60 lines, more → split the
   card, never widen the slice.
2. **Cut:**
   ```
   <morph> plan --root . --spec contour.yaml --map morph-map.json --component <C>… --judge \
     --checks decks/<p>/checks.json [--only <ids>] --out decks/<p>/deck.json
   ```
   - `--checks` builds acceptances for TypeScript and Go only; a Python project keeps the map's
     acceptances and has no transaction.
   - **`--only` is required whenever the phase's Components hold Functions outside the phase**,
     new code included. With `--checks` the deck is a **transaction**: every card is written first,
     a red card is retried alone, a red after its retries rolls the subset back. Name it in the report.
     Without such Functions, cut by `--component` alone.
3. **Processor `ds`:** `python3 $MORPHV2/decks/tools/scale_tokens.py decks/<p>/deck.json 3`.
4. **`<morph> deck check --root . --deck decks/<p>/deck.json`: errors 0.** With `_stubs/` beside
   the deck it compiles each card's stub tree; a break it names is a data defect, fixed before
   the run. Read the largest slice off its weights.
5. Commit the deck.

## 6. Stubs — the only dry check

1. **Each card's acceptance runs once** in a scratch worktree, stubs in place of its targets:
   - a new code file: its typed exports, every body throwing `stub <name>`;
   - a patch target: the current file plus only the declarations the probe needs to compile
     (a new optional key or type), no behaviour;
   - a judge's test file: one passing test.
   Earlier generations' stubs stay in place for later cards.
2. **The verdict, per probe:** each example red with a readable line (not a crash at import);
   unchanged rows green and named; a judge red at its guard; `decks/tools/stubcheck.mjs` exit 0 on
   each log where the tree has it. A probe that imports what an earlier card writes cannot be
   checked this way: name it.
3. **`node_modules` in a scratch worktree** is a real directory of per-entry symlinks, so the
   project's `.gitignore` covers it. Never edit `.git/info/exclude`: it is shared with the repo.
4. Keep the stub logs: the report quotes the proof per probe.

## 7. Gate — auto-approve, no human

The run starts at once, nobody asked, when ALL hold: `plan` exit 0; `deck check` errors 0; §6
done (every red per example, each exception named); the forecast ≤ $5 for the phase. One fails:
fix the data and check again. A second failure: stop and report.

## 8. Run

1. **`--deadline` from the deck, never the default.** On `ds`: first pass ~3 min per generation;
   a retry round 6–25 min. `deadline = 60 × (3 × generations + 2 × 25)` seconds, at least 2400.
   A project's own last run (minutes ÷ generations) beats these numbers.
2. **Start it as ONE background call**, the command in its foreground:
   `<morph> run --root . --deck decks/<p>/deck.json --processor <P> --deadline <s> > /tmp/<p>/run-1.json 2> /tmp/<p>/run-1.err; echo EXIT=$?`
   with `run_in_background: true`; no `nohup`, no `&`. The harness wakes you when it ends.
3. **No polling.** No `sleep` loops, no `pgrep` loops, no periodic `tail`: each wake rereads your
   whole context (P7b: 18 polls ≈ 4.9M tokens for nothing). Look once at `morph run:` lines in the
   `.err` only if asked.
4. **Keep out of the tree while it runs**: no edit, no commit, no primer, no scout.

## 9. Verify and the live reproduction

1. **On the run branch:** `git status --short` empty; typecheck, lint, the full suite and the
   build green (TS: `tsc --noEmit`, `eslint src tests`, `vitest run`, `npm run build`; Go:
   `go build ./...`, `go vet ./...`, `gofmt -l .` empty, `go test -count=1 ./...`). Read the diff
   once against the spec.
2. **Live reproduction.** A smoke, demo or scenario the task names runs right after, with the
   binary or code the run produced. A red smoke is a red card (§10). A smoke may force a condition
   (a red-once step, a stub answer) only in its own copy of the deck; the report names it. A task
   naming none: the report says so. A run without its smoke is not a result.

## 10. A red run: salvage first, then one fix, then stop

1. **Salvage from the archive first** — free, and not counted as the fix. When
   `.morph/runs/<run>/` holds a green answer for every card of the deck (any round, any variant):
   ```
   <morph> accept --root . --deck .morph/runs/<run>/deck.json --id <all ids> --from-run <run> \
     --pick <card.rN.vM,…> --commit
   ```
   at the run's "deck and report" commit, not its base. **Required check:** every picked judge
   answer was generated against the same code you accept (compare the code in its archived
   request with the picked code card's answer). A mismatch: that judge is not salvageable.
2. **Otherwise classify each red card** by its attempts' reasons, verbatim:
   data (spec, example, probe, lit) · budget (answer cut at maxTokens with the data right: ×1.5) ·
   environment (provider, network, timeout, toolchain; a fix of the smoke's own harness is
   environment too) · code defect (re-cut the code card).
3. **One fix.** Commit it, re-cut the red cards and their dependants with `--checks … --only <ids>`
   into `decks/<p>/deck-fix.json`, run once more (`run-2`), then the smoke again.
4. **Still red: stop.** Report the card, its class and the reasons verbatim. No second fix, no
   Fable debt, no next phase.
5. **Every retry in the report** with its card and the `file:line` that caused it — that shows
   whether blame works.

## 11. Git

1. **Explicit paths only**: `git add <path>…`; never `git add -A`, `commit -a` or `git add .` — a
   shared tree holds other sessions' uncommitted edits.
2. **No merge, no push** unless the header gives it. A merge is fast-forward only, never while
   another run owns the repo; no force-push.
3. After the run the checkout is on `morph/<runId>`: leave it so for the operator, or return to
   the base branch before any further data commit.

## 12. Report — numbers, one format, ≤ 40 lines

1. The split, if any, as the FIRST line. The MorphV2 commit of the binary.
2. **Times (UTC):** start, primer, scout, spec+record, deck cut, stubs, gate, run end, verify end,
   smoke start/end, re-run start/end, end. Prep = start → gate, in minutes, and your tool calls.
3. **Scout:** $ and minutes; deck targets it named out of the total; roles you changed — two
   numbers, never one merged; a rejected answer's targets apart.
4. **Deck:** cards, generations, transaction yes/no, largest slice; `deck check` errors/breaks.
5. **Stubs:** per probe, red / total and the rows green by design; judges red at guard; exceptions.
6. **Run:** run id; written / red out of the total; retries per card with their `file:line`;
   requests; $ from the run document; minutes of the first pass and of each retry round; exit.
7. **Verify:** each check's count (tests, race if run). **Smoke:** what ran, the result.
8. **Red cards:** class and reasons verbatim; the salvage tried, its result.
9. **Branch and commit** left for the operator.
10. **Skipped or departed** (§1.3), and why; reads of MorphV2 `src/`/`dist/` (target 0).
11. **What in this skill was unclear.** It goes into the skill, never into a workaround.

## What not to do

- Do not read a large file whole for one symbol, or a file the deck does not touch.
- Do not put the card breakdown into the spec.
- Do not take a scope without a locally runnable acceptance into the deck.
- Do not set `dependsOn` "just in case": depth is paid in queue time.
- Do not widen the slice instead of splitting the card.
- Do not add a check whose only gain is fewer retries: a retry on `ds` costs cents.
- Do not treat a green run as proof: an acceptance proves exactly what it says.
- Do not leave a lesson only in a phase report: a procedure lesson goes into this file and
  `references/lessons.md` with its date and price; a product lesson goes into the record.
