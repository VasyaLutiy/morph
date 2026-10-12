# TASK_P35b — issue #45 (part b): `morph plan --write-probes` writes the probe skeletons (`src/criterion/probeSkeleton.ts`, `src/cli/{types,parse,planCommand}.ts`)

## 1. Why this

P35a made the record's examples check a probe's titles; the orchestrator still types every probe from scratch. P35b
writes the skeleton: one test per example of the card's Functions, named as Probe Names reads it, the example's
given/ref/when/then as comments, a body that fails until the orchestrator writes it (#45 "Must hold" 1). The
skeleton is written by `morph plan --checks <f> --write-probes`, for the code cards of the checks document that have no
probe yet; that call writes no deck. A second `plan` without the flag cuts the deck with the probes the orchestrator
filled in.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Probe Skeleton input** `{id, profile, functions, targets}`: `functions` = the card's Card Criterion functions
  (`planned.criteria[id].functions`, `{name, examples: Example[]}` — `src/planner/types.ts`, `src/contour/types.ts`:
  `Example {given, when, then: string; ref: string | null}`), `targets` = the plan card's targets.
- Fixtures (all under `tests/fixtures/`):
  - `criterion/examples.json["Probe Skeleton 1..3"]`; `criterion/skeleton1.input.json` (I1: id "ab", functions A B
    with 2 examples — the first given holds runs of spaces and newlines, the second a ref — and C with 1, targets);
    `criterion/skeleton1.probe.ts.txt` and `criterion/skeleton2.probe.go.txt` (the expected texts, byte for byte);
    `criterion/goMini.criteria.json` (existing: `["clamp-value"].functions` = Clamp Value, 4 examples).
  - `cli/parseArgv.json["26"]` / `cli/parse.json["26"]`: nine argv lists and their results.
  - `cli/examples.json["Plan Command 24", "Plan Command 25"]`; `cli/flags.json` gains `--write-probes` (bare, plan).
- **The Plan Command harness** (examples 24–25): the harness of `tests/cli/planCommand.p35.examples.test.ts`
  (P35a §2.1: the MINI files from `fixture("go-mini/" + f)`, `decks/tools/guard.mjs` "// guard\n",
  `decks/tools/firstdiff.mjs` "// firstdiff\n", `decks/m1/checks.json` from the example's fixture) WITHOUT
  `decks/m1/parts/_clamp-value_probe_test.go`; args `{name: "plan", root: ".", pretty: false, spec: "contour.yaml",
  components: ["calc", "report"], map: "morph-map.json", judge: true, checks: "decks/m1/checks.json", out: null,
  writeProbes: true}`.

### 2.2. OUTPUT data shapes

**`src/criterion/probeSkeleton.ts`** (Probe Skeleton, record criterion):
```ts
import { codeTargets } from "../language/paths.js";
import { pascalName } from "./probeNames.js";
import type { Example } from "../contour/types.js";
import type { LanguageProfile } from "../language/types.js";
export interface SkeletonInput { id: string; profile: LanguageProfile; functions: { name: string; examples: Example[] }[]; targets: string[] }
export function probeSkeleton(input: SkeletonInput): string;
```
The text, line by line (lines joined by `"\n"`, plus a last `"\n"`); `C1`, `C2` and the value lines as the record
gives them. TypeScript (every profile but go):
```
// Probe of card 'ab', written by morph plan --write-probes: one test per example of its Functions.
// Write each body from its example; until you do, it fails.
import { expect, test } from "vitest";

test("A B example 2", () => {
  // given: x 0
  // ref: tests/fixtures/ab.json
  // when: added
  // then: 0 — nothing to add
  throw new Error("probe ab: write A B example 2");
});
```
Go (`profile.id === "go"`), a tab before each body line:
```
package calc

// Probe of card 'clamp-value', written by morph plan --write-probes: one test per example of its Functions.
// Write each body from its example; until you do, it fails.

import "testing"

func TestProbeClampValueExample1(t *testing.T) {
	// given: v 5, lo 0, hi 3
	// when: clamped
	// then: 3
	t.Fatal("probe clamp-value: write Clamp Value example 1")
}
```
No example in any Function: the one test `test("<id> probe", …)` / `func TestProbeOwn(t *testing.T)` of the record
(`examples.json["Probe Skeleton 3"]` gives the four texts whole).

**`src/cli/types.ts`** — `PlanArgs` gains a last optional key: `writeProbes?: true`.

**`src/cli/parse.ts`** (Parse Command): `--write-probes` is a bare flag (the unknown-flag check accepts it, no value)
and plan takes it (`PLAN_FLAGS`). In the plan branch, after the `--only` check: `--write-probes` given without
`--checks` → 4 UsageError `"--write-probes needs --checks"`; given with `--out` → 4 UsageError `"--write-probes writes
no deck: drop --out"`. The command gains `writeProbes: true` as its LAST key, only when the flag is given (after
`checks` and `only`). Nothing else changes: every other command and message as now.

**`src/cli/planCommand.ts`** (Plan Command): in the `args.checks` branch, right after `overrides = d.overrides;` and
before `planNotes`:
```ts
if (args.writeProbes === true) {
  const probes: string[] = [];
  for (const c of checks.cards) {
    if (c.files !== null || d.probes[c.id] !== undefined) continue;
    const rel = checks.parts + "/" + probeFile(profiled.profile, c.id);
    // text = probeSkeleton({ id: c.id, profile: profiled.profile,
    //   functions: planned.criteria[c.id]?.functions ?? [],
    //   targets: plan.cards.find((k) => k.customId === c.id)?.targets ?? [] })
    // write it to path.resolve(root, rel), parents created; probes.push(rel)
  }
  return { code: 0, document: { spec: plan.spec, components: plan.components, probes } };
}
```
No acceptance built, no deck written, no other key in that document. Without `writeProbes` everything stays as it is.

| example | what it pins |
|---|---|
| Probe Skeleton 1 | the TypeScript text, the ref line, whitespace collapsed; its titles pass the strict name check |
| Probe Skeleton 2 | the Go text of go-mini's clamp-value (package calc); probeTitles reads 1..4 back |
| Probe Skeleton 3 | no example: TS and Go; Go package main (root file, no target) and b (`a/b/c.go`, the test target skipped) |
| Parse Command 26 | the flag, its two refusals, given twice, other commands, order of checks |
| Plan Command 24 | the skeleton written, then cut with it, never overwritten |
| Plan Command 25 | a Default Checks error writes nothing; the old form writes the skeleton too |

### 2.3. Names and the tests each judge writes

- `tests/criterion/probeSkeleton.examples.test.ts` (new): Probe Skeleton examples 1–3.
- `tests/cli/parse.p35b.examples.test.ts` (new): Parse Command example 26.
- `tests/cli/planCommand.p35b.examples.test.ts` (new): Plan Command examples 24 and 25.
Each test named "<Function> example <N>: <what>".

### 2.4. What must not break

`plan` without `--write-probes`: every document, deck and message byte for byte (the Plan Command goldens, the identity
corpus `tests/gate/identity.examples.test.ts`). Every Parse Command example 1–25. The full suite green.

## 3. Acceptance

Built by `morph plan --checks decks/p35b/checks.json --only …` (a transaction deck); the probes in
`decks/p35b/parts/`, the stubs in `decks/p35b/_stubs/`.

## 4. Constraints

NodeNext (`.js` in relative imports, `import type` for types); no `any`; `src/criterion/*` pure: no `node:*` import,
no file read, no clock, no environment (the file writes stay in Plan Command); tests from `tests/helpers.ts` only, a
test writes only under `tmpRoot()` and removes it; a judge writes only its test files.

## 7. Out of scope

- Filling the probe bodies (the orchestrator); a skeleton for a judge card; overwriting an existing probe.
- The cut form's strict name check of a re-cut (patch) card's probe: it asks for every example of the Function, so a
  phase re-cutting an existing Function keeps the old form (this phase does). Found in P35b prep; for #45.
- `docs/ORCHESTRATOR_REFERENCE.md` §2–§3 (the cut form, `--write-probes`) and the skill's §4.5 — after the merge.
- The cli Component's size: the record of cli is 30 935 bytes after this phase (cap 30 000); splitting it is #48's.
