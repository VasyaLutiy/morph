# Task template of MorphV2 (`docs/TASK_P<N>_<component>.md`)

> The spec of one phase. The old Morph's `mrph/documentation/TASK_TEMPLATE.md` is the
> ancestor and is frozen with it; this file holds the same sections and the rules this
> repository paid for. Every rule below names the phase that paid for it. The card
> breakdown is never written here: that is the orchestrator's deck, cut from the record
> and `morph-map.json`.

## 1. Why this

The motive with numbers (what reddens, how often, measured where). No number, no section.

## 2. Contract

### 2.1. INPUT data shapes the code must build

For every shape the code or a test must **construct or parse**: what it looks like and
which module or file defines it; that module is in the slice of every card that builds it.

**Fixtures are described by type, not by name** (P1 → P1b, 06.10: five of five judge
defects of P1 and one more found at the re-cut traced to this line; fixing it alone,
with instructions and acceptances byte-identical, made both judges pass):

- Every fixture §2.1 names is described by the **type the Function takes** — one object
  or an array, text or parsed, one file or a tree — and by **what each Function returns
  on it, counted** ("three hazards: write-write a,b; read-write c,a; read-write c,b").
- A file is called an example's input **only if it is exactly that input**. Otherwise
  §2.1 says which element of which file holds the example's `given` literal, or that the
  example has no file and its literal lives in the record (quote the address:
  Component, Function, example number).
- Every count and every illustration in §2.1 and §2.2 is **checked against the code or a
  spike before the gate**; an illustration that contradicts its own table is a defect of
  the spec, not of the executor.
- Text an environment can change (a `SyntaxError` message of Node, a locale, a path
  separator) is pinned by prefix or by rule, never verbatim (P1b, one burned variant).

This class of defect is not about the language: it is the gap between the record's
example literals and the fixture files, which only the spec bridges. It did not show on
Python decks because their examples went into `then` whole and the judges read no fixtures.

**A judge's setup across Components** (P5 debt, 06.10: `process-generation-judge` red on
glm53 in three runs with correct code under judgement, 0 defects; Fable 5.1 passed at once
because it read the neighbouring modules, which glm never sees outside its slice; VasyaLutiy/morph#2):

- **Preconditions of the callees.** When the judged Function calls Functions of other
  Components, §2.1 lists every fact a test's setup depends on, as "<Component> · <fact> ·
  what happens without it" (P5: the compiler rejects a missing slice file before the stale
  check fires, so the stale example must create the shared file before the generation).
  Each example whose setup needs such a fact cites it by its line.
- **Distinct markers.** Strings a test or an acceptance looks for (best-of-two variants,
  sentinel file contents, log lines) are distinct and none is a substring of another
  (P5: `MARK`/`NOMARK`; the rollback keeps the file the acceptance greps).
- **A harness skeleton, not a prohibition list.** A judge whose setup builds more than a
  config literal (transport, commit hook, clock, answer writer, tree) gets a skeleton of
  ≤ 10 lines in §2.1, built only from `tests/helpers.ts` and checked by the probe; the
  judge's map instruction points to it. Prohibitions in the instruction did not prevent a
  single P5 red.
- **Output budget from the answer.** The judge's `max_tokens` in `morph-map.json` is sized
  from the expected file (code 12 000, judges 24 000, the heaviest judges 28 000; the judge
  with the most examples ≥ 20 000; P5 truncated three times at 13 500).

The real fix is the V2 planner (contracts and preconditions of callees in a judge's slice,
the skeleton generated from the helpers): issue #3, label `P10-planner`. Until P10 the
spec carries it.

### 2.2. OUTPUT data shapes

The exact shape of every result: every union as literals, every message text pinned or
pinned by prefix, every ordering rule stated, every default stated. Where a shape already
exists in the tree, reference it; no second serialisation.

### 2.3. Names

Modules under `src/<component>/` (camelCase files), exported functions and types, the
test files: `tests/<component>/<name>.test.ts` (the author's smoke test, ≤ 5 tests) and
`tests/<component>/<name>.examples.test.ts` (the judge's, one `test` per record example,
in example order, named "<Function> example <N>: <what>").

### 2.4. What must not break

The files no card of this phase writes (scaffold, data, earlier components), byte for
byte; the test count that stays green.

## 3. Acceptance

The steps of `decks/tools/build.py` for this phase, narrow to broad, each printing a
readable line on failure: per-card `tsconfig` (P1: `tsc` reads the whole project, so a
sibling's broken file in the same generation reddens everyone; the builder excludes the
targets of the other cards of the generation — neighbour-red 0 of 8 after it) → eslint on
the card's own files → `guard.mjs` (layers, no `any`, test-file rules, example literals
for judges) → probe (values **and** types, type-checked with the project) → own test →
full `vitest run` → frozen → untracked. Judge bounds are derived: min = examples,
max = examples + 12. The whole chain is timed on a dry tree, limit 300 s.

## 4. Constraints

The project ones every phase repeats: NodeNext (`.js` in relative imports, `import type`);
no `any`; the Node typings carry no DOM globals (P0: 3 of 4 burned variants); stubs from
`tests/helpers.ts` only; a test writes only under `tmpRoot()`; the pure layers read no
clock, randomness or environment; a card's smoke test is ≤ 5 `toBe` checks; a judge
writes only its test file. Plus the phase's own.

## 7. Out of scope

An explicit list, or the deck sprawls; the later phase that owns each item.

## 8. How to run

```
python3 decks/tools/build.py p<N>
cd /home/john/Documents/Work2026/MorphProject/morph-lab
venv/bin/mrph deck clear --root <repo>; venv/bin/mrph deck reset --root <repo>
venv/bin/mrph plan --spec <repo>/contour.yaml --map <repo>/morph-map.json --component <C> --judge --root <repo>        # dry
venv/bin/mrph plan ... --add && venv/bin/mrph deck check --root <repo>                                               # errors 0
venv/bin/mrph run --root <repo> --processor glm53                                                                     # on the operator's word
```

`mrph` reads `.env` from the current directory: run it from `morph-lab`, never from the repo.

## 9. Pre-registration

Cards that regenerate, the first red you expect, the bill (cap $5 per phase).

## 10. What to record

The row of `docs/MEASURE.md` and §11: attempts, first red per burned variant,
tsc-first-red, neighbour-red, judge defects (judge red on correct code), guard rejections,
lines by hand, hazards, max slice bytes, minutes, $.

## 11. Actual

Filled after the run; a re-cut gets its own sub-section with every spec change before/after.

## Spec author checklist before the gate

- Every fixture named by the type the Function takes and by its counted result (§2.1).
- Every illustration checked against the table it illustrates (§2.2).
- Every message pinned exactly or by prefix; nothing environment-dependent verbatim.
- Every judge that calls other Components: their preconditions listed and cited, markers
  distinct, a harness skeleton when the setup is more than a literal, `max_tokens` sized
  from the expected answer (§2.1, P5 debt).
- Every slice path exists on disk at plan time; `contour.yaml` is in no slice.
- Dry `plan --spec` exit 0; `deck check` errors 0; every acceptance red per example on
  stubs in a scratch worktree; chain under 250 s.
