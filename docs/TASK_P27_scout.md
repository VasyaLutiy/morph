# TASK_P27 — issue #21: the scout answers on a real project (`src/scout/parseTurn.ts`, `src/scout/runTool.ts`, `src/scout/sessionText.ts`, `src/scout/runScout.ts`, `src/scout/scoutCommand.ts`)

Old-Morph scheme (skill `morph-v2-orchestrator`). Record: Component scout — Parse Turn (behaviour rewritten, example 5
changed, examples 7–9), Run Tool (READ character cap, LIST line counts; example 5 changed, example 6), Data Objects Turn
and Tool Caps; Component scout-session — Run Scout (budgets shown, files read once, the correction after the close, round
zero; examples 1–5 changed, 6–8 new), Session Text (NEW, examples 1–3), Scout Command (recent commits; example 1
changed), Data Objects Scout Session and Session Texts. Fixture `tests/fixtures/scout/protocol.txt` rewritten. Both
Components hold Functions outside the phase (Cage Path, Spend Budget, Seed From Ownership, Plan From Scout): cut with
`--only`, the deck is a transaction.

## 1. Why this

- Four `morph scout` sessions on MorphStudio (Go, ds, 10.10): three `no_answer`, one `ok` after a correction; 1 518 664
  input tokens, 25 of 85 rounds refused whole ("N actions in one turn"), those rounds 541 030 input tokens (36 %).
- All three failures end at the final answer-only turn with text that is, or is one correction away from, a valid
  answer: two bare JSON objects without `ANSWER` (185853 r27, 190028 r14), one `ANSWER` whose JSON has an unescaped
  quote (082857 r26). No correction is granted after the close.
- One READ of `contour.yaml` delivered 33 367 chars (28 % of the 120 000 budget); 7 files of ≤ 929 lines closed the
  12-read budget (190028: reads count 400-line pieces); `GREP /Exited\(/` returned "0 matches" where 33 lines match.
- This phase's own recon (10.10, this repo, ds): scout 1 `no_answer` — the final turn was the answer written twice
  (`ANSWER {…}` + the same object again: "the JSON does not parse", first "{" to last "}" spans both); scout 2
  (`--seed-file`) `invalid_answer` after rounds of 81, 56 and 51 actions in one turn. $0.0109 + $0.0313.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main** (b8c93b4): `src/scout/parseTurn.ts` — `ScoutAction`, `ScoutAnswer`, `Turn`, `VERBS`,
  `parseTurn`; `src/scout/cagePath.ts` — `cagePath(tree, path, "file" | "dir", fs)`, `ScoutFs`, `ScoutTree`;
  `src/scout/runTool.ts` — `ToolCaps`, `DEFAULT_TOOL_CAPS`, `ToolResult`, `runTool`; `src/scout/spendBudget.ts` —
  `ScoutBudgets`, `ScoutSpent`, `DEFAULT_BUDGETS`, `spendTurn`, `stopReason`, `FINAL_TURN` (unchanged);
  `src/scout/runScout.ts` — `PROTOCOL`, `REMINDER`, `ScoutSession`, `ScoutDeps`, `openingMessages`, `checkAnswer`,
  `runScout`; `src/scout/scoutCommand.ts` — `scoutCommand` and its helpers; `src/git/run.ts` — `runGit(root, args,
  env): {code, stdout, stderr}`, `gitOk`.
- **The trees** are those of the existing tests, unchanged: Run Tool examples 1–5 the §2.1 tree of
  `docs/TASK_P13a_scout.md` (README.md `"alpha here\n"` = 1 line, src/a.ts 5 lines, src/b.ts 3 lines, src/bin.dat
  binary, src/e.ts `""` = 0 lines, dirlink → src (unreadable as a file), out.txt → outside (refused)); Run Scout and
  Scout Command the §2.1 tree of `docs/TASK_P13b_scout.md` (README.md `"tiny\n"` 1 line, src/a.ts 1 line, src/b.ts
  2 lines). Their tool texts now (DEFAULT_TOOL_CAPS): LIST "" = `"LIST .: 2 entries\nREADME.md (1 line)\nsrc/ (2
  files)"` (51 chars); LIST src = `"LIST src/: 2 entries\na.ts (1 line)\nb.ts (2 lines)"` (49); READ src/b.ts 86, READ
  src/a.ts 51 (unchanged); GREP `export const a` -- src 80.
- **Run Tool example 6** (new): one tmp dir, `w.txt` = 200 × (250 × "w" + "\n"), `long.txt` = 13 000 × "x" + "\n",
  files `["long.txt", "w.txt"]`. Lengths measured by a spike of the rule: 12 053, 12 063, 12 044 chars.
- **Session Text example 3** (new): one tmp dir, `.morph/x.md` `"LimitsUnknown\n"`, `a/run.go` `"func (s *S) Exited()
  bool {\n\treturn s.LimitsUnknown\n}\n"`, `b/doc.md` `"Exited( here\nExited( " + "z".repeat(250) + "\n"`,
  `c/many.txt` `"LimitsUnknown\n".repeat(22)`; files those four in that order; node fs; skip `[".morph", "decks"]`.
  The full text is 1 085 chars (spike).
- **Harnesses**: the existing test files' own (NODE_FS, NO_NET, `stub(p, dir, answers)`, the session literal, the
  Scout Command tmpRepo) — keep them; the record's new examples use the same.

### 2.2. OUTPUT data shapes

**`src/scout/parseTurn.ts`** (PATCH): `Turn`'s action variant becomes `{ kind: "action"; action: ScoutAction;
skipped?: string[] }`; the rest of the exports unchanged; still no import.

| turn | main | P27 |
|---|---|---|
| no action line, the text holds a JSON object with `targets` (bare, fenced, prose before) | malformed "no action: …" | that answer (same key checks) |
| no action line, no such JSON | malformed "no action: …" | unchanged |
| an `ANSWER` line among other action lines | malformed "<n> actions …" | the answer of the first ANSWER line |
| N action lines, no ANSWER | malformed "<n> actions …" | equal (trimmed) lines dropped; the first runs; the others in `skipped` (no key when none) |
| GREP `/pat/flags` | pattern `/pat/flags` | pattern `pat` |
| ANSWER JSON | first "{" to last "}" | first balanced object (string-aware), else first "{" to last "}" |

**`src/scout/runTool.ts`** (PATCH): `ToolCaps` gains `readChars?: number` after `readLines`; `DEFAULT_TOOL_CAPS` =
`{readLines: 400, readChars: 12000, grepHits: 200, grepLineChars: 300, listEntries: 300, grepSkip: [".morph",
"decks"]}`. READ: lines kept while their lengths + 1 sum ≤ readChars (at least one; a longer first line clipped). LIST: a
file entry `"<name> (<n> line|lines)"`, `"<name> (binary)"`, or the name alone (refused / unreadable). GREP unchanged.

**`src/scout/sessionText.ts`** (NEW, layer scout, pure): exports, in this order, `ANSWER_SHAPE`, `ROUND0_CLUES` (8),
`ROUND0_HITS` (20), `ROUND0_HEADER`, `budgetSentence(budgets: ScoutBudgets): string`, `budgetLeft(budgets: ScoutBudgets,
spent: ScoutSpent): string`, `notRun(skipped: string[]): string`, `afterClose(problem: string): string`,
`taskClues(question: string): string[]`, `roundZero(question: string, tree: ScoutTree, fs: ScoutFs, skip: string[],
maxChars: number): string`. Imports: `cagePath` and the types from "./cagePath.js", `posix` from "node:path", types from
"./spendBudget.js". No other module.

**`src/scout/runScout.ts`** (PATCH): against main —

| where | main | P27 |
|---|---|---|
| `PROTOCOL` | 9 lines (1 161 chars) | the new `tests/fixtures/scout/protocol.txt` (9 lines, 1 341 chars, no final newline) |
| `REMINDER` | "One line per turn: …" | "One action line per turn: READ <path> [<from>-<to>], GREP <pattern> [-- <dir>] or LIST [<dir>]; to answer: ANSWER " + ANSWER_SHAPE + "." |
| `ScoutSession` | … maxTokens | + `historyText?: string` |
| system message | PROTOCOL | PROTOCOL + "\n" + budgetSentence(budgets) |
| round-0 user message | seed + LIST + Task | seed + LIST + "\n\n" + roundZero (when not "") + historyText (when not "") + "Task:\n" + question |
| a READ's `read` charge | every READ | only a file (caged path, or the path as written when refused) not read before |
| the user message after a charged turn | the delivered text | + notRun(skipped) when skipped + budgetLeft(budgets, new spent) (neither charged) |
| the close sentence | "… send ANSWER now, the JSON object last." | "… send ANSWER " + ANSWER_SHAPE + " now, the JSON object last." |
| final turn: malformed or rejected answer | no_answer / invalid_answer at once | first time: charged "", message afterClose(…), final again; second: invalid_answer "no answer: the answer after the budget closed was rejected twice: …" |

**`src/scout/scoutCommand.ts`** (PATCH): after `ref`, `historyText` from `runGit(root, ["log", "-n", "10",
"--format=%h %s"], env)`: exit 0 and stdout trimmed not "" → "Recent commits (newest first):\n" + it, else ""; passed
in the session. Nothing else changes (scout.json keys, refusals, ids).

### 2.3. Names and the tests each judge writes

Each judge PATCHES the existing test file (its current text follows in the card): the changed examples' tests get the
new values, the names stay; the new examples are appended in record order; every other test byte for byte.

| test file | change | examples |
|---|---|---|
| `tests/scout/parseTurn.examples.test.ts` | PATCH | 5 changed; 7, 8, 9 new ("Parse Turn example 7: …") |
| `tests/scout/runTool.examples.test.ts` | PATCH | 5 changed; 6 new |
| `tests/scout/sessionText.examples.test.ts` | NEW | 1–3 |
| `tests/scout/runScout.examples.test.ts` | PATCH | 1–5 changed (LIST counts, budget lines, system message); 6, 7, 8 new |
| `tests/scout/scoutCommand.examples.test.ts` | PATCH | 1 changed (system, round 0 with LIST counts and recent commits, budget line) |

### 2.4. What must not break

- Byte for byte: every file but the five code targets and the five test files above. Cage Path, Spend Budget, Seed
  From Ownership, Plan From Scout and their tests unchanged; `scout.json` keys unchanged (caps gain `readChars`).
- 950 tests in 157 files on main (measured with the old protocol fixture); after the run 950 + the new tests.

### 2.5. Language neutrality (operator, 10.10, after run 20261010-195534) — deck `decks/p27b`

The scout reads plain text and lines: no file-extension list, no keyword or comment rule of one language, no test-file
naming in `src/scout` (checked on the P27 code: none). Round zero's clues come from the task text by generic patterns
(CamelCase/camelCase, snake_case, quoted text, slash paths); greps run over every listed text file except the tool's own
`.morph`/`decks` (grepSkip) and binary files. Shown by two new examples on a tree in three languages, values measured with
the run's build: Run Tool example 7 (LIST line counts of `.py`, `.go`, `.ts`; GREP across them; READ of a Go file) and
Session Text example 4 (clues `load_config` from Python, `loadConfig` from Go/TS; hits in all three; 412 chars). The two
judges append them to their test files; no code card (the code is unchanged). The live smoke is on a Go project
(MorphStudio, four sessions).

## 3. Acceptance

Built by `morph plan --checks decks/p27/checks.json`. `ownGit: true`, `frozen` the defaults + `templates`, `fullExclude`
the five judge files.

- parse-turn: probe `decks/p27/parts/parse-turn.probe.ts` (Parse Turn 5, 7, 8, 9; 1–4, 6 green on main by design).
- run-tool: probe (Run Tool 5, 6; READ rows of 1 green on main).
- session-text: probe (Session Text 1–3).
- run-scout: probe (Run Scout 1, 2 (round 0 and REMINDER), 3, 4, 6, 7, 8).
- scout-command: probe (Scout Command 1).
- Judges: lits = example names and values of the new rows (checks.json).

## 4. Constraints

- NodeNext, `.js` imports, `import type`, no `any`. parseTurn.ts imports nothing. runTool.ts and sessionText.ts are
  pure (the fs parameter only). runScout.ts imports no node module; it imports from "./sessionText.js".
- Language-general: no Go, MorphStudio or fixture names in `src/`.
- Generations: parse-turn, run-tool, session-text (0); run-scout and the three judges of gen 0 (1); scout-command and
  run-scout-judge (2); scout-command-judge (3).
- Tests write only under `tmpRoot()` / `tmpRepo()` and remove them; no JS timer; no network; each judge writes only its file.

## 7. Out of scope

- An `outline` tool (issue #21 "Out of scope"); excluding `contour.yaml` from GREP by default; seed quality.
- Running every distinct action line of a turn (item 4's other option): the first runs, the rest are named — one
  Charge per round keeps Spend Budget and its tests unchanged.
- Charging round zero's characters against the budget (the old scout did): round 0 stays uncharged, as the LIST is.
- Item 7 restated as "pieces": reads count files; `DEFAULT_BUDGETS` unchanged.
- Repairing a JSON with unescaped quotes: it is malformed, and the correction after the close (item 2) asks again.
- The processor's habit of emitting its output twice: survived (repeated lines, first balanced object), not explained.
