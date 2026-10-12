# P50 — probe defects stop a run by name (issue #50)

## 1. Why this

MorphStudio P9a, two goose + GLM-5.3 sessions (issue #50): every red of both first runs came from the
orchestrator's probes, not from card code. F1/F3 (this phase): a probe file that does not compile passes the stub
check as "red at probe" and the run blames the owner card and retries it to the cap — the retry then teaches the
code card to declare the probe's test symbols in production code (`token-lookup.r1.v1` declared `adaH` in
`users/token.go`), reddening a second card. Numbers in the issue: session 2 8/8 red → 64 min, $0.322 executor
(you-probe-caused), vs Claude Opus 8/8 first run, 18.5 min, $0.138.

## 2. Contract

### 2.1. Input shapes

- A probe file is named by the record (Probe Lines, cards): basename ends `_probe_test.go` (Go, in its package) or
  `.probe.ts` (TypeScript, `probe/<card>/`), or a path segment `probe`. Nothing else changes its shape.
- `tests/fixtures/cards/probeLogs.json` (new, one object): `go`, `ts`, `none`, `absolute` → a log each (the `go`
  lines are issue #50's verbatim). Probe Lines examples 1–2 name what each Function returns on it, counted: `go` 2
  lines, `ts` 1 line, `none` 0, `absolute` 0.
- `tests/fixtures/gate/playGate.json`: rows gain `probeBreaks` (an empty list where no probe line), and the new case
  `probe` (2 rows, the counts and values of Play Gate example 4).
- `tests/fixtures/gate/gateCommand.json`: rows gain `probeBreaks`, and the new case `probe` (code 2, 2 rows, 1 build
  note, 1 error — Gate Command example 6). `tests/fixtures/gate/gateCommand.p22b.json`: rows gain `probeBreaks`.

### 2.2. Output shapes

- `Blame` is unchanged. Run Transaction: a red card whose log holds a probe line (Probe Lines, cards, with
  TREE_PROFILES' fileLines) stops the run: `stop = "probe does not build: <lines joined ', '>"`, rollback, no retry,
  the line never in a retry prompt; the card's rollback reason `"probe does not build"`.
- Play Row gains `probeBreaks: string[]` after `failures` (written empty, never omitted); the stub step's `ok`
  requires `probeBreaks` empty; Gate Command names each line: `"<phase> <card>: probe does not build: <line>"`,
  code 2.

### 2.3. Names

`src/cards/probe.ts` (isProbeFile, probeLines), `src/runloop/transaction.ts` (the stop, the reason),
`src/gate/playGate.ts` (the split, the row), `src/gate/gateCommand.ts` (the error). Judges:
`tests/cards/probe.examples.test.ts` (new), `tests/runloop/transaction.p50.examples.test.ts` (new),
`tests/gate/playGate.examples.test.ts` and `tests/gate/gateCommand.examples.test.ts` (patched: `probeBreaks` in the
compared rows, one new test each).

### 2.4. What must not break

Stub Verdict (gate) byte for byte; Blame Log's Blame (cards) unchanged; the outside stop, the unattributed stop
(P24c), the retry cap (P24), neighbour blame (P28) and every existing example of the four Functions as recorded;
`tests/gate/gateCommand.p22b.examples.test.ts` stays green on the fixture edit alone (its rows' `probeBreaks` []).

## 3. Acceptance

`morph plan --checks decks/p50/checks.json --only …` (a transaction). Probes `decks/p50/parts/*.probe.ts`, stubs
`decks/p50/_stubs/`.

## 4. Constraints

NodeNext, no `any`, stubs from `tests/helpers.ts`, tests write only under tmp roots. cards: pure, node:path only.
gate: no clock (deps.now), no env (deps.env), no child process of its own. runloop-subset: as recorded.

## 7. Out of scope

- Item F2 of the issue (probe identifiers colliding with judge helper names): a reserved probe identifier prefix, or
  a deck-check report of a probe identifier that also appears in a card's map instruction — a new Function and a
  naming contract of its own; next phase.
- The issue's "better still" of F1: `deck check` building each code card's probe alone against the stubbed package
  (the Go profile's tree build never copies the probe into the package today) — a Tree Profiles design of its own;
  next phase.
- Python (no built acceptances), the `--mutants` gate, `morph accept`, chain timing, RunReport key order.

## 9. Pre-registration

8 cards (4 code, 4 judges), 3 generations, transaction. First red expected: run-transaction's probe (the stop key
is absent on the stub) or play-gate's (the row lacks probeBreaks). Cap $5.