# TASK_P25b — issue #23: the three findings of the P25 review (`src/scout/sessionText.ts`, `src/cli/projectConfig.ts`)

MorphV2 scheme (skill `morph-v2-orchestrator`). Cut from the P25 run branch `morph/20261011-065235` (fb91f53, not
merged); P25 and P25b merge together. Record: scout-session — Session Text (round zero skips by Run Tool's grepSkip
prefix rule, example 5 by `tests/fixtures/scout/examples.json["Session Text 5"]`); config — Load Config (a comments-only
text ≡ blank; a file that cannot be stat'ed or read → a DeckError result, examples 5–6). The Components hold Functions
outside the phase: cut with `--only`, the deck is a transaction.

## 1. Why this

- Finding 1 (high): `roundZero` (`src/scout/sessionText.ts:123-124`) compares a file's first path segment with
  `skip.includes(first)`; P25 made `grepSkip` entries path prefixes (`src/scout/runTool.ts:164-169`) and MorphV2's own
  `morph.config.yaml` and the template ship `".morph/"`, `"decks/"`. An entry with a "/" never equals a segment, so with
  the shipped config round zero skips nothing: on MorphV2 the opening sample is 60 `.morph/runs/*/answers/*` lines.
- Finding 2 (medium): `readProjectConfig` (`src/cli/projectConfig.ts:190-191`) calls `statSync`/`readFileSync` with no
  try, above `main`'s classifier: a `chmod 000` config (EACCES) or a self-loop symlink (ELOOP, from `statSync`) crashes
  every command with a stack trace, exit 1, no document.
- Finding 3 (low): a text of comments only is YAML-empty; `parseDocument` reports "not a mapping", every command exit 2.
  Reference §8 and issue #18: "Absent, empty or `{}` = the built-in values".

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Session Text example 5** (`tests/fixtures/scout/examples.json["Session Text 5"]`): one tmpRoot, five files, one line
  each "widgetFoo lives here (<path>)\n": `.morph/runs/answer.txt`, `decks/deck.json`, `docs/PLAN.md`,
  `docs/TASK_X.md`, `src/a.ts`; `files` those five in that order; question "Rename widgetFoo everywhere.\n" (clues
  `["widgetFoo"]`); node fs; maxChars 30000. Texts measured by a spike of the prefix rule on fb91f53: 225, 281 and 411
  chars for the three skip lists.
- **Load Config example 6**: a tmpRoot r; `morph.config.yaml` a symlink to itself (`fs.symlinkSync("morph.config.yaml",
  r.path("morph.config.yaml"))`): `statSync` throws code "ELOOP"; then a regular file "version: 1\n" with mode 0o000:
  `statSync` gives a file, `readFileSync` throws code "EACCES" (measured as uid 1000; as uid 0 the read succeeds, so
  that half is skipped when `process.getuid?.() === 0`). The error's `code` is a string on Node's fs errors.

### 2.2. OUTPUT data shapes

**`src/scout/sessionText.ts`** (PATCH, `roundZero` only): `skip` is read as Run Tool's GREP reads `caps.grepSkip` in
the tree root: an entry with no "/" is `<entry>/`; a file is passed over when it starts with an entry. Everything else
(clues, hit lines, ROUND0_HITS, the chars cut, the exports) unchanged.

| skip | main (first segment) | P25b (prefix) |
|---|---|---|
| `[".morph", "decks"]` | .morph/…, decks/… skipped | the same |
| `[".morph/", "decks/", "docs/TASK_"]` | nothing skipped | .morph/…, decks/…, docs/TASK_… skipped |
| `[]` | nothing skipped | nothing skipped |

**`src/cli/projectConfig.ts`** (PATCH, `loadConfig` and `readProjectConfig` only):

| input | fb91f53 | P25b |
|---|---|---|
| loadConfig: every line blank or a comment (first non-blank char "#") | "not a mapping" | `{ok: true, config: DEFAULT_CONFIG}` |
| loadConfig: comments and a live line ("# c\nversion: 2\n") | problems | the same problems (`["version: must be 1"]`) |
| readProjectConfig: statSync or readFileSync throws e | thrown | `{ok: false, result: {code: 2, document: errorDocument(2, "DeckError", "morph.config.yaml cannot be read: " + e.code)}}` (`String(e)` when e has no string `code`) |

Exit 2 DeckError, as an invalid config: the operator fixes the file, nothing ran. `main.ts` already returns
`config.result` and runs no command; it does not change.

### 2.3. Names and the tests each judge writes

| test file | change | examples |
|---|---|---|
| `tests/scout/sessionText.examples.test.ts` | PATCH, append | Session Text 5 |
| `tests/cli/projectConfig.examples.test.ts` | PATCH, append | Load Config 5, 6 |

### 2.4. What must not break

- Byte for byte: every file but the two code targets and the two test files. Session Text examples 1–4 (bare entries)
  and Load Config examples 1–4 unchanged; with no `morph.config.yaml` every command behaves as at fb91f53.
- 970 tests in 160 files at fb91f53 (vitest); after the run 970 + the new tests.

## 3. Acceptance

Built by `morph plan --checks decks/p25b/checks.json`. `ownGit: true`, `frozen` the defaults + `templates` +
`morph.config.yaml`, `fullExclude` the two judge files.

- session-text: probe (Session Text 5; examples 3 and 4 green by design). load-config: probe (Load Config 5, 6;
  examples 1–4 green by design).
- Judges: lits = example names and values of the new rows (checks.json).
- After the run: `npm run build`, `node decks/tools/refcheck.mjs` exit 0; live smoke (round zero on MorphV2's tree with
  and without its config, `chmod 000`, comments-only).

## 4. Constraints

- NodeNext, `.js` imports, `import type`, no `any`. sessionText.ts stays pure (Cage Path and the injected fs only); it
  does not import runTool.ts. No new file, no new export.
- Every card in one generation but the judges, each on its code card.
- Tests write only under `tmpRoot()` and remove it; no JS timer; no network; each judge writes only its file.

## 7. Out of scope

- The GREP lift rule for a caged dir (round zero has no dir); Run Tool, Run Scout and `main.ts` unchanged.
- A YAML document of only `---`, `...`, `~` or `null`: still "not a mapping" (only blank and `#` lines are empty).
- Other read faults of the config's directory (`--root` a regular file: the command's own error, as at fb91f53).
- Generations 2–3 of issue #18; the GREP `/…/` delimiter parse note.
