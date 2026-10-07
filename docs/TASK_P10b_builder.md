# TASK_P10b1 — the acceptance builder in TypeScript (`src/builder/`)

> Phase P10b1 of `docs/PLAN.md` ("Фазы по записи (после P2)": P10b split into P10b1 and P10b2, DECISIONS
> "P10b · split"). New Component `builder` of `contour.yaml` (eight Functions: Wrap Script, Check Steps,
> Tree Steps, Probe Dir, Code Acceptance, Judge Acceptance, Read Checks, Build Acceptances; five Data
> Objects: Checks, Judge File, Checks Result, Card Context, Build Result). TypeScript under `src/builder/`,
> **pure**: no file system, no clock, no environment; of the Node modules only `node:path`. The deck is
> the first one **cut by V2** (`node dist/cli.js plan`) and run by the V2 binary; its own acceptances still
> come from `decks/tools/build.py p10b` through the map (the builder cannot build its own phase).
>
> Issue #3 (VasyaLutiy/morph), addendum of 07.10, A1–A10 and B1–B2, is answered here for the builder's
> functions; wiring them into `morph plan` and archiving `build.py` is P10b2.

## 1. Why this

- **`build.py` is 699 lines of hand-written Python** that writes every acceptance of every phase (99 + 12
  cards so far) and injects it into `morph-map.json`. Operator's decision 07.10 (issue #3): the V2 planner
  builds the acceptances in TypeScript; `build.py` is scaffolding to be archived like old `mrph`.
- **What it does is measured, not guessed.** A reference of this Component in a scratch worktree, fed with
  checks documents converted from `build.py`'s own `PHASES`, gave: P10a **12 / 12 acceptances byte for byte**
  (the deck file `decks/p10/v2deck.json`); P9c 7 / 7; P6–P9 every code card byte for byte (16 / 16) once
  `build.py`'s `locate` and `full_report` are on; the 17 single-file judges of P6–P9 differ in exactly the
  two intended lines of §2.2 "Intended differences".
- **B1/B2 paid for in P9b–P10a.** Three P9b retries were blind to "the file"/"a file" (the grep dropped
  `- Expected`); the P9 control run lost a probe-green answer to an unused import. In V2 the full failure
  report, the first difference and eslint's held verdict are the only form, not a phase switch.

PLAN: P10b1 = 10 cards (5 code, 5 judges), 5 generations, 23 record examples.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Card**, **Deck** — `src/cards/types.ts` (P1); `layerGenerations(deck: Deck): string[][]` of
  `src/cards/layer.ts` (a dependency outside the deck is ignored); `loadDeck(text)` of `src/cards/model.ts`
  (P1) reads a deck file in tests.
- **Language Profile** — `src/language/types.ts` (P8); `TYPESCRIPT`, `PYTHON`, `fillTemplate`
  (`profiles.ts`), `codeTargets`, `testTarget` (`paths.ts`). The builder takes from the profile
  `parseLine`, `lintLine` (`{files}`), `ownTestLine` (`{test}`): for typescript these are exactly
  `build.py`'s `node_modules/.bin/tsc --noEmit`, `node_modules/.bin/eslint {files}`,
  `node_modules/.bin/vitest run {test} --reporter=dot`.
- **A checks document** — JSON, the phase's knobs; `validateChecks` takes it parsed. The P10a one is
  `tests/fixtures/builder/p10.checks.json`, written from `build.py`'s `PHASES["p10"]`: 12 cards in the map's
  order (parse-command, parse-command-judge, render, cut-component, cut-judges, plan-spec, plan-command,
  render-judge, cut-component-judge, cut-judges-judge, plan-spec-judge, plan-command-judge), six of them
  judges by `files` (seven files), two `fullExclude` paths.

**Fixtures** (`tests/fixtures/builder/`, read with `fixture` / `fixtureJson` of `tests/helpers.ts`). Every
`.txt` text was written by `build.py`'s own functions (`heredoc`, `wrap`, `vt`, `frozen`, `untracked`,
`names_kept`, `own_git_*`, `probe_dir`, `code_acceptance`, `judge_files_acceptance`) with `locate` and
`full_report` on and the stand-in texts `"// guard\n"`, `"// firstdiff\n"`, `"// probe\n"`:

| file | type | what it is | used by |
|---|---|---|---|
| `wrap.txt` | text, no final newline, 7 lines | `wrapScript("c", "p1", ["src/a.ts", "Makefile"], "echo hi\n")` | Wrap Script 2 |
| `vitestStep.txt` | text, 1 line + newline | `vitestStep(TYPESCRIPT, "tests/a.test.ts")` | Check Steps 3 |
| `frozen.txt`, `untracked.txt` | text, 1 line + newline each | `frozenStep(["docs", "decks"])`, `untrackedStep(["src/a.ts", "src/b.ts"])` | Tree Steps 1 |
| `names.txt` | text, 2 lines + newline | the two namesKept calls of Tree Steps 2, joined | Tree Steps 2 |
| `ownGit.txt` | text, 2 lines + newline | `OWN_GIT_BEFORE + OWN_GIT_AFTER` | Tree Steps 3 |
| `probeDir.txt` | text, 33 lines + newline | Probe Dir 2 (example 3 = it minus its last 3 lines) | Probe Dir 2, 3 |
| `code1.txt`, `code2.txt` | text, no final newline | Code Acceptance 1, 2 | Code Acceptance |
| `judge1.txt`, `judge2.txt` | text, no final newline | Judge Acceptance 1, 2 (`judge2` with own git: `build.py`'s own pieces in its `judge_acceptance` order, since its files form has no own git) | Judge Acceptance |
| `p10.checks.json` | a checks document | the P10a phase (above) | Read Checks 2 |
| `p10.checks.typed.json` | JSON object, a Checks | its typed form, every default filled | Read Checks 2, Build Acceptances 1 |
| `badChecks.json` | a checks document | 21 problems | Read Checks 3 |
| `badChecks.problems.json` | JSON array of 21 strings | its problems in order | Read Checks 3 |
| `guard.p10.txt`, `firstdiff.p10.txt` | text | `decks/tools/guard.mjs` and `firstdiff.mjs` as P10a inlined them (copies: the live guard gains the builder layer in this phase) | Build Acceptances 1 |

Build Acceptances 1 also reads `decks/p10/v2deck.json` (the P10a deck V2 ran: 12 cards, acceptances by
`build.py p10`) with `loadDeck(fixture("../../decks/p10/v2deck.json"))` and the six P10a probes with
`fixture("../../decks/p10/parts/<id>.probe.ts")` for parse-command, render, cut-component, cut-judges,
plan-spec, plan-command. Every other example's literal is in the record (Component builder, the
Function's example `given`).

**What each judge imports** (copy only the lines your file uses; eslint rejects an unused import):

```ts
import { test, expect } from "vitest";
import { fixture, fixtureJson } from "../helpers.js";
import { TYPESCRIPT, PYTHON } from "../../src/language/profiles.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import type { CardContext, Checks, JudgeFile } from "../../src/builder/types.js";
import type { Card } from "../../src/cards/types.js";
import { loadDeck } from "../../src/cards/model.js";
```

A Card Context for Code / Judge Acceptance (the compose judge), and the Card and Checks literals for Build
Acceptances (its judge) are built with these helpers, verbatim, defaults overridden per example:

```ts
const ctx = (over: Partial<CardContext>): CardContext => ({
  id: "a", phase: "p1", targets: ["src/x/a.ts"], siblings: [], frozen: DEFAULT_FROZEN, fullExclude: [], ownGit: false,
  profile: TYPESCRIPT, guard: "// guard\n", firstdiff: "// firstdiff\n", ...over,
});
const card = (id: string, targets: string[], dependsOn: string[] = []): Card => ({
  customId: id, intent: "patch", targets, contextSlice: [], instruction: "x", acceptance: null, model: null,
  maxTokens: null, reasoning: null, variants: 1, dependsOn,
});
const checks = (cards: Checks["cards"]): Checks => ({
  version: 1, phase: "p1", parts: "decks/p1/parts", frozen: DEFAULT_FROZEN, fullExclude: [], ownGit: false, cards,
});
```

**A judge's setup across Components** (TASK_TEMPLATE §2.1):

- **F1** cards · `loadDeck(text)` returns `{ok: true, deck}` or `{ok: false, faults}`: narrow it (`if (!d.ok)
  throw …`) before `d.deck.cards`; the deck file of P10a has no `dependsOn` key on render (absent = `[]`).
- **F2** cards · `layerGenerations` runs on the members alone: in Build Acceptances 2, card c is not a member,
  so a, b are generation 0 and d (depends on a) generation 1 alone.
- **F3** language · `TYPESCRIPT` / `PYTHON` are the registry objects; a Card Context takes the object itself.
- **F4** Build Acceptances 2 expects each member's acceptance as `codeAcceptance(ctx(...), "// probe\n",
  null, null)` with the `ctx` helper above and `phase: "p1"`: the expected value is built by the same
  function the code under test calls (the compose card is a dependency, accepted before).

### 2.2. OUTPUT data shapes

**`src/builder/types.ts`** — exactly these exports (types only):

```ts
import type { Card } from "../cards/types.js";
import type { LanguageProfile } from "../language/types.js";

export interface JudgeFile { file: string; min: number; max: number; lits: string[]; drop: string[]; new: boolean }
export interface CheckCard { id: string; smoke: number | null; extra: string | null; files: JudgeFile[] | null }
export interface Checks {
  version: 1; phase: string; parts: string; frozen: string[]; fullExclude: string[]; ownGit: boolean;
  cards: CheckCard[];
}
export type ChecksResult = { ok: true; checks: Checks } | { ok: false; problems: string[] };
export interface CardContext {
  id: string; phase: string; targets: string[]; siblings: string[]; frozen: string[];
  fullExclude: string[]; ownGit: boolean; profile: LanguageProfile; guard: string; firstdiff: string;
}
export interface BuildTexts { guard: string; firstdiff: string; probes: Record<string, string> }
export interface BuildInput { cards: Card[]; checks: Checks; profile: LanguageProfile; texts: BuildTexts }
export type BuildResult = { ok: true; cards: Card[] } | { ok: false; errors: string[] };
```

**Signatures** (every list parameter `readonly string[]`; record Functions word for word):

| module | exports |
|---|---|
| `steps.ts` (Wrap Script, Check Steps, Tree Steps) | `heredoc(path: string, body: string, tag: string): string`; `snapshotLines(id: string, phase: string, targets: readonly string[]): string`; `wrapScript(id: string, phase: string, targets: readonly string[], body: string): string`; `tscStep(profile: LanguageProfile): string`; `eslintStep(profile: LanguageProfile, files: readonly string[]): string`; `ESLINT_VERDICT: string`; `vitestStep(profile: LanguageProfile, args: string): string`; `fullArgs(exclude: readonly string[]): string`; `frozenStep(paths: readonly string[]): string`; `untrackedStep(targets: readonly string[]): string`; `OWN_GIT_BEFORE: string`; `OWN_GIT_AFTER: string`; `namesKept(file: string, drop: readonly string[]): string` |
| `probeDir.ts` | `cardTsconfig(exclude: readonly string[]): string`; `vitestConfig(id: string): string`; `probeDir(id: string, guard: string, firstdiff: string, probe: string \| null, exclude: readonly string[]): string` |
| `compose.ts` (Code Acceptance, Judge Acceptance) | `litsJson(lits: readonly string[]): string`; `codeAcceptance(ctx: CardContext, probe: string, smoke: number \| null, extra: string \| null): string`; `judgeAcceptance(ctx: CardContext, files: readonly JudgeFile[]): string` |
| `readChecks.ts` | `DEFAULT_FROZEN: string[]`; `validateChecks(doc: unknown): ChecksResult` |
| `buildAcceptances.ts` | `HEREDOC_TAGS: readonly string[]`; `buildAcceptances(input: BuildInput): BuildResult` |

**Exact texts.** Every shell text of the record is `build.py`'s, byte for byte, and the fixtures hold them
whole; when the record and a fixture disagree, the fixture wins. In particular:

- `vitestStep`'s failure report, verbatim after `" > $P/vt.log 2>&1 || { "`: `if grep -q '^ FAIL '
  $P/vt.log; then awk '/^ FAIL /{p=1} p' $P/vt.log | grep -vE '^ +(Start at|Duration) ' | head -200; else
  tail -60 $P/vt.log; fi; node $P/firstdiff.mjs $P/vt.log; exit 1; }` + `"\n"`.
- `OWN_GIT_BEFORE` = `G0=$( (git symbolic-ref -q HEAD || true; git rev-parse HEAD; git for-each-ref
  --format='%(refname) %(objectname)') 2>&1)` + `"\n"`; `OWN_GIT_AFTER` = `echo '== own git'; G1=$( ` + the
  same parenthesised state + `; [ "$G0" = "$G1" ] || { echo "tests changed this repository's HEAD or
  refs:"; echo "before: $G0" | head -5; echo "after: $G1" | head -5; exit 1; }` + `"\n"` (one line each;
  `ownGit.txt` holds both).
- `namesKept` line: `echo '== names <file>'; git show HEAD:<file> | grep -oE '(test|it)\("[^"]+"' | sed -E
  's/^(test|it)\(//'<skip> > $P/names || true; while IFS= read -r n; do grep -qF "$n" <file> || { echo "test
  removed: $n"; exit 1; }; done < $P/names` + `"\n"`, `<skip>` = ` | grep -vxF ` + `JSON.stringify('"' + name
  + '"')` per dropped name.
- `vitestConfig(id)` = the seven lines `import { defineConfig } from "vitest/config";` / `import {
  fileURLToPath } from "node:url";` / `export default defineConfig({` / `  root: fileURLToPath(new
  URL("../..", import.meta.url)),` / `  test: { environment: "node", include: ["probe/<id>/**/*.probe.ts"],`
  / `    setupFiles: ["tests/setup.ts"], chaiConfig: { truncateThreshold: 200 } },` / `});`, each + `"\n"`.
- A code card's guard line: `echo '== guard'; node $P/guard.mjs src <code targets joined by ",">` (+ `;
  node $P/guard.mjs tests <test> 1 <smoke>`) + `"\n"`; `code` = `codeTargets(profile, targets)`, the test =
  `testTarget(profile, targets)`.
- Build Acceptances' heredoc-tag errors come in `HEREDOC_TAGS` order per text; `JSON.stringify` of the
  path lists in the files error (no spaces: `["a","b"]`).

**Intended differences from `build.py`** (the golden check is P10a, byte for byte; earlier phases differ
only here):
1. One judge form: a single-file judge also writes `$P/lits0.json` and `echo '== guard <file>'` (P3–P9's
   `judge_acceptance` wrote `$P/lits.json` and `echo '== guard'`).
2. `locate` and `full_report` always on (P1–P9 had the grep filter and eslint stopping the chain).
3. `litsJson` keeps non-ASCII (`"…"`), where Python's `json.dumps` wrote `"\u2026"` (P9 load-spec-judge);
   the guard parses both to the same string.
4. A judge may have own git (P6/P7's judges had it in the single-file form; `build.py`'s files form had none).
5. Siblings follow the checks document's card order (`build.py`: the map's order; the P10a checks file is
   written in the map's order, so the two agree).
6. Not built: P0's scaffold acceptance (one founding card, `npm install`, strictness probe).

### 2.3. Names and the tests each judge writes

| module | code card | judge's test (new) |
|---|---|---|
| `src/builder/steps.ts` | steps | `tests/builder/steps.examples.test.ts`: Wrap Script 1–2, Check Steps 1–3, Tree Steps 1–3 = 8 |
| `src/builder/types.ts`, `src/builder/readChecks.ts` | read-checks | `tests/builder/readChecks.examples.test.ts`: Read Checks 1–4 = 4 |
| `src/builder/probeDir.ts` | probe-dir | `tests/builder/probeDir.examples.test.ts`: Probe Dir 1–3 = 3 |
| `src/builder/compose.ts` | compose | `tests/builder/compose.examples.test.ts`: Code Acceptance 1–2, Judge Acceptance 1–3 = 5 |
| `src/builder/buildAcceptances.ts` | build-acceptances | `tests/builder/buildAcceptances.examples.test.ts`: Build Acceptances 1–4 = 4 |

A code card covered by a probe writes **no test file**. A judge imports what it tests from
`../../src/builder/<m>.js`, types with `import type`, `fixture` / `fixtureJson` from `../helpers.js`. One
`test(...)` per example in record order, named `<Function> example <n>: <what>`, then at most 8 of its own.
Compare a script with its fixture whole: `expect(codeAcceptance(...)).toBe(fixture("builder/code1.txt"))`;
a typed result with `toStrictEqual`.

**A judge's own tests** (P10a, issue #3 lesson 2): an own test asserts only a value this spec PRINTS for that
exact input (a literal of §2.2, the record or a fixture); zero own tests is allowed. An example's input and
its expected value come from the same helper or fixture, never from two hand copies.

**Typing traps** (tsc strict): `fixtureJson` returns `unknown` — pass it straight into `toStrictEqual`, cast
only to read or pass a field (`fixtureJson("builder/p10.checks.typed.json") as Checks`); every result is a
union, compare it whole or narrow first (`r.ok ? r.cards : []`); no `any`; import only what you use.

### 2.4. What must not break

- Every file outside `src/builder/` and `tests/builder/` byte for byte; the 534 tests stay green.
- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/` — untouched by every card.
- Ripple: none (a new Component; nothing imports it). The guard gains the layer `builder` (imports
  `cards`, `language`; of the Node modules only `node:path`; no clock) as data before the run.

## 3. Acceptance

Built by `decks/tools/build.py p10b` (`locate` and `full_report` on) into the `acceptance` of every card in
`morph-map.json`; `morph plan` (V2) copies it onto the card as an override. Narrow to broad; the first red is
the regeneration's diagnosis.

Code cards (no test file): `probe/<card>/` with the guard, a vitest config and `tsconfig.card.json` (the
project minus the other targets of the same generation) → `tsc` → `eslint <targets>` (verdict held) →
`guard.mjs src <targets>` (layer `builder`: imports `cards`, `language` and its own files; only
`node:path`; no `process`, `console`, `Date`, `Math.random`, `fetch`, no `any`) → `decks/p10b/parts/<card>.probe.ts`
(every record example of the card's Functions, values and types, then the §2.2 rows: steps 8 + 4 = 12,
read-checks 4 + 3 = 7, probe-dir 3 + 3 = 6, compose 5 + 3 = 8, build-acceptances 4 + 3 = 7; 40 tests) →
eslint's verdict → full `vitest run` → frozen → untracked.

Judge cards: `probe/<card>/` (no probe file) → `tsc` → `eslint <file>` → `guard.mjs tests <file> <min> <max>
lits.json`: steps 8..16, readChecks 4..12, probeDir 3..11, compose 5..13, buildAcceptances 4..12 (max = examples
+ 8); literals: steps `wrap.txt`, `vitestStep.txt`, `frozen.txt`, `untracked.txt`, `names.txt`, `ownGit.txt`,
`MORPH_X_EOF`, `--exclude tests/y.test.ts`; readChecks `p10.checks.json`, `p10.checks.typed.json`,
`badChecks.json`, `badChecks.problems.json`, `(root): checks must be an object`, `phase: required`; probeDir
`probeDir.txt`, `../../src/b.ts`, `./*.probe.ts`; compose `code1.txt`, `code2.txt`, `judge1.txt`,
`judge2.txt`, `B example 2: old`, `é`; buildAcceptances `v2deck.json`, `guard.p10.txt`, `firstdiff.p10.txt`,
`p10.checks.typed.json`, `only typescript`, `is not in the deck` → `vitest run <file>` → eslint's verdict →
full run → frozen → untracked.

**Output budget per card** (`max_tokens`): code = the reference target in tokens (≈ bytes / 3.5) × 2 + 2 500
reasoning, rounded up with margin; judges by Card Budget (16 000 + 1 000 per example) or more.

| card | reference target | `max_tokens` |
|---|---|---|
| steps | steps.ts 3.6 KB ≈ 1 030 tok | 12 000 |
| read-checks | types.ts 1.3 KB + readChecks.ts 4.6 KB ≈ 1 690 tok | 14 000 |
| probe-dir | probeDir.ts 1.5 KB ≈ 430 tok | 8 000 |
| compose | compose.ts 2.6 KB ≈ 740 tok | 10 000 |
| build-acceptances | buildAcceptances.ts 3.4 KB ≈ 970 tok | 10 000 |
| steps-judge | ≈ 3 KB (8 tests) | 24 000 |
| read-checks-judge | ≈ 3.5 KB | 20 000 |
| probe-dir-judge | ≈ 2 KB | 16 000 |
| compose-judge | ≈ 3 KB | 20 000 |
| build-acceptances-judge | ≈ 5 KB | 24 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- **Layer** `builder`: pure; of the Node modules only `node:path` (`posix.extname`); imports
  `../cards/layer.js`, `../cards/types.js`, `../language/*.js`, `./*.js`. `types.ts` imports types only;
  `steps.ts` imports `node:path`, `fillTemplate`; `probeDir.ts` imports `./steps.js`; `compose.ts` imports
  `codeTargets`, `testTarget`, `./probeDir.js`, `./steps.js`; `readChecks.ts` imports types only;
  `buildAcceptances.ts` imports `layerGenerations`, `testTarget`, `./compose.js`.
- Tests read files only through `fixture` / `fixtureJson`; nothing is written. A judge writes only its
  test file and never the module it tests.
- A file a card writes is in no sibling's slice in the same generation. Dependencies: probe-dir on steps;
  compose on steps, probe-dir, read-checks (its types); build-acceptances on compose, read-checks.
- Exact strings of the record and §2.2 (every shell text, every problem and error text): the executor
  copies them.

## 7. Out of scope

- **P10b2** (DECISIONS "P10b · split"): `morph plan --checks <file>` reading the checks document, the guard,
  the locator and the probes from disk and calling `buildAcceptances` after `planSpec` (the map's
  acceptance override still wins); a checks document per phase from P10b2 on (`decks/<phase>/checks.json`);
  the end-to-end golden (`morph plan --checks decks/p10/checks.json` on this repository = `build.py p10`, the
  P10a deck file byte for byte); `build.py` archived. It patches Component `cli` (Parse Command, Plan Command)
  — V2's plan cuts a whole Component, so the cut gives every cli card: P10b2 needs a card filter or adds
  the cli cards it does not change as known-green.
- **The judge harness skeleton generated from `tests/helpers.ts`** (issue #3, P10a lesson 1): it needs the
  syntax tree of the helpers (the package `typescript` in a pure layer); P10b2 or later decides between that
  and an eslint override for judge files.
- Deriving the judge bounds (`min` = examples) and literals from the record instead of the checks document.
- Runner parity (issue #3, C2–C7), python acceptances (the builder answers python with an error).

## 8. How to run

```
python3 decks/tools/build.py p10b
npm run build && rm -rf /tmp/v2bin && mkdir -p /tmp/v2bin && cp -r dist /tmp/v2bin/ && ln -s $PWD/node_modules /tmp/v2bin/node_modules
node /tmp/v2bin/dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component builder --judge --out decks/p10b/deck.json
node /tmp/v2bin/dist/cli.js deck check --root . --deck decks/p10b/deck.json              # errors 0
node /tmp/v2bin/dist/cli.js run --root . --deck decks/p10b/deck.json --processor glm53 --max-retry-batches 8 --deadline 2400   # on the operator's word
```

Cross-check (dry, no `--add`): from `morph-lab`, `venv/bin/mrph plan --spec <repo>/contour.yaml --map
<repo>/morph-map.json --component builder --judge --root <repo>`. The V2 binary reads the processor from the
environment (`MORPH_PROCESSOR_glm53_*`, the keys from `morph-lab/.env`, never printed).

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 10 (5 code, 5 judges) / 5: [read-checks, steps] [probe-dir, read-checks-judge, steps-judge] [compose, probe-dir-judge] [build-acceptances, compose-judge] [build-acceptances-judge] |
| executor bill | ≈ $0.20 nominal (15 first requests of ≈ 15–25k in / 2–5k out; ≈ 6 retries carrying their 13–20k-char acceptance), ≤ $0.50 with a re-cut; cap $5 |
| cards with regeneration | 3 of 10 (steps: one quoting slip in a shell text; read-checks: problem order; build-acceptances-judge: the golden setup) |
| tests after the run | 534 + 5 judge files (24 example tests + own) |
| first red | steps: escaping in namesKept / frozenStep; read-checks: a default or the order of the card checks; compose: the place of the extra step or own git; build: siblings order, an error order |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) build-acceptances green means the P10a
acceptances byte for byte (the probe's example 1); (3) no judge cut off at its `max_tokens`; (4) the V2 cut
equals the old mrph's dry cut in ids, dependsOn, generations, targets, slices, acceptances, max_tokens.

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the
first V2-cut deck's behaviour, the row of `docs/MEASURE.md`.

## 11. Actual

### Gate (preparation)

(filled at the gate)
