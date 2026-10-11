# TASK_P25 — issue #18 generation 1: `morph.config.yaml` (`src/cli/projectConfig.ts`, `src/scout/runTool.ts`, `src/scout/scoutCommand.ts`, `src/cli/parse.ts`, `src/cli/types.ts`, `src/cli/main.ts`)

MorphV2 scheme (skill `morph-v2-orchestrator`). Record: Component cli compacted first (31 277 → 28 741 B; commit
ba4897a, with scout-session 30 025 → 28 909 B); then NEW Component config (Load Config, examples 1–4, Data Object
Project Config); cli — Parse Command (scout deadlineSeconds null when omitted; fixture `parse.json["17"]` changed),
Main (Read Project Config before every command, examples 19–20), Data Object Command; scout — Run Tool (grepSkip as
path prefixes, example 8), Tool Caps; scout-session — Scout Command (settings, example 6). The Components hold Functions
outside the phase: cut with `--only`, the deck is a transaction.

## 1. Why this

- P21b replay, 10.10 (scout 20261010-085052-9d7a0bfc): 9 GREP replies = 37 050 chars, 11 085 of them lines of
  `docs/TASK_*`; the session closed on its 120 000-char budget having named 1 of 6 targets. `grepSkip` matches the first
  path component only (`src/scout/runTool.ts:163-166`), so `docs/TASK_` cannot be skipped.
- Every scout budget, cap and seed count is a constant (`DEFAULT_BUDGETS`, `DEFAULT_TOOL_CAPS`, `SEED_FILES`,
  `SEED_CHARS`); a project cannot tune them. The operator approved one project file, `morph.config.yaml` (10.10).
- This phase's own scout (ds, 11.10): $0.0465, 29 rounds, 13 targets, ok.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main** (ba4897a): `src/contour/load.ts` — `parseDocument(text, name): {ok: true, doc} | {ok: false,
  error}` (YAML by the `.yaml` name; a non-mapping → "<name> is not a mapping at the top level"); `src/cli/document.ts` —
  `errorDocument(code, kind, message)`; `src/cli/types.ts` — `CommandResult {code, document}`, `ScoutArgs`;
  `src/scout/spendBudget.ts` — `DEFAULT_BUDGETS {calls 30, reads 12, chars 120000, rounds 40, deadlineMs 1800000}`,
  `ScoutBudgets`; `src/scout/runTool.ts` — `DEFAULT_TOOL_CAPS {readLines 400, readChars 12000, grepHits 200,
  grepLineChars 300, listEntries 300, grepSkip [".morph", "decks"]}`, `ToolCaps`; `src/scout/seedFromOwnership.ts` —
  `SEED_FILES` 6, `SEED_CHARS` 8000.
- **Config texts are YAML** parsed by `parseDocument(text, "morph.config.yaml")`. `[.morph/, decks/, docs/TASK_]` is a
  list of three strings; `{calls: x}` gives the string `"x"`; `{calls: "30"}` the string `"30"`.
- **Run Tool example 8**: one tmp dir, four files, one line each: `docs/TASK_X.md` "hit task\n", `docs/PLAN.md` "hit
  plan\n", `decks/a.json` "hit deck\n", `src/a.ts` "hit src\n"; files those four. Texts measured by a spike of the rule
  on the current code (tree without `docs/TASK_X.md`, and `-- docs`): the record's example 8 exactly.
- **Scout Command example 6**: the tree and the answers of example 1 (`tests/fixtures/scout/examples.json["Scout Command
  6"]`); with `readLines 1` the READ of src/b.ts is 106 chars (spike), so `spent {calls 1, reads 1, chars 106, rounds
  2}` and the budget line "Budget left: 4 calls, 3 file reads, 8894 chars, 5 rounds.". Each call in its own tmpRepo (the
  scout id is the same for the same now and question).
- **Main examples 19–20** (`tests/fixtures/cli/examples.json`): the harness of `tests/cli/main.p13b.examples.test.ts`
  (tmpRepo t, side root s with `task.txt` and `ans/scout.t1.md`, env `MORPH_PROCESSOR_s_TYPE` stub and
  `MORPH_PROCESSOR_s_ANSWERS_DIR`, `now: () => 1791500000000`, `cwd: s.root`, io pushing chunks). The record is read
  from `.morph/scout/<scoutId>/scout.json` under t, the id from the stdout document.

### 2.2. OUTPUT data shapes

**`src/cli/projectConfig.ts`** (NEW, layer cli): exports `CONFIG_FILE` = "morph.config.yaml", `ProjectConfig`
(`{version: 1; scout: ScoutSettings}`), `ConfigResult` (`{ok: true; config: ProjectConfig} | {ok: false; problems:
string[]}`), `DEFAULT_CONFIG` = `{version: 1, scout: DEFAULT_SCOUT_SETTINGS}`, `validateConfig(doc: unknown):
ConfigResult`, `loadConfig(text: string | null, name?: string): ConfigResult`, `readProjectConfig(root: string): {ok:
true; config: ProjectConfig} | {ok: false; result: CommandResult}`. Imports: `node:fs`, `node:path`, `parseDocument`
from "../contour/load.js", `errorDocument` from "./document.js", `CommandResult` type from "./types.js",
`DEFAULT_SCOUT_SETTINGS` and the type `ScoutSettings` from "../scout/scoutCommand.js".

| input | result |
|---|---|
| no file / blank text / `{}` / `version: 1` | `{ok: true, config: DEFAULT_CONFIG}` |
| a key given | its value, every other key the default; keys always in DEFAULT_CONFIG's order |
| problems | unknown keys first (object order), then the table order; message "`<path>: …`" (Load Config) |
| readProjectConfig, problems | `{code: 2, document: {error: {code: 2, kind: "DeckError", message: "morph.config.yaml is not a valid config (<n> problem|problems): " + "; "-joined}}}` |

**`src/scout/scoutCommand.ts`** (PATCH): `ScoutOptions.deadlineSeconds: number | null`; NEW exports `ScoutSettings`
(`{grepSkip: string[]; budgets: {calls; reads; chars; rounds; deadlineSeconds: number}; caps: {readLines; readChars;
grepHits; grepLineChars; listEntries: number}; seed: {files; chars: number}}`) and `DEFAULT_SCOUT_SETTINGS` (built from
DEFAULT_BUDGETS, DEFAULT_TOOL_CAPS, SEED_FILES, SEED_CHARS: `{grepSkip [".morph", "decks"], budgets {30, 12, 120000,
40, 1800}, caps {400, 12000, 200, 300, 300}, seed {6, 8000}}`); `scoutCommand(root, args, deps, settings =
DEFAULT_SCOUT_SETTINGS)`.

| where | main | P25 |
|---|---|---|
| seed | SEED_FILES, SEED_CHARS | settings.seed.files, settings.seed.chars |
| budgets | `{...DEFAULT_BUDGETS, deadlineMs: args.deadlineSeconds × 1000}` | `{calls, reads, chars, rounds` of settings.budgets`, deadlineMs: (args.deadlineSeconds ?? settings.budgets.deadlineSeconds) × 1000}` |
| caps | DEFAULT_TOOL_CAPS | `{...settings.caps, grepSkip: settings.grepSkip}` (keys readLines, readChars, grepHits, grepLineChars, listEntries, grepSkip) |

With the defaults the record (`budgets`, `caps`) is byte for byte what main writes.

**`src/scout/runTool.ts`** (PATCH, GREP only): an entry with no "/" is read as `<entry>/`; a file is skipped when it
starts with an entry; a GREP in a caged path `c` (not "") lifts each entry `e` with `(c + "/").startsWith(e)` or
`e.startsWith(c + "/")`. `DEFAULT_TOOL_CAPS` unchanged; READ and LIST unchanged.

| GREP | grepSkip | main | P25 |
|---|---|---|---|
| in "" | [".morph", "decks"] | .morph/…, decks/… skipped | the same |
| in "decks" or "decks/p1" | [".morph", "decks"] | nothing skipped | nothing skipped (".morph/" stays, matches nothing there) |
| in "" | [".morph/", "decks/", "docs/TASK_"] | ".morph/" names no first segment: nothing skipped | .morph/…, decks/…, docs/TASK_… skipped |
| in "docs" | the same | — | docs/TASK_… shown ("docs/" is under no entry, "docs/TASK_" starts with "docs/") |

**`src/cli/types.ts`, `src/cli/parse.ts`** (PATCH): `ScoutArgs.deadlineSeconds: number | null`; scout without
`--deadline` → `deadlineSeconds: null` (was 1800). Every other check, message, default and key unchanged; run keeps
2400.

**`src/cli/main.ts`** (PATCH): right after `root`, `const config = readProjectConfig(root)`; `!config.ok` → `result =
config.result` and no command runs (no git call, no write, no spend); else the dispatch as today with
`scoutCommand(root, command, deps, config.config.scout)`. The output lines unchanged.

### 2.3. Names and the tests each judge writes

| test file | change | examples |
|---|---|---|
| `tests/cli/projectConfig.examples.test.ts` | NEW | Load Config 1–4 ("Load Config example 1: …") |
| `tests/scout/runTool.examples.test.ts` | PATCH, append | Run Tool 8 |
| `tests/scout/scoutCommand.examples.test.ts` | PATCH, append | Scout Command 6 |
| `tests/cli/parse.examples.test.ts` | PATCH | Parse Command 17: the bare scout command's `deadlineSeconds: 1800` → `null`; nothing else |
| `tests/cli/main.p25.examples.test.ts` | NEW | Main 19, 20 |

### 2.4. What must not break

- Byte for byte: every file but the six code targets and the five test files above. With no `morph.config.yaml` every
  command behaves as on main; `tests/gate/identity.examples.test.ts` (5 pinned sha256) and
  `tests/scout/scoutCommand.examples.test.ts` examples 1–5 unchanged.
- 981 tests in 158 files on main (primer count); after the run 981 + the new tests.

## 3. Acceptance

Built by `morph plan --checks decks/p25/checks.json`. `ownGit: true`, `frozen` the defaults + `templates` +
`morph.config.yaml`, `fullExclude` the five judge files.

- load-config: probe (Load Config 1–4). run-tool: probe (Run Tool 8; example 4's rows green on main by design).
- scout-command: probe (Scout Command 6; example 1's record green by design). parse-command: probe (Parse Command 17).
- main: probe (Main 19, 20).
- Judges: lits = example names and values of the new rows (checks.json).
- After the run: `npm run build` and `node decks/tools/refcheck.mjs` exit 0 (the reference's §8 config block against
  dist's `loadConfig`/`DEFAULT_CONFIG`; `morph.config.yaml` and `templates/common/morph.config.yaml` valid).

## 4. Constraints

- NodeNext, `.js` imports, `import type`, no `any`. runTool.ts stays pure. projectConfig.ts is the only new file.
- Every card is in one generation with no dependsOn but the judges' on their code card: a code card reads no
  neighbour's target; the names it imports from a neighbour are §2.2's exactly.
- Tests write only under `tmpRoot()` / `tmpRepo()` and remove them; no JS timer; no network; each judge writes only its file.

## 7. Out of scope

- Generations 2–3 of the issue (primer, deckCheck, gate, run, planner, checks, languages sections): version 1 refuses
  those keys as unknown. The run's `--deadline` keeps its parse default 2400.
- The GREP `/…/` delimiter parse note (`src/scout/parseTurn.ts:150`) — a separate note.
- Round zero's skip (`src/scout/sessionText.ts` `roundZero`): it keeps the first-segment rule over `caps.grepSkip`, so an
  entry with a "/" (`docs/TASK_`) does not skip round zero's hits (≤ 20 per clue, ≤ chars/4) — a gap, named here.
- `GREP p -- docs/TASK_X.md`: Cage Path (dir) refuses a file path as before; the lift is shown with `-- docs`.
- Processor registry (MORPH_PROCESSOR_* env), the .morph layout, PROTOCOL text, DIFF_LCS_CAP, profile extensions.
