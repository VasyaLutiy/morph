# TASK_P20 — the re-run: `morph plan --only` cuts a subset over the current tree, the Go guard lets tests import go.mod's requirements, the stub check counts build/vet lines (`src/cli/{types,parse,planCommand}.ts`, `src/planner/selectCards.ts`)

> Phase P20 of `docs/PLAN.md` ("Фазы по записи (после P2)": `P20 | planner + cli (re-cut) + templates/go + gate | issue
> #11`), operator 08.10. Issue VasyaLutiy/morph#11 (label `P20-rerun`; `gh issue list --label P20-rerun`: #11 only). Three
> items: (1) a subset cut whose overlay is computed against the current tree — code cards, Components **cli** (Parse
> Command, Plan Command) and the new **planner-subset** (Select Cards); (2) the Go template guard's test mode — data;
> (3) the stub check at the gate — data (a tool and the regulation). The deck is cut by V2 (`morph plan --component cli
> --component planner-subset --judge --checks decks/p20/checks.json`), filtered to this phase's 6 cards by
> `decks/p20/filter.py` (the last phase that needs a filter); one gate (≤ $1, slices ≤ 200 KB, chains < 250 s, §11). No
> split: 6 cards ≤ 12.

## 1. Why this

- **A hand-filtered re-cut kept its generation's overlay.** MorphStudio P6 (a Go project on V2 decks), run
  20261008-200807, then the fix deck run 20261008-201843: `decks/P6/deck-fix.json` was the deck filtered by hand to one
  judge. A Go acceptance hides the same generation's other targets by `go … -overlay` (Build Acceptances' siblings), and
  the filtered card kept generation 2's overlay blanking `mcpserver/session.go`, already accepted; `mount.go` (accepted)
  calls it, so **3 of 3** tries were red at `mount.go:49: undefined: SessionServer` whatever the judge wrote. The debt cost
  **$2.40** (Fable) against **$0.0986** for MorphStudio's whole P6 executor (×25). Reproduced here on go-mini (§11): a
  hand-filtered re-cut of percent-of (generation 0 shared with clamp-value) is red at `calc/percent_of.go:8:9: undefined:
  ClampValue` with correct code; the same card cut by `--only percent-of` is green on the same tree.
- **The Go template guard refuses go.mod's requirements in test files.** `templates/go/decks/tools/guard.mjs` (and
  MorphV2's `decks/tools/goguard.mjs`) `tests` mode allows the standard library and the module's own packages only, so
  MorphStudio's PM/Session judges (they need the go-sdk's in-memory transports) were red at `== guard` whatever they wrote.
  The TypeScript template guard has the same gap (a test may import `vitest`, `node:*` and relative paths only).
- **The stub check missed a vet line.** The fix deck passed MorphStudio's gate as "red at == guard on a one-test stub"
  while the same log held the vet error of the blanked file: the check counted guard lines and read nothing else.
- **Size.** 3 code cards + 3 judges = **6 cards**, 3 generations, code-only targets (probes, no smoke test). Reference
  code: 57 changed lines in 4 files (54 added, 3 removed: one optional field, one flag with one check, one 25-line pure
  function, 13 lines of wiring).
- **Ripple, measured** (the reference code in a scratch worktree from b70c5eb with this phase's data, full suite): **0 of
  784** red — `only` is an optional key that parse writes only when given, `PlanArgs.only` is optional, and without
  `--only` planCommand runs today's code path; every existing fixture is byte for byte.
- **Record sizes** (bytes of each Component block): cli 28 554 → **29 567**; planner 29 424 (unchanged but for the moved
  separator line, 29 348); planner-subset (new) **2 904**.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main** (module → what the new code calls or constructs): `src/planner/types.ts` — `Plan` (`{spec,
  components, cards, generations, externalDependsOn}`), `OrderResult`; `src/planner/plan.ts` — `orderDeck(cards)` (Kahn
  layers; an id of dependsOn that no card carries is external and counts as done; cards sorted by (layer, id));
  `src/cards/types.ts` — `Card`; `src/cli/types.ts` — `PlanArgs`, `Command`, `CommandResult`, `PlanDocument`;
  `src/cli/parse.ts` — `parseCommand`, `VALUE_FLAGS`, `PLAN_FLAGS`, Check 6 (plan needs --spec); `src/cli/planCommand.ts`
  — `planCommand` (Plan Spec, then with checks Read Plan Checks and Build Acceptances); `src/builder/types.ts` — `Checks`
  (`cards: CheckCard[]`, each with `id`).
- **Preconditions of the callees.** builder · Build Acceptances · every card the checks name must be in the cards it gets,
  else the error `checks card '<id>' is not in the deck` — so with `--only` the checks are cut to the subset first; its
  members are the checks' cards, and a member's siblings are the targets of the other members of its generation computed
  over the members (`layerGenerations`), so a card outside the subset is never a sibling. planner · Order Deck · a
  dependsOn id outside the cards is external and done; generations are recomputed from the kept cards alone. runloop ·
  Resolve Runnable · a dependency with no outcome in this run does not block (a dropped card is on main).
- **Fixtures** (`tests/fixtures/`), each by the type the Function takes:

| file | type | what it is | what the Function returns on it |
|---|---|---|---|
| `planner/subset.plan.json` (NEW) | ONE `Plan` object | spec "s.yaml", components ["k"], 5 cards a [], e ["outside"], b ["a"], c ["a"], d ["b", "c"] (dependsOn; targets `src/k/<id>.ts`), generations [["a", "e"], ["b", "c"], ["d"]], externalDependsOn {"e": ["outside"]} | Select Cards 1–4 (§2.2) |
| `cli/goMini.sameGen.map.json` (NEW) | the map TEXT | go-mini's `morph-map.json` with percent-of `"depends_on": []`: clamp-value and percent-of share generation 0, as session.go and mount.go did | PC 12: percent-of's overlay hides `calc/clamp_value.go` |
| `go-mini/*` (existing, Plan Command 9) | files of a tmp root | contour.yaml (Components calc, report), morph-map.json, go.mod, internal/testhelp/testhelp.go, decks/m1/checks.json (all six cards), three `decks/m1/parts/_<id>_probe_test.go` | PC 12, 13 |
| `cli/goMini.deck.json` (existing) | the deck TEXT | Plan Command 9's full cut of go-mini (6 cards) | PC 13: the --only cut of two siblings equals two of its cards |
| `cli/parseArgv.json`, `cli/parse.json` (key "22" added) | ONE object each | 13 argv lists and their 13 results | Parse Command 22 |
| `cli/examples.json` (keys "Plan Command 12", "… 13" added) | ONE object | given/then of §2.2's table | — |

- **Harness skeletons** (only `tests/helpers.ts` and the modules named):

```ts
// Select Cards: the plan, fresh per test (the function must not change it; a test checks it)
const fresh = (): Plan => fixtureJson("planner/subset.plan.json") as Plan;
// Plan Command 12-13: the go-mini root of Plan Command 9; map = a fixture name or null for go-mini's own
const MINI = ["contour.yaml", "morph-map.json", "go.mod", "internal/testhelp/testhelp.go", "decks/m1/checks.json",
  "decks/m1/parts/_clamp-value_probe_test.go", "decks/m1/parts/_percent-of_probe_test.go", "decks/m1/parts/_format-share_probe_test.go"];
function miniRoot(map: string | null): TmpRoot { const r = tmpRoot(); for (const f of MINI) r.write(f, fixture("go-mini/" + f));
  if (map !== null) r.write("morph-map.json", fixture(map));
  r.write("decks/tools/guard.mjs", "// guard\n"); r.write("decks/tools/firstdiff.mjs", "// firstdiff\n"); return r; }
const args = (over: Partial<PlanArgs>): PlanArgs => ({ name: "plan", root: ".", pretty: false, spec: "contour.yaml", map: "morph-map.json",
  components: ["calc", "report"], judge: true, out: "decks/m1/deck.json", checks: "decks/m1/checks.json", ...over });
// every root: try { … } finally { r.rm(); }
```

**Distinct markers.** Card ids a, b, c, d, e, zz, y.1, x-9, b.v_2, p, q, nope, x.2; the external id "outside"; the overlay
line `{"Replace":{"calc/clamp_value.go":""}}`. The code hard-codes none of them: the ids come from `--only`, the error
lists exactly the missing ones in the given order.

### 2.2. OUTPUT data shapes

**`src/cli/types.ts`** (PATCH) — one optional field, nothing else changes:

```ts
export interface PlanArgs {
  name: "plan"; root: string; pretty: boolean; spec: string; components: string[]; map: string | null;
  judge: boolean; out: string | null; checks?: string; only?: string[];
}
```

**`src/cli/parse.ts`** (PATCH) — **Parse Command**: `--only` joins the value flags (it takes the next token whatever it
is) and plan's flags (any other command: `flag --only does not apply to <command>`, as for every flag). In Check 6, right
after `missing --spec`: when `--only` is given, its value split on `","` must give ids that each match
`^[A-Za-z0-9._-]+$` and are distinct, else UsageError (code 4) **`--only must be distinct card ids joined by "," (got
'<value>')`** (the value as given; an empty value, an empty item, a repeat, a space or a `/` all fail). The plan Command
gains `only` — the ids in the given order — as a key after `checks`, **only when `--only` is given** (no key otherwise,
so every earlier result is byte for byte).

| Parse Command 22 (argv → result; `parse.json["22"]`) |
|---|
| `plan --spec c.yaml --only a,b.v_2` → ok {name "plan", root ".", pretty false, spec "c.yaml", components [], map null, judge false, out null, only ["a", "b.v_2"]} |
| `--pretty plan --only x-9 --root /r --spec s --checks k.json --judge --component q` → ok {name "plan", root "/r", pretty true, spec "s", components ["q"], map null, judge true, out null, checks "k.json", only ["x-9"]} |
| `plan --spec s --only b,a,c` → ok {…spec "s", components [], map null, judge false, out null, only ["b", "a", "c"]} (order kept) |
| `plan --spec s --only a,,b` → `--only must be distinct card ids joined by "," (got 'a,,b')` |
| `plan --spec s --only p,q,p` → the same message, got 'p,q,p' |
| `plan --spec s --only a b` (one token "a b") → got 'a b' |
| `plan --spec s --only ""` (an empty token) → got '' |
| `plan --spec s --only a/b` → got 'a/b' |
| `plan --only a` → `missing --spec` (checked first) |
| `plan --spec s --only` → `flag --only needs a value` |
| `plan --spec s --only a --only b` → `flag --only given twice` |
| `run --deck d --processor s --only a` → `flag --only does not apply to run` |
| `plan --from-scout x --only a` → `flag --only does not apply to plan --from-scout` |

Every error is `{ok: false, error: {error: {code: 4, kind: "UsageError", message}}}`.

**`src/planner/selectCards.ts`** (NEW; layer planner; pure, no node: module) — **Select Cards**:

```ts
import { orderDeck } from "./plan.js";
import type { Plan } from "./types.js";
export type SelectResult = { ok: true; plan: Plan } | { ok: false; error: string };
export function selectCards(plan: Plan, only: readonly string[]): SelectResult;
```

- The ids of `only` that no card of `plan.cards` carries, in `only`'s order → `{ok: false, error: "--only names cards the
  plan does not have: " + them joined by ", "}`.
- Else `orderDeck` over the cards of `plan.cards` whose id `only` holds (in `plan.cards` order; the plan's own card
  objects, never copied or changed; `plan` itself unchanged) → `{ok: true, plan: {spec: plan.spec, components:
  plan.components, cards, generations, externalDependsOn}}` (the last three Order Deck's). A kept card's dependency on a
  dropped card becomes external; generations are computed among the kept cards only. A subset of an ordered plan has no
  cycle; should orderDeck still fail, its error is the result. The order of `only` never matters.

| example | given | result |
|---|---|---|
| Select Cards 1 | subset.plan.json, only ["d", "c"] | ok; cards c, d — `r.plan.cards[0]` is `plan.cards[3]` (`toBe`); generations [["c"], ["d"]]; externalDependsOn {"c": ["a"], "d": ["b"]}; spec "s.yaml", components ["k"] |
| Select Cards 2 | only ["e", "b", "a"] | ok; cards a, e, b; generations [["a", "e"], ["b"]]; externalDependsOn {"e": ["outside"]} |
| Select Cards 3 | only ["zz", "c", "y.1"] | `{ok: false, error: "--only names cards the plan does not have: zz, y.1"}` |
| Select Cards 4 | only ["d", "c", "b", "e", "a"] | `{ok: true, plan}` with plan `toStrictEqual` the fixture whole |

**`src/cli/planCommand.ts`** (PATCH) — **Plan Command**: after Plan Spec succeeds and **before** anything with the
checks, when `args.only !== undefined`: `selectCards(plan, args.only)` (from `"../planner/selectCards.js"`); its error →
`{code: 2, document: errorDocument(2, "DeckError", error)}`, nothing written; else its plan **replaces** Plan Spec's for
every later step (the profile still comes from the first selected Component; the cards Build Acceptances gets; the
`overridden` index map; the cards written to `--out`; the document's cards, generations and externalDependsOn). With
`--checks`, the checks given to Build Acceptances keep only the cards of that plan: `{...checks, cards: checks.cards
filtered to the ids the subset holds}` (a check of a dropped card is ignored, not an error). Without `--only` every step,
message and byte is today's.

| example | given (tests/fixtures/cli/examples.json) | result |
|---|---|---|
| Plan Command 12 | the go-mini root with map = `cli/goMini.sameGen.map.json`; args (skeleton) → out decks/m1/deck.json; then only ["percent-of"], out decks/m1/only.json | code 0; generations [["clamp-value", "percent-of"], ["clamp-value-judge", "format-share", "percent-of-judge"], ["format-share-judge"]]; percent-of's acceptance holds `{"Replace":{"calc/clamp_value.go":""}}` exactly once (the hand-filtered path keeps it); then code 0, generations [["percent-of"]], externalDependsOn {}; one card, equal to the first deck's percent-of except the acceptance, which is the first one with that overlay line → `{"Replace":{}}` and nothing else; decks/m1/only.json = `JSON.stringify(cards, null, 2) + "\n"` |
| Plan Command 13 | the go-mini root (its own map); args with only ["percent-of-judge", "format-share"], out decks/m1/two.json; then only ["nope", "percent-of", "x.2"], out decks/m1/bad.json; then only ["clamp-value"], checks undefined, out null | code 0; generations [["format-share", "percent-of-judge"]]; externalDependsOn {"format-share": ["percent-of"], "percent-of-judge": ["percent-of"]}; cards `toStrictEqual` goMini.deck.json's format-share and percent-of-judge in that order, acceptances included (two kept siblings still hide each other); then `{code: 2, document: {error: {code: 2, kind: "DeckError", message: "--only names cards the plan does not have: nope, x.2"}}}` and decks/m1/bad.json does not exist; then code 0, cards [the clamp-value card of the same args with no --only], generations [["clamp-value"]] |

**The guards (data, written by the orchestrator; not a card's target).**
- `templates/go/decks/tools/guard.mjs` and `decks/tools/goguard.mjs`, `tests` mode: an import of a test file is allowed
  when it is standard, the module's own (`<mod>/…`), or equal to / under a **direct requirement of go.mod** (`require`
  lines and blocks, `// indirect` lines excluded); else `guard: <file> imports <imp> (the standard library,
  <mod>/internal/testhelp, <requires joined by ", "> only)`, and with no direct requirement the old text `(the standard
  library and <mod>/internal/testhelp only)`.
- `templates/typescript/decks/tools/guard.mjs`, `tests` mode: also package.json's `dependencies` keys (a package or
  `<name>/…`); devDependencies stay out but vitest; else `import of a package "<spec>" (vitest, node:*, relative paths,
  <deps joined by ", "> only)`, and with none the old `(vitest, node:* and relative paths only)`.
- Python: the template ships no guard (a Python project cuts with map acceptances, P18), so there is no test-mode gap.
- MorphV2's own `decks/tools/guard.mjs` is unchanged (no MorphV2 test imports `yaml`; its tests import the code).

**The stub check (data).** `decks/tools/stubcheck.mjs` (= `templates/common/decks/tools/stubcheck.mjs`, Node only):
`node decks/tools/stubcheck.mjs <log> <stage> <target,…>` reads one acceptance log of a stub run; exit 0 only when the
last stage header (`== <stage>`; a held lint verdict "== … failed (see above)" is the stage `verdict`) is the expected one
(`probe` for a code card, `guard` for a judge before its file) **and** no line under `== build`, `== vet` or `== tsc`
names a source file (`path.go:N`, `path.ts(N,M)` …) outside the targets; each failure one line
(`stubcheck: vet names calc/half.go, outside the targets: vet: calc/half.go:4:31: undefined: PercentOf`, `stubcheck: the
log stops at stage build, expected probe`). The gate's stub check runs it on every stub log (`docs/AUTONOMY.md` and the
templates' AUTONOMY/TASK_TEMPLATE say so).

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P20 rerun"; #11 = issue VasyaLutiy/morph#11):

- **Which command** · `--only` on `morph plan` only; `morph run --only` stays out · a deck's acceptances are text built at
  plan time from the record, the map and the checks; `run` holds none of them and cannot recompute an overlay, so a run
  flag would filter a stale deck exactly as `filter_fix.py` did.
- **Where the logic lives** · the subset is a pure planner Function (Select Cards, new Component planner-subset, file
  `src/planner/selectCards.ts`); Plan Command wires it and cuts the checks · PLAN's rule "a CLI command lives in its
  Component, cli only routes" — the planner owns ordering; a new Component because planner is at 29.3 KB of the 30 KB cap.
- **"Accepted" without git** · a file is never blanked unless its card is in the subset; plan reads no git and no HEAD ·
  the cards of `--only` are by definition the ones re-run, every other card is on main (accepted or not run); a git test
  ("present at HEAD with its Morph-Card commit") would make plan depend on the run history and still give the same
  answer for a re-run; two kept siblings keep hiding each other (PC 13), as the full cut did.
- **Dropped dependencies** · kept in the card's dependsOn and reported as external (Order Deck), not deleted · the card is
  byte for byte the full cut's but its acceptance; Resolve Runnable never blocks on a dependency without an outcome.
- **Unknown ids** · 2 DeckError listing every missing id in `--only` order; a check of a dropped card is ignored · a typo
  must fail before any write; the phase's checks file names all of its cards.
- **The value's form** · one flag, ids joined by `,`, each `^[A-Za-z0-9._-]+$`, distinct, order kept but irrelevant ·
  issue #11 `--only <card>[,…]`; customIds match that pattern (Validate Card).
- **Guards, test mode** · Go: go.mod's direct requirements (not `-deps`, not indirect); TypeScript: package.json
  `dependencies`; Python: no guard · issue #11 item 2; what the scaffold installed for the declared dependencies (P19).
- **Stub check** · a tool (data) plus the regulation, no code · the stub check is the orchestrator's hand step at the gate,
  not a Morph stage; the tool makes it mechanical and language-neutral (Go vet/build lines, tsc lines).
- **The filter** · P20's own deck is still filtered by `decks/p20/filter.py` (the binary that cuts it has no `--only` yet);
  from the next phase the regulation cuts a phase's cards with `--only`.

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/cli/types.ts`, `src/cli/parse.ts` | PATCH | probe only | NEW `tests/cli/parse.p20.examples.test.ts` (Parse Command 22) |
| `src/planner/selectCards.ts` | NEW | probe only | NEW `tests/planner/selectCards.examples.test.ts` (Select Cards 1–4) |
| `src/cli/planCommand.ts` | PATCH | probe only | NEW `tests/cli/planCommand.p20.examples.test.ts` (Plan Command 12, 13) |

- `parse.p20.examples`: one test "Parse Command example 22: …" with the 13 argv of §2.2's table, each argv and each
  result written out as a literal (no fixture read), each compared whole with toStrictEqual; at most 6 own tests.
- `selectCards.examples`: "Select Cards example 1: …" to "… 4: …" on `fresh()`; example 1 checks the kept card is the
  plan's own object with `toBe`; at most 6 own tests (e.g. the plan unchanged after a call).
- `planCommand.p20.examples`: "Plan Command example 12: …", "… 13: …" on the skeleton's roots; the overlay line written
  out; goMini.deck.json read with `fixture("cli/goMini.deck.json")` and parsed; at most 6 own tests.

### 2.4. What must not break

- Byte for byte: every file outside the 4 code targets and the 3 new test files of §2.3 — every other `src/` file,
  `tests/helpers.ts`, every existing test file; `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/`,
  `templates/` — untouched by every card (frozen).
- **A cut without `--only` byte-identical**: go-mini (`--checks decks/m1/checks.json`, Plan Command 9's
  `cli/goMini.deck.json` stays green) and the P15 deck re-cut from its own tree, by main's binary (b70c5eb) and by this
  phase's reference binary (§11).
- 784 tests in 125 files green at every card (no deck-wide exclusion); after the run **784 + 1 + 4 + 2 = 791** in 128
  files (± the judges' own tests).

## 3. Acceptance

Built by `morph plan --checks decks/p20/checks.json`, narrow to broad, every stage printing `== <stage>`. `ownGit: true`
(the full suite spawns git in its tmpRepos), `frozen` the defaults + `templates`, `fullExclude` none (ripple 0).

Code cards (no test file; code-only targets): `probe/<card>/` → `tsc` (per-card tsconfig excluding the generation's other
targets) → `eslint <targets>` → `guard.mjs src <targets>` → the probe `decks/p20/parts/<card>.probe.ts` (parse-command PC
22 + 1 row = 2; select-cards SC 1–4 + 1 row = 5; plan-command PC 12, 13 + 1 row = 3; **10 tests**) → eslint's verdict →
full `vitest run` → own git → frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs tests <file> <min> <max> lits0.json` → `vitest run
<targets>` → eslint's verdict → full run → own git → frozen → untracked.

| file | new | min | max | lits |
|---|---|---|---|---|
| `tests/cli/parse.p20.examples.test.ts` | yes | 1 | 7 | `Parse Command example 22`, `--only must be distinct card ids joined by`, `b.v_2`, `a,,b`, `p,q,p`, `flag --only does not apply to run`, `x-9` |
| `tests/planner/selectCards.examples.test.ts` | yes | 4 | 10 | `Select Cards example 1` … `4`, `planner/subset.plan.json`, `--only names cards the plan does not have: zz, y.1`, `outside` |
| `tests/cli/planCommand.p20.examples.test.ts` | yes | 2 | 8 | `Plan Command example 12`, `… 13`, `cli/goMini.sameGen.map.json`, `cli/goMini.deck.json`, `calc/clamp_value.go`, `--only names cards the plan does not have: nope, x.2`, `percent-of-judge` |

min = the record's new examples; max = min + 6 (new files).

**Output budget** (`max_tokens`, before the session's ×3 for `ds`):

| card | returns | `max_tokens` |
|---|---|---|
| parse-command | types.ts + parse.ts ≈ 22 KB, two whole files | 24 000 |
| select-cards | selectCards.ts ≈ 0.9 KB new | 8 000 |
| plan-command | planCommand.ts ≈ 4.7 KB whole | 12 000 |
| parse-command-judge, select-cards-judge | ≈ 4–6 KB new file each | 16 000 |
| plan-command-judge | ≈ 6 KB new file (two tmp roots) | 20 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- **Layers** (guard, unchanged): planner imports cards and its own files only — selectCards.ts imports `./plan.js` and
  `./types.js`; cli imports what it imports today plus `../planner/selectCards.js`. No clock, no environment, no file
  system in the planner; planCommand reads files only through what it uses today.
- A file a card writes is in no sibling's slice in the same generation: generation 0 [parse-command, select-cards]; 1
  [parse-command-judge, plan-command, select-cards-judge] read types.ts, parse.ts and selectCards.ts (generation 0), not
  each other's target; 2 [plan-command-judge] reads planCommand.ts.
- Tests write only under `tmpRoot()` and remove it; no JS timer; no network; a judge writes only its target.

## 7. Out of scope

The data of this phase (written by the orchestrator, committed before the run, no card touches it):
1. the guards (§2.2): `templates/go/decks/tools/guard.mjs`, `decks/tools/goguard.mjs`,
   `templates/typescript/decks/tools/guard.mjs`;
2. the stub check: `decks/tools/stubcheck.mjs`, `templates/common/decks/tools/stubcheck.mjs`;
3. the regulation: MorphV2's `docs/AUTONOMY.md` (the cycle's step 1 cuts a phase with `--only`, a re-run is re-cut with
   `--only`, the gate's stub check runs stubcheck.mjs) and `templates/common/docs/AUTONOMY.md`, `TASK_TEMPLATE.md` (the
   same, without phase numbers).

Also out: `morph run --only` (§2.2 "Which command"); a git read in plan; re-cutting MorphStudio's decks (its own session);
a Python acceptance builder or guard (P18).

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component cli --component planner-subset \
  --judge --checks decks/p20/checks.json --out decks/p20/deck.json
python3 decks/p20/filter.py decks/p20/deck.json                  # keeps the 6 cards of the phase
python3 decks/tools/scale_tokens.py decks/p20/deck.json 3         # processor ds
node dist/cli.js deck check --root . --deck decks/p20/deck.json                                  # errors 0
rm -rf /tmp/v2bin-p20 && mkdir -p /tmp/v2bin-p20 && cp -r dist /tmp/v2bin-p20/ && ln -s $PWD/node_modules /tmp/v2bin-p20/node_modules \
  && ln -s $PWD/templates /tmp/v2bin-p20/templates
node /tmp/v2bin-p20/dist/cli.js run --root . --deck decks/p20/deck.json --processor ds --deadline 2400
```

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 6 (3 code, 3 judges) / 3: [parse-command, select-cards] [parse-command-judge, plan-command, select-cards-judge] [plan-command-judge] |
| executor bill | ≈ $0.04–0.10 on ds ×3 (P19b: 8 cards $0.0934); ≤ $0.25 with a re-cut; cap $5 |
| cards with regeneration | 0–2 of 6 (parse-command: an 18 KB file returned whole, a check moved; plan-command-judge: the overlay line or the order of the cards of example 13) |
| tests after the run | 791 ± 6 in 128 files |
| first red | parse-command: the `only` key written as `[]`/null when absent, or the check before `missing --spec`; select-cards: the generations kept from the plan, or the cards in `only` order; plan-command: the checks not cut (Build Acceptances' "checks card … is not in the deck"), or the subset applied after Build Acceptances (the overlay unchanged) |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no answer cut at its `max_tokens`; (3) after the run no
file outside §2.3's seven changed; (4) every cut without `--only` byte for byte (Plan Command 9 green, the go-mini and P15
re-cuts identical); (5) this repository's HEAD and refs unchanged by every card.

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the MEASURE row with
its `прогоны` cell, the vitest log of every verify run; DECISIONS lines "P20 rerun"; after the merge the byte-identity
re-cuts (go-mini and P15 against main's binary b70c5eb) and the go-mini demo of §11 with the merged binary; then 🧪 and
the stop for the operator (`~/.morph-wait-operator`, never `~/.morph-phase-done`).

## 11. Actual

### Gate (preparation)

08.10, on the VPS, by the preparing orchestrator (Opus 5.5, fresh context, no sub-agents); no paid run, no model call.
Data commits 29c8aba (spec, record, map, fixtures, checks, probes, filter, deck, guards, stubcheck, regulation) and the
gate commit (a probe row on the map's acceptance, the re-cut deck, this section, DECISIONS). Component sizes: cli 28 554 →
**29 567**, planner-subset **2 904** (new), planner 29 348. Issues: #11 only (`P20-rerun`). No split (6 cards ≤ 12).

The deck **cut by V2** (main's binary, b70c5eb): `plan --component cli --component planner-subset --judge --checks
decks/p20/checks.json` **exit 0**, 16 cards, `decks/p20/filter.py` keeps 6; `scale_tokens.py … 3` (maxTokens:
parse-command 72 000, select-cards 24 000, plan-command 36 000, parse-command-judge 48 000, select-cards-judge 48 000,
plan-command-judge 60 000); `deck check` **0 errors, 0 warnings**, no hazards; generations `[parse-command, select-cards]
[parse-command-judge, plan-command, select-cards-judge] [plan-command-judge]`. Slices (deck check, slice + existing
targets, this spec at its final size): 46.0–63.6 KB, the largest parse-command-judge **63 644 B**. No mrph cross-check (operator 08.10).

Scratch worktree `/tmp/p20-scratch` from 29c8aba (removed afterwards; no watcher or worker left), the deck's own
acceptances run as Morph runs them (`/bin/sh -c`, 300 s cap), cards in generation order, each accepted reference
committed before the next:
- **Stubs, red per example at the probe (10/10)**, typed throwing stubs: `Error: stub parseCommand
  ["plan","--spec","c.yaml","--only","a,b.v_2"]`, `stub selectCards [5,["d","c"]]` … `[5,["d","c","b","e","a"]]`, `stub
  planCommand [true,["calc","report"],null,"decks/m1/checks.json"]`, `… ["percent-of-judge","format-share"] …`, `…
  ["conf","plain"],["read-config"] …`: parse-command 2/2, select-cards 5/5, plan-command 3/3. **stubcheck.mjs exit 0 on
  all 6 stub logs** (code cards red at `probe`, judges red at `guard` — `guard: tests/…p20….test.ts missing`; no tsc line
  outside the targets).
- **References green, chain seconds** (limit 250): parse-command 67.8, select-cards 68.9, parse-command-judge 68.9,
  plan-command 69.5 (71.3 after the probe row), select-cards-judge 71.3, plan-command-judge 70.9 — **max 71.3 s**. Final
  tree: `tsc`, `eslint src tests` clean, `vitest run` **792 / 792 in 128 files** (784 + the reference judges' 1 + 5 + 2);
  `git status` clean. Ripple 0 of 784 with the data.
- **Mutants** (the changed contracts only: the flag, its check and the key in parse.ts; selectCards; the wiring in
  planCommand.ts), each under a 120 s subprocess timeout against its probe: **26 mutants, 2 campaigns (52 runs), 1.2 min,
  max 3.1 s, 0 timeouts; 25 killed**; one survivor is equivalent (selectCards keeping the cards in `only`'s order: Order
  Deck sorts every layer by id, so the result is the same) — DECISIONS. The map-acceptance mutant (planCommand's
  `overridden` reading Plan Spec's cards by index) survived the first campaign and was killed after a probe row (a go-mini
  map acceptance on format-share kept in the subset).
- **Byte identity of a cut without `--only`** (main's binary b70c5eb vs the P20 reference binary, same trees): go-mini cut
  with `--checks decks/m1/checks.json` (this phase's goguard/gofirstdiff installed) **identical** (6 cards, 75 416 B; plan
  documents equal but for `out`); the P15 deck re-cut from its own tree 0365336 (plan, filter, ×3) **identical** (12 cards,
  398 622 B) and identical to the deck committed there.
- **Issue #11 reproduced on go-mini** (`decks/p20/demo.sh <bin>`, the reference binary, a git module with this phase's goguard and
  gofirstdiff, the reference calc files committed as accepted): (1) map `goMini.sameGen.map.json`, the full cut's
  percent-of acceptance (= a hand-filtered re-cut) on the correct reference code → **exit 1 at `== build`,
  `calc/percent_of.go:8:9: undefined: ClampValue`**; the `--only percent-of` cut on the same tree → **exit 0** (build, vet,
  gofmt, guard, probe, full, frozen). (2) go-mini's own map plus an accepted `calc/half.go` calling PercentOf (mount.go's
  role): the full cut's clamp-value-judge acceptance on the stub tree (no test file) is red at `== guard … missing` — the
  count MorphStudio's gate read — while its `== vet` printed `vet: calc/half.go:4:31: undefined: PercentOf`;
  **stubcheck.mjs exit 1** (`stubcheck: vet names calc/half.go, outside the targets: …`); the `--only clamp-value-judge`
  cut: vet clean, guard red, **stubcheck exit 0**.
- **Guards (data), run by hand**: Go (`templates/go/decks/tools/guard.mjs` and `decks/tools/goguard.mjs`, a go.mod with a
  single-line require, a block require and an `// indirect` line): a test importing go-humanize, go-humanize/english, the
  go-sdk's `mcp` and the module's testhelp → exit 0; golang.org/x/text/language (indirect) and github.com/other/x → exit 1,
  `(the standard library, example.com/mini/internal/testhelp, github.com/modelcontextprotocol/go-sdk,
  github.com/dustin/go-humanize only)`; with no require the old text. TypeScript template guard: change-case and
  `@scope/pkg/sub` from package.json `dependencies` → exit 0; typescript (a devDependency) and zod → exit 1; no
  dependencies → the old text. `decks/p18/smoke/leak.sh templates`: the new template text adds no line (one pre-existing hit,
  `templates/common/tools/vps-start.sh:20` "(operator 08.10)", from bc311aa).

**Forecast** on `ds` with every maxTokens × 3: P19b ran 8 cards for $0.0934, P19a 8 for $0.0935; here 9 first requests (3
code × 2 variants + 3 judges), 40–57 KB in, answers 1–22 KB: **≈ $0.04–0.10**, ≤ $0.25 with a re-cut; ≤ $1. **Gate holds.**

**Run command** (from the repo root, the binary copied first; the deck is already scaled ×3):

```
npm run build && rm -rf /tmp/v2bin-p20 && mkdir -p /tmp/v2bin-p20 && cp -r dist /tmp/v2bin-p20/ && ln -s $PWD/node_modules /tmp/v2bin-p20/node_modules && ln -s $PWD/templates /tmp/v2bin-p20/templates
node /tmp/v2bin-p20/dist/cli.js run --root . --deck decks/p20/deck.json --processor ds --deadline 2400 > /tmp/p20-run.json
```

### Run

08.10, main session on the VPS. The gate re-checked by the main session: `morph plan` exit 0, the re-cut (filter, ×3)
byte-identical to the committed deck, `deck check` 0 errors / 0 warnings, the largest slice 63 644 B. Binary copy
`/tmp/v2bin-p20` (`node_modules` and `templates` linked beside its dist/), processor `ds`, run **20261008-221549**, exit 0,
**981 s**: 6 / 6 written, 9 requests, 158 495 in / 73 446 out tokens, **$0.0629** (usageTotals.cost 0.06286521). Every
card accepted on its first attempt (v1 of each; parse-command, select-cards and plan-command v2 answered, untried). No
retry, no fix, no truncation (every finish `stop`; the largest answer plan-command-judge 36 396 output tokens of 60 000).

Verify on `morph/20261008-221549`: `git status --short` empty; `tsc --noEmit`, `eslint src tests` clean; `vitest run`
**793 / 793 in 128 files**; `npm run build` green. Own read against §2.2: `types.ts` adds `only?: string[]` after
`checks`; `parse.ts` adds `--only` to the value flags and plan's flags, and after `missing --spec` splits the value on ","
and refuses a malformed or repeated id with the message of §2.2, adding `only` to the Command only when given;
`selectCards.ts` lists the missing ids in `only`'s order, else runs `orderDeck` over the plan's own kept cards (plan
order) and returns a new Plan with Order Deck's cards, generations and externalDependsOn; `planCommand.ts` applies
Select Cards after Plan Spec and narrows `checks.cards` to the kept ids before Build Acceptances, so siblings and overlays
are computed among the subset. No defect found.

After the run, with the binary built from the run branch: (1) byte identity of a cut without `--only` against main's
binary b70c5eb — go-mini (`--checks decks/m1/checks.json`, this phase's goguard/gofirstdiff installed: 6 cards, 75 416 B)
**identical**; the P15 deck re-cut from its own tree 0365336 (plan, filter, ×3: 12 cards, 398 622 B) **identical**, and
identical to the deck committed there. (2) `decks/p20/demo.sh` on go-mini: the full cut's percent-of acceptance on correct
code exit 1 (`calc/percent_of.go:8:9: undefined: ClampValue`, the 201843 failure), the `--only percent-of` cut exit 0;
stubcheck on the full cut's clamp-value-judge stub log exit 1 (`vet names calc/half.go, outside the targets`), on the
`--only clamp-value-judge` cut's log exit 0 (`red at guard; build, vet and tsc lines name only the targets`).
