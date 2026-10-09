# Autonomous mode (from P3 on, on the VPS)

The operator's decision of 06.10.2026: after P3 is prepared by three orchestrator models
and run, the session moves to the VPS and closes the remaining phases without a human at
the gate. This file is the regulation that replaces the operator at every point where a
human answered during P0–P2. The operator confirms it before the first autonomous phase
and can change any line; the session reads it at the start of every phase.

## State at handoff (09.10, P22a is merged (salvage); next: P22b, operator's word given)

**P22a is merged (salvage), 10/10, $0 processor.** The fix run 20261009-175810's accepted answers were applied by V2's
parseAnswer and committed by `morph accept --commit` card by card in import order on `salvage/p22a-2` (065fea3 …
7780568), parse-command-judge's debt paid by Fable 5.1 xhigh (1cee67d); vitest 895/895 in 146 files, tsc/eslint/build
green, byte identity go-mini 75 416 B, P15 398 622 B (= committed deck), go-p7b 100 388 B; TASK_P22a §11 "Salvage",
MEASURE rows, DECISIONS. Issue #15 is closed by the merge; the missing import edge (parse-command ↛ gate-command in the
map) is recorded for it, not fixed. The dogfood `morph gate` of this deck was not played (≈ 23 min) — P22b's gate plays it.

**Next: P22b** (issue #13 items 2–3: mutants inside `morph gate` — a stop time for Run Mutants, the killer, the cap — and
the byte-identity corpus + its test), the operator's word given 09.10 (to the salvage session): prepare and run it by the
cycle ("The cycle of one phase"), then 🧪 smoke post and a **STOP** for the operator. #13 stays open. Every MorphV2 session
ends with `~/.morph-wait-operator` (the operator side restarts it); never touch `/home/morph/MorphStudio` or its tmux
session `MorphStudio`.

**Previous state:**

## State at handoff (09.10, operator: resume the P22a salvage in import order, then a stop)

**Next: resume the P22a salvage (operator 09.10, option (a) of the stop below).** Same rules as the salvage steps under
"Previous state": the answers the fix run 20261009-175810 accepted, applied by V2's own parseAnswer/writeAnswerFiles,
`morph accept --commit` card by card, any red → stop and report, no retry, no hand edit of code. ORDER (the imports, not
the generations): gate-plan (already green as 72e9b2b on the local branch `salvage/p22a` — reuse it or redo it), stub-verdict,
play-gate, gate-command, parse-command, then the judges gate-plan-judge, stub-verdict-judge, play-gate-judge,
gate-command-judge; then parse-command-judge's debt by Fable ("Paying a debt on a V2 deck"); then the full suite, byte
identity, TASK_P22a §11, MEASURE, DECISIONS (record also: parse-command's map entry has no dependency on gate-command although
its main.ts imports src/gate/gateCommand.ts — the deck's generations missed an import edge; for #15, not fixed here),
fast-forward merge, push, 🔀, stop. Every MorphV2 session ends with `~/.morph-wait-operator`; never touch
`/home/morph/MorphStudio` or its tmux session `MorphStudio`.

## State at handoff (09.10, operator: salvage P22a stopped at card 2 of 9 — the order, operator decides)

**Stop: the P22a salvage is red at step 1, card 2 of 9 (operator decides; issue #15 stays open).** Session 09.10 (orchestrator
opus55 ~70k/27/14 min, $0 processor): the answers were applied by V2's own `parseAnswer` (`/tmp/v2bin-p22a`, = dist) and
written as `writeAnswerFiles` does; accept ran from `/tmp/v2bin-p22a` with `--model deepseek/deepseek-v4.1-flash` (the run's).
gate-plan.v1 → `morph accept --commit` exit 0, commit **72e9b2b, kept on the LOCAL branch `salvage/p22a`, not on main, not
pushed**. parse-command.v1 (generation 0) → red at tsc: `src/cli/main.ts(19,29): error TS2307: Cannot find module
'../gate/gateCommand.js'` — its main.ts imports gate-command's file (generation 2); the transaction run passed it only
because every card is written before any acceptance. Not the answer's defect: the card-by-card order of the procedure.
Stopped by "any red → stop", no retry, no reorder; parse-command's files removed from the tree, main reset to 5d82d9b
(= origin). Options for the operator: (a) accept in dependency-of-imports order — gate-plan (done), stub-verdict,
play-gate, gate-command, THEN parse-command, then the judges (gate-command.r1.v1 imports only ../cards and ./gate*, nothing
of src/cli, so this order should hold); (b) all nine written then accepted card by card — refused by accept's "change
outside the targets" rule, not viable as is. Then step 2 (parse-command-judge debt by Fable) and step 3 as before.
Scripts of the attempt: the session's scratchpad (apply.mjs, drive.sh); recreate them if the scratchpad is gone.

**Previous state (the salvage order, unchanged):**

**Next: salvage P22a (operator 09.10, a one-off decision, issue #15), then a stop for the operator.** No new `morph run`.
The fix run 20261009-175810 (`decks/p22a/deck-fix.json`) wrote 9 cards whose acceptances passed and were rolled back only
by the transaction; their answers are archived in `.morph/runs/20261009-175810/answers/`. Steps:
1. For each of the 9 green cards, in generation order: take the answer variant that PASSED its acceptance in that run
   (report.json, answers/lines.txt, the run's stderr), write it to the card's targets exactly as the run applies an
   answer, then `morph accept --deck decks/p22a/deck-fix.json --id <card> --commit`. It must be green on the current tree;
   any red → stop and report, no retry, no hand edit of code.
2. parse-command-judge: pay its debt by "Paying a debt on a V2 deck" (`morph card` brief → the morph-fable-debt agent,
   Fable xhigh → `morph accept --commit`). Its dependencies are now in the tree.
3. Full suite (vitest), byte identity (go-mini, P15), then TASK_P22a §11, a MEASURE row, DECISIONS (the operator's one-off:
   accepted archived answers of a rolled-back transaction, no live run; the gap of a debt on a transaction deck, #15),
   fast-forward merge, push, 🔀. Close #15 if the debt is paid; #13 stays open (P22b, P22c).
Then stop for the operator (P22b waits for the operator's word). Every MorphV2 session ends with `~/.morph-wait-operator`,
never `~/.morph-phase-done` (flag files shared with MorphStudio's session; the cron watchdog is MorphStudio's); never touch
`/home/morph/MorphStudio` or its tmux session `MorphStudio`.

**Previous state (the stop that led here):**

**Stop: P22a is red after its one fix, issue #15 (label `debt`).** Nothing of P22a is merged but its data, decks and two
run archives. P22 was split by the preparation (`docs/TASK_P22a_gate.md`): **P22a** = issue #13 item 1, `morph gate
--deck --stubs --refs` (NEW Component `gate`, src/gate/, + a cli parse card), 10 cards, an `--only` cut, so one
transaction; **P22b** = item 2 (mutants inside the gate) + item 3 (byte-identity corpus + test); **P22c** (optional) =
`morph report`, `plan --scale-tokens`. Runs: 20261009-153356 (`decks/p22a/deck.json`, 0/10, $0.4599, 113 min: four judge
DATA reds on the record/spec side, three FIX[budget], one ENV[transport], no code defect) and the one fix
20261009-175810 (`decks/p22a/deck-fix.json`, 9/10 green and all rolled back, $0.1752, 43 min): **parse-command-judge**
calls `parseCommand(["deck check", …])` with "deck check" as one argv element and expects a flag error — its own
invented assumption. The debt was NOT paid: a transaction deck rolls the judge's dependencies back with it, so `morph
accept --commit` of the judge alone cannot be green (a gap of "Paying a debt on a V2 deck"). Options in #15: a plain
re-run of deck-fix.json; a re-cut `--only` of the nine green cards then the judge's debt; or a second data line for the
judge. The regulation text of AUTONOMY steps 1–2 and the templates already says `morph gate` takes effect "from the P22a
merge on": until that merge, the hand gate stays. **Operator 09.10: P22b was approved to start right after P22a only if
P22a is green (merged, smoke green, no emergency stop, no debt) — it is NOT green, so P22b waits for the operator's word
too.** Running total $6.9335 of $30. Every MorphV2 session ends with `~/.morph-wait-operator`, never
`~/.morph-phase-done` (flag files shared with MorphStudio's session; the cron watchdog is MorphStudio's); never touch
`/home/morph/MorphStudio` or its tmux session `MorphStudio`. Issue #12 stays open (MorphStudio's PM re-checks P7b);
issue #13 stays open.

**P21c is merged** (`docs/TASK_P21c_transaction.md`, issue #12 item 2, general per language): runs 20261009-114343 (9/10,
plan-command-judge `budget-exceeded` on the 2400 s deadline, never tried — ENV[time], no re-cut) and 20261009-122642 (the
plain re-run, 1/1); $0.4484, 49 min; vitest 862/862. An `--only` cut with `--checks` now prefixes every acceptance with
`# morph: subset transaction` (NEW Transaction Deck, Blame Log in cards; Hide Later no longer applied under the mark); a
marked deck runs as one transaction (NEW Run Transaction in runloop-subset): every card written by generations with no
acceptance, then every card's own acceptance on the full tree; a red `file:line` (any Tree Profiles fileLine) retries
only the owner, ≤ 2 retries per card, all acceptances again to a fixed point; an existing file no card owns stops the run
`outside the subset: <line>`; all green commits every card, any other end restores every target. `deck check` stubs a
marked card's tree with the whole subset. Unmarked decks run as before; cuts without `--only` byte for byte (go-mini
75 416 B, P15 398 622 B, go-p7b 100 388 B, run's binary). Demo (`decks/p21c/demo.sh`): ts-rename 0/4 → 4/4, go-p7b with a
forced judge red 2/8 (blame `supervisor/guard.go` → runtime-guard) → 8/8, go-p7b + `mcp/count.go` exit 3 outside the
subset. **Live smoke on ds GREEN** (run 20261009-123941, go-p7b `--only` 8 cards, control-contract-judge forced red once:
8/8, the judge retried after its gen-2 sibling wrote, $0.0142, no hand edit; `decks/p21c/smoke/`). Running total
$6.2984 of $30. Lesson: size `--deadline` to a deck's slowest chain (4 generations of large judges on ds overran 2400 s).

**P21b is merged** (`docs/TASK_P21b_deckcheck.md`, issue #12 item 3.5, general per language): runs 20261009-094451 (9/10,
check-builds-judge DATA[spec]: its own tests wrote a deck as `{"cards": …}`) and 20261009-101744 (the one fix, 1/1);
$0.2508, 33 min; vitest 834/834. `morph deck check` on a deck with `<deck dir>/_stubs/` copies the tree of every card's
first attempt (earlier and own-generation targets as stubs), runs its language's step (NEW Tree Profiles in language:
Go `go build` + `go vet` with the card's full.json overlay, TypeScript `tsc --noEmit -p tsconfig.card.json`, Python a
plain note "has no compile or typecheck step: not built"), and counts every `file:line` outside the card's targets as an
error (`builds` in the document; NEW Stub Trees, Check Builds in planner-subset/cli, Tree Check in acceptance). With the
run's binary: go-p7b deck.p20 exit 2 naming `supervisor/guard.go:20:23`, deck.p21 exit 0, ts-rename exit 2 naming
`src/report/line.ts(1,17)`; cuts byte for byte (go-mini 75 416 B, P15 398 622 B, go-p7b 100 388 B). Step 1's fullvet.mjs line is
unchanged (the operator decides whether `deck check`'s `builds` replaces it). Running total $5.8358 of $30.

**P21a is merged** (`docs/TASK_P21a_breaking.md`, issue #12, request MorphStudio eb52a5a incl. the operator's amendment,
comment 6075790078): run 20261009-074114 on ds, 8/8 on the first attempt, $0.1969, 21.7 min, no fix; vitest 812/812. A
Go `morph plan --only` cut now hides, per card, every subset target of its own and LATER generations (NEW Hide Later in
planner-subset, NEW Read Go Tree in cli), except a package's files while a visible file lies in it or imports it (the keep
rule, to a fixed point); cuts without `--only` byte for byte (go-mini, P15). Data: go-p7b (a P7b-shaped fixture),
`decks/tools/fullvet.mjs` (= `templates/go/decks/tools/fullvet.mjs`, a hand gate step for item 3.5 until P21b),
`decks/p21/demo.sh` (none 0/8 stubcheck · fullvet · references red; main's binary 4/8 · 5/8 · 6/8).
**The live smoke on ds is RED** (run 20261009-081603 on go-p7b, 2/8 written, $0.0643, `decks/p21/smoke/`, TASK §11):
a card RETRIED after a same-generation sibling of the same package was accepted builds the new file beside a
later-generation file the keep rule restored (`mcp/session.go` outside the subset imports supervisor) —
`supervisor/guard.go:20:23: l.Resumes undefined` on control-contract-judge r1/r2 `== full`, then a cascade. The stub
demo plays a generation in deck order, so it cannot show it. **P21b, prepared only after the operator's word**: item 3.5
(`morph deck check` on an `--only` deck builds each generation's tree on stubs and names file:line of a non-own break,
in the tool; acceptance: non-zero naming `supervisor/guard.go:20` on go-p7b cut by f6cf44d, 0 on the fixed cut; needs
~8 cards, the cli record at 29.9 KB of 30 KB first) AND the retry gap above (B, a joint acceptance of a package group, or
the run re-hiding a kept package's later files once a sibling in it is accepted). MorphStudio's PM re-checks P7b itself.
Running total $5.5850 of $30.

**P20 is closed** (issue #11, label `P20-rerun`; `docs/TASK_P20_rerun.md`): run 20261008-221549 on ds, 6/6 on the first
attempt, $0.0629, 16 min, no fix. (1) `morph plan … --only <id>,<id>,…` (Parse Command, NEW Select Cards in Component
planner-subset, Plan Command narrows the checks to the subset): the acceptances are built over the subset, so a card
outside it is never a sibling and its accepted file never blanked; a re-run of failed cards re-cuts with `--only`, never
a hand-filtered deck (step 3 above); a cut without `--only` is byte for byte (go-mini, P15). (2) Go guards
(`templates/go/decks/tools/guard.mjs`, `decks/tools/goguard.mjs`) let tests import go.mod's direct requires; the TS
template guard lets tests import package.json `dependencies`; Python ships no guard. (3) `decks/tools/stubcheck.mjs`
(also in `templates/common/decks/tools/`) is a gate item: every stub log red at the expected stage and no build/vet/tsc
line naming a file outside the card's targets. Reproduced on go-mini by `decks/p20/demo.sh`.

**P19 is closed** (issue #10, label `P19-deps`): P19a (record half, run 20261008-141116, 8/8, $0.0935) and
P19b (builder half: per-card allowed packages in the TS/Go guard, `GOFLAGS=-mod=vendor` exactly when
`vendor/modules.txt` exists, `GOPROXY=off` always, Plan Command wiring, MorphV2's own `yaml` declared in `contour.yaml` +
`docs/deps/yaml.md`, templates/common docs; run 20261008-152814, 8/8, $0.0934) are merged. Issue #10's smokes are green
(Go live on ds with vendored go-humanize v1.0.1 offline, TypeScript with change-case up to stub runs; `decks/p19b/smoke/`,
TASK_P19b §11).
**Processor `ds`** (maxTokens ×3; glm53 the fallback; batch route glm53b). No mrph cross-check
at the gate (operator 08.10). Own pre-merge code read: yes. External review passes: no (operator 08.10). Every new
MEASURE row fills the `прогоны` column.
Known limits carried: a generate card of a Component with no `docs` and no dependency gets its own (missing) target as its only slice file and the run refuses it (`contextSlice … does not exist`; P19b smoke map uses `docs: ["package.json"]`); a random tmp name can contain a forbidden substring in `run.p11c` example 5 (≈1 in 770, P19b); `morph plan --checks` has no python acceptance builder (a python project cuts with map acceptances, P18); `morph init` finds `templates/` two levels above its module, so a binary copy needs `templates` linked beside its `dist/` (P18); No New Skips counts skip tokens inside string literals; one unreproduced vitest flake in P13b (logs
kept since); the ds batch slug is slow (~73 min); a `--checks` deck mixing languages builds by its first Component's
language; gofmt can redden otherwise correct Go (the retry sees the diff); the primer's Go call rule misses a signature split
across lines or a `testing` import under another name (P16); `morph accept` compares `git status --porcelain` paths without `-z`, so a quoted path (spaces, non-ASCII) reads as outside the targets (P17); `--only` keeps the cards in plan order, never the order given (Order Deck sorts each layer; an equivalent mutant, P20); the template leak scan finds `templates/common/tools/vps-start.sh:20` "(operator 08.10)" (bc311aa, P20).
Lessons for the next preparations: default code targets add a test file (give a smoke cap or code-only targets); new
files need `"intent": "generate"` in the map; a new `src/` folder needs its layer in `decks/tools/guard.mjs`; size a judge
from its expected answer (≥ 28 000 for a ~20 KB answer, before the ×3); vary every constant the code must not hard-code
across the examples; every mutant run under a 120 s timeout; kill leftover watchers/workers of the scratch tree; a Go repo
installs `decks/tools/goguard.mjs` and `gofirstdiff.mjs` as its guard.mjs/firstdiff.mjs.

## Machine

- User `morph` (not root: Claude Code refuses to skip permissions under root). Repo
  `/home/morph/MorphV2` (origin `https://github.com/VasyaLutiy/morph`, branch `main`).
- Old Morph: `/home/morph/MorphProject/mrph` (frozen, `main`), `/home/morph/MorphProject/morph-lab`
  with `venv/bin/mrph` and `.env` (mode 600; never printed). `mrph` reads `.env` from the
  current directory: every call runs from `/home/morph/MorphProject/morph-lab` with
  `--root /home/morph/MorphV2`. Processor **`ds`** (operator 07.10: `deepseek/deepseek-v4.1-flash`,
  PROVIDER_ORDER alibaba, the same OpenRouter key); `glm53` is the fallback.
- MorphV2 binary: `npm run build` in the repo, then a COPY of `dist/` in `/tmp/v2bin-<phase>/`
  (with `node_modules` symlinked from the repo) runs the deck, so a card whose acceptance runs
  `npm run build` cannot replace the running binary. The processor env is
  `MORPH_PROCESSOR_<P>_<KEY>` = `MRPH_PROCESSOR_<P>_<KEY>` of `morph-lab/.env` (P = `ds`, or `glm53`
  for the fallback) for KEY in TYPE, API_KEY, MODEL, ROUTE, CONCURRENCY, PROVIDER_ORDER,
  REASONING_MAX_TOKENS, only the keys that are set (ds has no REASONING_MAX_TOKENS), by indirection
  in a subshell, never printed (recipe: `decks/p7/smoke/run.sh`).
- Node 22, npm, git (auth through `gh`), tmux. Anything longer than a minute runs under
  `nohup`/`tmux` with a log file; the session must survive an SSH drop.

## One phase, one session (operator 08.10)

Every phase gets a fresh session: the memory of a phase is in the repo (record, TASK §11, MEASURE, DECISIONS, this
file, the primer), never in the session's context. P15 and P15L proved it (a fresh session, one run, no fix). The
session works exactly the phase "State at handoff" names, records it, merges it, rewrites "State at handoff" for the
next phase and pushes. Then it ends in one of two ways:
- **the next phase is queued** (named in "State at handoff" with no stop before it): post 🔀, `touch
  ~/.morph-phase-done` and stop. The watchdog (cron, 10 min) kills the session and starts a fresh one, which reads
  this file and works that phase;
- **a stop** (a smoke stop, an emergency stop, a gate stop, no next phase): post the stop, `touch
  ~/.morph-wait-operator` and stop. The watchdog never nudges it; the operator side restarts it with
  `tools/vps-start.sh` after its check.

## Shell hygiene (operator 08.10)

Never chain `cd` with a write or a delete in one command (`cd X && rm …`, `cd X && go mod vendor`): Claude Code stops
such a command for a manual approval even with permissions bypassed (P19b's preparation agent waited on it). Use
absolute paths or the tool's own directory flag (`git -C`, `go -C`, `npm --prefix`, `make -C`). Every brief to a
preparation agent repeats this line.

## The cycle of one phase

1. **Prepare** (an orchestrator agent, fresh context, the brief in the form of P10a/P10b1):
   spec by `docs/TASK_TEMPLATE.md`, fixtures, map entries, probes, the phase's acceptances
   (`build.py p<N>` with `"locate": True, "full_report": True` until P10b2 landed; since 07.10 it is in `decks/tools/archive/`: the
   phase's `checks.json` and `morph plan --checks`, as P10b2 defines). **The cut is V2's**:
   `node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component <C>…
   --judge --out decks/<phase>/deck.json`. When the cut holds cards outside the phase, keep the phase's cards: once
   P20 is merged with `--only <id>,<id>,…` on the same `plan` command (the acceptances are built over the subset, so no
   card outside it is a sibling; issue #11); before that, and for a deck cut by a binary without `--only`, a short filter
   over the deck file, committed with the filtered deck. **For processor `ds`, every card's maxTokens ×3** after the cut and the
   filter: `python3 decks/tools/scale_tokens.py decks/<phase>/deck.json 3`, committed with the deck
   (DeepSeek thinks 15–20k tokens before the code and no provider honours the reasoning budget; with
   the plain budget its answers come back empty). Then `node dist/cli.js deck check --root . --deck <deck>`. **No mrph cross-check** since
   08.10 (operator): V2 has cut ten phases itself and frozen mrph knows no Go; mrph stays only as the
   named fallback below. Every
   acceptance red per example on stubs in a scratch worktree, and `node decks/tools/stubcheck.mjs <log> <probe|guard>
   <targets>` exit 0 on every stub log (the red at the expected stage, and no build/vet/tsc line naming a file outside
   the card's targets — a guard count alone missed MorphStudio's vet line, issue #11); for a Go deck cut with `--only`,
   also `node decks/tools/fullvet.mjs <deck> <card>` exit 0 on every stub tree (the whole module vetted under the card's
   `== full` overlay, which a stub run never reaches: a file outside the card's targets broken by the record is named
   before any paid run — P21a, issue #12; P21b moves this check into `morph deck check`); mutations killed (**every mutant run
   under a timeout**, `subprocess.run(..., timeout=120)`, a timeout counted as killed — operator
   07.10, after a mutant made a batch-wait loop infinite and hung the P11b mutation run 28 min).
   **Mutation cap (operator 08.10):** mutants target only the record's examples and the contracts the
   phase changes, **at most 30 per phase and at most 20 min of mutation runs in total**; survivors
   beyond the cap (untried or unkilled) go to `docs/DECISIONS.md` as a known risk naming the file and
   the mutation, and do not block the gate. The P15 preparation (full campaign, 72 min) is the
   baseline; record the mutant count and minutes in the MEASURE notes of every phase; the data and the
   deck committed on `main`.
   **From the P22a merge on (issue #13), the stub and reference play is one command, `morph gate`.** The stubs of every
   target are data committed at `decks/<phase>/_stubs/` (a typed throwing stub per new code file, the current file for a
   patch target, a one-test file per judge file; `deck check` builds them too), the reference targets lie in a directory
   outside the tree (`/tmp/<phase>/refs/`, never committed); with the data and the deck committed:
   `nohup node dist/cli.js gate --root . --deck decks/<phase>/deck.json --stubs decks/<phase>/_stubs --refs /tmp/<phase>/refs
   > /tmp/<phase>-gate.json 2> /tmp/<phase>-gate.err &` — the preparing agent ends its turn and reads the one JSON verdict
   when it exits (no polling). It plays HEAD in a scratch clone: every card's acceptance on its stubs (red at its probe,
   a judge at its guard, and no build/vet/tsc line naming a file outside its targets — stubcheck.mjs's rule), then on
   its references (green), then, for a deck without the transaction mark, every card of a generation again once the
   whole generation is written (the retry tree the P21a smoke went red on); every run timed against 250 s; Check Builds
   on the stubs (fullvet's job). `rows[].failures` (the expected stage's FAIL lines) are read against the probes'
   examples for "red per example"; exit 0 replaces the stub, stubcheck, fullvet and chain items of this step and of step
   2. The hand play with stubcheck.mjs stays for a deck the tool cannot play (an uncommitted tree). Mutants stay the hand
   step above until P22b moves them into the gate.
2. **Gate without the operator.** The run starts by itself only when ALL hold (from the P22a merge on, `morph gate` exit 0
   stands for the stubs, stubcheck, fullvet and chain items below):
   `morph plan` exit 0; `morph deck check` errors 0; every probe red per example with a readable line on the stubs and stubcheck.mjs exit 0 on each stub log (and
   fullvet.mjs exit 0 on each stub tree of a Go `--only` deck); chain under 250 s each; every mutant run under a timeout and the mutation cap kept (≤ 30 mutants, ≤ 20 min); forecast ≤ $1 for the phase; no slice over 200 KB. Otherwise the phase stops with a report in `docs/MEASURE.md` (row with
   "stopped at gate: <reason>"), touches `~/.morph-wait-operator` and stops.
3. **Run** (the session itself or a run agent): from the repo root, the binary copy
   `node /tmp/v2bin-<phase>/dist/cli.js run --root . --deck decks/<phase>/deck.json --processor
   ds --deadline 2400` (the retry cap is per generation since P10c1; `--processor glm53` with the
   plain maxTokens is the fallback when ds is down — an environment red); stdout (the Run Document) to a file under /tmp. The run opens
   `morph/<runId>`, commits each accepted card with trailers and archives `.morph/runs/<runId>/`.
   The tree is not touched while the run is in flight. A re-run of failed cards uses a deck of
   those cards only (their dependencies are already on `main`), once P20 is merged re-cut by `morph plan … --checks
   decks/<phase>/checks.json --only <ids> --out decks/<phase>/deck-rerun.json` — never a hand-filtered copy of the deck:
   its acceptances keep the full generation's overlay and blank files already accepted (MorphStudio run 20261008-201843,
   issue #11); the same re-cut deck is the one `morph card`/`morph accept` get. A failed run's archive commit is
   cherry-picked onto `main` so every run is on record.
4. **Verify** on the run branch: `git status --short` empty; `tsc --noEmit`, `eslint src
   tests`, `vitest run`, `npm run build` green; the written code and tests read once
   against §2.2 and the record; defects recorded, never fixed by hand.
   **Operator 08.10 (correcting 07.10): no EXTERNAL review passes (Fable) until further notice** — the session's
   own read of the written code above stays; the goal is to close all phases through P14.
5. **Record**: §11 of the TASK and the row of `docs/MEASURE.md` (builder column "V2"), one
   commit on the run branch with the trailer `Co-Authored-By: <the model that writes it> <noreply@anthropic.com>` (today
   `Claude Opus 5.5`; operator 08.10 — the old Fable trailer was a leftover).
6. **Merge and push**: `git checkout main && git merge --ff-only morph/<run-id> && git
   push origin main`. Fast-forward only; force-push is forbidden; a non-ff state stops the
   session with a report.

## Decisions the session makes alone

- **Gaps in the record** (a shape, an order, a message the record does not pin): decided
  in §2.2 of the phase's spec, as in P1–P2, AND appended to `docs/DECISIONS.md` as one
  line each (phase, Function, decision, why). The record itself is edited only when an
  example is wrong or missing, with the change named in DECISIONS.
- **Fixtures**: by `docs/TASK_TEMPLATE.md` §2.1; recorded glm answers may be used after
  cleaning.
- **Orchestrator model**: decided at P3 (see `docs/MEASURE.md`, "Сравнение оркестраторов"):
  `morph-orch-opus55` prepares and runs every phase. `morph-orch-opus48` took P5 only; the
  operator dropped it after P5 (06.10: P3 cost $16.98 against $6.26 for Opus 5.5). The
  agent's tokens, tool calls and minutes go into the "$ оркестр." column of
  `docs/MEASURE.md` as "<model> <tokens>/<calls>/<min>".
- **Operator order 06.10 (first live smoke)**: right after P7 is merged and pushed, before
  P8, run one smoke of the V2 binary on the real glm53. Build with `npm run build`; in a
  temporary git repo outside `~/MorphV2`, a hand-written deck in the V2 schema of 2–3 tiny
  TypeScript cards with a dependency (a,b→c) and shell acceptances; run it with the V2
  `run` command and `--processor glm53`, the key from `morph-lab/.env` (never printed).
  Ceiling $0.10 for the smoke. Record it as its own row in `docs/MEASURE.md` ("P7 smoke":
  written/failed, $, minutes, exit code, the JSON on stdout in one line) and the deck in
  `decks/p7/smoke/`. The session posts the result to Telegram and stops (see "Smoke
  stops"); a red smoke is an emergency stop.

- **Lessons labelled for a phase**: before preparing phase P<N>, read the open GitHub
  issues labelled `P<N>-<component>` (`gh issue list --label P<N>-<component>`) and build
  them into that Component's record; the phase's DECISIONS lines name the issues they
  answer, and the phase's merge closes them.

## Failure

Every failed card gets one class, decided from the run log and the attempt files, and
written as a tag in its `docs/DECISIONS.md` line (`DEBT[data]`, `FIX[budget]`, ...) and in
the "класс провала" column of its `docs/MEASURE.md` row:

| Class | Sign | Fix, by the session alone |
|---|---|---|
| data | the answer is whole; the acceptance is red on logic, types or the guard | ONE re-cut by the P1b pattern (spec wording or fixtures, never the card instruction) |
| budget | the answer is cut at `max_tokens` (finish reason length, an unclosed fence) | ONE raise of that card's `max_tokens` in `morph-map.json` ×1.5–2, ceiling 32000, then a re-run of that card |
| environment | npm, network, provider error, `exit null` timeouts on a green log | no re-cut; one plain re-run later, then stop the phase |
| code defect | the judge finds a real bug in accepted code | ONE re-cut of the code card by the P1b pattern |

A budget fix that passes is not a failure: the phase is not stopped and the fix is one
`FIX[budget]` line. Prevention at cut time: the judge card with the most examples in a
phase gets `max_tokens` ≥ 20000.

- A phase with failed cards after the run: ONE fix of the failed cards by their class,
  merged if green.
- **Emergency stop (operator, 06.10)**: a card still red after its one fix stops the whole
  autonomous generation — no next phase, no merge of that phase's run branch beyond the
  green code already merged. Debts are not carried forward. The session:
  1. opens a GitHub issue in origin: `gh issue create --label debt`, title "P<N> <card>:
     <class> — <one-line symptom>", body: run ids, what was tried, the attempts' reasons
     verbatim, the code left without a judge or a proof ("unguarded: <paths>");
  2. posts to Telegram "EMERGENCY STOP" with the card, the class and the issue URL;
  3. stops and waits for the operator.
  The card is then paid by a processor swap, outside the autonomous loop: the SAME card
  (instruction, context_slice, acceptance unchanged) executed by Claude Fable 5.1 at
  effort xhigh, committed with the Morph trailers and `Morph-Model: claude-fable-5-1`.
  **Only through the skill `/morph-agent-run`, section "Paying a debt"** (operator, 07.10):
  its pre-check of the acceptance on the empty tree, its brief, its own verification
  (re-run, `git diff` outside the target, mutations) and its records. A commit with
  `Morph-Model: claude-fable-5-1` made any other way (a bare `claude -p`, the agent
  `morph-fable-debt` spawned directly, by hand) does not pay the debt and is reverted.
  Fable writes only the card's target; a defect it finds in other code is reported, not
  fixed. Its commit closes the issue; its
  cost is a "debt (fable)" row in `docs/MEASURE.md`; its paragraph on why glm failed goes
  into DECISIONS as the data lesson; after the skill's verification `tools/tg.sh debt` 💸
  posts the card, $ and minutes. Only then does the operator restart the session.
- A red that comes from the environment (npm, network, provider error, `exit null`
  timeouts on a green log): one plain re-run later; still red → emergency stop with class
  `environment` (the processor swap does not apply; the operator fixes the environment).
- **Fallback**: if `morph plan` or `morph deck check` fails on a phase's record for a reason
  in V2's own code (not the data), the session cuts that phase with old `mrph plan --spec`,
  converts it with `decks/tools/v2deck.py`, writes a DECISIONS line and opens an issue labelled
  for the next phase that touches the failing Component. If the V2 runner itself fails (exit 3,
  a crash, a wrong archive), emergency stop with class `environment`.
- **Paying a debt on a V2 deck** (P17, issue #8): on an emergency stop of a V2 deck the session pays the debt
  itself, once, before stopping:
  1. `node dist/cli.js card --root . --deck <deck> --id <card> --md` — the debt brief (`.markdown` of the JSON: the
     targets, the instruction, the acceptance, the context slice as it is now, the last run's reason, log and answers);
  2. the agent `morph-fable-debt` (Claude Fable 5.1, effort xhigh) gets that brief and writes ONLY the card's targets;
  3. `node dist/cli.js accept --root . --deck <deck> --id <card> --model claude-fable-5-1 --commit` — the card's own
     acceptance on the current tree; green commits only the targets with `Morph-Card`, `Morph-Model`,
     `Morph-Acceptance-Exit: 0`, `Morph-Debt: true`; a change outside the targets or a red acceptance refuses;
  4. green → `tools/tg.sh debt` 💸, a "debt (fable)" row in `docs/MEASURE.md`, the data lesson in DECISIONS, the issue
     closed by the commit, and the loop goes on (record, merge, next phase); red → the emergency stop stands and the
     operator decides.
  Cap: one Fable debt per phase, ≤ 30 min. `/morph-agent-run` is no longer required for V2 decks.
- **Smoke stops**: a live glm53 smoke of the V2 binary after P7 (done), after P10b2 (the
  switch complete: V2 cuts with its own acceptances, `build.py` archived) and after P11. After
  each smoke the session stops for the operator, red or green. A red smoke is an emergency stop.
- **Smoke stops added by the operator (07.10)**, each a live smoke, then `tools/tg.sh smoke` 🧪 with the numbers, then
  STOP and wait; the operator side resumes the session after its own check — **the session never resumes itself**:
  1. after **P11b2**: `morph submit` / `morph collect` on the real batch route (processor ds or glm53b), the persisted
     state `.morph/batches/<id>.json` read back by a SECOND process (collect in a new process after submit exits);
  2. after **P12**: the V2 primer on this repository (`primer --write`); the issue #1 experiment (a fresh agent with no
     tools tells the project story from the V2 primer alone) is run by the operator side, not by the session;
  3. after **P14**: the final smoke of the whole V2 on a tiny repository: `plan --checks`, `run` on ds, primer, scout,
     review.

## Money

- $5 per phase (the standing cap), forecast ≤ $1 at the gate.
- $30 for the whole autonomous stretch; the running total is kept in
  `docs/MEASURE.md`; reaching it stops the session.

## What never happens

- Code under `src/` or `tests/**/*.test.ts` written by hand.
- `contour.yaml` in a slice. The record's history in the record.
- A paid run on a deck that did not pass the gate above.
- A push of anything but `main` fast-forward; a force-push; a rewrite of history.
- Printing a secret.

## Observability

- The session runs in `tmux` session `morph`, started by `tools/vps-start.sh`; the operator
  attaches with `tools/vps-start.sh attach` (detach `Ctrl-b d`) or follows the log with
  `tools/vps-start.sh log`.
- `tools/tg.sh "<text>"` posts to the operator's Telegram channel (token and chat id only in
  `~/.config/morph/tg.env`, written by the operator, mode 600; a missing file is a silent
  no-op). The session posts at these milestones, one message each, as
  `tools/tg.sh <kind> "<headline>" "<numbers>"`: the kind gives the icon, the headline is the
  gist in one line (phase and what happened), the numbers go on the second line joined by ` · `.
  `start` 🚀 phase start (what is being cut); `gate` 🚦 gate passed (`stop` if not, with the
  reason); `run` 🏁 run green (written, $, minutes, burned variants), `fail` ❌ run with red
  cards; `merge` 🔀 merge and push done; `smoke` 🧪 a smoke stop; `stop` 🛑 any stop of the
  regulation, the emergency stop included; `debt` 💸 a debt paid; `end` 🎉 the end of the
  stretch with the totals; `info` 💬 anything else. Example:
  `tools/tg.sh run "P8 language: run green" "8/8 written · \$0.12 · 14 min · 0 burned"`.
  The watchdog posts as `watchdog` 🐕, the hooks below as `idle` 💤 and `ask` 🔔.
- Claude Code hooks in `.claude/settings.json` post on `Stop` (the session stopped: finished
  or waiting for input, with its last message) and `Notification`; so an idle session is
  never silent.

## Order of the remaining phases

By the record's Components, see `docs/PLAN.md`, section "Фазы по записи (после P2)".
