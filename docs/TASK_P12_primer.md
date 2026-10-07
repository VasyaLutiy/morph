# TASK_P12a — the V2 primer: `morph primer [--write]` (`src/primer/`, `src/cli/{types,parse,main}.ts`)

> Phase P12 of `docs/PLAN.md` ("Фазы по записи (после P2)"), split here: **P12a** (this spec: issue #1 whole) and **P12b**
> (ownership by trailers, §7). Labelled issue **#1** (`P12-primer`; its body and the operator's section "Operator 07.10:
> requirements for the P12 primer (demo experiment)" are binding; read 07.10 with `gh api repos/VasyaLutiy/morph/issues/1`).
> Components of `contour.yaml`: **primer** (the skeleton completed: Read Runs, Read Story, Render Primer, Primer Command —
> its own directory `src/primer/`, guard layer `primer` already declared) and `cli` (Parse Command, Main: the word
> `primer` routed; cli compacted first, no example's meaning changed). The deck is cut by V2 (`morph plan --checks
> decks/p12/checks.json`), filtered to this phase's 11 cards by `decks/p12/filter.py`. After its merge: the **smoke stop**
> (§8; the issue #1 experiment itself is the operator's).

## 1. Why this

- **The old primer crashes on this repository.** `mrph primer --root ~/MorphV2` exits 4 (07.10): its `RunReport.from_dict`
  reads `generations` as a list, and the 14 V2 archives hold an int. With the V2 runs hidden (a scratch copy) it prints
  4 198 chars that show **18 of 32 runs, 91 of 189 written cards, $1.5675 of $2.9560**, "backends: glm53 18", and
  "tests: npm, **0** test functions" against **641** vitest tests in 84 files (issue #1: one Python regex,
  `def test_*`).
- **The story does not come across.** The operator's experiment (issue #1): a fresh tool-less agent given that primer
  named the purpose and the first phases right, but not who builds the code now (V2 has cut and run its own phases since
  P10b1, on DeepSeek since P11b1), not the money and volume (half), not the start (old mrph on glm-5.3) and not what is next.
- **The data is all on disk**, none of it in one place: 32 archives in two report forms (18 mrph, 14 V2), 30 phase rows of
  `docs/MEASURE.md`, the plan's phase table, AUTONOMY's "State at handoff", 316 lines of DECISIONS. The reference primer of
  this spec prints them in **7 541 chars** with no model call and no network (§11).

**Ripple, measured** (the 4 new files, the 3 cli files and the 2 cli fixtures in a scratch worktree, full suite): **1 of
641** red — `parse.examples` "Parse Command example 8" (the no-command message now lists six commands; its literal and
`parse.json["8"]`). tsc and eslint clean; every other test green.

**Record sizes** (bytes of each Component block, the 30 000 rule), before → after: primer 251 (skeleton) → **25 170**;
cli 29 850 → **29 996** (compaction first: every folded `description`/`behavior` of cli re-wrapped at 160 columns, the parsed
record identical by `yaml.safe_load`: 29 850 → 29 266; then the routing, with 5 phrases shortened without a changed fact —
the Emit Document aside on stdout/stderr, the cli and Main descriptions, Read Deck File's description, the shebang word).

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **LanguageProfile** — `src/language/types.ts`; `PROFILES` (typescript first, python) — `src/language/profiles.ts`;
  `hasExtension(profile, path)`, `normalizePath(path)`, `profileForPath(path): LanguageProfile | null` —
  `src/language/paths.ts`; `gitOk(root, args, env): string` (throws `git <args[0]> failed (exit <code>): <first stderr
  line>`) — `src/git/run.ts`; **CliDeps, CliIo, Command, CommandResult** — `src/cli/types.ts`; `classifyThrown` —
  `src/cli/document.ts`. Every one exists on main.
- **Inside the phase**: `readRuns` (`src/primer/readRuns.ts`), `readStory` (`readStory.ts`) and `renderPrimer`
  (`renderPrimer.ts`) are written in generation 0 and depend on nothing of each other: renderPrimer declares its own input
  types (structurally the same as readRuns' and readStory's results — §2.2); `primerCommand` (`primerCommand.ts`) imports
  all three; `src/cli/main.ts` imports `primerCommand`.
- **Fixtures** (`tests/fixtures/primer/` unless named), each by the type the Function takes:

| file | type | what it is | what the Function returns on it |
|---|---|---|---|
| `runs/<dir>/report.json` (5 dirs) | text of ONE report.json each | real archives: `20261006-135524-8c114477` (mrph, P3 run 1: 8 cards, 1 written, 2 failed, 5 skipped, $0.0874), `20261007-092723-3c3f1c83` (mrph, 1 card), `20261007-111944` (V2 on glm53, 2 cards), `20261007-204822` (V2 on ds, 9 cards, 15 requests), `20261007-155108` (V2 on the batch route: the P11 smoke's report, cost null, model `z-ai/glm-5.3:batch`) | Read Runs 1 (four of them), 3 (155108 + 135524); Primer Command 3 (all five) |
| `runs.json` | ONE object | `"Read Runs 1"`, `"Read Runs 2"`, `"Read Runs 3"`: the whole Runs Digests | — (expected values) |
| `story/measure.md` | text of ONE file | the real `docs/MEASURE.md` cut to its title, the header (13 columns, the last `прогоны`), 16 phase rows (listed below the table) and the later table "модель …" | Read Story 1: 16 chronology lines, 3 rows with switches |
| `story/plan.md` | text of ONE file | the first plan's table (a `**P12** \| contour` row) and the last "фаза" table of `docs/PLAN.md` (P10b1, P10b2, P10c, P11, P11b, P11c, P12a, P12b, P13a, P14) | Read Story 1: next phase `P12a` |
| `story/autonomy.md` | text of ONE file | the title and the real "## State at handoff (07.10, after the P11b2 smoke)" section, then "## Machine" | Read Story 1: handoff = heading + 4 lines from "Resumed by the operator 07.10 … Next, in order:" |
| `story/decisions.md` | text of ONE file | a title and the last 9 lines of `docs/DECISIONS.md` | Read Story 1: the last 5, "- " removed, cut at 300 |
| `story/issues.json` | text of ONE JSON array | `gh issue list --state open --json number,title,labels` of 07.10: #6 (`P15-golang`), #1 (`P12-primer`), labels as objects | Read Story 1: issues read, 2 items |
| `story/runs.json` | ONE array of `{runId, models}` | the 32 archived runs of this repository, their ids and sorted models | Read Story 1's `runs` |
| `story.json` | ONE object | `"Read Story 1"`, `"Read Story 2"`: the whole Stories | — (expected values) |
| `render.json` | ONE object | `"digest 1"` (name MorphV2, generatedAt `2026-10-07T22:00:00.000Z`, files 701, tests typescript 84/641, runs = Read Runs 1's digest, story = Read Story 1's), `"digest 2"` (name `empty`, epoch, files 0, tests python 0/0, runs = Read Runs of `[{dir "x", report null}]`, story = Read Story 5's) | Render Primer 1–4 |
| `primer1.md`, `primer2.md` | text of ONE markdown each | Render Primer of digest 1 (5 952 chars) and digest 2, cap 16000 | — (expected texts) |
| `command.json` | ONE object | `"Primer Command 3"`: the Primer Document of example 3 without `root` and `markdown` | — (expected value) |
| `primer3.md`, `primer5.md` | text of ONE markdown each, with `{name}` for the tmp repo's base name | Primer Command 3's and 5's markdown | — (expected texts) |
| `cli/parseArgv.json`, `cli/parse.json` | ONE object each | key 16 added (6 argv); `parse.json["8"]` second result now names six commands | Parse Command 8, 16 |

(`story/measure.md`'s rows, exactly: P0, P5, P5 debt (fable), P7 smoke, P9c, P9 switch test, P10a, P10b1, P10b2, P10c1,
P11, P11 smoke, P11b1, P11c1, P11b2, P11b2 smoke — 16.)

**Distinct markers.** Run dirs `20261007-204822`, `20261007-092723-3c3f1c83`, `20261007-111944`,
`20261006-135524-8c114477`, `20261007-155108`, `x`, `y`, `z`, `w`, `e2e`, `20261108-010203`, `broken`; processors `ds`,
`glm53`, `glm53b`, `night`; models `z-ai/glm-5.3`, `z-ai/glm-5.3:batch`, `deepseek/deepseek-v4.1-flash`, `a/b`, `x/y`, `m/a`,
`m/b`, `m/c`; phases P0 … P11b2, `P1`, `P1 smoke`, `P2`, `P9`, `P7`, `P10a`, `P11b`, `P12`; clocks 1791400000000 and 0;
caps 16000, 600, 5952; names `MorphV2`, `empty`, the tmp repo's base name — the code must hard-code none of them (the
column names `фаза`, `строитель`, `карт…`, `$…`, `прогоны`, the heading `## State at handoff`, the file paths and the
cap 16000 of Primer Command are the contract).

**A judge's setup across Components** (TASK_TEMPLATE §2.1):

- **F1** git · `gitOk(root, args, env)` spawns `git` with env given whole: a test passes `{PATH: process.env.PATH ?? ""}`;
  untracked files are listed (`--others`), so a tmpRepo needs no commit beyond its first; in a directory that is not a
  repository it throws `git ls-files failed (exit 128): fatal: not a git repository …` · PC 1–5, Main 9.
- **F2** language · `profileForPath` claims `.ts`/`.tsx` for typescript and `.py`/`.pyi` for python; a test file needs the
  profile's extension AND `testFilePattern` on its base name (`^.*\.(test|spec)\.tsx?$`, `^(test_.*\.py|.*_test\.py)$`) ·
  PC 1, 2.
- **F3** helpers · `tmpRepo()` names its root `morph-repo-` + 6 characters (`fs.mkdtempSync`), so the markdown's first line
  and `chars` are fixed per run; Primer Command 3 and 5 compare with the fixture text after `split("{name}").join(path.
  basename(t.root))` · PC 3, 5.
- **F4** primer · `primerCommand` is synchronous; `readRuns` sorts the archives itself; `readStory` takes any `{runId,
  models}` rows (Read Runs' `runs` fit) · RS 1, PC 3.

**Harness skeleton** (≤ 10 lines, only from `tests/helpers.ts`; primerCommand and main tests):

```ts
const ENV = { PATH: process.env.PATH ?? "" };
const deps = (now: number): PrimerDeps => ({ env: ENV, now: () => now });
const named = (text: string, root: string): string => text.split("{name}").join(path.basename(root));
const STORY: Record<string, string> = { "docs/MEASURE.md": "story/measure.md", "docs/PLAN.md": "story/plan.md",
  "docs/AUTONOMY.md": "story/autonomy.md", "docs/DECISIONS.md": "story/decisions.md", ".morph/issues.json": "story/issues.json" };
const RUNS = ["20261006-135524-8c114477", "20261007-092723-3c3f1c83", "20261007-111944", "20261007-155108", "20261007-204822"];
// PC 3: const t = tmpRepo(); for (const [k, v] of Object.entries(STORY)) t.write(k, fixture("primer/" + v));
// for (const d of RUNS) t.write(".morph/runs/" + d + "/report.json", fixture("primer/runs/" + d + "/report.json"));
// then answers/a.v1.answer.txt "A", answers/lines.txt "L" under 20261007-204822, .morph/runs/broken/deck.json "[]", PC 1's 3 files
```

### 2.2. OUTPUT data shapes

**`src/primer/readRuns.ts`** (NEW, layer primer) — exports, in this order:

```ts
export interface RunArchive { dir: string; report: string | null; answers: number }
export interface RunSummary {
  runId: string; format: "v2" | "mrph"; date: string; processor: string; models: string[];
  cards: number; written: number; failed: number; skipped: number; requests: number; cost: number | null; answers: number;
}
export interface FormatTotals { runs: number; cards: number; written: number; cost: number }
export interface RunsTotals {
  runs: number; v2: FormatTotals; mrph: FormatTotals; cards: number; written: number; failed: number; skipped: number;
  requests: number; answers: number; cost: number; unpriced: number; models: { model: string; runs: number }[];
  from: string; to: string;
}
export interface RunsDigest { runs: RunSummary[]; skipped: { dir: string; reason: string }[]; totals: RunsTotals }
export function readRuns(archives: RunArchive[]): RunsDigest;
```

**Read Runs** — the record's behaviour; the points an executor gets wrong:

1. Sort a COPY of archives by `dir` (`<`/`>` code-unit order). Per archive the FIRST reason that applies: `report === null`
   → `{dir, reason: "no report.json"}`; `JSON.parse` throws, or the value is null, an array or not an object → `"report.json
   is not a JSON object"`; V2 form = `typeof runId === "string" && Array.isArray(outcomes)`; mrph form = `typeof deck_id ===
   "string"` and `outcomes` a non-null non-array object; else `"unknown report format"`.
2. V2: processor = `report.processor` (a string, else `""`); rows = `report.requests` when an array, else `[]`; requests =
   `usageTotals.requests` when a finite number, else `rows.length`; cost = `usageTotals.cost` when a finite number, else
   null (usageTotals not an object counts as `{}`). mrph: processor = `backend_label`; rows = `Object.values(report.usage)`
   when usage is a plain object, else `[]`; outcomes = `Object.values(report.outcomes)`; requests = `usage_totals.requests`,
   else `rows.length`; cost = `usage_totals.cost`, else null. `generations` is never read.
3. models = the distinct `model` strings of the rows that are objects, `.sort()`ed. cards = outcomes.length (any element);
   written/failed/skipped = the outcomes that are objects with `status` `"written"`/`"failed"`/`"skipped"`.
   date = `/^(\d{4})(\d{2})(\d{2})-/` on runId → `"YYYY-MM-DD"`, else `""`. Keys of a summary in the interface's order.
4. Totals (keys in the interface's order), every sum starting at 0 and adding in run order: `v2`/`mrph` = `{runs, cards,
   written, cost: Σ (cost ?? 0)}` of that form's runs; `cost` = Σ of the non-null costs (NOT v2.cost + mrph.cost: the
   floats are compared exactly); `unpriced` = runs with cost null; `models` = `{model, runs}` in order of first appearance
   walking the runs and each run's sorted models, `runs` = how many runs list it; `from`/`to` = the first/last run's date,
   `""` without runs.

| Read Runs example | given | result |
|---|---|---|
| 1 | 204822 (answers 15), 092723-3c3f1c83, 111944, 135524-8c114477 (answers 0), in this order | `runs.json["Read Runs 1"]`: runs 135524, 092723, 111944, 204822; v2 2 runs 10/11 $0.168…; mrph 2 runs 2/9; cards 20, written 12, failed 3, skipped 5, requests 32, answers 15, unpriced 0; models glm-5.3 ×3 then deepseek ×1 |
| 2 | x null; y `{`; z `[]`; w `{"runId": 5, …}`; e2e (2 outcomes, answers 2); 20261108-010203 (night, 4 rows, answers 3) | `runs.json["Read Runs 2"]`: 2 runs, 4 skipped in dir order (w, x, y, z), cost 0, unpriced 2, models a/b, x/y, from `2026-11-08`, to `""` |
| 3 | 155108 (batch route) and 135524 | `runs.json["Read Runs 3"]`: mrph run first, unpriced 1, models glm-5.3 then glm-5.3:batch |

**`src/primer/readStory.ts`** (NEW, layer primer) — exports, in this order:

```ts
export interface StoryTexts {
  measure: string | null; plan: string | null; autonomy: string | null; decisions: string | null; issues: string | null;
}
export interface StoryRun { runId: string; models: string[] }
export interface ChronologyLine {
  phase: string; date: string; builder: string; models: string[]; written: number | null; planned: number | null;
  runs: number; notes: string; cost: string; switches: string[];
}
export interface StoryIssue { number: number; title: string; labels: string[] }
export interface Story {
  chronology: ChronologyLine[];
  next: { phase: string | null; row: string | null; handoff: string[] };
  decisions: string[];
  issues: { state: "read" | "absent" | "unreadable"; items: StoryIssue[] };
  missing: string[];
}
export function readStory(texts: StoryTexts, runs: StoryRun[]): Story;
```

**Read Story** — the record's behaviour, with these exact rules:

1. **Tables.** Lines split on `"\n"`. A table starts at a line whose `trim()` starts with `|` when the NEXT line's `trim()`
   matches `/^\|?[\s:|-]*-[\s:|-]*$/`; its rows are the following lines whose `trim()` starts with `|` (the first other
   line ends it; scanning resumes after it). cells(line): `trim()`, drop one leading `|`, drop one trailing `|` unless it is
   `\|`, split on `/(?<!\\)\|/`, each piece trimmed and `\|` → `|`. `bare(s)` = s with every `**` removed, trimmed.
2. **Chronology** from the FIRST table of measure whose header cells (bare) include `фаза`. Column indexes by bare header:
   `фаза`; `строитель`; the first starting `карт`; the first starting `$`; `прогоны`; a missing column (or row cell) reads
   `""`. Per row, keys in the interface's order: `phase` = bare; `builder` = bare, then cut before its first `" ("`,
   trimmed; on the trimmed cards cell `/^(\d+)\s*\/\s*(\d+)/` → `planned` = group 1, `written` = group 2 (numbers), else
   both null; `notes` = when the cards cell holds `(`: the text after its first `(` up to its last `)` if that `)` comes
   after it, else to the end, trimmed, longer than 100 → `slice(0, 99) + "…"`; else `""`; `cost` = the first
   `/\d+(?:\.\d+)?/` match of the cost cell, else `""`; ids = every `/\d{8}-\d{6}(?:-[0-9a-f]{8})?/g` match of the runs cell;
   `runs` = ids.length; `date` = the first id's first 8 digits as `YYYY-MM-DD`, else `""`; `models` = for each id, the
   FIRST `runs` element with that runId, each of its models not yet listed, in order.
3. **Switches.** A main row's phase matches `/^P\d+[a-z0-9]*$/` (`P5 debt (fable)`, `P7 smoke`, `P9 switch test`, `P11 fix 1`
   are side rows: `switches: []`, and they do not move the comparison). For a main row after an earlier main row: first
   `"builder <prev> → <this>"` when the builders differ (prev = the previous main row's builder); then `"model <a> → <b>"`
   when this row's models are not empty, an earlier main row had non-empty models, and `models.join(", ")` differs from the
   last non-empty one's join (a = that join, b = this one's). The first main row has no switches.
4. **Next.** From the LAST table of plan whose header cells (bare) include `фаза`; the phase column is that header's index.
   Done phases = the main phases of the chronology. The first row whose bare phase p is not done → `phase` = p, `row` =
   the row's first three cells, each bare, joined `" · "`, longer than 300 → `slice(0, 299) + "…"`. p is done when some
   done m: `m === p`; or `m.startsWith(p)` and the rest `/^[a-z]/`; or p ends with a letter (`/[a-z]$/`) and the rest is
   `/^[0-9]+$/`. No plan, no table, every row done → `phase: null, row: null`.
5. **Handoff.** The first autonomy line that `startsWith("## State at handoff")`: its `slice(3).trim()`, then the section's
   non-empty lines (trimmed) up to the next line starting `"## "`; from the first of them matching `/\bNext\b/` (else from the
   first) take up to 4; every element longer than 200 → `slice(0, 199) + "…"`. None → `[]`.
6. **Decisions.** decisions split on `"\n"`, each `trim()`ed, empty ones dropped, the last 5 (fewer → all), a leading `"- "`
   removed, longer than 300 → `slice(0, 299) + "…"`. null → `[]`.
7. **Issues.** null → `{state: "absent", items: []}`; JSON.parse throws or not an array → `{state: "unreadable", items: []}`;
   else `"read"` and, in order, every element that is a non-null non-array object with `Number.isInteger(number)` and a
   string `title` → `{number, title, labels}`: labels = for each element of `labels` (when an array) a string as is, or an
   object's string `name`; anything else skipped.
8. `missing` = `["measure", "plan", "autonomy", "decisions"]` filtered to the null texts. Story keys: chronology, next
   {phase, row, handoff}, decisions, issues {state, items}, missing.

| Read Story example | given | result |
|---|---|---|
| 1 | the five story fixtures, runs = `story/runs.json` | `story.json["Read Story 1"]` (16 lines; switches on P10a, P10b1, P11b1 only; next P12a; handoff 5; decisions 5; issues #6, #1) |
| 2 | the reordered measure of the record (`$ исп.`, `прогоны`, `фаза`, x, `**строитель**`, `карт план/принято`; an escaped `\|`; a second table) and 3 runs; the rest null | `story.json["Read Story 2"]` = the record's literal |
| 3 | plan rows P1, P10a, P11b, P12; measure P10a, P11b1, P12 smoke → then P1, P10a, P11b1 → then + P12a; autonomy with and without a Next line | `P1 · a · x`; `P12 · d · w`; null; handoff `["State at handoff (x)", "Next: P12", "line 4", "line 5", "line 6"]`; `["State at handoff", "a", "b"]` |
| 4 | decisions with blanks and a 312-char last line; issues `{`; then 3 elements | `["c", "d", "e", "f", 299 g + "…"]`; unreadable; read [#3 x y, #5] |
| 5 | all null, runs [] | the empty Story, missing all four |

**`src/primer/renderPrimer.ts`** (NEW, layer primer; imports nothing of src/primer) — exports, in this order:

```ts
export interface DigestTotals {
  runs: number; v2: { runs: number; cards: number; written: number; cost: number };
  mrph: { runs: number; cards: number; written: number; cost: number };
  cards: number; written: number; failed: number; skipped: number; requests: number; answers: number; cost: number;
  unpriced: number; models: { model: string; runs: number }[]; from: string; to: string;
}
export interface DigestLine {
  phase: string; date: string; builder: string; models: string[]; written: number | null; planned: number | null;
  runs: number; notes: string; cost: string; switches: string[];
}
export interface DigestStory {
  chronology: DigestLine[];
  next: { phase: string | null; row: string | null; handoff: string[] };
  decisions: string[];
  issues: { state: "read" | "absent" | "unreadable"; items: { number: number; title: string; labels: string[] }[] };
  missing: string[];
}
export interface PrimerDigest {
  name: string; generatedAt: string; files: number;
  tests: { language: string; files: number; tests: number };
  runs: { skipped: { dir: string; reason: string }[]; totals: DigestTotals };
  story: DigestStory;
}
export function renderPrimer(digest: PrimerDigest, cap: number): string;
```

**Render Primer** — the record's behaviour is the format, line by line; `primer1.md` and `primer2.md` are its two whole
illustrations (every section in both its forms). Points: `·` is U+00B7 with a space each side, `→` U+2192, `←` U+2190, `—`
U+2014, `…` U+2026; "run" when the count is 1, else "runs" (models and chronology); a chronology line omits ` · <notes>`
when notes is `""` and ` ← switch: …` when switches is empty; `written === null` prints `—` in place of
`<written>/<planned> written`; every `$` amount of the Runs section is `toFixed(4)`, the chronology's cost is printed as
read (`$0.0343`, `$—` when `""`); "skipped" lines follow the Runs lines (also after "- archived runs: 0"). The cut: when
`md.length > cap`: `head = md.slice(0, cap - 60)`; result `head.slice(0, head.lastIndexOf("\n") + 1) + "_… truncated to fit
<cap> chars_\n"`.

| Render Primer example | given | result |
|---|---|---|
| 1 | digest 1, cap 16000 | exactly `primer1.md` (5 952 chars) |
| 2 | digest 2, cap 16000 | exactly `primer2.md` |
| 3 | digest 1, cap 600; cap 5952 | 511 chars ending `"_… truncated to fit 600 chars_\n"`, a prefix of primer1.md before it; exactly primer1.md |
| 4 | digest 2 with issues read [] / unreadable; with next and decisions set | last line `- none open`; `- not read: .morph/issues.json is not a JSON array`; the four lines of the record |

**`src/primer/primerCommand.ts`** (NEW, layer primer) — imports gitOk (`../git/run.js`), PROFILES, hasExtension,
normalizePath, profileForPath and LanguageProfile (`../language/…`), readRuns, readStory, renderPrimer and their types
(`./…`); `node:fs`, `node:path`. Exports, in this order:

```ts
export interface PrimerDeps { env: Record<string, string>; now: () => number }
export interface TestCount { language: string; files: number; tests: number }
export interface PrimerDocument {
  root: string; generatedAt: string; files: number; tests: TestCount; runs: RunsTotals; skipped: number;
  chronology: number; next: string | null; missing: string[]; issues: "read" | "absent" | "unreadable";
  chars: number; written: string | null; markdown: string;
}
export interface PrimerResult { code: 0 | 1 | 2 | 3 | 4; document: PrimerDocument }
export const PRIMER_CAP = 16000;
export const PRIMER_FILE = ".morph/primer.md";
export function isTestFile(profile: LanguageProfile, file: string): boolean;
export function countTests(profile: LanguageProfile, files: { path: string; text: string }[]): TestCount;
export function pickProfile(files: string[]): LanguageProfile;
export function primerCommand(root: string, write: boolean, deps: PrimerDeps): PrimerResult;
```

**Primer Command** — the record's steps 1–7, with: the listing `gitOk(root, ["ls-files", "-z", "--cached", "--others",
"--exclude-standard"], deps.env)` (git sorts it; keep its order, drop `""` and repeats); `pickProfile`: per PROFILES entry
the count of files whose `profileForPath(f)?.id` is its id, the first strictly greater count wins, so a tie and an empty
listing give `PROFILES[0]`; `isTestFile` = `hasExtension(profile, file) && new RegExp(profile.testFilePattern).test(<the
last "/"-piece of normalizePath(file)>)`; `countTests` counts with `text.match(<rule>)` per test file (`/(?<![\w.$])(?:test|
it)\s*\(/g` for typescript, `/^[ \t]*(?:async[ \t]+)?def[ \t]+test_\w+/gm` for python), files = the test files given;
archives: `fs.readdirSync(<root>/.morph/runs).sort()`, directories only; a text is read only from a regular file (else
null); generatedAt `new Date(deps.now()).toISOString()` — the ONE `Date` of src/primer (guard: `CLOCK_FORMATTERS`);
the digest `{name: path.basename(root), generatedAt, files: files.length, tests, runs: <the whole Runs Digest>, story}`;
cap `PRIMER_CAP`; write → `fs.mkdirSync(<root>/.morph, {recursive: true})`, `fs.writeFileSync(<root>/.morph/primer.md,
markdown)`, written `PRIMER_FILE`. Document keys in the interface's order; code 0. A git failure is thrown, not caught
(Main classifies it: exit 3).

| Primer Command example | given | result |
|---|---|---|
| 1 | tmpRepo: tests/a.test.ts (2 `test(`), tests/b.spec.ts (1 `it(`, `it.skip(`, `test.todo(`, `/x/.test(`), src/c.ts (`test(` in code); write false; now 1791400000000 | tests `{typescript, 2, 3}`; files 3; generatedAt `2026-10-07T19:06:40.000Z`; written null; countTests on the 3 files the same |
| 2 | tmpRepo: pkg/a.py, pkg/b.py, tests/test_a.py, pkg/b_test.py, web/x.ts | tests `{python, 2, 3}`; files 5 |
| 3 | the §2.1 skeleton's repo, write true | `command.json["Primer Command 3"]` + root t + markdown = named(primer3.md) = .morph/primer.md |
| 4 | example 1, write false; a tmpRoot (no repository) | no .morph/primer.md; thrown, message begins `git ls-files failed (exit 128): ` |
| 5 | an empty tmpRepo, now 0, write false | files 0, typescript 0/0, runs 0, missing all four, issues absent, markdown = named(primer5.md) |

**`src/cli/types.ts`** — added, Command widened; nothing else changes:

```ts
export interface PrimerArgs { name: "primer"; root: string; pretty: boolean; write: boolean }
export type Command = DeckCheckArgs | RunArgs | PlanArgs | SubmitArgs | CollectArgs | PrimerArgs;
```

**Parse Command** (`parse.ts`) — `--write` takes no value (beside `--pretty`, `--judge`); `primer` is no longer a NotYet
word (scout, review, report stay); the word `primer` (arity 1); its flags `--root, --pretty, --write` (else `flag <f> does
not apply to primer`; `--write` on any other command → `flag --write does not apply to <command>`); the no-command message
`no command (commands: deck check, plan, run, submit, collect, primer)`. After collect's checks and before `missing
--deck`: primer is done → `{name: "primer", root, pretty, write: --write given}` (keys in this order). Deck check, run, plan,
submit, collect: every check, message, default and key unchanged.

| Parse Command example | argv | result |
|---|---|---|
| 8 (changed) | `[]` (second argv) | `no command (commands: deck check, plan, run, submit, collect, primer)` |
| 16 | `primer`; `primer --write --root /r --pretty`; `primer --deck d.json`; `primer x`; `deck check --deck d.json --write`; `--write primer --write` | `{name: "primer", root: ".", pretty: false, write: false}`; `{…, root: "/r", pretty: true, write: true}`; `flag --deck does not apply to primer`; `unexpected argument: x`; `flag --write does not apply to deck check`; `flag --write given twice` |

**Main** (`main.ts`) — one routing line before the run branch: `command.name === "primer"` → `result = primerCommand(root,
command.write, {env: deps.env, now: deps.now})` (import from `../primer/primerCommand.js`); the stdout document and the
stderr line `morph primer: exit <code>\n` as for every command; a throw → classifyThrown (3). src/cli.ts unchanged. Main 9:
a tmpRepo with tests/a.test.ts `test("a", () => {});\nit("b", () => {});\n`, `["primer", "--write", "--root", t]`, deps
`{env: {PATH}, now: () => 1791400000000, cwd: "/", transport: null}` → 0, one document with tests `{language:
"typescript", files: 1, tests: 2}`, written `.morph/primer.md`, markdown = that file's text; stderr `["morph primer: exit
0\n"]`; then `["primer", "--root", <a tmpRoot>]` → 3, `{error: {code: 3, kind: "RuntimeError", message}}` with message
beginning `git ls-files failed (exit 128): `, stderr `["morph primer: exit 3\n"]`.

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P12 primer"):

- **#1 item 1 (archives)**: both report forms told apart by their keys (V2 `runId` + array `outcomes`; mrph `deck_id` +
  object `outcomes`), every field read tolerantly, `generations` never read; a broken or foreign report is listed as
  skipped with its reason, never thrown; totals over both forms plus a per-form split; the cost sum skips nulls and
  `unpriced` counts them (the batch route reports null).
- **#1 item 2 (chronology)**: one line per row of the MEASURE table (side rows too — smokes, the debt row), the phase
  joined to the archives by the run ids of a NEW last column `прогоны` (data, added 07.10 for all 30 rows; the session adds
  it to every new row); the processor model from the archived requests, not from the trailers (mrph trailers carry the
  label `glm53`, not the model); the builder is MEASURE's column up to its first parenthesis; switch points marked only
  between main phases, so smokes do not flip the story.
- **#1 item 3 (what is next)**: the first row of the LAST plan table not done by a MEASURE main phase (the first plan's
  table carries the old numbering: `**P12** contour`); the PLAN row P12 is replaced by P12a and P12b (data) so the open
  row moves when P12a is recorded; the handoff quoted from the line holding "Next" (5 lines with its heading).
- **#1 item 4 (decisions, issues)**: the last 5 non-empty DECISIONS lines; open issues from `.morph/issues.json` written by
  the session (`gh issue list --state open --json number,title,labels`), else "not read" with the command to write it —
  the primer makes no network call (Deterministic Core; the guard's layer primer has no NET).
- **#1 item 5 (tests by profile)**: the profile is the PROFILES entry claiming most files of the listing; test files are
  the profile's extension + `testFilePattern` on the base name (test directories alone do not count: `tests/helpers.ts`,
  `tests/setup.ts`); the call rule per profile id lives in primer (typescript `test(`/`it(` not after `.`, a word char or
  `$`; python `def test_*`), not as a new Language Profile key — that would re-cut language (16-key profiles pinned
  byte-equal to two fixtures by 25 examples) for one regex. On this repository: 641 in 84 files = vitest's 641.
- **Command**: `morph primer [--root] [--pretty] [--write]`; `--write` is a no-value flag writing `.morph/primer.md` under
  root (the old `--write [PATH]` optional value has no form in V2's parser: every value flag takes the next token); the
  stdout document carries the markdown (≤ 16 000 chars) and the counts; exit 0, or 3 when git fails (not a repository).
- **Where the logic lives**: Component primer (`src/primer/`), cli only routes (PLAN 07.10); renderPrimer declares its
  own input types so the three readers are one generation; primerCommand is the only file of src/primer that reads files,
  spawns (through git's gitOk) or formats the clock (guard: primer joins NO_CLOCK and NO_ENV, `CLOCK_FORMATTERS`
  names primerCommand.ts).
- **Split**: P12a = issue #1 whole + the command (11 cards); P12b = ownership by trailers (`%(trailers)`, path → cards,
  model, run, most recent first) — the PLAN row's "владение по трейлерам", which no item of #1 needs and the scout's seed
  (P13a) does; the smoke stop follows P12a (it tests #1).

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/primer/readRuns.ts` | NEW | probe only | NEW `tests/primer/readRuns.examples.test.ts` (RR 1–3) |
| `src/primer/readStory.ts` | NEW | probe only | NEW `tests/primer/readStory.examples.test.ts` (RS 1–5) |
| `src/primer/renderPrimer.ts` | NEW | probe only | NEW `tests/primer/renderPrimer.examples.test.ts` (RP 1–4) |
| `src/primer/primerCommand.ts` | NEW | probe only | NEW `tests/primer/primerCommand.examples.test.ts` (PC 1–5) |
| `src/cli/types.ts`, `parse.ts`, `main.ts` | PrimerArgs; grammar; routing | probe only | PATCH `tests/cli/parse.examples.test.ts` (PC 8 literal; PC 16 added); NEW `tests/cli/main.p12.examples.test.ts` (Main 9) |

- `readRuns.examples`: "Read Runs example 1: …" … "3: …", each `toStrictEqual(fixtureJson("primer/runs.json")[…])`, the
  archives built from `fixture("primer/runs/<dir>/report.json")`.
- `readStory.examples`: "Read Story example 1: …" … "5: …"; 1 and 2 against `story.json`, 3–5 against the record's literals.
- `renderPrimer.examples`: "Render Primer example 1: …" … "4: …"; digests from `render.json`, texts from `primer1.md`,
  `primer2.md` with `toBe`.
- `primerCommand.examples`: "Primer Command example 1: …" … "5: …", from the §2.1 skeleton; every tmp repo removed in finally.
- `parse.examples` (21 tests → 22): example 8's no-command literal changed; "Parse Command example 16: …" after the last test,
  `argv["16"].map(parseCommand)` `toStrictEqual` `parse.json["16"]`.
- `main.p12`: "Main example 9: …" (in process, an io pushing chunks, stdout parsed per chunk).

### 2.4. What must not break

- Byte for byte: every file outside the 7 code targets and the 6 test files of §2.3; `src/git/*`, `src/language/*`,
  `src/batches/*`, `src/cli/{runCommand,document,deckCheck,planCommand,readPlanChecks}.ts`, `src/cli.ts`, `tests/helpers.ts`.
- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/`, `.gitignore` — untouched by every card.
- 640 tests stay green at every card (`parse.examples` in `fullExclude` until its judge); after the run **641 + 3 + 5 + 4 + 5
  + 1 + 1 = 660** in 89 files (the reference judges: §11).

## 3. Acceptance

Built by `morph plan --checks decks/p12/checks.json`, narrow to broad, every stage printing `== <stage>`. `ownGit: true`
(the primer and main tests spawn git in tmp repos). `fullExclude`: `tests/cli/parse.examples.test.ts` (ripple 1, red from
parse-command to its judge).

Code cards (no test file, code-only targets, no smoke cap): `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs src
<targets>` → `decks/p12/parts/<card>.probe.ts` (read-runs RR 1–3 + 2 rows = 5; read-story RS 1–5 + 2 = 7; render-primer RP
1–4 + 1 = 5; primer-command PC 1–5 + 1 = 6; parse-command PC 8, 16, Main 9 + 1 = 4; **27 tests**) → eslint's verdict →
full `vitest run` minus fullExclude → own git → frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs tests <file> <min> <max> lits<n>.json` → (patched)
every test name at HEAD still there → `vitest run <targets>` → eslint's verdict → full run → own git → frozen → untracked.

| file | new | min | max | lits |
|---|---|---|---|---|
| `tests/primer/readRuns.examples.test.ts` | yes | 3 | 9 | `Read Runs example 1` … `3`, `runs.json`, `unknown report format`, `20261007-155108` |
| `tests/primer/readStory.examples.test.ts` | yes | 5 | 11 | `Read Story example 1` … `5`, `story.json`, `20261101-100000-0123abcd`, `Next: P12`, `unreadable` |
| `tests/primer/renderPrimer.examples.test.ts` | yes | 4 | 10 | `Render Primer example 1` … `4`, `primer1.md`, `primer2.md`, `truncated to fit 600 chars`, `- none open` |
| `tests/primer/primerCommand.examples.test.ts` | yes | 5 | 11 | `Primer Command example 1` … `5`, `command.json`, `primer3.md`, `primer5.md`, `git ls-files failed (exit 128): `, `async def test_y` |
| `tests/cli/parse.examples.test.ts` | no | 22 | 24 | `Parse Command example 16`, `submit, collect, primer)` |
| `tests/cli/main.p12.examples.test.ts` | yes | 1 | 7 | `Main example 9`, `morph primer: exit 0`, `git ls-files failed (exit 128): ` |

min = the file's tests after the change (new files: its record examples); max = min + 2 (patched) or + 6 (new).

**Output budget** (`max_tokens`, before the session's ×3 for `ds`): code = targets in tokens (≈ bytes / 3.5) × 2 + 2 500,
floor 8 000; judges from the file they return.

| card | returns | `max_tokens` |
|---|---|---|
| read-runs | readRuns.ts ≈ 4.8 KB | 8 000 |
| read-story | readStory.ts ≈ 7.3 KB | 10 000 |
| render-primer | renderPrimer.ts ≈ 4.8 KB | 8 000 |
| primer-command | primerCommand.ts ≈ 4.7 KB | 8 000 |
| parse-command | parse.ts ≈ 9.5 KB + types.ts 2.3 KB + main.ts 2.2 KB | 12 000 |
| read-story-judge, primer-command-judge (most examples, 5) | ≈ 6–8 KB new file | 20 000 |
| parse-command-judge | parse.examples.test.ts ≈ 10.4 KB, whole | 20 000 |
| read-runs-judge, render-primer-judge | ≈ 3–4 KB new file | 14 000 |
| main-judge | ≈ 2 KB new file | 12 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- Layer primer (guard): imports cards, git, store, language; `node:fs`, `node:path`; no `process`, no global `fetch`, no
  `child_process` (git's gitOk spawns), no `Date` except in `src/primer/primerCommand.ts` (it formats `deps.now()`), no
  `Math.random`. readRuns.ts, readStory.ts, renderPrimer.ts import no Node module at all (pure: what they are given).
- cli may import every layer; only src/cli.ts touches the process (unchanged).
- A file a card writes is in no sibling's slice in the same generation: generation 0 (read-runs, read-story, render-primer
  write the three readers) — none reads another; generation 1 (primer-command writes primerCommand.ts) — the three judges
  do not read it; generation 2 (parse-command writes `src/cli/{types,parse,main}.ts`) — primer-command-judge reads none of
  them.
- Tests write only under `tmpRoot()`/`tmpRepo()` and remove it in `finally`; no timer; a judge writes only its test file.
- Exact strings of the record and §2.2: the executor copies them.

## 7. Out of scope

- **P12b** (next phase, before P13a): ownership by trailers — `git log --format=%(trailers)` of the Morph-Card commits →
  per path the cards, model and run, most recent first, capped with "… N more"; the "## File ownership" section; the
  count of Morph commits by model (the old primer's "git carries N Morph commits"). The scout's seed (P13a) reads it.
- Hot files, the edit envelope, an accepted card verbatim, "what burned cards" (the old primer's other sections): not
  needed by #1; a later phase if a session asks.
- Fetching issues over the network (`gh` from the primer): the session writes `.morph/issues.json` (§8).
- `--write <PATH>`: the file is always `.morph/primer.md` under root.
- A MEASURE without the `прогоны` column reads (dates `—`, models `—`, no model switches); back-filling other
  repositories' MEASURE is theirs.

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component primer --component cli \
  --judge --checks decks/p12/checks.json --out decks/p12/deck.json
python3 decks/p12/filter.py decks/p12/deck.json                 # keeps the 11 cards of the phase
node dist/cli.js deck check --root . --deck decks/p12/deck.json                                  # errors 0
python3 decks/tools/scale_tokens.py decks/p12/deck.json 3       # the session, for processor ds
rm -rf /tmp/v2bin-p12 && mkdir -p /tmp/v2bin-p12 && cp -r dist /tmp/v2bin-p12/ && ln -s $PWD/node_modules /tmp/v2bin-p12/node_modules
node /tmp/v2bin-p12/dist/cli.js run --root . --deck decks/p12/deck.json --processor ds --deadline 2400
```

Cross-check (dry): from `morph-lab`, `venv/bin/mrph plan --spec <repo>/contour.yaml --map <repo>/morph-map.json
--component primer --component cli --judge --root <repo>`.

**Smoke after the merge (the session; $0, no model call).** On `main` after the P12a merge, `npm run build`, the binary
copied to `/tmp/v2bin-smoke12/` (node_modules linked):

1. `gh issue list --repo VasyaLutiy/morph --state open --json number,title,labels > .morph/issues.json` (ignored by
   `.morph/*`), then `node /tmp/v2bin-smoke12/dist/cli.js primer --root . --write > /tmp/p12-smoke.json; echo $?` → exit 0;
   the output file `.morph/primer.md` (and the document in `/tmp/p12-smoke.json`, `written` ".morph/primer.md").
2. Check: no crash on the 32 + 1 archives of both forms (`skipped` 0); `tests` `{language: "typescript", files ≥ 89,
   tests ≥ 660}` (> 600); Runs: 33 runs (V2 15, mrph 18), cards and `$` over both (≈ $3.0 + the P12a run); the chronology
   has the P12a row (the session adds it, with its run id, before the smoke) and the three switch marks (P10a, P10b1, P11b1
   with the model z-ai/glm-5.3 → deepseek/deepseek-v4.1-flash); "next phase (docs/PLAN.md): P12b · primer · …"; the
   handoff quotes the session's new "State at handoff"; 5 decisions; issues read; `chars` ≤ 16 000.
3. Record a MEASURE row "P12a smoke" (exit, chars, the Runs and next lines), copy `.morph/primer.md` to
   `decks/p12/smoke/primer.md` for the operator's experiment (#1), 🧪, stop.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 11 (5 code, 6 judges) / 4: [read-runs, read-story, render-primer] [primer-command, read-runs-judge, read-story-judge, render-primer-judge] [parse-command, primer-command-judge] [main-judge, parse-command-judge] |
| executor bill | ≈ $0.08–0.14 on ds ×3 (P11b2: 9 cards, 15 requests, $0.1183; here 11 cards, 15 first requests), ≤ $0.30 with a re-cut; cap $5 |
| cards with regeneration | 2–4 of 11 (read-story: the escaped-pipe split, "done" phases, the Next window; render-primer: a "run"/"runs" plural or a `$` format; read-runs: totals.cost summed per form; primer-command-judge: the `{name}` replacement) |
| tests after the run | 660 ± 3 in 89 files |
| first red | read-story: the table selected by its first header cell; render-primer: one character of a separator; primer-command: `tests/helpers.ts` counted as a test file |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no judge cut off at its `max_tokens`; (3) the V2 cut equals
the old mrph's dry cut in ids, dependsOn, generations, targets, slices and max_tokens; (4) after the run no test file outside
§2.3's six changed; (5) the merged binary's primer on this repository exits 0 and names 641+ tests by the typescript profile.

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the MEASURE row with
its `прогоны` cell; DECISIONS lines "P12 primer"; then the smoke row and its stop.

## 11. Actual

### Gate (preparation)

_Filled at the gate._
