# P33 — MorphV2 on its own record (issue #48)

## 1. Why this

MorphV2's own decks took their acceptance rules from a hand guard (`decks/tools/guard.mjs`: about 15 tables, no
`morph-guard-contract` line), not from the record. The record is the one source (E2, #41–#46); MorphV2 must eat its
own rule. #42's transition ledger items 4, 6 and 8 close here.

## 2. Contract

### 2.1. INPUT

- `contour.yaml` (data commit, measured with the template guard over every card of the record, 105 code cards green):
  - the 9 missing layer edges as `Component.dependsOn`: acceptance [compiler]; compiler, debt, git, planner [cards];
    processor, scout-session [cards, compiler];
  - the 22 `produces` steps of a primitive type dropped (they named no Data Object; `plan` warned on each);
  - canonical Guardrails on every Component; Function level where only some files of a shared directory keep the
    rule (git No Shell but Run Git; primer No Clock but Primer Command; scout and reviewer Pure);
  - cli split: Plan Command and Read Plan Checks → Component `cli-plan`; Main's step `{uses: cli-plan}`;
    processor's Read Registry behaviour reflowed; every Component ≤ 30 000 B except runloop (30 123 B before P33,
    untouched).
- `decks/tools/guard.mjs` = `templates/typescript/decks/tools/guard.mjs` byte for byte (contract 3).
- `tests/fixtures/rules/single/cases.json`: the TypeScript case gains No Shell and No Network records (its `main.ts`
  imports `node:child_process` and uses `fetch`); every `then` measured with the template guard.
- `tests/fixtures/cli/examples.json` "Plan Command 8" and `refs.json` restate the example on contract 3;
  `tests/fixtures/cli/p33.renderGuard.txt` holds the measured guard line of card `render`.

### 2.2. OUTPUT

Plan Command example 8 (record, cli-plan) on the repository: `plan` exit 0 with components planner, cli, cli-plan,
map `tests/fixtures/cli/p10.map.json`, checks `decks/p10/checks.json`; every card of `decks/p10/v2deck.json` is in
the cut; `proseOnly` = the three System Guardrails; card `render`'s acceptance holds the line of
`p33.renderGuard.txt` and the live guard text (contract 3).

### 2.4. What must not break

The full suite, tsc, eslint, build; the identity corpus (pinned commits, unchanged); every MorphV2 card's code green
under the record-driven guard.

## 3. Acceptance

The judge's built acceptance (`decks/p33/checks.json`). Before the deck: the full suite on the data commit is red in
exactly one test, `Plan Command example 8: the P10a deck byte for byte on the repository`.

## 4. Constraints

`src/` does not change. The template guard does not change.

## 7. Out of scope

- Go and Python guards, `decks/tools/goguard.mjs`, MorphStudio.
- "interfaces share one core" stays prose (DECISIONS P33).
- runloop's own compaction (over the cap before P33; its directory is governed through runloop-subset).
- The rules the hand tables held that no canonical name states (CONTOUR.md §8 item 5) — prose.
- A Morph change keying Component Guardrails by Component instead of directory (named in the report).
