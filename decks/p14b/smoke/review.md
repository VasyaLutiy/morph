# Review b1..HEAD

5 findings: obligation 0, envelope 0, scope 3, guardrail 0, mutation 2.

## Changed files (12)

| file | status | lines | written by | scope |
|---|---|---|---|---|
| .morph/runs/20261008-060944/answers/clamp-percent-judge.v1.answer.txt | added | +16 -0 | — | — |
| .morph/runs/20261008-060944/answers/clamp-percent.v1.answer.txt | added | +12 -0 | — | — |
| .morph/runs/20261008-060944/answers/clamp-value-judge.r1.v1.answer.txt | added | +18 -0 | — | — |
| .morph/runs/20261008-060944/answers/clamp-value-judge.v1.answer.txt | added | +18 -0 | — | — |
| .morph/runs/20261008-060944/answers/clamp-value.v1.answer.txt | added | +17 -0 | — | — |
| .morph/runs/20261008-060944/answers/lines.txt | added | +5 -0 | — | — |
| .morph/runs/20261008-060944/deck.json | added | +84 -0 | — | — |
| .morph/runs/20261008-060944/report.json | added | +134 -0 | — | — |
| src/calc/clampPercent.ts | added | +10 -0 | clamp-percent | target |
| src/calc/clampValue.ts | added | +15 -0 | clamp-value | context |
| tests/calc/clampPercent.examples.test.ts | added | +14 -0 | clamp-percent-judge | context |
| tests/calc/clampValue.examples.test.ts | added | +16 -0 | clamp-value-judge.r1 | outside |

## Obligations (2 Functions, 6 examples, 0 missing)

| Function | touched by | examples | missing |
|---|---|---|---|
| calc · Clamp Value | card clamp-value-judge, card clamp-value, file src/calc/clampValue.ts, file tests/calc/clampValue.examples.test.ts | 3 | — |
| calc · Clamp Percent | card clamp-percent-judge, card clamp-percent, file src/calc/clampPercent.ts, file tests/calc/clampPercent.examples.test.ts | 3 | — |

## Guardrails

| guardrail | files | findings |
|---|---|---|
| Tests Kept | 0 | 0 |
| No New Skips | 2 | 0 |

## Mutants (0 of 2 killed)

| at | rule | result |
|---|---|---|
| src/calc/clampValue.ts:8 | < → <= | survived |
| src/calc/clampValue.ts:11 | > → >= | survived |

## Findings

### F1 · scope · scout 20261008-061109-1f30a15b

- path: src/calc/clampValue.ts
- EXPECTED: a target of the scout session (src/calc/clampPercent.ts)
- GOT: changed, though the scout named it as context

### F2 · scope · scout 20261008-061109-1f30a15b

- path: tests/calc/clampPercent.examples.test.ts
- EXPECTED: a target of the scout session (src/calc/clampPercent.ts)
- GOT: changed, though the scout named it as context

### F3 · scope · scout 20261008-061109-1f30a15b

- path: tests/calc/clampValue.examples.test.ts
- EXPECTED: a target of the scout session (src/calc/clampPercent.ts)
- GOT: changed, though the scout did not name it

### F4 · mutation · mutation src/calc/clampValue.ts:8

- path: src/calc/clampValue.ts
- EXPECTED: a test fails on < → <= at line 8
- GOT: every test passed

### F5 · mutation · mutation src/calc/clampValue.ts:11

- path: src/calc/clampValue.ts
- EXPECTED: a test fails on > → >= at line 11
- GOT: every test passed
