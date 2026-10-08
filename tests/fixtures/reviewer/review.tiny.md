# Review b0..HEAD

9 findings: obligation 1, envelope 2, scope 3, guardrail 2, mutation 1.

## Changed files (5)

| file | status | lines | written by | scope |
|---|---|---|---|---|
| .morph/runs/r7/report.json | added | +1 -0 | — | — |
| README.md | modified | +1 -1 | — | context |
| src/shop/addTax.ts | added | +3 -0 | add-tax | target |
| tests/shop/addTax.examples.test.ts | added | +2 -0 | add-tax-judge.r1 | outside |
| tests/shop/old.test.ts | modified | +1 -1 | — | outside |

## Obligations (1 Functions, 3 examples, 1 missing)

| Function | touched by | examples | missing |
|---|---|---|---|
| shop · Add Tax | card add-tax-judge, card add-tax, file src/shop/addTax.ts, file tests/shop/addTax.examples.test.ts | 3 | 2 |

## Guardrails

| guardrail | files | findings |
|---|---|---|
| Tests Kept | 1 | 1 |
| No New Skips | 2 | 1 |

## Mutants (1 of 2 killed)

| at | rule | result |
|---|---|---|
| src/shop/addTax.ts:2 | > → >= | killed |
| src/shop/addTax.ts:2 | + → - | survived |

## Findings

### F1 · obligation · record: shop · Add Tax · example 2

- path: tests/shop/addTax.examples.test.ts
- EXPECTED: a test named "Add Tax example 2"
- GOT: no test title at head starts with it

### F2 · envelope · primer: ownership

- path: README.md
- EXPECTED: written by a Morph card of the range
- GOT: changed outside every card's targets; no Morph card ever wrote it

### F3 · envelope · primer: ownership

- path: tests/shop/old.test.ts
- EXPECTED: written by a Morph card of the range
- GOT: changed outside every card's targets; no Morph card ever wrote it

### F4 · scope · scout 20261009-101500-0badc0de

- path: README.md
- EXPECTED: a target of the scout session (src/shop/addTax.ts)
- GOT: changed, though the scout named it as context

### F5 · scope · scout 20261009-101500-0badc0de

- path: tests/shop/addTax.examples.test.ts
- EXPECTED: a target of the scout session (src/shop/addTax.ts)
- GOT: changed, though the scout did not name it

### F6 · scope · scout 20261009-101500-0badc0de

- path: tests/shop/old.test.ts
- EXPECTED: a target of the scout session (src/shop/addTax.ts)
- GOT: changed, though the scout did not name it

### F7 · guardrail · guardrail Tests Kept

- path: tests/shop/old.test.ts
- EXPECTED: the test "gone" kept
- GOT: no test of that name at head

### F8 · guardrail · guardrail No New Skips

- path: tests/shop/old.test.ts
- EXPECTED: at most 0 skipped or focused tests, as at base
- GOT: 1 at head

### F9 · mutation · mutation src/shop/addTax.ts:2

- path: src/shop/addTax.ts
- EXPECTED: a test fails on + → - at line 2
- GOT: every test passed
