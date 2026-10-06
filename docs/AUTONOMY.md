# Autonomous mode (from P3 on, on the VPS)

The operator's decision of 06.10.2026: after P3 is prepared by three orchestrator models
and run, the session moves to the VPS and closes the remaining phases without a human at
the gate. This file is the regulation that replaces the operator at every point where a
human answered during P0–P2. The operator confirms it before the first autonomous phase
and can change any line; the session reads it at the start of every phase.

## State at handoff (06.10, evening)

P0–P2 merged. P3 (`acceptance`) is PREPARED and passed the gate on the laptop: the record's
Component is complete (14 examples), `docs/TASK_P3_acceptance.md`, fixtures, map entries, the
`p3` builder and probes are on `main`. The first autonomous act is therefore P3's RUN, not its
preparation: in `/home/morph/MorphV2` do `deck clear`, `deck reset`, `plan --spec … --component
acceptance --judge --add`, `deck check` (expect 8 cards, 0 errors), then steps 3–6 of the
cycle below with a fresh run agent (`morph-orch-opus55`). Every later phase starts at step 1.

## Machine

- User `morph` (not root: Claude Code refuses to skip permissions under root). Repo
  `/home/morph/MorphV2` (origin `https://github.com/VasyaLutiy/morph`, branch `main`).
- Old Morph: `/home/morph/MorphProject/mrph` (frozen, `main`), `/home/morph/MorphProject/morph-lab`
  with `venv/bin/mrph` and `.env` (mode 600; never printed). `mrph` reads `.env` from the
  current directory: every call runs from `/home/morph/MorphProject/morph-lab` with
  `--root /home/morph/MorphV2`. Processor `glm53`.
- Node 22, npm, git (auth through `gh`), tmux. Anything longer than a minute runs under
  `nohup`/`tmux` with a log file; the session must survive an SSH drop.

## The cycle of one phase

1. **Prepare** (an orchestrator agent, fresh context, the brief in the form of P1–P2): spec
   by `docs/TASK_TEMPLATE.md`, fixtures, map entries, probes, `build.py` builder; dry
   `plan --spec`; `deck clear`, `deck reset`, `plan --add`, `deck check`; every acceptance
   red per example on stubs in a scratch worktree; the data committed on `main`.
2. **Gate without the operator.** The run starts by itself only when ALL hold:
   dry `plan --spec` exit 0; `deck check` errors 0; every probe red per example with a
   readable line on the stubs; chain under 250 s; forecast ≤ $1 for the phase; no slice
   over 200 KB. Otherwise the phase stops with a report in `docs/MEASURE.md` (row with
   "stopped at gate: <reason>") and the session moves to the next phase whose dependencies
   are met.
3. **Run** (a run agent, fresh context): `mrph run … --processor glm53 --deadline 2400`;
   the tree is not touched while the run is in flight.
4. **Verify** on the run branch: `git status --short` empty; `tsc --noEmit`, `eslint src
   tests`, `vitest run`, `npm run build` green; the written code and tests read once
   against §2.2 and the record; defects recorded, never fixed by hand.
5. **Record**: §11 of the TASK and the row of `docs/MEASURE.md`, one commit on the run
   branch with the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
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
  `morph-orch-opus55` prepares and runs every phase; `morph-orch-opus48` takes every third
  phase (P5, P8, P11, P14) so the comparison continues. The agent's tokens, tool calls and
  minutes go into the "$ оркестр." column of `docs/MEASURE.md` as "<model> <tokens>/<calls>/<min>".

## Failure

- A phase with failed cards after the run: ONE re-cut of the failed cards only, by the
  P1b pattern (fix the spec's wording or fixtures, never the card instruction), merged if
  green. A second failure of the same cards: the phase stops, its debt is written into
  `docs/MEASURE.md` and `docs/DECISIONS.md`, the session goes on if later phases do not
  depend on the missing code; otherwise it stops.
- A red that comes from the environment (npm, network, provider error, `exit null`
  timeouts on a green log): stop the phase, do not retry in a loop, write the symptom.
- Two phases stopped in a row: the session stops and reports.

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
  no-op). The session posts at these milestones, one short message each, numbers included:
  phase start (what is being cut); gate result (go, or stopped with the reason); run result
  (written/failed, $, minutes, burned variants); merge and push done; any stop of the
  regulation; the end of the stretch with the totals.
- Claude Code hooks in `.claude/settings.json` post on `Stop` (the session stopped: finished
  or waiting for input, with its last message) and `Notification`; so an idle session is
  never silent.

## Order of the remaining phases

By the record's Components, see `docs/PLAN.md`, section "Фазы по записи (после P2)".
