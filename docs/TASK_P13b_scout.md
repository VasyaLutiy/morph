# TASK_P13b — the scout session: round loop, `morph scout`, scout.json, `plan --from-scout` (`src/scout/{runScout,scoutCommand,planFromScout}.ts`, `src/cli/{types,parse,main}.ts`)

> Phase P13b of `docs/PLAN.md` ("Фазы по записи (после P2)": `P13b | scout | цикл раундов, запись scout/<id>/scout.json,
> plan --from-scout (patch-карты на названные файлы)`), the part P13a's §7 left: everything that needs the processor, the
> clock, the real file system or git. Components of `contour.yaml`: **scout-session** (NEW: Run Scout, Scout Command, Plan
> From Scout — the scout's second Component, the 30 000-byte rule: scout is 23 318 bytes, the three Functions are 19 438;
> same directory `src/scout/`, same guard layer, the P11b2 pattern of `batches`) and **cli** (Parse Command, Main: the
> routing; compacted first). PLAN's rule "`scout` and `plan --from-scout` live in Component scout; cli only routes" holds:
> both commands are Functions of the scout layer, cli parses and routes. No issue is labelled `P13b-scout` or `P13-scout`
> (both lists empty, 08.10). The deck is cut by V2 (`morph plan --component scout-session --component cli --checks
> decks/p13b/checks.json`), filtered to this phase's 9 cards by `decks/p13b/filter.py`. After P14 the final smoke calls
> `morph scout` live (§8).

## 1. Why this

- **P13a built the parts, nothing runs them.** Parse Turn, Cage Path, Run Tool, Spend Budget and Seed From Ownership
  (10 cards, 689 tests) are pure; `morph scout` still answers `NotYetError` (`src/cli/parse.ts`, `NOT_YET_WORDS`), so the
  orchestrator's recon (skill Phase 1 step 4) still needs the old `mrph scout` — 2 148 lines of Python on native
  `tool_calls` that the pinned providers refuse (mrph 29.09: 404 "No endpoints found … Tool Compatibility").
- **The old loop's measured losses are kept as rules.** (a) A session that kept calling tools after its budget made 16
  refused rounds until the 1 800 s deadline (2 of 9 sessions lost) → one answer-only turn after calls/reads/chars close,
  and any non-answer in it ends the session. (b) An answer naming a missing path was the commonest invalid answer → the
  answer's paths are caged against the listing, and one correction is granted. (c) A session that spent money must still
  leave its record → scout.json is written for every session that reached the model, answered or not (exit 1).
- **`plan --from-scout` is the link to the deck.** The old `mrph plan --from-scout` turned one scout.json into one patch
  card (`cards/planner.py`, 330 lines, `git cat-file` at the ref); V2 has no such path: P14's reviewer reads the scope from
  a scout record, and the final smoke runs scout on a tiny repository.

**Ripple, measured** (the 6 reference files in a scratch worktree from d7d3120, full suite): **2 of 689** red —
`tests/cli/parse.examples.test.ts` "Parse Command example 4" (`scout` is no longer a not-yet word) and "example 8" (the
no-command message lists seven commands). Every other shape is new: tsc, eslint and the guard (with the P13b rules) clean.

**Record sizes** (bytes of each Component block, `decks/p13b` measure: the block from its `- name:` line to the next):
cli 29 997 → **29 887** (compaction first: the given and then of 8 long examples — Run Command 1, 9, 10, Plan Command 1,
Main 4, 6, 8, 9 — moved whole to `tests/fixtures/cli/examples.json`, each example now names them by key, `yaml.safe_load`
of the moved values identical; −2 438 bytes; then the routing +2 328); scout 23 318 → 23 344 (its description names
scout-session); scout-session
new **19 438**; Requirement Deterministic Core gains the P13b sentence.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main** (module → what the new code calls or constructs):
  `src/scout/parseTurn.ts` — `parseTurn(text): Turn`, types `ScoutAction`, `ScoutAnswer`; `src/scout/cagePath.ts` —
  `cagePath(tree, path, "file" | "dir", fs): Caged`, types `ScoutFs`, `ScoutTree`; `src/scout/runTool.ts` —
  `runTool(action, tree, fs, caps): ToolResult`, `DEFAULT_TOOL_CAPS`, type `ToolCaps`; `src/scout/spendBudget.ts` —
  `spendTurn(budgets, spent, charge, elapsedMs): Charged`, `stopReason(answered, closed, why)`, `FINAL_TURN`,
  `DEFAULT_BUDGETS`, types `ScoutBudgets`, `ScoutSpent`, `BudgetName`; `src/scout/seedFromOwnership.ts` —
  `seedFromOwnership(ownership, files, limit)`, `renderSeed(seed, maxChars)`, `SEED_FILES` 6, `SEED_CHARS` 8000;
  `src/processor/send.ts` — `sendGeneration(config, requests, transport): Promise<GenerationResult>` (answers and usage
  by request index; the stub type reads `<answersDir>/<customId>.md`, missing → answer error `stub has no answer:
  <path>`), `realTransport(timeoutMs)`; `src/processor/registry.ts` — `readRegistry(env): Registry`, `PREFIX`;
  `src/processor/types.ts` — `ProcessorConfig`, `Transport`; `src/compiler/types.ts` — `Request {customId, model,
  maxTokens, reasoning, messages}`, `Message {role, content}`; `src/git/run.ts` — `gitOk(root, args, env)` (throws
  `git <verb> failed (exit <n>): <first stderr line>`), `runGit(root, args, env): GitResult`; `src/git/log.ts` —
  `readMorphLog(root, env)`; `src/git/ownership.ts` — `readOwnership(commits)`; `src/language/paths.ts` —
  `profileForPath(path)`, `hasExtension(profile, path)`; `src/cards/types.ts` — `Card`; `src/cards/model.ts` —
  `loadDeck(text): DeckResult` (tests only).
- **The tree of Run Scout examples** (under one tmpRoot `p`, root `p.path("t")`, files in this order; the node fs):

| listed path | content |
|---|---|
| `README.md` | `"tiny\n"` |
| `src/a.ts` | `"export const a = 1;\n"` |
| `src/b.ts` | `'import { a } from "./a.js";\nexport const b = a + 1;\n'` |

  Its tool texts (DEFAULT_TOOL_CAPS): LIST "" = `"LIST .: 2 entries\nREADME.md\nsrc/ (2 files)"` (42 chars); LIST src =
  `"LIST src/: 2 entries\na.ts\nb.ts"` (30); READ src/b.ts = `'READ src/b.ts lines 1-2 of 2\n1: import { a } from
  "./a.js";\n2: export const b = a + 1;'` (86); READ src/a.ts = `"READ src/a.ts lines 1-1 of 1\n1: export const a = 1;"`
  (51); GREP `export const a` -- src = `"GREP /export const a/ in src/: 1 match in 1 file\nsrc/a.ts:1: export const a =
  1;"`.
- **The stub processor gives every model turn.** `readRegistry({MORPH_PROCESSOR_s_TYPE: "stub",
  MORPH_PROCESSOR_s_ANSWERS_DIR: <dir>}).configs[0]`; turn r of a session is the file `<dir>/scout.t<r>.md` (the request's
  customId is `scout.t<r>`); a missing file is a failed call. A test with usage uses an openrouter config and a fakeFetch
  route `https://openrouter.ai/api/v1/chat/completions` (every request gets the same reply). Precondition (processor ·
  Send Generation): the stub reports usage 0/0 and cost 0; an openrouter reply's `usage.prompt_tokens`,
  `completion_tokens`, `cost` become the request's tokens and cost, a reply without `cost` gives null.
- **Fixtures** (`tests/fixtures/`), each by the type the Function takes:

| file | type | what it is | what the Function returns on it |
|---|---|---|---|
| `scout/protocol.txt` | text, no final newline | the 9 lines of PROTOCOL (1 161 chars) | Run Scout: `PROTOCOL` equals it |
| `scout/session.json` | text of ONE scout.json | a real record of the reference Scout Command 1 session with context_slice `[src/a.ts, README.md]`: scoutId `20261008-225320-74e423b1`, ref `2e7116d687d05d6d6d18c5dad347cdcf78de3c0b`, status ok, targets `[src/b.ts]`, question `"Make b twice a.\n"` | Plan From Scout 1: one card; 3: the base of every edit |
| `scout/noAnswer.json` | text of ONE scout.json | a real record of a failed session: status no_answer, answer null, stopReason `no answer: the model call failed in round 1: stub has no answer: /tmp/morph-side-l5V4h4/ans/scout.t1.md` | Plan From Scout 2: RefusalError |
| `cli/parseArgv.json`, `cli/parse.json` | ONE object each | key 4 first argv now `["review"]`; key 8 second result names seven commands; keys 17 (7 argv) and 18 (6 argv) added | Parse Command 4, 8, 17, 18 |
| `cli/examples.json` | ONE object | `"<Function> <n>"` → `{given, then}` of the 8 cli examples moved out of the record | — (the record's text; no test reads it) |

**Distinct markers.** Questions `"Make b twice a.\n"`, `"Double a.\n"`, `"Q"`, `"  Do it.\n\n"`; seeds `"Seed: one\n"`, `"S\n"`;
processors `s` (stub), `o` (openrouter, model `m/x`, key `k`), `nope`, `bad`; answers dirs `ans`, `ans2`, `empty`; the
clock `1791500000000` (→ `20261008-225320`), `5`, `0`, `7`, and +1000 per call; budgets `{2, 5, 100000, 10, 600000}`,
rounds 2, deadlineMs 1500, chars 60; caps listEntries 1; maxTokens 777; sessions `20261008-225320-74e423b1`,
`20200101-000000-00000000`, `20991231-000000-ffffffff`, `s1`, `zz`; targetBytes 100, 24000, 24001, 24002, 30000, 30001.
The code hard-codes none of them: budgets, caps, maxTokens, the clock, the deadline and the answers are parameters; the
defaults (`DEFAULT_BUDGETS`, `DEFAULT_TOOL_CAPS`, `SEED_*`, deadline 1800), the texts (`PROTOCOL`, `REMINDER`, the reply
and stop sentences, `FILE_SEED_HEADER`, `PATCH_CONTRACT`), `SCOUT_DIR`, the customId `scout.t<r>`, schema 1 and the
maxTokens rule are the contract.

**Harness skeletons** (only `tests/helpers.ts` and `node:fs`):

```ts
const NODE_FS: ScoutFs = { realpath: (p) => fs.realpathSync(p), readFile: (p) => fs.readFileSync(p, "utf8") };
const clock = fakeClock(0); const NO_NET: Transport = { fetch: fakeFetch().fetch, sleep: clock.sleep };
function stub(p: TmpRoot, dir: string, answers: string[]): ProcessorConfig {      // turn i+1 = answers[i]
  fs.mkdirSync(p.path(dir), { recursive: true }); answers.forEach((a, i) => p.write(`${dir}/scout.t${i + 1}.md`, a));
  return readRegistry({ MORPH_PROCESSOR_s_TYPE: "stub", MORPH_PROCESSOR_s_ANSWERS_DIR: p.path(dir) }).configs[0]; }
// Run Scout: session = {question: "Make b twice a.\n", tree: {root: p.path("t"), files: ["README.md", "src/a.ts",
//   "src/b.ts"]}, fs: NODE_FS, seedText: "", budgets: DEFAULT_BUDGETS, caps: DEFAULT_TOOL_CAPS, maxTokens: null, ...over}
// Scout Command: t = tmpRepo(); README.md + src/a.ts, git add ., commit -m files; src/b.ts, git add ., commit -m
//   "morph b: src/b.ts\n\nMorph-Card: b\nMorph-Model: m/b"; side s = tmpRoot(): task.txt, ans/scout.t<i>.md;
//   deps {env: {PATH, MORPH_PROCESSOR_s_TYPE: "stub", MORPH_PROCESSOR_s_ANSWERS_DIR: s.path("ans")}, now: () =>
//   1791500000000, cwd: s.root, transport: null}; args {processor: "s", issue: "task.txt", seedFile: null, deadlineSeconds: 60}
// Plan From Scout: p = tmpRoot(); README.md, src/a.ts, src/b.ts as above; p.write(".morph/scout/<id>/scout.json", fixture(...))
```

### 2.2. OUTPUT data shapes

**`src/scout/runScout.ts`** (NEW, layer scout; imports `sendGeneration` from `../processor/send.js`, types from
`../processor/types.js` and `../compiler/types.js`, and the five P13a modules; no node module, no clock, no env) —
exports, in this order:

```ts
export const PROTOCOL: string;       // tests/fixtures/scout/protocol.txt exactly (9 lines "\n"-joined, no final newline)
export const REMINDER: string;       // "One line per turn: READ <path> [<from>-<to>], GREP <pattern> [-- <dir>], LIST [<dir>] or ANSWER {json}."
export interface ScoutSession { question: string; tree: ScoutTree; fs: ScoutFs; seedText: string; budgets: ScoutBudgets; caps: ToolCaps; maxTokens: number | null }
export interface ScoutDeps { config: ProcessorConfig; transport: Transport; now: () => number }
export type ScoutStatus = "ok" | "no_answer" | "invalid_answer";
export interface JournalEntry {
  round: number; turn: "action" | "answer" | "malformed" | "failed"; action: ScoutAction | null; chars: number;
  error: string | null; inputTokens: number; outputTokens: number; cost: number | null;
}
export interface ScoutUsage { requests: number; inputTokens: number; outputTokens: number; cost: number | null }
export interface ScoutOutcome {
  status: ScoutStatus; answer: ScoutAnswer | null; stopReason: string; spent: ScoutSpent; elapsedMs: number;
  usage: ScoutUsage; journal: JournalEntry[]; messages: Message[];
}
export type CheckedAnswer = { ok: true; answer: ScoutAnswer } | { ok: false; error: string };
export function openingMessages(session: ScoutSession): Message[];
export function checkAnswer(answer: ScoutAnswer, tree: ScoutTree, fs: ScoutFs): CheckedAnswer;
export function runScout(session: ScoutSession, deps: ScoutDeps): Promise<ScoutOutcome>;
```

PROTOCOL, line by line (the fixture is the source; this is a copy):

```
You are the scout of a code repository: you find the files a task must change by reading the repository with tools, one tool per turn, and you answer with those files.
Each of your turns holds exactly ONE line that starts with a verb in upper case; prose before that line is allowed:
READ <path> [<from>-<to>]  the file's lines, 1-based and inclusive; a long file comes in pieces and the reply names the next range
GREP <pattern> [-- <dir>]  a JavaScript regular expression tested on every line of the tree, or of the files under <dir>; a|b works
LIST [<dir>]  the entries of a directory of the tree; no <dir> is the root
ANSWER {"targets": [...], "context_slice": [...], "reasoning": "..."}  your final answer, the JSON object last
targets: the files that must change; context_slice: the files whose definitions the change needs, read and not changed; reasoning: why, in a few sentences.
Every path is relative to the repository root, with "/", and names a file of the tree as LIST shows it: no directories, globs or line ranges in the answer.
Your calls, reads, characters and rounds are counted; when a budget closes you get one last turn: send ANSWER in it.
```

**Run Scout** — the record's behaviour, as code:

1. `openingMessages(s)` = `[{role "system", content PROTOCOL}, {role "user", content (s.seedText === "" ? "" : s.seedText +
   "\n") + runTool({kind "list", path ""}, s.tree, s.fs, s.caps).text + "\n\nTask:\n" + s.question}]`. Round 0 is not
   charged and not journaled.
2. `start = now()`; spent `{calls 0, reads 0, chars 0, rounds 0}`; usage `{requests 0, inputTokens 0, outputTokens 0,
   cost null}`; closed/why null; final false; corrected false.
3. Each round: `r = spent.rounds + 1`; request `{customId: "scout.t" + r, model: null, maxTokens: s.maxTokens, reasoning:
   null, messages: messages.slice()}`; `sendGeneration(config, [request], transport)`; usage: requests + 1, tokens added,
   `cost = (cost ?? 0) + u.cost` when `u.cost !== null` (so null until a request reports one; the stub reports 0). Every
   round pushes ONE journal entry with that request's `inputTokens`, `outputTokens`, `cost` (keys in the interface's
   order).
4. `answer.error !== null` → entry `{turn "failed", action null, chars 0, error}`; end `no_answer`, `"no answer: the model
   call failed in round <r>: <error>"` (nothing charged: spent.rounds stays). Else push `{role "assistant", content: text ??
   ""}`, `turn = parseTurn(text)`, `elapsed = now() − start`.
5. `turn.kind === "answer"`: `checked = checkAnswer(turn.answer, tree, fs)` — each target, then each context_slice path:
   `cagePath(tree, p, "file", fs)`, the first refusal → `{ok false, error: "targets: " | "context_slice: " + its error}`;
   else targets = the caged paths, a repeat dropped; context_slice = the caged paths, a repeat or a path among the targets
   dropped; reasoning as given. Then:
   - ok → `spendTurn(budgets, spent, {call false, read false, text ""}, elapsed)`, entry `{turn "answer", action null,
     chars 0, error null}`, end `ok` with the caged answer, `stopReason(true, closed, why)` (closed/why of an earlier turn).
   - rejected and `final` → charged with `""`, entry `{answer, null, 0, error}`, end `invalid_answer`, `"no answer: the
     answer after the budget closed was rejected: <error>"`.
   - rejected and `corrected` → the same with `"no answer: the corrected answer was rejected: <error>"`.
   - rejected the first time → `corrected = true`; charged with `"ANSWER rejected: <error>. Name only files of the tree and
     send ANSWER again."`; entry `{answer, null, <delivered length>, error}`; continue at 7.
6. `final` (and the turn is not an answer) → charged with `""`, entry `{turn "action" with its action | "malformed" with
   null, chars 0, error: null for an action, the reason for malformed}`, end `no_answer`, `"no answer: the model did not
   answer after the budget closed: <why>"`.
   An action → `tool = runTool(action, tree, fs, caps)`, charged `{call true, read tool.read, text tool.text}`, entry
   `{action, action, <delivered length>, tool.error}`. A malformed turn → charged `{call false, read false, text "Turn not
   understood: <reason>. " + REMINDER}`, entry `{malformed, null, <delivered length>, reason}`.
7. reply = the charged turn's delivered text (Spend Budget's: clipped with CLIP_MARKER at the char budget). The charge
   closed a budget → closed/why = it. closed `deadline` or `rounds` → push `{user, reply}`, end `no_answer`,
   `stopReason(false, closed, why)`. closed in FINAL_TURN → `final = true`, reply += `"\n\nThe budget is closed: <why>. No
   more tools will run: send ANSWER now, the JSON object last."`. Push `{user, reply}`; next round.
8. End: `{status, answer, stopReason, spent, elapsedMs: now() − start, usage, journal, messages}` (keys in this order).
   `now()` is called at the start, after each reply without an error, and once at the end.

| Run Scout example | given (the §2.1 tree; D budgets/caps = the defaults; now 5 unless said) | result |
|---|---|---|
| 1 | seedText `"Seed: one\n"`; t1 `LIST src`, t2 `Reading b.\nREAD src/b.ts`, t3 `ANSWER {"targets": ["src/b.ts"], "context_slice": ["./src/a.ts", "src/b.ts"], "reasoning": "b uses a"}` | the whole outcome: ok, `{[src/b.ts], [src/a.ts], "b uses a"}`, `the model answered on its own`, spent `{2, 1, 116, 3}`, elapsedMs 0, usage `{3, 0, 0, 0}`, journal `[{1, action, list src, 30, null, 0, 0, 0}, {2, action, read src/b.ts null null, 86, null, …}, {3, answer, null, 0, null, …}]`, 7 messages: system PROTOCOL; user `"Seed: one\n\nLIST .: 2 entries\nREADME.md\nsrc/ (2 files)\n\nTask:\nMake b twice a.\n"`; assistant t1; user LIST src text; assistant t2; user READ src/b.ts text; assistant t3 |
| 2 | caps D with listEntries 1, grepSkip []; t1 `I think it is b.`, t2 `ANSWER {"targets": ["src/c.ts"]}`, t3 `ANSWER {"targets": ["src"]}`; then a new dir: t1 the same t2, t2 `ANSWER {"targets": ["src/a.ts"], "reasoning": "a"}` | invalid_answer, answer null, `no answer: the corrected answer was rejected: targets: not in the tree (missing, ignored or a directory): src`; replies r1 `Turn not understood: no action: one line must start with READ, GREP, LIST or ANSWER. ` + REMINDER, r2 `ANSWER rejected: targets: not in the tree (missing, ignored or a directory): src/c.ts. Name only files of the tree and send ANSWER again.`; spent `{0, 0, r1 + r2 lengths, 3}`; journal malformed (r1 length, the reason), answer (r2 length, `targets: …src/c.ts`), answer (0, `targets: …src`); round 0 `"LIST .: 2 entries\nREADME.md\n… 1 more entries\n\nTask:\nMake b twice a.\n"`; roles system,user,assistant,user,assistant,user,assistant. Then ok, `the model answered on its own`, rounds 2, requests 2, `{[src/a.ts], [], "a"}` |
| 3 | budgets `{calls 2, reads 5, chars 100000, rounds 10, deadlineMs 600000}`; t1 `GREP export const a -- src`, t2 `READ src/a.ts`, t3 `ANSWER {"targets": ["src/a.ts"]}`; then t3 `LIST` | ok, `the model answered after the budget closed: the call budget is spent (2 of 2 calls)`, `{[src/a.ts], [], ""}`, messages[3] the GREP text, messages[5] the READ text + `"\n\nThe budget is closed: the call budget is spent (2 of 2 calls). No more tools will run: send ANSWER now, the JSON object last."`, spent `{2, 1, GREP + READ lengths, 3}`; then no_answer, null, `no answer: the model did not answer after the budget closed: the call budget is spent (2 of 2 calls)`, journal[2] `{3, action, list "", 0, null, 0, 0, 0}`, 7 messages, spent calls 2 rounds 3 |
| 4 | D with rounds 2; t1 `LIST`, t2 `LIST src`, t3 an ANSWER; then D with deadlineMs 1500 and `now` = +1000 per call (1000, 2000, …) | no_answer, `no answer: the round budget is spent (2 of 2 rounds)`, requests 2, 6 messages, the last `{user, LIST src text}`; then no_answer, `no answer: the deadline (1.5 s) passed`, elapsedMs 3000, requests 2, spent `{2, 0, 42 + 30, 2}` |
| 5 | the stub on an empty dir; then config `o` (openrouter, MAX_RETRIES 0) with a fakeFetch answering every request `{choices: [{message: {content: "READ src/a.ts"}, finish_reason: "stop"}], usage: {prompt_tokens 1000, completion_tokens 50, cost 0.25}}`, budgets of ex. 3, maxTokens 777 | no_answer, `no answer: the model call failed in round 1: stub has no answer: <dir>/scout.t1.md`, journal `[{1, failed, null, 0, that error, 0, 0, 0}]`, 2 messages, spent.rounds 0, requests 1; then usage `{3, 3000, 150, 0.75}`, `no answer: the model did not answer after the budget closed: the call budget is spent (2 of 2 calls)`, 3 fetch calls, the third body model `m/x`, max_tokens 777, 6 messages, journal costs `[0.25, 0.25, 0.25]`, journal[0] `{1, action, read src/a.ts, 51, null, 0.25, 1000, 50}` |

Rows (probe only): `openingMessages` with seed `"S\n"`, question `"Q"`; `checkAnswer` with `src//b.ts` twice and a slice
naming the target and `README.md` twice → `{[src/b.ts], [README.md]}`; a context path `../x` → `context_slice: path leaves
the root: ../x`; config `o` answering `READ src/zz.ts` with no cost and chars 60 → journal[0] chars 103 (60 + the
43-char CLIP_MARKER), error `not in the tree (missing, ignored or a directory): src/zz.ts`, cost null; `… the character
budget is spent (103 of 60 chars)`, usage cost null; `PROTOCOL` = the fixture, `REMINDER` as above.

**`src/scout/scoutCommand.ts`** (NEW, layer scout; one of its two node:fs files: `node:fs`, `node:crypto`, `node:path`;
imports git's `gitOk`, `runGit`, `readMorphLog`, `readOwnership`, processor's `readRegistry`, `PREFIX`, `realTransport`,
`runScout` and `PROTOCOL`, the seed and the defaults; the clock only as `deps.now()`, `new Date(start).toISOString()`
formatting it) — exports, in this order:

```ts
export interface ScoutOptions { processor: string; issue: string; seedFile: string | null; deadlineSeconds: number }
export interface ScoutCommandDeps { env: Record<string, string>; now: () => number; cwd: string; transport: Transport | null }
export interface ScoutResult { code: 0 | 1 | 2 | 3 | 4; document: unknown }
export interface SeedRecord { source: "primer" | "file"; path: string | null; files: string[]; chars: number }
export interface ScoutRecord {
  schema: 1; scoutId: string; createdAt: string; root: string; ref: string | null; question: string;
  questionSha256: string; protocolSha256: string; processor: string; model: string; seed: SeedRecord;
  budgets: ScoutBudgets; caps: ToolCaps; status: ScoutStatus; answer: ScoutAnswer | null; stopReason: string;
  spent: ScoutSpent; elapsedMs: number; usage: ScoutUsage; journal: JournalEntry[];
}
export const SCOUT_DIR = ".morph/scout";
export const FILE_SEED_HEADER = "Seed: files the operator named (--seed-file):";
export const NODE_SCOUT_FS: ScoutFs;      // realpath: fs.realpathSync, readFile: fs.readFileSync(p, "utf8")
export function sha256(text: string): string;                    // hex of the UTF-8 bytes
export function scoutId(ms: number, questionSha: string): string; // UTC YYYYMMDD-HHMMSS of ms + "-" + questionSha.slice(0, 8)
export type FileSeed = { ok: true; files: string[]; notes: string[] } | { ok: false; error: string };
export function readSeedFile(text: string, files: string[]): FileSeed;
export function renderFileSeed(files: string[], notes: string[]): string;
export function scoutCommand(root: string, args: ScoutOptions, deps: ScoutCommandDeps): Promise<ScoutResult>;
```

**Scout Command** — the record's behaviour; refusals are `{code: 4, document: {error: {code: 4, kind: "UsageError",
message}}}` and come before any model call or write: (1) the processor (`processor <id> is not configured` + `: ` + the
messages of the faults whose key starts `MORPH_PROCESSOR_<id>_`, `"; "`-joined, when any — Run Command's rule); (2) the
issue, resolved against `deps.cwd` (`issue file not found: <issue>`, `issue file is empty: <issue>` when `trim() === ""`;
the question is the text as read, untrimmed); (3) the listing (gitOk; a throw propagates — main makes it code 3); (4) the
seed — **readSeedFile** in order: JSON.parse throws → `the JSON does not parse`; not a plain object, or `files` not an array
of ≥ 1 non-empty strings → `files must be a non-empty list of paths`; `notes` present and not an array of strings → `notes
must be a list of strings`; the first file not in the listing → `not in the tree: <file>`; ok → `{ok, files, notes ([] when
absent)}`; refused as `seed file <seedFile>: <error>`; `seed file not found: <seedFile>` when not a regular file (resolved
against cwd). **renderFileSeed** = `FILE_SEED_HEADER + "\n"` + `"- <file>\n"` each + `"Note: <note>\n"` each. Without a seed
file: `seedFromOwnership(readOwnership(readMorphLog(root, env)), listing, SEED_FILES)` rendered by `renderSeed(·,
SEED_CHARS)`. (5) ref; (6) `start = deps.now()`, Run Scout as the record says (the listing as the tree's files, in git's
order); (7) the id, `<root>/.morph/scout/<id>/` (mkdir -p), `scout.json` and `transcript.json` (both `JSON.stringify(·,
null, 2) + "\n"`), the record's keys in the interface's order, `caps` = DEFAULT_TOOL_CAPS, `budgets` = `{...DEFAULT_BUDGETS,
deadlineMs: deadlineSeconds * 1000}`. Document keys: scoutId, scout, status, answer, stopReason, spent, elapsedMs, usage.
Code 0 when status ok, else 1.

| Scout Command example | given (the §2.1 harness: tmpRepo t, side root s) | result |
|---|---|---|
| 1 | answers `READ src/b.ts`, `ANSWER {"targets": ["src/b.ts"], "context_slice": ["src/a.ts"], "reasoning": "b reads a"}` | `{code 0, document {scoutId "20261008-225320-74e423b1", scout ".morph/scout/20261008-225320-74e423b1/scout.json", status ok, answer {[src/b.ts], [src/a.ts], "b reads a"}, stopReason "the model answered on its own", spent {1, 1, 86, 2}, elapsedMs 0, usage {2, 0, 0, 0}}}`; scout.json parsed = the whole record (createdAt `2026-10-08T22:53:20.000Z`, root t.root, ref `git rev-parse HEAD`, question `"Make b twice a.\n"`, questionSha256 `74e423b13c2bf8652f79c8574d8df4851d73528b737afb6e481a609303ecb92f`, protocolSha256 sha256(PROTOCOL), processor s, model stub, seed `{primer, null, [src/b.ts], 131}` = SEED_HEADER + `"\n- src/b.ts: written by b (m/b, run —)\n"`, budgets `{30, 12, 120000, 40, 60000}`, caps D, journal 2 entries) and its text exactly `JSON.stringify(record, null, 2) + "\n"`; transcript roles system,user,assistant,user,assistant, round 0 = the seed text + `"\nLIST .: 2 entries\nREADME.md\nsrc/ (2 files)\n\nTask:\nMake b twice a.\n"`; `git status --porcelain` = `?? .morph/` |
| 2 | seedFile `seed.json` = `{"files": ["src/a.ts"], "notes": ["a is the base"]}`; then nope.json; bad.json `{`; z.json `{"files": ["src/z.ts"]}`; e.json `{"files": []}`; n.json `{"files": ["src/a.ts"], "notes": [1]}` | code 0; scout.json seed `{file, "seed.json", [src/a.ts], 77}`, round 0 starting `FILE_SEED_HEADER + "\n- src/a.ts\nNote: a is the base\n" + "\nLIST .: "`; then 4 `seed file not found: nope.json`, `seed file bad.json: the JSON does not parse`, `seed file z.json: not in the tree: src/z.ts`, `seed file e.json: files must be a non-empty list of paths`, `seed file n.json: notes must be a list of strings` |
| 3 | processor nope; processor bad with `MORPH_PROCESSOR_bad_TYPE` x; issue none.txt; issue blank.txt `"  \n"`; then a tmpRoot outside git | 4 `processor nope is not configured`; `processor bad is not configured: MORPH_PROCESSOR_bad_TYPE must be one of openrouter, stub (got 'x')`; `issue file not found: none.txt`; `issue file is empty: blank.txt`; t has no `.morph`; the promise rejects with `git ls-files failed (exit 128): …`, no `.morph` there |
| 4 | an empty answers dir, deadlineSeconds 5 | code 1; document status no_answer, answer null, `no answer: the model call failed in round 1: stub has no answer: <s>/ans/scout.t1.md`, usage.requests 1; scout.json status no_answer, answer null, that stopReason, budgets.deadlineMs 5000, 1 journal entry |
| 5 | `scoutId(1791500000000, <the question's sha>)`, `scoutId(0, "0123456789abcdef")`, `sha256("")`, `sha256(question)`, `renderFileSeed(["x/a.py", "b.ts"], ["one", "two"])`, `readSeedFile('{"files": ["b.ts"]}', [a.ts, b.ts])`, `('["b.ts"]', …)`, `('{"files": ["b.ts", ""]}', …)`, NODE_SCOUT_FS on a tmp file | `20261008-225320-74e423b1`; `19700101-000000-01234567`; `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; the sha above; `FILE_SEED_HEADER + "\n- x/a.py\n- b.ts\nNote: one\nNote: two\n"`; `{ok, [b.ts], []}`; files refusal twice; readFile the text, realpath the path, realpath of a missing path throws |

**`src/scout/planFromScout.ts`** (NEW, layer scout; the other node:fs file: `node:fs`, `node:path`; imports `cagePath`
and its types, `profileForPath`, `hasExtension`, the `Card` type) — exports, in this order:

```ts
export interface FromScoutOptions { fromScout: string; out: string | null }
export interface FromScoutResult { code: 0 | 1 | 2 | 3 | 4; document: unknown }
export const SCOUT_SESSIONS = ".morph/scout";
export const PATCH_CONTRACT: string;   // the record's sentence
export interface PatchInput { scoutId: string; question: string; targets: string[]; contextSlice: string[]; targetBytes: number }
export function patchAcceptance(targets: string[]): string | null;
export function patchCard(input: PatchInput): Card;
export function planFromScout(root: string, args: FromScoutOptions): FromScoutResult;
```

**Plan From Scout** — the record's behaviour. Error documents `{error: {code, kind, message}}` with code 4 UsageError
(which session), 2 DeckError (the file), 2 RefusalError (its content against the tree). "latest" lists
`<root>/.morph/scout`, keeps the entries whose `<entry>/scout.json` is a regular file, sorts code-unit (`a < b`), takes the
last. Reading the record: `answer` an object; `targets`, `context_slice` arrays of strings (else treated as `[]`); `question`
a string (else `""`). The cage: tree `{root, files: [...targets, ...context_slice]}`, a node fs (realpathSync,
readFileSync); `cagePath(tree, t, "file", fs)` — so `./src/b.ts` is refused as `not in the tree (missing, ignored or a
directory): ./src/b.ts` (scout.json holds caged paths); a target refused → `target refused: <its error>`; caged but
`statSync` not a regular file → `target refused: not a file: <t>`; the targets' sizes summed (statSync size). A context path
refused or not a regular file → `dropped`, in order. The card's keys in Card's order; `contextSlice` the kept paths as
given. Document keys: scoutId, scout, ref, cards, dropped, out. A refusal writes nothing; out null writes nothing.

| Plan From Scout example | given (§2.1 harness; `<at>` = `.morph/scout/20261008-225320-74e423b1/scout.json`) | result |
|---|---|---|
| 1 | session.json at `<at>`; `{fromScout "latest", out "decks/s.json"}` | `{code 0, document {scoutId "20261008-225320-74e423b1", scout <at>, ref "2e7116d687d05d6d6d18c5dad347cdcf78de3c0b", cards [C], dropped [], out "decks/s.json"}}`, C = `{customId "scout-20261008-225320-74e423b1", intent "patch", targets [src/b.ts], contextSlice [src/a.ts, README.md], instruction "Make b twice a.\n\n" + PATCH_CONTRACT, acceptance "node_modules/.bin/tsc --noEmit && node_modules/.bin/vitest run --reporter=dot", model null, maxTokens 16000, reasoning null, variants 1, dependsOn []}`; decks/s.json = `JSON.stringify([C], null, 2) + "\n"`; loadDeck of it ok, 1 card |
| 2 | + `20200101-000000-00000000/scout.json` = noAnswer.json, `20991231-000000-ffffffff/notes.txt` (no scout.json); an empty root e | latest → code 0, scoutId 20261008…; the named id → the same result; 20200101… → 2 RefusalError `scout session 20200101-000000-00000000 has no answer (no_answer): no answer: the model call failed in round 1: stub has no answer: /tmp/morph-side-l5V4h4/ans/scout.t1.md`; zz → 4 `scout session not found: zz`; e with out d.json → 4 `no scout session under .morph/scout`; no `decks`, no `d.json` |
| 3 | `<at>` = session.json with schema 2; `{`; targets `["../x.ts"]`; targets `["src"]`; session.json and README.md removed; then src/b.ts removed (out null) | 2 DeckError `<at>: schema 2, expected 1`; `<at> does not parse`; 2 RefusalError `target refused: path leaves the root: ../x.ts`; `target refused: not a file: src`; code 0, dropped [README.md], contextSlice [src/a.ts]; `target refused: no such file: src/b.ts` |
| 4 | patchAcceptance `[a.py, b.md, c.py]`, `[notes.md, x.ts, y.py]`, `[notes.md]`; patchCard `{s1, "  Do it.\n\n", [n.md], [], 30000}`, then targetBytes 100, 24000, 24001, 24002 | `python3 -m py_compile a.py c.py && python3 -m pytest -q --tb=short`; the TypeScript line; null; `{scout-s1, patch, [n.md], [], "Do it.\n\n" + PATCH_CONTRACT, null, null, 20000, null, 1, []}`; maxTokens 16000, 16000, 16002, 16002 |

Rows (probe only): SCOUT_SESSIONS and PATCH_CONTRACT verbatim; a target `./src/b.ts` refused as above; src/b.ts of
30 001 bytes → maxTokens 20002; out `a/b/c.json` creates its parents.

**`src/cli/types.ts`, `src/cli/parse.ts`, `src/cli/main.ts`** (PATCH; one card owns the three, the P12 pattern: the
routing must land with the widened Command, or tsc breaks main.ts):

```ts
export interface ScoutArgs {
  name: "scout"; root: string; pretty: boolean; processor: string; issue: string; seedFile: string | null; deadlineSeconds: number;
}
export interface FromScoutArgs { name: "plan --from-scout"; root: string; pretty: boolean; fromScout: string; out: string | null }
export type Command = DeckCheckArgs | RunArgs | PlanArgs | SubmitArgs | CollectArgs | PrimerArgs | ScoutArgs | FromScoutArgs;
```

**Parse Command** — additions only, every other check, message, default and key unchanged: `--issue`, `--seed-file`,
`--from-scout` are value flags; `scout` is a command word (arity 1) and no longer a not-yet word (`review`, `report` stay);
the word `plan` with `--from-scout` among the seen flags is the command `plan --from-scout`; allowed flags — scout:
`--root, --pretty, --processor, --issue, --seed-file, --deadline`; plan --from-scout: `--root, --pretty, --from-scout,
--out` (so `--spec` there is `flag --spec does not apply to plan --from-scout`); the no-command message `no command
(commands: deck check, plan, run, submit, collect, primer, scout)`. After the flag check: plan --from-scout — its value
not matching `^[A-Za-z0-9._-]+$` → `--from-scout must match ^[A-Za-z0-9._-]+$ (got '<v>')`, else done (before plan's
`missing --spec`); scout — after primer's done and before `missing --deck`: no `--processor` → `missing --processor`, no
`--issue` → `missing --issue`, `--deadline` not a positive integer → `--deadline must be a positive integer (got
'<v>')`, else done with seedFile null and deadlineSeconds 1800 by default. Keys in the interfaces' order.

| Parse Command example | argv (`parseArgv.json`) | result (`parse.json`) |
|---|---|---|
| 4 (changed) | `[review]`; `[deck, status]` | NotYetError `command review is not available yet`; `command deck status is not available yet` |
| 8 (changed) | `[--root]`; `[]` | `flag --root needs a value`; `no command (commands: deck check, plan, run, submit, collect, primer, scout)` |
| 17 | `[scout, --processor, ds, --issue, task.txt]`; `[--pretty, scout, --root, /r, --processor, s, --issue, /tmp/q.md, --seed-file, seed.json, --deadline, 90]`; `[scout, --issue, t]`; `[scout, --processor, s]`; `[scout, --processor, s, --issue, t, --deadline, 0]`; `[scout, --processor, s, --issue, t, --deck, d]`; `[run, --deck, d, --processor, s, --issue, t]` | `{scout, ".", false, ds, task.txt, null, 1800}`; `{scout, /r, true, s, /tmp/q.md, seed.json, 90}`; `missing --processor`; `missing --issue`; `--deadline must be a positive integer (got '0')`; `flag --deck does not apply to scout`; `flag --issue does not apply to run` |
| 18 | `[plan, --from-scout, latest]`; `[plan, --root, /r, --from-scout, 20261008-225320-74e423b1, --out, decks/s.json, --pretty]`; `[plan, --from-scout, x, --spec, c.yaml]`; `[plan, --from-scout, a/b]`; `[plan, --spec, c.yaml, --from-scout]`; `[plan, --from-scout, x, --judge]` | `{plan --from-scout, ".", false, latest, null}`; `{plan --from-scout, /r, true, 20261008-225320-74e423b1, decks/s.json}`; `flag --spec does not apply to plan --from-scout`; `--from-scout must match ^[A-Za-z0-9._-]+$ (got 'a/b')`; `flag --from-scout needs a value`; `flag --judge does not apply to plan --from-scout` |

**Main** — two branches before the run branch (which stays the last else): `command.name === "scout"` → `result = await
scoutCommand(root, command, deps)` (CliDeps passes as ScoutCommandDeps, ScoutArgs as ScoutOptions); `"plan --from-scout"`
→ `result = planFromScout(root, command)`. The stderr line is `morph <command name>: exit <code>\n` as for every command
(`morph plan --from-scout: exit 0\n`).

| Main example | given | result |
|---|---|---|
| 10 | tmpRepo t, src/a.ts committed; side root s: task.txt `"Double a.\n"`, ans/scout.t1.md `ANSWER {"targets": ["src/a.ts"]}`; deps {env PATH + the stub s on s/ans, now 1791500000000, cwd s.root, transport null}; `[scout, --processor, s, --issue, task.txt, --root, t]`; then `[plan, --from-scout, latest, --root, t, --out, decks/s.json]` | 0, one chunk: status ok, answer `{[src/a.ts], [], ""}`, scout `.morph/scout/<scoutId>/scout.json`, scoutId starting `20261008-225320-`; stderr `["morph scout: exit 0\n"]`; then 0: scoutId the same, cards[0] customId `scout-<scoutId>`, targets [src/a.ts], intent patch, out decks/s.json; decks/s.json = its cards; stderr `["morph plan --from-scout: exit 0\n"]` |
| 11 | the same deps; `[scout, --processor, nope, --issue, task.txt, --root, t]`; `[plan, --from-scout, latest, --root, e]` (e an empty tmpRoot); `[scout, --processor, s, --issue, task.txt, --root, e]` | 4 `{error {4, UsageError, "processor nope is not configured"}}`, stderr `["morph scout: exit 4\n"]`; 4 `no scout session under .morph/scout`, stderr `["morph plan --from-scout: exit 4\n"]`; 3 RuntimeError beginning `git ls-files failed (exit 128): ` |

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P13b scout"):

- **Two Components, one layer.** scout-session holds Run Scout, Scout Command, Plan From Scout in `src/scout/` · scout
  23 318 + 19 438 > 30 000; the P11b2 precedent (batches beside processor); PLAN's "lives in scout, not planner" kept in
  the layer.
- **The loop** · one model turn per round through `sendGeneration` (the stub and openrouter alike, no `fetch` in the
  layer); round 0 = PROTOCOL as system, the seed + the root LIST + the task as user, uncharged; the delivered text of every
  turn is the next user message; one correction of a rejected answer; after a calls/reads/chars close one answer-only turn
  (the close sentence appended to the same user message), any non-answer there ends it (the old 16 refused rounds);
  rounds and the deadline end at once; a failed model call ends with `no answer: the model call failed in round <r>: …`;
  the answer is charged a round; usage summed, cost null until reported; maxTokens a session parameter (null in `morph
  scout`: the provider's default, ds thinks 15–20k before answering).
- **The answer's file grammar** · targets and context_slice are root-relative "/" paths of FILES of the session's listing,
  each through Cage Path (file): no directory, glob, line range, absolute path, `..` or `.git`; repeats dropped, slice
  paths that are targets dropped; scout.json holds the caged form, which is the only form `plan --from-scout` accepts.
- **scout.json location** `.morph/scout/<id>/scout.json` (+ `transcript.json`), id `YYYYMMDD-HHMMSS-<sha8 of the
  question>` (UTC of the start; the old mrph id) · the old path the skill and the reviewer know; `.morph/*` is gitignored
  here (not committed: a local provenance file; the stdout document carries the answer); in a repository without that
  ignore it is untracked, and `morph run` already ignores `.morph/` in its dirty check. Schema 1, shape §2.2 (ScoutRecord):
  question, its sha256, the protocol's sha256, ref (HEAD or null), processor and model, the seed's provenance, budgets,
  caps, status, answer, stopReason, spent, elapsedMs, usage, and the journal — every round with its call, result size,
  error, tokens and cost.
- **`morph scout` argv** `scout --processor <id> --issue <file> [--seed-file <json>] [--deadline <s>] [--root <dir>]
  [--pretty]` · the task is a file resolved against the working directory (outside the tree, so the tree stays clean; no
  stdin: only src/cli.ts touches the process); budgets and caps are the P13a defaults (only the deadline is a flag); exit
  0 with an answer, 1 without (the session ran and may have spent), 4 before any spend, 3 on a git or I/O fault.
- **`--seed-file`** `{"files": [≥ 1 listed paths], "notes"?: [strings]}` replaces the ownership seed (the old
  seed_from_file shape), every file must be in the listing, rendered under FILE_SEED_HEADER.
- **`plan --from-scout`** `plan --from-scout <id|latest> [--out <deck>] [--root] [--pretty]`: one session → ONE patch card
  (all targets in one card: a task's change across files is one invariant; one owner), customId `scout-<id>`, instruction
  the question + PATCH_CONTRACT, acceptance from the first target's language profile (parseLine && fullRunLine; null
  without a profile — the operator sets it, `morph run` refuses a null acceptance), maxTokens max(16000, ceil(bytes/3)×2)
  (the ds lesson's floor; ×2 for the answer's prose), variants 1; the paths re-checked on disk now (the tree may have
  moved), a missing target refuses, a missing context file is dropped; no ref check (ref is reported), no sidecar.
- **Layer split** · node:fs only in `scoutCommand.ts` (with node:crypto) and `planFromScout.ts` (guard `NODE_FILES`);
  `scoutCommand.ts` the one CLOCK_FORMATTER of scout (id and createdAt from deps.now()); layer scout may import compiler
  (Request and Message types); Run Scout stays free of node modules.

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/scout/runScout.ts` | NEW | probe only | NEW `tests/scout/runScout.examples.test.ts` (RS 1–5) |
| `src/scout/scoutCommand.ts` | NEW | probe only | NEW `tests/scout/scoutCommand.examples.test.ts` (SC 1–5) |
| `src/scout/planFromScout.ts` | NEW | probe only | NEW `tests/scout/planFromScout.examples.test.ts` (PF 1–4) |
| `src/cli/types.ts`, `parse.ts`, `main.ts` | PATCH | probe only | PATCH `tests/cli/parse.examples.test.ts` (PC 4 and 8 changed, 17, 18 added); NEW `tests/cli/main.p13b.examples.test.ts` (Main 10, 11) |

- `runScout.examples`: "Run Scout example 1: …" … "5: …"; each builds the §2.1 tree and its answers dirs under its own
  tmpRoot, removed in finally; example 1 compares the whole ScoutOutcome with toStrictEqual, the others status,
  stopReason, spent, the journal entries and the messages named in the table.
- `scoutCommand.examples`: "Scout Command example 1: …" … "5: …"; the §2.1 tmpRepo and side root per test, both removed in
  finally; example 1 compares the whole document and the whole parsed scout.json.
- `planFromScout.examples`: "Plan From Scout example 1: …" … "4: …"; the sessions from `fixture("scout/session.json")` and
  `fixture("scout/noAnswer.json")`.
- `parse.examples` (patched): "Parse Command example 4: review and deck status answer NotYetError" replaces "…: scout and
  deck status answer NotYetError" (argv `["review"]`); example 8's message gains `, scout`; "Parse Command example 17: the
  word scout and its flags" and "Parse Command example 18: plan --from-scout" added, each result a literal compared whole
  with toStrictEqual; every other test and line unchanged.
- `main.p13b.examples`: "Main example 10: …", "Main example 11: …", in process, an io that pushes stdout and stderr chunks.

### 2.4. What must not break

- Byte for byte: every file outside the 6 code targets and the 5 test files of §2.3 — `src/scout/` P13a files,
  `src/processor/*`, `src/git/*`, `src/language/*`, `src/cli.ts` and the other `src/cli/*`, `tests/helpers.ts`.
- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/` — untouched by every card.
- 689 tests in 98 files: 687 green at every card (`tests/cli/parse.examples.test.ts` excluded deck-wide, its two
  examples red from parse-command until parse-command-judge); after the run **689 + 2 + RS 5 + SC 5 + PF 4 + Main 2 = 707**
  in 102 files.

## 3. Acceptance

Built by `morph plan --checks decks/p13b/checks.json`, narrow to broad, every stage printing `== <stage>`. `ownGit: false`
(the tests make their own tmpRepo; none touches this repository's git), `fullExclude` `tests/cli/parse.examples.test.ts`
(the ripple).

Code cards (no test file; code-only targets): `probe/<card>/` → `tsc` (per-card tsconfig excluding the generation's other
targets) → `eslint <targets>` → `guard.mjs src <targets>` → `decks/p13b/parts/<card>.probe.ts` (run-scout RS 1–5 + 1 row
= 6; scout-command SC 1–5 + 1 = 6; plan-from-scout PF 1–4 + 1 = 5; parse-command PC 4/8, 17, 18, Main 10/11 + 1 = 5;
**22 tests**) → eslint's verdict → full `vitest run` → frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs tests <file> <min> <max> lits<n>.json` (+ the names
kept for a patched file) → `vitest run <targets>` → eslint's verdict → full run → frozen → untracked.

| file | new | min | max | lits |
|---|---|---|---|---|
| `tests/scout/runScout.examples.test.ts` | yes | 5 | 11 | `Run Scout example 1` … `5`, `scout.t1.md`, `the model answered after the budget closed: the call budget is spent (2 of 2 calls)`, `no answer: the corrected answer was rejected: targets: `, `the deadline (1.5 s) passed`, `scout/protocol.txt` |
| `tests/scout/scoutCommand.examples.test.ts` | yes | 5 | 11 | `Scout Command example 1` … `5`, `20261008-225320-74e423b1`, `Morph-Card: b`, `seed file z.json: not in the tree: src/z.ts`, `issue file is empty: blank.txt`, `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `tests/scout/planFromScout.examples.test.ts` | yes | 4 | 10 | `Plan From Scout example 1` … `4`, `scout/session.json`, `scout/noAnswer.json`, `target refused: path leaves the root: ../x.ts`, `no scout session under .morph/scout`, `python3 -m py_compile a.py c.py` |
| `tests/cli/parse.examples.test.ts` | no (drop: the old example 4 name) | 24 | 26 | `Parse Command example 17`, `Parse Command example 18`, `primer, scout)`, `command review is not available yet`, `flag --spec does not apply to plan --from-scout` |
| `tests/cli/main.p13b.examples.test.ts` | yes | 2 | 8 | `Main example 10`, `Main example 11`, `morph plan --from-scout: exit 0`, `no scout session under .morph/scout`, `scout.t1.md` |

min = the record's examples (parse: the file's 22 tests + 2); max = min + 6 (parse + 2).

**Output budget** (`max_tokens`, before the session's ×3 for `ds`; a ds answer ≥ 10 KB gets ≥ 16 000, DECISIONS P12a):

| card | returns | `max_tokens` |
|---|---|---|
| run-scout | runScout.ts ≈ 9.4 KB | 20 000 |
| scout-command | scoutCommand.ts ≈ 8.1 KB | 20 000 |
| plan-from-scout | planFromScout.ts ≈ 5.4 KB | 14 000 |
| parse-command | types.ts + parse.ts + main.ts ≈ 16.8 KB, three whole files | 24 000 |
| run-scout-judge | ≈ 10 KB new file (the tree, two dirs per test, 5 tests) | 24 000 |
| scout-command-judge | ≈ 9 KB new file (tmpRepo with a trailer commit, the whole record) | 24 000 |
| plan-from-scout-judge | ≈ 6 KB new file | 16 000 |
| parse-command-judge | the whole patched file ≈ 13.5 KB | 24 000 |
| main-judge | ≈ 4 KB new file | 12 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- **Layer scout** (guard, P13b): may import cards, processor, wait, primer, language, git, compiler; of the Node modules
  `node:path` everywhere, `node:fs` and `node:crypto` in `src/scout/scoutCommand.ts`, `node:fs` in
  `src/scout/planFromScout.ts` (`NODE_FILES`), nothing else; NO_CLOCK with `scoutCommand.ts` the one CLOCK_FORMATTER
  (`new Date(start).toISOString()` of the parameter `deps.now()`); NO_ENV (the environment is `deps.env`); no `fetch` (only
  processor), no `process`, no `console`, no `node:child_process` (git spawns, through gitOk and runGit).
- runScout.ts imports no node module; planFromScout.ts no git and no processor.
- A file a card writes is in no sibling's slice in the same generation: generation 0 (run-scout, plan-from-scout) reads
  no P13b file; generation 1 (scout-command reads runScout.ts; run-scout-judge, plan-from-scout-judge read their modules);
  generation 2 (parse-command reads scoutCommand.ts and planFromScout.ts; scout-command-judge reads scoutCommand.ts and
  runScout.ts, no cli file); generation 3 (parse-command-judge, main-judge read the cli files, not each other's test).
- Tests write only under `tmpRoot()` / `tmpRepo()` and remove them in `finally`; no timer; no network (every model turn
  from the stub processor or a fakeFetch); a judge writes only its targets.

## 7. Out of scope

- `--no-round0`, budget and cap flags beyond `--deadline`, `--issue -` (stdin), the transcript's prompt caching — a later
  phase if a session asks; OUTLINE and git_log_s (P13a §7); reading at a git ref instead of the working tree.
- A ref check in `plan --from-scout` (`--allow-stale`), a provenance sidecar (`.morph/plans/`), several cards per session,
  a reasoning lever, `--add` to an existing deck: the old mrph had them; V2's deck is a file the operator merges.
- The reviewer (P14) reading scout.json; the final smoke (§8) after P14.

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component scout-session --component cli \
  --judge --checks decks/p13b/checks.json --out decks/p13b/deck.json
python3 decks/p13b/filter.py decks/p13b/deck.json                # keeps the 9 cards of the phase
node dist/cli.js deck check --root . --deck decks/p13b/deck.json                                  # errors 0
python3 decks/tools/scale_tokens.py decks/p13b/deck.json 3       # the session, for processor ds
rm -rf /tmp/v2bin-p13b && mkdir -p /tmp/v2bin-p13b && cp -r dist /tmp/v2bin-p13b/ && ln -s $PWD/node_modules /tmp/v2bin-p13b/node_modules
node /tmp/v2bin-p13b/dist/cli.js run --root . --deck decks/p13b/deck.json --processor ds --deadline 2400
```

Cross-check (dry): from `morph-lab`, `venv/bin/mrph plan --spec <repo>/contour.yaml --map <repo>/morph-map.json
--component scout-session --component cli --judge --root <repo>`.

**The final smoke's scout step (after P14).** On the tiny repository T of the smoke (a git repo with a few committed
TypeScript files, after its `run` on ds), with the binary copy and the ds env (`decks/p7/smoke/run.sh` recipe):

```
printf 'Make b return twice a; name the file that must change.\n' > /tmp/smoke-scout-task.txt     # outside T
node /tmp/v2bin-smoke/dist/cli.js scout --root T --processor ds --issue /tmp/smoke-scout-task.txt --deadline 300 > /tmp/smoke-scout.json
node /tmp/v2bin-smoke/dist/cli.js plan --from-scout latest --root T --out /tmp/smoke-scout-deck.json > /tmp/smoke-plan.json
node /tmp/v2bin-smoke/dist/cli.js deck check --root T --deck /tmp/smoke-scout-deck.json
```

Ceiling **$0.05** and 300 s for the scout step (DEFAULT_BUDGETS: ≤ 30 calls; a tiny repo answers in 3–8 rounds of
≤ 10k input tokens each on ds). It checks: exit 0 and `status` ok; `answer.targets` ⊆ T's files and holding the file the
task names; `.morph/scout/<id>/scout.json` parses with schema 1, `journal.length` = `usage.requests`, `usage.cost` > 0 and
≤ the ceiling, `stopReason` one of the record's sentences; `plan --from-scout` exit 0 with one patch card on those targets
and `deck check` errors 0; P14's `morph review` then reads the same scout.json (`answer.targets`, `answer.context_slice`,
`question`) as its scope table.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 9 (4 code, 5 judges) / 4: [plan-from-scout, run-scout] [plan-from-scout-judge, run-scout-judge, scout-command] [parse-command, scout-command-judge] [main-judge, parse-command-judge] |
| executor bill | ≈ $0.12–0.22 on ds ×3 (P13a: 10 cards, 16 requests, $0.1545); ≤ $0.40 with a re-cut; cap $5 |
| cards with regeneration | 2–4 of 9 (run-scout: the correction/final-turn order, the answer turn charged, cost null vs 0; scout-command: the record's key order, the seed chars; parse-command: three whole files, the check order of plan --from-scout; run-scout-judge: the journal chars) |
| tests after the run | 707 ± 6 in 102 files |
| first red | run-scout: the close sentence pushed as a second user message, or the deadline checked before the request; scout-command: the seed file checked before the listing exists (its "not in the tree" needs the listing), `createdAt` from a second `now()` |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no answer cut at its `max_tokens`; (3) the V2 cut equals
the old mrph's dry cut in ids, dependsOn, generations, targets, slices and max_tokens; (4) after the run no file outside
§2.3's eleven changed; (5) `src/scout/runScout.ts` imports no node module, and node:fs appears only in the two files the
guard names.

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the MEASURE row with
its `прогоны` cell; DECISIONS lines "P13b scout".

## 11. Actual

### Gate (preparation)

08.10, on the VPS, by the preparing orchestrator (Opus 5.5); no paid run, no call to the live service. Data commits 8bc4f9f
(spec, record, map, guard, fixtures, probes, checks, filter, deck, DECISIONS), c1d425a (6 probe rows closing the first
pass's mutation survivors; deck re-cut) and the gate commit (this section). Component sizes: cli 29 997 → 29 887, scout
23 318 → 23 344, scout-session new 19 438. Issues labelled P13b-scout / P13-scout: none open. No split: 9 cards ≤ 12.

The deck **cut by V2**: `node dist/cli.js plan --component scout-session --component cli --judge --checks
decks/p13b/checks.json --out decks/p13b/deck.json` exit 0, 20 cards, `decks/p13b/filter.py` keeps 9; generations
`[plan-from-scout, run-scout] [plan-from-scout-judge, run-scout-judge, scout-command] [parse-command, scout-command-judge]
[main-judge, parse-command-judge]`; `node dist/cli.js deck check` **0 errors, 0 warnings**, no hazards. Cross-check: the
old `mrph plan --spec … --component scout-session --component cli --judge` (dry, exit 0) gives the same 20 ids in the same
order and the same 5 generations; on the 9 phase cards targets, slices, dependsOn, intent, variants, max_tokens and
reasoning (2 500) equal; instructions and acceptances differ on all 9 (the P10a design; V2's chain from checks.json).

Scratch worktree from c1d425a (references of the 6 code files and 5 judge files, deleted afterwards), cards run in deck
order with the deck's own acceptances, each accepted card committed before the next: **9 of 9 chains green, 51.9–55.6 s
each (480.9 s in all; limit 250 s per chain)**; the first pass from 8bc4f9f also 9 of 9 (52.7–97.5 s under a parallel
mutation run). Ripple: 2 of 689 (parse.examples 4 and 8, excluded deck-wide). The final tree: `tsc`, `eslint src tests`,
guard clean, `vitest run` **710 / 710** in 102 files (689 + 17 tests of the probe-shaped reference judges + 2 + 2; the real
judges write ≈ 18 → 707). Typed one-line throwing stubs (`Error: stub <fn> <args JSON>`; types and constants as
specified): every code card red at the probe — run-scout 6/6, scout-command 6/6, plan-from-scout 5/5, parse-command 5/5
(**22/22**), each FAIL with its readable stub line; tsc clean on the stubs. Judges with the reference code and the file
absent: red at the guard ("… missing"), the patched parse file at its old text red at the guard (22 test calls, examples
17 and 18 missing). Mutation check: **121 single-rule mutations** of the references (runScout 47, scoutCommand 30,
planFromScout 29, parse 12, main 3), each under a 120 s subprocess timeout: first pass 116 killed, 5 survivors (one a
malformed mutant); 3 closed by probe rows (c1d425a), the malformed one rewritten; second pass **120 killed, 0 by timeout**
(max 6.0 s), 1 equivalent: "scout" re-added to NOT_YET_WORDS (the word is matched before the not-yet set is read).

Max slice + targets: scout-command 91 937 bytes + scoutCommand.ts ≈ 8.1 KB ≈ 100 KB (gate 200 KB). **Forecast** on `ds`
with every maxTokens × 3: P13a ran 10 cards, 16 requests, $0.1545 at 41–54 KB in; here 9 cards of 66–92 KB in, 13 first
requests (4 code × 2 variants + 5 judges), ≈ 13–20 requests ≈ **$0.15–0.30**, ≤ $0.50 with a re-cut; ≤ $1. **Gate holds.**

**Run command** (from the repo root, the binary copied first; the session applies maxTokens × 3 first, as the operator
ordered):

```
python3 decks/tools/scale_tokens.py decks/p13b/deck.json 3
npm run build && rm -rf /tmp/v2bin-p13b && mkdir -p /tmp/v2bin-p13b && cp -r dist /tmp/v2bin-p13b/ && ln -s $PWD/node_modules /tmp/v2bin-p13b/node_modules
node /tmp/v2bin-p13b/dist/cli.js run --root . --deck decks/p13b/deck.json --processor ds --deadline 2400 > /tmp/p13b-run.json
```
