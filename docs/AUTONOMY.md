# Autonomous mode (from P3 on, on the VPS)

The operator's decision of 06.10.2026: after P3 is prepared by three orchestrator models
and run, the session moves to the VPS and closes the remaining phases without a human at
the gate. This file is the regulation that replaces the operator at every point where a
human answered during P0–P2. The operator confirms it before the first autonomous phase
and can change any line; the session reads it at the start of every phase.

## State at handoff (08.10, after P13a)

P0–P13a merged (P13a: scout protocol, cage, budgets, seed, tools — pure, no model call); `main` = origin = VPS. Issues #1, #3, #4, #5 closed. **Processor `ds`** (maxTokens ×3; glm53 the
fallback; batch route glm53b). No external review passes (operator 08.10); the session's own pre-merge code read stays.
Every new MEASURE row fills the `прогоны` column. `morph primer` gives the story, the totals (debt rows out, running total
vs archive total) and file ownership by trailers (208 Morph commits, 173 paths) — the seed of the scout. Running total
$3.5365 of $30.
Next, in order: **P13b** scout (rounds, `scout/<id>/scout.json`, `plan --from-scout`); **P14** reviewer → **final smoke stop**
(plan --checks, run on ds, primer, scout, review on a tiny repo): 🧪, then stop; the operator resumes.
Lessons for the next preparations: default code targets add a test file (give a smoke cap or code-only targets); new
files need `"intent": "generate"` in the map; a new `src/` folder needs its layer in `decks/tools/guard.mjs`; size a judge
from its expected answer (≥ 28 000 for a ~20 KB answer, before the ×3); vary every constant the code must not hard-code
across the examples; every mutant run under a 120 s timeout; kill leftover watchers/workers of the scratch tree.

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

## The cycle of one phase

1. **Prepare** (an orchestrator agent, fresh context, the brief in the form of P10a/P10b1):
   spec by `docs/TASK_TEMPLATE.md`, fixtures, map entries, probes, the phase's acceptances
   (`build.py p<N>` with `"locate": True, "full_report": True` until P10b2 landed; since 07.10 it is in `decks/tools/archive/`: the
   phase's `checks.json` and `morph plan --checks`, as P10b2 defines). **The cut is V2's**:
   `node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component <C>…
   --judge --out decks/<phase>/deck.json`. `morph plan` has no card filter yet: when the cut holds
   cards outside the phase, keep the phase's cards with a short filter over the deck file and
   commit the filtered deck. **For processor `ds`, every card's maxTokens ×3** after the cut and the
   filter: `python3 decks/tools/scale_tokens.py decks/<phase>/deck.json 3`, committed with the deck
   (DeepSeek thinks 15–20k tokens before the code and no provider honours the reasoning budget; with
   the plain budget its answers come back empty). The mrph cross-check compares max_tokens before
   the ×3. Then `node dist/cli.js deck check --root . --deck <deck>`; a dry
   `mrph plan --spec` on the same Components as a cross-check (same ids, dependsOn, generations,
   targets, slices, acceptances, max_tokens; instructions differ by the P10a design); every
   acceptance red per example on stubs in a scratch worktree; mutations killed (**every mutant run
   under a timeout**, `subprocess.run(..., timeout=120)`, a timeout counted as killed — operator
   07.10, after a mutant made a batch-wait loop infinite and hung the P11b mutation run 28 min); the data and the
   deck committed on `main`.
2. **Gate without the operator.** The run starts by itself only when ALL hold:
   `morph plan` exit 0; `morph deck check` errors 0; the mrph cross-check shows no difference
   but the instructions; every probe red per example with a readable line on the stubs; chain
   under 250 s each; every mutant run under a timeout; forecast ≤ $1 for the phase; no slice over 200 KB. Otherwise the phase stops with a report in `docs/MEASURE.md` (row with
   "stopped at gate: <reason>") and the session moves to the next phase whose dependencies
   are met.
3. **Run** (the session itself or a run agent): from the repo root, the binary copy
   `node /tmp/v2bin-<phase>/dist/cli.js run --root . --deck decks/<phase>/deck.json --processor
   ds --deadline 2400` (the retry cap is per generation since P10c1; `--processor glm53` with the
   plain maxTokens is the fallback when ds is down — an environment red); stdout (the Run Document) to a file under /tmp. The run opens
   `morph/<runId>`, commits each accepted card with trailers and archives `.morph/runs/<runId>/`.
   The tree is not touched while the run is in flight. A re-run of failed cards uses a deck file of
   those cards only (their dependencies are already on `main`). A failed run's archive commit is
   cherry-picked onto `main` so every run is on record.
4. **Verify** on the run branch: `git status --short` empty; `tsc --noEmit`, `eslint src
   tests`, `vitest run`, `npm run build` green; the written code and tests read once
   against §2.2 and the record; defects recorded, never fixed by hand.
   **Operator 08.10 (correcting 07.10): no EXTERNAL review passes (Fable) until further notice** — the session's
   own read of the written code above stays; the goal is to close all phases through P14.
5. **Record**: §11 of the TASK and the row of `docs/MEASURE.md` (builder column "V2"), one
   commit on the run branch with the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
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
- **Paying a debt on a V2 deck**: `/morph-agent-run` does not read V2 decks yet; on an emergency
  stop the session stops and the operator decides the debt.
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
