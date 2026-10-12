# TASK_P35a — issue #45 (part a): the record's examples check the phase's hand data (`src/criterion/{probeNames,defaultChecks}.ts`, `src/builder/{types,readChecks}.ts`, `src/planner/{types,plan}.ts`, `src/cli/planCommand.ts`)

Split (TASK_TEMPLATE, skill §4.2): the issue needs 16 cards; P35a = the probe-name check, the judge defaults and the
cut form of checks.json (10 cards); P35b = the probe skeleton writer `--write-probes` (§7).

## 1. Why this

In V2 the record's examples reach the code check only through hand copies: the probe re-types them, checks.json
re-types each judge's `min`/`max`/`lits` and repeats the cut's cards (#45, #44 gaps 2 and 8; documentation/CONTOUR.md §8).
Measured on the committed decks (P35a recon: a script over the 44 `decks/*/checks.json` at the commit that last
touched each, plus the 5 identity-corpus entries; the record of that commit):
- probes: 1 holds a title the record does not give (p19a `cut-component`: "Cut Component example 7", the record at
  605eb69 has 6 examples) — real drift nobody saw; 6 probes split one example over several tests (allowed).
- re-cut probes cover a subset by design: p15 `go-acceptance` (a new file, an identity-corpus entry) holds example 5
  of 5, p21c `plan-command` 3 of 14; p21c `transaction-deck` holds Blame Log 1–4, another Function's examples; the
  golden of Plan Command 6 uses probes "// probe\n" with no titles at all.
- judge files (50 checks documents, 44 decks + 6 fixtures and smokes): 108 of 151 new files have max = min + 6 (the
  P10c2 rule; go-mini 4/10, 5/11, 3/9), the rest +2..+12; a judge patching an existing file has min = the file's
  whole count and slack 0–14 (0 or 2 in 30 of 54).
- fullExclude: 17 of 50 documents list every own judge file, 19 some, 14 have no fullExclude.
- every committed deck lists all of its cards in `cards`.

So a default that changes the old form changes committed decks (the identity corpus p15, Plan Command 6 and the
Object.keys golden of Plan Command 19). P35a keeps the old form byte for byte and adds **the cut form**: a checks
document without `cards`, whose cards, judge bounds and fullExclude come from the cut and the record, with
per-card `overrides` only where a phase differs.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **The cut form** (Read Checks): a checks document without `cards`. Root keys `version, phase, parts, frozen,
  fullExclude, ownGit, cards, overrides`; `overrides` = a list of card objects (keys `id, smoke, extra, files`),
  each file needs only `file` (`min, max, lits, drop, new` optional). `cards` and `overrides` together are refused.
  Typed: `Checks` with `cards: []` and the last key `overrides: CheckOverride[]` (`[]` when absent); the old form
  (cards given) is typed exactly as before, without the key `overrides`.
- **Card Criterion** (Plan Spec): `criteria[customId] = {judge, functions: {name, examples}[]}` for every card of the
  plan; a judge's functions are those of its code card (its first `dependsOn` id).
- **Example Count** `{name, count}`: `record` = every Function of the record in record order (all Components, not
  only the cut's), `count` = its examples.
- Fixtures (all under `tests/fixtures/`):
  - `criterion/examples.json["Probe Names 1..4"]`, `["Default Checks 1..5"]`: given and then of each example.
  - `criterion/titles1.ts.txt` (T1: 4 example titles — Clamp Value 1, 2, 2, 3 — plus 2 own tests and one `test(`
    inside a string), `criterion/titles2.ts.txt` (T2: Clamp Value 1, 2, 5, Percent Of 1, Add Tax 1, the last
    backquoted).
  - `criterion/goMini.criteria.json`: the Card Criterion of go-mini's six cards (an object keyed by customId:
    clamp-value 4 examples, percent-of 5, format-share 3, each judge the same functions with `judge: true`).
  - `criterion/ts.input.json`: `{cards: Card[5], criteria}` — cards ab (`src/a.ts`), ab-judge (two test files), cd
    (`src/c.ts`, `tests/c.test.ts`), notes (`docs/NOTES.md`), ef (`src/e.ts`); criteria for ab and ab-judge only
    (one Function "A B", one example whose then is `"lit one" and "lit two"`).
  - `cli/goMini.deck.json` (existing): go-mini's six cards in deck order clamp-value, clamp-value-judge,
    percent-of, format-share, percent-of-judge, format-share-judge.
  - `cli/clampValue.drift.probe.txt` (Go titles TestProbeClampValueExample1, 2, 3, 5),
    `cli/clampValue.short.probe.txt` (examples 1 and 2).
  - `cli/goMini.cut.checks.json` (phase, frozen), `cli/goMini.defaults.checks.json` (the old form holding exactly
    the defaults), `cli/goMini.override.checks.json` (one override: percent-of-judge lits),
    `cli/goMini.only.checks.json` (that override plus `format-share` extra), `cli/goMini.nope.checks.json` (that
    override plus `{id: "nope"}`).
  - `builder/examples.json["Read Checks 5", "Read Checks 6"]`; `builder/badChecks.problems.json` (21 lines, the
    first now ending `cards, overrides)`); `planner/examples.json["Plan Spec 9"]`;
    `cli/examples.json["Plan Command 21..23"]`.
- **The Plan Command harness** (examples 21–23): a `tmpRoot()` holding the files of the MINI list of
  `tests/cli/planCommand.p31a.examples.test.ts` copied from `fixture("go-mini/" + f)` except
  `decks/m1/checks.json`, plus `decks/tools/guard.mjs` "// guard\n" and `decks/tools/firstdiff.mjs`
  "// firstdiff\n"; `decks/m1/checks.json` written from the example's fixture; args
  `{name: "plan", root: ".", pretty: false, spec: "contour.yaml", components: ["calc", "report"], map:
  "morph-map.json", judge: true, checks: "decks/m1/checks.json", out}`. The plain go-mini record has no
  guardrails, so the document has no `proseOnly`.

### 2.2. OUTPUT data shapes

**`src/builder/types.ts`** — add, nothing else changes:
```ts
export interface OverrideFile { file: string; min: number | null; max: number | null; lits: string[] | null; drop: string[] | null; new: boolean | null }
export interface CheckOverride { id: string; smoke: number | null; extra: string | null; files: OverrideFile[] | null }
// Checks gains a last optional key:  overrides?: CheckOverride[];
```

**`src/builder/readChecks.ts`** (Read Checks, record P35a sentence): `ROOT_KEYS` gains `"overrides"` last, so the
unknown-key message lists `version, phase, parts, frozen, fullExclude, ownGit, cards, overrides`. `cards: required`
is gone; given `cards` must still be a non-empty list. After the cards loop: `overrides` given and not a list →
`"overrides: must be a list"`; each item checked like a card under the path `overrides[<i>]` — `cards[<i>]` becomes
`overrides[<i>]` in every message, duplicate ids counted among the overrides — except that a file requires only
`file` and its absent `min`, `max`, `lits`, `drop`, `new` are `null`; `min > max` only when both are numbers. Then
both `cards` and `overrides` given → `"(root): cards and overrides exclude each other: cards lists every card,
overrides only the cut's cards that differ"`. Result: cards given → as before (no key `overrides`); cards absent →
`{...as before, cards: [], overrides}` with `overrides` the last key (`[]` when absent).

**`src/planner/types.ts`** — add, and the ok result gains a last key:
```ts
import type { Component, ContourFunction, ContourMap, ContourRecord, Example } from "../contour/types.js";
export interface CardCriterion { judge: boolean; functions: { name: string; examples: Example[] }[] }
export type PlanResult =
  | { ok: true; plan: Plan; uses: Record<string, string[]>; warnings: string[]; criteria: Record<string, CardCriterion> }
  | { ok: false; error: string };
```

**`src/planner/plan.ts`** (Plan Spec): before the success return, `criteria` with one key per card of
`order.cards`, in that order: a card made by Cut Judges (the ids of `judgeCards`) → `{judge: true, functions:
criteria-functions of its dependsOn[0]}` (`[]` when that id is no Cut Card of this plan); any other card → `{judge:
false, functions: its CutCard's functions.map((f) => ({name: f.name, examples: f.examples}))}` (`[]` for an
Interface card or an extra card). The success result is `{ok: true, plan, uses, warnings, criteria}`.

**`src/criterion/probeNames.ts`** (Probe Names):
```ts
import { nameWords } from "../language/naming.js";
import type { LanguageProfile } from "../language/types.js";
export interface ExampleCount { name: string; count: number }
export interface ProbeTitle { function: string; n: number }
export interface ProbeNamesInput { id: string; path: string; profile: LanguageProfile; text: string; own: ExampleCount[]; record: ExampleCount[]; strict: boolean }
export function pascalName(name: string): string;
export function probeTitles(profile: LanguageProfile, text: string, names: readonly string[]): ProbeTitle[];
export function checkProbeNames(input: ProbeNamesInput): string[];
```
- typescript line rule: `/^[ \t]*(?:test|it)\(\s*(["'`])(.*?)\1/` on each line; the title matches
  `/^(.+) example (\d+)(?::.*)?$/` → `{function: m[1], n: Number(m[2])}`.
- go line rule: `/^func TestProbe([A-Za-z0-9_]+)Example(\d+)\(/`; the function is the first of `names` whose
  `pascalName` equals the capture with letter case ignored (`TestProbePMToolsExample1` names "PM Tools", MorphStudio's form), else the capture itself.
- the line texts (`<numbers>` = distinct numbers ascending joined by `", "`):
  - `card '<id>': probe <path> lacks <F> example <numbers> (the record gives <count>)`
  - `card '<id>': probe <path> names <F> example <numbers>, not an example of its Functions (<own names joined by ", ", or none>)`
  - `card '<id>': probe <path> names <F> example <numbers>, which the record does not give`

**`src/criterion/defaultChecks.ts`** (Default Checks):
```ts
import { probeFile } from "../builder/buildAcceptances.js";
import { hasExtension, testTarget } from "../language/paths.js";
import { checkProbeNames } from "./probeNames.js";
import type { Card } from "../cards/types.js";
import type { CheckCard, Checks, JudgeFile } from "../builder/types.js";
import type { Example } from "../contour/types.js";
import type { LanguageProfile } from "../language/types.js";
import type { CardCriterion } from "../planner/types.js";
import type { ExampleCount } from "./probeNames.js";
export interface DefaultChecksInput {
  checks: Checks; cards: Card[]; all: string[]; criteria: Record<string, CardCriterion>; profile: LanguageProfile;
  mapAcceptance: string[]; hasFile: (path: string) => boolean; record: ExampleCount[];
  probes: Record<string, string>; readProbe: (id: string) => string | null;
}
export type DefaultChecksResult =
  | { ok: true; checks: Checks; probes: Record<string, string>; overrides: string[] }
  | { ok: false; message: string };
export function thenLiterals(examples: readonly Example[]): string[];
export function defaultChecks(input: DefaultChecksInput): DefaultChecksResult;
```
The rules are the record's (criterion / Default Checks); the messages:
- `checks override '<id>' is not a card of the cut`
- `checks override '<id>': files given for a code card`
- `checks override '<id>': smoke or extra given for a judge`
- `checks override '<id>': <file> is not a target of the judge`
- `judge '<id>' writes <n> test files: give min and max of <file> in checks.json overrides`
- `judge '<id>' <file>: min <min> exceeds max <max>`
- the two headers: `checks defaults not built (<n> error|errors):\n` and `probe names differ from the record (<n> problem|problems):\n`, each followed by its lines joined by `"\n"`;
- the override lines: `<id>: <field> from checks.json` (a judge with one file) and `<id> <file>: <field> from checks.json` (several), field order min, max, lits.
- the probe path in the name lines: `checks.parts + "/" + probeFile(profile, id)` (`decks/m1/parts/_clamp-value_probe_test.go`).

**`src/cli/planCommand.ts`** (Plan Command, record P35a sentence): in the `args.checks` branch, right after the
`--only` filter of checks and before `planNotes`, call `defaultChecks({checks, cards: plan.cards, all:
planned.plan.cards.map((c) => c.customId), criteria: planned.criteria, profile: profiled.profile, mapAcceptance:
the overridden ids (compute the existing `overridden` set before this call and reuse it below), hasFile, record:
every Function of record.system.groups in order as {name, count: examples.length}, probes: read.texts.probes,
readProbe: (id) => the UTF-8 text of path.resolve(root, checks.parts, probeFile(profile, id)) when a regular file,
else null})`; not ok → `{code: 2, document: errorDocument(2, "DeckError", message)}`; ok → `checks = d.checks`,
the texts passed to Build Acceptances are `{...read.texts, probes: d.probes}`, `overrides = d.overrides`. The
document gains `...(overrides.length > 0 ? { overrides } : {})` between proseOnly and warnings. Everything else —
messages, order, the old form's output — stays.

| example | what it pins |
|---|---|
| Read Checks 3, 4 (changed) | the root table ends with overrides; `{}` → only "phase: required" |
| Read Checks 5, 6 | the cut form typed; its problems |
| Plan Spec 9 | criteria on go-mini and on the ledger (group, Interface, extra card, its judge) |
| Probe Names 1–4 | titles (TS and Go), strict and old-form lines |
| Default Checks 1–5 | defaults on go-mini, overrides, errors, the old form untouched, several judge files, thenLiterals |
| Plan Command 21–23 | the cut form = the old form with the defaults byte for byte; drift → exit 2; --only |

### 2.3. Names and the tests each judge writes

- `tests/criterion/probeNames.examples.test.ts` (new): Probe Names examples 1–4.
- `tests/criterion/defaultChecks.examples.test.ts` (new): Default Checks examples 1–5.
- `tests/builder/readChecks.examples.test.ts` (patched: example 4's `{}` expectation only) and
  `tests/builder/readChecks.p35.examples.test.ts` (new): Read Checks examples 5 and 6.
- `tests/planner/plan.p35.examples.test.ts` (new): Plan Spec example 9.
- `tests/cli/planCommand.p35.examples.test.ts` (new): Plan Command examples 21–23.
Each test named "<Function> example <N>: <what>".

### 2.4. What must not break

Every acceptance of an old-form checks document byte for byte: the identity corpus
(`tests/gate/identity.examples.test.ts`, 5 entries), the Plan Command goldens (6, 19, 20 and the rest), Build
Acceptances' goldens. The full suite green.

## 3. Acceptance

Built by `morph plan --checks decks/p35a/checks.json --only …` (a transaction deck); the probes in
`decks/p35a/parts/`, the stubs in `decks/p35a/_stubs/`.

## 4. Constraints

NodeNext (`.js` in relative imports, `import type` for types); no `any`; `src/criterion/*` pure: no `node:*`
import, no file read, no clock, no environment (the file reads stay in Plan Command); tests from
`tests/helpers.ts` only, a test writes only under `tmpRoot()` and removes it; a judge writes only its test files.

## 7. Out of scope

- **P35b**: `morph plan --write-probes` (Parse Command's flag, a probe skeleton writer in criterion, Plan Command
  writing the skeletons of code cards without a probe; TS `decks/<p>/parts/<id>.probe.ts`, Go
  `_<id>_probe_test.go`).
- The old form's defaults: a judge missing from a `cards` list stays without a built acceptance and without a note
  (Plan Command 6's golden lists 2 of 17 cards); the old form gets only the name check of titles the record does not
  give (p15 and the golden of Plan Command 6 hold fewer titles than examples).
- `documentation/ORCHESTRATOR_REFERENCE.md` §2 (root keys, the cut form) — after the merge, with `refcheck.mjs`.
- The skill's §4.5 and §4.7 (probes and judge bounds) for the cut form — the operator's session.
