# Autonomous mode

The regulation that replaces the operator at every point where a human would answer during a phase. The operator
confirms it before the first autonomous phase and can change any line; the session reads it at the start of every phase.

## State at handoff

**Next: <phase> (`docs/PLAN.md` row <phase>, issue #<n> if any).** After it: <the next phase, or a stop for the
operator>. Running total $0 of the stretch cap. Processor `<processor>` (maxTokens ×<factor> when it thinks before it
writes); fallback `<processor>`.

Known limits carried: <none yet>.

Lessons for the next preparations: default code targets add a test file (give a smoke cap or code-only targets); a new
file needs `"intent": "generate"` in the map; a new code folder needs its layer in `decks/tools/layers.json`; size a
judge from its expected answer (≥ 28 000 for a ~20 KB answer, before any processor factor); vary every constant the code
must not hard-code across the examples; every mutant run under a 120 s timeout; kill leftover watchers and workers of the
scratch tree.

The session rewrites this section at the end of every phase.

## Machine

- The repository (`main`, origin pushed only by fast-forward). The `morph` binary: `npm run build` in Morph's package,
  then a COPY of its `dist/` (with `node_modules` linked and `templates/` beside it) in `/tmp/morph-bin-<phase>/` runs the
  deck, so a card that rebuilds cannot replace the running binary.
- Processor environment: `MORPH_PROCESSOR_<P>_<KEY>` for KEY in TYPE, API_KEY, MODEL, ROUTE, CONCURRENCY, PROVIDER_ORDER,
  REASONING_MAX_TOKENS (only the keys that are set), exported in a subshell from a file only the operator writes
  (mode 600), never printed.
- Anything longer than a minute runs under `nohup`/`tmux` with a log file; the session must survive an SSH drop.

## One phase, one session

Every phase gets a fresh session: the memory of a phase is in the repository (record, TASK §11, MEASURE, DECISIONS,
this file), never in the session's context. The session works exactly the phase "State at handoff" names, records it,
merges it, rewrites "State at handoff" for the next phase and pushes. Then it ends in one of two ways:

- **the next phase is queued** (named in "State at handoff" with no stop before it): post 🔀, `touch
  ~/.morph-phase-done` and stop. The watchdog (cron, 10 min) kills the session and starts a fresh one;
- **a stop** (a smoke stop, an emergency stop, a gate stop, no next phase): post the stop, `touch ~/.morph-wait-operator`
  and stop. The watchdog never nudges it; the operator restarts it with `tools/vps-start.sh` after a check.

## The cycle of one phase

1. **Prepare** (an orchestrator agent with a fresh context): the spec by `docs/TASK_TEMPLATE.md`; the record and the map
   entries (a new file needs `"intent": "generate"`); fixtures; `decks/<phase>/checks.json` and the probes
   `decks/<phase>/parts/<card>.probe.*`; the cut:
   `morph plan --root . --spec contour.yaml --map morph-map.json --component <C>… --judge --checks
   decks/<phase>/checks.json --out decks/<phase>/deck.json`. When the cut holds cards outside the phase, keep the phase's
   cards with a short filter script over the deck file, committed beside the deck. For a processor that thinks before it
   writes, every card's maxTokens ×3 after the cut: `python3 decks/tools/scale_tokens.py decks/<phase>/deck.json 3`. Then
   `morph deck check --root . --deck decks/<phase>/deck.json`.
   Every acceptance is run red **per example** on stubs in a scratch worktree, with a readable line. Mutants: only on
   the record's examples and the contracts the phase changes, **at most 30 per phase and at most 20 min in total**,
   every mutant run under a 120 s timeout (a timeout counts as killed); survivors beyond the cap go to
   `docs/DECISIONS.md` as a known risk naming the file and the mutation. The data and the deck are committed on `main`.
2. **Gate without the operator.** The run starts by itself only when ALL hold: `morph plan` exit 0; `morph deck check`
   errors 0; every probe red per example with a readable line on the stubs; every acceptance chain under 250 s; the
   mutation cap kept; forecast ≤ $1 for the phase; no slice over 200 KB. Otherwise the phase stops with a report in
   `docs/MEASURE.md` (a row "stopped at gate: <reason>"), touches `~/.morph-wait-operator` and stops.
3. **Run**: from the repository root, the binary copy:
   `node /tmp/morph-bin-<phase>/dist/cli.js run --root . --deck decks/<phase>/deck.json --processor <processor> --deadline
   2400`, its stdout (the Run Document) to a file under /tmp. The run opens `morph/<runId>`, commits each accepted card
   with its trailers and archives `.morph/runs/<runId>/`. The tree is not touched while the run is in flight. A re-run of
   failed cards uses a deck file of those cards only. A failed run's archive commit is cherry-picked onto `main`.
4. **Verify** on the run branch: `git status --short` empty; the project's parse, lint, full test suite and build green;
   the written code and tests read once against §2.2 and the record; defects recorded, never fixed by hand.
5. **Record**: §11 of the TASK and the row of `docs/MEASURE.md`, one commit on the run branch.
6. **Merge and push**: `git checkout main && git merge --ff-only morph/<run-id> && git push origin main`. Fast-forward
   only; a non-ff state stops the session with a report.

## Dependencies

- Only the libraries `docs/PLAN.md` "Dependencies" lists, approved by the operator with the plan, are declared in
  `contour.yaml` (`System.dependencies`, exact versions) and named by a Component's `uses`. The session never adds,
  upgrades or removes one on its own: a card that needs another library is a stop for the operator.
- The scaffold phase installs them once with the network (Go: vendored and committed; TypeScript: `package-lock.json`
  committed, `npm ci`; Python: a venv from a pinned requirements file). Every later acceptance is offline: Go builds with
  `GOFLAGS=-mod=vendor GOPROXY=off` (chosen by `morph plan` when `vendor/modules.txt` exists), TypeScript from the
  installed `node_modules`, Python from the venv. A deck cut before the vendoring is re-cut after it.
- Each dependency's API digest `docs/deps/<name>.md` (2–5 KB, signatures + one example, from the library's own docs and
  types, values measured) is data; it rides in the slice of every card of a Component that uses it.

## Decisions the session makes alone

- **Gaps in the record** (a shape, an order, a message the record does not pin): decided in §2.2 of the phase's spec AND
  appended to `docs/DECISIONS.md`, one line each (phase, Function, decision, why). The record itself is edited only when
  an example is wrong or missing, with the change named in DECISIONS.
- **Fixtures**: by `docs/TASK_TEMPLATE.md` §2.1; recorded answers of a real service may be used after cleaning.
- **Issues labelled for a phase**: before preparing a phase, read the open issues labelled `<phase>-<component>` and
  build them into that Component's record; the phase's DECISIONS lines name the issues they answer.

## Failure

Every failed card gets one class, decided from the run log and the attempt files, written as a tag in its DECISIONS line
and in the MEASURE row:

| Class | Sign | Fix, by the session alone |
|---|---|---|
| data | the answer is whole; the acceptance is red on logic, types or the guard | ONE re-cut: the spec wording or the fixtures, never the card instruction |
| budget | the answer is cut at `max_tokens` (finish reason length, an unclosed fence) | ONE raise of that card's `max_tokens` in `morph-map.json` ×1.5–2, ceiling 32 000, then a re-run of that card |
| environment | npm, network, provider error, `exit null` timeouts on a green log | no re-cut; one plain re-run later, then stop the phase |
| code defect | the judge finds a real bug in accepted code | ONE re-cut of the code card |

- A phase with failed cards after the run: ONE fix of the failed cards by their class, merged if green.
- **Emergency stop**: a card still red after its one fix stops the whole autonomous stretch — no next phase, no merge
  beyond the green code already merged. Debts are not carried forward. Before stopping, the session pays the debt once:
  1. `morph card --root . --deck <deck> --id <card> --md` — the debt brief (`.markdown` of the JSON document: the
     targets, the instruction, the acceptance, the context slice as it is now, the last run's reason, log and answers);
  2. a stronger model (the payer agent) gets that brief and writes ONLY the card's targets;
  3. `morph accept --root . --deck <deck> --id <card> --model <payer model> --commit` — the card's own acceptance on the
     current tree; green commits only the targets with `Morph-Card`, `Morph-Model`, `Morph-Acceptance-Exit: 0`,
     `Morph-Debt: true`; a change outside the targets or a red acceptance refuses;
  4. green → `tools/tg.sh debt` 💸, a "debt" row in `docs/MEASURE.md`, the data lesson in DECISIONS, and the loop goes on;
     red → the emergency stop stands: open an issue (`gh issue create --label debt`: run ids, what was tried, the
     attempts' reasons verbatim, the code left unguarded), post "EMERGENCY STOP" with the card, the class and the issue,
     and stop for the operator.
  Cap: one paid debt per phase, ≤ 30 min.
- An environment red still red after its re-run: emergency stop with class `environment` (no debt applies; the operator
  fixes the environment).
- **Smoke stops**: after the phases `docs/PLAN.md` names, a live smoke of the product on a tiny project, then
  `tools/tg.sh smoke` 🧪 with the numbers, then STOP and wait; the session never resumes itself. A red smoke is an
  emergency stop.

## Money

- $<cap> per phase, forecast ≤ $1 at the gate.
- $<cap> for the whole autonomous stretch; the running total is kept in `docs/MEASURE.md`; reaching it stops the session.

## What never happens

- Code or test files written by hand.
- `contour.yaml` in a slice. The record's history in the record.
- A paid run on a deck that did not pass the gate above.
- A push of anything but `main` fast-forward; a force-push; a rewrite of history.
- Printing a secret.

## Observability

- The session runs in the tmux session `{{name}}`, started by `tools/vps-start.sh`; the operator attaches with
  `tools/vps-start.sh attach` (detach `Ctrl-b d`) or follows the log with `tools/vps-start.sh log`.
- `tools/tg.sh <kind> "<headline>" "<numbers>"` posts to the operator's Telegram channel (token and chat id only in
  `~/.config/morph/tg.env`, written by the operator, mode 600; a missing file is a silent no-op). Kinds: `start` 🚀 phase
  start; `gate` 🚦 gate passed (`stop` if not, with the reason); `run` 🏁 run green (written, $, minutes, burned
  variants); `fail` ❌ run with red cards; `merge` 🔀 merge and push done; `smoke` 🧪 a smoke stop; `stop` 🛑 any stop,
  the emergency stop included; `debt` 💸 a debt paid; `end` 🎉 the end of the stretch; `info` 💬 anything else. Example:
  `tools/tg.sh run "<phase> <component>: run green" "8/8 written · \$0.12 · 14 min · 0 burned"`.
- The watchdog (`tools/vps-watchdog.sh`, cron every 10 min) posts as `watchdog` 🐕; the Claude Code hooks in
  `.claude/settings.json` post `idle` 💤 on Stop and `ask` 🔔 on Notification, so an idle session is never silent.

## Order of the phases

By the record's Components, see `docs/PLAN.md`, section "Phases by the record".
