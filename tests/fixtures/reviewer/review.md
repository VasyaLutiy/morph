# Review 4f2a9c1..morph/20261009-101500

5 findings: obligation 1, envelope 1, scope 1, guardrail 1, mutation 1.

## Changed files (2)

| file | status | lines | written by | scope |
|---|---|---|---|---|
| src/shop/addTax.ts | modified | +7 -2 | add-tax | target |
| docs/a\|b.md | added | binary | — | outside |

## Obligations (1 Functions, 3 examples, 1 missing)

| Function | touched by | examples | missing |
|---|---|---|---|
| shop · Add Tax | card add-tax, file src/shop/addTax.ts | 3 | 2 |

## Guardrails

| guardrail | files | findings |
|---|---|---|
| Tests Kept | 1 | 0 |
| No New Skips | 1 | 1 |

## Mutants (1 of 2 killed)

| at | rule | result |
|---|---|---|
| src/shop/addTax.ts:4 | === → !== | killed |
| src/shop/addTax.ts:9 | + → - | survived |

## Findings

### F1 · obligation · record: shop · Add Tax · example 2

- path: tests/shop/addTax.examples.test.ts
- EXPECTED: a test named "Add Tax example 2"
- GOT: no test title at head starts with it

### F2 · envelope · primer: ownership

- path: docs/a|b.md
- EXPECTED: written by a Morph card of the range
- GOT: changed outside every card's targets; no Morph card ever wrote it

### F3 · scope · scout s1

- path: docs/a|b.md
- EXPECTED: a target of the scout session (src/shop/addTax.ts)
- GOT: changed, though the scout did not name it

### F4 · guardrail · guardrail No New Skips

- path: tests/shop/addTax.test.ts
- EXPECTED: at most 0 skipped or focused tests, as at base
- GOT: 1 at head

### F5 · mutation · mutation src/shop/addTax.ts:9

- path: src/shop/addTax.ts
- EXPECTED: a test fails on + → - at line 9
- GOT: every test passed
