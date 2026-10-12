# P36 — primer reads the record (issue #47)

## 1. Why this

The primer is every phase's first read and never reads the record, so record-vs-code gaps surface after the cut, at
the gate or in a paid run. Measured on this repository before the phase: at 33ca65c (before P33) `plan` over all 28
Components prints 22 record warnings (all `produces` of a primitive type) and the tree holds 9 imports between `src/`
directories that no `uses`/`dependsOn` allows; at a35bb81 one warning is left (`primer/Render Primer: step produces
'string'`, removed by this phase's compaction commit) and `runloop` weighs 30 123 bytes, over the 30 000-byte rule.
None of it is visible in `.morph/primer.md`.

## 2. Contract

### 2.1. Input shapes

- The record and the map as `plan` loads them: contour `loadContour` / `loadMap` (Data Objects Contour Record,
  Contour Map). New Component **primer-record** (`src/primerRecord/`), Data Objects Record Inputs, Record Gaps, Code
  Text, Layer Gap, Record Section; the primer group stays ≤ 30 000 bytes (29 977 after this phase).
- Fixture project `tests/fixtures/primerRecord/repo/` (one directory tree, read in place by Record Section example 1):
  contour.yaml with 3 Components / 4 Functions (`units` with an unknown key `owner`, `report` with no language and a
  `uses: units` step, `heavy` with no Functions and 31 358 bytes), morph-map.json (no language; card `parse-line`
  targets `src/units/parse.ts`), a contract-3 guard, `src/units/{addCents,parse,money}.ts`,
  `src/report/renderReport.ts`, `src/index.ts`, a `.ts` under `decks/`. On it, with files = examples.json["Record
  Section 1"].given.files (10 paths) and owned = 3 paths: 2 not built (Format Total missing its file; Parse Line with
  no Morph-Card commit), 2 not recorded (`src/index.ts`, `src/units/money.ts`), 1 of 3 Components over the rule, 5
  warnings (1 from the loader, 1 no-language, 2 undefined step targets, 1 no examples), 1 layer gap
  `src/units → src/report (src/units/money.ts)`.
- `tests/fixtures/primerRecord/examples.json`: given/then of every example of the four new Functions (the literals
  with newlines live there, not in the record); `section1.md`: the exact section of the fixture project.
- Every expected value was measured by a spike of the rules (outside the tree) and checked against the fixture.

### 2.2. Output shapes

`.morph/primer.md` = Render Primer's text (unchanged, cut at 16 000 chars) + the section:
```
<empty line>
## Record vs code
<empty line>
- record: read: <C> Component(s), <F> Function(s) (contour.yaml, morph-map.json)
- recorded, not built (<n>): / none            items "  - <Component>/<Function>: missing <paths> | no Morph-Card commit"
- built, not recorded (<n>): / none            items "  - <path>"
- Component weight, heaviest first (<k> of <n> over 30000 bytes):   items "  - <name>: <bytes> bytes[ — over the rule]"
- record warnings (<n>): / none                items the warning text `plan` prints
- layer gaps (<n>): / none / not checked: <reason>    items "  - <from> → <to> (<file>)"
```
Each list shows 10 items then `  - … +<n> more`. No record → `- record: not read: <reason>` alone (`no contour.yaml`,
`no morph-map.json`, or the loader's first error line without a trailing `:`). The Primer Document keeps its keys;
`chars` counts the section (Primer Command example 3: 6 108 → 6 164; primer3.md and primer5.md end with the
not-read line).

### 2.3. Names

`src/primerRecord/recordGaps.ts` (recordGaps, codeFiles, componentWeights), `importGaps.ts`, `renderRecord.ts`
(RECORD_CAP 10, WEIGHT_RULE 30000), `recordSection.ts`; judges `tests/primerRecord/<name>.examples.test.ts`.
Primer Command (src/primer/primerCommand.ts) is patched in one expression.

### 2.4. What must not break

Render Primer, Read Runs, Read Story and their tests byte for byte; Primer Command examples 1, 2, 4, 6–9; the full
suite except the goldens this phase changes (primer3.md, primer5.md, command.json chars).

## 3. Acceptance

Built by `morph plan --checks decks/p36/checks.json --only …` (a transaction): tsc, eslint, guard (layers and
Guardrails from the record: primerRecord may import contour, language, rules; primer may import primerRecord),
probe, full, frozen, untracked. Probes `decks/p36/parts/*.probe.ts`, stubs `decks/p36/_stubs/`.

## 4. Constraints

NodeNext, no `any`, stubs from `tests/helpers.ts`, tests write only under tmp roots. Record Gaps, Import Gaps,
Render Record: No Clock; the Component: No Shell, No Network, No Env, No Process.

## 7. Out of scope

- scout and gate do not read the record (issue #47).
- No new key in the Primer Document; the section is not summarised in stdout.
- Python imports (layer gaps "not checked: no import rule for python"); dynamic `import()` in TypeScript.
- Fixing what the section finds in MorphV2's own record (runloop over 30 000 bytes) — a later data commit.
- The issue's numbers "16 undefined targets" and "9 missing uses edges": measured 22 and 9 at 33ca65c; the smoke
  checks the measured numbers (the 9 need a contract ≥ 2 guard, which 33ca65c did not have: the smoke copies today's).

## 9. Pre-registration

9 cards (4 code + 4 judges new, primer-command patched), 3 generations. First red expected: a judge's type narrowing
of examples.json, or componentWeights' end-of-groups rule. Cap $5.
