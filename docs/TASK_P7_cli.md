# TASK_P7 — the `morph` binary (`src/cli/`, `src/cli.ts`)

> Phase P7 of `docs/PLAN.md` ("Фазы по записи (после P2)"), Component `cli` of `contour.yaml`
> (seven Functions: Parse Command, Emit Document, Classify Error, Read Deck File, Deck Check, Run
> Command, Main; five Data Objects: Command, Error Document, Command Result, Deck Check Document,
> Run Document). TypeScript under `src/cli/` plus the entry `src/cli.ts` (package.json `bin` is
> `dist/cli.js`, built from `src/cli.ts` by `tsc -p tsconfig.build.json`). The milestone is an
> **end-to-end run of the built binary on the stub processor inside vitest**, in a `tmpRepo()`, no
> network. Built by the old Morph (`mrph`) on glm; judge cards write the example tests.
>
> Reconciliation: P5 `runDeck` returns the Run Report and fires `deps.commit`; P6 gives
> `openRunBranch`, `makeCommitHook` (a `CommitHook`) and `archiveRun`; P4 gives `readRegistry`
> (the one reader of the environment), `realTransport` and the stub. P7 is the wiring: open the
> branch → runDeck with git's hook → archive, one JSON document out. The record's skeleton listed
> nine subcommands; only the two whose modules exist are built (`deck check`, `run`); the others
> answer a fixed `NotYetError` (decided, DECISIONS "P7 cli"). The "first own run on glm" of the
> PLAN row is not in this deck: it is the operator's smoke after the merge (AUTONOMY).

## 1. Why this

- **One document out is what every orchestrator session parses.** The 12 old-Morph runs of this
  repository (`decks/2026*.json`, `.morph/runs/*`) were driven by agents reading `mrph`'s stdout as
  JSON; a stray log line on stdout breaks the parse. Here stdout carries exactly one
  `JSON.stringify` + `"\n"` per invocation (Main examples 1, 4, 5 count the chunks / lines), the
  human log is one line on stderr.
- **The exit code is the gate's first signal.** AUTONOMY's gate and failure classes read exit codes
  before logs: 0 ok, 1 cards not written, 2 refused before spend, 3 a fault mid-command, 4 usage.
  Five classes, each pinned by an example (Classify Error 1–3, Deck Check 1, Run Command 3–5,
  Main 1, 3).
- **The environment is read once, by the registry.** P4–P6 made every layer take its env as a
  parameter (guard `NO_ENV`); a cli that reads `process.env` in a command would undo that. Only
  `src/cli.ts` touches `process`; `main(argv, deps, io)` gets env, cwd, clock and the two streams
  as parameters, so all 31 record examples except two run in process.
- **No refusal after spend.** A dirty tree, a hazard error, an unconfigured processor or a bad deck
  is found before the branch is opened and before any request (Run Command examples 3–5 assert no
  `morph/*` branch).

PLAN: ≈ 8 cards per phase at ≈ $0.1–0.2. This cut: 10 cards (5 code, 5 judge), 31 record
examples (Parse Command 8, Emit Document 3, Classify Error 3, Read Deck File 3, Deck Check 3, Run
Command 6, Main 5).

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **argv** — `string[]`, the process arguments after the script (`process.argv.slice(2)`), built
  inline (`["deck", "check", "--deck", "d.json"]`).
- **`CliDeps`** (`src/cli/types.ts`) — `{env: Record<string, string>, now: () => number, cwd:
  string, transport: Transport | null}`; `Transport` from `src/processor/types.ts` (P4). Tests pass
  `transport: null` (the stub processor never calls it) and `now: () => 1791310149000` (=
  2026-10-06T18:09:09.000Z).
- **`CliIo`** — `{stdout(text: string): void; stderr(text: string): void}`; a test records the
  chunks in two `string[]` (`const out: string[] = []; const io: CliIo = {stdout: (t) => {
  out.push(t); }, stderr: ...}`).
- **The env of a run test**, built inline, exactly:
  `{PATH: process.env.PATH ?? "", HOME: r.root, GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "Ada",
  GIT_AUTHOR_EMAIL: "ada@example.invalid", GIT_COMMITTER_NAME: "Ada", GIT_COMMITTER_EMAIL:
  "ada@example.invalid", MORPH_PROCESSOR_s_TYPE: "stub", MORPH_PROCESSOR_s_ANSWERS_DIR: <side>/answers}`
  (this host has no global git identity; the stub needs only TYPE and ANSWERS_DIR, its model is
  `"stub"`, so the card commits carry `Morph-Model: stub`).
- **The side root** — a second `tmpRoot()` (not the repo) holding the stub answers and the deck
  file, so the repo's tree stays clean for `openRunBranch`: `side.write("answers/a.md",
  "```ts\nexport const a = 1;\n```\n")` (one fenced block = the whole answer for a one-target card;
  the stub reads `<customId>.v1.md`, else `<customId>.md`) and `side.write("deck.json",
  JSON.stringify([...]))`, passed as the **absolute** path `side.path("deck.json")`.
- **A deck file** — a JSON array of card objects (the Deck File form of P1, `loadDeck`); only
  `customId`, `intent`, `targets`, `instruction` are required, e.g. `{customId: "a", intent:
  "generate", targets: ["out/a.ts"], instruction: "x", acceptance: "test -f out/a.ts"}`, plus
  `dependsOn: ["a"]` for b. Acceptance commands run in the repo root with the env above.
- **Deck fixtures** (existing, `tests/fixtures/decks/`, each a JSON array read as text with
  `fixture("decks/<name>.json")` and written into a `tmpRoot()` as `d.json`; none is a whole
  example input by itself — the example's root is the tmp root):
  - `tiny.json` — one card `a → src/a.ts`, no slice. `readDeckFile` → `{ok: true, deck: {cards:
    [{customId: "a", intent: "generate", targets: ["src/a.ts"], contextSlice: [], instruction: "x",
    acceptance: null, model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn: []}],
    externalDependsOn: []}}`. Deck Check with `src/a.ts` = `"export const a = 1;\n"` (20 bytes):
    one hazard (implicit-read a), weight 20.
  - `hazardsWriteWrite.json` — cards a (slice `docs/a.md`) and b (slice `docs/b.md`), both
    targeting `src/x.ts`; with no other file in the root: one error hazard (write-write a,b
    src/x.ts), weights 0 with missing `[docs/a.md, src/x.ts]` and `[docs/b.md, src/x.ts]`.
  - `cycle.json` — one fault `{key: "dependsOn", message: "dependsOn cycle a -> b -> a"}`;
    `duplicate.json` — one fault `{key: "cards[2].customId", message: "duplicate customId b"}`.
- **A `RunReport`, `CardOutcome`** (`src/runloop/types.ts`) and an **`ArchiveResult`**
  (`src/git/types.ts`) for runExitCode — typed consts with every field set.
- **`RunArgs`** for runCommand — a typed const with every field (`{name: "run", root: ".", pretty:
  false, deck, processor: "s", runId: "r1", deadlineSeconds: 2400, maxCards: null,
  maxRetryBatches: 0}`); `maxRetryBatches: 0` keeps a failing card to one request.
- **The built binary** (Main examples 4–5, in a `beforeAll` with a 120 000 ms timeout):
  `const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")`; `out =
  tmpRoot("morph-bin-")`; `execFileSync(process.execPath, [path.join(REPO,
  "node_modules/typescript/bin/tsc"), "-p", path.join(REPO, "tsconfig.build.json"), "--outDir",
  out.root], {cwd: REPO, stdio: "pipe"})`; then `out.write("package.json", '{"type":"module"}\n')`
  (the out dir lies outside the repo, so Node needs it to read the `.js` files as ESM). Run it with
  `spawnSync(process.execPath, [path.join(out.root, "cli.js"), ...args], {cwd, env, encoding:
  "utf8"})`; `out.rm()` in `afterAll`. Nothing is written to `dist/` by a test.

### 2.2. OUTPUT data shapes

`src/cli/types.ts` exports exactly these names (types only, no values), imports with `import type`
and re-exports nothing imported:

```ts
import type { Deck, Hazard, SliceWeight } from "../cards/types.js";
import type { Transport } from "../processor/types.js";
import type { RunReport } from "../runloop/types.js";
import type { ArchiveResult } from "../git/types.js";

export type ExitCode = 0 | 1 | 2 | 3 | 4;
export type ErrorKind = "UsageError" | "NotYetError" | "DeckError" | "RefusalError" | "RuntimeError";
export interface ErrorDocument { error: { code: ExitCode; kind: ErrorKind; message: string } }
export interface CommandResult { code: ExitCode; document: unknown }
export interface DeckCheckArgs { name: "deck check"; root: string; pretty: boolean; deck: string; sliceCapBytes: number }
export interface RunArgs {
  name: "run"; root: string; pretty: boolean; deck: string; processor: string; runId: string | null;
  deadlineSeconds: number; maxCards: number | null; maxRetryBatches: number;
}
export type Command = DeckCheckArgs | RunArgs;
export type ParseResult = { ok: true; command: Command } | { ok: false; error: ErrorDocument };
export type DeckFileResult = { ok: true; deck: Deck } | { ok: false; result: CommandResult };
export interface DeckCheckDocument {
  deck: string; cards: number; generations: string[][]; errors: number; warnings: number;
  hazards: Hazard[]; weights: SliceWeight[];
}
export interface RunDocument { runId: string; branch: string; base: string; report: RunReport; archive: ArchiveResult }
export interface CliDeps { env: Record<string, string>; now: () => number; cwd: string; transport: Transport | null }
export interface CliIo { stdout(text: string): void; stderr(text: string): void }
```

Every object is built with its keys in the type's order. Exit codes: **0** ok; **1** a run with any
outcome not `written`; **2** `DeckError` / `RefusalError` (before any spend); **3** `RuntimeError` (a
thrown fault, or the archive not ok); **4** `UsageError` / `NotYetError`.

**`src/cli/document.ts`** — Emit Document, Classify Error, Read Deck File (imports `node:fs`,
`node:path`, `loadDeck` from `../cards/model.js`, types from `./types.js`, `../runloop/types.js`,
`../git/types.js`):

- `renderDocument(doc: unknown, pretty: boolean): string` = `JSON.stringify(doc, null, pretty ? 2 :
  undefined) + "\n"`.
- `errorDocument(code: ExitCode, kind: ErrorKind, message: string): ErrorDocument` = `{error: {code,
  kind, message}}`.
- `classifyThrown(e: unknown): CommandResult` = `{code: 3, document: errorDocument(3, "RuntimeError",
  e instanceof Error ? e.message : String(e))}`.
- `runExitCode(report: RunReport, archive: ArchiveResult): ExitCode`: `!archive.ok` → 3; else any
  `report.outcomes[i].status !== "written"` → 1 (failed, skipped, budget-exceeded); else 0 (an empty
  outcomes list is 0).
- `readDeckFile(root: string, deckPath: string): DeckFileResult`: `abs = path.resolve(root,
  deckPath)`; `fs.statSync(abs).isFile()` false or throwing → `{ok: false, result: {code: 4, document:
  errorDocument(4, "UsageError", "deck file not found: " + deckPath)}}` (the path **as given**; a
  directory is "not found"); else `loadDeck(fs.readFileSync(abs, "utf8"))`; faults → `{ok: false,
  result: {code: 2, document: errorDocument(2, "DeckError", "invalid deck: " + faults.map((f) =>
  f.key + ": " + f.message).join("; "))}}` (e.g. a `{` file reads `invalid deck: deck: deck is not
  valid JSON: …`, Node's text after the prefix); else `{ok: true, deck}`.

**`parseCommand(argv: string[]): ParseResult`** (`src/cli/parse.ts`; imports `errorDocument` from
`./document.js`). Every failure is `{ok: false, error: errorDocument(4, kind, message)}`, kind
`"UsageError"` unless stated. The checks, first failure wins:

1. **Scan** argv left to right. A token starting with `"--"` is a flag. Already seen → `flag <t>
   given twice` (also `--pretty`). `--pretty` takes no value. `--root`, `--deck`, `--processor`,
   `--run-id`, `--deadline`, `--max-cards`, `--max-retry-batches`, `--slice-cap-bytes` take the next
   token **whatever it is** (`--deck -x` → deck `"-x"`; `--deck --pretty` → deck `"--pretty"`); as the
   last token → `flag <t> needs a value`. Any other flag, `--root=x` and `--help` included →
   `unknown flag: <t>`. Every other token is a word. So `["frobnicate", "--x"]` → `unknown flag: --x`.
2. **Command** from the words: none → `no command (commands: deck check, run)`. `words[0] ===
   "run"` → run (takes 1 word); `"deck"` + `"check"` → deck check (2 words). `words[0]` in `plan`,
   `scout`, `primer`, `review`, `report` → `NotYetError` `command <word> is not available yet`;
   `"deck"` + one of `add`, `status`, `reset`, `clear` → `NotYetError` `command deck <w> is not
   available yet`; anything else → `unknown command: <words.join(" ")>` (`["deck"]` → `unknown
   command: deck`; `["deck", "frob", "x"]` → `unknown command: deck frob x`).
3. More words than the command takes → `unexpected argument: <the first extra word>`.
4. A flag the command does not take, in the order the flags appeared → `flag <f> does not apply to
   <name>` (`name` = `deck check` | `run`). deck check takes `--root --pretty --deck
   --slice-cap-bytes`; run takes `--root --pretty --deck --processor --run-id --deadline --max-cards
   --max-retry-batches`.
5. No `--deck` → `missing --deck`. 6. run without `--processor` → `missing --processor`.
7. deck check: `--slice-cap-bytes` (if given) must match `/^[0-9]+$/` and be ≥ 1, else
   `--slice-cap-bytes must be a positive integer (got '<v>')`.
   run: `--run-id` (if given) must match `/^[A-Za-z0-9._-]+$/`, else `--run-id must match
   ^[A-Za-z0-9._-]+$ (got '<v>')`; then `--deadline`, `--max-cards` (≥ 1, `must be a positive
   integer`) and `--max-retry-batches` (≥ 0, `must be a non-negative integer`), in this fixed order:
   `--deadline must be a positive integer (got '1.5')`, `--max-retry-batches must be a non-negative
   integer (got '-1')`.
8. Success: `{ok: true, command}` with the keys in the type's order; defaults `root "."`, `pretty
   false`, `sliceCapBytes 500000`, `runId null`, `deadlineSeconds 2400`, `maxCards null`,
   `maxRetryBatches 2`.

**`deckCheckCommand(root: string, deckPath: string, sliceCapBytes: number): CommandResult`**
(`src/cli/deckCheck.ts`; imports `readDeckFile` from `./document.js`, `findHazards`, `layerGenerations`,
`weighSlices` from `../cards/{hazards,layer,weigh}.js`). `readDeckFile` failure → its `result`
unchanged. Else `weighing = weighSlices(deck, root, sliceCapBytes)`; `hazards = [...findHazards(deck),
...weighing.hazards]` (the oversized-slice warnings last); `document: DeckCheckDocument = {deck:
deckPath, cards: deck.cards.length, generations: layerGenerations(deck), errors, warnings, hazards,
weights: weighing.weights}` (errors/warnings = hazards with severity `"error"` / `"warning"`);
`code` 2 when `errors > 0`, else 0 (warnings never change the code).

**`runCommand(root: string, args: RunArgs, deps: CliDeps): Promise<CommandResult>`** and
**`mintRunId(ms: number): string`** (`src/cli/runCommand.ts`; imports `readRegistry` and `PREFIX`
from `../processor/registry.js`, `realTransport` from `../processor/send.js`, `findHazards`,
`runDeck` from `../runloop/deck.js`, `openRunBranch`, `makeCommitHook`, `archiveRun` from
`../git/{branch,commit,archive}.js`, `errorDocument`, `readDeckFile`, `runExitCode` from
`./document.js`). In this order, every refusal before any git call:

1. `readRegistry(deps.env)` (never the process environment); no config with `id ===
   args.processor` → `{code: 4, document: errorDocument(4, "UsageError", "processor " + id + " is
   not configured" + suffix)}`, suffix = `": " + messages.join("; ")` of the registry faults whose
   `key` starts with `PREFIX + id + "_"` (`"MORPH_PROCESSOR_bad_"`), or `""` when there are none.
2. `readDeckFile(root, args.deck)` failure → its result.
3. `findHazards(deck)` with severity `"error"` → `{code: 2, … "RefusalError", "deck has " + n + "
   hazard error(s): " + list}`, each item `kind + " " + cards.join(",") + (path === null ? "" : " " +
   path)`, items joined by `"; "`.
4. `start = deps.now()` — the **only** call of `deps.now` by runCommand itself (runDeck calls it
   once per generation boundary and once at the end). `runId = args.runId ?? mintRunId(start)`;
   `mintRunId(ms)` = the UTC `new Date(ms).toISOString()` as `YYYYMMDD-HHMMSS`
   (`1791310149000` → `"20261006-180909"`).
5. `branch = openRunBranch(root, runId, deps.env)`; `!branch.ok` → `{code: 2, … "RefusalError",
   branch.error}` (`dirty tree outside .morph/: notes.txt`, `branch morph/r1 already exists`,
   `invalid runId: …`).
6. `result = await runDeck({root, runId, branch: branch.branch, deck, budget: {maxCards:
   args.maxCards ?? deck.cards.length, maxRetryBatches: args.maxRetryBatches, deadline: start +
   args.deadlineSeconds * 1000}}, {config, transport: deps.transport ?? realTransport(config.timeoutMs),
   commit: makeCommitHook(root, config.model, deps.env), now: deps.now, env: deps.env})`.
7. `archive = archiveRun(root, {runId, deck, report: result.report}, deps.env)`.
8. → `{code: runExitCode(result.report, archive), document: RunDocument {runId, branch:
   branch.branch, base: branch.base, report: result.report, archive}}`.

Nothing is caught: a thrown Error (gitOk outside a repository: `git status failed (exit 128):
fatal: not a git repository…`) propagates to main. The checkout stays on `morph/<runId>`; the deck
is not committed separately (the archive's `deck.json` is the deck as run).

**`main(argv: string[], deps: CliDeps, io: CliIo): Promise<ExitCode>`** (`src/cli/main.ts`;
imports `node:path`, `parseCommand`, `renderDocument`, `classifyThrown`, `deckCheckCommand`,
`runCommand`):

1. `parsed = parseCommand(argv)`; `!parsed.ok` → `io.stdout(renderDocument(parsed.error,
   argv.includes("--pretty")))`, `io.stderr("morph: " + message + "\n")`, return its code (4).
2. `root = path.resolve(deps.cwd, command.root)`.
3. `try` { deck check → `deckCheckCommand(root, command.deck, command.sliceCapBytes)`; run → `await
   runCommand(root, command, deps)` } `catch (e)` → `classifyThrown(e)`.
4. Exactly one `io.stdout(renderDocument(result.document, command.pretty))`, one
   `io.stderr("morph " + command.name + ": exit " + result.code + "\n")` (`morph deck check: exit
   2`, `morph run: exit 0`); return `result.code`.

**`src/cli.ts`** — the entry, first line `#!/usr/bin/env node`; imports `main` from
`./cli/main.js`; `env` = every `process.env` entry whose value is not `undefined`; calls
`main(process.argv.slice(2), {env, now: () => Date.now(), cwd: process.cwd(), transport: null},
{stdout: (t) => { process.stdout.write(t); }, stderr: (t) => { process.stderr.write(t); }})` and
sets `process.exitCode` to the resolved code. It never calls `process.exit` (it cuts a piped
stdout) and holds no other logic.

### 2.3. Names

| module | exports | card writes no test | judge's test |
|---|---|---|---|
| `src/cli/types.ts` | the types of §2.2, no values | — | — |
| `src/cli/document.ts` | `renderDocument`, `errorDocument`, `classifyThrown`, `runExitCode`, `readDeckFile` | probe | `tests/cli/document.examples.test.ts` |
| `src/cli/parse.ts` | `parseCommand` | probe | `tests/cli/parse.examples.test.ts` |
| `src/cli/deckCheck.ts` | `deckCheckCommand` | probe | `tests/cli/deckCheck.examples.test.ts` |
| `src/cli/runCommand.ts` | `runCommand`, `mintRunId` | probe | `tests/cli/runCommand.examples.test.ts` |
| `src/cli/main.ts`, `src/cli.ts` | `main`; the entry exports nothing | probe | `tests/cli/main.examples.test.ts` |

A code card covered by a probe writes **no test file**. A judge imports the module it tests from
`../../src/cli/<m>.js`, types from `../../src/cli/types.js` (and `../../src/runloop/types.js`,
`../../src/git/types.js` when it builds a report or an archive result), and `tmpRoot`, `tmpRepo`,
`fixture` from `../helpers.js` (types `TmpRoot`, `TmpRepo` with `import type`). Its file holds one
`test(...)` per example of its Function(s), in record order (document: Emit Document 1–3, Classify
Error 1–3, Read Deck File 1–3), named `<Function> example <n>: <what>`, then at most the number of
its own tests in §3 (document 8, parse 8, deckCheck 6, runCommand 4, main 3).

Compare results whole with `toStrictEqual`; strings and numbers with `toBe`. **Typing traps**
(tsc strict, TS2339/TS18046/TS18047):
- `CommandResult.document` is `unknown`: never `got.document.runId`. Assert the whole result with
  `toStrictEqual`, or cast once: `const doc = got.document as RunDocument;` (`as DeckCheckDocument`,
  `as ErrorDocument`); a parsed stdout likewise `JSON.parse(s) as {…}`.
- The unions `ParseResult`, `DeckFileResult` and `ArchiveResult` are narrowed before a field is
  read: `got.ok ? got.command.name : got.error.error.message`; never through `??`.
- `RunArgs` and `CliDeps` are built as typed consts with **every** field; a `Partial` override is
  spread over a full default (`{...base, runId: null}`).
- A recorded `io` keeps its arrays in variables the test owns (`const out: string[] = []`).

Run tests: every repo is a `tmpRepo()`, the deck and the answers in a side `tmpRoot()`, both removed
in `finally`; never pass the working directory or any path outside them to `runCommand`/`main`
(the acceptance fails if this repository's HEAD or refs change). A sha is matched against
`r.git(["rev-parse", "HEAD"])`, never as a literal. Git's own text is matched by prefix.

### 2.4. What must not break

- P0–P6 untouched byte for byte: the scaffold (package.json keeps `bin` `dist/cli.js`), `src/cards`,
  `src/compiler`, `src/acceptance`, `src/processor`, `src/runloop`, `src/git`, `src/index.ts` and
  their tests.
- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/` — untouched by every card.
- **This repository's own `.git`** (every acceptance compares HEAD and every ref before and after).
- `dist/` is never written by a test (the e2e builds into a tmp root); `tsc --noEmit`, `eslint src
  tests`, `vitest run` green after every generation; the 295 tests of P0–P6 stay green.

## 3. Acceptance

Built by `decks/tools/build.py p7` into the `acceptance` of every P7 card in `morph-map.json`;
`mrph plan --spec` copies it onto the card. Narrow to broad; the first red is the regeneration's
diagnosis.

Code cards (targets under `src/cli/`, `main` also `src/cli.ts`; `document` also writes `types.ts`):

1. `probe/<card>/`: the guard, a vitest config, `tsconfig.card.json` extending `../../tsconfig.json`
   and **excluding the targets of the other cards of the same generation**; removed on exit. The
   repository's HEAD, symbolic HEAD and every ref are recorded (`G0`).
2. `tsc --noEmit -p probe/<card>/tsconfig.card.json` (project + probe).
3. `eslint <the card's targets>`.
4. `guard.mjs src <targets>`: layer `cli` may import every layer; no package import, no `any`, no
   `node:child_process`, no `fetch`; **`process` and `console` only in `src/cli.ts`**, no
   `process.exit` there, no `Date.now` in `src/cli/` (the clock is `deps.now`).
5. `decks/p7/parts/<card>.probe.ts` under vitest: one `test` per record example of the card's
   Function(s), values **and** types, then the §2.2 rows. document 9 + 3 = 12; parse-command 8 + 6 =
   14; deck-check 3 + 3 = 6; run-command 6 + 4 = 10; main 5 + 3 = 8. 50 tests.
6. `main` only: `npm run build` (writes `dist/`, ignored), then `node dist/cli.js frobnicate` must
   exit 4 with exactly the UsageError line on stdout (`bin:` failure line otherwise).
7. `vitest run` — everything in the tree. 8. Own git: HEAD, symbolic HEAD and refs equal `G0`, else
   `tests changed this repository's HEAD or refs:`. 9. Frozen: `git diff --quiet HEAD -- contour.yaml
   morph-map.json docs decks tests/fixtures`; no untracked file other than the targets.

Judge cards (`tests/cli/<m>.examples.test.ts`):

1–3. `probe/<card>/` (no probe file) and `G0`; the same `tsc`; `eslint <target>`.
4. `guard.mjs tests <target> <min> <max> lits.json` — `min` = the examples (document 9, parse 8,
   deckCheck 3, runCommand 6, main 5), `max` = `min` + the own cap (8, 8, 6, 4, 3: the heavy run and
   e2e files stay small); `lits.json`: document `{"a":1,"b":[true,null]}`, `RuntimeError`, `deck file
   not found: nope.json`, `invalid deck: dependsOn: dependsOn cycle a -> b -> a`; parse `unknown
   command: frobnicate`, `command deck status is not available yet`, `flag --processor does not apply
   to deck check`, `no command (commands: deck check, run)`; deckCheck `write-write`,
   `oversized-slice`, `docs/b.md`; runCommand `morph run r1: deck and report`, `processor nope is not
   configured`, `dirty tree outside .morph/: notes.txt`, `deck has 1 hazard error(s): write-write
   a,b out/x.ts`, `20261006-180909`; main `morph: unknown command: frobnicate`, `tsconfig.build.json`,
   `{"type":"module"}`, `morph run e2e: deck and report`, `git status failed (exit 128): `.
5. `vitest run <target>`; 6. `vitest run`; 7. own git; 8. frozen and untracked as above.

Dense output: `--reporter=dot`, failures filtered to `^ FAIL |Error|expected|received`, 80 lines.
Timeout of the whole chain 300 s; measured on a dry tree with stubs (§9).

**Output budget per card** (`max_tokens` in `morph-map.json`). Estimate = the target file(s) in
tokens (≈ bytes / 3.5) × 2 headroom + 2 500 reasoning; the reference sizes are a scratch reference
implementation and the probes (the judge files have the probe's shape):

| card | expected target | estimate | `max_tokens` |
|---|---|---|---|
| document | types.ts ≈ 1.6 KB + document.ts ≈ 1.6 KB ≈ 950 tok | ≈ 4 400 | 12 000 |
| parse-command | parse.ts ≈ 4.0 KB ≈ 1 150 tok | ≈ 4 800 | 12 000 |
| deck-check | deckCheck.ts ≈ 1.0 KB ≈ 300 tok | ≈ 3 100 | 12 000 |
| run-command | runCommand.ts ≈ 2.7 KB ≈ 800 tok | ≈ 4 100 | 12 000 |
| main | main.ts ≈ 1.1 KB + cli.ts ≈ 0.5 KB ≈ 450 tok | ≈ 3 400 | 12 000 |
| document-judge | ≈ 7.4 KB (12 tests) ≈ 2 100 tok; worst 17 tests ≈ 11 KB | ≈ 8 800 | 24 000 |
| parse-command-judge | ≈ 7.4 KB ≈ 2 100 tok; worst 16 tests ≈ 10 KB | ≈ 8 200 | 24 000 |
| deck-check-judge | ≈ 4 KB ≈ 1 150 tok; worst 9 tests ≈ 7 KB | ≈ 6 500 | 24 000 |
| run-command-judge | ≈ 10.4 KB (10 tests) ≈ 3 000 tok; worst 10 tests ≈ 12 KB | ≈ 9 400 | 28 000 |
| main-judge | ≈ 7.6 KB (8 tests) ≈ 2 200 tok; worst 8 tests ≈ 10 KB | ≈ 8 200 | 28 000 |

Every judge ≥ 20 000 and ≥ 2× its worst case; no single answer is expected above ≈ 3 500 tokens,
under the ≈ 12 000 output tokens P5 showed a first answer can balloon to.

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- **Layer** `cli` (`decks/tools/guard.mjs`, P7 change): `src/cli.ts` is layer `cli` (it was not under
  a layer directory); `process` and `console` only in `src/cli.ts`; `process.exit` nowhere; `Date.now`
  not in `src/cli/`. cli spawns nothing and never calls `fetch` itself (`realTransport` is the
  processor's).
- The environment reaches the processor only through `readRegistry(deps.env)`; git and the
  acceptance get the same `deps.env`. No command reads `process.env`, `process.cwd()` or the clock.
- `types.ts` imports types only; `parse.ts`, `deckCheck.ts`, `runCommand.ts` import `./document.js`;
  `main.ts` imports the four modules; `document.ts` writes nothing.
- Tests write only under `tmpRoot()`/`tmpRepo()` under the OS tmpdir and remove them in `finally`
  (`afterAll` for the binary's out dir); no fixture is written; no test touches this repository's
  `.git` or `dist/`.
- A judge writes only its test file and never touches the module it tests.
- A file a card writes is in no sibling's slice in the same generation; a judge depends on its code
  card; parse-command, deck-check and run-command depend on document; main depends on those three.
- Exact strings of §2.2 (every UsageError/NotYetError text of Parse Command, `deck file not found: `,
  `invalid deck: `, `processor <id> is not configured`, `deck has <n> hazard error(s): `, `morph: `,
  `morph <name>: exit <code>`): the executor copies them.

## 7. Out of scope

- `plan` (P10 planner), `scout` (P13), `primer` (P12), `review` (P14), `report`, `deck
  add|status|reset|clear` (no V2 deck store yet; the planner P10 decides where a cut deck lives):
  each answers the fixed NotYetError, exit 4.
- The batch route and `collect --wait` (P11): a `route batch` config already answers per request in
  `sendGeneration`; the cli adds nothing.
- The first own run on glm (AUTONOMY: the operator's smoke after the merge); `--processor glm53`
  works through the same registry and is not exercised by any test (no network in tests).
- Committing the deck-as-submitted (`decks/<runId>.json` of the old Morph), merging, pushing, deleting
  branches; checking out back to the base after a run.
- `--help`, `--version`, `--flag=value` syntax, short flags, reading a deck from stdin.
- Signals, a run lock, resuming a run.

## 8. How to run

```
python3 decks/tools/build.py p7
cd /home/morph/MorphProject/morph-lab
venv/bin/mrph plan --root <repo> --spec <repo>/contour.yaml --map <repo>/morph-map.json --component cli --judge   # dry
venv/bin/mrph deck clear --root <repo> && venv/bin/mrph deck reset --root <repo>
venv/bin/mrph plan --root <repo> --spec <repo>/contour.yaml --map <repo>/morph-map.json --component cli --judge --add
venv/bin/mrph deck check --root <repo>
venv/bin/mrph run --root <repo> --processor glm53 --deadline 2400   # by the gate of docs/AUTONOMY.md
```

`mrph` reads `.env` from the current directory: run it from `morph-lab`, never from the repo.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards in the deck | 10 (5 code, 5 judge) |
| generations | 4 (document; parse-command + deck-check + run-command + document-judge; main + three judges; main-judge) |
| executor bill | ≈ $0.16 nominal (≈ 300k in, 75k out at $0.31/M in, $1.13/M out: 15 first requests × ≈ 15k in + ≈ 5 retries), ≤ $0.35 with a re-cut |
| cards with regeneration | 3 of 10 |
| `write-write` / `read-write` at `deck check` | 0 / 0 |
| tests after the run | 295 + 5 judge files; ≥ 31 judge example tests |
| chain on a dry tree with stubs | code cards red at the probe per example (readable `Error: stub <fn>`), judges red at eslint (`No files matching the pattern`); with the scratch reference every probe green and single-rule mutations redden it |
| first red | parse-command: the check order (flags that do not apply before missing --deck) or a message text; run-command: the registry fault suffix or the refusal order; main: the `--pretty` of a parse error or the stderr line; judges: `document` (unknown) read without a cast |

**Falsifiable claims:** (1) no card goes red on a sibling's file; (2) no judge red traces to §2.1;
(3) no test changes this repository's HEAD or refs; (4) no judge is cut off at its `max_tokens`;
(5) no test writes `dist/`.

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), judge tests written,
truncations (finish reason `length`) per card, defects the judge found the probe did not (and the
reverse), the row of `docs/MEASURE.md`.

## 11. Actual

(after the run)
