# TASK_P24b — issue #16 (operator 10.10): the group `morph accept --id a,b,c`, answers from a run's archive (`src/debt/acceptGroup.ts`, `src/cli/types.ts`, `src/cli/parse.ts`, `src/cli/main.ts`)

Old-Morph scheme (README.md, Morph-Orchestrator v1). Record: Component debt, NEW Function Accept Group (examples 1–6) and
Data Object Accept Group Document; Component cli, Function Parse Command (accept's rules, example 25), Function Main
(the accept route, example 18), Data Object Command. Cut with `--only` (the code cards' Components hold other
Functions): the deck is a transaction.

## 1. Why this

- Two MorphV2 transactions were rolled back 0/10 with 9/10 green on the final tree (P22a run 20261009-175810, P22b run
  20261009-211927). Both were salvaged by hand: the archived answers parsed by a hand script, then `morph accept
  --commit` card by card in import order, 9 commits each marked `Morph-Debt: true` although a ds run wrote them.
- MorphStudio P7b (PM, 10.10): 12 archived answers are green as a group (210 tests), but `accept --id` takes one card:
  a rename across two cards (Resumes→Restarts, loop.go + guard.go) and a new field across two (Exited, daemon.go +
  pump.go) are red one card at a time. P7b is blocked; the alternative is paying the whole run again.
- The fix deck after P22b's rollback regenerated all ten cards ($0.1752) where one red card needed a re-cut ($0.0069).

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main**: `src/debt/acceptCard.ts` — `AcceptOptions`, `AcceptDeps` {env, timeoutMs?}, `changedOutside(root,
  targets, env)`, `acceptCard`; `src/debt/cardBrief.ts` — `DebtResult` {code, document}, `findCard(root, deck, id)` →
  `{ok: true, card} | {ok: false, result}`, `RUNS_DIR` ".morph/runs"; `src/cards/layer.ts` — `layerGenerations(deck):
  string[][]`; `src/cards/model.ts` — `loadDeck(text)` → `{ok: true, deck} | {ok: false, faults}`;
  `src/compiler/parse.ts` — `parseAnswer(answer, targets)` → `{files: Record<path, text>} | {corrupt: string} |
  {truncated: true}` (the run's own parse, `src/runloop/generation.ts:177`); `src/acceptance/snapshot.ts` —
  `snapshotTargets(root, targets)`, `restoreSnapshot(snapshot)`; `src/acceptance/run.ts` — `runAcceptance(command, root,
  {env, timeoutMs})` → {exit, log, timedOut}, `DEFAULT_TIMEOUT_MS`; `src/git/commit.ts` — `commitPaths(root, paths,
  subject, trailers, env, force)` → `{commit, diffstat} | null`; `src/git/types.ts` — `Trailer` ([key, value]),
  `Diffstat`.
- **A run's archive** (written by `src/git/archive.ts`): `.morph/runs/<runId>/report.json` (a RunReport; its
  `requests` array holds `{customId: "<card>[.r<n>].v<k>", model, …}` per request) and
  `.morph/runs/<runId>/answers/<customId>.answer.txt` (the raw answer text). The run's deck is
  `.morph/runs/<runId>/deck.json`; it is passed as `--deck`.
- **Fixtures** (`tests/fixtures/debt/`): `group.deck.json` — 6 cards in deck order use-judge (dependsOn use), use
  (dependsOn lib), two (targets src/x.ts, src/y.ts), lib, none (no acceptance), dup (target src/lib.ts, like lib);
  `group.run.json` — `{report, answers}`: report.requests for lib.v1, lib.r1.v1, lib.r2.v1, use.v1, use.v2,
  use-judge.v1 (model "z-ai/glm-5.3"), two.v1, two.v2 (every other model "deepseek/deepseek-v4.1-flash"); answers for
  all but lib.r2.v1 (two.v2 is truncated: one fence). Layer Generations of the deck: `[["two","lib","none","dup"],
  ["use"],["use-judge"]]`.
- **Accept Group harness** (examples 1–6): a `tmpRepo` t; `t.write("d.json", fixture("debt/group.deck.json"))`,
  `t.write("src/lib.ts", "export const lib = 1;\n")`, `t.write("src/use.ts", "export const use = 1;\n")`,
  `t.write("README.md", "r\n")`, `t.git(["add", "."])`, `t.git(["commit", "-q", "-m", "base"])`; the archive
  (examples 1–4): `const g = fixtureJson("debt/group.run.json") as {report: unknown; answers: Record<string, string>}`,
  `t.write(".morph/runs/r1/report.json", JSON.stringify(g.report))`, per `[k, v]` of `g.answers`
  `t.write(".morph/runs/r1/answers/" + k + ".answer.txt", v)`; `env = {PATH: process.env.PATH ?? ""}`;
  `await acceptGroup(t.root, {deck: "d.json", ids, model, fromRun, pick, commit}, {env})`. The commits of example 1:
  `t.git(["rev-list", "--reverse", "HEAD~4..HEAD"]).split("\n")`; a message: `t.git(["log", "-1", "--format=%B", ref])`.
- **Parse Command 25** (`tests/fixtures/cli/parseArgv.json["25"]` → `parse.json["25"]`, 12 argv, each a JSON array of
  single words):
  1. `["accept","--deck","d.json","--id","a,b,c","--model","m","--commit"]`
  2. `["accept","--deck","d.json","--id","a,b","--from-run","20261009-211927","--pick","b.r2.v1,a.r1.v1"]`
  3. `["accept","--deck","d.json","--id","a,a","--model","m"]`
  4. `["accept","--deck","d.json","--id","a,","--model","m"]`
  5. `["accept","--deck","d.json","--id","a","--from-run","r1","--model","m"]`
  6. `["accept","--deck","d.json","--id","a","--pick","a.v2","--model","m"]`
  7. `["accept","--deck","d.json","--id","a","--from-run","r 1"]`
  8. `["accept","--deck","d.json","--id","a","--from-run","r1","--pick","a.v1,a.v1"]`
  9. `["accept","--deck","d.json","--id","a","--from-run","r1","--commit"]`
  10. `["card","--deck","d.json","--id","a,b"]`
  11. `["card","--deck","d.json","--id","a","--from-run","r1"]`
  12. `["accept","--deck","d.json","--id","a","--model","m"]`
- **Main 18** (`tests/fixtures/cli/examples.json["Main 18"]`): the Accept Group harness with the archive; deps `{env:
  {PATH}, now: () => 0, cwd: t.root, transport: null}`; io collecting stdout and stderr; argv `["accept", "--deck",
  "d.json", "--id", "use,lib", "--from-run", "r1", "--commit"]`, then `["accept", "--deck", "d.json", "--id", "lib",
  "--from-run", "r1", "--pick", "lib.v2"]`.

### 2.2. OUTPUT data shapes

**`src/debt/acceptGroup.ts`** (NEW), layer debt, exports in this order:

```ts
export interface GroupOptions { deck: string; ids: string[]; model: string | null; fromRun: string | null; pick: string[]; commit: boolean }
export interface GroupCard {
  card: string; variant: string | null; model: string; exit: number | null; timedOut: boolean; green: boolean;
  log: string; commit: string | null; diffstat: Diffstat | null; reason: string | null;
}
export interface AcceptGroupDocument {
  deck: string; run: string | null; cards: GroupCard[]; outside: string[] | null; green: boolean;
  committed: number; restored: boolean; reason: string | null;
}
export async function acceptGroup(root: string, args: GroupOptions, deps: AcceptDeps): Promise<DebtResult>
```

The record's Accept Group behaviour, steps 1–9, in that order. Without fromRun a card's model is `args.model ?? ""`.

| step | does | writes |
|---|---|---|
| 1–3 | findCard per id; no acceptance → 2; a shared target → 2 | nothing |
| order | Layer Generations flattened, kept to the ids | — |
| 4 | fromRun: run dir (4), picks (4), per card request (2), answer file (2), parseAnswer corrupt / truncated (2) | nothing |
| 5 | commit: changedOutside over all listed targets, BEFORE any write | — |
| 6 | fromRun: snapshot of all listed targets, then every parsed file written | the targets |
| 7 | every card's acceptance on that one tree, in order; a red one stops nothing | — |
| 8 | all green, outside empty or null, commit → commitPaths per card in order | commits |
| 9 | fromRun and committed 0 → restoreSnapshot; restored true | the targets back |

Trailers: from the archive `Morph-Card, Morph-Model (the request's model), Morph-Variant, Morph-Run, Morph-Acceptance-Exit
0`; without it (the payer wrote the files: the debt path) `Morph-Card, Morph-Model (--model), Morph-Acceptance-Exit 0,
Morph-Debt true`. A payer's tree is never written or restored.

**`src/cli/types.ts`** (PATCH): `AcceptArgs` becomes `{ name: "accept"; root: string; pretty: boolean; deck: string; id:
string; model: string | null; commit: boolean; fromRun?: string; pick?: string[] }`. Nothing else changes.

**`src/cli/parse.ts`** (PATCH): ACCEPT_FLAGS gains "--from-run" and "--pick" (value flags); accept's checks after
"missing --id" (card keeps its own rules):

| order | condition | UsageError message |
|---|---|---|
| 1 | --id without "," not matching `^[A-Za-z0-9._-]+$` | `--id must match ^[A-Za-z0-9._-]+$ (got '<v>')` (unchanged) |
| 1 | --id with ",": an empty, repeated or non-matching element | `--id must be distinct card ids joined by "," (got '<v>')` |
| 2 | --from-run given, not matching `^[A-Za-z0-9._-]+$` | `--from-run must match ^[A-Za-z0-9._-]+$ (got '<v>')` |
| 3 | --from-run and --model both given | `--model does not apply with --from-run` |
| 4 | --pick without --from-run | `--pick needs --from-run` |
| 5 | no --from-run: no --model / bad --model | unchanged |
| 6 | --pick: an empty, repeated or non-matching element | `--pick must be distinct answer names joined by "," (got '<v>')` |

The command: `{name, root, pretty, deck, id (as given), model (null with --from-run), commit}`, then `fromRun` and
`pick` (split on ",") as keys only when given. A single `--id x --model m` gives exactly the old object.

**`src/cli/main.ts`** (PATCH): the accept route only:

```ts
} else if (command.name === "accept") {
  result = command.fromRun !== undefined || command.id.includes(",")
    ? await acceptGroup(root, { deck: command.deck, ids: command.id.split(","), model: command.model,
        fromRun: command.fromRun ?? null, pick: command.pick ?? [], commit: command.commit }, deps)
    : await acceptCard(root, { deck: command.deck, id: command.id, model: command.model ?? "", commit: command.commit }, deps);
```

and `import { acceptGroup } from "../debt/acceptGroup.js";`. Every other route stays as it is.

**The P7b set as one command** (issue #16, comment of 10.10): `morph accept --deck .morph/runs/<run>/deck.json --id
<the 12 ids, ",">  --from-run <run> --pick daemon-core-judge.r2.v1,pump-judge.r1.v1,config-and-main-judge.r1.v1
--commit` (every card not picked takes its v1).

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/debt/acceptGroup.ts` | NEW | probe only | NEW `tests/debt/acceptGroup.examples.test.ts` (Accept Group 1–6) |
| `src/cli/types.ts`, `src/cli/parse.ts`, `src/cli/main.ts` | PATCH | probe only | NEW `tests/cli/accept.p24b.examples.test.ts` (Parse Command 25, Main 18) |

- acceptGroup.examples: six tests "Accept Group example <n>: <what>", each on its own tmpRepo, removed in finally; the
  documents compared whole with toStrictEqual where the example gives every value (examples 1, 2, 4), else every value
  it names.
- accept.p24b.examples: "Parse Command example 25: <what>" maps parseArgv.json["25"] through parseCommand and compares
  the list whole with parse.json["25"]; "Main example 18: <what>" runs main twice on the harness and checks the codes,
  the documents' named values, the HEAD message and the stderr lines.

### 2.4. What must not break

- Byte for byte: every file but the 4 code targets and the 2 new judge files. Accept Card 1–5
  (`tests/debt/acceptCard.examples.test.ts`), Main 15, Parse Command 1–24 hold as written.
- 940 tests in 155 files green (measured on this tree, 10.10); after the run 940 + the judges' tests in 157 files.

## 3. Acceptance

Built by `morph plan --checks decks/p24b/checks.json`. `ownGit: true`, `frozen` the defaults + `templates`,
`fullExclude` the two new judge files.

- accept-group: tsc → eslint → guard → probe `decks/p24b/parts/accept-group.probe.ts` (Accept Group 1, 2, 4, 5, 6) → full.
- parse-command: tsc → eslint → guard → probe `decks/p24b/parts/parse-command.probe.ts` (Parse Command 25, Main 18) → full.
- Judges: new file, lits = the example names and the values named in §2.1/§2.3 (checks.json).

## 4. Constraints

- NodeNext, `.js` imports, `import type`, no `any`. Layer debt imports cards, compiler (parseAnswer, P24b),
  acceptance and git, and of Node only node:fs and node:path; no clock, no process.env. `decks/tools/guard.mjs` gains
  compiler for debt (data, this phase).
- acceptGroup.ts imports findCard and RUNS_DIR from "./cardBrief.js", changedOutside from "./acceptCard.js"; acceptCard.ts
  and cardBrief.ts do not change.
- Generations: accept-group (0); its judge and parse-command (1, main.ts imports acceptGroup); parse-command-judge (2).
- Tests write only under `tmpRoot()` / `tmpRepo()` and remove them; no JS timer; no network; each judge writes only its file.

## 7. Out of scope

- Import edges missing from the deck's dependsOn: the commit order is the deck's generations; `deck check` naming a
  missing edge is issue #16's last item, not this phase.
- `morph run` replaying an archive ("Must hold" 4 of #16, dropped by the operator 10.10).
- A `--pick` shorthand for "every v1" beyond the default; picking by round only (`a.r2` without `.v<k>`).
- Accept Card, Card Brief, the runner, deck check, the planner, the builder.
- MorphStudio P7b's live 12/12: the operator side, when the PM sends the archive.
