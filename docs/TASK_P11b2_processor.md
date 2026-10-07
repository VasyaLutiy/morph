# TASK_P11b2 — detached batches: `morph submit` and `morph collect` (`src/batches/`, `src/git/archive.ts`, `src/cli/{types,parse,main}.ts`)

> Phase P11 of `docs/PLAN.md` ("Фазы по записи (после P2)", row P11b), second part **P11b2** (`docs/TASK_P11b_processor.md`
> §7 defines it). No issue is labelled `P11b2-processor` or `P11b-processor` (both lists empty, 07.10). Components of
> `contour.yaml`: **batches** (NEW: Submit Deck, Collect Batch — the processor side's second Component, PLAN rule 2: a
> record over 30 KB is two Components; its own directory `src/batches/`, its own guard layer), `git` (Archive Run:
> saveBatchAnswers), `cli` (Parse Command, Main: one routing line per command). cli was compacted first (no example's
> meaning changed). The deck is cut by V2 (`morph plan --checks decks/p11b2/checks.json`), filtered to this phase's 9 cards
> by `decks/p11b2/filter.py`. After its merge: the **smoke stop** (§8).

## 1. Why this

- **A batch holds the process for its whole wait.** `morph run` on route batch submits and polls inside one process: the
  P11 smoke waited 569 s for 2 tiny requests; the old Morph measured glm batches at 23–38 min; P11b1 set the batch-route
  TIMEOUT_MS default to 3 600 000 (1 h). An SSH drop, a reboot or a SIGINT inside that hour ends the run (P11c2: exit 3,
  the partial report archived) with the batch still billed and its answers never read.
- **The id survives since P11b1, the work does not.** `.morph/batches/<id>.json` (P11b1) keeps `{batchId, processor, model,
  customIds, status, cost}` — enough to find the batch, not to use its answers: nothing reads that file back, and no
  command sends a batch without waiting for it.
- **The cost is the same either way** ($0.0005804 for the P11 smoke's 2 requests, the batch object's `usage.cost`), so a
  detached submit loses nothing but the wait.

**Ripple, measured** (references of the 6 code files in a scratch worktree, full suite): **1 of 625** red —
`parse.examples` "Parse Command example 8" (the no-command message now lists five commands). Every other shape is new
(two files, one function, two Command members): tsc and eslint clean, 0 other tests red.

**Record sizes** (bytes of each Component block, the 30 000 rule), before → after: cli 29 996 → **29 850** (compaction
first: every cli example and `steps` list in YAML flow form — `yaml.safe_load` of the record identical before and after:
29 996 → 28 127; then the routing: +1 723), git 17 825 → **18 902**, batches new **13 034**; processor 29 969 and
runloop 29 986 untouched.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Card, Deck, Fault** — `src/cards/types.ts`; **Request, InputDigest, CompileResult** — `src/compiler/types.ts`;
  **ProcessorConfig, Transport, Registry** — `src/processor/types.ts`; **BatchCall** — `src/processor/batchRequest.ts`;
  **BatchRead** — `src/processor/batchResponse.ts`; **CliDeps, CliIo, Command, CommandResult** — `src/cli/types.ts`.
- **Functions the new code calls** (module → signature; every one exists on main):
  `readRegistry(env): Registry` and `PREFIX` ("MORPH_PROCESSOR_") — `src/processor/registry.ts`;
  `assembleBatch(requests, config): BatchCall` (url and headers; `[]` gives the batches url) — `src/processor/batchRequest.ts`;
  `readBatch(status, text): BatchRead` — `src/processor/batchResponse.ts`; `realTransport(timeoutMs): Transport` —
  `src/processor/send.ts`; `loadDeck(text): DeckResult` — `src/cards/model.ts`; `layerGenerations(deck): string[][]` —
  `src/cards/layer.ts`; `compileCard(card, root): CompileResult` — `src/compiler/compile.ts`; `captureInputs(card, root):
  InputDigest`, `compareCaptures(before, after): string[]` — `src/compiler/capture.ts`; `saveBatchRecord(root, record:
  {batchId: string}): string | null` (P11b1) and `saveBatchAnswers` (§2.2) — `src/git/archive.ts`; `submitDeck`,
  `collectBatch` (§2.2) — `src/batches/`.
- **Fixtures** (`tests/fixtures/`), each by the type the Function takes:

| file | type | what it is | what the Function returns on it |
|---|---|---|---|
| `batches/deck.json` | text of ONE deck file (array of 3 cards) | clamp-value → out/clamp.ts (contextSlice docs/clamp.md), sign-of → out/sign.ts, later dependsOn both; each with an acceptance | Submit Deck 1: requests clamp-value.v1, sign-of.v1; deferred ["later"] |
| `batches/submitted.json` | text of ONE state file | the Submitted Batch Submit Deck 1 saves (indent 2 + "\n"; status validating, cost null, deck "d.json", submittedAt 1791400000000, the 2 cards with defaults, inputs: docs/clamp.md "0acba86238043b8c", targets "absent") | Collect Batch 1–6 read it from `.morph/batches/<id>.json` |
| `batches/collected.json` | text of ONE state file | submitted.json after Collect Batch 1: status completed, cost 0.0005804, collectedAt 1791400600000, files (2 paths) | — (expected text) |
| `batches/documents.json` | ONE object | `"Submit Deck 1"`, `"Collect Batch 1"`: the two documents | — (expected values) |
| `cli/parseArgv.json`, `cli/parse.json` | ONE object each | keys 14 (2 argv) and 15 (7 argv) added; `parse.json["8"]` second result now names five commands | Parse Command 14, 15 |
| `processor/batchSubmittedLive.json` (P11b1) | text of ONE batch object | the live batch at submit: id `batch-1791388269-cp5qOr5IQ0xoz1ntuc8W`, status validating | Read Batch: pending |
| `processor/batchCompletedLive.json` (P11b1) | text of ONE batch object | the live completed batch: results sign-of.v1 then clamp-value.v1 (165 and 114 chars), usage.cost 0.0005804 | Read Batch: done, cost 0.0005804 |
| `processor/batchInProgress.json`, `batchFailed.json`, `batchNotFound.json`, `noBatchEndpoint.json`, `batchCompleted.json` (P11) | text of ONE reply | in_progress; failed with error.message; a 404 body; a 400 submit; completed c.v1, a.v1, b.v1 | Read Batch: pending; failed; error; error; done |
| `cli/batch.r9.json` (P11b1) | text of ONE file | a run's Batch Record (no cards) | Collect Batch 4: "not a submit's state: cards" |

**Distinct markers.** Batch ids `batch-1791388269-cp5qOr5IQ0xoz1ntuc8W` (live) and `batch-1789576284-Ejahe4wq9AgVdp5xGdNm`
(P11; probe), `batch-none`, `batch-0`, `q.1`; processors `b`, `night`, `s`, `o`, `zz`; batch models `acme/m:batch`,
`x/y:batch`; base urls OpenRouter's default and `http://127.0.0.1:9/v1`; keys `sk-or-test`, `sk-2`; clocks
1791400000000, 1791400600000, 42, 7, 5; deck paths `d.json`, `decks/q.json` — the code must hard-code none of them.

**A judge's setup across Components** (TASK_TEMPLATE §2.1):

- **F1** processor · readRegistry needs MORPH_PROCESSOR_<id>_TYPE openrouter, _MODEL, _API_KEY and _ROUTE batch for a batch
  config (a stub or a sync processor is refused); the url is `https://openrouter.ai/api/beta/batches` for the default
  BASE_URL · SD 1, CB 1.
- **F2** compiler · a contextSlice file must exist or the card is refused "compile: contextSlice '<p>' does not exist";
  Capture Inputs digests every contextSlice path and target (a missing one is "absent"), so writing `docs/clamp.md` with
  other text, or creating a target, makes the card stale · SD 1, 3, CB 1, 3.
- **F3** git · `saveBatchRecord(t.root, s)` writes `JSON.stringify(s, null, 2) + "\n"` (the fixture texts are exactly
  that); `saveBatchAnswers(t.root, id, a)` writes `<id>/<customId>.md` · SD 1, CB 1–3, Main 8.
- **F4** cards · Load Deck fills every default (contextSlice [], model, maxTokens, reasoning null, variants 1, dependsOn
  []), so the state's cards are whole Card objects · SD 1.

**Harness skeleton** (≤ 10 lines, only from `tests/helpers.ts` and the types; the same in submit, collect and main tests):

```ts
type Step = Error | { status: number; text: string };
const ok = (status: number, name: string): Step => ({ status, text: fixture("processor/" + name) });
function script(steps: Step[]) { const calls: { url: string; method: string; headers: Record<string, string>; body: string | undefined }[] = [];
  const transport: Transport = { fetch: async (url, init) => { calls.push({ url, method: init.method, headers: init.headers, body: init.body });
      const s = steps[Math.min(calls.length, steps.length) - 1]; if (s instanceof Error) throw s; return { status: s.status, text: async () => s.text }; },
    sleep: async () => undefined }; return { transport, calls }; }
const ENV = { MORPH_PROCESSOR_b_TYPE: "openrouter", MORPH_PROCESSOR_b_MODEL: "acme/m:batch", MORPH_PROCESSOR_b_API_KEY: "sk-or-test", MORPH_PROCESSOR_b_ROUTE: "batch" };
const deps = (t: TmpRoot, transport: Transport, now: number): DetachedDeps => ({ env: ENV, now: () => now, transport,
  saveState: (s) => saveBatchRecord(t.root, s), saveAnswers: (id, a) => saveBatchAnswers(t.root, id, a) });
// setup: t = tmpRoot(); t.write("docs/clamp.md", "Clamp a value.\n"); submit: t.write("d.json", fixture("batches/deck.json"));
// collect: t.write(".morph/batches/<id>.json", fixture("batches/submitted.json")); main: CliDeps {env: ENV, now, cwd: "/", transport}
```

### 2.2. OUTPUT data shapes

**`src/batches/submit.ts`** (NEW, layer batches) — exports, in this order:

```ts
export interface SubmittedBatch {
  batchId: string; processor: string; model: string; customIds: string[]; status: string; cost: number | null;
  deck: string; submittedAt: number; cards: Card[]; inputs: Record<string, InputDigest>;
  collectedAt?: number; files?: string[];
}
export interface DetachedDeps {
  env: Record<string, string>; now: () => number; transport: Transport | null;
  saveState(state: SubmittedBatch): string | null;
  saveAnswers(batchId: string, answers: { customId: string; text: string }[]): string[];
}
export interface DetachedResult { code: 0 | 1 | 2 | 3 | 4; document: unknown }
export interface SubmitDocument {
  batchId: string; processor: string; model: string; customIds: string[]; status: string;
  deferred: string[]; refused: { customId: string; reason: string }[]; state: string;
}
export function refusal(code: 0 | 1 | 2 | 3 | 4, kind: string, message: string): DetachedResult; // {code, document: {error: {code, kind, message}}}
export function batchConfig(env: Record<string, string>, id: string): ProcessorConfig | DetachedResult;
export async function submitDeck(root: string, deckPath: string, processor: string, deps: DetachedDeps): Promise<DetachedResult>;
```

**Submit Deck** — the record's behaviour, in this order, every refusal before any call:

1. `batchConfig(deps.env, processor)`: no config with that id → 4 UsageError `processor <id> is not configured` + (`: ` +
   the messages of the registry faults whose key starts with `MORPH_PROCESSOR_<id>_`, `; `-joined, when any); a config whose
   type is not openrouter or route not batch → 2 RefusalError `processor <id> is not an openrouter processor on route batch`.
2. `path.resolve(root, deckPath)` not a regular file → 4 UsageError `deck file not found: <deckPath>`; Load Deck faults →
   2 DeckError `invalid deck: ` + each `<key>: <message>`, `; `-joined; no cards → 2 RefusalError `deck has no cards`.
3. The cards of `layerGenerations(deck)[0]`, in deck order; each refused with the first reason that applies: acceptance
   null or `trim() === ""` → `no acceptance`; model set and not `config.model` → `batch runs one model: <customId> pins
   <model>, the batch is <config.model>`; compileCard faults → `compile: <faults[0].message>`. A kept card adds its requests
   (in order) and its input digest. No request → 2 RefusalError `nothing to submit: ` + each `<customId> <reason>`, `; `-joined.
4. `call = assembleBatch(requests, config)`; transport = `deps.transport ?? realTransport(config.timeoutMs)`; ONE
   `transport.fetch(call.url, {method: "POST", headers: call.headers, body: call.body})`, never retried; readBatch: thrown →
   3 RuntimeError `batch submit: transport: <message>`; error read → 3 RuntimeError `batch submit: <read.error>`; batchId
   null → 3 RuntimeError `batch submit: no batch id`.
5. state = `{batchId, processor: config.id, model: config.model, customIds: the requests' ids, status: read.status ??
   "unknown", cost: null, deck: deckPath as given, submittedAt: deps.now(), cards: the kept cards, inputs: {cardId: digest}}`
   (keys in this order; `deps.now()` called once, here); `deps.saveState(state)` → the path; null → 3 RuntimeError `batch
   <batchId>: state not saved`; a throw → 3 RuntimeError `batch <batchId>: state not saved: <message>`.
6. `{code: 0, document: SubmitDocument}` with `deferred` = `layerGenerations(deck).slice(1).flat()`, `refused` in deck
   order, `state` = the saved path.

| Submit Deck example | given | result |
|---|---|---|
| 1 | deck.json, docs/clamp.md, ENV, 202 batchSubmittedLive.json, now 1791400000000 | 0, `documents.json["Submit Deck 1"]`; one POST; body model acme/m:batch, requests clamp-value.v1, sign-of.v1; state file = `submitted.json` |
| 2 | processor nope; s (stub); deck nope.json; e.json `[]` | 4 not configured; 2 not an openrouter processor on route batch; 4 deck file not found: nope.json; 2 deck has no cards; no call, no .morph |
| 3 | f.json [x model other/m, q no acceptance, k contextSlice docs/missing.md, a]; g.json [x, q] | 0, requests [a.v1], refused x, q, k (texts above); then 2 `nothing to submit: x batch runs one model: x pins other/m, the batch is acme/m:batch; q no acceptance` |
| 4 | 400 noBatchEndpoint.json; thrown Error("socket hang up") | 3 `batch submit: http 400: HTTP 400: invalid batch inference job: Model 'z-ai/glm-5.3:batch' does not have a :batch endpoint.`; 3 `batch submit: transport: socket hang up`; no .morph |
| 5 | saveState → null; saveState throws Error("disk full") | 3 `batch batch-1791388269-cp5qOr5IQ0xoz1ntuc8W: state not saved`; the same + `: disk full` |

**`src/batches/collect.ts`** (NEW, layer batches) — imports SubmittedBatch, DetachedDeps, DetachedResult, refusal and
batchConfig from `./submit.js`; exports, in this order:

```ts
export interface CollectedAnswer { customId: string; finishReason: string | null; error: string | null; chars: number | null }
export interface CollectDocument {
  batchId: string; outcome: "pending" | "done" | "failed"; status: string; cost: number | null;
  answers: CollectedAnswer[]; stale: string[]; files: string[]; state: string;
}
export async function collectBatch(root: string, batchId: string, deps: DetachedDeps): Promise<DetachedResult>;
```

**Collect Batch** — rel = `.morph/batches/<batchId>.json` (batchId already path-safe: Parse Command):

1. `path.join(root, rel)` not a regular file → 4 UsageError `batch state not found: <rel>`.
2. The text parsed as JSON; the first failing check names the refusal 2 RefusalError `batch state <rel> is not a submit's
   state: <name>`: `unreadable` (not JSON, or not an object: null and arrays included), `batchId` (not equal to the id
   asked), `processor` (not a string), `customIds` (not an array of strings), `cards` (not an array — a run's Batch
   Record), `inputs` (not a non-null, non-array object).
3. `batchConfig(deps.env, state.processor)` — its refusal as is.
4. `call = assembleBatch([], config)`; transport as Submit Deck; ONE `transport.fetch(call.url + "/" + batchId, {method:
   "GET", headers: call.headers})` — no body key, no sleep; readBatch: thrown → 3 RuntimeError `batch <batchId>:
   transport: <message>`; error read (a 404 too: no grace) → 3 RuntimeError `batch <batchId>: <read.error>`; the state
   file untouched.
5. `read.status` (when not null) → state.status; `read.cost` (when present) → state.cost.
6. pending → `deps.saveState(state)`; `{code: 1, document: {batchId, outcome: "pending", status, cost, answers: [], stale:
   [], files: [], state: rel}}`. Nothing else is written.
7. done or failed → `stale` = the customId of every card of state.cards whose `compareCaptures(state.inputs[id] ?? {},
   captureInputs(card, root))` is not empty, in state.cards order. Per customId of state.customIds, in order: the first
   reply with that customId → `{customId, finishReason, error, chars: text.length or null}`, and `{customId, text}` is
   kept for writing when text is not null and its card (`customId.replace(/\.v[0-9]+$/, "")`) is not stale; no reply →
   `{customId, finishReason: null, error: "batch <batchId> <state.status>: <read.error ?? "no result">", chars: null}`.
   `files = deps.saveAnswers(batchId, kept)` (once, even with none); `state.collectedAt = deps.now()`; `state.files =
   files`; `deps.saveState(state)`. Code 0 when the read is done, stale is empty and every answer has error null and chars
   not null; else 1. Document `{batchId, outcome: read.state, status, cost, answers, stale, files, state: rel}`.

| Collect Batch example | given (state = submitted.json, ENV, now 1791400600000) | result |
|---|---|---|
| 1 | 200 batchCompletedLive.json | 0, `documents.json["Collect Batch 1"]`; one GET `…/beta/batches/<id>`, no body, Bearer sk-or-test; state file = `collected.json`; the two .md files = the live texts |
| 2 | 200 batchInProgress.json | 1, `{…, outcome: "pending", status: "in_progress", cost: null, answers: [], stale: [], files: [], state}`; state = submitted.json with status in_progress; no `<id>/` directory |
| 3 | docs/clamp.md = "Clamp it.\n"; 200 batchCompletedLive.json | 1, outcome done, stale ["clamp-value"], answers as 1, files [`…/sign-of.v1.md`] only |
| 4 | batch-none; state = batch.r9.json; state = "{"; env {} | 4 `batch state not found: .morph/batches/batch-none.json`; 2 `… is not a submit's state: cards`; the same `unreadable`; 4 `processor b is not configured`; no call |
| 5 | 404 batchNotFound.json | 3 `batch batch-1791388269-cp5qOr5IQ0xoz1ntuc8W: http 404: Batch job batch-1789576284-Ejahe4wq9AgVdp5xGdNm not found.`; state untouched |
| 6 | 200 batchFailed.json | 1, outcome failed, status failed, cost null, both answers `{finishReason: null, error: "batch batch-1791388269-cp5qOr5IQ0xoz1ntuc8W failed: HTTP 400: invalid batch inference job: job-submission-count for account acct-0000, in use: 16, quota: 16", chars: null}`, files []; collectedAt 1791400600000 |

**`src/git/archive.ts`** — `saveBatchAnswers(root, batchId, answers: {customId: string; text: string}[]): string[]`
(exported, after saveBatchRecord): batchId or any customId outside `^[A-Za-z0-9._-]+$` → `[]`, nothing written; else per
answer in order `mkdir -p <root>/.morph/batches/<batchId>` and write `<root>/.morph/batches/<batchId>/<customId>.md` = text
exactly (overwriting) → the relative paths in order; `[]` → `[]` and no directory. archiveRun and saveBatchRecord unchanged.
Archive Run example 8: `[…/clamp-value.v1.md, …/sign-of.v1.md]` with "A" and "B\n"; batchId "a b" → []; customIds x.v1,
"../y" → [] and no x.v1.md; [] with "batch-0" → [] and no directory.

**`src/cli/types.ts`** — added, Command widened; nothing else changes:

```ts
export interface SubmitArgs { name: "submit"; root: string; pretty: boolean; deck: string; processor: string }
export interface CollectArgs { name: "collect"; root: string; pretty: boolean; batch: string }
export type Command = DeckCheckArgs | RunArgs | PlanArgs | SubmitArgs | CollectArgs;
```

**Parse Command** (`parse.ts`) — `--batch` is a value flag. Words: `submit` and `collect` (arity 1). The no-command message
is `no command (commands: deck check, plan, run, submit, collect)`. Flags: submit `--root, --pretty, --deck, --processor`;
collect `--root, --pretty, --batch` (else `flag <f> does not apply to <command>`). After the plan branch: collect without
--batch → `missing --batch`; a --batch not matching `^[A-Za-z0-9._-]+$` → `--batch must match ^[A-Za-z0-9._-]+$ (got
'<v>')`; else `{name: "collect", root, pretty, batch}`. Then `missing --deck` (deck check, run, submit), `missing
--processor` (run, submit), and submit returns `{name: "submit", root, pretty, deck, processor}` (keys in this order).
Deck check, run and plan: every check, message, default and key unchanged.

| Parse Command example | argv | result |
|---|---|---|
| 8 (changed) | `[]` (second argv) | `no command (commands: deck check, plan, run, submit, collect)` |
| 14 | `["submit", "--deck", "d.json", "--processor", "b"]`; `["--pretty", "collect", "--batch", "batch-1791388269-cp5qOr5IQ0xoz1ntuc8W", "--root", "/r"]` | `{name: "submit", root: ".", pretty: false, deck: "d.json", processor: "b"}`; `{name: "collect", root: "/r", pretty: true, batch: "batch-1791388269-cp5qOr5IQ0xoz1ntuc8W"}` |
| 15 | `submit --deck d.json`; `submit --processor b`; `collect`; `collect --batch a/b`; `collect --batch x --deck d`; `submit --deck d --processor b --run-id r`; `collect --batch x extra` | `missing --processor`; `missing --deck`; `missing --batch`; `--batch must match ^[A-Za-z0-9._-]+$ (got 'a/b')`; `flag --deck does not apply to collect`; `flag --run-id does not apply to submit`; `unexpected argument: extra` |

**Main** (`main.ts`) — the routing lines: `command.name === "submit"` → `await submitDeck(root, command.deck,
command.processor, D)`; `"collect"` → `await collectBatch(root, command.batch, D)`; the run branch stays the last `else`.
`D = {env: deps.env, now: deps.now, transport: deps.transport, saveState: (s) => saveBatchRecord(root, s), saveAnswers:
(id, a) => saveBatchAnswers(root, id, a)}` (imports from `../batches/submit.js`, `../batches/collect.js`,
`../git/archive.js`). The one stdout document and the stderr line `morph <name>: exit <code>\n` as for every command;
src/cli.ts unchanged. Main 7: `["collect", "--batch", "batch-none", "--root", t]` → 4, one document `{error: {code: 4,
kind: "UsageError", message: "batch state not found: .morph/batches/batch-none.json"}}`, stderr `["morph collect: exit
4\n"]`. Main 8: Submit Deck 1's setup through main, then Collect Batch 1's transport and clock in new CliDeps → 0 and 0,
the two documents of `documents.json`, stderr `morph submit: exit 0\n`, `morph collect: exit 0\n`, the state file
`collected.json`, both answer files.

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P11b2 processor"):

- **Where the logic lives**: a new Component `batches` with `src/batches/` and its guard layer (imports cards, wait,
  compiler, processor; no env, no clock, no process) — not `src/processor/`: processor's record holds 29 969 bytes and
  PLAN rule 2 makes a 30 KB+ record two Components, CONVENTIONS makes a Component one directory; cli only routes (PLAN 07.10).
- **submit** = `morph submit --deck <file> --processor <id> [--root] [--pretty]`: the deck's FIRST generation as ONE batch
  (later generations need the earlier answers on disk: listed `deferred`), one POST, the state saved, exit 0; no wait, no
  git call (the checkout never moves), no run id or branch (a replay mints its own).
- **What submit persists**: P11b1's Batch Record keys first (so the file stays a Batch Record), then `deck` (as given),
  `submittedAt`, the submitted `cards` whole (collect needs their declared paths, not the deck file, which may change) and
  `inputs` (the compile-time digests, the stale check); answers never go into it (`files` names them).
- **collect** = `morph collect --batch <id> [--root] [--pretty]`, the id path-safe; ONE GET (free), never a wait loop
  (`--wait` is out of scope: a shell loop over exit 1 does it); pending → exit 1, nothing spent, the status saved; done or
  failed → the answers written, exit 0 only when every answer is clean and nothing is stale.
- **collect does not verify, commit or archive**: it writes each answer as `.morph/batches/<id>/<customId>.md`, which is a
  stub processor's ANSWERS_DIR, so `morph run --processor <stub on that dir> --max-retry-batches 0` replays the generation
  through Run Deck's verify → commit → archive with no runloop change (runloop at 29 986 bytes; splitting Process
  Generation is a phase of its own). The stale check (Capture Inputs at submit vs at collect) is what keeps the replay's
  recompiled requests equal to the submitted ones.
- **A missing state** → 4 UsageError (the id or root is wrong); a **foreign** state (not JSON, another batchId, a run's
  Batch Record without cards) → 2 RefusalError naming the first bad key; neither calls the provider.
- **`.morph/batches/` stays ignored** (`.morph/*` in `.gitignore`) and the run branch's dirty check skips `.morph/`: the
  state and the answers are local; the replay's run archive commits the answers.
- **Exit codes**: submit refusals 2/4 before any call, a failed POST or an unsaved state 3 (a batch may exist: its id is
  in the message); collect 0 clean, 1 pending or not clean, 2/4 refusals, 3 a failed GET.

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/batches/submit.ts` | NEW | probe only | NEW `tests/batches/submit.examples.test.ts` (SD 1–5) |
| `src/batches/collect.ts` | NEW | probe only | NEW `tests/batches/collect.examples.test.ts` (CB 1–6) |
| `src/git/archive.ts` | saveBatchAnswers | probe only | NEW `tests/git/archive.p11b2.examples.test.ts` (AR 8) |
| `src/cli/types.ts`, `parse.ts`, `main.ts` | SubmitArgs, CollectArgs; grammar; routing | probe only | PATCH `tests/cli/parse.examples.test.ts` (PC 8 literal; PC 14, 15 added); NEW `tests/cli/main.p11b2.examples.test.ts` (Main 7, 8) |

- `submit.examples`: "Submit Deck example 1: …" … "5: …", each from the §2.1 skeleton; 1 compares the result whole with
  `documents.json["Submit Deck 1"]` and the state file text with `submitted.json`.
- `collect.examples`: "Collect Batch example 1: …" … "6: …"; 1 against `documents.json["Collect Batch 1"]`,
  `collected.json` and the texts of `replies.json["live"]`.
- `archive.p11b2`: "Archive Run example 8: …".
- `parse.examples` (13 tests → 15): example 8's no-command literal changed; "Parse Command example 14: …" and "Parse Command
  example 15: …" after the last test, each result `toStrictEqual`.
- `main.p11b2`: "Main example 7: …", "Main example 8: …" (in process, an io pushing chunks, stdout parsed per chunk).

### 2.4. What must not break

- Byte for byte: every file outside the 6 code targets and the 5 test files of §2.3; `src/processor/*`, `src/runloop/*`,
  `src/cli/{runCommand,document,deckCheck,planCommand,readPlanChecks}.ts`, `src/cli.ts`, `src/git/{run,branch,commit,types}.ts`,
  `tests/helpers.ts`; in `archive.ts`, archiveRun and saveBatchRecord.
- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/`, `.gitignore` — untouched by every card.
- 624 tests stay green at every card (`parse.examples` in `fullExclude` until its judge); after the run **625 + 5 + 6 + 1 + 2
  + 2 = 641** in 84 files (the reference judges: 641).

## 3. Acceptance

Built by `morph plan --checks decks/p11b2/checks.json`, narrow to broad, every stage printing `== <stage>`. `ownGit: true`
(git tests spawn git). `fullExclude`: `tests/cli/parse.examples.test.ts` (ripple 1, red from parse-command to its judge).

Code cards (no test file, code-only targets, no smoke cap): `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs src
<targets>` → `decks/p11b2/parts/<card>.probe.ts` (submit-deck SD 1–5 + 2 rows = 7; collect-batch CB 1–6 + 2 = 8;
archive-run AR 8 + 1 = 2; parse-command PC 8, 14, 15, Main 7, 8 + 2 = 7; **24 tests**) → eslint's verdict → full `vitest
run` minus fullExclude → own git → frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs tests <file> <min> <max> lits<n>.json` → (patched)
every test name at HEAD still there → `vitest run <targets>` → eslint's verdict → full run → own git → frozen → untracked.

| file | new | min | max | lits |
|---|---|---|---|---|
| `tests/batches/submit.examples.test.ts` | yes | 5 | 11 | `Submit Deck example 1` … `5`, `submitted.json`, `nothing to submit: `, `state not saved: disk full` |
| `tests/batches/collect.examples.test.ts` | yes | 6 | 12 | `Collect Batch example 1` … `6`, `collected.json`, `batchInProgress.json`, `is not a submit's state: cards`, `Clamp it.` |
| `tests/git/archive.p11b2.examples.test.ts` | yes | 1 | 7 | `Archive Run example 8`, `saveBatchAnswers`, `../y` |
| `tests/cli/parse.examples.test.ts` | no | 15 | 17 | `Parse Command example 14`, `Parse Command example 15`, `submit, collect)`, `missing --batch` |
| `tests/cli/main.p11b2.examples.test.ts` | yes | 2 | 8 | `Main example 7`, `Main example 8`, `morph collect: exit 4`, `documents.json` |

min = the file's tests after the change (new files: its record examples); max = min + 2 (patched) or + 6 (new).

**Output budget** (`max_tokens`, before the session's ×3 for `ds`): code = targets in tokens (≈ bytes / 3.5) × 2 + 2 500,
floor 8 000; judges from the file they return.

| card | returns | `max_tokens` |
|---|---|---|
| submit-deck | submit.ts ≈ 5.9 KB | 8 000 |
| collect-batch | collect.ts ≈ 4.6 KB | 8 000 |
| archive-run | archive.ts ≈ 4.7 KB | 8 000 |
| parse-command | parse.ts ≈ 9.0 KB + types.ts 2.2 KB + main.ts 2.1 KB | 12 000 |
| submit-deck-judge, collect-batch-judge (most examples, 6) | ≈ 7 KB new file | 20 000 |
| parse-command-judge | parse.examples.test.ts ≈ 9.2 KB, whole | 20 000 |
| main-judge | ≈ 3.4 KB new file | 14 000 |
| archive-run-judge | ≈ 1.3 KB new file | 12 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- Layer batches (guard): imports cards, wait, compiler, processor; `node:fs`, `node:path`; no `process`, no `Date`, no
  global `fetch` (the transport is a parameter; `realTransport` comes from processor). Its writes go through
  `deps.saveState` / `deps.saveAnswers` (git's writers, given by Main): batches writes no file itself.
- git imports only cards; saveBatchAnswers takes plain shapes. cli may import every layer.
- A file a card writes is in no sibling's slice in the same generation: generation 0 (submit-deck writes
  `src/batches/submit.ts`, archive-run `src/git/archive.ts`) — no generation-0 card reads them; generation 1 (collect-batch
  writes `collect.ts`) — submit-deck-judge and archive-run-judge do not read it; generation 2 (parse-command writes
  `src/cli/{types,parse,main}.ts`) — collect-batch-judge reads none of them.
- Tests write only under `tmpRoot()` and remove it in `finally`; no timer; a judge writes only its test file.
- Exact strings of the record and §2.2: the executor copies them.

## 7. Out of scope

- `morph collect --wait` (a poll loop): a shell loop over exit 1 does it; a wait in process is P11b1's `morph run`.
- Verify, commit and archive inside collect (Process Generation split in two): the replay through a stub processor over
  `.morph/batches/<id>/` gives that path today (§8).
- Submitting later generations (they read the earlier answers from disk): one generation per submit; the replay commits
  generation 0, then the next submit cuts the rest (`deferred` names them).
- A DELETE of a submitted batch (`morph cancel`): P11b1's give-up DELETE stays inside `morph run`.
- Pruning `.morph/batches/`; committing the state.

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component batches --component git \
  --component cli --judge --checks decks/p11b2/checks.json --out decks/p11b2/deck.json
python3 decks/p11b2/filter.py decks/p11b2/deck.json            # keeps the 9 cards of the phase
node dist/cli.js deck check --root . --deck decks/p11b2/deck.json                                  # errors 0
python3 decks/tools/scale_tokens.py decks/p11b2/deck.json 3    # the session, for processor ds
rm -rf /tmp/v2bin-p11b2 && mkdir -p /tmp/v2bin-p11b2 && cp -r dist /tmp/v2bin-p11b2/ && ln -s $PWD/node_modules /tmp/v2bin-p11b2/node_modules
node /tmp/v2bin-p11b2/dist/cli.js run --root . --deck decks/p11b2/deck.json --processor ds --deadline 2400
```

Cross-check (dry): from `morph-lab`, `venv/bin/mrph plan --spec <repo>/contour.yaml --map <repo>/morph-map.json
--component batches --component git --component cli --judge --root <repo>`.

**Smoke after the merge (the session; ceiling $0.10).** In a scratch git repo S (outside `~/MorphV2`) with a one-generation
deck of 2 tiny cards (the P11 smoke's `decks/p11/smoke/` repo: clamp-value, sign-of, their checks and probes), the binary
copied to `/tmp/v2bin-smoke11b2/`, the key by indirection from `morph-lab/.env` (never printed), processor `dsb` = ds's key
on route batch (`MORPH_PROCESSOR_dsb_TYPE=openrouter`, `_API_KEY="$MRPH_PROCESSOR_ds_API_KEY"`, `_MODEL=<slug>`,
`_ROUTE=batch`, `_REASONING_MAX_TOKENS=1000`):

1. **Slug check first** (one minimal call, ≤ $0.001): `morph submit` of a one-card deck with `maxTokens` 8 and `_MODEL=
   deepseek/deepseek-v4.1-flash:batch`. A 400 "does not have a :batch endpoint" (exit 3, `batch submit: http 400: …`) means
   ds has no batch route: fall back to `_MODEL=z-ai/glm-5.3:batch` (proven by the P11 smoke) with glm53's key. A 202 →
   `morph collect --batch <id>` until exit ≠ 1 (it is a real batch: pennies).
2. **Process A**: `node /tmp/v2bin-smoke11b2/dist/cli.js submit --root $S/repo --deck decks/s11/deck.json --processor dsb
   > $S/submit.json`; exit 0; the process has exited; `$S/repo/.morph/batches/<id>.json` exists (cards, inputs).
3. **Process B** (a new shell, after A exited): `node … collect --root $S/repo --batch <id> > $S/collect.json` every 60 s
   while exit 1 (`outcome` pending), at most 60 times; then exit 0, `files` 2. Then the replay: `MORPH_PROCESSOR_rp_TYPE=stub
   MORPH_PROCESSOR_rp_ANSWERS_DIR=$S/repo/.morph/batches/<id> node … run --root $S/repo --deck decks/s11/deck.json
   --processor rp --max-retry-batches 0` → exit 0, 2 written, the archive committed. Record `$` (the state's `cost`),
   minutes, both exits and the documents in MEASURE ("P11b2 smoke"); 🧪; stop.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 9 (4 code, 5 judges) / 4: [archive-run, submit-deck] [archive-run-judge, collect-batch, submit-deck-judge] [collect-batch-judge, parse-command] [main-judge, parse-command-judge] |
| executor bill | ≈ $0.06–0.12 on ds ×3 (P11c2: 10 cards, 15 requests, $0.0880; here 9 cards of 20–60 KB in, 13 first requests), ≤ $0.25 with a re-cut; cap $5 |
| cards with regeneration | 1–3 of 9 (submit-deck: the state's key order or deferred order; collect-batch: a stale check keyed by customId, not card id; parse-command-judge: the whole-file patch) |
| tests after the run | 641 ± 3 in 84 files |
| first red | submit-deck: `deps.now()` called twice or the refusal order; collect-batch: `cost` undefined, the pending path writing answers; parse-command: `missing --deck` before `missing --batch` for collect |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no judge cut off at its `max_tokens`; (3) the V2 cut
equals the old mrph's dry cut in ids, dependsOn, generations, targets, slices and max_tokens; (4) after the run no test
file outside §2.3's five changed; (5) the smoke's collect runs in a process started after submit's exited and reads only
`.morph/batches/<id>.json`.

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the row of
`docs/MEASURE.md`; DECISIONS lines "P11b2 processor"; then the smoke row and its stop.

## 11. Actual

### Gate (preparation)

(written at the gate)
