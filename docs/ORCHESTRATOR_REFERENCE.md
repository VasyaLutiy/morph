# Orchestrator reference: the data of a V2 phase (issue #17)

What an orchestrator needs to prepare and run a phase with the MorphV2 binary without reading
`src/` or `dist/`. Facts are cited from the source they come from. `decks/tools/refcheck.mjs`
compares the marked parts of this file against the built binary, run it after `npm run build`:
`node decks/tools/refcheck.mjs` (exit 0 = this file agrees with `dist/`).

## 1. The files of a phase

```
contour.yaml, morph-map.json           the record and the map (every Function has `behavior:`)
decks/tools/guard.mjs                  required by `plan --checks` (from templates/<language>/decks/tools/)
decks/tools/firstdiff.mjs              required by `plan --checks` (the first-difference locator)
decks/<phase>/checks.json              what each card's acceptance is built from (§2)
decks/<phase>/parts/<id>.probe.ts      one probe per code card (Go: _<id>_probe_test.go) (§3)
decks/<phase>/_stubs/<target paths>    stubs of every target (§4); deck check builds them, gate plays them
decks/<phase>/deck.json                the cut: `morph plan … --out` (never edited by hand, except maxTokens ×3)
```
All of it is committed before `plan`, `deck check`, `gate` and `run`: they read the committed tree.

## 2. checks.json

**Acceptances are built only for TypeScript and Go.** For another language `plan --checks` stops
with "no acceptance builder for language '<id>' (only typescript, go)". A Python project uses
the map's own acceptances, so it cannot have a transaction (§5).

<!-- refcheck: root-keys -->
Root keys: `version`, `phase`, `parts`, `frozen`, `fullExclude`, `ownGit`, `cards`.
<!-- refcheck: card-keys -->
Card keys: `id`, `smoke`, `extra`, `files`.
<!-- refcheck: file-keys -->
File keys (a judge's test file): `file`, `min`, `max`, `lits`, `drop`, `new`.

| key | required | meaning |
|---|---|---|
| `version` | no | 1 if given |
| `phase` | yes | `^[A-Za-z0-9._-]+$`; names the snapshot dir `/tmp/morph/<id>-<phase>` |
| `parts` | no | the probes' dir; default `decks/<phase>/parts` |
| `frozen` | no | paths no card may change; default `contour.yaml, morph-map.json, docs, decks, tests/fixtures` |
| `fullExclude` | no | test files left out of every card's `== full` run (a judge file of this deck, a known red) |
| `ownGit` | no | true when the acceptance must check git state around the card (Morph's own repo) |
| `cards[]` | yes, non-empty | one entry per card that gets a built acceptance; a card of the deck NOT listed keeps the map's acceptance |
| `cards[].id` | yes | the card's customId; unique; must be in the deck |
| `cards[].smoke` | no | code card only: the cap of tests in the card's own test target (1..smoke); required exactly when the card targets a test file |
| `cards[].extra` | no | code card only: shell text inserted before `== full` |
| `cards[].files[]` | judge only | one per test file; the `file`s must equal the card's `targets`, same order |
| `files[].min`, `max` | yes | the test count the guard allows (min ≤ max) |
| `files[].lits` | no | strings the test file must contain (example names, fixture names, values) |
| `files[].new` | no | true for a new file; false = an existing file: every old test name must survive except those in `drop` |
| `files[].drop` | no | old test names the card may remove |

A card with `files` is a judge and takes no `smoke` or `extra`. A code card (no `files`) must
have a probe file (§3).

<!-- refcheck: example -->
```json
{
  "phase": "p22b",
  "ownGit": true,
  "frozen": ["contour.yaml", "morph-map.json", "docs", "decks", "tests/fixtures", "templates"],
  "fullExclude": ["tests/gate/identity.examples.test.ts"],
  "cards": [
    { "id": "check-identity" },
    { "id": "check-identity-judge", "files": [{ "file": "tests/gate/identity.examples.test.ts", "min": 3, "max": 9, "new": true,
      "lits": ["Check Identity example 1", "identity/corpus.json"] }] }
  ]
}
```
(Real: `decks/p22b/checks.json`.)

What a built acceptance runs, in order (the `== ` lines you read in a log). **Code card:** tsc, eslint on
the targets, `== guard` (layer rules on the code; the test cap if `smoke`), `== probe`, `== own`
(when it has a test target), `extra`, `== full`, frozen paths unchanged, no untracked files
left. **Judge:** tsc, eslint, `== guard <file>` per file (count and `lits`; names kept), `== own`,
`== full`, frozen, untracked.

## 3. Probes

`decks/<phase>/parts/<id>.probe.ts` (Go: `_<id>_probe_test.go`). It holds the record's examples
of the card's Function as tests, at the expected values. At acceptance time it runs from
`probe/<id>/` at the repo root, so imports are `../../src/…` and `../../tests/helpers.js`.
Name each test after its example ("Plan Command example 13: …"), so a red line names the
example. Rules that cost runs:
- the expected value is read off the code or the fixture it comes from, never written from
  memory (P20 replay 10.10: a wrong `acceptance: null` in one example cost 6 attempts);
- on the stubs every example goes red with a readable line, not a crash at import.

## 4. _stubs

`decks/<phase>/_stubs/` mirrors the targets' paths:
- a new code file: the typed exports, every body `throw new Error("stub <name> …")`;
- a patch target: the current file as it is;
- a judge's test file: one passing test (`test("stub", () => { expect(1).toBe(1); })`).
Real: `decks/p22b/_stubs/`. Every target needs its stub: a missing one is an error of
`deck check` (builds) and of `gate`.

## 5. The transaction

<!-- refcheck: mark -->
The mark is the acceptance's first line: `# morph: subset transaction`.

It is written by `morph plan … --checks <file> --only <ids>`, and only then: `--only` without
`--checks` keeps the map's acceptances as they are, unmarked (`src/cli/planCommand.ts`). When the mark is there, `morph run`
runs the deck as one transaction. Every card is written first. Then every acceptance runs on
the full tree, no file is hidden from siblings, and a red line is blamed on the owner of the
`file:line` it names. A red after the retries rolls the whole subset back. It is meant for a re-cut of code that is already on `main` (a rename across generations).
`--only` marks a cut of new code too (P22a, 09.10: one red judge rolled back 9 green cards),
so cut new code without `--only` when the deck holds only the phase's cards.

## 6. Commands and exit codes

All commands print one JSON document on stdout. The exit codes are shared: 0 ok, 2 refused
(DeckError, or errors found), 3 runtime fault, 4 usage (a flag or a file missing).

| command | does | exit |
|---|---|---|
| `morph plan --root . --spec contour.yaml --map morph-map.json --component <C>… --judge [--checks <f>] [--only <ids>] --out <deck>` | cuts the deck; with `--checks` builds acceptances | 0; 2 (record/map/checks invalid, acceptances not built); 4 (checks/guard/locator file not found) |
| `morph deck check --root . --deck <deck> [--slice-cap-bytes N]` | errors: write-write (two owners of a path), read-write (a slice reads a same-generation target: add dependsOn); warnings: oversized-slice (over the cap, default 500 000 B), unordered-read, implicit-read (empty slice); **with `_stubs/` beside the deck**: compiles each card's stub tree (tsc / go build+vet): a missing stub or a break naming a file outside the card is an error | 0 when errors 0, else 2 |
| `morph gate --root . --deck <deck> --stubs <dir> --refs <dir> [--mutants N]` | in a scratch clone of HEAD: every acceptance on stubs (red at its stage, no outside file), on references (green), chains ≤ 250 s, builds; `--mutants`: ≤ N mutants killed by the owner's acceptance, 20 min stop | 0; 1 only mutants survive/untried; 2 any other finding |
| `morph run --root . --deck <deck> --processor <P> --deadline <s>` | branch `morph/<runId>`, a commit per accepted card, archive `.morph/runs/<runId>/` | 0 all written; 1 a card not written; 2/4 refused; 3 fault or archive failed |
| `morph primer --root . --write` | `.morph/primer.md` (ownership, runs) | 0 |
| `morph scout --root . --issue <file> --processor <P> [--seed-file f] [--deadline s]` | `.morph/scout/<id>/scout.json` | 0 |

## 7. One phase, end to end (old-Morph scheme, README.md Morph-Orchestrator)

```bash
morph primer --root . --write                       # read .morph/primer.md
morph scout --root . --issue /tmp/<p>/issue.md --processor ds
# write: record/map edits, docs/TASK_<p>.md, fixtures, decks/<p>/checks.json, parts/*.probe.ts, _stubs/
git add -A && git commit -m "<p> data"
morph plan --root . --spec contour.yaml --map morph-map.json --component <C> --judge \
  --checks decks/<p>/checks.json [--only <ids>] --out decks/<p>/deck.json
python3 decks/tools/scale_tokens.py decks/<p>/deck.json 3   # processor ds
morph deck check --root . --deck decks/<p>/deck.json        # errors 0 (builds checked: _stubs present)
git add -A && git commit -m "<p> deck"
# stubs: each acceptance once on its stubs in a scratch worktree — red per example (README Morph-Orchestrator §5)
# optional, the full gate: morph gate --root . --deck decks/<p>/deck.json --stubs decks/<p>/_stubs --refs /tmp/<p>/refs
morph run --root . --deck decks/<p>/deck.json --processor ds --deadline 2400 > /tmp/<p>/run.json 2> /tmp/<p>/run.err
```
A red card: one fix by class, a re-cut with `--checks … --only <red ids>` into
`decks/<p>/deck-fix.json`, one re-run.
