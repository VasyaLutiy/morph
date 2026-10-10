# Receipts: where each rule of morph-v2-orchestrator was paid for

One line per rule: the phase and date, and what it cost. The rule lives in `SKILL.md`; this
file is the receipt. Add a line whenever a rule is added or changed. Older receipts (mrph,
ETHSmartChecker 28.09–05.10: primer from disk, helper-name grep, ripple spike, judges by a new
file, AST guards, Contour never whole in a slice, file-ownership cut) are in
`MorphProject/mrph/.claude/skills/morph-orchestrator/references/lessons.md`.

Replays = MorphV2's own phases re-prepared under this scheme on 10.10 (P20–P21c), then P24,
P24c, P24b. PM = the MorphStudio PM's live phases P7b, P7c, P8a (10.10).

## Why the scheme

| fact | where |
|---|---|
| Prep 15 / 9.5 / 26 / 27 min vs ~30 / 87 / 74 / 75 under the heavy gate; orchestrator ≈ $14 vs $76 | replays P20, P21a, P21b, P21c, 10.10 |
| The heavy gate passed P21a; its live smoke still went red 0/8 | P21a original and replay, 09–10.10 |
| Old mrph gates approved unchecked; the gate is insurance, not a ritual | operator 10.10 |

## Rules

| rule | where | cost |
|---|---|---|
| §1.2 0 reads of MorphV2 `src/`/`dist/` | PM P7b, 10.10 (#17) | 8 of the first 35 tool calls went into MorphV2's source before `checks.json` could be written |
| §1.2 own phase may read `src/` | P24, 10.10 | the brief allowed it, the rule forbade it; operator: the rule was wrong |
| §1.3 departures recorded | PM P7b | `--deadline` raised 2400 → 4800 and counted as "the one fix" |
| §1.4 no hand edit of `deck.json` | PM, 10.10 | the PM's rule from P7b–P8a: working settings (effort, model) go through the config (#18), not the deck |
| Header cannot skip recon | PM P8a | prep 4 min with no recon at all |
| §2.2 toolchain against `go.mod` | PM, laptop | `/usr/bin/go` 1.22 vs 1.25 with `GOTOOLCHAIN=local`: every card red at build |
| §3.1 primer never during the run | PM P8a | `.morph/` written into the live tree dirtied the run's checkout; the agent had to move to a scratch copy |
| §3.3 one question per scout | P20 replay | a whole-issue question spent 30 of 30 calls, no answer |
| §3.4 seeded retry; rejected answer as a lead | P24, P24b, PM P7b, P8a | 3 of 4 phases: scout without an answer (budget burnt on `contour.yaml`); P24b's rejected answer named 4 of 6 targets |
| §4.2 split written where the operator reads first | P21a, P21b replays | nobody confirms a split at an auto gate |
| §4.3 30 KB per Component | PLAN; P24b, 10.10 | cli 31 277 B and runloop 30 123 B after P24b, over the rule unnoticed |
| §4.4 values measured, not recalled | P20 replay | one `acceptance: null` from memory: 6 attempts and a re-run, $0.24, 22 min |
| §4.5 `checks.json` + `_stubs/` required for `--only` | PM P7b (#17) | without `--checks` no transaction; without `_stubs/` `deck check` builds nothing |
| §4.6 re-cut probe from the previous phase | PM, 10.10 | the PM's rule from P7b/P7c: the proof per probe is red exactly on the new and changed examples |
| §4.7 judge lits verbatim; literal list and value types in the judge instruction | P21b replay, P24c; PM P7b | a concatenated path as a lit: 1 retry; P24c guard lits too strict: 1 retry; P7b: almost every red was a judge (missing lit, `int` vs `float64`, unused import, `undefined: context`), code passed its probes in every run |
| §5.2 `--only` forced; transaction named | P24, P24c, P24b | all three phases had to cut with `--only`; the old "not for new code" rule could not be kept |
| §6.1 patch stub = file + declarations | P21a, P21c replays | the bare current file stops at `tsc`, not per example |
| §6.3 `node_modules` as per-entry symlinks | P21a replay | a symlinked `node_modules` showed untracked; `.git/info/exclude` edited — shared with the repo |
| §8.1 deadline from the deck | PM P7b | a 7-generation transaction fit neither 2400 nor 4800 s |
| §8.3 no polling | PM P7b | 18 polls of 4–10 min, each rereading ~280k context: ≈ 4.9M tokens for nothing |
| §9.2 live smoke is part of the result | P21a replay | run 4/4 green, smoke 0/8 red |
| §9.2 forced conditions only in the smoke's deck copy | P21c replay | a red-once step prefixed to a judge to exercise the retry |
| §10.1 salvage from the archive first | PM P7b, 10.10 | five red runs, $3.7; then `accept --from-run --pick` built all 12 cards in 21 s for $0 |
| §10.1 at the "deck and report" commit | P24b | at the run's base the archive is untracked: every "files left" check red |
| §10.2 harness fix = environment = the one fix | P21c replay | ts-rename smoke red 0/4 on a missing `eslint.config.js` in the harness copy |
| §10.5 retries with `file:line` | PM P7b (#19) | the only way to see whether blame names the right card |
| §11.1 explicit paths only | PM | `commit -a` swept another agent's uncommitted record edit into public `main` |
| §12.6 minutes per round only | P24c (#20) | the run report has no per-card time yet |
