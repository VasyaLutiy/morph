# TASK_P18 — template: `morph init` (a new project from `templates/`) (`src/scaffold/initProject.ts`, `src/cli/{types,parse,main}.ts`)

> Phase P18 of `docs/PLAN.md` ("Фазы по записи (после P2)": `P18 | scaffold (template) + cli | issue #9`), operator 08.10.
> Issue VasyaLutiy/morph#9 (label `P18-template`; `gh issue list --label P18-template`: #9 only; no other `P18-*` label)
> is built into the record: Component **scaffold** (NEW: Init Project) and **cli** (Parse Command, Main: the routing;
> compacted first). PLAN's rule "a CLI command lives in its own Component, cli only routes" holds: `init` is a Function of
> scaffold, cli parses and routes. The template itself, `templates/` (common + typescript + go + python), is DATA written
> with this preparation, like a fixture. The deck is cut by V2 (`morph plan --component scaffold --component cli --judge
> --checks decks/p18/checks.json`), filtered to this phase's 5 cards by `decks/p18/filter.py`. **No split**: 5 cards, one
> gate (≤ $1, slices ≤ 200 KB, chains < 250 s, §11). Issue #9's smoke on three languages is prepared as data under
> `decks/p18/smoke/` and run by the main session after the merge (§8).

## 1. Why this

- **Every regulation and tool of the autonomous loop is written for MorphV2 itself** (issue #9): `docs/AUTONOMY.md`
  (19 225 B), `CLAUDE.md`, `tools/` (6 files, 10 249 B), `decks/tools/` (guard 15 872 B with MorphV2's 18 layers
  hard-coded). The one project built from zero on V2 so far (P15L gocrud, 14 cards) was set up by copying and hand-editing
  these in /tmp. `morph init` makes that one command; `templates/` is the generic, language-aware form: **34 files**
  (common 17, typescript 10, go 5, python 2), no MorphV2 name, no phase number, no path under /home (leak check §3:
  0 lines).
- **Ripple, measured** (the 4 reference files in a scratch worktree from e31375c with this phase's data, full suite): **1 of
  759** red — `tests/cli/parse.examples.test.ts` "Parse Command example 8" (the no-command message lists eleven commands),
  excluded deck-wide until parse-command-judge patches it.
- **Record sizes** (bytes of each Component block, from its `- name:` line to the next block): cli 29 260 → **28 036**
  (compaction first: 13 more examples — Emit Document 1–3, Classify Error 1–3, Deck Check 1, 3, Run Command 3, 5, 11,
  Plan Command 7, 8 — moved whole to `tests/fixtures/cli/examples.json` by key, values identical; the 52 by-key examples
  drop the `ref` to examples.json that the Component's description already names; then the init routing, Parse Command
  example 21 and Main 16 by key); scaffold new **6 795**; Requirement Deterministic Core gains the P18 sentence.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main** (module → what the new code calls or constructs): `src/cli/types.ts` — `Command`, `CliDeps {env,
  now, cwd, transport, interrupted?}`, `CommandResult {code: ExitCode, document: unknown}`; `src/cli/document.ts` —
  `renderDocument`, `classifyThrown` (a thrown fs error → exit 3); `src/cli/parse.ts` — the parser the patch extends.
  scaffold imports no `src/` module.
- **The template folders** (Template Folder): `<templates>/common/` and `<templates>/<language>/`, directory trees of
  UTF-8 text files; Morph's own `templates/` sits at the package root, beside `src/` and `dist/` (§2.2, gap "where
  templates/ is found").
- **Preconditions of the platform.** node · `fs.readdirSync(dir, {withFileTypes: true})` reports a symbolic link as
  neither a file nor a directory (`isFile()` false), so a link in a template folder is skipped (probe row). node ·
  `fs.writeFileSync` creates a file with `0o666 & ~umask`; only `chmodSync` gives it the source's mode. git · a checkout
  writes a tracked file with `0o644`/`0o755` masked by the umask (this VPS: umask 002 → 664/775), so a mode is compared
  with the source's mode, never with a number (IP 1, 5).
- **Fixtures** (`tests/fixtures/`), each by the type the Function takes:

| file | type | what it is | what the Function returns on it |
|---|---|---|---|
| `scaffold/tpl/` | a directory tree, the `templates` argument | `common/`: `.gitignore` "node_modules/\n.morph/*\n", `README.md` "# {{name}}\n\nA {{language}} project, module {{module}}.\n", `docs/notes.md` "Keep {{ name }}, {{other}}, ${{ env.HOME }} and {{join .Imports}} as they are; {{name}}{{name}}.\n", `tools/hello.sh` (mode 755) "#!/bin/sh\necho \"{{name}} ready\"\n"; `go/`: `README.md` "# {{name}} (Go)\n", `go.mod` "module {{module}}\n\ngo 1.22\n", `internal/keep.txt` "{{module}}/internal {{language}}\n"; `python/`: `pyproject.toml` "[project]\nname = \"{{name}}\"\n"; **no** `typescript/` | IP 1: 6 files (go's README replaces common's); IP 2: 5 files; IP 4: "template folder not found: typescript"; Main 16: 6 files |
| `templates/` (the real one, data of this phase) | the default `templates` (null) | common 17 files, typescript 10, go 5, python 2 | IP 5: common ∪ go = 22 distinct paths (no overlap) |
| `cli/parseArgv.json`, `cli/parse.json` | ONE object each | key 8 second result names eleven commands; key 21 (16 argv) added | Parse Command 8, 21 |
| `cli/examples.json` | ONE object | `"<Function> <n>"` → `{given, then}`: 13 more cli examples moved out of the record; Main 16 added | Main 16 (the record's text) |

- **Harness skeletons** (only `tests/helpers.ts`):

```ts
// Init Project (IP 1-5): const TPL = fixturePath("scaffold/tpl"); const t = tmpRoot();
//   try { const r = initProject(t.path("acme"), { project: "acme", language: "go", module: "example.com/acme", templates: TPL }, "/");
//     … t.read("acme/go.mod") …; mode = (p) => fs.statSync(p).mode & 0o777 compared with the source file's under TPL } finally { t.rm(); }
// IP 2: initProject(t.root, { …, templates: "tpl" }, fixturePath("scaffold"))   (the root exists and is empty)
// IP 5: the repository root = path.resolve(fixturePath("."), "..", ".."); templates/ under it
// Main 16: deps = { env: { PATH: process.env.PATH ?? "" }, now: () => 0, cwd: t.root, transport: null }; an io pushing chunks
```

**Distinct markers.** Projects `acme`, `beta_svc`, `gx`, `zed`, `b`; modules `example.com/acme`, `example.com/gx`, `m/z`,
`x/y`, null; languages `go`, `python`, `typescript`; entries `.a`, `b.txt`, `.gitignore`, `z`; templates `tpl`, `t2`,
`nope`, `absent`, the absolute fixture path, null. The code hard-codes none of them: the project, the module, the
language, the folders and their files are arguments or the tree's; `COMMON_DIR`, the three placeholders, the messages
and the document's keys are the contract.

### 2.2. OUTPUT data shapes

**`src/scaffold/initProject.ts`** (NEW; layer scaffold; node:fs, node:path, node:url only; no other `src/` layer):

```ts
export type InitLanguage = "typescript" | "python" | "go";
export interface InitOptions { project: string; language: InitLanguage; module: string | null; templates: string | null }
export interface InitValues { name: string; module: string; language: string }
export interface InitDocument { name: string; language: InitLanguage; module: string; files: string[] }
export interface InitResult { code: 0 | 2; document: unknown }
export const COMMON_DIR = "common";
export function defaultTemplatesDir(): string;
export function fillTemplate(text: string, values: InitValues): string;
export function listTemplateFiles(dir: string): string[];
export function initProject(root: string, args: InitOptions, cwd: string): InitResult;
```

- **defaultTemplatesDir**: `path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "templates")` — from
  `src/scaffold/initProject.ts` and from `dist/scaffold/initProject.js` alike, the package root's `templates/`.
- **fillTemplate** (pure): ONE left-to-right pass of `/\{\{(name|module|language)\}\}/g` → the value; a value holding a
  placeholder is not replaced again; anything else stays (`{{ name }}`, `{{other}}`, `${{ x }}`, `{{join .Imports}}`,
  `{name}`, `{{Name}}`, `{{name}`).
- **listTemplateFiles(dir)**: dir not a directory → `[]`; else every regular file under dir, recursively, as a
  `"/"`-joined path relative to dir, sorted by code unit (`a < b`, not `localeCompare`); a symbolic link or any other kind
  skipped; directories alone yield nothing. Code-unit order of the whole path, not the walk's order: `x.md` comes before
  `x/deep.txt` (`.` 0x2E < `/` 0x2F) although a sorted walk visits `x/` first (probe row).
- **initProject(root, args, cwd)** — root is absolute (main resolved it), in order, nothing written before step 5:
  1. `templates = args.templates === null ? defaultTemplatesDir() : path.resolve(cwd, args.templates)`.
  2. root exists and is not a directory → `{code: 2, document: {error: {code: 2, kind: "RefusalError", message: "target is
     not a directory"}}}`; root is a directory with any entry (dot entries count) → 2 RefusalError `target directory is not
     empty (first entry: <the smallest entry name by code unit>)`; root absent → fine (created in step 5).
  3. For `COMMON_DIR`, then `args.language`: `<templates>/<folder>` not a directory → 2 RefusalError `template folder not
     found: <folder>`.
  4. sources: listTemplateFiles of common, then of the language's folder, keyed by relative path (the language's file
     replaces common's); `files` = the keys sorted by code unit.
  5. `values = {name: project, module: module ?? project, language}`; `mkdirSync(root, {recursive: true})`; per file:
     its parents created, `writeFileSync(dest, fillTemplate(<source UTF-8>, values))`, `chmodSync(dest, statSync(source).mode
     & 0o777)`.
  6. `{code: 0, document: {name: project, language, module: values.module, files}}`, keys in that order. A file-system
     failure under way throws (main's classifyThrown: exit 3).

| Init Project example | given | result |
|---|---|---|
| 1 | root t/acme absent; `{acme, go, example.com/acme, <TPL absolute>}`, cwd "/" | 0, `{acme, go, example.com/acme, [.gitignore, README.md, docs/notes.md, go.mod, internal/keep.txt, tools/hello.sh]}`; README.md `# acme (Go)\n`; go.mod `module example.com/acme\n\ngo 1.22\n`; internal/keep.txt `example.com/acme/internal go\n`; each mode = its source's, hello.sh executable |
| 2 | root = t (empty, exists); `{beta_svc, python, null, "tpl"}`, cwd `tests/fixtures/scaffold` | 0, `{beta_svc, python, beta_svc, [.gitignore, README.md, docs/notes.md, pyproject.toml, tools/hello.sh]}`; README.md `# beta_svc\n\nA python project, module beta_svc.\n`; pyproject.toml `[project]\nname = "beta_svc"\n`; docs/notes.md `Keep {{ name }}, {{other}}, ${{ env.HOME }} and {{join .Imports}} as they are; beta_svcbeta_svc.\n` |
| 3 | fillTemplate | `"{{name}}:{{module}}:{{language}}"` with `{name "{{module}}", module "x/y", language "go"}` → `{{module}}:x/y:go`; `"{name} {{Name}} {{name}"` unchanged |
| 4 | root holding b.txt and .a; root = a file; language typescript on TPL; templates "nope" (cwd t) | 2 `target directory is not empty (first entry: .a)` (the root still holds only .a, b.txt); 2 `target is not a directory`; 2 `template folder not found: typescript`; 2 `template folder not found: common`; the absent roots stay absent |
| 5 | templates null; root t/gx; `{gx, go, example.com/gx}` | defaultTemplatesDir() = `<repo>/templates`; 0, files = listTemplateFiles(templates/common) ∪ (templates/go), distinct, code-unit order, among them `CLAUDE.md`, `docs/AUTONOMY.md`, `go.mod`, `internal/testhelp/testhelp.go`, `decks/tools/guard.mjs`, `tools/tg.sh`; go.mod begins `module example.com/gx\n`; no written file holds a placeholder; tools/tg.sh executable; listTemplateFiles(TPL/common) = `[.gitignore, README.md, docs/notes.md, tools/hello.sh]`, of an absent dir `[]` |

**`src/cli/types.ts`, `src/cli/parse.ts`, `src/cli/main.ts`** (PATCH; one card owns the three, the P13b/P14b/P17
pattern: the routing must land with the widened Command, or tsc breaks main.ts):

```ts
export interface InitArgs {
  name: "init"; root: string; pretty: boolean; project: string; language: "typescript" | "python" | "go";
  module: string | null; templates: string | null;
}
export type Command =
  | DeckCheckArgs | RunArgs | PlanArgs | SubmitArgs | CollectArgs | PrimerArgs | ScoutArgs | FromScoutArgs | ReviewArgs
  | CardArgs | AcceptArgs | InitArgs;
```

**Parse Command** — additions only, every other check, message, default and key unchanged: `--name`, `--language`,
`--module` and `--templates` are value flags; `init` is a one-word command (an extra word is the existing `unexpected
argument: <first extra>`); allowed flags of init: `--root, --pretty, --name, --language, --module, --templates` (any
other: the existing `flag <f> does not apply to init`; and the four new flags apply to no other command); the
no-command message `no command (commands: deck check, plan, run, submit, collect, primer, scout, review, card, accept,
init)`. Right after the checks of card and accept (before review's and every later check), init: no `--name` → `missing
--name`; a `--name` not matching `^[A-Za-z0-9._-]+$` → `--name must match ^[A-Za-z0-9._-]+$ (got '<v>')`; no
`--language` → `missing --language`; a `--language` other than `typescript`, `python`, `go` (exact, case-sensitive) →
`--language must be one of typescript, python, go (got '<v>')`; a given `--module` not matching `^[A-Za-z0-9._/-]+$` →
`--module must match ^[A-Za-z0-9._/-]+$ (got '<v>')`; else done `{name "init", root, pretty, project: --name, language,
module: --module or null, templates: --templates or null}`, keys in InitArgs' order.

| Parse Command example | argv (`parseArgv.json`) | result (`parse.json`) |
|---|---|---|
| 8 (changed) | `[--root]`; `[]` | `flag --root needs a value`; `no command (commands: deck check, plan, run, submit, collect, primer, scout, review, card, accept, init)` |
| 21 | `[init, --name, acme, --language, go]`; `[--pretty, init, --root, /w/p, --name, beta_svc, --language, python, --module, example.com/x-y/beta, --templates, ../tpl]`; `[init, --name, a, --language, typescript, --module, github.com/acme/x_1.v2]`; `[init, --language, go]`; `[init, --name, a b, --language, go]`; `[init, --name, a b]`; `[init, --name, a]`; `[init, --name, a, --language, rust]`; `[init, --name, a, --language, TypeScript]`; `[init, --name, a, --language, go, --module, a b]`; `[init, --name, a, --language, go, --deck, d]`; `[run, --deck, d, --processor, s, --name, a]`; `[card, --deck, d, --id, a, --templates, t]`; `[init, x, --name, a, --language, go]`; `[init, --name, a, --name, b, --language, go]`; `[init, --name, a, --language]` | `{init, ".", false, acme, go, null, null}`; `{init, /w/p, true, beta_svc, python, example.com/x-y/beta, ../tpl}`; `{init, ".", false, a, typescript, github.com/acme/x_1.v2, null}`; `missing --name`; `--name must match ^[A-Za-z0-9._-]+$ (got 'a b')` (twice: the name before the language); `missing --language`; `--language must be one of typescript, python, go (got 'rust')`; `… (got 'TypeScript')`; `--module must match ^[A-Za-z0-9._/-]+$ (got 'a b')`; `flag --deck does not apply to init`; `flag --name does not apply to run`; `flag --templates does not apply to card`; `unexpected argument: x`; `flag --name given twice`; `flag --language needs a value` |

**Main** — one branch before the run branch (which stays the last else): `command.name === "init"` → `result =
initProject(root, command, deps.cwd)` (InitArgs passes as InitOptions; root = `path.resolve(deps.cwd, command.root)` as
for every command; `--templates` is resolved against cwd inside initProject). The stderr line is `morph init: exit
<code>\n`; a parse failure stays `morph: <message>\n`.

| Main example | given (`examples.json`) | result |
|---|---|---|
| 16 | tmpRoot t; deps {env {PATH}, now () => 0, cwd t.root, transport null}; A = `[init, --root, p, --name, acme, --language, go, --module, example.com/acme, --templates, <TPL absolute>]`; A again; `[init, --name, acme, --language, rust]`; t/t2 = common/a.txt `{{name}}\n` + python/b.txt `{{language}}\n`, `[init, --root, q, --name, b, --language, python, --templates, t2]` | 0, stderr `["morph init: exit 0\n"]`, one document `{acme, go, example.com/acme, [6 files of IP 1]}`, t/p/go.mod `module example.com/acme\n\ngo 1.22\n`; 2, stdout exactly `{"error":{"code":2,"kind":"RefusalError","message":"target directory is not empty (first entry: .gitignore)"}}\n`, stderr `["morph init: exit 2\n"]`; 4, stderr `["morph: --language must be one of typescript, python, go (got 'rust')\n"]`; 0, `{b, python, b, [a.txt, b.txt]}`, t/q/a.txt `b\n`, t/q/b.txt `python\n` |

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P18 template"; #9 = issue VasyaLutiy/morph#9):

- **Placement (#9, the cli rule)** · a NEW Component `scaffold` (`src/scaffold/`, guard layer scaffold: no other layer;
  node:fs, node:path, node:url; NO_CLOCK, NO_ENV) holds `init`; cli parses and routes · no existing layer reads a template
  tree or writes a project; one 6.8 KB Component; the debt / review-session precedent.
- **Where templates/ is found (#9)** · `defaultTemplatesDir()` = the package root's `templates/`, found from the module's
  own `import.meta.url` two directories up (`src/scaffold/` in tests, `dist/scaffold/` in the binary); `--templates <dir>`
  overrides it, resolved against cwd · no environment read (scaffold is NO_ENV), no new CliDeps field; the binary copy of
  a run (`/tmp/v2bin-<phase>/dist/`) finds `/tmp/v2bin-<phase>/templates`, so the run recipe links `templates/` beside
  `dist/` (§8) — the deck itself never calls `init`, only the smoke does.
- **The name field** · the project's name is `project` in InitArgs/InitOptions (`name` is the command's discriminant); the
  document says `name` · Command's union is discriminated by `name`.
- **--module default** · `module ?? project` (go.mod gets `module <name>`) · Go accepts a single-element module path;
  typescript and python templates do not use `{{module}}` beyond docs.
- **--name / --module patterns** · `^[A-Za-z0-9._-]+$` (the run-id pattern: safe in a path, a tmux session name, a
  package name) and `^[A-Za-z0-9._/-]+$` (a Go module path) · both land in files and shell lines verbatim.
- **Languages** · exactly `typescript`, `python`, `go`, case-sensitive, checked by the parser (exit 4) · the three profiles
  of Component language; a folder of the template missing is the scaffold's refusal (exit 2), not a usage error.
- **Non-empty means any entry** · a dot entry counts (`.git` of a fresh `git init` refuses: `init` comes before `git
  init`); the first entry by code unit is named · issue #9: "a message naming the first entry"; deterministic.
- **Overlay** · the language's file replaces common's at the same path; files listed in code-unit order · lets a language
  specialise a common file without a merge rule; the document is deterministic.
- **Modes** · each written file gets its source's `mode & 0o777` (the tools are executable after `init`) · `writeFileSync`
  alone gives `0o666 & ~umask`.
- **Placeholders** · exactly `{{name}}`, `{{module}}`, `{{language}}`, one pass, everything else verbatim (the Go guard's
  `{{join .Imports "\n"}}` survives) · a template engine is out of scope; one regex pass cannot re-expand a value.
- **No write before the checks; a failure under way throws** · the refusals (exit 2) leave the file system as it was; a
  half-written project after an I/O fault is reported by exit 3 and not cleaned up · cleaning up a directory the user
  named is riskier than leaving it.
- **Python's acceptance (#9 smoke)** · `morph plan --checks` has no acceptance builder for python (Build Acceptances:
  "only typescript, go"); the python smoke cuts with `morph plan` and the acceptances written in its map, no `--checks` ·
  a python builder is a Component change of builder, out of this phase (§7).
- **templates/ as data** · written by this preparation, frozen for every card (checks `frozen` adds `templates`); its leak
  check is both `decks/p18/smoke/leak.sh` and the last row of the init-project probe · issue #9's acceptance "no
  MorphV2-specific names, no P-numbers, no /home paths".
- **Record size** · 13 more cli examples moved to `examples.json` by key, the 52 by-key examples drop the redundant ref
  (cli 29 260 + the routing would reach 30 049).

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/scaffold/initProject.ts` | NEW | probe only | NEW `tests/scaffold/initProject.examples.test.ts` (IP 1–5) |
| `src/cli/types.ts`, `parse.ts`, `main.ts` | PATCH | probe only | PATCH `tests/cli/parse.examples.test.ts` (PC 8 changed, 21 added); NEW `tests/cli/main.p18.examples.test.ts` (Main 16) |

- `initProject.examples`: "Init Project example 1: …" … "5: …"; a tmpRoot per test, removed in finally; documents whole
  with toStrictEqual, file texts with toBe, modes against the source file's `statSync(...).mode & 0o777`.
- `parse.examples` (patched): example 8's message gains `, init`; "Parse Command example 21: init, its flags and checks"
  added, its sixteen results literals compared whole with toStrictEqual; every other test and line unchanged.
- `main.p18.examples`: "Main example 16: …", in process, an io that pushes stdout and stderr chunks.

### 2.4. What must not break

- Byte for byte: every file outside the 4 code targets and the 3 test files of §2.3 — `src/cli.ts` and the other
  `src/cli/*`, every other `src/` layer, `tests/helpers.ts`; `contour.yaml`, `morph-map.json`, `docs/`, `decks/`,
  `tests/fixtures/`, `templates/` — untouched by every card (frozen).
- 759 tests in 117 files: 758 green at every card (`tests/cli/parse.examples.test.ts` excluded deck-wide, its example 8
  red from parse-command until parse-command-judge); after the run **759 + 1 + IP 5 + Main 1 = 766** in 119 files.

## 3. Acceptance

Built by `morph plan --checks decks/p18/checks.json`, narrow to broad, every stage printing `== <stage>`. `ownGit: true`
(the full suite spawns git in its own tmpRepos; the stage proves this repository's HEAD and refs unchanged), `frozen`
the defaults + `templates`, `fullExclude` `tests/cli/parse.examples.test.ts` (the ripple).

Code cards (no test file; code-only targets, `intent: generate` for the new file): `probe/<card>/` → `tsc` (per-card
tsconfig excluding the generation's other targets) → `eslint <targets>` → `guard.mjs src <targets>` (layer scaffold) →
`decks/p18/parts/<card>.probe.ts` (init-project IP 1–5 + 2 rows = 7, the last row the leak check of the real
`templates/`; parse-command PC 8, 21, Main 16 = 3; **10 tests**) → eslint's verdict → full `vitest run` → own git →
frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs tests <file> <min> <max> lits<n>.json` (+ the names
kept for the patched file) → `vitest run <targets>` → eslint's verdict → full run → own git → frozen → untracked.

| file | new | min | max | lits |
|---|---|---|---|---|
| `tests/scaffold/initProject.examples.test.ts` | yes | 5 | 11 | `Init Project example 1` … `5`, `scaffold/tpl`, `example.com/acme/internal go`, `beta_svcbeta_svc`, `{{module}}:x/y:go`, `target directory is not empty (first entry: .a)`, `target is not a directory`, `template folder not found: typescript`, `template folder not found: common` |
| `tests/cli/parse.examples.test.ts` | no | 27 | 29 | `Parse Command example 21`, `card, accept, init)`, `--language must be one of typescript, python, go (got 'TypeScript')`, `--module must match ^[A-Za-z0-9._/-]+$ (got 'a b')`, `flag --templates does not apply to card`, `flag --name does not apply to run` |
| `tests/cli/main.p18.examples.test.ts` | yes | 1 | 7 | `Main example 16`, `morph init: exit 0`, `morph init: exit 2`, `target directory is not empty (first entry: .gitignore)`, `scaffold/tpl` |

min = the record's examples (parse: the file's 26 tests + 1); max = min + 6 (parse + 2).

**The data check of issue #9** (no card; run at the gate and by the smoke): `decks/p18/smoke/leak.sh templates` — `grep
-rnIiP` for MorphV2, mrph, morph-lab, MorphProject, VasyaLutiy, `/home/`, john, `P<n>` phase numbers, `dd.mm` dates,
glm, deepseek, `ds`, v2bin over every file of `templates/` (dot files too); exit 1 with each hit as `file:line:text`.

**Output budget** (`max_tokens`, before the session's ×3 for `ds`):

| card | returns | `max_tokens` |
|---|---|---|
| init-project | initProject.ts ≈ 3.5 KB (reference 3.4 KB) | 12 000 |
| parse-command | types.ts + parse.ts + main.ts ≈ 23.5 KB, three whole files | 28 000 |
| init-project-judge | ≈ 6 KB new file (5 examples, the tree, modes) | 16 000 |
| parse-command-judge | the whole patched file ≈ 26 KB | 28 000 |
| main-judge | ≈ 3 KB new file | 16 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- **Layer scaffold** (guard, P18): imports no other `src/` layer; of the Node modules only `node:fs`, `node:path`,
  `node:url` (NODE_ONLY); NO_CLOCK (no `Date`), NO_ENV (no `process.env`); no `fetch`, no `process`, no `console`, no
  `node:child_process`.
- A file a card writes is in no sibling's slice in the same generation: generation 0 (init-project) reads no P18 file;
  generation 1 (parse-command reads initProject.ts; init-project-judge reads initProject.ts, no cli file); generation 2
  (parse-command-judge, main-judge read the cli files, not each other's test).
- Tests write only under `tmpRoot()` and remove it in `finally`; IP 2 and the probe read the fixture tree but never write
  under it (the roots are tmp); no JS timer; no network; a judge writes only its targets.

## 7. Out of scope

- An acceptance builder for python (`morph plan --checks` on a python Component): a builder Component change; the python
  smoke uses map acceptances (§8). Queued nowhere; named in the issue's smoke report.
- `morph init` into a non-empty directory (merge, `--force`), template variables beyond the three placeholders, a
  template folder outside Morph's package fetched from the network, a per-file template engine.
- Packaging MorphV2 itself (npm `files`, publishing `templates/` with the package): the operator's next step after this
  phase ("MorphV2 готов к упаковке", PLAN).
- The `.claude/agents/` orchestrator agents and the skills (their text names models and this repository's history).
- `morph report`, `deck add|status|reset|clear` (still NotYetError).

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component scaffold --component cli \
  --judge --checks decks/p18/checks.json --out decks/p18/deck.json
python3 decks/p18/filter.py decks/p18/deck.json                  # keeps the 5 cards of the phase
python3 decks/tools/scale_tokens.py decks/p18/deck.json 3        # processor ds
node dist/cli.js deck check --root . --deck decks/p18/deck.json                                   # errors 0
decks/p18/smoke/leak.sh templates                                                                  # 0 lines
rm -rf /tmp/v2bin-p18 && mkdir -p /tmp/v2bin-p18 && cp -r dist /tmp/v2bin-p18/ && ln -s $PWD/node_modules /tmp/v2bin-p18/node_modules \
  && ln -s $PWD/templates /tmp/v2bin-p18/templates
node /tmp/v2bin-p18/dist/cli.js run --root . --deck decks/p18/deck.json --processor ds --deadline 2400
```

No mrph cross-check (operator 08.10). The `templates` link makes `defaultTemplatesDir()` of the copy
(`/tmp/v2bin-p18/dist/scaffold/initProject.js` → `/tmp/v2bin-p18/templates`) resolve; the run itself never calls `init`.

**Issue #9's smoke (the main session, after the run is merged).** `decks/p18/smoke/run.sh` with the merged binary copied
to `/tmp/v2bin-p18s/` (dist + node_modules + templates linked), per language L in typescript, go, python: `morph init
--root /tmp/p18-smoke/L --name <n> --language L [--module mini]` exit 0 and its JSON; `leak.sh` on the new project's
files; copy `decks/p18/smoke/L/` (a 2-Function `contour.yaml`, `morph-map.json`, `decks/s1/checks.json`, probes; Go's
from `tests/fixtures/go-mini`, two Functions of calc) over it; `git init`, commit; then `morph plan … --judge --checks
decks/s1/checks.json --out decks/s1/deck.json` exit 0 (python: no `--checks`, the map's acceptances) and `morph deck
check` 0 errors. **$0 up to here.** Then, the only paid step (≤ $0.02, ds): `S1_RUN=1 decks/p18/smoke/run.sh go` runs the Go
deck (4 cards: 2 code, 2 judges) with the processor env of AUTONOMY "Machine", and reports written/failed, $, minutes.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 5 (2 code, 3 judges) / 3: [init-project] [init-project-judge, parse-command] [main-judge, parse-command-judge] |
| executor bill | ≈ $0.08–0.20 on ds ×3 (P17: 7 cards incl. the three-file cli card and its whole-file judge, $0.2032); ≤ $0.35 with a re-cut; cap $5 |
| cards with regeneration | 1–2 of 5 (parse-command: three whole files, the init check order; init-project-judge: modes compared with a number, the relative-templates cwd) |
| tests after the run | 766 ± 6 in 119 files |
| first red | init-project: a write before the template check, or `localeCompare`; parse-command: `--language` lower-cased; the judges: a mode literal 0o755 |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no answer cut at its `max_tokens`; (3) after the run no
file outside §2.3's seven changed; (4) initProject.ts imports node:fs, node:path, node:url and no `src/` module; (5) this
repository's HEAD and refs unchanged by every card; (6) the smoke inits all three languages and cuts all three decks with
0 errors; the Go deck runs green on ds for ≤ $0.02.

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the MEASURE row with
its `прогоны` cell, the vitest log of every verify run; DECISIONS lines "P18 template"; the smoke's numbers (per language:
init exit and file count, plan exit and cards, deck check errors; Go: written/failed, $, minutes).

## 11. Actual

### Gate (preparation)

08.10, on the VPS, by the preparing orchestrator (Opus 5.5, fresh context, no sub-agents); no paid run, no model call.
One data commit (spec, record, map, guard layer, fixtures, templates/, checks, probes, filter, deck, smoke data,
DECISIONS). Component sizes: cli 29 260 → **28 036** (compacted first), scaffold new **6 795**. Issues: #9 only
(`P18-template`). **No split**: 5 cards.

The deck **cut by V2**: `plan --component scaffold --component cli --judge --checks decks/p18/checks.json` exit 0, 16 cards,
`decks/p18/filter.py` keeps 5; `scale_tokens.py … 3` (maxTokens 36 000 / 84 000 / 48 000 / 84 000 / 48 000); `deck check`
**0 errors, 0 warnings**, no hazards; generations `[init-project] [init-project-judge, parse-command] [main-judge,
parse-command-judge]`. Slices (deck check, slice + existing targets): 37.5–80.4 KB, the largest parse-command-judge
**80 430 B**; parse-command 61 554 B + initProject.ts written in the run (≈ 3.4 KB). No mrph cross-check (operator 08.10).

Scratch worktree from e31375c + this phase's data (removed afterwards; no watcher or worker left), the deck's own
acceptances, cards in deck order, each accepted reference committed before the next:
- **Stubs, red per example at the probe (10/10):** typed throwing stubs of initProject.ts (7/7: `Error: stub initProject
  [{"project":"acme","language":"go",…},1]`, `stub fillTemplate ["{{language}}{{module}}{{name}}{{language}}",…]`, `stub
  defaultTemplatesDir`, `stub listTemplateFiles ["/tmp/p18w/templates/common"]`); main's own cli files for parse-command
  (3/3: example 8 `…card, accept)` vs `…card, accept, init)` by the locator, example 21 the first argv `{"error":…}` vs
  `{"command":{"language":"go",…`, Main 16 `expected [ 4, [ 'morph: unknown flag: --name\n' ] ] to strictly equal [ +0, [
  'morph init: exit 0\n' ] ]`).
- **Judges before their file:** red at the guard (`… missing`, 2 of 2); the patched parse file at its old text red at the
  guard (`26 test/it calls, expected 27..29` and the 6 literals missing).
- **References green, chain seconds** (limit 250): init-project 66.3 (67.6 with the final probe), parse-command 66.4,
  init-project-judge 65.1, main-judge 66.4, parse-command-judge 64.1 — **max 67.6 s**. Final tree: `tsc`, `eslint src
  tests` clean, `vitest run` **766 / 766 in 119 files** (759 + parse 1 + the reference judges' 5 + 1). Ripple 1 of 759
  (parse.examples 8, excluded).
- **Mutants** (Init Project and the changed parse/main contracts only), each under a 120 s subprocess timeout against its
  probe: **30 mutants, 31 runs, 0.8 min, max 2.9 s, 0 timeouts**; 29 killed at once; 1 survivor closed by data
  (listTemplateFiles without its sort: a sorted walk equals code-unit order unless `x.md` sits beside `x/`; the probe row
  now holds exactly that and kills it). No known risk left.
- **templates/ leak check:** `decks/p18/smoke/leak.sh templates` → `leak: 0 lines in 34 files`; it fires on a planted
  file (P17, `/home/morph/x`, `08.10`, MorphV2: 4 lines, exit 1; versions like 22.20.5 and go 1.22 do not).
- **Issue #9's smoke rehearsed ($0, the reference binary from the scratch tree, `templates` linked beside its dist/):**
  typescript init exit 0 (27 files) · leak 0 · plan --checks exit 0 (4 cards) · deck check 0 errors; go init exit 0 (22
  files) · leak 0 · plan --checks exit 0 (4 cards) · deck check 0 errors; python init exit 0 (19 files) · leak 0 · plan
  (map acceptances) exit 0 (4 cards) · deck check 0 errors. Go deck acceptances on the smoke project: clamp-value and
  percent-of red on the empty package (`stat …/calc: directory not found`, `undefined: PercentOf`), green with a reference
  (0.6 s, 0.5 s); clamp-value-judge red at the guard before its file, green with a reference (0.8 s). TypeScript project:
  `npm install` (155 packages, 23 s), `tsc --noEmit`, `eslint tests`, `guard.mjs helpers` green; the slugify card's
  acceptance red on the missing module at tsc, green with a reference (5.4 s). The rehearsal found one data defect, fixed
  before the commit: the Go template guard's header cut left a comment line as code (`node --check` now passes on all four
  .mjs of templates/).

**Forecast** on `ds` with every maxTokens × 3: P17 ran 7 cards (the three-file cli card, its whole-file judge, 2 new
files, 3 more judges) for $0.2032; here 7 first requests (2 code × 2 variants + 3 judges), 37–80 KB in, answers 3–26 KB:
**≈ $0.08–0.20**, ≤ $0.35 with a re-cut; ≤ $1. **Gate holds.**

**Run command** (from the repo root, the binary copied first; the deck is already scaled ×3):

```
npm run build && rm -rf /tmp/v2bin-p18 && mkdir -p /tmp/v2bin-p18 && cp -r dist /tmp/v2bin-p18/ && ln -s $PWD/node_modules /tmp/v2bin-p18/node_modules && ln -s $PWD/templates /tmp/v2bin-p18/templates
node /tmp/v2bin-p18/dist/cli.js run --root . --deck decks/p18/deck.json --processor ds --deadline 2400 > /tmp/p18-run.json
```

After the merge: issue #9's smoke (§8, `decks/p18/smoke/run.sh`; the Go run with `S1_RUN=1`, ≤ $0.02), then 🧪 and the
stop for the operator.

### Run
