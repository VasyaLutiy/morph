# TASK_P31b — issue #42 (Must hold 3, ledger 3, 4, 5, 8) and #40 item 3: imports from the record, blamed per file; layers.json leaves the templates (`src/rules/notes.ts`, `src/cli/planCommand.ts`; template guards as data)

Old-Morph scheme (the deck is cut from the record mechanically; beside it only what it cannot say — #42 ledger 7). Plan:
`docs/Plan_Epic2_Fixes.md` §P31b, §6. Previous part: `docs/TASK_P31a_guardrails.md` (§7 lists what this phase owns).
Record: Component **rules** (new Function Plan Notes; Rules Arg behaviour and examples 5–7; Layers Arg behaviour and
example 2; Plan Rules examples 4–5; Layers Arg 2–3, Plan Rules 1–2 and Plan Notes 1–2 by key in
`tests/fixtures/rules/examples.json`: a compaction, rules would be 32.1 KB, now 29.1 KB); **cli** (Plan Command
behaviour, example 20; the phase's first data commit compacted cli 30 643 B → 29 592 B); **scaffold** (Init Project
example 6). Cut with `--only` (the Components hold other Functions): the deck is a transaction. The template guards and
the removal of the template `layers.json` files are data of this phase's data commit.

## 1. Why this

- #40 item 3 (MorphStudio P9a run 2, $0 replay measured here): the `imports` extra of `checks.json` checked the whole
  package `./users` against a hand whitelist; the record's own TokenHash ("sha256 lowercase hex") and dir-mode rules
  invite `encoding/hex` and `io/fs`, so user-registry went red 3/3 and token-lookup inherited the red. The Go template
  guard also checked the non-stdlib and layer imports per PACKAGE (`go list ./<dir>`), so a package-mate's import was a
  card's red. Now every import is checked per given code FILE: the standard library is narrowed only by the canonical
  rules (Pure, No Shell, No Clock, No Network, No Env, Stdlib Only — P31a), plus the record's dependencies of the card's
  Component (System.dependencies via Component.uses, as today), plus the module under the layer rule. A red names the
  importing file and line.
- Blame path (P28 rules, checked, no code change): the guard reads only the card's own targets, so its red is in that
  card's acceptance only; the line `guard: users/registry.go:5: …` matches no Tree Profile fileLine (it starts with
  "guard: "), so Blame Log blames the card whose acceptance it is — the owner of the named file. Measured: blameLog of
  that line for card user-registry → `{cards: ["user-registry"], outside: []}`; token-lookup's guard on the same tree is
  green (Rules Arg 6).
- `checks.json` `imports` extras are not derived from the record (they are a hand copy). `plan --checks` names each one in
  the document's warnings (Plan Notes): the extra keeps running (phase data), the note makes the second source visible.
  Measured 11.10: MorphStudio holds 43 such extras over 11 phases (P1–P8b), MorphV2 none.
- Ledger 3: `morph init` writes no `layers.json` (the template files are deleted); the TypeScript guard takes its allowed
  packages from the `pkgs` argument only (the record's dependencies); no template guard source holds the text
  "layers.json"; a project that still has `decks/tools/layers.json` gets the note
  "decks/tools/layers.json is not read: the record is the source; delete it" (a warning, never an error).
- Ledger 4 (single source): per rule kind (layers, dependencies, Pure, No Shell, No Clock, No Network, No Env, Stdlib
  Only; TypeScript also No Process) a record change alone changes the guard verdict, and a file beside the record
  (`decks/tools/layers.json` allowing everything, a stale `decks/tools/guardrails.json`) changes nothing. Measured with
  the guards of this data commit: `tests/fixtures/rules/single/cases.json` "then".
- Ledger 5: MorphStudio P9a run 1 (the `users` layer) and run 2 (encoding/hex, io/fs; per-file blame) are fixtures
  (`tests/fixtures/rules/p9a/`, trimmed from `/tmp/p9a-glm/repo` f85a8e7/6672229 and the run-2 archive at 0e8d7b7).
- **Ledger 8, last part — decision: the Guardrail "Frozen Tree During Run" stays prose; `frozen` stays phase data.**
  Measured (`decks/*/checks.json` of both repositories): MorphV2 42 phases — 20 with no `frozen` (the default), 20 with
  the defaults + `templates`, 2 with + `morph.config.yaml`; MorphStudio 12 phases (P1–P9a) — every one the defaults +
  the toolchain (`go.mod`, `go.sum`, `internal`, `vendor`) + the package directories that phase does not touch, a
  different list per phase (P1: none; P9a: 17). The frozen paths are one phase's inputs (which files of this phase stay
  untouched), not a rule of the project: by the criterion "beside the record only what it cannot say" they stay in
  `checks.json`, and no mapping is invented.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main**: `src/rules/guardrails.ts` — `guardContract(guard: string): number` (P31a);
  `src/builder/types.ts` — `CheckCard { id: string; smoke: number | null; extra: string | null; files: JudgeFile[] | null }`,
  `Checks { …; cards: CheckCard[] }`; `src/cards/types.js` — `Card` (`customId`, `targets: string[]`);
  `src/cli/planCommand.ts` — the `args.checks` branch (`read.checks`, the `--only` filter into `checks`, `hasFile`,
  `read.texts.guard`) and the `warnings` built after it (`loadedRecord.warnings`, the language notes, `planned.warnings`).
- **Fixtures** (all committed in the data commit):

| file | what it gives |
|---|---|
| `tests/fixtures/rules/examples.json` "Layers Arg 2", "Layers Arg 3", "Plan Rules 1", "Plan Rules 2", "Plan Notes 1", "Plan Notes 2", "Rules Arg 5"–"Rules Arg 7", "Plan Rules 4", "Plan Rules 5" | given/then texts |
| `tests/fixtures/rules/p9a/contour.yaml`, `morph-map.json` | MorphStudio P9a's record trimmed: System guardrails (prose only), users (3 Functions), registry (`uses: queue`), queue |
| `tests/fixtures/rules/p9a/tree.json` | `{"tree": {path: text}, "forbidden": {"users/registry.go": text}, "layersJson": text, "owners": {path: customId}}` — run 2's v1 answers of users/registry.go, secrets.go, tokens.go; f85a8e7's layers.json |
| `tests/fixtures/rules/single/cases.json` | `{"go"|"typescript": {"map": text, "tree": {path: text}, "file", "card", "records": {kind: record text}, "beside": {path: text}, "then": {kind: {"status": number, "stdout": string}}}}` |
| `tests/fixtures/cli/goMini.imports.checks.json` | go-mini's m1 checks, clamp-value with an extra holding `== imports` |
| `tests/fixtures/cli/examples.json` "Plan Command 20" | given/then texts |

- **Harnesses (verbatim; the judges build from them).** As `tests/rules/guardrails.examples.test.ts` (P31a):
  `const ROOT = path.resolve(fixturePath("."), "..", "..");`,
  `const GUARD = (lang: string): string => path.join(ROOT, "templates", lang, "decks", "tools", "guard.mjs");`,
  `const ENV = { ...process.env, GOFLAGS: "-mod=mod", GOPROXY: "off", GOTOOLCHAIN: "local", GOWORK: "off" };`,
  `spawnSync("node", [GUARD(lang), ...args], { cwd, encoding: "utf8", env: ENV })` → `{status, stdout}`; trees written
  with `tmpRoot().write(path, text)`; the TypeScript guard needs
  `fs.symlinkSync(path.join(ROOT, "node_modules"), r.path("node_modules"))`.
  - Rules Arg 6: `blameLog(stdout, "user-registry", T.owners, TREE_PROFILES.map((t) => t.fileLine), () => true)` —
    `blameLog` from `"../../src/cards/transaction.js"`, `TREE_PROFILES` from `"../../src/language/treeProfiles.js"`.
  - Plan Rules 4–5: `const S = planSpec({ record: R.record, map: M.map, spec: "contour.yaml", components: ["app", "lib"],
    judge: false, hasFile: () => true })` (`planSpec` from `"../../src/planner/plan.js"`; `if (!S.ok) throw …`), the
    mods argument `(S.uses["app-main"] ?? []).join(",")`; `P = planRules(R.record, M.map, false,
    "// morph-guard-contract: 3\n", lang)` (`if (!P.ok || P.layers === null || P.rules === null) throw …`); the args
    `["src", C.file, mods, JSON.stringify(P.layers), JSON.stringify(P.rules)]`.
  - Plan Command 20: the go-mini root of `tests/cli/planCommand.p31a.examples.test.ts` (its `MINI` list from
    `fixture("go-mini/" + f)`, then `contour.yaml` from `fixture("cli/goMiniGuarded.yaml")`, `decks/tools/firstdiff.mjs`
    `"// firstdiff\n"`), then `decks/m1/checks.json` from `fixture("cli/goMini.imports.checks.json")`; the args of that test
    with `out: null`.
  - Init Project 6: `initProject(t.path(language), { project: "p", language, module: null, templates: null }, "/")`;
    `fs.readFileSync(path.join(defaultTemplatesDir(), language, "decks", "tools", "guard.mjs"), "utf8")` for go and
    typescript.

### 2.2. OUTPUT data shapes

**`src/rules/notes.ts`** (NEW). Imports: `import { posix } from "node:path";` and
`import { guardContract } from "./guardrails.js";` — nothing else.

```ts
export interface NoteCard { id: string; extra: string | null; targets: readonly string[] }
export function planNotes(cards: readonly NoteCard[], layersFile: boolean, guard: string): string[];
```

The behaviour is the record's Plan Notes word for word. Pinned texts:
`"decks/tools/layers.json is not read: the record is the source; delete it"` and
`"<id>: checks.json extra 'imports' checks <dir> against a hand list; the record's rules and dependencies already govern imports per file: remove it"`
(dir = `posix.dirname(targets[0])`, `"."` when there is no target); the test `extra.includes("== imports")`; contract
`< 3` → `[]`.

**`src/cli/planCommand.ts`** (PATCH): `import { planNotes } from "../rules/notes.js";`; a `let notes: string[] = [];`
declared next to `proseOnly`; in the `args.checks` branch, right after the `--only` filter of `checks` (before the build
input): `notes = planNotes(checks.cards.map((c) => ({ id: c.id, extra: c.extra, targets: plan.cards.find((k) =>
k.customId === c.id)?.targets ?? [] })), hasFile("decks/tools/layers.json"), read.texts.guard);`; after
`warnings.push(...planned.warnings);` one more `warnings.push(...notes);`. Nothing else: the cards, the deck file, every
error and the order of the document's keys stay as they are.

**Template guards (data, this phase's data commit; not a card):** `templates/go/decks/tools/guard.mjs` checks per given
code file through its go/parser scan (no `go list`): per import the first rule that forbids it, else the module import
under the layer rule (`guard: <file>:<line>: imports <path>: the record has no 'uses' from <dir> to <target> (allowed:
…)`), else a non-stdlib import not in `mods` (`guard: <file>:<line>: imports <path>: not a dependency the record gives
this Component (allowed: the standard library[, <mods>])`); `templates/typescript/decks/tools/guard.mjs` reads no file
beside the record (its `packages` = the `pkgs` argument). Neither holds the text "layers.json".
`templates/{go,typescript}/decks/tools/layers.json` are deleted.

**Examples (the expected values).**

| example | given / then |
|---|---|
| Plan Notes 1–2 | `tests/fixtures/rules/examples.json` |
| Plan Command 20 | `tests/fixtures/cli/examples.json` |
| Layers Arg 2, Rules Arg 5 (changed: the red names the file and line) | `tests/fixtures/rules/examples.json` |
| Rules Arg 6–7, Plan Rules 4–5 (new; the code of this phase is not needed: they test the data guards with the record's arguments) | `tests/fixtures/rules/examples.json`, `cases.json` "then" |
| Init Project 6 | the record (scaffold) |

### 2.3. Names and the tests each judge writes

| module | change | code card | judge's file |
|---|---|---|---|
| `src/rules/notes.ts` | NEW | `plan-notes` | NEW `tests/rules/notes.examples.test.ts` (Plan Notes 1–2) |
| `src/cli/planCommand.ts` | PATCH | `plan-command` | NEW `tests/cli/planCommand.p31b.examples.test.ts` (Plan Command 20) |
| `templates/go/decks/tools/guard.mjs` (data) | — | — | `layer-edges-judge`: PATCH `tests/rules/layers.examples.test.ts` (Layers Arg 2's red line only; 11 tests kept) |
| templates (data) | — | — | `guardrail-rules-judge`: PATCH `tests/rules/guardrails.examples.test.ts` (Rules Arg 5's red line only; 14 tests kept) and NEW `tests/rules/guardrails.p31b.examples.test.ts` (Rules Arg 6–7, Plan Rules 4–5) |
| templates (data) | — | — | `init-project-judge`: NEW `tests/scaffold/initProject.p31b.examples.test.ts` (Init Project 6) |

One test per example. Test names: `"<Function> example <N>: <what>"`.

### 2.4. What must not break

- Byte for byte: every file but the 2 code targets and the 5 judge files. Every cut deck (cards, acceptances) is
  unchanged: Plan Notes only adds warnings to the document. A guard with no contract line (MorphV2's own hand guard)
  gets no note: every MorphV2 deck and the identity corpus (`tests/gate/identity.examples.test.ts`) stay byte for byte.
- Plan Command 1–19, Plan Rules 1–3, Layers Arg 1 and 3, Rules Arg 1–4 unchanged (measured with this data commit's
  guards: only Layers Arg 2 and Rules Arg 5 change, by their red line).
- The suite of main green, plus the 4 new files.

## 3. Acceptance

Built by `morph plan --checks decks/p31b/checks.json --only <7 ids>`. `ownGit: true`, `frozen` the defaults +
`templates`, `fullExclude` the 4 new judge files and `tests/rules/guardrails.examples.test.ts`,
`tests/rules/layers.examples.test.ts` (red on main after the data commit, by the guard's new red line, until their
judges patch them). Code cards: tsc → eslint → guard → probe `decks/p31b/parts/<id>.probe.ts` → full. Judges: lits =
example names and literals.

## 4. Constraints

- NodeNext, `.js` imports, `import type`, no `any`. **rules** is pure (MorphV2's guard: no clock, no env, no process, no
  file read; node:path only); `notes.ts` imports `./guardrails.js` only of the source. cli imports rules (allowed).
- Generations as `dependsOn` gives: plan-notes, layer-edges-judge, guardrail-rules-judge, init-project-judge (0);
  plan-command, plan-notes-judge (1); plan-command-judge (2). Each judge writes only its files; tests write only under
  `tmpRoot()`; the guard tests spawn `node` (the precedent of `tests/rules/guardrails.examples.test.ts`); the Go guard
  tests need `go` on PATH (the laptop's 1.22 with `GOTOOLCHAIN=local`, the fixtures' go.mod say `go 1.22`).

## 7. Out of scope

- **P33** (ledger 6): MorphV2's own hand guard (`decks/tools/guard.mjs`, no contract line) and its record's Guardrails
  per Component; until then MorphV2 decks get no argument and no note.
- The `imports` extras are not removed or rewritten by the binary: a note only. Their removal in MorphStudio's
  `checks.json` is the tester's step (#40 comment).
- A per-file red line that names the file in the Tree Profiles' fileLine form (so Blame Log reads the path): not
  needed while the guard reads only the card's own targets (§1); a guard that reads other files would need it.
- The Guardrail "Frozen Tree During Run" → `frozen`: decided against (§1, ledger 8): it stays prose, `frozen` phase
  data.
- `decks/tools/layers.json` of an existing project is not deleted by the binary; contract-2 guards (P30 copies) still
  read it and get no note.
- Aliases ("Standard Library Only"): still prose only (P31a §7).
- Test files: rules apply to code files only (v1); a judge test's imports keep their own rule (`tests` mode).
- The Go guard's `tests` mode, the TypeScript `helpers` and `tests` modes: unchanged.

## 9. Pre-registration

7 cards, 3 generations, transaction. First reds expected: guardrail-rules-judge (a patch of a 14-test file and a new
file of 4 guard tests), then plan-command-judge. Bill: ≈ $0.15–0.4 on ds ×3.
