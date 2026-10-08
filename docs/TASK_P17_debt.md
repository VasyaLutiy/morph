# TASK_P17 — debt: `morph card` (the debt brief) and `morph accept` (a card's acceptance on the tree, the debt commit) (`src/debt/{cardBrief,acceptCard}.ts`, `src/cli/{types,parse,main}.ts`)

> Phase P17 of `docs/PLAN.md` ("Фазы по записи (после P2)": `P17 | cards/acceptance/git + cli (debt) | issue #8`),
> operator 08.10. Issue VasyaLutiy/morph#8 (label `P17-debt`; `gh issue list --label P17-debt`: #8 only; no other `P17-*`
> label) is built into the record: Component **debt** (NEW: Card Brief, Accept Card) and **cli** (Parse Command, Main:
> the routing; compacted first). PLAN's rule "a CLI command lives in its own Component, cli only routes" holds: both
> commands are Functions of debt, cli parses and routes. The deck is cut by V2 (`morph plan --component debt --component cli
> --judge --checks decks/p17/checks.json`), filtered to this phase's 7 cards by `decks/p17/filter.py`. **No split**: 7
> cards, one gate (≤ $1, slices ≤ 200 KB, chains < 250 s, §11). Out of this phase (§7): `run --only` (issue #8 item 3,
> optional) and the regulation part of #8 (AUTONOMY "Paying a debt on a V2 deck"), which the main session rewrites after
> the merge; issue #8's smoke is a described check for the main session after the run (§8).

## 1. Why this

- **Every debt stops the autonomous loop for the operator today.** AUTONOMY "Failure": a card red after its one fix is an
  emergency stop, paid only through `/morph-agent-run` "Paying a debt", and "Paying a debt on a V2 deck: `/morph-agent-run`
  does not read V2 decks yet; … the operator decides". Since P10a every deck is a V2 file (`decks/<phase>/deck.json`, 13
  phases P10a–P16 so far); none of them could be paid without the operator. The one debt paid so far (P5, issue #2) cost
  **$4.1723** of Fable and an operator restart.
- **The brief is assembled by hand.** The executor of a debt needs the card as glm saw it (instruction, slice, targets,
  acceptance, maxTokens) and why it failed. That lives in three places: the deck file, the tree, and the run archive
  `.morph/runs/<id>/report.json` (`outcomes[].reason`, `acceptanceLog`, `earlierFailures`) plus `answers/<id>.v<n>.answer.txt`.
  This repository holds **3** V2 archives with a failed card (20261007-110352 1 of 12, 20261007-110744 2 of 12,
  20261007-111944 1 of 2). Measured with the reference (§11): `card --md` on `decks/p16/deck.json` `primer-command` reads
  in **0.26 s**, a 141 KB document (markdown 67.8 KB: 3 slice files, the target, the run 20261008-105700 with 2 answer
  files); on `.morph/runs/20261007-111944/deck.json` `plan-spec-judge` it finds the NEWER run 20261008-074231 (written) —
  the archive's last word on the card, not the failed one.
- **The debt commit is unchecked today.** `Morph-Model: claude-fable-5-1` is written by an agent by hand; nothing proves the
  card's own acceptance ran green on exactly that tree, or that only the targets changed. `morph accept --commit` makes the
  runner's own acceptance call the judge and refuses a commit with a change outside the targets.
- **Ripple, measured** (the 5 reference files in a scratch worktree from 7c440e1 with this phase's data, full suite): **1 of
  748** red — `tests/cli/parse.examples.test.ts` "Parse Command example 8" (the no-command message lists ten commands).
- **Record sizes** (bytes of each Component block, from its `- name:` line to the next block): cli 28 933 → **29 259**
  (compaction first: the given and then of 13 examples — Read Deck File 1–3, Read Plan Checks 1–3, Plan Command 2–4, Main
  1, 2, 5, 7 — moved whole to `tests/fixtures/cli/examples.json`, each example now names them by key, the values
  identical; then the routing, Parse Command example 20 and Main 14, 15 by key); debt new **13 587**; Requirement
  Deterministic Core gains the P17 sentence.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main** (module → what the new code calls or constructs): `src/cards/model.ts` — `loadDeck(text):
  {ok: true, deck: {cards: Card[], externalDependsOn}} | {ok: false, faults: {key, message}[]}` (every default filled:
  contextSlice [], acceptance null, model null, maxTokens null, dependsOn []); `src/cards/types.ts` — `Card` (`customId,
  intent, targets, contextSlice, instruction, acceptance, model, maxTokens, reasoning, variants, dependsOn`);
  `src/acceptance/run.ts` — `runAcceptance(command, root, {env, timeoutMs}): Promise<{exit, log, timedOut}>` (`/bin/sh -c`
  from root, detached, the group killed on the timeout: exit null, timedOut true and the line `acceptance timed out after
  <ms> ms` appended; never rejects; the child env drops every key starting `MORPH_PROCESSOR_` or ending `_KEY`/`_TOKEN`;
  NO_COLOR=1, CI=1), `DEFAULT_TIMEOUT_MS` (300000, the runner's); `src/git/run.ts` — `gitOk(root, args, env)` (stdout, or
  throws `git <verb> failed (exit <n>): <first stderr line>`); `src/git/commit.ts` — `commitPaths(root, paths, subject,
  trailers, env, force)` (`git add -A [-f] -- <paths>`; nothing staged → null; else `{commit, diffstat {files, insertions,
  deletions}}`, the message `<subject>\n\n<trailer lines>`); `src/git/types.ts` — `Trailer` (`[string, string]`),
  `Diffstat`; `src/cli/types.ts` — `Command`, `CliDeps {env, now, cwd, transport, interrupted?}`.
- **The archive** (runloop's Run Report, git's Archive Run): `.morph/runs/<runId>/report.json` = `{runId, completedAt,
  branch, processor, generations, outcomes: [{customId, status, reason, attempts, winningVariant, acceptanceLog,
  earlierFailures: string[], commit, diffstat}], usageTotals, requests}`; `.morph/runs/<runId>/answers/<customId>.v<n>.answer.txt`
  and, for a retry, `<customId>.r<k>.v<n>.answer.txt` (measured: `.morph/runs/20261008-023835/answers/main-judge.r1.v1.answer.txt`).
- **Preconditions of the callees.** cards · Load Deck refuses a dependsOn cycle with the fault `dependsOn: dependsOn cycle
  a -> b -> a` (CB 3). acceptance · runAcceptance strips `GH_TOKEN` (ends in `_TOKEN`) from the child env (AC 4: the
  acceptance `test -z "$GH_TOKEN"` is green with GH_TOKEN given). git · `status --porcelain --untracked-files=all` lists an
  untracked file under `.morph/` (AC 1: `.morph/runs/x/report.json` is listed and must be dropped) and does not list a file
  under a `.gitignore`'d directory (AC 5: `out/g.ts`); `add -A -f` stages it (AC 5: the ignored target is committed).
  git · `tmpRepo()` of `tests/helpers.ts` commits "init" with no file and sets user.name/user.email in the repo config, so
  env `{PATH}` is enough to commit. git · `status` outside a repository exits 128 (AC 5: the promise rejects).
- **Fixtures** (`tests/fixtures/`), each by the type the Function takes:

| file | type | what it is | what the Function returns on it |
|---|---|---|---|
| `debt/deck.json` | text of ONE deck file (a JSON array of 3 cards) | `base` (generate, src/base.ts, acceptance "true"), `fmt.x` (patch, targets src/x.ts and src/y.ts, slice docs/b.md, docs/a.md, docs/gone.md, maxTokens 9000, dependsOn base), `solo` (generate, lib/solo.ts, no acceptance, model m/x) | CB 1–3, Main 14 |
| `debt/archive.json` | ONE object `{reports: {<runId>: object or text}, answers: {<runId>: names[]}}` | the run archive of CB 1–2: reports 20261101-090000 (ds; fmt.x failed, 3 attempts, completedAt the LARGEST), 20261102-100000 (glm53; base written, fmt.x failed, 2 attempts, 1 earlier failure), 20261103-110000 (ds; base only), `junk` = the text "{\n"; answers: 20261101-090000 fmt.x.v2; 20261102-100000 base.v1, fmt.x.r1.v1, fmt.x-judge.v1, fmt.x.v1, fmtzx.v1 | readLastRun("fmt.x") → 20261102-100000 with 2 answers (fmt.x.r1.v1, fmt.x.v1); readLastRun("base") → 20261103-110000, answers []; readLastRun("solo") → null |
| `debt/brief.fmt.x.md`, `debt/brief.solo.md` | text, each ends with one "\n" (880 and 376 bytes) | the exact markdown of CB 2 | markdown equals it |
| `debt/accept.deck.json` | text of ONE deck file (5 cards) | `fix-a` (target src/a.ts, acceptance `grep -q fixed src/a.ts \|\| { echo "FAIL: src/a.ts not fixed"; exit 1; }`), `fix-two` (targets src/b.ts, out/g.ts; acceptance `test -f src/b.ts && test -f out/g.ts && test "$MARK" = k7 && test -z "$GH_TOKEN"`), `slow` (`echo started; sleep 5`), `none` (no acceptance), `blank` (acceptance "  ") | AC 1–5, Main 15 |
| `cli/parseArgv.json`, `cli/parse.json` | ONE object each | key 8 second result names ten commands; key 20 (15 argv) added | Parse Command 8, 20 |
| `cli/examples.json` | ONE object | `"<Function> <n>"` → `{given, then}`: 13 more cli examples moved out of the record; Main 14 and 15 added | Main 14, 15 (the record's text) |

- **Harness skeletons** (only `tests/helpers.ts`):

```ts
// Card Brief (CB 1-2): t = tmpRoot(); t.write("d.json", fixture("debt/deck.json")); t.write("src/x.ts", "export const x = 1;\n");
//   t.write("docs/a.md", "# A\n"); t.write("docs/b.md", "B");
//   const A = fixtureJson("debt/archive.json") as { reports: Record<string, unknown>; answers: Record<string, string[]> };
//   for (const [id, r] of Object.entries(A.reports))
//     t.write(".morph/runs/" + id + "/report.json", typeof r === "string" ? r : JSON.stringify(r, null, 2) + "\n");
//   for (const [id, names] of Object.entries(A.answers)) for (const n of names) t.write(".morph/runs/" + id + "/answers/" + n, "A\n");
//   cardBrief(t.root, { deck: "d.json", id: "fmt.x", md: false });   try { … } finally { t.rm(); }
// Accept Card (AC 1-3, 5): t = tmpRepo(); t.write("d.json", fixture("debt/accept.deck.json")); t.write("src/a.ts", "broken\n");
//   t.write("README.md", "r\n"); t.git(["add", "."]); t.git(["commit", "-q", "-m", "base"]);
//   const base = t.git(["rev-parse", "HEAD"]); t.write("src/a.ts", "fixed\n");
//   await acceptCard(t.root, { deck: "d.json", id: "fix-a", model: "claude-fable-5-1", commit: true }, { env: { PATH: process.env.PATH ?? "" } });
//   t.git(["log", "-1", "--format=%B"]) is the HEAD message (git trims the final newline); try { … } finally { t.rm(); }
```

**Distinct markers.** Card ids `base`, `fmt.x` (a `.` that an unescaped regex would let match `fmtzx`), `solo`, `fix-a`,
`fix-two`, `slow`, `none`, `blank`, `zz`; runs `20261101-090000`, `20261102-100000`, `20261103-110000`, `junk`;
processors `ds`, `glm53`; models `claude-fable-5-1`, `acme/m:free`, `m/x`; maxTokens 9000; env `MARK` (`k7`, `k8`),
`GH_TOKEN`; timeouts 300 ms; paths `src/x.ts`, `src/y.ts`, `docs/a.md`, `docs/b.md`, `docs/gone.md`, `lib/solo.ts`,
`src/a.ts`, `src/b.ts`, `out/g.ts`, `README.md`, `notes/n.txt`, `.morph/runs/x/report.json`. The code hard-codes none of
them: the deck, the id, the model, the timeouts and the archive are arguments or the tree's; `RUNS_DIR`, the trailer keys,
the messages and the document's keys are the contract.

### 2.2. OUTPUT data shapes

**`src/debt/cardBrief.ts`** (NEW; layer debt; node:fs and node:path only):

```ts
export interface DebtResult { code: 0 | 1 | 2 | 3 | 4; document: unknown }
export type FoundCard = { ok: true; card: Card } | { ok: false; result: DebtResult };
export interface BriefFile { path: string; text: string | null }
export interface LastRun {
  runId: string; processor: string | null; status: string; reason: string | null; attempts: number;
  earlierFailures: number; acceptanceLog: string; answers: string[];
}
export interface BriefDocument {
  deck: string; card: string; intent: string; targets: BriefFile[]; slice: BriefFile[]; instruction: string;
  acceptance: string | null; maxTokens: number | null; model: string | null; dependsOn: string[];
  lastRun: LastRun | null; markdown?: string;
}
export interface BriefOptions { deck: string; id: string; md: boolean }
export const RUNS_DIR = ".morph/runs";
export function findCard(root: string, deckPath: string, id: string): FoundCard;
export function readLastRun(root: string, id: string): LastRun | null;
export function renderBrief(doc: BriefDocument): string;
export function cardBrief(root: string, args: BriefOptions): DebtResult;
```

- **findCard**, in order: `path.resolve(root, deckPath)` not a regular file → `{code 4, document {error {code 4, kind
  "UsageError", message "deck file not found: <deckPath as given>"}}}`; `loadDeck` faults → code 2 `DeckError` `invalid
  deck: ` + each `<key>: <message>`, `"; "`-joined; no card with that customId → code 4 `UsageError` `no card '<id>' in
  <deckPath> (have: <ids in deck order, ", "-joined>)`. (Read Deck File's two messages, so a deck reads the same in every
  command.)
- **cardBrief**: findCard's failure is the result. Else code 0 and the document, keys in the interface's order: `deck` as
  given; `card` the customId; `targets` in targets order and `slice` = the contextSlice sorted by code unit (the compiler's
  order), each `{path, text}` with text the UTF-8 file under root, null when not a regular file; `instruction`,
  `acceptance`, `maxTokens`, `model`, `dependsOn` as loaded; `lastRun = readLastRun(root, customId)`; `markdown =
  renderBrief(document)` only when md (no key otherwise).
- **readLastRun**: `readdirSync(root/.morph/runs)` (absent → null), names sorted descending by code unit; per name: its
  `report.json` regular, JSON.parse ok, an object with an `outcomes` array holding an object with `customId === id` —
  else skipped silently (a corrupt or foreign archive never fails the brief). The first match gives `{runId: the name,
  processor: the report's processor when a string else null, status (string, else ""), reason (string, else null), attempts
  (number, else 0), earlierFailures: the array's length (0 when not an array), acceptanceLog (string, else ""), answers}`;
  answers = the names under `<run>/answers/` (absent → []) matching `^<id, regex-escaped>(\.r[0-9]+)?\.v[0-9]+\.answer\.txt$`,
  sorted by code unit, each as `.morph/runs/<run>/answers/<name>`. None → null.
- **renderBrief** (pure): blocks joined by `"\n\n"`, then one final `"\n"`: (1) `# Debt brief: <card>`; (2) `` Write only:
  `<t1>`, `<t2>`. Change no other file.\nThen: `morph accept --deck <deck> --id <card> --model <your model> --commit`. ``;
  (3) six lines `- deck: <deck>`, `- intent: <intent>`, `- maxTokens: <n|none>`, `- model: <model|none>`, `- dependsOn:
  <ids ", "-joined|none>`, `- last run: <runId>, processor <p|none>, <status>, attempts <n>, reason <reason|none>` or `-
  last run: none`; (4) `## Instruction\n\n` + instruction.trimEnd(); (5) `## Acceptance\n\n` + `none` or
  `<acceptance>\n<text>⏎</acceptance>`; (6) only with a last run: `## Last run\n\n<acceptance_log>\n<log>⏎</acceptance_log>\n\nAnswers: `
  + each answer in backticks `", "`-joined, or `none`; (7) `## Targets now\n\n` + per target `<file path="<p>">\n<text>⏎</file>`
  or `Target <p> does not exist yet.`, `"\n\n"`-joined; (8) `## Context slice\n\n` + per slice entry the same file block or
  `File <p> is missing.`, `"\n\n"`-joined, or `none`. `⏎` = a `"\n"` appended when the text is not empty and does not end
  in one. The two fixtures are the byte-exact result (CB 2).

| Card Brief example | given | result |
|---|---|---|
| 1 | the §2.1 tree and archive; `{deck "d.json", id "fmt.x", md false}` | code 0; targets `[{src/x.ts, "export const x = 1;\n"}, {src/y.ts, null}]`; slice `[{docs/a.md, "# A\n"}, {docs/b.md, "B"}, {docs/gone.md, null}]`; instruction `"Fix x and write y.\n"`; acceptance `"grep -q fixed src/x.ts"`; maxTokens 9000; model null; dependsOn `["base"]`; lastRun `{20261102-100000, glm53, failed, "acceptance failed", 2, 1, "== probe\nAssertionError: expected 2 to be 1\n", [….r1.v1…, ….v1…]}`; no `markdown` key |
| 2 | the same; fmt.x and solo with md; base without | markdown = `brief.fmt.x.md` / `brief.solo.md`; base: lastRun `{20261103-110000, ds, written, null, 1, 0, "== tsc\n== probe\n", []}`, targets `[{src/base.ts, null}]`, slice `[]` |
| 3 | `nope.json`; `c.json` = `decks/cycle.json`; id `zz`; a root without `.morph` | 4 `deck file not found: nope.json`; 2 `invalid deck: dependsOn: dependsOn cycle a -> b -> a`; 4 `no card 'zz' in d.json (have: base, fmt.x, solo)`; lastRun null |

**`src/debt/acceptCard.ts`** (NEW; layer debt; imports no Node module):

```ts
export interface AcceptOptions { deck: string; id: string; model: string; commit: boolean }
export interface AcceptDeps { env: Record<string, string>; timeoutMs?: number }
export interface AcceptDocument {
  deck: string; card: string; model: string; exit: number | null; timedOut: boolean; green: boolean; log: string;
  outside: string[] | null; commit: string | null; diffstat: Diffstat | null; reason: string | null;
}
export function changedOutside(root: string, targets: string[], env: Record<string, string>): string[];
export async function acceptCard(root: string, args: AcceptOptions, deps: AcceptDeps): Promise<DebtResult>;
```

1. `findCard(root, args.deck, args.id)`; a failure is the result.
2. acceptance null or `trim() === ""` → `{code 2, document {error {code 2, kind "RefusalError", message "card <id> has no
   acceptance"}}}` (the runner refuses such a deck, Run Command step 3).
3. With commit only, BEFORE the acceptance: `outside = changedOutside(root, card.targets, deps.env)` = `gitOk(["status",
   "--porcelain", "--untracked-files=all"])` lines; per line the text after its first 3 characters; with `" -> "` the part
   after it; dropped when it starts with `.morph/` or equals a target; distinct, sorted by code unit. Outside a repository
   gitOk throws: the promise rejects (main: exit 3). Without commit: outside null, no git call at all.
4. `result = await runAcceptance(card.acceptance, root, {env: deps.env, timeoutMs: deps.timeoutMs ?? DEFAULT_TIMEOUT_MS})`.
   Nothing is written or restored: the tree stays as the payer left it, red or green.
5. reasons, in order: exit not 0 → `acceptance failed (exit <exit>)` (`null` for a timeout or a signal); outside not
   empty → `changed outside the targets: <outside ", "-joined>`. With commit and no reason: `commitPaths(root,
   card.targets, "morph <id>: <targets ", "-joined>", [["Morph-Card", id], ["Morph-Model", model],
   ["Morph-Acceptance-Exit", "0"], ["Morph-Debt", "true"]], deps.env, true)`; null → reason `nothing to commit: the targets
   equal HEAD`.
6. document `{deck, card, model, exit, timedOut, green: exit === 0, log, outside, commit (sha or null), diffstat (or
   null), reason (the reasons "; "-joined, or null)}`; code 0 when green and (no commit asked, or a commit made), else 1.

| Accept Card example | given | result |
|---|---|---|
| 1 | tmpRepo, "base" = d.json, src/a.ts "broken\n", README.md "r\n"; src/a.ts → "fixed\n", `.morph/runs/x/report.json` untracked; fix-a, `claude-fable-5-1`, commit; then again | 0, `{d.json, fix-a, claude-fable-5-1, 0, false, true, "", [], HEAD, {1, 1, 1}, null}`; message `morph fix-a: src/a.ts\n\nMorph-Card: fix-a\nMorph-Model: claude-fable-5-1\nMorph-Acceptance-Exit: 0\nMorph-Debt: true`; HEAD lists `src/a.ts` only; then 1, commit null, `nothing to commit: the targets equal HEAD` |
| 2 | the same base; src/a.ts "still broken\n" | 1, exit 1, log `FAIL: src/a.ts not fixed\n`, outside `[]`, reason `acceptance failed (exit 1)`; HEAD "base"; the file still "still broken\n" |
| 3 | src/a.ts "fixed again\n", README.md "r2\n", notes/n.txt; then src/a.ts "broken!\n" | 1, green, outside `["README.md", "notes/n.txt"]`, `changed outside the targets: README.md, notes/n.txt`; then `acceptance failed (exit 1); changed outside the targets: README.md, notes/n.txt`; HEAD "base" |
| 4 | tmpRoot (no git), fix-two, no commit, env MARK k7 + GH_TOKEN; then MARK k8; then slow, timeoutMs 300 | 0, outside null, commit null, reason null; 1 `acceptance failed (exit 1)`; 1, exit null, timedOut true, log `started\nacceptance timed out after 300 ms\n`, `acceptance failed (exit null)` |
| 5 | tmpRepo, "base" = d.json + `.gitignore` "out/\n"; src/b.ts, out/g.ts; fix-two, `acme/m:free`, commit, MARK k7; then none, blank, zz, `x.json`; then fix-a with commit on the tmpRoot of 4 | 0, diffstat `{2, 2, 0}`, message `morph fix-two: src/b.ts, out/g.ts\n\n…Morph-Model: acme/m:free…Morph-Debt: true`, HEAD lists `out/g.ts`, `src/b.ts`; 2 `card none has no acceptance`, `card blank has no acceptance`; 4 `no card 'zz' in d.json (have: fix-a, fix-two, slow, none, blank)`, `deck file not found: x.json`; rejects `git status failed (exit 128): …` |

**`src/cli/types.ts`, `src/cli/parse.ts`, `src/cli/main.ts`** (PATCH; one card owns the three, the P13b/P14b pattern:
the routing must land with the widened Command, or tsc breaks main.ts):

```ts
export interface CardArgs { name: "card"; root: string; pretty: boolean; deck: string; id: string; md: boolean }
export interface AcceptArgs {
  name: "accept"; root: string; pretty: boolean; deck: string; id: string; model: string; commit: boolean;
}
export type Command =
  | DeckCheckArgs | RunArgs | PlanArgs | SubmitArgs | CollectArgs | PrimerArgs | ScoutArgs | FromScoutArgs | ReviewArgs
  | CardArgs | AcceptArgs;
```

**Parse Command** — additions only, every other check, message, default and key unchanged: `--id` and `--model` are value
flags, `--md` and `--commit` take no value; `card` and `accept` are one-word commands (arity 1; an extra word is the
existing `unexpected argument: <first extra>`); allowed flags — card: `--root, --pretty, --deck, --id, --md`; accept:
`--root, --pretty, --deck, --id, --model, --commit` (any other: the existing `flag <f> does not apply to <command>`; and
`--id`, `--model`, `--md`, `--commit` apply to no other command); the no-command message `no command (commands: deck
check, plan, run, submit, collect, primer, scout, review, card, accept)`. Right after the flag check (before review's and
every later check), card and accept: no `--deck` → `missing --deck`; no `--id` → `missing --id`; an `--id` not matching
`^[A-Za-z0-9._-]+$` → `--id must match ^[A-Za-z0-9._-]+$ (got '<v>')`; card done `{name "card", root, pretty, deck, id,
md: --md given}`; accept: no `--model` → `missing --model`; a `--model` not matching `^[A-Za-z0-9._/:-]+$` → `--model must
match ^[A-Za-z0-9._/:-]+$ (got '<v>')`; else done `{name "accept", root, pretty, deck, id, model, commit: --commit
given}`, keys in the interfaces' order.

| Parse Command example | argv (`parseArgv.json`) | result (`parse.json`) |
|---|---|---|
| 8 (changed) | `[--root]`; `[]` | `flag --root needs a value`; `no command (commands: deck check, plan, run, submit, collect, primer, scout, review, card, accept)` |
| 20 | `[card, --deck, d.json, --id, fix-a]`; `[--pretty, card, --md, --root, /r, --deck, decks/p9/deck.json, --id, x_2]`; `[accept, --deck, d.json, --id, fix-a, --model, claude-fable-5-1]`; `[accept, --commit, --deck, d, --id, b.v, --model, acme/m:free, --root, /q]`; `[card, --id, a]`; `[card, --deck, d]`; `[accept, --deck, d, --id, a]`; `[card, --deck, d, --id, a b]`; `[accept, --deck, d, --id, a, --model, m x]`; `[card, --deck, d, --id, a, --commit]`; `[accept, --deck, d, --id, a, --model, m, --md]`; `[run, --deck, d, --processor, s, --id, a]`; `[card, x, --deck, d, --id, a]`; `[review, a, b, --model, m]`; `[accept]` | `{card, ".", false, d.json, fix-a, false}`; `{card, /r, true, decks/p9/deck.json, x_2, true}`; `{accept, ".", false, d.json, fix-a, claude-fable-5-1, false}`; `{accept, /q, false, d, b.v, acme/m:free, true}`; `missing --deck`; `missing --id`; `missing --model`; `--id must match ^[A-Za-z0-9._-]+$ (got 'a b')`; `--model must match ^[A-Za-z0-9._/:-]+$ (got 'm x')`; `flag --commit does not apply to card`; `flag --md does not apply to accept`; `flag --id does not apply to run`; `unexpected argument: x`; `flag --model does not apply to review`; `missing --deck` (before `--id`) |

**Main** — two branches before the run branch (which stays the last else): `command.name === "card"` → `result =
cardBrief(root, command)` (CardArgs passes as BriefOptions); `command.name === "accept"` → `result = await
acceptCard(root, command, deps)` (CliDeps passes as AcceptDeps: no timeoutMs, so the runner's 300 000 ms). The stderr line
is `morph card: exit <code>\n` / `morph accept: exit <code>\n`; a parse failure stays `morph: <message>\n`.

| Main example | given (`examples.json`) | result |
|---|---|---|
| 14 | tmpRoot t: d.json = debt/deck.json, src/x.ts, docs/a.md, docs/b.md, no .morph; deps {env {PATH}, now () => 0, cwd "/", transport null}; `[card, --deck, d.json, --id, fmt.x, --md, --root, t, --pretty]`; `[card, --deck, d.json, --id, zz, --root, t]`; `[card, --root, t, --deck, d.json]` | 0, one chunk beginning `{\n  "deck": "d.json",\n  "card": "fmt.x",\n`, lastRun null, markdown beginning `# Debt brief: fmt.x\n\nWrite only: `…; stderr `["morph card: exit 0\n"]`; 4, stdout exactly `{"error":{"code":4,"kind":"UsageError","message":"no card 'zz' in d.json (have: base, fmt.x, solo)"}}\n`, stderr `["morph card: exit 4\n"]`; 4 `missing --id`, stderr `["morph: missing --id\n"]` |
| 15 | tmpRepo t, "base" = d.json (debt/accept.deck.json) + src/a.ts "broken\n", then src/a.ts "fixed\n"; cwd t; `[accept, --deck, d.json, --id, fix-a, --model, claude-fable-5-1, --commit]` twice; `[accept, --deck, d.json, --id, fix-a, --model, m x]` | 0, the AC 1 document with commit = HEAD, the four trailers; stderr `["morph accept: exit 0\n"]`; 1, `nothing to commit: the targets equal HEAD`, stderr `["morph accept: exit 1\n"]`; 4, `--model must match …`, stderr `["morph: --model must match ^[A-Za-z0-9._/:-]+$ (got 'm x')\n"]` |

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P17 debt"; #8 = issue VasyaLutiy/morph#8):

- **Placement (#8, the cli rule)** · a NEW Component `debt` (`src/debt/`, guard layer debt: cards, acceptance, git) holds
  both commands, cli only parses and routes · `card` in cards would put node:fs and the run archive into the pure Deck
  layer (Deterministic Core names cards); `accept` in acceptance would make acceptance import git (layer rule: acceptance
  imports cards, wait, compiler); one Component of 13.6 KB keeps both under the 30 KB rule, the scout-session /
  review-session precedent.
- **One document out (#8 item 1, `--md`)** · `--md` adds a `markdown` key to the JSON document instead of printing raw
  markdown · Requirement One Document Out; the session writes the brief with `jq -r .markdown` (§8), as `review` carries
  its markdown.
- **The brief's run (#8 item 1)** · the last run is the newest archive (descending run-id order) whose report has an
  outcome for the card, any status; `completedAt` is not read · minted run ids are UTC timestamps; a later re-run that wrote
  the card is the archive's last word (measured: plan-spec-judge, §1); a corrupt report never fails the brief.
- **The brief's log (#8 item 1, "log tail")** · the outcome's `acceptanceLog` whole (already clipped by Run Acceptance to ≤
  ~4 000 chars, head and tail kept), the earlier failures counted, the answer files of that run listed by path, not
  inlined · the log is already a tail; answers can be large and the payer reads them when needed.
- **What the brief holds** · targets with their current text (null when absent) and the slice sorted as the compiler sends
  it, with null for a missing file · the payer sees exactly what glm saw (Compile Card) plus the patch originals.
- **Accept never rolls back (#8 item 2, "exactly as the runner does")** · the runner's snapshot exists to roll a failed
  variant back; `accept` judges the payer's tree as it is and leaves it, red or green; "as the runner" = the same
  runAcceptance call (shell, root, process group, 300 s timeout, stripped env, clipped log).
- **Outside the targets (#8 item 2)** · computed only with `--commit`, BEFORE the acceptance, from `git status --porcelain
  --untracked-files=all`, `.morph/` exempt (Open Run Branch's rule) · the tree the payer left, not the acceptance's own
  scratch; without `--commit` no git runs (accept works in any directory).
- **Exit codes** · 0 green (and committed when asked), 1 red / outside / nothing to commit, 2 RefusalError (no acceptance)
  or DeckError, 3 a git fault (thrown), 4 usage · Classify Error's table; "nothing to commit" is 1 because `--commit`
  promised a commit.
- **The debt commit** · Commit Card's subject and `force` (an ignored target is committed), trailers Morph-Card,
  Morph-Model, Morph-Acceptance-Exit 0, Morph-Debt true in that order, no Morph-Variant · Read Morph Log reads card and
  model from it; its run reads null, "a debt paid by an agent" (git's record).
- **--model's pattern** · `^[A-Za-z0-9._/:-]+$` (a slug like `acme/m:free` passes, a space does not) · it lands in a trailer
  line; `--id` keeps the run-id pattern.
- **`run --only` (#8 item 3, optional)** · out of this phase (§7) · Run Command's record is in cli (29 259 bytes), and a
  deck file holding only the failed cards already does it (AUTONOMY step 3); no P17b is queued for it.
- **Record size** · 13 cli examples moved to `examples.json` by key (cli 28 933 + the routing would pass 30 000).

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/debt/cardBrief.ts` | NEW | probe only | NEW `tests/debt/cardBrief.examples.test.ts` (CB 1–3) |
| `src/debt/acceptCard.ts` | NEW | probe only | NEW `tests/debt/acceptCard.examples.test.ts` (AC 1–5) |
| `src/cli/types.ts`, `parse.ts`, `main.ts` | PATCH | probe only | PATCH `tests/cli/parse.examples.test.ts` (PC 8 changed, 20 added); NEW `tests/cli/main.p17.examples.test.ts` (Main 14, 15) |

- `cardBrief.examples`: "Card Brief example 1: …" … "3: …"; the §2.1 tree per test, removed in finally; example 1
  compares the whole document with toStrictEqual; example 2 the markdown with `fixture("debt/brief.fmt.x.md")` and
  `fixture("debt/brief.solo.md")` by toBe; example 3 every refusal whole.
- `acceptCard.examples`: "Accept Card example 1: …" … "5: …"; the §2.1 tmpRepo/tmpRoot per test, removed in finally; the
  document whole with toStrictEqual (the sha read from `git rev-parse HEAD`), the HEAD message by toBe.
- `parse.examples` (patched): example 8's message gains `, card, accept`; "Parse Command example 20: card and accept, their
  flags and checks" added, its fifteen results literals compared whole with toStrictEqual; every other test and line
  unchanged.
- `main.p17.examples`: "Main example 14: …", "Main example 15: …", in process, an io that pushes stdout and stderr chunks.

### 2.4. What must not break

- Byte for byte: every file outside the 5 code targets and the 4 test files of §2.3 — `src/cards/*`, `src/acceptance/*`,
  `src/git/*`, `src/cli.ts` and the other `src/cli/*`, `tests/helpers.ts`; `contour.yaml`, `morph-map.json`, `docs/`,
  `decks/`, `tests/fixtures/` — untouched by every card.
- 748 tests in 114 files: 747 green at every card (`tests/cli/parse.examples.test.ts` excluded deck-wide, its example 8
  red from parse-command until parse-command-judge); after the run **748 + 1 + CB 3 + AC 5 + Main 2 = 759** in 117 files.

## 3. Acceptance

Built by `morph plan --checks decks/p17/checks.json`, narrow to broad, every stage printing `== <stage>`. `ownGit: true`
(the tests spawn git in their own tmpRepo; the stage proves this repository's HEAD and refs unchanged), `fullExclude`
`tests/cli/parse.examples.test.ts` (the ripple).

Code cards (no test file; code-only targets, `intent: generate` for the 2 new files): `probe/<card>/` → `tsc` (per-card
tsconfig excluding the generation's other targets) → `eslint <targets>` → `guard.mjs src <targets>` →
`decks/p17/parts/<card>.probe.ts` (card-brief CB 1–3 + 2 rows = 5; accept-card AC 1–5 + 2 rows = 7; parse-command PC 8,
20, Main 14, 15 = 4; **16 tests**) → eslint's verdict → full `vitest run` → own git → frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs tests <file> <min> <max> lits<n>.json` (+ the names
kept for the patched file) → `vitest run <targets>` → eslint's verdict → full run → own git → frozen → untracked.

| file | new | min | max | lits |
|---|---|---|---|---|
| `tests/debt/cardBrief.examples.test.ts` | yes | 3 | 9 | `Card Brief example 1` … `3`, `debt/brief.fmt.x.md`, `debt/brief.solo.md`, `debt/archive.json`, `20261102-100000`, `fmt.x.r1.v1.answer.txt`, `no card 'zz' in d.json (have: base, fmt.x, solo)` |
| `tests/debt/acceptCard.examples.test.ts` | yes | 5 | 11 | `Accept Card example 1` … `5`, `debt/accept.deck.json`, `Morph-Debt: true`, `nothing to commit: the targets equal HEAD`, `changed outside the targets: README.md, notes/n.txt`, `acceptance timed out after 300 ms`, `card blank has no acceptance`, `git status failed (exit 128): ` |
| `tests/cli/parse.examples.test.ts` | no | 26 | 28 | `Parse Command example 20`, `review, card, accept)`, `--model must match ^[A-Za-z0-9._/:-]+$ (got 'm x')`, `flag --md does not apply to accept`, `flag --model does not apply to review` |
| `tests/cli/main.p17.examples.test.ts` | yes | 2 | 8 | `Main example 14`, `Main example 15`, `morph card: exit 0`, `morph accept: exit 1`, `morph: missing --id` |

min = the record's examples (parse: the file's 25 tests + 1); max = min + 6 (parse + 2).

**Output budget** (`max_tokens`, before the session's ×3 for `ds`; a ~20 KB answer ≥ 28 000, the judge with the most
examples ≥ 20 000):

| card | returns | `max_tokens` |
|---|---|---|
| card-brief | cardBrief.ts ≈ 6.9 KB (reference) | 16 000 |
| accept-card | acceptCard.ts ≈ 3.3 KB | 12 000 |
| parse-command | types.ts + parse.ts + main.ts ≈ 22 KB, three whole files | 28 000 |
| card-brief-judge | ≈ 5 KB new file (the tree, the archive, one fixture compare) | 16 000 |
| accept-card-judge | ≈ 8 KB new file (3 tmpRepos, 2 tmpRoots, 5 examples) | 20 000 |
| parse-command-judge | the whole patched file ≈ 22 KB | 28 000 |
| main-judge | ≈ 4 KB new file | 16 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- **Layer debt** (guard, P17): may import cards, acceptance, git; of the Node modules only `node:fs` and `node:path`
  (NODE_ONLY), and acceptCard.ts imports none; NO_CLOCK (no `Date`), NO_ENV (the environment is `deps.env`); no `fetch`,
  no `process`, no `console`, no `node:child_process` (git through gitOk/commitPaths, the acceptance through runAcceptance).
- A file a card writes is in no sibling's slice in the same generation: generation 0 (card-brief) reads no P17 file;
  generation 1 (accept-card and card-brief-judge read cardBrief.ts); generation 2 (parse-command reads cardBrief.ts and
  acceptCard.ts; accept-card-judge reads acceptCard.ts and cardBrief.ts, no cli file); generation 3 (parse-command-judge,
  main-judge read the cli files, not each other's test).
- Tests write only under `tmpRoot()` / `tmpRepo()` and remove them in `finally`; no JS timer (the shell `sleep 5` under a
  300 ms runAcceptance timeout is the only wait); no network; a judge writes only its targets.

## 7. Out of scope

- `morph run --only <ids>` (issue #8 item 3, optional): a deck file of the failed cards does it today; no P17b.
- The regulation part of issue #8 (AUTONOMY "Paying a debt on a V2 deck", the `morph-fable-debt` brief from `card --md`,
  the cap of one Fable debt per phase): the main session after the merge, data only.
- Writing the answer file into the tree from the archive, re-running a card with a model (`accept` judges, it never
  generates), several cards in one call, a path with characters git quotes in `status --porcelain` (the debt targets of
  this repository are plain).
- `morph report`, `deck add|status|reset|clear` (still NotYetError).

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component debt --component cli \
  --judge --checks decks/p17/checks.json --out decks/p17/deck.json
python3 decks/p17/filter.py decks/p17/deck.json                  # keeps the 7 cards of the phase
python3 decks/tools/scale_tokens.py decks/p17/deck.json 3        # processor ds
node dist/cli.js deck check --root . --deck decks/p17/deck.json                                   # errors 0
rm -rf /tmp/v2bin-p17 && mkdir -p /tmp/v2bin-p17 && cp -r dist /tmp/v2bin-p17/ && ln -s $PWD/node_modules /tmp/v2bin-p17/node_modules
node /tmp/v2bin-p17/dist/cli.js run --root . --deck decks/p17/deck.json --processor ds --deadline 2400
```

No mrph cross-check (operator 08.10).

**Issue #8's smoke (the main session, after the run is merged; $0, no model call).** On a scratch copy, the merged binary
copied to `/tmp/v2bin-p17s/` (`dist/` + `node_modules` symlinked):

1. `S=/tmp/p17-smoke/S`: `git init -q -b main`, user name/email set in the repo; `decks/p7/smoke/deck.json` (the P7
   smoke deck: a `add`, b `mul`, c depends on both; shell acceptances with `node --experimental-strip-types`) copied as
   `S/deck.json`, committed (`git add -A; git commit -q -m base`). Answers outside S, `/tmp/p17-smoke/answers/`:
   `a.md` and `c.md` the right files in a fenced block, `b.md` a broken one (`export function mul(x: number, y: number):
   number { return x + y; }`: its acceptance prints `mul wrong`). The stub env, never a key: `MORPH_PROCESSOR_stub_TYPE=stub
   MORPH_PROCESSOR_stub_ANSWERS_DIR=/tmp/p17-smoke/answers` (Read Registry; Stub Answer reads `<dir>/<customId>.md`).
2. `node /tmp/v2bin-p17s/dist/cli.js run --root S --deck deck.json --processor stub` → exit 1; b `failed`, reason
   `acceptance failed`, c `skipped`; the archive commit on `morph/<runId>`, the checkout on it.
3. `card --root S --deck deck.json --id <broken> --md | jq -r .markdown > /tmp/p17-smoke/brief.md`: exit 0; the brief
   names the target, the acceptance, `last run: <runId>, processor stub, failed, attempts <n>`, the answer files.
4. Write the right target file by hand from the brief (the smoke plays the payer); then `accept --root S --deck deck.json
   --id <broken> --model claude-fable-5-1 --commit` → exit 0; `git -C S log -1 --format=%B` ends with the four lines
   `Morph-Card: <broken>`, `Morph-Model: claude-fable-5-1`, `Morph-Acceptance-Exit: 0`, `Morph-Debt: true`; `git -C S show
   --name-only --format= HEAD` lists only the target; `git -C S status --short` empty but `.morph/`.
5. The two refusals: write a second file outside the targets and change the target again → `accept … --commit` exit 1,
   reason `changed outside the targets: <file>`, HEAD unchanged; with a red target → exit 1, `acceptance failed (exit 1)`.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 7 (3 code, 4 judges) / 4: [card-brief] [accept-card, card-brief-judge] [parse-command, accept-card-judge] [main-judge, parse-command-judge] |
| executor bill | ≈ $0.10–0.25 on ds ×3 (P14b: 7 cards of the same shape, $0.2834); ≤ $0.40 with a re-cut; cap $5 |
| cards with regeneration | 1–3 of 7 (card-brief: the markdown bytes, the regex escape, the descending order; parse-command: three whole files; accept-card-judge: git setup per example, the sha in the document) |
| tests after the run | 759 ± 6 in 117 files |
| first red | card-brief: renderBrief's blank lines or the "\n" rule; accept-card: outside taken after the acceptance or not sorted; the judges: an unescaped single quote in `no card 'zz'` |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no answer cut at its `max_tokens`; (3) after the run no
file outside §2.3's nine changed; (4) acceptCard.ts imports no Node module and node:fs appears in the debt layer only in
cardBrief.ts; (5) this repository's HEAD and refs unchanged by every card (own git); (6) the smoke of §8 commits exactly
the target with the four trailers.

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the MEASURE row with
its `прогоны` cell, the vitest log of every verify run; DECISIONS lines "P17 debt"; the smoke's numbers (exit codes, the
commit's trailers and paths).

## 11. Actual

### Gate (preparation)

08.10, on the VPS, by the preparing orchestrator (Opus 5.5, fresh context, no sub-agents); no paid run, no model call.
One data commit (spec, record, map, guard, fixtures, checks, probes, filter, deck, DECISIONS). Component sizes: cli
28 933 → **29 259** (compacted first), debt new **13 587**. Issues: #8 only (`P17-debt`). **No split**: 7 cards.

The deck **cut by V2**: `plan --component debt --component cli --judge --checks decks/p17/checks.json` exit 0, 18 cards,
`decks/p17/filter.py` keeps 7; `scale_tokens.py … 3`; `deck check` **0 errors, 0 warnings**, no hazards; generations
`[card-brief] [accept-card, card-brief-judge] [accept-card-judge, parse-command] [main-judge, parse-command-judge]`.
Slices (deck check, slice + existing targets): 43.8–78.4 KB, the largest parse-command-judge **78 430 B**; parse-command
63 609 B + the two debt files written in the run (≈ 10 KB). No mrph cross-check (operator 08.10).

Scratch worktree from 7c440e1 + this phase's data (removed afterwards; no watcher or worker left; `/tmp/morph/*-p17`
removed), the deck's own acceptances, cards in deck order, each accepted reference committed before the next:
- **Stubs, red per example at the probe (16/16):** typed throwing stubs of cardBrief.ts (5/5: `Error: stub cardBrief
  [{"deck":"d.json","id":"fmt.x","md":false}]`, `stub readLastRun ["q"]`, `stub renderBrief ["w"]`) and acceptCard.ts
  (7/7: `stub acceptCard [{…"id":"fix-a"…,"commit":true},null]`, `stub changedOutside [["keep.ts"],["PATH"]]`); main's
  own cli files for parse-command (4/4: example 8 `…scout, review)` vs `…review, card, accept)`, example 20 `unknown flag:
  --id`, Main 14/15 `expected [ 4, [ 'morph: unknown flag: --id\n' ] ] to strictly equal [ +0, [ 'morph card: exit 0\n' ] ]`).
- **Judges before their file:** red at the guard (`… missing`, 3 of 3); the patched parse file at its old text red at the
  guard (`25 test/it calls, expected 26..28` and the 5 literals missing).
- **References green, chain seconds** (limit 250): card-brief 61.8, accept-card 62.1 (69.0 with the second probe row),
  card-brief-judge 61.1, accept-card-judge 80.3, parse-command 64.5, parse-command-judge 65.4, main-judge 64.6 — **max
  80.3 s**. Final tree: `tsc`, `eslint src tests` clean, `vitest run` **762 / 762 in 117 files** (748 + parse 1 + the
  reference judges' 5 + 6 + 2; the real judges write ≈ 11–25 → 759–773). Ripple 1 of 748 (parse.examples 8, excluded).
- **Mutants** (the new Functions and the changed parse/main contracts only), each under a 120 s subprocess timeout
  against its probe: **30 mutants, 34 runs, 1.3 min, max 6.5 s, 0 timeouts**. First pass 27 killed; 2 survivors closed by
  data (a probe row: an acceptance that writes `made.txt` must not count as outside — kills "outside taken after the
  acceptance"; `[accept]` added to Parse Command 20 — kills "missing --id before missing --deck"); **1 survivor,
  equivalent**: the answers' sort in readLastRun removed — Node's `readdirSync` already returns names sorted (libuv
  scandir), so no test can tell (DECISIONS, known risk).
- **Issue #8's smoke rehearsed** ($0, the reference binary, stub processor, §8 recipe): run exit 1 (a written, b failed
  `acceptance failed`, c skipped); `card --id b --md` exit 0 (`- last run: <run>, processor stub, failed, attempts 3,
  reason acceptance failed`, `Answers: …/b.v1.answer.txt`); with notes.txt left → `accept --commit` exit 1 `changed
  outside the targets: notes.txt`; red target → exit 1 `acceptance failed (exit 1)`; right target → exit 0, the commit
  `morph b: src/b.ts` with `Morph-Card: b`, `Morph-Model: claude-fable-5-1`, `Morph-Acceptance-Exit: 0`, `Morph-Debt:
  true`, paths `src/b.ts` only, status clean.

**Forecast** on `ds` with every maxTokens × 3: P14b ran 7 cards of the same shape (2 new debt-like files + the three-file
cli card + 4 judges) for $0.2834; here 10 first requests (3 code × 2 variants + 4 judges), 44–78 KB in, answers 3–22 KB:
**≈ $0.15–0.30**, ≤ $0.45 with a re-cut; ≤ $1. **Gate holds.**

**Run command** (from the repo root, the binary copied first; the deck is already scaled ×3):

```
npm run build && rm -rf /tmp/v2bin-p17 && mkdir -p /tmp/v2bin-p17 && cp -r dist /tmp/v2bin-p17/ && ln -s $PWD/node_modules /tmp/v2bin-p17/node_modules
node /tmp/v2bin-p17/dist/cli.js run --root . --deck decks/p17/deck.json --processor ds --deadline 2400 > /tmp/p17-run.json
```

After the merge: issue #8's smoke (§8) and the regulation part of #8 (AUTONOMY "Paying a debt on a V2 deck"), both the
main session's.

### Run

08.10, main session on the VPS. Binary copy `/tmp/v2bin-p17`, processor `ds`, run **20261008-120153**, exit 0, **1 139 s**:
7 / 7 written, 11 requests, 265 439 in / 110 780 out tokens, **$0.2032** (usageTotals.cost 0.20316738). card-brief v1
rejected at the probe, v2 accepted; accept-card v1 accepted (v2 untried); parse-command v1 accepted (v2 untried);
accept-card-judge v1 rejected at the guard (`tests/debt/acceptCard.examples.test.ts`), r1 accepted; card-brief-judge,
main-judge, parse-command-judge first attempt. No fix.

Verify on `morph/20261008-120153`: `git status --short` empty; `tsc --noEmit`, `eslint src tests` clean; `vitest run`
**759 / 759 in 117 files**; `npm run build` green. Own read against §2.2 and the record: `cardBrief` finds the card,
reads targets and slice from the current tree, the latest run's outcome, reason, log and answer files, and `--md` adds
`markdown`; `acceptCard` refuses a card without acceptance (2), takes the outside list before the acceptance with
`--commit`, runs it through `runAcceptance` (the env scrub of MORPH_PROCESSOR_/_KEY/_TOKEN holds), and commits only
the targets with the four trailers; cli only parses and routes. No defect found. Known limit (not pinned by the record):
`changedOutside` reads `git status --porcelain` without `-z`, so a path git quotes (spaces, non-ASCII) is compared
quoted.

**Issue #8's smoke** (§8, $0, stub): run 20261008-122242 exit 1 (a written, b failed `acceptance failed`, c skipped);
`card --id b --md` exit 0, `last run: 20261008-122242, processor stub, failed, attempts 3`; with `notes.txt` → `accept
--commit` exit 1 `changed outside the targets: notes.txt`, HEAD unchanged; red target → exit 1 `acceptance failed (exit
1)`, HEAD unchanged; right target → exit 0, the commit lists only `src/b.ts` and ends with `Morph-Card: b`,
`Morph-Model: claude-fable-5-1`, `Morph-Acceptance-Exit: 0`, `Morph-Debt: true`; status clean.
