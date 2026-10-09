# TASK_P21c — the breaking re-cut, part c: an `--only` deck runs as one subset transaction (`src/cards/transaction.ts`, `src/runloop/transaction.ts`, `src/runloop/deck.ts`, `src/builder/{types,buildAcceptances}.ts`, `src/planner/stubTrees.ts`, `src/cli/planCommand.ts`)

> Phase P21c of `docs/PLAN.md` (issue VasyaLutiy/morph#12, label `P21-breaking-recut`), operator 09.10 ("гоу"): comment
> 6077412737 item 2, the generality amendment comment 6077766447, MorphStudio's request 4efde92 §6. **10 cards, 4
> generations, no split** (§2.2 "Size"). Code cards in Components **cards** (Transaction Deck, Blame Log — NEW),
> **runloop-subset** (Run Transaction — NEW Component; Run Deck's first line), **builder** (Build Acceptances:
> transaction), **planner-subset** (Stub Trees: a transaction card's tree) and **cli** (Plan Command: `--only` →
> transaction). One gate (≤ $1, slices ≤ 200 KB, chains < 250 s, §11).

## 1. Why this

- **No intermediate tree of a re-cut that renames an API compiles.** MorphStudio P7b (09.10, 12 cards): every red was a
  build/vet/full line in ANOTHER card's or an outside file. P21a's hiding (Hide Later) passed its stubs and went RED live
  (run 20261009-081603, 2/8): control-contract-judge, retried after its generation-2 sibling phase-loop wrote the new
  `loop.go`, built it beside the kept old `guard.go` — `supervisor/guard.go:20:23: l.Resumes undefined`. P21b's `deck
  check` names such a break before any spend (go-p7b deck.p20 exit 2, ts-rename exit 2 at `src/report/line.ts(1,17)`)
  but cannot fix it. Both sides concluded (4efde92 §6): only the tree with ALL subset cards written is consistent.
- **Measured** (reference code in a scratch worktree, never committed; `decks/p21c/demo.sh`, stub processor, reference
  answers):

| case | binary | written | first red line → owner |
|---|---|---|---|
| ts-rename (TypeScript rename across modules, 3 generations) | main (no transaction) | 0 / 4 | to-metres `src/report/line.ts(1,17): error TS2724` → length-line |
| ts-rename | reference (transaction) | **4 / 4**, 4 requests | — |
| go-p7b, control-contract-judge forced red once | main | 2 / 8 | control-contract-judge r1/r2 `supervisor/guard.go:20:23: l.Resumes undefined` → runtime-guard (the P21a smoke RED on stubs) |
| go-p7b, the same forced retry | reference | **8 / 8**, 9 requests (the judge 2 attempts) | — |
| go-p7b + `mcp/count.go` (outside the subset, reads Resumes) | reference | 0 / 8, exit 3 | fault `outside the subset: mcp/count.go:6:52: l.Resumes undefined …` |

  The whole demo: 61 s.
- **Ripple, measured** (reference code, full suite): **3 of 834** red — Plan Command examples 12, 13 (P20) and 14 (P21a):
  their `--only` acceptances become transaction acceptances. Their record examples are amended here (§2.2), the two test
  files are the plan-command judge's targets and leave every full run of this deck (`fullExclude`). Everything else 0.
- **Size.** 5 code cards + 5 judges = **10 cards**, 4 generations, code-only targets (probes, no smoke test). Reference:
  transaction.ts (cards) 1.5 KB, transaction.ts (runloop) 8.7 KB new; deck.ts +3 lines; buildAcceptances.ts +20 lines,
  types.ts +1; stubTrees.ts +2 lines; planCommand.ts −6 lines.
- **Record sizes** (bytes of each Component block): cards 8 048 → **13 661**; runloop-subset NEW **11 175**; runloop
  29 986 → **29 995** (the component description and Run Deck's description shortened, one sentence added); builder
  29 721 → **29 996** (a P19 aside of the description that Build Acceptances and Code Acceptance already hold, and the
  P21 hide clause reworded, no rule removed); planner-subset 22 456 → **23 547**; cli 29 921 → **29 946**.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main** (module → what the new code calls or constructs): `src/cards/types.ts` — `Card` (every field:
  customId, intent, targets, contextSlice, instruction, acceptance, model, maxTokens, reasoning, variants, dependsOn),
  `Deck` ({cards, externalDependsOn}); `src/language/treeProfiles.ts` — `TREE_PROFILES` (typescript, python, go; each
  `fileLine` a RegExp source, group 1 the path, group 2 the rest); `src/runloop/types.ts` — `RunInput` {root, runId,
  branch, deck, budget {maxCards, maxRetryBatches, deadline}}, `RunDeps` {config, transport, commit, now, env,
  acceptanceTimeoutMs?, onVariant?, interrupted?}, `RunResult` {report, outcomes}, `CardOutcome`, `RunReport`,
  `RequestUsage`; `src/runloop/deck.ts` — `runDeck(input, deps)`; `src/runloop/generation.ts` —
  `processGeneration(cards, deps, root)` → {outcomes, usage, requests, retryContexts}; `src/runloop/retry.ts` —
  `buildRetry(card, attempt 1|2, acceptanceOutput, previousDiff)`; `src/acceptance/snapshot.ts` —
  `snapshotTargets(root, targets)` → {root, entries [{path, bytes: Uint8Array | null}]}, `restoreSnapshot(snap)`;
  `src/acceptance/run.ts` — `runAcceptance(command, root, {env, timeoutMs})` → Promise<{exit, log, timedOut}>,
  `DEFAULT_TIMEOUT_MS`; `src/acceptance/diff.ts` — `buildAttemptDiff(before: Record<string, string | null>, after:
  Record<string, string>)`; `src/builder/steps.ts` — `untrackedStep(targets)`; `src/builder/compose.ts` —
  `codeAcceptance(ctx, probe, smoke, extra)`, `judgeAcceptance(ctx, files)`; `src/builder/types.ts` — `BuildInput`
  (cards, checks, profile, texts, uses?, vendor?, hide?), `CardContext`, `Checks`, `JudgeFile`; `src/cli/planCommand.ts`
  — `planCommand(root, args)`; `src/processor/types.ts` — `ProcessorConfig`.
- **Preconditions of the callees.** runloop · the stub processor answers request `<id>.v1` from `<answersDir>/<id>.v1.md`
  or else `<id>.md`, a retry `<id>.r1.v1` from `<id>.r1.v1.md` or `<id>.r1.md`; no file → text null, error "stub has no
  answer: <answersDir>/<request id>.md" → the variant is corrupt ("answer corrupt: " + that error) — Run Transaction 7.
  runloop · Run Deck retries a card it could not write up to 2 times, capped by maxRetryBatches per generation; a
  dependant of a failed card is "skipped" (reason "dependency <id> failed"). acceptance · runAcceptance runs `/bin/sh -c`
  in root; the log is the command's whole output ("forced red\n" for `echo "forced red"; exit 1`). builder ·
  untrackedStep(targets) appears exactly once in every code and judge acceptance (TypeScript and Go), and holds `$`:
  replace it with a function, never a replacement string. compiler · a patch card's missing target is sent as "Target
  <p> is a new file" (run-transaction writes the new transaction.ts with deck.ts).
- **Fixtures** (`tests/fixtures/`), each by the type the Function takes:

| file | type | what it is | what the Function returns on it |
|---|---|---|---|
| `cards/blameLogs.json` (NEW) | ONE object "go", "typescript", "none" → text | go: 12 lines (`== build`, a `#` line, `pump/flow.go:14:9` and its `vet: ./` twin, `== vet`, `rate/rate.go:3:1`, an indented test line, `--- FAIL`, the gone probe `rate/k7_probe_test.go:9:2`, the outside `cmd/tool/main.go:6:2`, a `go:` line, `FAIL<tab>…`); typescript: 9 lines (`src/report/total.ts(4,21)`, the probe `probe/w3/w3.probe.ts(2,10)`, `tests/report/total.examples.test.ts(5,44)` twice, an indented line, `src/units/len.ts(9,3)` with trailing spaces, a TS5083 line without a file, a ` FAIL ` vitest line); none: three lines, no file | Blame Log 1–4 |
| `planner/stub.trees.p21c.json` (NEW) | ONE object "4" → `StubTree[]` (9 trees) | Stub Trees 4 | Stub Trees 4 |
| `planner/stub.cards.json` (P21b) | ONE array of 9 `Card` | Stub Trees 4 puts TRANSACTION_MARK + "\n" before a's, u's and j's acceptances | Stub Trees 4 |
| `builder/examples.json` (key "Build Acceptances 10" added) | ONE object | given/then of Build Acceptances 10 | — |
| `builder/go/code1.txt` (P15) | text | percent-of's Go acceptance of Build Acceptances 5 | Build Acceptances 10 (its go part) |
| `cli/examples.json` ("Plan Command 12", "13", "14" amended: their `then`) | ONE object | given/then of Plan Command 12–14 | — |
| `cli/goMini.deck.json`, `go-mini/`, `go-p7b/` (P15, P20, P21a) | deck file; module trees | Plan Command 12–14's roots | Plan Command 12–14 |

- **Harness skeletons** (only `tests/helpers.ts`, node:fs, node:path and the modules named):

```ts
// Transaction Deck, Blame Log
const logs = (): Record<string, string> => fixtureJson("cards/blameLogs.json") as Record<string, string>;
const FL = TREE_PROFILES.map((p) => p.fileLine);                       // typescript, python, go
const on = (list: string[]) => (p: string): boolean => list.includes(p);   // exists
const c = (acceptance: string | null): Card => ({ customId: "a", intent: "generate", targets: ["x.ts"], contextSlice: [], instruction: "i",
  acceptance, model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn: [] });
// Build Acceptances 10 (TypeScript part)
const card = (id: string, targets: string[], dependsOn: string[] = []): Card => ({ customId: id, intent: "generate", targets, contextSlice: [],
  instruction: "w", acceptance: null, model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn });
const files: JudgeFile[] = [{ file: "tests/x/a.examples.test.ts", min: 1, max: 4, lits: [], drop: [], new: true }];
const checks: Checks = { version: 1, phase: "p8", parts: "decks/p8/parts", frozen: DEFAULT_FROZEN, fullExclude: ["tests/x/old.test.ts"], ownGit: false,
  cards: [{ id: "a", smoke: null, extra: null, files: null }, { id: "b", smoke: null, extra: null, files: null }, { id: "j", smoke: null, extra: null, files }] };
const ctx = (id: string, targets: string[]): CardContext => ({ id, phase: "p8", targets, siblings: [], frozen: DEFAULT_FROZEN,
  fullExclude: ["tests/x/old.test.ts"], ownGit: false, profile: TYPESCRIPT, guard: "// guard\n", firstdiff: "// firstdiff\n", allowed: [], vendor: false });
const ALL = ["src/x/a.ts", "src/x/b.ts", "tests/x/a.examples.test.ts"];
// expected a: TRANSACTION_MARK + "\n" + codeAcceptance(ctx("a", ["src/x/a.ts"]), "// probe\n", null, null).replace(untrackedStep(["src/x/a.ts"]), () => untrackedStep(ALL))
// Stub Trees 4
const marked = (ids: string[]): Card[] => (fixtureJson("planner/stub.cards.json") as Card[])
  .map((c) => (ids.includes(c.customId) ? { ...c, acceptance: TRANSACTION_MARK + "\n" + (c.acceptance ?? "") } : c));
// Run Transaction: one tmp root per example, the stub's answersDir; M = TRANSACTION_MARK + "\n"
const fence = (body: string): string => "```ts\n" + body + "```\n";
function card(customId: string, target: string, acceptance: string, dependsOn: string[] = []): Card {
  return { customId, intent: "generate", targets: [target], contextSlice: [], instruction: "write " + target, acceptance, model: null,
    maxTokens: null, reasoning: null, variants: 1, dependsOn }; }
const r = tmpRoot("morph-tx-"); const commits: string[] = []; const records: VariantRecord[] = [];
const deps: RunDeps = { config: { id: "stub", type: "stub", model: "stub", apiKey: null, baseUrl: "https://openrouter.ai/api/v1", route: "sync",
    concurrency: 4, providerOrder: null, reasoning: null, timeoutMs: 600000, maxRetries: 0, answersDir: r.root },
  transport: { fetch: fakeFetch().fetch, sleep: async () => {} },
  commit: (id, targets) => { commits.push(id); return { commit: "sha-" + id, diffstat: { files: targets.length, insertions: 1, deletions: 0 } }; },
  now: () => 0, env: { PATH: process.env.PATH ?? "" }, onVariant: (rec) => { records.push(rec); } };
const input = (cards: Card[], maxRetryBatches = 8): RunInput => ({ root: r.root, runId: "t1", branch: "morph/t1",
  deck: { cards, externalDependsOn: [] }, budget: { maxCards: 99, maxRetryBatches, deadline: 1e12 } });
// Plan Command 12–14: the roots of the old tests stay (go-mini MINI + decks/tools stubs; go-p7b P7B); M as above
const UN = /X=\$\(git ls-files[^\n]*\n/;                                  // a card's one untracked step line
```

**Distinct markers.** Card ids a, b, j, s, p, k7, p2, kj, w3, rt, rtj, n4, q, z; answer marks A1, B2, B_OLD, B_NEW, S1, P5,
OLD, NEW, red-a7, "forced red"; files out/legacy.ts, j.once, ran-a. No name of P7b, go-p7b, ts-rename, supervisor or
Resumes, no card id of a fixture, is in any `src/` file: only TRANSACTION_MARK and the reason/fault texts below are fixed
by the record.

### 2.2. OUTPUT data shapes

**`src/cards/transaction.ts`** (NEW; layer cards; pure, no import but the Card type) — **Transaction Deck**, **Blame Log**:

```ts
import type { Card } from "./types.js";
export const TRANSACTION_MARK = "# morph: subset transaction";
export function isTransactionDeck(cards: readonly Card[]): boolean;   // some acceptance starts with TRANSACTION_MARK + "\n"
export interface Blame { cards: string[]; outside: string[] }
export function blameLog(log: string, card: string, owners: Record<string, string>, fileLines: readonly string[],
  exists: (path: string) => boolean): Blame;
```

- blameLog: per line of `log.split("\n")`, `trimEnd()`ed: "" or a first character "#", " " or "\t" → skipped; else the
  FIRST `new RegExp(fileLines[i])` (in order) that matches: p = group 1, rest = group 2 (none → ignored); p an own key of
  owners → owners[p]; else `exists(p)` false → card (a file of the acceptance itself, gone when it ends — a probe); else
  p + rest into outside. No line matched → card. Both lists unique, `sort()`.

| example | given | result |
|---|---|---|
| Transaction Deck 1 | [a TRANSACTION_MARK + "\nexit 0", b null]; [a "exit 0", b null]; [] | true; false; false |
| Transaction Deck 2 | TRANSACTION_MARK alone; " " + TRANSACTION_MARK + "\nexit 0"; "exit 0\n" + TRANSACTION_MARK + "\n" | false ×3 |
| Blame Log 1 | go, "k7", owners {rate/rate.go: k7, pump/flow.go: p2, rate/rate_examples_test.go: kj}, FL, on [cmd/tool/main.go, pump/flow.go, rate/rate.go]; then owners without kj's, exists false | {cards [k7, p2], outside ["cmd/tool/main.go:6:2: m.Old undefined (type *rate.Meter has no field or method Old)"]}; {cards [k7, p2], outside []} |
| Blame Log 2 | typescript, "w3", owners {src/units/len.ts: w3, src/report/total.ts: rt, tests/report/total.examples.test.ts: rtj}, FL, on those three; then "rt", {src/report/total.ts: rt}, exists true | {cards [rt, rtj, w3], outside []}; {cards [rt], outside [the probe line, `src/units/len.ts(9,3): error TS1005: ';' expected.`, the total.examples line once]} |
| Blame Log 3 | none, "n4"; ""; "src/a.ts(1,1): error TS1: x\n" with "z", {src/a.ts: q}; go, "k7", {}, fileLines [] | [n4]; [n4]; [q]; [k7] — outside [] each |
| Blame Log 4 | go, "k7", {pump/flow.go: p2}, [FL[1], FL[2]], exists true | {cards [p2], outside [main.go's line, `rate/k7_probe_test.go:9:2: undefined: rate.Mid`, `rate/rate.go:3:1: missing return`]} |

**`src/runloop/transaction.ts`** (NEW; layer runloop; node:fs, node:path) and **`src/runloop/deck.ts`** (PATCH: its first
statement) — **Run Transaction** (Component runloop-subset), exactly as the record's behaviour:

```ts
export async function runTransaction(input: RunInput, deps: RunDeps): Promise<RunResult>;
// deck.ts, the first statement of runDeck:
//   if (isTransactionDeck(input.deck.cards)) return runTransaction(input, deps);
```

1. owners (every target → its card, deck order); before = snapshotTargets(root, every target).
2. **Write**: W = runDeck(input, each card with acceptance "true", deps with commit () => null). W.report.fault, or any W
   outcome not "written" → rollback, no acceptance runs.
3. **Rounds**: every card in deck order runs its own acceptance (runAcceptance, env deps.env, timeout
   deps.acceptanceTimeoutMs ?? DEFAULT_TIMEOUT_MS); red → blameLog(log, id, owners, TREE_PROFILES' fileLines in order,
   p → fs.existsSync(path.join(root, p))). All green → deps.commit(attempt id, targets) per card, deck order; done.
4. Any outside line → fault "outside the subset: " + all of them (unique, sorted) joined ", "; rollback.
5. blamed = every id a red Blame names, deck order. One with 2 retries done (W's count), or batches ≥ maxRetryBatches →
   rollback. deps.interrupted?.() a string s → throw Error("interrupted by " + s). deps.now() ≥ deadline → rollback, the
   blamed "budget-exceeded" "deadline".
6. **Retry batch** (batches += 1): per blamed card `{...buildRetry(card, n, acceptanceOutput, previousDiff), acceptance:
   "true"}` — acceptanceOutput the logs of this round's red cards whose Blame names it (deck order, "\n"-joined),
   previousDiff buildAttemptDiff(before's text of its targets, null when absent; their text on disk now, "" when
   absent); processGeneration(those, deps with commit () => null, root); then the next round on the same tree.
7. **Outcomes** — written: attempts 1 + retries, winningVariant the last written attempt's, acceptanceLog its last round's
   log, earlierFailures W's + its red round logs. Rollback: restoreSnapshot(before); W's non-written outcome kept; else
   status "failed" (or "budget-exceeded" in 5), reason "outside the subset" | "acceptance failed" (its last round red and
   its Blame names itself) | "transaction rolled back", attempts 1 + retries, winningVariant null, acceptanceLog its last
   round's log (W's when none ran), earlierFailures W's + its red logs of earlier rounds, commit and diffstat null.
8. A thrown value before the first commit: before restored, every card {skipped, "fault", attempts 0, …}; after: the
   committed stay written, the rest skipped "fault", nothing restored; report.fault the message.
9. Report: runId, completedAt deps.now(), branch, processor, generations W's, outcomes deck order, usageTotals W's + the
   retries' (cost null when none), requests W's then the retries', fault last when set.

| example | given (M = TRANSACTION_MARK + "\n") | result |
|---|---|---|
| Run Transaction 1 | a → out/a.ts M+"grep -q B2 out/b.ts && grep -q A1 out/a.ts", b → out/b.ts (after a) M+"grep -q B2 out/b.ts"; then runDeck | both written, attempts 1, a.v1/b.v1; hook a, b; generations 2; requests a.v1, b.v1; no fault; runDeck the same |
| Run Transaction 2 | a's acceptance echoes `out/b.ts(1,14): error TS2305: b is old` unless b holds B_NEW; b.md B_OLD, b.r1.md B_NEW | a written 1 attempt, earlierFailures [that line + "\n"]; b written 2 attempts, b.r1.v1; requests a.v1, b.v1, b.r1.v1; hook a, b.r1; the b.r1.v1 request holds the line and `<previous_attempt_diff>` |
| Run Transaction 3 | out/legacy.ts on disk; a echoes `out/legacy.ts(3,4): error TS2304: Cannot find name 'q7'.` and exits 1 | a "outside the subset", b "transaction rolled back"; fault "outside the subset: out/legacy.ts(3,4): …", last key; out/a.ts, out/b.ts absent; no commit; requests 2 |
| Run Transaction 4 | [s] [j, p]; j red once (`[ -f j.once ] || …`) then needs out/p.ts | j retried once after p wrote: j 2 attempts, earlierFailures ["forced red\n"]; requests s.v1, j.v1, p.v1, j.r1.v1; hook s, j.r1, p |
| Run Transaction 5 | out/a.ts OLD; a M+"echo red-a7; exit 1" (a.md, a.r1.md, a.r2.md), b M+"exit 0"; maxRetryBatches 8 | a "acceptance failed" 3 attempts, earlierFailures ["red-a7\n" ×2]; b "transaction rolled back"; requests 4; out/a.ts OLD, out/b.ts absent; no commit |
| Run Transaction 6 | example 5, maxRetryBatches 0 | a 1 attempt, earlierFailures []; requests 2 |
| Run Transaction 7 | no b answer at all; a's acceptance would touch ran-a; maxRetryBatches 2 | a "transaction rolled back"; b W's "failed" "acceptance failed" 3 attempts, log "answer corrupt: stub has no answer: <answersDir>/b.r2.v1.md"; requests 4; out/a.ts, ran-a absent |

**`src/builder/types.ts`, `src/builder/buildAcceptances.ts`** (PATCH) — **Build Acceptances**: BuildInput gains
`transaction?: boolean` (last). `transaction === true` → every member's ctx.siblings `[]`, input.hide not read; once all
are built, each member's acceptance = `TRANSACTION_MARK + "\n" + script.replace(untrackedStep(member.targets), () =>
untrackedStep(ALL))`, ALL = every member's targets in the checks' order, each once. Absent or false → byte for byte.

| example | given | result |
|---|---|---|
| Build Acceptances 10 | TypeScript a, b, j (examples.json); transaction true + hide {a: [src/x/b.ts]}; then transaction false, no hide; then example 5's Go input + transaction true | the skeleton's expectations for a, b, j; equal to the call with neither key; percent-of = mark + code1.txt with its overlay line `{"Replace":{"calc/clamp_value_examples_test.go":""}}` → `{"Replace":{}}` and `-e calc/percent_of.go ||` → `-e calc/percent_of.go -e calc/clamp_value_examples_test.go ||` |

**`src/planner/stubTrees.ts`** (PATCH) — **Stub Trees**: a card whose acceptance ("" when null) starts with
`TRANSACTION_MARK + "\n"` stubs, with a config, the targets of every card of EVERY generation (flattened in order, itself
among them), not generations[0..g-1] then itself; nothing else changes.

| example | given | result |
|---|---|---|
| Stub Trees 4 | stub.cards.json with the mark before a's, u's, j's acceptances; example 1's generations, stubDir, L; stubs + calc/b_test.go, calc/n.go | stub.trees.p21c.json["4"]: a and j stub calc/a.go, calc/n.go, calc/b.go, calc/b_test.go, report/c.go, calc/a_examples_test.go, missing [calc/v.go]; u missing [tests/u.test.ts]; the other six as without the mark |

**`src/cli/planCommand.ts`** (PATCH) — **Plan Command**: with args.only (and --checks) the object passed to
buildAcceptances is the input + `transaction: true`; Hide Later and Read Go Tree are no longer called (both imports go).
Without --only nothing changes; any language (the probe's row cuts ts-rename). Plan Command 12–14 as amended in `tests/fixtures/cli/examples.json`: 12 — the one card's
acceptance is `TRANSACTION_MARK + "\n"` + the full cut's with `{"Replace":{"calc/clamp_value.go":""}}` → `{"Replace":{}}`;
13 — each of format-share and percent-of-judge = mark + its goMini.deck.json acceptance with its sibling overlay line →
`{"Replace":{}}` and its untracked step → U2 (both targets); `--only` without checks unchanged, no mark; 14 — every
acceptance marked, phase-loop's `{"Replace":{}}` twice and no `"supervisor/guard.go":""`, every untracked step U8 (the 8
targets in the checks' order), each `--only` acceptance = mark + the plain one with its first Replace line made
`{"Replace":{}}` and its untracked step made U8; without mcp/session.go the same cut.

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P21c transaction"; #12 = issue VasyaLutiy/morph#12):

- **Size** · 10 cards, 4 generations: no split, no P21d · the transaction, its blame, the cut mark and the deck check's
  tree fit the 12-card bound; the live go-p7b smoke on ds is the session's after the merge (AUTONOMY, issue #12).
- **What tells the runner** · the first line of an acceptance, `# morph: subset transaction` (TRANSACTION_MARK), written
  by Build Acceptances for a Plan Command `--only` cut with `--checks`; a deck with no such line runs as before ·
  loadDeck refuses an unknown Card key and a non-array deck file, and every tool (scale_tokens, stubcheck, deck check,
  card/accept) reads the deck as an array of Cards: a shell comment changes no tool and no existing deck.
- **Which decks** · `--only` with `--checks` only; `--only` without checks keeps the map's acceptances and no mark (Plan
  Command 13's last part) · the builder writes the mark; a hand acceptance cannot promise deferral.
- **The full tree** · in a transaction no stage hides anything: siblings `[]`, hide ignored, Hide Later and Read Go Tree no
  longer called (left in src/, unused; removal out of scope) · every stage of every card runs on the tree with all the
  subset written (4efde92 §6.2); hiding at run time is rejected (§6.5).
- **Untracked step** · a transaction acceptance accepts every member's targets as untracked · the other cards' NEW files
  are on the tree, uncommitted, while the rounds run.
- **Write** · Run Deck itself on the cards with acceptance "true" and a null commit hook · generations, budget, interrupts,
  skips and the retries of an unwritable answer stay Run Deck's; later cards' slices read earlier cards' files (the
  operator's "written by generations as today"). The first answer that parses is the one written: variants beyond it
  stay "untried" (best-of-N needs an acceptance).
- **Blame** · owner of the named file; a named file that is gone (a probe) or no named file → the card itself; an existing
  file no card owns → outside · every Tree Profile's fileLine, in order, on every log — the deck's language need not be
  known and nothing names one (comment 6077766447).
- **Retry context** · the logs that blame it (a card blamed through another card's log sees that log) and its diff
  against the run's start.
- **Bounds** · 2 retries per card (W's included), batches ≤ maxRetryBatches (a counter of the transaction's own) · "rounds
  bounded like today's attempts"; a round costs nothing.
- **End** · all green → every card committed, deck order, with the id of the attempt on the tree; anything else → every
  target restored, nothing committed · a partial commit leaves main uncompilable, the P7b case itself.
- **Outside** · fault "outside the subset: <lines>" (exit 3), rolled back · a record break of a caller the subset does not
  re-cut, named; `deck check` should have named it at the gate.
- **Variant records** · W's records carry the "true" acceptance's verdict ("accepted", stage 0) · the outcomes carry the
  rounds' verdicts; the archive keeps every answer (known limit).
- **Deck check** · a transaction card's stub tree holds the whole subset (Stub Trees) · the tree its acceptance sees; P21b's
  first-attempt tree would flag every later-generation file.
- **Ripple** · Plan Command 12–14 amended (examples.json), their two test files the plan-command judge's targets (old
  names dropped), out of every full run of this deck (`fullExclude`) · 3 of 834 red with the reference code.
- **Forced judge retry** · a red-once step in the deck copy (`[ -f <mark> ] || { touch <mark>; echo "forced red once";
  exit 1; }` after the mark line), data of the demo and of the live smoke, never in src/.

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/cards/transaction.ts` | NEW | probe only | NEW `tests/cards/transaction.examples.test.ts` (Transaction Deck 1–2, Blame Log 1–4) |
| `src/builder/types.ts`, `buildAcceptances.ts` | PATCH | probe only | NEW `tests/builder/buildAcceptances.p21c.examples.test.ts` (Build Acceptances 10) |
| `src/planner/stubTrees.ts` | PATCH | probe only | NEW `tests/planner/stubTrees.p21c.examples.test.ts` (Stub Trees 4) |
| `src/runloop/transaction.ts`, `deck.ts` | NEW + PATCH | probe only | NEW `tests/runloop/transaction.examples.test.ts` (Run Transaction 1–7) |
| `src/cli/planCommand.ts` | PATCH | probe only | PATCH `tests/cli/planCommand.p20.examples.test.ts` (12, 13) and `planCommand.p21.examples.test.ts` (14) |

- Each judge: "<Function> example <n>: <what>", one per example in record order, the skeleton's helpers; at most 6 own tests.

### 2.4. What must not break

- Byte for byte: every file outside the 7 code targets and the 6 judge files — every other `src/` file, `tests/helpers.ts`,
  every other test file, `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/`, `templates/` (frozen).
- Every cut without `--only` byte for byte: go-mini `--checks decks/m1/checks.json` (75 416 B), the P15 re-cut from
  0365336 (398 622 B), go-p7b without `--only` (100 388 B) — main's binary vs the run's (§11). Every existing deck file
  runs as before (no mark).
- 834 tests in 137 files green at every card but the 3 of the two excluded files; after the run **834 + 6 + 1 + 1 + 7 =
  849** in 141 files (± the judges' own).

## 3. Acceptance

Built by `morph plan --checks decks/p21c/checks.json`, narrow to broad, every stage printing `== <stage>`. `ownGit: true`,
`frozen` the defaults + `templates`, `fullExclude` the two Plan Command test files (ripple §1).

Code cards (code-only targets): `probe/<card>/` → `tsc` (per-card tsconfig) → `eslint <targets>` → `guard.mjs src
<targets>` → the probe `decks/p21c/parts/<card>.probe.ts` (transaction-deck TD 1–2 + BL 1–4 + 1 row = 7;
build-acceptances BA 10 + 1 row = 2; stub-trees ST 4 + 2 rows = 3; run-transaction RT 1–7 + 2 rows = 9; plan-command PC
12–14 + 1 row (a TypeScript `--only` cut, ts-rename, is a transaction too) = 4; **25 tests**) → eslint's verdict → full `vitest run` → own git → frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs tests <file> <min> <max> lits<i>.json` (and `==
names <file>` for a patched file) → `vitest run <targets>` → eslint's verdict → full run → own git → frozen → untracked.

| file | new | min | max | lits |
|---|---|---|---|---|
| `tests/cards/transaction.examples.test.ts` | yes | 6 | 12 | `Transaction Deck example 1`, `2`, `Blame Log example 1` … `4`, `cards/blameLogs.json`, `toYards`, `n4` |
| `tests/builder/buildAcceptances.p21c.examples.test.ts` | yes | 1 | 7 | `Build Acceptances example 10`, `builder/go/code1.txt`, `tests/x/old.test.ts`, `calc/clamp_value_examples_test.go` |
| `tests/planner/stubTrees.p21c.examples.test.ts` | yes | 1 | 7 | `Stub Trees example 4`, `planner/stub.trees.p21c.json`, `planner/stub.cards.json`, `decks/q9/_stubs` |
| `tests/runloop/transaction.examples.test.ts` | yes | 7 | 13 | `Run Transaction example 1` … `7`, `outside the subset: out/legacy.ts(3,4)`, `transaction rolled back`, `j.once`, `b.r1.v1` |
| `tests/cli/planCommand.p20.examples.test.ts` | no | 2 | 4 | `Plan Command example 12`, `13`, `TRANSACTION_MARK`; drop the two old names |
| `tests/cli/planCommand.p21.examples.test.ts` | no | 1 | 3 | `Plan Command example 14`, `TRANSACTION_MARK`, `mcp/session.go`; drop the old name |

min = the record's examples in the file; max = min + 6 (the patched files: the old count + 2).

**Output budget** (`max_tokens`, before the session's ×3 for `ds`):

| card | returns | `max_tokens` |
|---|---|---|
| transaction-deck, stub-trees | ≈ 1.5–4 KB | 8 000 |
| plan-command | planCommand.ts ≈ 4.8 KB whole | 12 000 |
| build-acceptances | types.ts + buildAcceptances.ts ≈ 7.5 KB whole | 14 000 |
| run-transaction | transaction.ts ≈ 9 KB new + deck.ts 12.7 KB whole | 16 000 |
| transaction-deck-judge, build-acceptances-judge, stub-trees-judge | ≈ 3–6 KB new | 16 000 |
| plan-command-judge | two whole files ≈ 9 KB | 20 000 |
| run-transaction-judge | ≈ 12–14 KB new, seven tmp-root harnesses | 24 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- **Layers** (guard unchanged): src/cards/transaction.ts imports nothing but the Card type; builder and planner import
  TRANSACTION_MARK from ../cards/transaction.js (both may import cards); src/runloop/transaction.ts imports node:fs,
  node:path, cards, language, acceptance and runloop modules, runs no git and reads no process.env; planCommand.ts as
  before minus two imports.
- **No fixture names in src/**: no identifier, path or card id of P7b, go-p7b or ts-rename; no language name in
  transaction.ts (the patterns are Tree Profiles').
- A file a card writes is in no sibling's slice in the same generation: 0 [transaction-deck]; 1 [build-acceptances,
  run-transaction, stub-trees, transaction-deck-judge] read transaction.ts; 2 [build-acceptances-judge, plan-command,
  run-transaction-judge, stub-trees-judge] read generation 1's files; 3 [plan-command-judge] reads planCommand.ts.
- Tests write only under `tmpRoot()` and remove it; no JS timer; no network; a judge writes only its targets.

## 7. Out of scope

Data of this phase (orchestrator, committed before the run): the fixtures of §2.1, the record, the map, `decks/p21c/`
(checks, probes, deck, demo.sh and its ts-rename answers). After the merge, the session: the live go-p7b smoke on ds
(issue #12: the transaction deck cut by the run's binary, control-contract-judge forced red once, no hand edit of code),
the demo with the run's binary, AUTONOMY step 1 (a Go `--only` deck's fullvet.mjs line is replaced by deck check's
whole-subset tree) and the templates' docs.

Also out: removing Hide Later and Read Go Tree (unused once Plan Command passes no hide); best-of-N variants inside a
transaction; a transaction of a deck cut without `--checks`; per-language blame data beyond Tree Profiles' fileLine; a
smarter blame of a red full stage whose output names no file (a later judge's failing test blames the card whose
acceptance ran: more retries, known risk); a `--no-transaction` flag; Python acceptances (no builder).

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component cards --component runloop-subset \
  --component builder --component planner-subset --component cli --judge --checks decks/p21c/checks.json \
  --only transaction-deck,build-acceptances,stub-trees,run-transaction,plan-command,transaction-deck-judge,build-acceptances-judge,stub-trees-judge,run-transaction-judge,plan-command-judge \
  --out decks/p21c/deck.json
python3 decks/tools/scale_tokens.py decks/p21c/deck.json 3         # processor ds
node dist/cli.js deck check --root . --deck decks/p21c/deck.json                                  # errors 0
rm -rf /tmp/v2bin-p21c && mkdir -p /tmp/v2bin-p21c && cp -r dist /tmp/v2bin-p21c/ && ln -s $PWD/node_modules /tmp/v2bin-p21c/node_modules \
  && ln -s $PWD/templates /tmp/v2bin-p21c/templates
node /tmp/v2bin-p21c/dist/cli.js run --root . --deck decks/p21c/deck.json --processor ds --deadline 2400
```

The deck is cut by main's binary (no transaction yet): it runs card by card as before.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 10 (5 code, 5 judges) / 4: [transaction-deck] [build-acceptances, run-transaction, stub-trees, transaction-deck-judge] [build-acceptances-judge, plan-command, run-transaction-judge, stub-trees-judge] [plan-command-judge] |
| executor bill | ≈ $0.20–0.35 on ds ×3 (P21b: 10 cards $0.2508); ≤ $0.60 with a re-cut; cap $5 |
| cards with regeneration | 1–3 of 10 (run-transaction: the attempts count, the earlierFailures of a rollback, deck.ts rewritten; build-acceptances: a replacement string with `$`; plan-command-judge: an old name kept or a helper left unused; run-transaction-judge: a harness without answersDir) |
| tests after the run | 849 ± 6 in 141 files |
| first red | transaction-deck: a trailing "\r" kept, the gone-file rule inverted; run-transaction: commits before the last round, a retry built from the retry card, rollback leaving W's attempts; build-acceptances: the mark after the snapshot lines; stub-trees: the mark tested anywhere |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no answer cut at its `max_tokens`; (3) after the run no
file outside §2.3's thirteen changed; (4) every cut without `--only` byte for byte; (5) this repository's HEAD and refs
unchanged by every card; (6) after the merge `decks/p21c/demo.sh <run's binary> <main's binary at eeda36f>` prints
ts-rename 4/4 and go-p7b 8/8 (control-contract-judge 2 attempts) under the transaction, the two reds with blame
length-line and runtime-guard without it, and the r3 stop naming `mcp/count.go`; (7) no P7b / go-p7b / ts-rename name in
`src/` (grep).

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the MEASURE row
with its `прогоны` cell, the vitest log of every verify run; DECISIONS lines "P21c transaction"; after the merge the byte
identity re-cuts against main's binary, claims 6 and 7, the live go-p7b smoke; then 🧪 and the stop for the operator
(`~/.morph-wait-operator`).

## 11. Actual

### Gate (preparation)

09.10, on the VPS, by the preparing orchestrator (Opus 5.5, fresh context, no sub-agents); no paid run, no model call.

The deck **cut by V2** (main's binary, eeda36f code; data 1b879fa + the gate commit): `plan --component cards --component
runloop-subset --component builder --component planner-subset --component cli --judge --checks decks/p21c/checks.json
--only <the 10 ids>` **exit 0**, 10 cards, generations `[transaction-deck] [build-acceptances, run-transaction,
stub-trees, transaction-deck-judge] [build-acceptances-judge, plan-command, run-transaction-judge, stub-trees-judge]
[plan-command-judge]`; `scale_tokens.py … 3` (maxTokens: transaction-deck, stub-trees 24 000; plan-command 36 000;
build-acceptances 42 000; run-transaction 48 000; transaction-deck-judge, build-acceptances-judge, stub-trees-judge 48 000;
plan-command-judge 60 000; run-transaction-judge 72 000); `deck check` **0 errors, 0 warnings, 0 hazards** (no `_stubs/`
beside it). Slices (slice + existing targets): 39.6–95.5 KB, the largest plan-command-judge **95 513 B** (two whole test
files and examples.json); ≤ ≈ 105 KB once generation 1's files exist. Deck 359 650 B.

Scratch worktree `/tmp/p21c-scratch/gate2` from 1b879fa (removed afterwards; no watcher or worker left), the deck's own
acceptances run as Morph runs them (`/bin/sh -c`, 300 s cap), cards in deck order, each reference committed before the
next:
- **Stubs, red per example at the probe**, typed throwing stubs (`stub isTransactionDeck 1`, `stub blameLog …`, `stub
  buildAcceptances 3true`, `stub stubTrees [9,3,"decks/q9/_stubs",9,3]`, `stub runTransaction …`, `stub planCommand …`;
  the mark stub `# stub mark`): transaction-deck 7/7, build-acceptances 2/2, stub-trees 3/3, run-transaction 8/9 (all 7
  examples; the plain-deck row passes on main's deck.ts), plan-command 4/4; judges red at `guard: <file> missing`, the
  plan-command judge at `guard: tests/cli/planCommand.p20.examples.test.ts does not mention the example literal
  "TRANSACTION_MARK"`. **stubcheck.mjs exit 0 on all 10 stub logs** (and on the two re-runs after the probe rows below).
  fullvet does not apply (a TypeScript deck).
- **References green, chain seconds** (limit 250): transaction-deck 111.6, build-acceptances 116.2, run-transaction 116.6
  (109.6 after the rows), stub-trees 108.3, transaction-deck-judge 108.2, build-acceptances-judge 107.7, plan-command 109.3
  (108.3), run-transaction-judge 109.5, stub-trees-judge 112.1, plan-command-judge 109.6 — **max 116.6 s**. Final tree
  `vitest run` **854 / 854 in 141 files** (834 + the reference judges' 20); ripple 3 of 834 as §1; `git status` clean.
- **Mutants** (the changed contracts only), each under a 120 s subprocess timeout against its probe: **29 mutants** (9
  cards/transaction.ts, 4 buildAcceptances.ts, 2 stubTrees.ts, 12 runloop/transaction.ts + deck.ts, 2 planCommand.ts), two
  passes **1.4 min**, max 2.5 s, 0 timeouts. First pass 24 killed; three survivors were real gaps of the probes (the
  outside lines' order and joint, the retry context's "\n" joint, a transaction for Go only) and got probe rows (two
  outside lines; two cards blaming one; a TypeScript `--only` cut of ts-rename); the deck was re-cut (only run-transaction's
  and plan-command's acceptances changed) and both re-gated. Second pass **27 killed**; survivors: Blame Log without the
  "#" skip, and without the tab skip — equivalent for every Tree Profiles pattern (all anchored on `^\S`) — DECISIONS
  known risk.
- **Demo** (`decks/p21c/demo.sh /tmp/p21c-scratch/bin-ref /tmp/p21c-scratch/bin-main`, 63 s; §1's table): ts-rename main 0/4
  (to-metres `src/report/line.ts(1,17)` → length-line), transaction **4/4**; go-p7b with control-contract-judge forced red
  once: main 2/8 (the judge's retries `supervisor/guard.go:20:23: l.Resumes undefined` → runtime-guard: the P21a smoke RED
  reproduced on stubs), transaction **8/8**, the judge 2 attempts, 9 requests, 8 commits + the archive on the run branch;
  go-p7b + `mcp/count.go` (r3): exit 3, fault `outside the subset: mcp/count.go:6:52: l.Resumes undefined …`, nothing
  committed.
- **Deck check on transaction decks** (the cuts of the demo beside the fixtures' `_stubs/`): go-p7b reference binary 0
  errors (main's 9, its first-attempt trees); ts-rename reference 0 (main's 6).
- **Byte identity** (main's binary eeda36f vs the reference binary): go-mini `--checks decks/m1/checks.json` **75 416 B
  identical**; the P15 deck re-cut from 0365336 (filter, ×3) **398 622 B identical**, equal to the committed deck; go-p7b
  without `--only` **100 388 B identical**. The session rechecks them with the run's binary.
- No `src/` file of the reference names P7b, go-p7b, ts-rename, supervisor or Resumes (grep).

**Forecast** on `ds` with every maxTokens × 3: P21b ran 10 cards for $0.2508 with a fix (19 requests); here 15 first
requests (5 code × 2 variants + 5 judges), 40–105 KB in, answers 1.5–23 KB: **≈ $0.20–0.35**, ≤ $0.60 with a re-cut; ≤ $1.
**Gate holds.** No split (P21d not needed).

**Run command** (from the repo root, the binary copied first; the deck is already scaled ×3):

```
npm run build && rm -rf /tmp/v2bin-p21c && mkdir -p /tmp/v2bin-p21c && cp -r dist /tmp/v2bin-p21c/ && ln -s $PWD/node_modules /tmp/v2bin-p21c/node_modules && ln -s $PWD/templates /tmp/v2bin-p21c/templates
node /tmp/v2bin-p21c/dist/cli.js run --root . --deck decks/p21c/deck.json --processor ds --deadline 2400 > /tmp/p21c-run.json
```
