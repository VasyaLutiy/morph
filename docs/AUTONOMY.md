# Autonomous mode (from P3 on, on the VPS)

The operator's decision of 06.10.2026: after P3 is prepared by three orchestrator models
and run, the session moves to the VPS and closes the remaining phases without a human at
the gate. This file is the regulation that replaces the operator at every point where a
human answered during P0–P2. The operator confirms it before the first autonomous phase
and can change any line; the session reads it at the start of every phase.

## State at handoff (07.10, afternoon)

P0–P10b1 merged; `main` = origin = VPS. **MorphV2 is the builder now**: P10a was run by the V2
binary (12/12), P10b1 was cut by `morph plan` and run by `morph run` (10/10, one run, no fix). The
first autonomous act is the PREPARATION of P10b2 (step 1 of the cycle below, V2 flow). Old `mrph`
stays only as a dry cross-check of the cut and as the fallback named in "Fallback".

## Machine

- User `morph` (not root: Claude Code refuses to skip permissions under root). Repo
  `/home/morph/MorphV2` (origin `https://github.com/VasyaLutiy/morph`, branch `main`).
- Old Morph: `/home/morph/MorphProject/mrph` (frozen, `main`), `/home/morph/MorphProject/morph-lab`
  with `venv/bin/mrph` and `.env` (mode 600; never printed). `mrph` reads `.env` from the
  current directory: every call runs from `/home/morph/MorphProject/morph-lab` with
  `--root /home/morph/MorphV2`. Processor `glm53`.
- MorphV2 binary: `npm run build` in the repo, then a COPY of `dist/` in `/tmp/v2bin-<phase>/`
  (with `node_modules` symlinked from the repo) runs the deck, so a card whose acceptance runs
  `npm run build` cannot replace the running binary. The processor env is
  `MORPH_PROCESSOR_glm53_<KEY>` = `MRPH_PROCESSOR_glm53_<KEY>` of `morph-lab/.env` for KEY in
  TYPE, API_KEY, MODEL, ROUTE, CONCURRENCY, PROVIDER_ORDER, REASONING_MAX_TOKENS, set by
  indirection in a subshell, never printed (recipe: `decks/p7/smoke/run.sh`).
- Node 22, npm, git (auth through `gh`), tmux. Anything longer than a minute runs under
  `nohup`/`tmux` with a log file; the session must survive an SSH drop.

## The cycle of one phase

1. **Prepare** (an orchestrator agent, fresh context, the brief in the form of P10a/P10b1):
   spec by `docs/TASK_TEMPLATE.md`, fixtures, map entries, probes, the phase's acceptances
   (`build.py p<N>` with `"locate": True, "full_report": True` until P10b2 lands; after it, the
   phase's `checks.json` and `morph plan --checks`, as P10b2 defines). **The cut is V2's**:
   `node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component <C>…
   --judge --out decks/<phase>/deck.json`. `morph plan` has no card filter yet: when the cut holds
   cards outside the phase, keep the phase's cards with a short filter over the deck file and
   commit the filtered deck. Then `node dist/cli.js deck check --root . --deck <deck>`; a dry
   `mrph plan --spec` on the same Components as a cross-check (same ids, dependsOn, generations,
   targets, slices, acceptances, max_tokens; instructions differ by the P10a design); every
   acceptance red per example on stubs in a scratch worktree; mutations killed; the data and the
   deck committed on `main`.
2. **Gate without the operator.** The run starts by itself only when ALL hold:
   `morph plan` exit 0; `morph deck check` errors 0; the mrph cross-check shows no difference
   but the instructions; every probe red per example with a readable line on the stubs; chain
   under 250 s; forecast ≤ $1 for the phase; no slice over 200 KB. Otherwise the phase stops with a report in `docs/MEASURE.md` (row with
   "stopped at gate: <reason>") and the session moves to the next phase whose dependencies
   are met.
3. **Run** (the session itself or a run agent): from the repo root, the binary copy
   `node /tmp/v2bin-<phase>/dist/cli.js run --root . --deck decks/<phase>/deck.json --processor
   glm53 --max-retry-batches 8 --deadline 2400` (`--max-retry-batches 8` until issue #3 C2 makes
   the retry budget per card); stdout (the Run Document) to a file under /tmp. The run opens
   `morph/<runId>`, commits each accepted card with trailers and archives `.morph/runs/<runId>/`.
   The tree is not touched while the run is in flight. A re-run of failed cards uses a deck file of
   those cards only (their dependencies are already on `main`). A failed run's archive commit is
   cherry-picked onto `main` so every run is on record.
4. **Verify** on the run branch: `git status --short` empty; `tsc --noEmit`, `eslint src
   tests`, `vitest run`, `npm run build` green; the written code and tests read once
   against §2.2 and the record; defects recorded, never fixed by hand.
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
