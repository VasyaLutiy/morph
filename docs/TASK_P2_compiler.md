# TASK_P2 — the compiler (`src/compiler/`)

> Phase P2 of `docs/PLAN.md`, Component `compiler` of `contour.yaml` (the record's four
> Functions: Compile Card, Output Directive, Capture Inputs, Parse Answer; three Data
> Objects: Request, Input Digest, Parsed Answer). Pure TypeScript under `src/compiler/`:
> turn a `Card` and the files it names into provider-neutral requests, one per variant;
> digest the declared inputs; render the output directive; parse a model answer back into
> target contents. Reads the slice and target files under a `root` it is given; never
> the network, never git, never the clock, never `process`. Built by the old Morph
> (`mrph`) on glm; judge cards write the example tests.
>
> Reconciliation with the PLAN: the draft table split this Component into a P2
> "response" (splitSections, checkFences, stripFraming, matchTargets) and a P5
> "compiler" (digestInputs, gatherSlice, buildMessages, renderRetry). The record wins:
> this phase is the Component `compiler` as written, Parse Answer included. Of the
> draft's P5, `renderRetry` is not in the record and stays with the run loop (§7).

## 1. Why this

Every request the run loop will ever send is built here, and every answer it receives
is parsed here. On the old Morph the two cheapest-looking rules of this Component cost
the most paid attempts: a single-target answer written verbatim "prose and all" because
no fence was found (run 20260920-145542, the card burned an attempt and passed only on
regeneration); a cut-off fence written to disk as the literal ```` ```python ```` line,
"a full paid batch each" on every attempt until fence parity was counted
(`cards/generations.py`, `is_truncated_response`); a copied `---` framing line that cost
`store-v6` an attempt on 2026-09-28. The PLAN names a fourth risk for this phase: a
digest literal in the record that was never computed. So every rule here is pinned as a
string or a counted result, every digest in §2.1 was computed with `sha256sum` before it
was written down, and every answer shape has a fixture with a counted outcome. PLAN rows
P2 + P5: 8 cards each, forecast $0.6 + $0.8; this cut is 8 cards (4 code, 4 judge).

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **A card** — the input of `compileCard` and `captureInputs` is ONE `Card` of
  `src/cards/types.ts` (P1, accepted), never a JSON object and never an array: a test
  obtains it with `validateCard(fixtureJson("compiler/cards/<name>.json"))` from
  `src/cards/model.ts` and narrows `if (!r.ok) ...`; the fixture files hold one card
  object each. The second parameter is `root`, an absolute directory; every path of the
  card is `path.join(root, p)`. Never `process.cwd()`.
- **The project tree** `tests/fixtures/compiler/project/` — the `root` of the Compile
  Card examples (`fixturePath("compiler/project")`). Three regular files, nothing else:
  - `docs/A.md`, 16 bytes, 3 lines: `# A`, empty, `Alpha doc.`; sha256 prefix
    `5ab70d8e40bc35ca`.
  - `docs/B.md`, 15 bytes, 3 lines: `# B`, empty, `Beta doc.`; `18fe47246e49d6ea`.
  - `src/x.ts`, 60 bytes, 3 lines `export const x = 1;` / `y = 2;` / `z = 3;`;
    `73ab5a7f1128f2bb`.
  - `docs/missing.md`, `src/a.ts`, `src/z.ts` do **not** exist under it.
- **Card files** `tests/fixtures/compiler/cards/*.json`, one card object each, and what
  `compileCard(card, fixturePath("compiler/project"))` returns on them, counted:
  - `generateA.json` — Compile Card example 1 exactly: `a`, `generate`, targets
    `["src/a.ts"]`, contextSlice `["docs/B.md", "docs/A.md"]`, instruction
    `Write src/a.ts.`, variants 2 → `ok`, **two** Requests `a.v1`, `a.v2`, each with
    **three** user messages: `[0]` docs/A.md, `[1]` docs/B.md, `[2]` instruction +
    directive (§2.2 gives the bytes); `inputs` has three keys in this order: `docs/A.md`
    `5ab70d8e40bc35ca`, `docs/B.md` `18fe47246e49d6ea`, `src/a.ts` `absent`.
  - `patchP.json` — Compile Card example 2 exactly: `p`, `patch`, targets
    `["src/x.ts"]`, contextSlice `["docs/A.md"]`, instruction `Patch src/x.ts.`,
    variants 1 → `ok`, **one** Request `p.v1` with **three** messages: `[0]` the
    original of src/x.ts (its 3 lines fenced), `[1]` docs/A.md, `[2]` instruction +
    directive; `inputs` `docs/A.md` `5ab70d8e40bc35ca`, `src/x.ts` `73ab5a7f1128f2bb`.
  - `missingSlice.json` — Compile Card example 3 exactly: `m`, `generate`, targets
    `["src/a.ts"]`, contextSlice `["docs/missing.md"]` → **not ok**, exactly **one**
    fault, key `contextSlice`, message `contextSlice 'docs/missing.md' does not exist`;
    no Request (there is no `requests` key on a failed result).
  - `patchNew.json` (§2.2, no record example): `n`, `patch`, targets
    `["src/x.ts", "src/z.ts"]`, no contextSlice → `ok`, one Request `n.v1`, three
    messages: `[0]` the original of src/x.ts, `[1]` the "new file" line for src/z.ts,
    `[2]` instruction + the several-targets directive; `inputs` `src/x.ts`
    `73ab5a7f1128f2bb`, `src/z.ts` `absent`.
  - `digest.json` — the card of both Capture Inputs examples: `d`, `generate`, targets
    `["tests/x.test.ts"]`, contextSlice `["src/x.ts"]`. Its root is the next bullet.
- **The digest tree has no fixture**: `tsconfig.json` (P0, frozen) includes `tests`, so
  every `.ts` under `tests/fixtures/` is type-checked by `tsc`, and a file holding the
  bytes `a\n` is not TypeScript. The `root` of Capture Inputs example 1 is therefore a
  `tmpRoot()` into which the test writes `src/x.ts` with exactly the bytes `a\n`
  (`r.write("src/x.ts", "a\n")`; 2 bytes; `printf 'a\n' | sha256sum` =
  `87428fc522803d31065e7bce3cf03fe475096631e5e07bbd7a0fde60c4cf25c7`) and nothing else,
  so `tests/x.test.ts` is absent. `captureInputs(digest card, r.root)` → exactly two
  keys, in this order: `src/x.ts` `87428fc522803d31`, `tests/x.test.ts` `absent`; as
  JSON `{"src/x.ts":"87428fc522803d31","tests/x.test.ts":"absent"}` (the record's
  literal, single quotes rendered as JSON). Capture Inputs example 2 continues in the
  same root: rewrite `src/x.ts` (e.g. `b\n`), capture again, and
  `compareCaptures(before, after)` → exactly `["src/x.ts"]`. The test removes the root.
  The only `.ts` under `tests/fixtures/compiler/` is `project/src/x.ts`, valid
  TypeScript on purpose.
- **Answers** `tests/fixtures/compiler/answers/*.md` — the first parameter of
  `parseAnswer(answer, targets)` is the **whole file as text** (`fixture("compiler/
  answers/<name>.md")`), the second the targets array; `A` below is `["src/a.ts"]`, `AT`
  is `["src/a.ts", "tests/a.test.ts"]`. Every file is synthetic (the old Morph's archive
  keeps no raw answers); each is written in the shape the record describes. Counted:
  - `single.md`, 29 bytes, no trailing newline — Parse Answer example 1 exactly:
    ```` ```ts\nexport const a = 1;\n``` ````. With `A` → `files`, one key `src/a.ts`,
    content exactly `export const a = 1;\n` (20 bytes, 1 line).
  - `missingSection.md`, 45 bytes — Parse Answer example 2: one section `FILE: src/a.ts`
    with one fenced block. With `AT` → `corrupt` exactly
    `missing section for tests/a.test.ts`.
  - `truncated.md`, 105 bytes — Parse Answer example 3: two `FILE:` sections, the second
    fence never closed, **three** fence lines. With `AT` (and with `A`) → `truncated`
    `true`.
  - `twoFiles.md`, 199 bytes, 4 fence lines: sections `src/a.ts` then `tests/a.test.ts`,
    a blank line between. With `AT` → `files` with two keys in targets order: `src/a.ts`
    = `export const a = 1;\n` (20 bytes); `tests/a.test.ts` = 121 bytes, 6 lines,
    starting `import { test, expect } from "vitest";`. With `A` → `files` `src/a.ts` =
    `export const a = 1;\n` (single target: the first fenced block, FILE lines ignored).
  - `proseSingle.md`, 98 bytes: a sentence, a blank line, one fenced block, a blank line,
    a sentence. With `A` → `files` `src/a.ts` = `export const a = 1;\n`. With `AT` →
    `corrupt` `missing section for src/a.ts` (no section at all).
  - `proseTwoFiles.md`, 275 bytes: prose before, between and after the two sections of
    `twoFiles.md`. With `AT` → the same two files as `twoFiles.md`, byte for byte.
  - `outsideTargets.md`, 91 bytes: sections `src/a.ts` and `src/b.ts`. With `AT` →
    `corrupt` exactly `extra section for src/b.ts`.
  - `leadingDashes.md`, 34 bytes: one fenced block whose first line is `---`. With `A` →
    `files` `src/a.ts` = `export const a = 1;\n` (the `---` line dropped).
- **Types**: everything in §2.2 is defined in `src/compiler/types.ts`, written in this
  phase by the card that owns `src/compiler/capture.ts`; `Card`, `Fault`, `Reasoning`
  come from `src/cards/types.ts`. Every other module of `src/compiler/` imports with
  `import type { ... } from "./types.js"` and `"../cards/types.js"`; tests import from
  `../../src/compiler/types.js`.
- **Test helpers**: `tests/helpers.ts` (P0): `tmpRoot()` (`root`, `write(rel, text)`,
  `read`, `exists`, `rm()`), `fixture(name)` text, `fixtureJson(name)` parsed,
  `fixturePath(name)` absolute path under `tests/fixtures/`. Tests write nowhere else.

### 2.2. OUTPUT data shapes

`src/compiler/types.ts` exports exactly these names (types only, no values):

```ts
import type { Fault, Reasoning } from "../cards/types.js";
export type Role = "system" | "user" | "assistant";
export interface Message { role: Role; content: string }
export interface Request {
  customId: string;            // "<cardId>.v<n>", n from 1
  model: string | null;        // Card.model
  maxTokens: number | null;    // Card.maxTokens
  reasoning: Reasoning | null; // Card.reasoning
  messages: Message[];
}
export type InputDigest = Record<string, string>;   // 16 hex chars or "absent"; keys sorted
export type CompileResult =
  | { ok: true; requests: Request[]; inputs: InputDigest }
  | { ok: false; faults: Fault[] };
export type ParsedAnswer =
  | { files: Record<string, string> }
  | { corrupt: string }
  | { truncated: true };
```

**Fenced block** (internal to `compile.ts`, pinned because messages carry it): for a
path `p` and content `c`, the tag is `path.posix.extname(p)` without its dot (`ts`,
`md`, `json`; a path with no extension gets no tag, so the opening line is just
```` ``` ````); the block is the opening line ```` ```<tag> ````, a newline, `c` with one
`\n` appended when `c` is non-empty and does not already end in `\n`, then the closing
```` ``` ```` with **no** newline after it. An empty file renders as ```` ```ts\n``` ````.
Contents are read as UTF-8 text and never altered.

**`outputDirective(targets: string[]): string`** (`src/compiler/directive.ts`). Exactly
one of two texts, no trailing newline:

- one target `p`: `Answer with the complete new content of <p> in one fenced block and
  nothing else.` — e.g. `Answer with the complete new content of src/a.ts in one fenced
  block and nothing else.`
- two or more targets: ``Answer with one section per file, each starting with a line
  `FILE: <path>` followed by one fenced block; every target exactly once, no other text.
  The targets, in this order: <p1>, <p2>.`` — the first sentence verbatim with the
  literal placeholder `<path>` inside backticks, then the targets joined by `, ` in the
  array's order, then a full stop. For `["src/a.ts", "tests/a.test.ts"]` the text ends
  `The targets, in this order: src/a.ts, tests/a.test.ts.` and contains the literal
  `FILE: ` once.
- empty `targets`: throws an `Error` whose message starts with `outputDirective`.

**`captureInputs(card: Card, root: string): InputDigest`** (`src/compiler/capture.ts`).
The paths are `card.contextSlice` and `card.targets`, distinct as strings, **sorted**
(default string order); for each, `path.join(root, p)`: a regular file → the sha256 of
its bytes as lower-case hex, the **first 16 characters**; anything else (missing, a
directory) → the string `absent`. The object is built with the keys in that sorted
order, so `JSON.stringify` prints them sorted. No path is a fault here: `absent` is a
value. `node:crypto` `createHash("sha256")`, `node:fs`, `node:path` only.

**`compareCaptures(before: InputDigest, after: InputDigest): string[]`** (same
module). The sorted union of both key sets; a key is **changed** when
`before[key] !== after[key]` (a key present on one side only is changed). Returns the
changed keys sorted. Equal captures → `[]`.

**`compileCard(card: Card, root: string): CompileResult`** (`src/compiler/compile.ts`).

1. Faults first, all at once, in sorted path order: every `contextSlice` entry that is
   not a regular file under `root` → `{key: "contextSlice", message: "contextSlice
   '<p>' does not exist"}` when nothing exists at the path, `"contextSlice '<p>' is not a
   file"` when something does (a directory); under `patch`, a target that exists but is
   not a regular file → `{key: "targets", message: "targets '<p>' is not a file"}`
   (in `targets` order, after the slice faults). Any fault → `{ok: false, faults}` and
   nothing else is computed. A missing **target** is never a fault.
2. Messages, every one `role: "user"`, in this order:
   - `patch` only: one message per `card.targets` entry, in the **array's order**: an
     existing target → `Original file <p>:` + `\n` + its fenced block; a target that
     does not exist → exactly `Target <p> is a new file: it does not exist yet.` (one
     line, no fence). Under `generate` targets produce no message, whether or not they
     exist.
   - one message per `contextSlice` entry in **sorted** path order (the array's order is
     irrelevant): `Contents of file <p>:` + `\n` + its fenced block. A slice entry that
     is also a target is sent again here (no de-duplication).
   - last: `card.instruction` + `\n\n` + `outputDirective(card.targets)`.
   So for `generateA.json` (§2.1) `messages[0].content` is exactly
   ```` Contents of file docs/A.md:\n```md\n# A\n\nAlpha doc.\n``` ```` (53 bytes),
   `messages[1].content` the same for `docs/B.md` (52 bytes), and `messages[2].content`
   is `Write src/a.ts.\n\nAnswer with the complete new content of src/a.ts in one fenced
   block and nothing else.`; for `patchP.json` `messages[0].content` is exactly
   ```` Original file src/x.ts:\n```ts\nexport const x = 1;\nexport const y = 2;\nexport const z = 3;\n``` ````
   (93 bytes).
3. Requests: `card.variants` of them (`variants` is ≥ 1 by `validateCard`), `customId`
   `<card.customId>.v<n>` for n = 1 … variants, `model`, `maxTokens`, `reasoning` copied
   from the card, `messages` **identical** across variants (equal under
   `JSON.stringify`; each Request holds its own array and message objects, nothing
   shared). No `system` message is added by this phase.
4. `inputs` = `captureInputs(card, root)`.

`{ok: true, requests, inputs}`. Byte-identical for the same tree: no clock, no
randomness, no environment.

**`parseAnswer(answer: string, targets: string[]): ParsedAnswer`**
(`src/compiler/parse.ts`). `targets` is `card.targets` (non-empty; an empty array throws
an `Error` whose message starts with `parseAnswer`). Rules, applied in this order:

1. Every `\r\n` in `answer` becomes `\n`; the text is split on `\n` into lines.
2. A **fence line** is a line that starts with ```` ``` ```` at column 0 (any tag after
   it; no leading whitespace). An **odd** count of fence lines in the whole text →
   `{truncated: true}`, whatever the targets and before any other rule. The count
   includes every fence line, inside sections or not.
3. A **fenced block** is the lines strictly between a fence line and the next fence
   line; its **body** is `""` when there are no such lines, else those lines joined by
   `\n` plus a final `\n`. So ```` ```ts\nexport const a = 1;\n``` ```` has the body
   `export const a = 1;\n`, and ```` ```ts\n``` ```` has the body `""`.
4. **One target**: the content is the body of the **first** fenced block if the text
   has any fence line, else the **whole** text (step 1's form, untouched, prose and
   all). `FILE:` lines are not interpreted. Then rule 6.
5. **Two or more targets**: walking the lines with the fence state of rule 2, a line
   **outside** a fence that starts with `FILE:` opens a section whose path is the rest
   of the line, trimmed, with any surrounding backticks or quotes removed
   (`rest.trim().replace(/^[`"']+|[`"']+$/g, "")`). Lines before the first section are
   ignored; a `FILE:` line inside a fence is content. A section's content is the body
   of the **first** fenced block that follows its `FILE:` line and precedes the next
   section; anything else in the section (prose, a second fenced block) is ignored. Then
   exactly one of, checked in this order, the first that applies:
   - a path opened twice → `{corrupt: "duplicate section for <p>"}` (the second
     occurrence);
   - a section whose path is not in `targets` (compared as strings, no normalisation)
     → `{corrupt: "extra section for <p>"}` (first in answer order);
   - a target with no section → `{corrupt: "missing section for <p>"}` (first in
     `targets` order; an answer with no `FILE:` line at all names the first target);
   - a section with no fenced block → `{corrupt: "no fenced block for <p>"}` (first in
     `targets` order);
   - otherwise `{files}` with one key per target, **in `targets` order**, after rule 6.
6. **The `---` rule**, for any target extension: if the first line of a content (up to
   its first `\n`, or the whole content when it has none) is `---` after trimming
   whitespace, that line and its `\n` are removed; nothing else is stripped and only the
   first line is considered. `---\nexport const a = 1;\n` → `export const a = 1;\n`;
   `---` alone → `""`.

Result shapes: `{files: {...}}`, `{corrupt: "<reason>"}`, `{truncated: true}` — one key
each, never mixed. The corrupt reasons are exactly the four strings above with the path
substituted.

### 2.3. Names

| module | exports | author's smoke test | judge's test |
|---|---|---|---|
| `src/compiler/types.ts` | the types of §2.2, no values | — | — |
| `src/compiler/capture.ts` | `captureInputs`, `compareCaptures` | `tests/compiler/capture.test.ts` | `tests/compiler/capture.examples.test.ts` |
| `src/compiler/directive.ts` | `outputDirective` | `tests/compiler/directive.test.ts` | `tests/compiler/directive.examples.test.ts` |
| `src/compiler/parse.ts` | `parseAnswer` | `tests/compiler/parse.test.ts` | `tests/compiler/parse.examples.test.ts` |
| `src/compiler/compile.ts` | `compileCard` | `tests/compiler/compile.test.ts` | `tests/compiler/compile.examples.test.ts` |

Imports between them: every module imports its types from `./types.js` and
`../cards/types.js` (types only); `compile` imports `captureInputs` from `./capture.js`
and `outputDirective` from `./directive.js`; `directive` and `parse` import no module
with a value. Node modules: `node:fs`, `node:path`, `node:crypto` in `capture`;
`node:fs`, `node:path` in `compile`; none in `directive`, `parse`, `types`. Nothing
under `src/compiler/` imports `src/cards/model.ts` or anything outside `src/cards/` and
`src/compiler/`.

A judge's test file holds one `test(...)` per example of its Function, in record order,
named `<Function> example <n>: <what>` (e.g. `Parse Answer example 2: missing section`),
then at most twelve more tests of its own on §2.2. Message contents are compared with
`toBe` against the exact strings of §2.2 (short ones) or by `startsWith`/`length` for
the long ones; a `ParsedAnswer` is narrowed with `"files" in r` / `"corrupt" in r` /
`"truncated" in r` and the other branch fails with `expect.unreachable`, never a cast;
the digest object as `JSON.stringify(got)` against the record's literal.

### 2.4. What must not break

- The P0 scaffold (`package.json`, `package-lock.json`, `tsconfig*.json`,
  `vitest.config.ts`, `eslint.config.js`, `tests/setup.ts`, `tests/helpers.ts`,
  `src/index.ts`) and the whole of P1 (`src/cards/*`, `tests/cards/*`): untouched, byte
  for byte.
- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/` — untouched.
- `tsc --noEmit`, `eslint src tests`, `vitest run` green on the whole tree after every
  generation; the 57 tests of P0–P1b stay green.

## 3. Acceptance

Built by `decks/tools/build.py p2` into the `acceptance` of every P2 card in
`morph-map.json`; `mrph plan --spec` copies it onto the card. Narrow to broad, every
step printing a readable line on failure; the first red is the regeneration's diagnosis.

Code cards (`src/compiler/<m>.ts` + `tests/compiler/<m>.test.ts`; `capture-inputs`
also `src/compiler/types.ts`):

1. `probe/<card>/`: the guard, a vitest config, and `tsconfig.card.json` extending
   `../../tsconfig.json` that **excludes the targets of the other cards of the same
   generation** (P1's operator decision, neighbour-red 0 of 8); removed on exit.
2. `node_modules/.bin/tsc --noEmit -p probe/<card>/tsconfig.card.json`.
3. `node_modules/.bin/eslint <the card's targets>`.
4. `guard.mjs src <the card's code targets>` (layer `compiler` imports only `cards`;
   no `any`, no `process`, no `Date`, no `console`, no `child_process`, no package
   imports) and `guard.mjs tests tests/compiler/<m>.test.ts 1 5` (smoke: 1–5 tests, no
   own stubs, no timers, no `.skip/.only`).
5. `decks/p2/parts/<card>.probe.ts` under vitest: one `test` per record example of the
   card's Function, values **and** types, plus the §2.2 rules the record leaves open.
6. `vitest run tests/compiler/<m>.test.ts`.
7. `vitest run` — everything in the tree.
8. Frozen: `git diff --quiet HEAD -- contour.yaml morph-map.json docs decks tests/fixtures`;
   untracked files other than the targets: none.

Judge cards (`tests/compiler/<m>.examples.test.ts`):

1. `probe/<card>/` as above (no probe file); 2. the same `tsc`; 3. `eslint <target>`;
4. `guard.mjs tests <target> <min> <max> lits.json` — `min` = the number of examples of
   the Function (Compile Card 3, Output Directive 1, Capture Inputs 2, Parse Answer 3),
   `max` = `min + 12`; `lits.json` = the example literals the test must mention
   (compile: `a.v1`, `a.v2`, `docs/A.md`, `docs/B.md`, `Original file src/x.ts:`,
   `docs/missing.md`; directive: `FILE: `, `src/a.ts`, `tests/a.test.ts`; capture:
   `87428fc522803d31`, `absent`, `src/x.ts`, `tests/x.test.ts`; parse:
   `export const a = 1;`, `missing section for tests/a.test.ts`, `truncated`);
5. `vitest run <target>`; 6. `vitest run`; 7. frozen and untracked as above.

Dense output: `--reporter=dot`, failures filtered to `^ FAIL |Error|expected|received`,
80 lines. Timeout of the whole chain 300 s (Morph's own limit); measured on a dry tree
with stubs before the gate (§9).

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
  The Node typings carry no DOM globals.
- `src/compiler/` imports `src/cards/types.ts` (types) and its own files; Node modules
  `node:fs`, `node:path`, `node:crypto` only. No `process`, no `Date`, no
  `Math.random`, no `console`, no git, no network: byte-identical results for the same
  inputs (Deterministic Core). `root` is always a parameter.
- A code card's own test is **smoke only**: at most five `test(...)`, an import, one
  happy path per exported function, one tolerant case, `toBe` on scalars and short
  strings. Completeness is the probe's and the judge's job.
- Every test writes only under a `tmpRoot()` from `tests/helpers.ts` and removes it;
  fixtures are read, never written; stubs come from `tests/helpers.ts`; no `vi.mock`,
  no real timers.
- A judge writes only its test file and never touches the module it tests.
- A file a card writes is in no sibling's slice in the same generation (`deck check`
  refuses `read-write`); a judge depends on its code card.
- Exact strings of §2.2 (message headers, the directive texts, the "new file" line, the
  fault messages, the corrupt reasons): the executor copies them, it does not rephrase.
- The two literal digests of §2.1 (`87428fc522803d31`, and the fixture prefixes) are
  computed, not copied; a test that needs another digest computes it with
  `node:crypto` in the test, never by hand.

## 7. Out of scope

- Sending a Request, provider formats (OpenRouter/OpenAI/Anthropic JSON), batch files,
  token counting, cost (P4/P7/P11/P14 `processor`).
- The retry conversation: `<acceptance_output>`, `<previous_attempt_diff>`, the
  truncated-answer retry message, regeneration (P8 `runloop`).
- Writing parsed files to disk, snapshot/restore, running the acceptance (P6
  `acceptance`); comparing a capture against the tree during a run (P8).
- A `system` message, an instruction preamble, the primer in the slice (P8/P15).
- Globs in `contextSlice`, extension filters, a "slice too large" check (P1 `weigh`
  reports size; the compiler sends what it is given), symlink resolution, binary files.
- Fence variants: `~~~` fences, fences longer than three backticks, indented fences,
  nested fences inside a slice file (a file containing ```` ``` ```` lines is sent as is).
- Stripping prose from a single-target answer that has no fence (the whole text is the
  file, as the record says); a trailing `---` line; path normalisation of an answered
  path (`./src/a.ts` is an extra section).
- Per-variant differences (temperature, seeds); `variants` beyond copying the messages.

## 8. How to run

```
python3 decks/tools/build.py p2                       # injects acceptances into morph-map.json
cd /home/john/Documents/Work2026/MorphProject/morph-lab
venv/bin/mrph plan --root /home/john/Documents/Work2026/MorphV2 --spec contour.yaml --map morph-map.json --component compiler --judge          # dry
venv/bin/mrph deck clear --root /home/john/Documents/Work2026/MorphV2 && venv/bin/mrph deck reset --root /home/john/Documents/Work2026/MorphV2
venv/bin/mrph plan --root /home/john/Documents/Work2026/MorphV2 --spec contour.yaml --map morph-map.json --component compiler --judge --add
venv/bin/mrph deck check --root /home/john/Documents/Work2026/MorphV2
venv/bin/mrph run --root /home/john/Documents/Work2026/MorphV2 --processor glm53   # operator only
```

`mrph` reads `.env` from the current directory: run it from `morph-lab`, never from the repo.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards in the deck | 8 (4 code, 4 judge) |
| generations | 3 (capture-inputs + output-directive; parse-answer + compile-card + the two gen-0 judges; the two remaining judges) |
| executor bill | ≤ $0.40 (nominal ≈ $0.20: 12 requests at P1's ≈ $0.008, ×1.5 for regenerations, larger slices than P1 on compile-card) |
| cards with regeneration | 2 of 8 |
| `write-write` / `read-write` at `deck check` | 0 / 0 |
| tests after the run | 57 + ≥ 4 smoke files + 4 judge files; ≥ 9 judge example tests |
| first red | parse-answer: the body of a fenced block with or without the final `\n` (probe, `export const a = 1;\n`); compile-card: a `tsc` red on the `Fault` import path or the message order of `patch` (originals before the slice); a judge mentioning `FILE: ` in another spelling (guard) |

**Falsifiable claims:** (1) no card goes red on a sibling's file (per-card `tsconfig`);
(2) no judge red traces to §2.1 (every example input is named by the type the Function
takes, with its counted result) — a judge red that does is a spec defect to be listed in
§11 before any re-cut.

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), judge tests
written, defects the judge found that the probe did not (and the reverse), the row of
`docs/MEASURE.md`.

## 11. Actual

(empty until the run)
