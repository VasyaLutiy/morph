# TASK_P14a — the reviewer's pure checks: obligations, envelope and scope, guardrails, mutants, the findings document (`src/reviewer/{findObligations,checkEnvelope,checkGuardrails,planMutants,renderFindings}.ts`)

> Phase P14 of `docs/PLAN.md` ("Фазы по записи (после P2)": `P14 | reviewer | obligations, envelope, guardrails,
> findings | последняя`), **split** into P14a (this file: the five pure Functions, 10 cards) and P14b (the I/O: the mutant
> runs through acceptance's runner, `morph review` reading git, the record, scout.json and the ownership, the cli routing;
> 7 cards), the P13a/P13b pattern. Component **reviewer** of `contour.yaml` (the skeleton replaced: 5 Functions, 17
> examples, 20 872 bytes). PLAN's rule "`review` lives in Component reviewer; cli only routes" holds: cli is untouched in
> P14a. No issue is labelled `P14-reviewer` (`gh issue list --label P14-reviewer --state open`: empty, 08.10). The deck is
> cut by V2 (`morph plan --component reviewer --judge --checks decks/p14/checks.json`), `decks/p14/filter.py` asserts the
> 10 cards. The final smoke stop (§8) follows the merge of **P14b**, not of this part.

## 1. Why this

- **The verify step is the only review left, and it is a read.** AUTONOMY step 4 (operator 08.10: no external review
  passes) leaves the session's own read of every run branch; P13b's 9 cards were "read once against §2.2" and carried an
  unnamed flake. The old reviewer experiment (05.10, `morph-reviewer`, 33 agents): recall on seeded defects was equal with
  and without primer/scout/record (S3 6/6 for all conditions), the record only named the broken rule, and **the natural
  defects T1 and T2 were found by no reader** (0 of 5 clean runs each). A deterministic check finds a class every time or
  never, and costs nothing per run.
- **The classes this repository paid for, each now a check:** a card writing outside its targets (the Frozen Tree
  guardrail; Morph commits stage only targets, so a file changed by a non-Morph commit of the range is a hand edit —
  forbidden by CLAUDE.md); an example of the record no test names (the judge instruction pins "<Function> example <n>:
  <what>", 707 tests follow it); a test title dropped by a patching judge (P13b dropped "Parse Command example 4: scout…"
  by design — the reviewer must show such a drop, not hide it); a `test.skip` that turns a red acceptance green; new tests
  that kill no mutant (P13b's own mutation check: 121 mutants, 5 survivors in the first pass, 3 closed by probe rows).
- **No model.** The old Morph's reviewer gate (a frontier model, a narrow question, $0.03–0.08 per card) is not rebuilt:
  every P14 check is a function of git's output, the record and file texts; the processor is not called and nothing is
  budgeted (DECISIONS P14).

**Ripple, measured** (the 5 reference files in a scratch worktree from b54fa97 with the guard's P14 rules, full suite):
**0 of 707** red; tsc, eslint and the guard clean.

**Record sizes:** reviewer skeleton 229 → **20 872** bytes (the 30 000 rule: P14b's Review Command and Run Mutants go to a
second Component `review-session`, as scout-session beside scout); cli 29 887 untouched; Requirement Deterministic Core
gains the P14a sentence.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main** (module → what the new code calls or constructs): `src/contour/types.ts` — `ContourRecord`
  (`record.system.groups`: Components with `name`, `language: string | null`, `functions` with `name`, `examples`),
  `ContourMap` (`language: string | null`, `groups: {name, functions}[]` in map order, `cards: {id, targets: string[] |
  null, …}[]`); `src/contour/load.ts` — `loadContour(text, name)`, `loadMap(text, name)` (tests only); `src/language/
  naming.ts` — `slugName(name)`, `caseName(name, "snake" | "camel")`, `cutTargets(profile, component, functionName):
  {ok: true, slug, targets {code, test, judge}} | {ok: false, error}`; `src/language/profiles.ts` — `resolveProfile(
  componentLanguage, mapLanguage): {ok: true, profile} | {ok: false, error}`, `TYPESCRIPT`, `PYTHON`; `src/language/
  types.ts` — `LanguageProfile` (`id: "typescript" | "python"`); `src/language/paths.ts` — `profileForPath(path):
  LanguageProfile | null` (by extension: `.ts`/`.tsx` typescript, `.py`/`.pyi` python, else null); `src/git/ownership.ts`
  — `Ownership {commits, models, paths: {path, writes: {card, model, run: string | null}[]}[]}` (newest write first),
  `readOwnership(commits)` (tests only).
- **Preconditions of the callees.** language · cutTargets(TYPESCRIPT, "shop", "Add Tax") = code `src/shop/addTax.ts`, test
  `tests/shop/addTax.test.ts`, judge `tests/shop/addTax.examples.test.ts`; (PYTHON, "Ledger Tools", "Sum Rows") =
  `ledger_tools/sum_rows.py`, `tests/test_sum_rows.py`, `tests/test_sum_rows_examples.py`; (TYPESCRIPT, "shop",
  "price-text") = `src/shop/priceText.ts`, … — without the group's name as unitName the group's judge path is wrong (FO 2).
  language · resolveProfile("cobol", null) is `{ok: false}` (FO 4 skips the Component). git · readOwnership keeps the
  commits' order (newest first) per path and a path once per commit (CE 2's owners).
- **Fixtures** (`tests/fixtures/reviewer/`), each by the type the Function takes:

| file | type | what it is | what the Function returns on it |
|---|---|---|---|
| `record.yaml` | text of ONE Contour record (loadContour → ContourRecord) | Components shop (typescript: Add Tax 3 examples, Round Price 2, Format Price 1, Parse Price 2), Ledger Tools (python: Sum Rows 2), legacy (cobol: Old Total 1) | Find Obligations 1–4 |
| `map.json` | text of ONE map (loadMap → ContourMap) | group `price-text` = [Format Price, Parse Price]; cards `round-price` targets [src/shop/round.ts], `round-price-judge` targets [tests/shop/round.examples.test.ts] | FO 2: Round Price's paths from the cards, Format/Parse Price's unit `price-text` |
| `review.input.json` | ONE object (a RenderInput) | base `4f2a9c1`, head `morph/20261009-101500`; 2 changed rows (one path `docs/a\|b.md`, binary), 1 obligation (Add Tax, missing [2]), 2 guardrail rows, 2 mutants (1 killed), 5 findings in the order mutation, scope, obligation, guardrail, envelope | Render Findings 2: ids F1…F5 for obligation, envelope, scope, guardrail, mutation |
| `review.md` | text, ends with one "\n" | the exact markdown of review.input.json (1 638 bytes) | RF 2: `markdown` equals it |

- **Texts in no fixture** (copied verbatim into the test files; TypeScript string escapes as written here):

  CG 1, the TypeScript text TS (9 lines, final newline):
  ```
  import { test, it } from "vitest";
  test("A: one", () => {});
  it('B', () => {});
  test(`C ${1}`, () => {});
  foo.test("no");
  mytest("no2");
  test.skip("D", () => {});
  describe.only("E", () => {});
    test( "F" , () => {});
  ```
  CG 1, the Python text PY (17 lines, final newline):
  ```
  import pytest

  def test_a():
      pass

      async def test_b(x):
          pass
  def helper():
      pass
  def testing_c():
      pass
  @pytest.mark.skip
  def test_d(): pass
  @pytest.mark.skipif(True, reason="x")
  @unittest.skip("y")
  @pytest.mark.xfail
  ```
  CG 2: base `tests/a.test.ts` = `'test("A", () => {});\ntest("B", () => {});\ntest("B", () => {});\n'`,
  `tests/gone.test.ts` = `'it("G", () => {});\n'`, `README.md` = `'test("R")\n'`, `tests/test_x.py` =
  `"def test_one():\n    pass\n"`; head `tests/a.test.ts` = `'test("A", () => {});\ntest("C", () => {});\n'`,
  `tests/test_x.py` = `"@pytest.mark.skip\ndef test_one():\n    pass\n"`, `tests/new.test.ts` =
  `'it.only("N", () => {});\ntest.skip("M", () => {});\n'`. CG 3: the same list as base and head: `tests/s.test.ts` =
  `'test.skip("s", () => {});\n'`, `tests/test_s.py` = `"@pytest.mark.xfail\ndef test_s(): pass\n"`, `tests/u.spec.ts` =
  `'it.todo("u");\n'`.

  PM 1, the source SRC of `src/f.ts` (6 lines, final newline):
  ```
  import { x } from "./x.js";
  // a < b in a comment
  export function f(a: number, b: number): boolean {
    if (a === b && a > 0) return true;
    return a + b >= 10 || s === "a < b"; // b - a
  }
  ```
  PM 3: quotedMask's line is `say("a\"b", 'c') + 1` (20 characters: the backslash is one character of the line);
  `src/t.ts` = `"const truey = trueish && untrue;\nconst t = true;\nconst u = !false;\n"`.

  CE: the history (newest first) `[{card "a-judge", model "m/x", run "r2", paths ["tests/a.examples.test.ts"]}, {card
  "a.r1", model "m/x", run "r2", paths ["src/a.ts"]}, {card "b", model "", run null, paths ["src/b.ts", "src/a.ts"]}]`;
  ownership = readOwnership(history); the range's commits = its first two; changed = `src/a.ts` modified 3/1, `src/b.ts`
  modified 1/1, `README.md` added 2/0, `.morph/runs/r2/report.json` added 40/0, `tests/a.examples.test.ts` added 30/0;
  the scout `{scoutId "20261008-225320-74e423b1", targets ["src/a.ts", "src/c.ts"], contextSlice ["src/b.ts"]}`.

**Distinct markers.** Cards `add-tax`, `round-price.r2`, `add-tax-judge.r11`, `price-text-judge`, `old-total`, `a.r1`,
`a-judge`, `b`, `z1`, `z2`; titles with `example 10`, `example 12`, `example 2x`, `example 2_empty`; models `m/x`, `""`, `q`;
runs `r2`, `r9`, null; scout ids `20261008-225320-74e423b1`, `s1`; refs `v1`, `HEAD`, `4f2a9c1`, `morph/20261009-101500`,
`a`, `b`, `b|1`; limits 50, 9, 3, 0, 10, 7, 100. The code hard-codes none of them: the title rules, the profiles' ids, the
regular expressions, MUTATION_RULES, KIND_ORDER, GUARDRAILS, MORPH_DIR, the sentences and the markdown are the contract.

### 2.2. OUTPUT data shapes

Every module is NEW, layer reviewer, and imports no Node module, reads no clock and no environment and writes nothing; each
declares its own `Finding` (`{ kind: string; source: string; path: string | null; expected: string; got: string }`, the
same shape in all five: P14b joins them).

**`src/reviewer/findObligations.ts`** (imports `cutTargets`, `slugName`, `caseName` from `../language/naming.js`,
`resolveProfile` from `../language/profiles.js`, types from `../language/types.js` and `../contour/types.js`) — exports,
in this order:

```ts
export interface ObligationInput { record: ContourRecord; map: ContourMap; changed: string[]; cards: string[]; titles: string[] }
export interface Obligation {
  component: string; function: string; unit: string; touchedBy: string[];
  examples: number; judge: string | null; missing: number[];
}
export interface Finding { kind: string; source: string; path: string | null; expected: string; got: string }
export interface ObligationResult { obligations: Obligation[]; findings: Finding[] }
export function exampleTitle(profile: LanguageProfile, functionName: string, n: number): string;
export function hasTitle(titles: readonly string[], wanted: string, profile: LanguageProfile): boolean;
export function cardUnit(card: string): string;
export function findObligations(input: ObligationInput): ObligationResult;
```

| rule | value |
|---|---|
| order | Components in `record.system.groups` order, Functions in Component order; findings in obligation order, examples ascending |
| profile | `resolveProfile(component.language, map.language)`; `{ok: false}` → the whole Component is skipped (no obligation, no finding) |
| unit | unitName = the `name` of the FIRST map group (map.groups order) whose `functions` include the Function's name, else the Function's name; unit = `slugName(unitName)`; cut = `cutTargets(profile, component.name, unitName)` (`ok: false` → the Function is skipped) |
| paths | codePaths = the targets of the map card with `id === unit` and `targets !== null`, else `[cut.targets.code, cut.targets.test]`; judgePaths = those of the card `unit + "-judge"`, else `[cut.targets.judge]` |
| touchedBy | first `"card " + cardUnit(c)` for each card c in the given order with cardUnit(c) = unit or unit + "-judge"; then `"file " + p` for each changed p (given order) in codePaths or judgePaths; no repeat; empty → no obligation |
| cardUnit | the card without one final `.r<digits>`: `"a.r3"` → `"a"`, `"a.rx"` → `"a.rx"`, `"add-tax-judge.r11"` → `"add-tax-judge"` |
| exampleTitle | `"<name> example <n>"`; for `profile.id === "python"`: `"test_" + caseName(name, "snake") + "_example_" + n` |
| hasTitle | some title `=== wanted` or `startsWith(wanted + sep)`, sep `":"`, python `"_"` (`"Add Tax example 12"` does not hold example 1) |
| obligation | `{component: component.name, function: fn.name, unit, touchedBy, examples: fn.examples.length, judge: judgePaths[0] ?? null, missing}` |
| finding | per missing n: `{kind: "obligation", source: "record: <Component> · <Function> · example <n>"` (U+00B7 with a space each side)`, path: judgePaths[0] ?? null, expected: 'a test named "<wanted>"', got: "no test title at head starts with it"}` |

**`src/reviewer/checkEnvelope.ts`** (imports the type `Ownership` from `../git/ownership.js` only) — exports, in order:

```ts
export type ChangeStatus = "added" | "modified" | "deleted";
export interface ChangedFile { path: string; status: ChangeStatus; added: number | null; deleted: number | null }
export interface RangeCommit { card: string; model: string; run: string | null; paths: string[] }
export interface ScoutScope { scoutId: string; targets: string[]; contextSlice: string[] }
export type Scope = "target" | "context" | "outside";
export interface EnvelopeRow {
  path: string; status: ChangeStatus; added: number | null; deleted: number | null;
  writers: string[]; owner: string | null; scope: Scope | null;
}
export interface EnvelopeInput { changed: ChangedFile[]; commits: RangeCommit[]; ownership: Ownership; scout: ScoutScope | null }
export interface Finding { kind: string; source: string; path: string | null; expected: string; got: string }
export interface EnvelopeResult { applies: boolean; rows: EnvelopeRow[]; findings: Finding[] }
export const MORPH_DIR = ".morph/";
export const ENVELOPE_SOURCE = "primer: ownership";
export function readDiff(nameStatus: string, numstat: string): ChangedFile[];
export function checkEnvelope(input: EnvelopeInput): EnvelopeResult;
```

| rule | value |
|---|---|
| readDiff names | `nameStatus.split("\0")` read in pairs (letter, path) from index 0; a pair whose letter is `""` (the trailing piece) ends nothing but is skipped; first char `A` → added, `D` → deleted, any other (`M`, `T`, …) → modified |
| readDiff counts | `numstat.split("\0")`, each non-empty record `<a>\t<d>\t<path>` (split at the first two tabs; the path may hold spaces); `"-"` → null else `Number`; a path numstat lacks → `added: null, deleted: null` |
| applies | `commits.length > 0` |
| row | per changed file in order: `writers` = `commit.card` (as given, not cardUnit) of each commit whose `paths` include the path, distinct, commit order; `owner` = the ownership entry of that path, its `writes[0]` as `"<card> (<model, or — when "">, run <run, or — when null>)"`, null when the path has no entry; `scope` = null without a scout or for a path starting with MORPH_DIR, else "target" (in targets) / "context" (in contextSlice) / "outside" |
| findings per row | none for a MORPH_DIR path. `applies` and `writers.length === 0` → `{kind "envelope", source ENVELOPE_SOURCE, path, expected "written by a Morph card of the range", got "changed outside every card's targets; " + ("last Morph write " + owner, or "no Morph card ever wrote it" when owner is null)}`; then, with a scout and scope !== "target" → `{kind "scope", source "scout " + scoutId, path, expected "a target of the scout session (" + targets.join(", ") + ")", got "changed, though the scout named it as context" (context) or "changed, though the scout did not name it"}` |
| last | with a scout, each target (targets order) that no changed path equals (a deleted one counts as changed) → `{kind "scope", source "scout " + scoutId, path: target, expected "changed: the scout named it as a target", got "unchanged in the range"}` |

**`src/reviewer/checkGuardrails.ts`** (imports `profileForPath` from `../language/paths.js`) — exports, in order:

```ts
export interface TestText { path: string; text: string }
export interface GuardrailInput { base: TestText[]; head: TestText[] }
export interface GuardrailRow { name: string; files: number; findings: number }
export interface Finding { kind: string; source: string; path: string | null; expected: string; got: string }
export interface GuardrailResult { rows: GuardrailRow[]; findings: Finding[] }
export const GUARDRAILS: readonly ["Tests Kept", "No New Skips"];   // `as const`
export function testTitles(text: string, profile: string): string[];
export function skipCount(text: string, profile: string): number;
export function checkGuardrails(input: GuardrailInput): GuardrailResult;
```

| rule | value |
|---|---|
| testTitles typescript | every match of `/(?<![\w$.])(?:test|it)\(\s*(["'`])(.*?)\1/g`, group 2, in text order |
| testTitles python | every match of `/^[ \t]*(?:async[ \t]+)?def[ \t]+(test\w*)[ \t]*\(/gm`, group 1 |
| skipCount typescript | the number of matches of `/(?<![\w$.])(?:test|it|describe)\.(?:only|skip|todo)\(/g` |
| skipCount python | `/@(?:pytest\.mark\.(?:skipif|skip|xfail)|unittest\.skip)\b/g` |
| other profile ids | testTitles `[]`, skipCount 0 |
| a file's profile | `profileForPath(path)?.id`; null → the file is skipped by both guardrails and not counted |
| Tests Kept | each base file with a profile, base order: `after` = the head file with the same path; its distinct titles (`new Set`, first appearance); a title not among the head file's titles → `{kind "guardrail", source "guardrail Tests Kept", path, expected 'the test "<title>" kept', got "the test file is gone at head" (no head file) or "no test of that name at head"}` |
| No New Skips | each head file with a profile, head order: was = skipCount of the base file with that path (0 when none), now = skipCount of the head file; now > was → `{kind "guardrail", source "guardrail No New Skips", path, expected "at most <was> skipped or focused tests, as at base", got "<now> at head"}` |
| result | `rows = [{name "Tests Kept", files: base files with a profile, findings: its count}, {name "No New Skips", files: head files with a profile, findings}]`; findings = Tests Kept's, then No New Skips' |

**`src/reviewer/planMutants.ts`** (imports nothing) — exports, in order:

```ts
export interface MutationRule { from: string; to: string; word: boolean }
export interface Mutant { path: string; line: number; column: number; rule: string; text: string }
export const MUTATION_RULES: readonly MutationRule[];
export function quotedMask(line: string): boolean[];
export function planMutants(path: string, text: string, limit: number): Mutant[];
```

| rule | value |
|---|---|
| MUTATION_RULES | in this order: `"==="→"!=="`, `"!=="→"==="`, `" <= "→" < "`, `" >= "→" > "`, `" < "→" <= "`, `" > "→" >= "`, `" + "→" - "`, `" - "→" + "`, `"&&"→"\|\|"`, `"\|\|"→"&&"` (all `word: false`), `"true"→"false"`, `"false"→"true"` (`word: true`) |
| quotedMask | one boolean per character: outside a string false; an opening `"`, `'` or `` ` `` and every character to its closing quote true (the quotes included); inside a string a backslash and the character after it are true and the latter never closes |
| skipped lines | a line matching `/^\s*(?:\/\/|\/\*|\*|#|import\b|export\s+(?:type\s+)?\{)/` has no mutant |
| code end | the index of the first `//` both of whose characters are outside a string (mask false), else the line's length |
| occurrence | every index of `rule.from` in the line (`indexOf` from each index + 1) with index + from.length ≤ code end, mask false at the index, and, for a `word` rule, no `[A-Za-z0-9_$]` right before or right after |
| order | lines in order; in a line by the occurrence's index, then the rule's order |
| mutant | `{path, line: index + 1, column: occurrence index + (from.length − from.trimStart().length) + 1, rule: from.trim() + " → " + to.trim(), text: the lines with that one occurrence replaced, "\n"-joined}` |
| limit | `limit ≤ 0` → `[]`; total ≤ limit → all; else `all[Math.floor(i * total / limit)]` for i = 0 … limit − 1 |

**`src/reviewer/renderFindings.ts`** (imports nothing) — exports, in order:

```ts
export interface Finding { kind: string; source: string; path: string | null; expected: string; got: string }
export interface NumberedFinding extends Finding { id: string }
export interface ChangedRow {
  path: string; status: string; added: number | null; deleted: number | null; writers: string[]; scope: string | null;
}
export interface ObligationRow { component: string; function: string; touchedBy: string[]; examples: number; missing: number[] }
export interface GuardrailRow { name: string; files: number; findings: number }
export interface MutantRow { path: string; line: number; rule: string; killed: boolean }
export interface RenderInput {
  base: string; head: string; changed: ChangedRow[]; obligations: ObligationRow[]; guardrails: GuardrailRow[];
  mutants: MutantRow[] | null; findings: Finding[];
}
export interface ReviewCounts {
  files: number; obligations: number; examples: number; missing: number;
  mutants: number | null; killed: number | null; findings: number; byKind: Record<string, number>;
}
export interface Review {
  range: string; verdict: "clean" | "findings"; counts: ReviewCounts; findings: NumberedFinding[]; markdown: string;
}
export const KIND_ORDER: readonly ["obligation", "envelope", "scope", "guardrail", "mutation"];   // `as const`
export function orderFindings(findings: readonly Finding[]): NumberedFinding[];
export function renderFindings(input: RenderInput): Review;
```

| rule | value |
|---|---|
| orderFindings | stable sort by the kind's index in KIND_ORDER (an unknown kind ranks after all five, stable among unknowns), then `{id: "F" + (n + 1), ...finding}` (id the first key) |
| counts | files = changed.length; obligations = obligations.length; examples = Σ examples; missing = Σ missing.length; mutants = mutants.length or null; killed = the killed count or null; findings = findings.length; byKind = the five kinds at 0 in KIND_ORDER, then +1 per finding (an unknown kind becomes a key after the five) |
| range, verdict | `base + ".." + head`; "clean" when no finding, else "findings" |
| markdown | the lines below joined by `"\n"`; it always ends with one `"\n"` |
| head | `# Review <range>`, ``; `Clean: no findings.` or `<n> findings: <k> <count>, …` (every byKind key in order) + `.` |
| files | ``, `## Changed files (<n>)`, ``, `\| file \| status \| lines \| written by \| scope \|`, `\|---\|---\|---\|---\|---\|`, per row `\| <path> \| <status> \| +<added> -<deleted> \| <writers ", "-joined, — when none> \| <scope, — when null> \|` (lines `binary` when added or deleted is null) |
| obligations | ``, `## Obligations (<n> Functions, <examples> examples, <missing> missing)`, ``; when n > 0: `\| Function \| touched by \| examples \| missing \|`, `\|---\|---\|---\|---\|`, per row `\| <component> · <function> \| <touchedBy ", "> or — \| <examples> \| <missing ", "> or — \|`, `` |
| guardrails | `## Guardrails`, ``, `\| guardrail \| files \| findings \|`, `\|---\|---\|---\|`, per row `\| <name> \| <files> \| <findings> \|`, `` |
| mutants | only when mutants is not null: `## Mutants (<killed> of <n> killed)`, ``; when n > 0: `\| at \| rule \| result \|`, `\|---\|---\|---\|`, per mutant `\| <path>:<line> \| <rule> \| killed\|survived \|`, `` |
| findings | `## Findings`, ``; none → `None.`, ``; per numbered finding `### <id> · <kind> · <source>`, ``, `- path: <path, — when null>`, `- EXPECTED: <expected>`, `- GOT: <got>`, `` |
| cells | inside a table row every `\|` of a value is written `\|` preceded by a backslash; the heading, the summary and the finding blocks are written as they are |

The em dash is U+2014 (`—`), the middle dot U+00B7 (`·`), the arrow U+2192 (`→`).

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/reviewer/findObligations.ts` | NEW | probe only | NEW `tests/reviewer/findObligations.examples.test.ts` (FO 1–4) |
| `src/reviewer/checkEnvelope.ts` | NEW | probe only | NEW `tests/reviewer/checkEnvelope.examples.test.ts` (CE 1–4) |
| `src/reviewer/checkGuardrails.ts` | NEW | probe only | NEW `tests/reviewer/checkGuardrails.examples.test.ts` (CG 1–3) |
| `src/reviewer/planMutants.ts` | NEW | probe only | NEW `tests/reviewer/planMutants.examples.test.ts` (PM 1–3) |
| `src/reviewer/renderFindings.ts` | NEW | probe only | NEW `tests/reviewer/renderFindings.examples.test.ts` (RF 1–3) |

- `findObligations.examples`: "Find Obligations example 1: …" … "4: …"; the record and map from `loadContour(fixture(
  "reviewer/record.yaml"), "record.yaml")` and `loadMap(fixture("reviewer/map.json"), "map.json")`; examples 1–3 compare the
  whole result with toStrictEqual; example 4 the result and the three helpers.
- `checkEnvelope.examples`: "Check Envelope example 1: …" … "4: …"; §2.1's history, ownership = readOwnership(history),
  changed files and scout as literals; examples 2 and 3 compare the whole result, example 4 the scopes and the findings.
- `checkGuardrails.examples`: "Check Guardrails example 1: …" … "3: …"; the texts of §2.1 verbatim; whole results.
- `planMutants.examples`: "Plan Mutants example 1: …" … "3: …"; SRC verbatim; `[line, column, rule]` lists and texts.
- `renderFindings.examples`: "Render Findings example 1: …" … "3: …"; example 2 reads `fixtureJson("reviewer/
  review.input.json")` and compares `markdown` with `fixture("reviewer/review.md")` by toBe.

### 2.4. What must not break

- Byte for byte: every file outside the 5 code targets and the 5 test files of §2.3 — `src/**` on main, `tests/helpers.ts`,
  `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/` — untouched by every card.
- 707 tests in 102 files green at every card (ripple 0, `fullExclude` empty); after the run **707 + FO 4 + CE 4 + CG 3 +
  PM 3 + RF 3 = 724** in 107 files (± the judges' extra rows within their max).

## 3. Acceptance

Built by `morph plan --checks decks/p14/checks.json`, narrow to broad, every stage printing `== <stage>`. `ownGit: false`
(no test spawns git), `fullExclude` empty (ripple 0 of 707).

Code cards (no test file; code-only targets, `intent: generate`): `probe/<card>/` → `tsc` (per-card tsconfig excluding the
generation's other targets) → `eslint <target>` → `guard.mjs src <target>` → `decks/p14/parts/<card>.probe.ts`
(find-obligations FO 1–4 + 1 row = 5; check-envelope CE 1–4 + 1 = 5; check-guardrails CG 1–3 + 1 = 4; plan-mutants PM 1–3 +
1 = 4; render-findings RF 1–3 + 1 = 4; **22 tests**) → eslint's verdict → full `vitest run` → frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <target>` → `guard.mjs tests <file> <min> <max> lits0.json` → `vitest run
<target>` → eslint's verdict → full run → frozen → untracked.

| file | min | max | lits |
|---|---|---|---|
| `tests/reviewer/findObligations.examples.test.ts` | 4 | 10 | `Find Obligations example 1` … `4`, `reviewer/record.yaml`, `reviewer/map.json`, `no test title at head starts with it`, `tests/shop/priceText.examples.test.ts`, `test_sum_rows_example_2`, `add-tax-judge.r11`, `Parse Price example 2x` |
| `tests/reviewer/checkEnvelope.examples.test.ts` | 4 | 10 | `Check Envelope example 1` … `4`, `src/sp ace.ts`, `b (—, run —)`, `no Morph card ever wrote it`, `changed, though the scout named it as context`, `unchanged in the range`, `20261008-225320-74e423b1` |
| `tests/reviewer/checkGuardrails.examples.test.ts` | 3 | 9 | `Check Guardrails example 1` … `3`, `testing_c`, `the test file is gone at head`, `tests/new.test.ts`, `tests/gone.test.ts`, `@pytest.mark.skipif` |
| `tests/reviewer/planMutants.examples.test.ts` | 3 | 9 | `Plan Mutants example 1` … `3`, `00001111110011100000`, `true → false`, `&& → ||`, `// a < b in a comment`, `trueish` |
| `tests/reviewer/renderFindings.examples.test.ts` | 3 | 9 | `Render Findings example 1` … `3`, `reviewer/review.input.json`, `reviewer/review.md`, `4f2a9c1..morph/20261009-101500`, `Clean: no findings.`, `## Mutants (0 of 0 killed)` |

min = the record's examples; max = min + 6.

**Output budget** (`max_tokens`, before the session's ×3 for `ds`; a ds answer ≥ 10 KB gets ≥ 16 000, DECISIONS P12a):

| card | returns | `max_tokens` |
|---|---|---|
| find-obligations | findObligations.ts ≈ 3.6 KB | 12 000 |
| check-envelope | checkEnvelope.ts ≈ 4.4 KB | 12 000 |
| check-guardrails | checkGuardrails.ts ≈ 3.2 KB | 10 000 |
| plan-mutants | planMutants.ts ≈ 3.4 KB | 10 000 |
| render-findings | renderFindings.ts ≈ 4.8 KB | 14 000 |
| find-obligations-judge | ≈ 5.5 KB new file (the probe-shaped reference: 5.1 KB) | 16 000 |
| check-envelope-judge | ≈ 5.5 KB (reference 4.9 KB) | 16 000 |
| check-guardrails-judge | ≈ 4.5 KB, two verbatim texts (reference 4.0 KB) | 16 000 |
| plan-mutants-judge | ≈ 3 KB (reference 2.4 KB) | 14 000 |
| render-findings-judge | ≈ 4.5 KB, one long markdown literal (reference 3.9 KB) | 16 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- **Layer reviewer** (guard, P14a): may import cards, contour, primer, scout, git, language; NODE_ONLY none (no `node:*` at
  all), NO_CLOCK (no `Date`), NO_ENV (no `process.env`), no `fetch`, no `process`, no `console`, no `node:child_process`.
  Of git only the type `Ownership` (no call: git spawns). P14b adds the I/O file(s).
- No module of the phase imports another of the phase (each declares its own Finding): all five code cards are one
  generation, each judge depends on its code card only.
- A file a card writes is in no sibling's slice in the same generation: generation 0 (the five code cards) reads no P14
  file; generation 1 (the five judges) reads its own module, not each other's test.
- Tests write no file (pure functions; the fixtures are read through `fixture`/`fixtureJson`); no timer; no network.

## 7. Out of scope

- **P14b** (the next phase, 7 cards, a second Component `review-session` beside reviewer: the 30 000-byte rule):
  Run Mutants (`src/reviewer/runMutants.ts`: each mutant of Plan Mutants written over its file, the test command run by
  acceptance's runAcceptance with `timeoutMs` (default 120 000; a timeout counts as killed), the file restored by
  acceptance's snapshotTargets/restoreSnapshot in `finally`; a baseline run that must pass first; survivors → findings
  `{kind "mutation", source "mutation <path>:<line>", expected "a test fails on <rule> at line <line>", got "every test
  passed"}`); Review Command (`src/reviewer/reviewCommand.ts`, `morph review <base> <head> [--spec <record>] [--map <map>]
  [--scout <id|latest>] [--mutants <n>] [--mutant-timeout <s>] [--test <command>] [--write] [--root] [--pretty]`: refs by
  `git rev-parse --verify <ref>^{commit}`; the diff by `git diff --name-status -z --no-renames` and `--numstat -z`; the
  range's Morph commits = git's readMorphLog(root, env) filtered by `git rev-list base..head` (head must be in HEAD's
  history); ownership = readOwnership of the whole log; titles and texts of the test files at base and head by `git
  ls-tree -r -z --name-only` + `git show <ref>:<path>`; the scout scope from `.morph/scout/<id>/scout.json` (P13b's
  record: status ok, `answer.targets`, `answer.context_slice`); `--mutants` needs head = HEAD and a clean tree; the Review
  document + the inputs' provenance on stdout, `--write` → `.morph/review/<head8>.md`; exit 0 clean, 1 findings, 3 a git
  fault, 4 usage); the cli routing (Parse Command's word `review` with two positional refs, Main; cli compacted first).
- A record Guardrail with a machine check (PLAN P18's "Guardrail с полем check = правило eslint или grep"): the record's
  schema has no `check` field (Validate Record rejects unknown keys); a later phase if a project asks. P14's guardrails are
  the reviewer's own two, named in the record.
- A model judging the diff (the old reviewer gate): not rebuilt (§1); `--processor` is not a flag of `morph review`.
- Mutating test files, renames (`--no-renames` reads a rename as delete + add), a review of a run archive without git.

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component reviewer \
  --judge --checks decks/p14/checks.json --out decks/p14/deck.json
python3 decks/p14/filter.py decks/p14/deck.json                  # asserts the 10 cards of the phase
node dist/cli.js deck check --root . --deck decks/p14/deck.json                                   # errors 0
python3 decks/tools/scale_tokens.py decks/p14/deck.json 3        # the session, for processor ds
rm -rf /tmp/v2bin-p14 && mkdir -p /tmp/v2bin-p14 && cp -r dist /tmp/v2bin-p14/ && ln -s $PWD/node_modules /tmp/v2bin-p14/node_modules
node /tmp/v2bin-p14/dist/cli.js run --root . --deck decks/p14/deck.json --processor ds --deadline 2400
```

Cross-check (dry): from `morph-lab`, `venv/bin/mrph plan --spec <repo>/contour.yaml --map <repo>/morph-map.json
--component reviewer --judge --root <repo>`.

**The FINAL smoke (after the merge of P14b; the operator's smoke stop 3).** A tiny TypeScript repository T outside
`~/MorphV2` (e.g. `/tmp/smoke-final/T`), the binary copy `/tmp/v2bin-smoke` (`dist/` + `node_modules` symlinked), the ds
environment by indirection (`decks/p10b2/smoke/run.sh` recipe with `ds` for `glm53`, never printed), ceiling **$0.20** in all.

1. **T, base.** `git init`; from `decks/p10b2/smoke/`: `contour.yaml` (Component calc: Clamp Value, Clamp Percent, 3
   examples each), `morph-map.json`, `package.json`; `node_modules` symlinked from the repo; tsconfig, vitest config,
   `tests/setup.ts`, `tests/helpers.ts` copied; `decks/tools/{guard,firstdiff}.mjs`; `decks/s14/checks.json` = the P10b2
   checks plus the two judges (`files` with `Clamp Value example 1`…`3` / `Clamp Percent example 1`…`3` as lits, min 3, max 9)
   and the two probes in `decks/s14/parts/`; commit → **B0**.
2. **plan --checks.** `plan --root T --spec contour.yaml --map morph-map.json --component calc --judge --checks
   decks/s14/checks.json --out decks/s14/deck.json` exit 0, 4 cards in 2 generations; `deck check` errors 0; `scale_tokens.py
   … 3`; commit the deck → **B1**.
3. **run on ds.** `run --root T --deck decks/s14/deck.json --processor ds --deadline 1200`: exit 0, 4 / 4 written, the branch
   `morph/<runId>` with 4 card commits (Morph-Card trailers) + the archive commit; ≤ $0.10.
4. **primer.** `primer --root T --write`: exit 0; `.morph/primer.md` holds "## File ownership" with the 4 cards' paths.
5. **scout.** task file outside T: "Make Clamp Percent round half down; name the file that must change." → `scout --root T
   --processor ds --issue <task> --deadline 300`: exit 0, status ok, `answer.targets` ⊆ T's files holding
   `src/calc/clampPercent.ts`; ≤ $0.05 (TASK_P13b §8).
6. **review.** `review B1 HEAD --root T --spec contour.yaml --map morph-map.json --scout latest --mutants 8 --mutant-timeout
   120 --write`: exit 0 or 1 (never 3/4), no model call ($0); it must show: obligations = 2 Functions, 6 examples, missing 0
   (the judges name every example); envelope applies, 0 envelope findings (every changed file a card's, `.morph/` skipped);
   guardrails Tests Kept 0 and No New Skips 0; the scope table from the scout session (rows target/context/outside; the
   scout's target `src/calc/clampPercent.ts` was changed by the run, so it is not "unchanged"); mutants ≤ 8 planned (Plan Mutants on the
   changed code files), every run under 120 s, a baseline run green first, each survivor a mutation finding with EXPECTED/GOT; `.morph/review/<head8>.md` written; the document's
   counts equal the markdown's. Then a seeded check: a hand commit touching `README.md` on top → `review B1 HEAD` exit 1
   with exactly one envelope finding on `README.md` ("no Morph card ever wrote it").

`mrph` reads `.env` from the current directory: run it from `morph-lab`, never from the repo.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 10 (5 code, 5 judges) / 2: [check-envelope, check-guardrails, find-obligations, plan-mutants, render-findings] [the five judges] |
| executor bill | ≈ $0.10–0.20 on ds ×3 (P13a: 10 pure cards, 16 requests, $0.1545); ≤ $0.35 with a re-cut; cap $5 |
| cards with regeneration | 2–4 of 10 (plan-mutants: the column and the code end; render-findings: the markdown's blank lines; check-guardrails-judge: the verbatim texts' escapes; render-findings-judge: the long literal) |
| tests after the run | 724 ± 6 in 107 files |
| first red | plan-mutants: a mutant inside a string or after `//`, or the column of the spaced operators; render-findings: one "\n" too many or too few around a section; find-obligations: the group's unit (slug of the Function instead of the group) |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no answer cut at its `max_tokens`; (3) the V2 cut equals
the old mrph's dry cut in ids, dependsOn, generations, targets, slices and max_tokens; (4) after the run no file outside
§2.3's ten changed; (5) no `src/reviewer` file imports a Node module.

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the MEASURE row with
its `прогоны` cell, the vitest log of every verify run (a flake is named); DECISIONS lines "P14 reviewer".

## 11. Actual
