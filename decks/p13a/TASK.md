# TASK_P13a — scout protocol, path cage, tools, budgets, seed (`src/scout/{parseTurn,cagePath,runTool,spendBudget,seedFromOwnership}.ts`)

> Phase P13a of `docs/PLAN.md` ("Фазы по записи (после P2)": `P13a | scout | протокол READ/GREP/LIST/ANSWER, клетка путей
> (realpath, symlink), бюджеты → stop_reason, seed из primer`). Component **scout** of `contour.yaml`, until now a one-line
> skeleton, gets its first five Functions: Parse Turn, Cage Path, Run Tool, Spend Budget, Seed From Ownership — the pure
> pieces of a recon session, deterministic and testable without a model, a clock or the network. The round loop,
> `scout/<id>/scout.json`, the real file system adapter and `plan --from-scout` are P13b (§7). The deck is cut by V2 (`morph
> plan --component scout --checks decks/p13a/checks.json`); the cut is exactly the phase's 10 cards (`decks/p13a/filter.py`
> asserts it). cli is untouched (29 996 bytes; `scout` is already a known command name in `src/cli/parse.ts`, routed in P13b).

## 1. Why this

- **V2 has no scout.** The old Morph's scout is 2 148 lines of Python (`cards/scout.py` 865, `scout_explorer.py` 868,
  `scout_round0.py` 261, `scout_seed.py` 154) on native tool calls through OpenRouter and `git grep` at a ref; V2 has
  only the cli name `scout`. P13a writes the parts that need no model: what a turn means, what a path may touch, what a
  tool answers, what a turn costs, where the session starts.
- **The old scout's measured losses are the contract here.** (a) The grep dialect: basic `git grep` read `a|b` literally —
  5 of 22 requests of one session, 4 of 14 of another, burned on empty answers that read as "not in this project" → V2's
  GREP is a JavaScript RegExp, alternation as written. (b) One whole read of 82 807 chars spent 69 % of a 120 000-char
  budget → READ takes line ranges and a line cap, and says which range comes next. (c) After the budget closed a model kept
  calling tools for 16 refused rounds until the 1 800 s deadline (2 of 9 sessions lost) → the budget names the closed
  budget, and only calls/reads/chars grant one final answer-only turn (`FINAL_TURN`). (d) One grep for a word spent 60 000
  chars on archived decks (`.morph/runs/*/deck.json`, `decks/*.json`, lines thousands of chars long) → GREP skips `.morph`
  and `decks` unless the path names them, and clips each hit line.
- **The seed exists now.** P12b gave `readOwnership(readMorphLog(root, env))`: on this repository **208** Morph-Card
  commits writing **173** paths (HEAD 81cbb97). The reference seed of this phase on it (limit 6, cap 8 000): 6 code files,
  newest first — `src/primer/primerCommand.ts`, `src/primer/renderPrimer.ts`, `src/git/ownership.ts`, `src/git/log.ts`,
  `src/cli/main.ts`, `src/cli/parse.ts` — rendered in **1 083** chars; the listing has 796 files.
- **The cage is new.** The old scout read committed blobs at a ref, so a symlink could not leave the repository; V2's
  tools read the working tree through an injected file system, so the cage resolves each file with realpath against the
  root's realpath (a symlink out of the root, a symlink into `.git`, a dangling link) and admits only paths of the tree's
  listing (ignored files are not in it).

**Ripple, measured** (the 5 reference files in a scratch worktree, full suite): **0 of 667** red — every target is a new
file, nothing in the tree imports `src/scout/`. tsc, eslint and the guard (with the P13a layer rules) clean.

**Record size** (bytes of the Component block, the 30 000 rule): scout 316 (skeleton) → **23 318**. cli, primer, git and
every other Component untouched; Requirement Deterministic Core gains the P13a sentence.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main**: `profileForPath(path): LanguageProfile | null` and `isTest(profile, path): boolean` —
  `src/language/paths.ts` (a test is under one of the profile's `testDirs` or matches its `testFilePattern`); git's
  `Ownership` (`src/git/ownership.ts`, P12b) — the seed declares its own structural `SeedOwnership`, so git's result passes
  as it is. `tests/helpers.ts`: `tmpRoot(prefix)` (its `root` is already a realpath), `.path(rel)`, `.write(rel, text)`
  (mkdir -p), `.rm()`.
- **Inside the phase**: `runTool.ts` imports `cagePath` and the `ScoutFs`/`ScoutTree` types from `./cagePath.js` and the
  `ScoutAction` type from `./parseTurn.js` (generation 1, after both). The other four files import nothing of each other.
- **The injected file system** `ScoutFs { realpath(path: string): string; readFile(path: string): string }` — both throw
  on failure (node's `fs.realpathSync` throws on a dangling link; `fs.readFileSync(p, "utf8")` throws `EISDIR` on a
  directory). Paths handed to it are `posix.join(tree.root, rel)`. In the tests: node fs, or an in-memory object.
- **The tree** `ScoutTree { root: string; files: string[] }`: `files` is the listing, root-relative with "/", in any order
  (P13b reads it with `git ls-files -z --cached --others --exclude-standard`, so ignored files and `.git` are never in it;
  a symlink is listed as one file, never the files behind it).
- **No fixture files**: every example's input is a literal of the record or a tree the test builds under a tmpRoot.

**Distinct markers.** Paths `src/scout/cagePath.ts`, `lib/b one.ts` (a space), `src/a.ts`, `src/e.ts`, `src/bin.dat`,
`src/b.ts`, `README.md`, `decks/p1/deck.json`, `.morph/runs/r/report.json`, `tests/a.test.ts`, `out.txt`, `dirlink`,
`in.txt`, `gitcfg`, `gone.ts`, the sibling `t-out` (shares the root's prefix `t`); cards `q-judge`, `q`, `q1`, `q0`, `qq`,
`d`, `g`, `x`, `p`, `c`, `w`; models `m/r`, `m/q`, `m/x`, `m/p`, `m/c`, `m/w`, `""`; runs `20261110-101010`, `R0`–`R3`;
budgets `{3, 2, 50, 10, 60000}` and deadline 1500; caps `{2, 3, 12, 2}`. The code hard-codes none of them: the caps, the
budgets, the limit and maxChars are parameters; the defaults (`DEFAULT_TOOL_CAPS`, `DEFAULT_BUDGETS`, `SEED_*`), the
verbs, the message texts, the line formats, `CLIP_MARKER`, `SEED_HEADER` and `SEED_WRITES` = 3 are the contract.

**Harness skeletons** (only `tests/helpers.ts` and `node:fs`; the judges of Cage Path and Run Tool):

```ts
const MEM: ScoutFs = { realpath: (p) => p, readFile: (p) => { throw new Error("no read: " + p); } };
const NODE_FS: ScoutFs = { realpath: (p) => fs.realpathSync(p), readFile: (p) => fs.readFileSync(p, "utf8") };
// Cage Path 3: const p = tmpRoot("morph-cage-"); p.write("t/src/a.ts", "a\n"); p.write("t/.git/config", "[core]\n");
//   p.write("t-out/secret.txt", "s\n"); fs.symlinkSync(p.path("t-out/secret.txt"), p.path("t/out.txt"));
//   fs.symlinkSync("src/a.ts", p.path("t/in.txt")); fs.symlinkSync(".git/config", p.path("t/gitcfg"));
//   fs.symlinkSync("nowhere.ts", p.path("t/gone.ts")); fs.symlinkSync(p.path("t"), p.path("link"));
//   tree {root: p.path("t") | p.path("link"), files: ["src/a.ts", "out.txt", "in.txt", "gitcfg", "gone.ts"]}; p.rm() in finally
```

**The tree of Run Tool examples 1–5** (built under one tmpRoot `p` per test, root `p.path("t")`, removed in finally):

| listed path | content | role |
|---|---|---|
| `src/a.ts` | `"l1\nl2\nl3\nl4\nl5\n"` | 5 lines |
| `src/e.ts` | `""` | empty |
| `src/bin.dat` | `"a\0alpha"` | binary: READ refuses, GREP passes over |
| `src/b.ts` | `"const alpha = 1;\nconst beta = 2;\nconst gamma = \"alphabetagammadelta\";\n"` | 3 lines, 3 matches of `alpha\|beta`, 2 of `alpha` |
| `README.md` | `"alpha here\n"` | |
| `decks/p1/deck.json` | `"alpha in a deck\n"` | skipped by grepSkip |
| `.morph/runs/r/report.json` | `"alpha in a report\n"` | skipped by grepSkip |
| `tests/a.test.ts` | `"beta\n"` | |
| `out.txt` | symlink → `p.path("t-out/secret.txt")` = `"alpha secret\n"` | refused by the cage |
| `dirlink` | symlink → `src` (a directory) | caged, unreadable |

```ts
function build(): { p: TmpRoot; tree: ScoutTree } {   // files = the 8 written paths, then "out.txt", "dirlink"
  const p = tmpRoot("morph-tool-");
  for (const [k, v] of Object.entries(FILES)) p.write("t/" + k, v);
  p.write("t-out/secret.txt", "alpha secret\n");
  fs.symlinkSync(p.path("t-out/secret.txt"), p.path("t/out.txt"));
  fs.symlinkSync("src", p.path("t/dirlink"));
  return { p, tree: { root: p.path("t"), files: [...Object.keys(FILES), "out.txt", "dirlink"] } };
}
```

The listing in code-unit order: `.morph/runs/r/report.json`, `README.md`, `decks/p1/deck.json`, `dirlink`, `out.txt`,
`src/a.ts`, `src/b.ts`, `src/bin.dat`, `src/e.ts`, `tests/a.test.ts` (upper case `R` before lower case: `README.md` sorts
before `decks/`). GREP `alpha|beta` over it with C: 5 matches in 3 files (README.md 1, src/b.ts 3, tests/a.test.ts 1),
2 refused (dirlink: readFile throws; out.txt: the cage).

### 2.2. OUTPUT data shapes

**`src/scout/parseTurn.ts`** (NEW, layer scout; imports nothing; pure) — exports, in this order:

```ts
export type ScoutAction =
  | { kind: "read"; path: string; from: number | null; to: number | null }
  | { kind: "grep"; pattern: string; path: string }
  | { kind: "list"; path: string };
export interface ScoutAnswer { targets: string[]; context_slice: string[]; reasoning: string }
export type Turn =
  | { kind: "action"; action: ScoutAction }
  | { kind: "answer"; answer: ScoutAnswer }
  | { kind: "malformed"; reason: string };
export const VERBS: readonly string[];          // ["READ", "GREP", "LIST", "ANSWER"]
export function parseTurn(text: string | null): Turn;
```

**Parse Turn** — the record's behaviour, exactly:

1. `text === null` or `text.trim() === ""` → `{kind: "malformed", reason: "empty turn"}`.
2. `lines = text.split("\n")`, one trailing `"\r"` removed from each. An action line: `/^(READ|GREP|LIST|ANSWER)(?=\s|$)/`
   matches its `trimStart()` (upper case only: `Read`, `grep`, `READX` are prose). 0 → `"no action: one line must start
   with READ, GREP, LIST or ANSWER"`; n > 1 → `"<n> actions in one turn (<verbs in order, ", "-joined>): send one per turn"`.
3. `args = line.trim().slice(verb.length).trim()`.
   - READ: `""` → `"READ needs a path"`; `/^(.*\S)\s+(\d+)-(\d+)$/` → path = group 1, from/to = `Number(...)` (`08` → 8);
     `from < 1 || to < from` → `` `READ: bad line range ${from}-${to}` ``; no match → the whole args is the path, from/to null.
   - GREP: `cut = args.lastIndexOf(" -- ")`; cut ≥ 0 → pattern = `args.slice(0, cut).trim()`, path = `args.slice(cut +
     4).trim()`; else pattern = args, path `""`. pattern `""` → `"GREP needs a pattern"`; `new RegExp(pattern)` throws →
     `` `GREP: invalid pattern /${pattern}/` `` (the engine's message is not quoted: it differs between Node versions).
   - LIST: path = args.
4. ANSWER: `rest = [line.trimStart().slice(6), ...lines after it].join("\n")`; a = first `"{"`, b = last `"}"`; a < 0 or
   b < a → `"ANSWER: no JSON object"`; `JSON.parse(rest.slice(a, b + 1))` throws → `"ANSWER: the JSON does not parse"`
   (prose with a `}` after the object makes it not parse — the protocol text of P13b says "the JSON last"); then the keys
   checked in this order: targets (`"ANSWER: targets must be a non-empty list of paths"`: an array, ≥ 1 element, every
   one a non-empty string), context_slice (absent → `[]`; else the same check without ≥ 1: `"ANSWER: context_slice must be a
   list of paths"`), reasoning (absent → `""`; not a string, `null` included → `"ANSWER: reasoning must be a string"`).
   The answer `{targets, context_slice, reasoning}` in that key order, lists as given (duplicates kept; validated against
   the tree in P13b); every other key dropped.

| Parse Turn example | given | result |
|---|---|---|
| 1 | `"I will check the cage first.\nREAD src/scout/cagePath.ts"`; `"READ lib/b one.ts 12-40"`; `"  READ src/a.ts 7-7\r\n"` | read {src/scout/cagePath.ts, null, null}; {lib/b one.ts, 12, 40}; {src/a.ts, 7, 7} |
| 2 | `"GREP readOwnership\|readMorphLog -- src/git"`; `"GREP a -- b -- tests"`; `"GREP export function"` | grep {readOwnership\|readMorphLog, src/git}; {a -- b, tests}; {export function, ""} |
| 3 | `"LIST"`; `` "```\nLIST tests/fixtures\n```" `` | list {""}; {tests/fixtures} |
| 4 | ANSWER in a json fence with an extra key `acceptance`; `ANSWER {"context_slice": ["c.ts"], "reasoning": "r", "targets": ["a.ts", "b.ts"]}` | answer {[src/x.ts], [], "GREP found it"}; answer {[a.ts, b.ts], [c.ts], r}, JSON key order targets, context_slice, reasoning |
| 5 | null; `" \n\t"`; prose; `Read …`; `READX a`; READ + GREP; `READ`; `9-3`; `0-3`; `GREP ( -- src`; `GREP` | the 11 reasons of the record, in order |
| 6 | `ANSWER the cage`; `{targets: [a]}`; `{"targets": []}`; `["a", ""]`; context_slice `"b"`; reasoning `5` | no JSON object; does not parse; targets ×2; context_slice; reasoning |

**`src/scout/cagePath.ts`** (NEW, layer scout; imports only `posix` from `node:path`; never calls `readFile`):

```ts
export interface ScoutFs { realpath(path: string): string; readFile(path: string): string }
export interface ScoutTree { root: string; files: string[] }
export type Caged = { ok: true; path: string } | { ok: false; error: string };
export function cagePath(tree: ScoutTree, path: string, kind: "file" | "dir", fs: ScoutFs): Caged;
```

**Cage Path**, in this order (`<p>` = the path exactly as given, backslashes and all):

1. `s = path` with every `"\\"` → `"/"`. `s` starts with `"/"` or matches `/^[A-Za-z]:\//` → `"absolute path refused: <p>"`
   (`c:x.ts` is a relative name).
2. a segment of `s.split("/")` equal to `".."` → `"path leaves the root: <p>"` (`..b` is a name).
3. segs = the segments without `""` and `"."`; one equal to `".git"` → `"inside .git: <p>"` (`.gitkeep` is a name).
4. rel = segs `"/"`-joined. rel `""` → dir: `{ok: true, path: ""}`; file: `"empty path"`.
5. dir: some listed file starts with `rel + "/"` → `{ok: true, path: rel}`; else `"no such directory in the tree: <p>"`.
6. file: rel not in `tree.files` → `"not in the tree (missing, ignored or a directory): <p>"`; `real =
   fs.realpath(posix.join(tree.root, rel))`, a throw → `"no such file: <p>"`; `rootReal = fs.realpath(tree.root)` (a throw
   propagates: the root is the caller's); `!real.startsWith(rootReal + "/")` → `"symlink out of the root refused: <p>"`
   (`/x/t-out/secret.txt` does not start with `/x/t/`; a file resolving to the root itself is refused too); the rest of
   real after `rootReal + "/"` with a segment `".git"` → `"inside .git: <p>"`; → `{ok: true, path: rel}`.

| Cage Path example | given | result |
|---|---|---|
| 1 | tree {/r, [src/a.ts, lib/b one.ts, docs/n.md]}, MEM; file src/a.ts, ./lib/b one.ts, `src\\a.ts`, src//./a.ts; dir src/, "", "." | ok src/a.ts, lib/b one.ts, src/a.ts, src/a.ts; ok src, "", "" |
| 2 | the same; the 10 refusals of the record | empty path; absolute ×2; leaves the root ×2; inside .git; not in the tree ×2; no such directory ×2 |
| 3 | the §2.1 symlink tree, NODE_FS; root p/t then p/link | out.txt refused; in.txt ok; gitcfg inside .git; gone.ts no such file; then src/a.ts ok, out.txt refused |

**`src/scout/runTool.ts`** (NEW, layer scout; imports `posix` from `node:path`, `cagePath` and types from `./cagePath.js`,
the `ScoutAction` type from `./parseTurn.js`):

```ts
export interface ToolCaps { readLines: number; grepHits: number; grepLineChars: number; listEntries: number; grepSkip: string[] }
export const DEFAULT_TOOL_CAPS: ToolCaps;   // {readLines 400, grepHits 200, grepLineChars 300, listEntries 300, grepSkip [".morph", "decks"]}
export interface ToolResult { text: string; read: boolean; error: string | null }
export function runTool(action: ScoutAction, tree: ScoutTree, fs: ScoutFs, caps: ToolCaps): ToolResult;
```

**Run Tool** — `read` = `action.kind === "read"` on every result (a refused READ still spends a read). A failure: `error`
= the message, `text` = `"<VERB> failed: " + error` (VERB = READ, GREP, LIST); a success: `error` null, `text` = the lines
`"\n"`-joined, no final newline. A file's lines: split `"\n"`, one trailing `"\r"` removed each, the last piece dropped
when `""` (`"k\nk\nk"` = 3 lines, `"k\n\nk\n"` = 3 lines with an empty second). The listing is walked sorted in code-unit
order (`a < b`, not `localeCompare`).

- **READ**: `cagePath(file)` refused → its error. `body = fs.readFile(posix.join(root, caged))`, a throw → `"unreadable:
  <caged>"`; `body.includes("\0")` → `"binary file: <caged>"`; n = 0 lines → the text `"READ <caged>: empty file"` (no
  range check). `from = action.from ?? 1`; `from > n` → `"line range <from>-<action.to ?? n> is past the end (<n> lines):
  <caged>"`. `to = min(action.to ?? n, n)`; `last = min(to, from + caps.readLines − 1)`. Lines: `"READ <caged> lines
  <from>-<last> of <n>"`, `"<i>: <line>"` for i = from…last (an empty line reads `"2: "`), and when `last < to`: `"…
  <to − last> more lines; READ <caged> <last + 1>-<to> for the next"` (the word `lines` even for 1).
- **GREP**: `new RegExp(action.pattern)` (no flags) throws → `"invalid pattern /<pattern>/"`. `cagePath(dir)` refused →
  its error. where = `"the tree"` for `""`, else `<caged>/`. skip = `caps.grepSkip`, or `[]` when the caged path's first
  segment is in it (a path naming a skipped directory searches it; `a/decks` is not skipped by `decks`). Each listed file
  under the caged path (all for `""`) whose FIRST segment is not in skip: `cagePath(file)` refused or `readFile` throws →
  refused + 1; a `"\0"` → passed over (no count); each line `i` (1-based) with `re.test(line)` is a match; the first
  `caps.grepHits` matches are shown as `"<file>:<i>: <line>"`, a line longer than `caps.grepLineChars` as
  `line.slice(0, grepLineChars) + "… (+<line.length − grepLineChars> chars)"`. Lines: `"GREP /<pattern>/ in <where>: <m>
  match|matches in <f> file|files"` (f = files with ≥ 1 match), the shown matches, `"… <m − shown> more matches"` when m >
  shown, `"(<r> file|files refused by the cage)"` when r > 0.
- **LIST**: `cagePath(dir)` refused → its error. For each listed file under the caged path: rest = the file without
  `<caged>/`; no `"/"` in rest → the entry rest (a file); else the entry = rest up to and including its first `"/"` (a
  directory) counting its files. Entries sorted in code-unit order. Lines: `"LIST <'.' or <caged>/>: <k> entry|entries"`,
  the first `caps.listEntries` as `"<name>"` or `"<dir>/ (<c> file|files)"`, then `"… <k − listEntries> more entries"`
  when k > listEntries. LIST reads no file and resolves nothing.

| Run Tool example | given (the §2.1 tree; D = DEFAULT_TOOL_CAPS, C = {2, 3, 12, 2, [".morph", "decks"]}) | text |
|---|---|---|
| 1 | READ src/a.ts (D); 2-3 (D); (C); ./src/a.ts 4-9 (D) | `READ src/a.ts lines 1-5 of 5` + 5 lines; `lines 2-3 of 5` + 2; `lines 1-2 of 5` + 2 + `… 3 more lines; READ src/a.ts 3-5 for the next`; `READ src/a.ts lines 4-5 of 5` + 2 |
| 2 | READ src/a.ts 6-7, src/e.ts, src/bin.dat, out.txt, dirlink, src/zz.ts (D) | `READ failed: line range 6-7 is past the end (5 lines): src/a.ts`; `READ src/e.ts: empty file` (error null); `…binary file: src/bin.dat`; `…symlink out of the root refused: out.txt`; `…unreadable: dirlink`; `…not in the tree (missing, ignored or a directory): src/zz.ts` |
| 3 | GREP `alpha\|beta` in "" (C) | `GREP /alpha\|beta/ in the tree: 5 matches in 3 files`, `README.md:1: alpha here`, `src/b.ts:1: const alpha … (+4 chars)`, `src/b.ts:2: const beta =… (+3 chars)`, `… 2 more matches`, `(2 files refused by the cage)` |
| 4 | GREP alpha in decks (D); in "" with D + grepSkip []; zzz in src; x in nope; `(` | `GREP /alpha/ in decks/: 1 match in 1 file` + `decks/p1/deck.json:1: alpha in a deck`; `GREP /alpha/ in the tree: 5 matches in 4 files` + `.morph/runs/r/report.json:1: alpha in a report`, `README.md:1: alpha here`, `decks/p1/deck.json:1: alpha in a deck`, `src/b.ts:1: const alpha = 1;`, `src/b.ts:3: const gamma = "alphabetagammadelta";`, `(2 files refused by the cage)`; `GREP /zzz/ in src/: 0 matches in 0 files`; `GREP failed: no such directory in the tree: nope`; `GREP failed: invalid pattern /(/` |
| 5 | LIST "" (C); "" (D); src/; src/a.ts; ../x | `LIST .: 7 entries`, `.morph/ (1 file)`, `README.md`, `… 5 more entries`; the 7: `.morph/ (1 file)`, `README.md`, `decks/ (1 file)`, `dirlink`, `out.txt`, `src/ (4 files)`, `tests/ (1 file)`; `LIST src/: 4 entries`, `a.ts`, `b.ts`, `bin.dat`, `e.ts`; `LIST failed: no such directory in the tree: src/a.ts`; `LIST failed: path leaves the root: ../x` |

**`src/scout/spendBudget.ts`** (NEW, layer scout; imports nothing; pure):

```ts
export interface ScoutBudgets { calls: number; reads: number; chars: number; rounds: number; deadlineMs: number }
export const DEFAULT_BUDGETS: ScoutBudgets;   // {calls 30, reads 12, chars 120000, rounds 40, deadlineMs 1800000}
export interface ScoutSpent { calls: number; reads: number; chars: number; rounds: number }
export type BudgetName = "deadline" | "rounds" | "calls" | "reads" | "chars";
export interface Charge { call: boolean; read: boolean; text: string }
export interface Charged { spent: ScoutSpent; text: string; closed: BudgetName | null; why: string | null }
export const CLIP_MARKER = "\n[… clipped: the character budget is spent]";   // 43 chars
export const FINAL_TURN: readonly BudgetName[];   // ["calls", "reads", "chars"]
export function spendTurn(budgets: ScoutBudgets, spent: ScoutSpent, charge: Charge, elapsedMs: number): Charged;
export function stopReason(answered: boolean, closed: BudgetName | null, why: string | null): string;
```

**Spend Budget** — `spent` is not changed. `remaining = budgets.chars − spent.chars`; `text = charge.text` when
`charge.text.length <= remaining`, else `charge.text.slice(0, Math.max(remaining, 0)) + CLIP_MARKER`. New spent, keys in
this order: `calls + (call ? 1 : 0)`, `reads + (read ? 1 : 0)`, `chars + text.length` (the delivered text, the marker
counted — so an overdrawn budget shows more than its cap), `rounds + 1`. closed/why — the first that holds, with the new
counts: `elapsedMs >= deadlineMs` → `"deadline"`, `` `the deadline (${deadlineMs / 1000} s) passed` `` (60000 → `60`,
1500 → `1.5`); `rounds >= budgets.rounds` → `"the round budget is spent (<r> of <R> rounds)"`; calls → `"the call budget is
spent (<n> of <b> calls)"`; reads → `"the read budget is spent (<n> of <b> reads)"`; chars → `"the character budget is spent
(<n> of <b> chars)"`; else `null, null`. A budget of 0 is closed by any turn. stopReason: answered && closed null → `"the
model answered on its own"`; answered → `` `the model answered after the budget closed: ${why}` ``; closed → `` `no answer:
${why}` ``; else `"no answer: the session ended with every budget open"`.

| Spend Budget example | given (B = {calls 3, reads 2, chars 50, rounds 10, deadlineMs 60000}; spent as {calls, reads, chars, rounds}) | result |
|---|---|---|
| 1 | B, {0,0,0,0}, {true, true, 20 × x}, 0 | spent {1,1,20,1}, text unchanged, null, null |
| 2 | B, {1,1,40,1}, {true, false, 25 × y}, 1000 | spent {2,1,93,2}, text 10 × y + CLIP_MARKER, `chars`, `the character budget is spent (93 of 50 chars)` |
| 3 | {2,0,0,2} + {true,false,"ok"}; {0,1,0,0} + {true,true,""}; {1,0,10,9} + {false,false,"no action"} | `calls` (3 of 3 calls), spent {3,0,2,3}; `reads` (2 of 2 reads), spent {1,2,0,1}; `rounds` (10 of 10 rounds), spent {1,0,19,10} |
| 4 | {2,1,45,9} + {true,true,10 × z}: B at 60000; at 59999; rounds 40; + calls 30; + reads 12; deadlineMs 1500 at 1500 | deadline (60 s); rounds; calls; reads; chars (93 of 50 chars); deadline (1.5 s) |
| 5 | the four stopReason cases | the four sentences; FINAL_TURN; DEFAULT_BUDGETS |

**`src/scout/seedFromOwnership.ts`** (NEW, layer scout; imports `profileForPath`, `isTest` from `../language/paths.js`):

```ts
export interface SeedOwnership { paths: { path: string; writes: { card: string; model: string; run: string | null }[] }[] }
export interface ScoutSeed { source: "primer"; files: string[]; notes: string[] }
export const SEED_FILES = 6;
export const SEED_CHARS = 8000;
export const SEED_WRITES = 3;
export const SEED_HEADER = "Seed: code the project's cards wrote, most recently written first (git Morph-Card trailers):";
export function seedFromOwnership(ownership: SeedOwnership, files: string[], limit: number): ScoutSeed;
export function renderSeed(seed: ScoutSeed, maxChars: number): string;
```

**Seed From Ownership** — walk `ownership.paths` in order, stop when `limit` are kept; keep a path when `files` holds it,
`profileForPath(path)` is not null and `!isTest(profile, path)`. Its note: `` `${path}: written by ${…}` `` with the first
SEED_WRITES writes as `<card> (<model, or — when "">, run <run, or — when null>)` joined `"; "`, + `"; … <k> more"` when
the path has k more. `{source: "primer", files, notes}` in that key order. **renderSeed**: `seed.files` empty → `""`; else
`SEED_HEADER + "\n"`, then each `"- <note>\n"` while the text's length with it stays ≤ maxChars; at the first that does
not fit, it and every later note are left out and `"- … <k> more seeded file|files not shown\n"` is appended (even past
maxChars; the header is always there).

| Seed From Ownership example | given | result |
|---|---|---|
| 1 | the record's 8 paths, files = all but src/gone.ts, limit 3 | files [src/q.ts, tools/x.py, lib/c.ts]; notes `src/q.ts: written by q (m/q, run 20261110-101010); q1 (m/q, run R1); q0 (—, run —); … 1 more`, `tools/x.py: written by x (m/p, run R2)`, `lib/c.ts: written by c (m/c, run —)` |
| 2 | limit 10; limit 0; `{paths: []}` limit 6 | + web/app.tsx (`web/app.tsx: written by w (m/w, run R3)`); empty; empty |
| 3 | renderSeed(ex. 1 seed, 8000); (…, header + "\n" + the first note line exactly = 92 + 1 + 92 + 3 = 188); (…, 10); (empty, 8000) | header + 3 note lines; header, the first note, `- … 2 more seeded files not shown`; header, `- … 3 more seeded files not shown`; `""` |

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P13a scout"):

- **Protocol: text, not native tool calls.** One action line per turn, verbs READ/GREP/LIST/ANSWER in upper case at a line
  start, prose and fences around it allowed; two actions in one turn are malformed (one tool call per turn: the budget
  counts calls per turn). · The old scout's native `tool_calls` needed `tool_choice` support, which the pinned providers
  lack (mrph 29.09: 404 "No endpoints found … Tool Compatibility"); V2's processor sends plain messages (`sendGeneration`),
  so the protocol is text the processor already carries. Malformed turns are results, never throws; the reply and the one
  correction are P13b's.
- **READ syntax** `READ <path> [<from>-<to>]` (1-based, inclusive; the path may hold spaces); **GREP** `GREP <pattern> [--
  <dir>]` split on the last ` -- ` (a pattern may hold ` -- `); **LIST** `LIST [<dir>]`; **ANSWER** + one JSON object
  `{targets, context_slice?, reasoning?}` from the first `{` to the last `}`. OUTLINE and git_log_s of the old scout are
  not in P13a (§7).
- **GREP in-process**: a JavaScript `RegExp` over the files `readFile` returns, no `git grep`, no child process · the
  cage then holds every file grep reads; alternation works as written (the old basic-regex loss); layer scout keeps no
  `node:child_process` (guard).
- **The cage**: the listing decides what exists (ignored and `.git` files are never listed); `..`, absolute paths (`/`,
  a drive with a slash) and a `.git` segment refused before any file system call; a file's realpath must lie under the
  root's realpath + `/` (a sibling with the root's prefix is out); a symlink into `.git` refused; directories are never
  resolved (a symlinked directory is listed as one file, so nothing behind it is listed). Every message pinned, the path
  echoed as given.
- **Caps vs budgets**: caps bound one answer (readLines 400, grepHits 200, grepLineChars 300, listEntries 300 — the old
  GREP_MAX_LINES 200 and GREP_MAX_LINE_CHARS 300 kept), budgets bound the session (the old preregistered calls 30, reads
  12, chars 120 000, rounds 40, and the cli's deadline 1 800 s). "read bytes" of the brief = the character budget
  (delivered chars, the old `max_chars`): one budget, not two.
- **What a turn costs**: every turn a round; a tool turn a call; a READ a read even when refused; the delivered chars
  (clip marker counted) against the char budget; a malformed turn a round only. The old scout's journal cost table
  (list_tree free of chars) is not kept: LIST is charged its chars like any tool (its text is short; the caller may pass
  `chars` of a LIST as it likes in P13b).
- **Closing order and final turn**: deadline, rounds, calls, reads, chars — the first that holds names the stop; calls,
  reads, chars grant one final answer-only turn (`FINAL_TURN`), deadline and rounds end the session · the old loop's
  measured 16 refused rounds; the deadline is elapsed milliseconds handed in (no clock in the layer).
- **stop_reason**: four sentences from (answered, closed, why); the loop-specific ends (model kept calling tools after the
  final turn, a second malformed answer, a transport timeout) are P13b's, built on `no answer: …`.
- **Seed**: from git's ownership (P12b: structured, uncapped), not from the primer's markdown; code files of any profile
  (`profileForPath`), not tests by the profile's own rule (`isTest`: test dirs or pattern — the old scout dropped only
  `tests/`), still in the listing; limit 6 and 8 000 chars kept from the old scout; notes name the newest 3 writes like the
  primer's ownership section; no outlines (no OUTLINE tool in P13a).

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/scout/parseTurn.ts` | NEW | probe only | NEW `tests/scout/parseTurn.examples.test.ts` (PT 1–6) |
| `src/scout/cagePath.ts` | NEW | probe only | NEW `tests/scout/cagePath.examples.test.ts` (CP 1–3) |
| `src/scout/runTool.ts` | NEW | probe only | NEW `tests/scout/runTool.examples.test.ts` (RT 1–5) |
| `src/scout/spendBudget.ts` | NEW | probe only | NEW `tests/scout/spendBudget.examples.test.ts` (SB 1–5) |
| `src/scout/seedFromOwnership.ts` | NEW | probe only | NEW `tests/scout/seedFromOwnership.examples.test.ts` (SF 1–3) |

- `parseTurn.examples`: "Parse Turn example 1: …" … "6: …", each sub-case a `toStrictEqual` of the whole Turn.
- `cagePath.examples`: "Cage Path example 1: …" … "3: …"; 1–2 on MEM, 3 on the §2.1 symlink tree with NODE_FS, removed in
  finally.
- `runTool.examples`: "Run Tool example 1: …" … "5: …", each on its own §2.1 tree, every ToolResult `toStrictEqual`.
- `spendBudget.examples`: "Spend Budget example 1: …" … "5: …".
- `seedFromOwnership.examples`: "Seed From Ownership example 1: …" … "3: …".

### 2.4. What must not break

- Byte for byte: every file outside the 5 code targets and the 5 test files of §2.3 — `src/cli/*` (no routing in P13a),
  `src/language/*`, `src/git/*`, `src/primer/*`, `tests/helpers.ts`.
- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/` — untouched by every card.
- 667 tests in 93 files green at every card (nothing is excluded: no ripple); after the run **667 + 6 + 3 + 5 + 5 + 3 =
  689** in 98 files.

## 3. Acceptance

Built by `morph plan --checks decks/p13a/checks.json`, narrow to broad, every stage printing `== <stage>`. `ownGit: false`
(no test spawns git), `fullExclude` empty.

Code cards (no test file, code-only targets, no smoke cap): `probe/<card>/` → `tsc` (per-card tsconfig excluding the
generation's other targets) → `eslint <targets>` → `guard.mjs src <targets>` → `decks/p13a/parts/<card>.probe.ts`
(parse-turn PT 1–6 + 2 rows = 8; cage-path CP 1–3 + 1 = 4; run-tool RT 1–5 + 1 = 6; spend-budget SB 1–5 + 1 = 6;
seed-from-ownership SF 1–3 + 1 = 4; **28 tests**) → eslint's verdict → full `vitest run` → frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs tests <file> <min> <max> lits<n>.json` → `vitest
run <targets>` → eslint's verdict → full run → frozen → untracked.

| file | new | min | max | lits |
|---|---|---|---|---|
| `tests/scout/parseTurn.examples.test.ts` | yes | 6 | 12 | `Parse Turn example 1` … `6`, `lib/b one.ts`, `readOwnership\|readMorphLog`, `2 actions in one turn (READ, GREP): send one per turn`, `ANSWER: targets must be a non-empty list of paths` |
| `tests/scout/cagePath.examples.test.ts` | yes | 3 | 9 | `Cage Path example 1` … `3`, `t-out`, `symlink out of the root refused: out.txt`, `inside .git: gitcfg`, `not in the tree (missing, ignored or a directory): src/b.ts` |
| `tests/scout/runTool.examples.test.ts` | yes | 5 | 11 | `Run Tool example 1` … `5`, `… 3 more lines; READ src/a.ts 3-5 for the next`, `const alpha … (+4 chars)`, `(2 files refused by the cage)`, `LIST .: 7 entries` |
| `tests/scout/spendBudget.examples.test.ts` | yes | 5 | 11 | `Spend Budget example 1` … `5`, `the character budget is spent (93 of 50 chars)`, `the deadline (1.5 s) passed`, `no answer: the session ended with every budget open` |
| `tests/scout/seedFromOwnership.examples.test.ts` | yes | 3 | 9 | `Seed From Ownership example 1` … `3`, `q0 (—, run —); … 1 more`, `web/app.tsx: written by w (m/w, run R3)`, `2 more seeded files not shown` |

min = the record's examples; max = min + 6.

**Output budget** (`max_tokens`, before the session's ×3 for `ds`; a ds answer ≥ 10 KB gets ≥ 16 000, DECISIONS P12a):

| card | returns | `max_tokens` |
|---|---|---|
| parse-turn | parseTurn.ts ≈ 3.9 KB | 10 000 |
| cage-path | cagePath.ts ≈ 1.7 KB | 8 000 |
| run-tool | runTool.ts ≈ 5.0 KB | 14 000 |
| spend-budget | spendBudget.ts ≈ 2.4 KB | 8 000 |
| seed-from-ownership | seedFromOwnership.ts ≈ 1.7 KB | 8 000 |
| parse-turn-judge | ≈ 6 KB new file (6 tests, ~30 sub-cases) | 16 000 |
| cage-path-judge | ≈ 5 KB new file (tmp tree with symlinks) | 16 000 |
| run-tool-judge | ≈ 9 KB new file (the tree builder, 5 tests, ~25 texts) — the judge with the most literal text | 20 000 |
| spend-budget-judge | ≈ 4.5 KB new file | 14 000 |
| seed-from-ownership-judge | ≈ 3.5 KB new file | 14 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- **Layer scout** (guard, P13a): imports cards, processor, wait, primer, language, git (language for the seed now; git for
  the P13b wiring); of the Node modules only `node:path` (`NODE_ONLY.scout`: the file system is the ScoutFs parameter, P13b
  adds its one node:fs adapter file); in `NO_CLOCK` and `NO_ENV`; no `fetch` (only processor), no `process`, no `console`,
  no `node:child_process` (only acceptance, git).
- parseTurn.ts and spendBudget.ts import nothing; cagePath.ts only `node:path`; runTool.ts `node:path` + `./cagePath.js` +
  `./parseTurn.js` (type); seedFromOwnership.ts `../language/paths.js`. Neither cagePath nor runTool walks a directory: the
  listing is the tree.
- A file a card writes is in no sibling's slice in the same generation: generation 0 (parse-turn, cage-path, spend-budget,
  seed-from-ownership) reads no scout file; generation 1 (run-tool reads parseTurn.ts and cagePath.ts; the four judges of
  generation 0 read only their own module) — no judge's test file is in run-tool's slice; generation 2 (run-tool-judge).
- Tests write only under `tmpRoot()` and remove it in `finally`; symlinks built with `fs.symlinkSync` inside the tmpRoot;
  no timer; a judge writes only its targets.

## 7. Out of scope

- **P13b** (the line: P13a has no model call and no I/O but the ScoutFs parameter; everything that needs the processor,
  the clock, the real file system or git is P13b): the round loop `runScout` (protocol text sent as the system message,
  round 0 = the listing head + `renderSeed`, the processor's `sendGeneration` per turn, the one correction of a malformed
  answer, the final answer-only turn after a FINAL_TURN budget, the deadline from a clock parameter, `--no-round0`,
  usage); validating the answer's paths against the tree; `scout/<id>/scout.json` (provenance: issue text sha, protocol
  sha, ref, budgets, spent, stop_reason, journal); `--seed-file`; the node:fs ScoutFs adapter and the `git ls-files`
  listing (git's runGit); `plan --from-scout` (a scout answer → one patch card); the cli routing `scout` and `plan
  --from-scout` (cli at 29 996 bytes: a compaction first).
- OUTLINE (definition lines, free of the read budget) and git_log_s of the old scout: not in the PLAN row; a later phase
  if a session asks.
- Reading at a git ref instead of the working tree (the old scout's `git show <ref>:<path>`).
- reviewer (P14).

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component scout \
  --judge --checks decks/p13a/checks.json --out decks/p13a/deck.json
python3 decks/p13a/filter.py decks/p13a/deck.json                # asserts the 10 cards of the phase
node dist/cli.js deck check --root . --deck decks/p13a/deck.json                                  # errors 0
python3 decks/tools/scale_tokens.py decks/p13a/deck.json 3       # the session, for processor ds
rm -rf /tmp/v2bin-p13a && mkdir -p /tmp/v2bin-p13a && cp -r dist /tmp/v2bin-p13a/ && ln -s $PWD/node_modules /tmp/v2bin-p13a/node_modules
node /tmp/v2bin-p13a/dist/cli.js run --root . --deck decks/p13a/deck.json --processor ds --deadline 2400
```

Cross-check (dry): from `morph-lab`, `venv/bin/mrph plan --spec <repo>/contour.yaml --map <repo>/morph-map.json
--component scout --judge --root <repo>`.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 10 (5 code, 5 judges) / 3: [parse-turn, cage-path, spend-budget, seed-from-ownership] [run-tool, parse-turn-judge, cage-path-judge, spend-budget-judge, seed-from-ownership-judge] [run-tool-judge] |
| executor bill | ≈ $0.10–0.18 on ds ×3 (P12b: 7 cards, 10 requests, $0.1162); ≤ $0.35 with a re-cut; cap $5 |
| cards with regeneration | 1–3 of 10 (run-tool: the line formats, the skip rule by first segment, sorting by localeCompare; parse-turn: the ANSWER rest from the verb, `Number("08")`; run-tool-judge: the tree builder or a text literal) |
| tests after the run | 689 ± 4 in 98 files |
| first red | cage-path: `startsWith(rootReal)` without the `/` (the t-out sibling); run-tool: `"… 1 more line"` singular, or GREP skipping `a/decks/` |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no answer cut at its `max_tokens`; (3) the V2 cut equals
the old mrph's dry cut in ids, dependsOn, generations, targets, slices and max_tokens; (4) after the run no file outside
§2.3's ten changed; (5) no file of `src/scout/` imports `node:fs` or `node:child_process` (guard).

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the MEASURE row with
its `прогоны` cell; DECISIONS lines "P13a scout".

## 11. Actual

### Gate (preparation)

08.10, on the VPS, by the preparing orchestrator (Opus 5.5); no paid run, no call to the live service. Data commits 0768352
(spec, record, map, guard layer, probes, checks, filter, deck, DECISIONS), d1df538 (7 probe rows closing the first pass's
mutation survivors; deck re-cut) and the gate commit (this section). Component size: scout 316 → **23 318** bytes; cli
and every other Component untouched; Deterministic Core gains the P13a sentence. Issues labelled P13a-scout / P13-scout:
none open.

The deck **cut by V2**: `node dist/cli.js plan --component scout --judge --checks decks/p13a/checks.json --out
decks/p13a/deck.json` exit 0, 10 cards, `decks/p13a/filter.py` keeps 10 of 10; generations `[cage-path, parse-turn,
seed-from-ownership, spend-budget] [cage-path-judge, parse-turn-judge, run-tool, seed-from-ownership-judge,
spend-budget-judge] [run-tool-judge]`; `node dist/cli.js deck check` **0 errors, 0 warnings**, no hazards. Cross-check: the
old `mrph plan --spec … --component scout --judge` (dry, exit 0) gives the same 10 ids in the same order and the same 3
generations; targets, slices, dependsOn, intent, variants, max_tokens and reasoning (2 500) equal on all 10; instructions
differ on all 10 (the P10a design); acceptances differ on all 10 (V2's chain from checks.json; mrph's default `npx tsc`).

Scratch worktree from d1df538 (references of the 5 code files and 5 judge files, deleted afterwards), cards run in deck
order with the deck's own acceptances, each accepted card committed before the next: **10 of 10 chains green, 48.8–53.3 s
each (502.6 s in all; limit 250 s per chain)**. Ripple: 0 of 667. The final tree: `tsc`, `eslint src tests`, guard
clean, `vitest run` **695 / 695** in 98 files (667 + the 28 tests of the probe-shaped reference judges; the real judges
write ≈ 22 → 689). Typed one-line throwing stubs (`Error: stub <fn> <args JSON>`; types and constants as specified): every
code card red at the probe — parse-turn 8/8, cage-path 4/4, run-tool 6/6, spend-budget 6/6, seed-from-ownership 4/4
(**28/28**), each FAIL with its readable stub line; chains 8.2–8.9 s. Judges with the reference code and the file absent:
red at the guard ("… missing", 6.0–6.5 s). Mutation check: **91 single-rule mutations** of the references (parseTurn 23,
cagePath 13, runTool 29, spendBudget 14, seedFromOwnership 12), each under a 120 s subprocess timeout: first pass 82
killed, 9 survivors; 7 closed by probe rows (d1df538); second pass **89 killed, 0 by timeout** (max 7.1 s), 2 equivalent:
the trailing "\r" kept on a line (every argument is trimmed and JSON.parse takes "\r" as whitespace) and a directory entry
built as `slice(0, i) + "/"` instead of `slice(0, i + 1)`.

Max slice + targets: run-tool-judge 47 596 bytes + runTool.ts and cagePath.ts (≈ 6.7 KB) ≈ 54 KB (gate 200 KB).
**Forecast** on `ds` with every maxTokens × 3: P12b ran 7 cards, 10 requests, $0.1162 at 30–59 KB in; here 10 cards of
41–54 KB in, 15 first requests (5 code × 2 variants + 5 judges), ≈ 15–22 requests ≈ **$0.12–0.22**, ≤ $0.40 with a re-cut;
≤ $1. **Gate holds.**

**Run command** (from the repo root, the binary copied first; the session applies maxTokens × 3 first, as the operator
ordered):

```
python3 decks/tools/scale_tokens.py decks/p13a/deck.json 3
npm run build && rm -rf /tmp/v2bin-p13a && mkdir -p /tmp/v2bin-p13a && cp -r dist /tmp/v2bin-p13a/ && ln -s $PWD/node_modules /tmp/v2bin-p13a/node_modules
node /tmp/v2bin-p13a/dist/cli.js run --root . --deck decks/p13a/deck.json --processor ds --deadline 2400 > /tmp/p13a-run.json
```

### Run (08.10, VPS, autonomous) — cut by V2, run by the V2 binary on processor ds

Deck `decks/p13a/deck.json` (V2 cut filtered to 10 cards by `decks/p13a/filter.py`, maxTokens ×3), run by the V2 binary copy
in `/tmp/v2bin-p13a` with `--processor ds --deadline 2400`, default retry cap: run 20261008-011300, **10 / 10 written in one
run, no fix**, 9 at the first attempt (retry won `cage-path-judge` r1, v1 red at tsc; `spend-budget` won on v2), $0.1545,
11.1 min (663 s), 16 requests, 291 526 in / 87 829 out tokens. On the run branch: `git status` clean; tsc, eslint,
`npm run build` clean; vitest **689 / 689** in 98 files. Read once against §2.2: Cage Path refuses absolute, `..` and
`.git` before any fs call, decides existence by the listing, and requires the real path under `realpath(root) + "/"`;
Run Tool's GREP cages every file it reads (a symlink out of the root is counted "refused by the cage"), skips `.morph` and
`decks` unless named, RegExp without flags; READ caps lines and names the next range; the scout layer has no clock, env,
network or child process. 0 defects.
