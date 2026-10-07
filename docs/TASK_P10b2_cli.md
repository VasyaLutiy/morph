# TASK_P10b2 — `morph plan --checks`: V2 builds its own acceptances (Component `cli`)

> Phase P10b2 of `docs/PLAN.md` ("Фазы по записи (после P2)", row P10b2; DECISIONS "P10b · split"). Component
> `cli` of `contour.yaml`: Parse Command gains `--checks`, a new Function Read Plan Checks reads the checks
> document, the guard, the locator and the probes from disk, and Plan Command calls Build Acceptances (Component
> `builder`, P10b1) after Plan Spec; the map's acceptance override still wins. Component `builder` is not changed.
> The deck is cut by V2 (`node dist/cli.js plan --component cli`), filtered to this phase's six cards; its own
> acceptances still come from `decks/tools/build.py p10b2` through the map — the last phase built there.
> `build.py` is archived after this phase's run (not by the preparing orchestrator).
>
> Issues labelled `P10b2-cli` / `P10b2-builder`: none (07.10). Issue #3 (label `P10-planner`) is background: its
> lesson 1 (the judge harness skeleton generated from `tests/helpers.ts`) is deferred, see §7.

## 1. Why this

- **`build.py` is 759 lines of hand-written Python** and writes the acceptance of every card into
  `morph-map.json`: **96 acceptances, 1 705 931 of the map's 1 938 513 bytes (88 %)**. P10b1 put the same
  builder in TypeScript (`src/builder/`, 10/10 cards, Build Acceptances 1 = the P10a deck byte for byte), but
  nothing calls it: 0 callers outside its tests. Until `morph plan` calls it, every phase still needs the Python.
- **Measured on a scratch reference of this phase:** `morph plan --checks decks/p10/checks.json` on this
  repository (map = the 12 P10a entries without acceptances) gives the 12 P10a acceptances byte for byte once the
  guard text is the live one, and equals `python3 build.py p10` run today **12 / 12**; `--checks
  decks/p10b/checks.json` with the map's acceptances stripped equals the P10b1 deck **9 / 10**, the tenth
  (`compose-judge`) differing only by §2.2 "Intended differences" 3 of TASK_P10b (`"é"` kept, `build.py` wrote
  `"é"`).
- **Ripple 0.** The new PlanArgs key is optional and absent without `--checks`, so the 563 tests stay green with
  no test file patched or deselected (measured on the reference; P10a's two-file ripple is not repeated).

PLAN: P10b2 = 6 cards (3 code, 3 judges), 3 generations, 8 new record examples (Parse Command 12–13, Read Plan
Checks 1–3, Plan Command 6–8).

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **PlanArgs, Command, ParseResult, CommandResult** — `src/cli/types.ts` (P7, P10a). `CommandResult` = `{ code:
  ExitCode; document: unknown }`, `ExitCode` = `0 | 1 | 2 | 3 | 4`. `errorDocument(code, kind, message)` of
  `src/cli/document.ts` = `{error: {code, kind, message}}`.
- **parseDocument(text: string, name: string): DocResult** — `src/contour/load.ts` (P9, exported). `DocResult` =
  `{ ok: true; doc: Record<string, unknown> } | { ok: false; error: string }`. A name not ending in `.yaml` /
  `.yml` is parsed with `JSON.parse`; a throw → `"cannot parse <name>: <the message>"`; not a plain object →
  `"<name> is not a mapping at the top level"`.
- **validateChecks(doc: unknown): ChecksResult**, **DEFAULT_FROZEN** — `src/builder/readChecks.ts` (P10b1).
  **Checks, BuildTexts, BuildInput, BuildResult, CardContext, JudgeFile** — `src/builder/types.ts`:
  `ChecksResult = { ok: true; checks: Checks } | { ok: false; problems: string[] }`; `BuildTexts = { guard:
  string; firstdiff: string; probes: Record<string, string> }`; `BuildResult = { ok: true; cards: Card[] } | {
  ok: false; errors: string[] }`.
- **buildAcceptances(input: BuildInput): BuildResult** — `src/builder/buildAcceptances.ts` (P10b1);
  `BuildInput = { cards: Card[]; checks: Checks; profile: LanguageProfile; texts: BuildTexts }`.
  **codeAcceptance(ctx, probe, smoke, extra)**, **judgeAcceptance(ctx, files)** — `src/builder/compose.ts`.
- **resolveProfile(componentLanguage: string | null, mapLanguage: string | null): ProfileResult** —
  `src/language/profiles.ts`; `ProfileResult = { ok: true; profile: LanguageProfile } | { ok: false; error: string }`.
- **ContourMap** — `src/contour/types.ts`: `cards: MapCard[]` (`id: string`, `customId: string | null`,
  `acceptance: string | null`, …) and `extraCards: ExtraCard[]` (`customId: string | null`, `acceptance: string
  | null`, …). In the map file these are `cards` keyed by id with `custom_id`, and `extra_cards`.

**The imports of the code** (copy only what the file uses):

```ts
// src/cli/readPlanChecks.ts
import fs from "node:fs";
import path from "node:path";
import { parseDocument } from "../contour/load.js";
import { validateChecks } from "../builder/readChecks.js";
import { errorDocument } from "./document.js";
import type { BuildTexts, Checks } from "../builder/types.js";
import type { CommandResult } from "./types.js";
// src/cli/planCommand.ts gains
import { buildAcceptances } from "../builder/buildAcceptances.js";
import { resolveProfile } from "../language/profiles.js";
import { readPlanChecks } from "./readPlanChecks.js";
```

**Fixtures** (`tests/fixtures/cli/`, read with `fixture` / `fixtureJson` of `tests/helpers.ts`):

| file | type | what it is | used by |
|---|---|---|---|
| `p1.checks.json` | a checks document (text) | phase p1, cards a, b (code) and a-judge (one file `tests/a.examples.test.ts`, min 1, max 9) | Read Plan Checks 1–2 (written to `decks/p1/checks.json` of a tmp root) |
| `p1.planChecks.json` | JSON object, a whole `PlanChecksResult` | `{ok: true, checks, texts}` of Read Plan Checks 1: every Read Checks default filled; texts guard `"// guard\n"`, firstdiff `"// firstdiff\n"`, probes `{a: "// probe a\n"}` only (b has no file; a judge's probe is not read) | Read Plan Checks 1 |
| `l1.checks.json` | a checks document (text) | phase l1, cards ledger-types, parse (code) and parse-judge (one file `tests/ledger/parse.examples.test.ts`, min 1, max 9) | Plan Command 6 (written to `decks/l1/checks.json`) |
| `p10.map.json` | a map (text) | the P10a map entries of the 12 P10a cards: `groups` render, cut-component, plan-spec; per card `targets` and `depends_on`; **no acceptance** | Plan Command 8 (read in place under the repository root) |

Plan Command 8 also reads, in place: `contour.yaml`, `decks/p10/checks.json` (= `tests/fixtures/builder/p10.checks.json`),
`decks/p10/parts/*.probe.ts`, `decks/tools/guard.mjs`, `decks/tools/firstdiff.mjs`, `decks/p10/v2deck.json` (the
P10a deck: 12 cards, acceptances by `build.py p10` with the guard of `tests/fixtures/builder/guard.p10.txt`).

**What each judge imports** (copy only the lines your file uses; eslint rejects an unused import or constant):

```ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "vitest";
import { parseCommand } from "../../src/cli/parse.js";
import { readPlanChecks } from "../../src/cli/readPlanChecks.js";
import { planCommand } from "../../src/cli/planCommand.js";
import { codeAcceptance, judgeAcceptance } from "../../src/builder/compose.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import { TYPESCRIPT } from "../../src/language/profiles.js";
import { loadDeck } from "../../src/cards/model.js";
import type { CardContext } from "../../src/builder/types.js";
import type { Card } from "../../src/cards/types.js";
import type { CommandResult, PlanArgs, PlanDocument } from "../../src/cli/types.js";
import type { Plan } from "../../src/planner/types.js";
import { fixture, fixtureJson, tmpRoot } from "../helpers.js";
import type { TmpRoot } from "../helpers.js";
```

**The harness, verbatim** (Read Plan Checks judge: `p1Root`; Plan Command judge: `REPO`, `l1Root`, `args`,
`ctx`, `JUDGE_FILE`; delete what your file does not use):

```ts
const REPO = fileURLToPath(new URL("../..", import.meta.url));
function p1Root(): TmpRoot {
  const r = tmpRoot();
  r.write("decks/p1/checks.json", fixture("cli/p1.checks.json"));
  r.write("decks/tools/guard.mjs", "// guard\n");
  r.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
  r.write("decks/p1/parts/a.probe.ts", "// probe a\n");
  r.write("decks/p1/parts/a-judge.probe.ts", "// no\n");
  return r;
}
function l1Root(): TmpRoot {
  const r = tmpRoot();
  r.write("ledger.yaml", fixture("planner/ledger.yaml"));
  r.write("ledger.map.json", fixture("planner/ledger.map.json"));
  r.write("tests/helpers.ts", "export {};\n");
  r.write("decks/tools/guard.mjs", "// guard\n");
  r.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
  r.write("decks/l1/checks.json", fixture("cli/l1.checks.json"));
  r.write("decks/l1/parts/parse.probe.ts", "// probe\n");
  r.write("decks/l1/parts/ledger-types.probe.ts", "// probe\n");
  return r;
}
const args = (over: Partial<PlanArgs>): PlanArgs => ({ name: "plan", root: ".", pretty: false, spec: "ledger.yaml",
  components: ["ledger", "store"], map: "ledger.map.json", judge: true, out: "decks/p.json", checks: "decks/l1/checks.json", ...over });
const ctx = (over: Partial<CardContext>): CardContext => ({
  id: "parse", phase: "l1", targets: ["src/ledger/parse.ts"], siblings: ["src/ledger/types.ts"], frozen: DEFAULT_FROZEN,
  fullExclude: [], ownGit: false, profile: TYPESCRIPT, guard: "// guard\n", firstdiff: "// firstdiff\n", ...over,
});
const JUDGE_FILE = { file: "tests/ledger/parse.examples.test.ts", min: 1, max: 9, lits: [], drop: [], new: false };
```

**A judge's setup across Components** (TASK_TEMPLATE §2.1):

- **F1** planner · `fixtureJson("planner/ledger.plan.json") as Plan` is exactly Plan Command's document for the
  args of example 1 without checks (P10a). Its card `parse` is the map's `parse-entry` renamed (`custom_id`), with
  no acceptance in the map; `ledger-types` is an extra card whose map acceptance is `"exit 0\n"`; `parse-judge`
  depends on `parse` and `checks` (not a checks member: ignored), so it is generation 1 alone (siblings `[]`),
  and `parse`, `ledger-types` are generation 0 (`parse`'s siblings `["src/ledger/types.ts"]`).
- **F2** builder · `codeAcceptance(ctx, probe, smoke, extra)` and `judgeAcceptance(ctx, files)` are accepted code
  (P10b1). Plan Command 6 expects `parse`'s acceptance `codeAcceptance(ctx({}), "// probe\n", null, null)` and
  `parse-judge`'s `judgeAcceptance(ctx({ id: "parse-judge", targets: [JUDGE_FILE.file], siblings: [] }),
  [JUDGE_FILE])`: the expected value is built by the function the code under test calls.
- **F3** Plan Command 6's whole expected document: `{ ...plan, cards, out: "decks/p.json" }` with `plan` the
  fixture and `cards` = `plan.cards` with those two acceptances replaced; the deck file is
  `JSON.stringify(cards, null, 2) + "\n"`.
- **F4** cards · `loadDeck(text)` returns `{ok: true, deck}` or `{ok: false, faults}`: narrow it (`if (!d.ok)
  throw …`) before `d.deck.cards`. Plan Command 8: `oldGuard = fixture("builder/guard.p10.txt").trimEnd()`,
  `liveGuard = fs.readFileSync(path.join(REPO, "decks/tools/guard.mjs"), "utf8").trimEnd()`; for each card of
  v2deck.json, the document's card of that customId has acceptance `(card.acceptance ?? "").split(oldGuard).join(liveGuard)`.
  The call: `planCommand(REPO, { name: "plan", root: ".", pretty: false, spec: "contour.yaml", components:
  ["planner", "cli"], map: "tests/fixtures/cli/p10.map.json", judge: true, out: null, checks:
  "decks/p10/checks.json" })`; it writes nothing.
- **F5** Node's JSON message is not pinned: Read Plan Checks 3's first case is checked with
  `startsWith("cannot parse c.json: ")` on the message, code 2 and kind "DeckError".

### 2.2. OUTPUT data shapes

**`src/cli/types.ts`** — PlanArgs gains one optional last member, nothing else changes:

```ts
export interface PlanArgs {
  name: "plan"; root: string; pretty: boolean; spec: string; components: string[]; map: string | null;
  judge: boolean; out: string | null; checks?: string;
}
```

**`src/cli/parse.ts`** — `--checks` joins VALUE_FLAGS (it takes the next token whatever it is) and PLAN_FLAGS
(deck check and run answer "flag --checks does not apply to <command>"). The plan command is built as today with
one more spread after `out`: `...(values.has("--checks") ? { checks: values.get("--checks") ?? "" } : {})` — the
key exists only when `--checks` is given and is then the last key. Every other check, message and default stays.

**`src/cli/readPlanChecks.ts`** — exports exactly:

```ts
export const GUARD_PATH = "decks/tools/guard.mjs";
export const LOCATOR_PATH = "decks/tools/firstdiff.mjs";
export type PlanChecksResult = { ok: true; checks: Checks; texts: BuildTexts } | { ok: false; result: CommandResult };
export function readPlanChecks(root: string, checksPath: string): PlanChecksResult;
```

`readPlanChecks(root, checksPath)`, in this order; every failure is `{ok: false, result: {code, document:
errorDocument(code, kind, message)}}`; "a regular file" = `fs.statSync(abs).isFile()`, a throw = not one:

1. `abs = path.resolve(root, checksPath)` (an absolute checksPath ignores root) not a regular file → 4
   "UsageError" `"checks file not found: " + checksPath` (as given).
2. `parseDocument(fs.readFileSync(abs, "utf8"), checksPath)` not ok → 2 "DeckError" with its `error` verbatim.
3. `validateChecks(doc)` not ok → 2 "DeckError" `checksPath + " is not a valid checks document (" + n + " problem"
   + (n === 1 ? "" : "s") + "):\n" + problems.join("\n")`, every problem listed.
4. `path.resolve(root, GUARD_PATH)` not a regular file → 4 "UsageError" `"guard file not found: decks/tools/guard.mjs"`;
   then `path.resolve(root, LOCATOR_PATH)` → `"locator file not found: decks/tools/firstdiff.mjs"`.
5. probes: for each card of `checks.cards` in order with `files === null`, `path.resolve(root, checks.parts, id +
   ".probe.ts")`; when a regular file, `probes[id]` = its UTF-8 text; else nothing (Build Acceptances reports
   "code card '<id>' has no probe"). A judge card's probe is never read.
6. → `{ok: true, checks, texts: {guard, firstdiff, probes}}`, guard and firstdiff the files' UTF-8 texts whole
   (no trimming). Nothing is written.

**`src/cli/planCommand.ts`** — unchanged up to a successful Plan Spec (`plan = planned.plan`). Then, only when
`args.checks !== undefined`:

1. `read = readPlanChecks(root, args.checks)`; `!read.ok` → return `read.result`.
2. `profile = resolveProfile(null, map.language)` (`map` = the loaded map or EMPTY_MAP); `!ok` → code 2 "DeckError"
   `"the map: " + error` (unreachable after Plan Spec, kept for the type).
3. `built = buildAcceptances({cards: plan.cards, checks: read.checks, profile, texts: read.texts})`; `!built.ok` →
   code 2 "DeckError" `"acceptances not built (" + n + " error" + (n === 1 ? "" : "s") + "):\n" +
   errors.join("\n")`.
4. The map's override wins: the set of ids `m.customId ?? m.id` of every `m` of `map.cards` with `m.acceptance !==
   null`, plus `e.customId` of every `e` of `map.extraCards` with `e.acceptance !== null` and `e.customId !==
   null`. `cards = built.cards.map((c, i) => set.has(c.customId) ? plan.cards[i] : c)`.

The deck file (`args.out`) and the document's `cards` are these cards (without checks: `plan.cards`, as today);
`spec`, `components`, `generations`, `externalDependsOn`, `out` stay the plan's. Every failure returns before the
deck file is written. The document's shape does not change (no checks key).

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P10b2 cli"):

- `checks?: string`, absent without the flag — not `checks: string | null`: the old parse and planCommand tests
  compare whole commands and build PlanArgs literals; an optional key leaves all of them green (ripple 0).
- The guard and the locator are fixed paths under the root (GUARD_PATH, LOCATOR_PATH), not keys of the checks
  document and not flags: Read Checks (P10b1) stays byte for byte (its typed fixtures and the "known:" key table
  are compared whole by its judge); every phase uses the repository's one guard.
- The checks are read after Plan Spec: a record or map error is reported first; nothing is written on any error.
- The profile is the map's (`resolveProfile(null, map.language)`): Build Acceptances takes one profile; a python
  map answers the builder's own error.
- "The map's override wins" is decided from the map entries, not from the planned card (every planned card has an
  acceptance: the profile's default template when the map has none).
- A probe file missing on disk is left out, not an error of the reader: Build Acceptances names it with the other
  errors in one message.

### 2.3. Names and the tests each judge writes

| module | code card | judge's test (new file) |
|---|---|---|
| `src/cli/types.ts`, `src/cli/parse.ts` | parse-command | `tests/cli/parseChecks.examples.test.ts`: Parse Command 12–13 = 2 |
| `src/cli/readPlanChecks.ts` | read-plan-checks | `tests/cli/readPlanChecks.examples.test.ts`: Read Plan Checks 1–3 = 3 |
| `src/cli/planCommand.ts` | plan-command | `tests/cli/planChecks.examples.test.ts`: Plan Command 6–8 = 3 |

A code card covered by a probe writes **no test file**. Each judge writes ONE NEW file holding only the new
examples of its Function (the older examples stay in `parse.examples.test.ts` and `planCommand.examples.test.ts`,
untouched). One `test(...)` per example in record order, named `<Function> example <n>: <what>`, then at most 8
of its own. Compare a whole result with `toStrictEqual` (a ParseResult, a PlanChecksResult, a CommandResult);
strings with `toBe`.

**A judge's own tests** (P10a, issue #3 lesson 2): an own test asserts only a value this spec PRINTS for that
exact input (a literal of §2.2, the record or a fixture); zero own tests is allowed. An example's input and its
expected value come from the same helper or fixture, never from two hand copies.

**Typing traps** (tsc strict): `fixtureJson` returns `unknown` — pass it straight into `toStrictEqual`, cast only
to read or pass a field (`fixtureJson("planner/ledger.plan.json") as Plan`); every result is a union, compare it
whole or narrow first (`r.ok ? … : …`); `CommandResult.document` is `unknown`: cast to `PlanDocument` only after
`code` is 0; no `any`; import only what you use.

### 2.4. What must not break

- Every file outside the six targets byte for byte; the **563** tests stay green (ripple 0 measured on the
  reference: no deselected file).
- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/` — untouched by every card.
- Without `--checks`, `morph plan` is byte for byte P10a's (Plan Command 1–5 stay green).

## 3. Acceptance

Built by `decks/tools/build.py p10b2` (`locate` and `full_report` on) into the `acceptance` of every card in
`morph-map.json`; `morph plan` copies it onto the card as an override. Narrow to broad; the first red is the
regeneration's diagnosis.

Code cards (no test file): `probe/<card>/` with the guard, the locator, a vitest config and `tsconfig.card.json`
(the project minus the other targets of the same generation) → `tsc` → `eslint <targets>` (verdict held) →
`guard.mjs src <targets>` (layer `cli`) → `decks/p10b2/parts/<card>.probe.ts` (every new record example of the
card's Function, values and types, then the §2.2 rows: parse-command 2 + 3 = 5, read-plan-checks 3 + 4 = 7,
plan-command 3 + 4 = 7; 19 tests) → eslint's verdict → full `vitest run` → frozen → untracked.

Judge cards: `probe/<card>/` (no probe file) → `tsc` → `eslint <file>` → `guard.mjs tests <file> <min> <max>
lits0.json` (min = the new examples, max = min + 8): parseChecks 2..10, readPlanChecks 3..11, planChecks 3..11;
literals: parseChecks `decks/p1/checks.json`, `flag --checks does not apply to run`, `flag --checks needs a
value`, `flag --checks given twice`, `Parse Command example 13`; readPlanChecks `p1.checks.json`,
`p1.planChecks.json`, `checks file not found: nope.json`, `guard file not found: decks/tools/guard.mjs`, `locator
file not found: decks/tools/firstdiff.mjs`, `cannot parse c.json: `, `is not a valid checks document (2
problems)`; planChecks `l1.checks.json`, `exit 0`, `acceptances not built (1 error)`, `checks card 'zz' is not in
the deck`, `p10.map.json`, `v2deck.json`, `guard.p10.txt`, `decks/p10/checks.json` → `vitest run <file>` →
eslint's verdict → full run → frozen → untracked.

**Output budget per card** (`max_tokens`): code = the reference target in tokens (≈ bytes / 3.5) × 2 + 2 500
reasoning, rounded up with margin; judges ≥ 20 000 (the judge with the most examples, plan-command's 8, 24 000).

| card | reference target | `max_tokens` |
|---|---|---|
| parse-command | types.ts 1.6 KB + parse.ts 7.6 KB ≈ 2 630 tok | 14 000 |
| read-plan-checks | readPlanChecks.ts 2.2 KB ≈ 630 tok | 10 000 |
| plan-command | planCommand.ts 3.9 KB ≈ 1 110 tok | 14 000 |
| parse-command-judge | ≈ 1.5 KB | 20 000 |
| read-plan-checks-judge | ≈ 2.5 KB | 20 000 |
| plan-command-judge | ≈ 3.5 KB | 24 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- **Layer** `cli` (guard: imports anything; `process` and `console` only in `src/cli.ts`; no `Date.now` outside
  it). `readPlanChecks.ts` reads files with `node:fs` (`statSync`, `readFileSync`) and writes none; `planCommand.ts`
  writes only the deck file, as today.
- Tests read fixtures only through `fixture` / `fixtureJson`; a test writes only under a `tmpRoot()` and removes
  it in `finally`; Plan Command 8 and the probes read the repository, never write it. A judge writes only its
  test file and never the module it tests.
- A file a card writes is in no sibling's slice in the same generation: read-plan-checks does not read
  `src/cli/types.ts` (parse-command writes it in generation 0; `CommandResult` is quoted in §2.1). Dependencies:
  plan-command on parse-command (`args.checks`) and read-plan-checks; each judge on its code card.
- Exact strings of the record and §2.2 (every message): the executor copies them.

## 7. Out of scope

- **The judge harness skeleton generated from `tests/helpers.ts`** (issue #3, P10a lesson 1) — deferred to P11 or
  later: it needs the syntax tree of the helpers (the package `typescript` in a pure layer, a new runtime
  dependency against Requirement Node Only) or an eslint override for judge files, a contract of its own; P10b1's
  form (import lines + verbatim helpers in §2.1, "delete what you do not use") gave 10 / 10 with no fix.
- **Archiving `decks/tools/build.py`** — after this phase's run, by the session that records it (this deck's own
  acceptances come from it).
- A card filter in `morph plan` (`--card`): the cut of Component cli gives 14 cards; a committed script
  `decks/p10b2/filter.py` keeps the six.
- Deriving the judge bounds and literals from the record; a `checks` key in the Plan Document; python acceptances.

## 8. How to run

```
python3 decks/tools/build.py p10b2
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component cli --judge --out decks/p10b2/deck.json
python3 decks/p10b2/filter.py decks/p10b2/deck.json          # keeps the 6 cards of the phase
node dist/cli.js deck check --root . --deck decks/p10b2/deck.json                                 # errors 0
rm -rf /tmp/v2bin-p10b2 && mkdir -p /tmp/v2bin-p10b2 && cp -r dist /tmp/v2bin-p10b2/ && ln -s $PWD/node_modules /tmp/v2bin-p10b2/node_modules
node /tmp/v2bin-p10b2/dist/cli.js run --root . --deck decks/p10b2/deck.json --processor glm53 --max-retry-batches 8 --deadline 2400
```

Cross-check (dry): from `morph-lab`, `venv/bin/mrph plan --spec <repo>/contour.yaml --map <repo>/morph-map.json
--component cli --judge --root <repo>`.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 6 (3 code, 3 judges) / 3: [parse-command, read-plan-checks] [parse-command-judge, plan-command, read-plan-checks-judge] [plan-command-judge] |
| executor bill | ≈ $0.06 nominal (≈ 9 first requests of ≈ 15–25k in / 2–5k out; ≈ 3 retries), ≤ $0.30 with a re-cut; cap $5 |
| cards with regeneration | 2 of 6 (plan-command: the override set or the error plural; plan-command-judge: the golden setup) |
| tests after the run | 563 + 3 judge files (8 example tests + own) |
| first red | parse-command: the key present as `checks: undefined` (toStrictEqual); read-plan-checks: the order guard / validation; plan-command: override by `id` instead of `customId ?? id` |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) plan-command green means the P10a acceptances end
to end (its probe's example 8); (3) no judge cut off at its `max_tokens`; (4) the V2 cut equals the old mrph's dry
cut in ids, dependsOn, generations, targets, slices, acceptances, max_tokens; (5) no old test reddens (ripple 0).

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the row of
`docs/MEASURE.md`; after the run, `build.py` to the archive and the next phase's acceptances from
`morph plan --checks`.

## 11. Actual

### Gate (preparation)

07.10, on the VPS, by the preparing orchestrator (Opus 5.5); no paid run. Data commit 4a90e06. The deck **cut by
V2**: `node dist/cli.js plan --component cli --judge --out decks/p10b2/deck.json` exit 0, 14 cards, filtered by
`decks/p10b2/filter.py` to 6; generations `[parse-command, read-plan-checks] [parse-command-judge, plan-command,
read-plan-checks-judge] [plan-command-judge]`; `node dist/cli.js deck check` 0 errors / 0 warnings / 0 hazards.
Cross-check: the old `mrph plan --spec … --component cli --judge` (dry) gives the same 14 ids and generations
and, for the 6 cards, the same dependsOn, targets, slices, acceptances, max_tokens, intent, reasoning (2 500) and
variants (mrph leaves a judge's unset = 1); only the instructions differ (the P10a design).

Scratch worktree from 4a90e06 (a reference of the four targets and three judge files shaped as the probes,
deleted afterwards), cards run in deck order, each accepted card committed before the next: **6 of 6 chains
green, 32.9–36.3 s each** (205 s in all; limit 250 s per chain); the final tree `tsc`, `eslint`, `npm run build`
clean, `vitest run` **571 / 571** in 61 files (563 + 8): **ripple 0**, no old test red in any full step. Typed
one-line throwing stubs (`Error: stub <fn> <args>`; types.ts as specified): every code card red at the probe —
parse-command 4 of 5, read-plan-checks 6 of 7, plan-command 6 of 7 (the types test passes on typed stubs); **all 8
record examples red** with a readable line; chains 7.7–8.1 s. Judges with their file absent: red at the guard
("… missing", 5.7–6.0 s). Mutation check: 27 single-rule mutations of the reference (parse-command 5,
read-plan-checks 10, plan-command 12) — 27 of 27 killed by the card's probe (1 survivor of the first design,
checks read before Plan Spec, closed by two probe rows before the cut).

Golden (reference, before the cut): `morph plan --checks decks/p10/checks.json` on this repository with
`tests/fixtures/cli/p10.map.json` = the 12 P10a acceptances byte for byte once the guard text is the live one
(= Plan Command example 8), and = `python3 build.py p10` run today 12 / 12; `--checks decks/p10b/checks.json`
with the map's acceptances stripped = the P10b1 deck 9 / 10 (compose-judge: TASK_P10b §2.2 intended difference
3 only).

Max slice + targets (reference in place): plan-command-judge 49 426 bytes (gate 200 KB). Forecast ≈ $0.06
(P10b1: 10 cards $0.0998), ≤ $1. Gate holds.
