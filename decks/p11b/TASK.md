# TASK_P11b — batch cost, batch id and batch state, a cancelled give-up, the deadline before a retry, the answers archive (`src/processor/`, `src/runloop/`, `src/git/archive.ts`, `src/cli/runCommand.ts`)

> Phase P11 of `docs/PLAN.md` ("Фазы по записи (после P2)", row P11), second half **P11b**, first part **P11b1** (the
> split is §7). It answers issue #4 (label `P11b-processor`): items 1–4, the operator's decision of 07.10 on the
> answers archive (item 5) and the code-review finding #7 (operator order 07.10). Components of `contour.yaml`:
> `processor` (Read Registry, Read Batch, Send Batch; data objects Batch Read, Batch Record), `runloop` (Process
> Generation, Run Deck; Request Usage), `git` (Archive Run, Archived Answer) and `cli` (Run Command); every change is a
> **patch** of code written in P4–P11. The four records were compacted first (no example's meaning changed). The deck is
> cut by V2 (`morph plan --checks decks/p11b/checks.json`), filtered to this phase's 14 cards by `decks/p11b/filter.py`.

## 1. Why this

- **Cost is null on the batch route** (#4 item 1). The P11 smoke's report had `usageTotals.cost` null and every row's
  `cost` null; the real cost ($0.0005804) is only on the batch object's `usage.cost` (measured 07.10 with a free GET of
  `batch-1791388269-cp5qOr5IQ0xoz1ntuc8W`: `usage {prompt_tokens 832, completion_tokens 103, total_tokens 935, cost
  0.0005804}`; each result's `response.body.usage` has tokens and **no** cost). The running total was read off
  OpenRouter by hand.
- **The batch id is nowhere in the run** (#4 item 2): found in OpenRouter's batch list; the rows carry
  `gen-batch-<ts>-<hash>` generation ids. A crash during a 10–60 min wait loses it.
- **Provider** (#4 item 3): the smoke ran on DeepInfra although glm53's sync PROVIDER_ORDER is Novita.
- **Wait** (#4 item 4): 569 s for 2 tiny requests; the default TIMEOUT_MS 600 000 (10 min) is the whole batch wait;
  the old Morph measured glm batches at 23–38 min. The smoke needed `TIMEOUT_MS=3600000`.
- **Archive size** (#4 item 5, operator decision 07.10): P11's run dir `.morph/runs/20261007-153224` is 1.1 MB on main,
  almost all of it the 13 `*.request.json` (the slices again). Decision: raw answers and the variant's stderr line stay
  committed; request copies are kept locally, not committed, compressed.
- **Finding #7** (code review 07.10, Fable 5.1): a batch whose polls run out is left running and the retry submits a
  second batch — both billed; with a 1 h wait this is a real leak. `--deadline` is read only at generation boundaries,
  so a run can overshoot it by TIMEOUT_MS × (1 + retries) per generation.

**Measured on the live service (07.10, no generation, $0):** `GET /api/beta/batches/<id>` (shapes above, fixture
`batchCompletedLive.json`); `POST …/<id>/cancel`, `POST …/<id>:cancel`, `PATCH …/<id>` and `POST /api/v1/batches/<id>/
cancel` all answer `404 Not Found` (plain text: no such route); `DELETE /api/beta/batches/<id>` answers 200
`{"id":…,"object":"batch","deletion":{"openrouter":"deleted","upstream":{"provider":"DeepInfra","status":"unsupported"}}}`
(fixture `batchDeleted.json`). That DELETE was sent to the completed slug-probe batch of the P11 smoke
(`batch-1791388188-7pdzwxonOkxzLfimnlUD`, $0.00002185, already on record in MEASURE): its record is gone from
OpenRouter's list. The DELETE is the only cancel the API offers; `upstream: unsupported` says DeepInfra itself may not
stop work already queued (§7).

**Ripple, measured** (references of the 9 code targets in a scratch worktree, full suite): **3 of 599** tests red —
`batch.examples` "Send Batch example 6" (5 calls → 6: the DELETE), `archive.p10c2` "Archive Run example 4" and
`runCommand.p10c2` "Run Command example 8" (the request copies leave the commit). Every new shape is optional or
additive (`BatchRead.cost?`, `Transport.saveBatch?`, `GenerationResult.batch?`, `RequestUsage.batchId?`,
`ArchivedAnswer.line?`): 0 other tests red, tsc clean. The Run Report, the Run Document, the 12 registry KEYS and every
error text of P11 are unchanged.

**Record sizes** (bytes of each Component block, the 30 000 rule): before → after compaction and patch: processor
29 059 → **29 969**, runloop 29 178 → **29 899**, git 15 185 → **17 202**, cli 29 835 → **29 998**. Compaction moved
literals to fixtures by `ref` (`bodies.json`: the four exact body texts of Assemble Request 1–2 and Assemble Batch 1–2;
`replies.json`: Read Batch 2's replies; `sendBatch.json`: Send Batch 1's answers and usage — each file generated from
the code on main and checked equal to the old literal) and reworded behaviours and descriptions with every rule kept.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Request** — `src/compiler/types.ts`; **ProcessorConfig, Answer, Usage, Reply, Transport, GenerationResult** —
  `src/processor/types.ts` (§2.2 adds BatchRecord and two optional members); **BatchRead** —
  `src/processor/batchResponse.ts`; **Card, Deck** — `src/cards/types.ts`; **RunDeps, RunInput, RequestUsage,
  VariantRecord** — `src/runloop/types.ts`; **ArchiveInput, ArchivedAnswer** — `src/git/types.ts`; **CliDeps, RunArgs**
  — `src/cli/types.ts`.
- **Fixtures** (`tests/fixtures/`), each by the type the Function takes:

| file | type | what it is | what the Function returns on it |
|---|---|---|---|
| `processor/batchCompletedLive.json` | text of ONE batch object | the live completed batch of the P11 smoke, verbatim (GET 07.10): id `batch-1791388269-cp5qOr5IQ0xoz1ntuc8W`, `usage.cost` 0.0005804, results **sign-of.v1 then clamp-value.v1**, each 200 with a fenced ts block, finish stop, provider DeepInfra, no cost of its own (401/46 and 431/57 tokens) | Read Batch: done, cost 0.0005804, 2 replies = `replies.json` `live` |
| `processor/batchSubmittedLive.json` | text of ONE batch object | the same id at submit: status `validating`, results null, no usage (derived from the live object: the submit's own answer was not kept) | Read Batch: pending, batchId the live id, no cost key |
| `processor/batchDeleted.json` | text of ONE object | the live answer of `DELETE /api/beta/batches/<id>` (of the slug-probe batch) | Send Batch: a 2xx DELETE → the record's status "deleted" |
| `processor/bodies.json` | ONE object of 4 strings | keys AR1, AR2, AB1, AB2: the exact body texts of Assemble Request 1–2 and Assemble Batch 1–2 | — (expected values) |
| `processor/replies.json` | ONE object | `completed`: Read Batch 2's 3 replies (c.v1, a.v1, b.v1); `live`: Read Batch 6's 2 replies | — (expected values) |
| `processor/sendBatch.json` | ONE object | `"1"`: Send Batch 1's {answers, usage} (4 each); `"9"`: Send Batch 9's {answers, usage, batch, saved} (2, 2, the record, 2 pushed records) | — (expected values) |
| `runloop/batchRows.json` | ONE array | Process Generation 14's 3 Request Usage rows | — (expected value) |
| `cli/batch.r9.json` | ONE file text | the record file Run Command 9 writes: `JSON.stringify({batchId, processor "b", model "acme/m:batch", customIds [clamp-value.v1, sign-of.v1], status "completed", cost 0.0005804}, null, 2) + "\n"` | — (expected text) |

`batchConfig.json` (P11): id glm53b, model `z-ai/glm-5.3:batch`, route batch, timeoutMs 60000, providerOrder ["Novita"].

**Distinct markers.** Batch ids `batch-1789576284-Ejahe4wq9AgVdp5xGdNm` (P11 fixtures) and
`batch-1791388269-cp5qOr5IQ0xoz1ntuc8W` (live); processors `glm53b`, `night`, `b`; batch models `z-ai/glm-5.3:batch`,
`acme/m:batch`; costs 0.0005804 (live), 0.5, 0.001 (probe), 0 (probe) — the code must hard-code none of them.

**A judge's setup across Components** (TASK_TEMPLATE §2.1):

- **F1** processor · on route batch Send Generation calls Send Batch: a submit 202 `batchSubmittedLive.json`, then 200
  `batchCompletedLive.json` at poll 1 (one sleep of 15000, a no-op in tests); a card pinned to `other/m` is answered
  "batch runs one model: pin.v1 pins other/m, the batch is z-ai/glm-5.3:batch" and not submitted · PG 14, RC 9.
- **F2** runloop · Run Deck calls `deps.now()` at each generation boundary, before a retry batch that would run, and
  once for `completedAt`; Process Generation never calls it. A `now` that returns 0 on its first call and 5000 after
  puts a deadline of 1000 between the boundary of generation 0 and its first retry batch · RD 8.
- **F3** git · `tmpRepo()` starts on `main` with one commit; `requests/.gitignore` = `"*\n"` makes `requests/` ignored
  in any repo, so `git status --porcelain` stays empty; `git show --name-only --format= HEAD` lists paths sorted · AR 4,
  6, RC 8.
- **F4** cli · Run Command spreads `deps.transport` and adds `saveBatch`; the env `MORPH_PROCESSOR_b_TIMEOUT_MS
  "30000"` gives 2 polls; the stub processor never calls the transport, so a stub run writes no `.morph/batches/` ·
  RC 9.
- **F5** runloop · a retry is card `a.r1`, its request `a.r1.v1`, its last message holding `<acceptance_output>` (P10c2
  F5) · RC 8.
- **F6** compiler · a single fenced ts block is the whole file of a one-target card (the live answers write
  `out/clamp.ts`, `out/sign.ts`) · PG 14, RC 9.

**Harness skeletons** (each ≤ 10 lines, only from `tests/helpers.ts` and the types):

```ts
// batch.examples (send-batch-judge): P11's scripted transport plus a saveBatch that records every pushed record
type Step = Error | { status: number; text: string };
const ok = (status: number, name: string): Step => ({ status, text: fixture("processor/" + name) });
function script(steps: Step[]) {
  const calls: { url: string; method: string; body: string | undefined }[] = []; const sleeps: number[] = []; const saved: BatchRecord[] = [];
  const transport: Transport = { fetch: async (url, init) => { calls.push({ url, method: init.method, body: init.body });
      const s = steps[Math.min(calls.length, steps.length) - 1]; if (s instanceof Error) throw s;
      return { status: s.status, text: async () => s.text }; },
    sleep: async (ms) => { sleeps.push(ms); }, saveBatch: (r) => { saved.push(r); } };
  return { transport, calls, sleeps, saved }; }
// generation.p11b (process-generation-judge): RunDeps over the batch config and that transport (no saveBatch needed)
const deps: RunDeps = { config: fixtureJson("processor/batchConfig.json") as ProcessorConfig, transport: script([
  ok(202, "batchSubmittedLive.json"), ok(200, "batchCompletedLive.json")]).transport,
  commit: (id) => ({ commit: "sha-" + id, diffstat: { files: 1, insertions: 1, deletions: 0 } }), now: () => 1000, env: { PATH: process.env.PATH ?? "" } };
// deck.p11b (run-deck-judge): the stub RunDeps of generation.p10c2 with now = 0 on the first call, 5000 after
let n = 0; const now = (): number => { n += 1; return n === 1 ? 0 : 5000; };
// archive.p10c2 / runCommand.p10c2: the gitEnv of P10c2 unchanged; RC 9's CliDeps {env: gitEnv + MORPH_PROCESSOR_b_*,
// now: () => 1791310149000, cwd: r.root, transport: script([ok(202, "batchSubmittedLive.json"), ok(200, "batchCompletedLive.json")]).transport}
```

### 2.2. OUTPUT data shapes

**`src/processor/types.ts`** — one new type and two optional last members; nothing else changes:

```ts
export interface BatchRecord {
  batchId: string; processor: string; model: string; customIds: string[]; status: string; cost: number | null;
}
export interface Transport {
  fetch(url: string, init: { method: string; headers: Record<string, string>; body?: string }): Promise<HttpReply>;
  sleep(ms: number): Promise<void>;
  saveBatch?(record: BatchRecord): void;
}
export interface GenerationResult { answers: Answer[]; usage: Usage[]; batch?: BatchRecord }
```

**Read Registry** (`registry.ts`) — the TIMEOUT_MS default is 3 600 000 on route batch (the whole batch wait) and
600 000 on route sync; a given value wins and is checked as before (`"0"` stays a fault). Example 5: env nb (openrouter,
route batch, no TIMEOUT_MS), ns (stub, route batch, TIMEOUT_MS "90000"), sy (stub, sync) → timeoutMs 3600000, 90000,
600000. The route decides, not the type.

**Read Batch** (`batchResponse.ts`) — `BatchRead` gains `cost?: number`: the key is present exactly when the 2xx batch
object's `usage` is an object whose `cost` is a number (0 included), never `cost: undefined`; an error read never has
it. Every other rule of P11 unchanged (Read Batch 1's exact object has no cost key).

**Send Batch** (`batch.ts`) — every P11 rule stays; added:

1. After a submit read with a batch id: `record = {batchId, processor: config.id, model: config.model, customIds: the
   submitted (not pinned) ids in request order, status: the submit's status word, cost: null}`;
   `transport.saveBatch?.(a copy)`. A saveBatch that throws is ignored (the batch goes on).
2. Every poll read that is not an error sets `record.status` to its status and, when it has a cost, `record.cost`.
3. done or failed → saveBatch once more (the final record), then the P11 mapping. **Cost share**: when the read has a
   cost and **no** reply carries a cost of its own, each reply's `usage.cost = Math.round(cost * (inputTokens +
   outputTokens) / total * 1e10) / 1e10`, `total` = the replies' tokens summed; total 0 → costs stay null. A reply with
   its own cost keeps it (Send Batch 11). Live: 0.0005804 × 488/935 → **0.0003029253**, × 447/935 → **0.0002774747**;
   their sum in Run Deck's order is exactly 0.0005804.
4. **Give-up** (polls run out): ONE `transport.fetch(url + "/" + batchId, {method: "DELETE", headers})`, no body key
   (OpenRouter's only cancel, measured §1); a 2xx sets `record.status = "deleted"`; a throw or any other reply is
   ignored; saveBatch once more; then the P11 text `batch <id> still <the last status a POLL read, the submit's when
   none> after <polls> polls` (unchanged: "deleted" never enters it). A final error read (e.g. 401, a 404 past the
   grace) is not a give-up: no DELETE, no second save.
5. `batch` (a copy of the record as it stands) is on the result of every path once a batch id exists — done, failed,
   final error read, give-up — and on no other (no request, only pinned, submit thrown, refused, no id).

| Send Batch example | calls | answers / batch |
|---|---|---|
| 6 (P11, changed) submit, in_progress forever | POST, 4 × GET, **DELETE** `…/batch-…Nm` (6) | `still in_progress after 4 polls`; batch status "deleted" |
| 9 live submit, live completed; clamp-value.v1, sign-of.v1 | POST, GET | exactly `sendBatch.json["9"]` (shares above; batch glm53b, completed, 0.0005804; pushed validating/null, then it) |
| 10 config id night, model acme/m:batch, timeoutMs 30000; x.v1 pinned, clamp-value.v1; live submit, in_progress ×2, batchDeleted | POST, GET, GET, DELETE (4) | x.v1 pinned text with `acme/m:batch`; clamp-value.v1 `batch batch-1791388269-cp5qOr5IQ0xoz1ntuc8W still in_progress after 2 polls`; batch {…, processor "night", model "acme/m:batch", customIds ["clamp-value.v1"], status "deleted", cost null}; pushed: validating, deleted |
| 11 submit, batchCompleted + `"usage": {"cost": 0.5}`; saveBatch throws | POST, GET | a.v1 stop, usage cost 0.00269316 (its own); batch completed, cost 0.5 |

**Assemble Batch** — no code change; the record says why no `provider` key is sent (#4 item 3, gap below).

**`src/runloop/types.ts`** — `RequestUsage` gains the optional last member `batchId?: string`.

**Process Generation** — when the send result has `batch`, each request row whose customId is in `batch.customIds`
gets `batchId: batch.batchId` as its **last** key; every other row has no batchId key. Example 14: rows exactly
`batchRows.json` — clamp-value.v1 and sign-of.v1 (DeepInfra, the shares, batchId last), pin.v1 (model other/m, the
pinned error, no batchId). On a give-up the rows name the batch too (the batch key is on that result). The Run Report's
`usageTotals.cost` sums the rows' costs as before, so the batch cost reaches it with no runloop rule.

**Run Deck** — finding 7: in the retry loop, once a retry batch would run (some failed card has retries left and the
generation's cap allows one), `deps.now()` is called; `>= input.budget.deadline` → each card of that batch gets its
outcome with `status: "budget-exceeded", reason: "deadline"` (attempts, logs and earlierFailures kept) and no retry
batch runs; the next generation boundary then marks the rest "deadline" as before. `now()` is not called when no retry
batch would run (the boundary + completedAt call counts of P5–P10c tests unchanged). Example 8: deck [c "exit 1", then
d dependsOn c], answers c.md, c.r1.md, d.md, maxRetryBatches 2, deadline 1000, now 0 then 5000 → c budget-exceeded
deadline attempts 1, d budget-exceeded deadline, usageTotals.requests 1, no commit.

**`src/git/types.ts`** — `ArchivedAnswer` = `{request: {customId: string}; text: string | null; line?: string}`.

**Archive Run** (`archive.ts`) — the operator's decision. Refusals, deck.json, report.json, subject and trailers
unchanged. Then, answers not empty: `<dir>/requests/.gitignore` = `"*\n"`; per answer in order
`<dir>/requests/<customId>.request.json.gz` = `gzipSync(JSON.stringify(request, null, 2) + "\n")` (node:zlib; read back
with gunzipSync) — never committed, ignored in any repo by its own .gitignore (and by the repo's `.gitignore` line
`.morph/runs/*/requests/`); `<dir>/answers/<customId>.answer.txt` = the text exactly when not null; then
`<dir>/answers/lines.txt` = every answer's `line` concatenated in order, written when any answer has one. `answers/` is
created only when something goes in it; answers absent or `[]` → neither directory. Commit Paths over
`[deck.json, report.json, the answer.txt files in order, answers/lines.txt]`.

```
.morph/runs/20261007-153224/            committed: deck.json, report.json, answers/
  answers/send-batch.v1.answer.txt      the raw answer, byte for byte
  answers/lines.txt                     "morph run: send-batch.v1 corrupt stage 0 finish stop chars 5213\n…" (the stderr lines)
  requests/.gitignore                   "*\n"  (local only, never committed)
  requests/send-batch.v1.request.json.gz
```

`saveBatchRecord(root, record: {batchId: string}): string | null` (exported from `archive.ts`): batchId outside
`^[A-Za-z0-9._-]+$` → null, nothing written; else mkdir -p `<root>/.morph/batches`, write `.morph/batches/<batchId>.json`
= `JSON.stringify(record, null, 2) + "\n"` (overwriting), return that relative path. Example 7.

**Run Command** (`runCommand.ts`) — step 6: `transport: {...(deps.transport ?? realTransport(config.timeoutMs)),
saveBatch: (record) => { saveBatchRecord(root, record); }}` (whatever transport deps give); `onVariant`: `line =
variantLine(record)`, keep `{...record, line}`, `log(line)` when a log is given. Step 7: Archive Run gets the kept
records. variantLine, every refusal and the Run Document unchanged. Example 9: a batch-route run through `runCommand`
with a scripted CliDeps.transport → code 0, rows' batchId, usageTotals.cost 0.0005804, `.morph/batches/<live id>.json`
exactly `cli/batch.r9.json`, `git status --porcelain` exactly `?? .morph/batches/` (the repo of the test has no
.gitignore; MorphV2's ignores `.morph/*`).

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P11b processor"):

- **Split** P11b1 (this) / P11b2 (submit/collect, §7).
- **Cost** (#4 item 1): the batch's `usage.cost` shared over the replies by tokens, rounded to 1e-10, only when no
  reply has its own; the total is exact, the per-row split is an estimate (in/out prices differ) — not a new report
  field (reports and rows are compared whole in P5–P11 tests; optional/additive only).
- **Batch id** (#4 item 2): `RequestUsage.batchId?` on the rows (the report names the batch per request) and the
  Batch Record in `.morph/batches/<id>.json`, written at submit (crash-safe) and at the end, through a
  `Transport.saveBatch?` hook (processor writes no file; the writer is git's, beside the other `.morph/` writer, since
  processor stood at its 30 KB limit); local state, uncommitted (`.morph/*` is ignored).
- **Provider** (#4 item 3): the batch route sends no provider order: unmeasured on `/api/beta/batches` (a refused
  submit burns a whole generation), the old Morph's proven body had none; the rows already name the provider. A pinned
  batch provider is a later measured change.
- **Wait** (#4 item 4): TIMEOUT_MS default 3 600 000 on route batch (the smoke's value, above the old Morph's 38 min);
  realTransport still aborts one HTTP call after TIMEOUT_MS (a hung GET can hold an hour — risk, §7).
- **Archive** (#4 item 5, operator): requests gzipped under `requests/`, self-ignored, uncommitted; the stderr lines as
  one `answers/lines.txt` (one file greps per variant: each line starts with its id; one per variant would double the
  file count).
- **Cancel** (finding 7): on a give-up only, ONE DELETE (the only cancel route, measured), result ignored but recorded
  as status "deleted"; a final error read is not cancelled (the batch is unknown or unreachable).
- **Deadline** (finding 7): checked before each retry batch; the cards of the stopped batch become budget-exceeded
  "deadline" keeping their logs.

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/processor/registry.ts` | batch default | probe only | NEW `tests/processor/registry.p11b.examples.test.ts` (RR 5) |
| `src/processor/batchResponse.ts` | `cost?` | probe only | NEW `tests/processor/batchResponse.p11b.examples.test.ts` (RB 6) |
| `src/processor/types.ts`, `batch.ts` | BatchRecord, saveBatch?, batch?, share, DELETE | probe only | PATCH `tests/processor/batch.examples.test.ts` (SB 6 changed; SB 8–11 added) |
| `src/runloop/types.ts`, `generation.ts` | batchId? | probe only | NEW `tests/runloop/generation.p11b.examples.test.ts` (PG 14) |
| `src/runloop/deck.ts` | deadline before a retry batch | probe only | NEW `tests/runloop/deck.p11b.examples.test.ts` (RD 8) |
| `src/git/types.ts`, `archive.ts` | requests/, lines.txt, saveBatchRecord | probe only | PATCH `tests/git/archive.p10c2.examples.test.ts` (AR 4 changed; AR 6–7 added) |
| `src/cli/runCommand.ts` | saveBatch wiring, lines | probe only | PATCH `tests/cli/runCommand.p10c2.examples.test.ts` (RC 8 changed; RC 9 added) |

- `registry.p11b`: "Read Registry example 5: …" (the three configs' id, route, timeoutMs; nb whole).
- `batchResponse.p11b`: "Read Batch example 6: …" (head, `cost` `toBe` 0.0005804, replies `toStrictEqual`
  `replies.json` live).
- `batch.examples` (7 tests → 11): "Send Batch example 6" asserts six calls, the last `DELETE` with no body;
  "Send Batch example 8" … "11" after 7, each from the §2.1 skeleton; 9 against `sendBatch.json["9"]`.
- `generation.p11b`: "Process Generation example 14: …" (outcomes; rows `toStrictEqual` `batchRows.json`).
- `deck.p11b`: "Run Deck example 8: …".
- `archive.p10c2` (2 → 4): "Archive Run example 4" rewritten to the record (gunzipSync of the two request copies,
  requests/.gitignore, the committed paths, status clean); "Archive Run example 6", "Archive Run example 7" added.
- `runCommand.p10c2` (2 → 3): "Run Command example 8" rewritten (lines.txt committed, the retry request from
  requests/…gz); "Run Command example 9" added.

### 2.4. What must not break

- Byte for byte: every file outside the 9 code targets and the 7 test files of §2.3; `src/processor/{assemble,
  batchRequest,response,send,stub}.ts`, `src/runloop/{resolve,retry}.ts`, `src/git/{run,branch,commit}.ts`, every
  `src/cli/` file but runCommand.ts, `src/cli.ts`, `tests/helpers.ts`.
- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/`, `.gitignore` — untouched by every card.
- The 599 tests stay green except the 3 rippled (§1), red from their code card to their judge; after the run **599 + 11
  = 610** in 71 files (the reference judges: 610).

## 3. Acceptance

Built by `morph plan --checks decks/p11b/checks.json`, narrow to broad, every stage printing `== <stage>`. `ownGit:
true` (git and run tests spawn git). `fullExclude` = the three rippled files (`batch.examples`, `archive.p10c2`,
`runCommand.p10c2`).

Code cards (no test file, code-only targets, no smoke cap): `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs
src <targets>` → `decks/p11b/parts/<card>.probe.ts` (read-registry RR 5 + 1 row = 2; read-batch RB 6 + 1 = 2;
send-batch SB 1–11 + 6 rows = 17 (P11's 13 carried, SB 4/6 and two rows updated); process-generation PG 14 + 1 = 2;
run-deck RD 8 + 1 = 2; archive-run AR 4, 6, 7 + 1 = 4; run-command RC 8, 9 + 1 = 3; **32 tests**) → eslint's verdict →
full `vitest run` minus fullExclude → own git → frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs tests <file> <min> <max> lits<n>.json` → (patched
files) every test name at HEAD still there → `vitest run <targets>` → eslint's verdict → full run → own git → frozen →
untracked.

| file | new | min | max | lits |
|---|---|---|---|---|
| `tests/processor/registry.p11b.examples.test.ts` | yes | 1 | 7 | `Read Registry example 5`, `MORPH_PROCESSOR_nb_ROUTE`, `3600000`, `90000` |
| `tests/processor/batchResponse.p11b.examples.test.ts` | yes | 1 | 7 | `Read Batch example 6`, `batchCompletedLive.json`, `replies.json`, `0.0005804` |
| `tests/processor/batch.examples.test.ts` | no | 11 | 15 | `Send Batch example 8` … `11`, `DELETE`, `sendBatch.json`, `batchDeleted.json`, `still in_progress after 2 polls`, `disk full` |
| `tests/runloop/generation.p11b.examples.test.ts` | yes | 1 | 7 | `Process Generation example 14`, `batchRows.json`, `batchCompletedLive.json`, `other/m` |
| `tests/runloop/deck.p11b.examples.test.ts` | yes | 1 | 7 | `Run Deck example 8`, `budget-exceeded`, `deadline` |
| `tests/git/archive.p10c2.examples.test.ts` | no | 4 | 8 | `Archive Run example 6`, `… 7`, `lines.txt`, `request.json.gz`, `gunzipSync`, `saveBatchRecord`, `.morph/batches/batch-1791388269-cp5qOr5IQ0xoz1ntuc8W.json` |
| `tests/cli/runCommand.p10c2.examples.test.ts` | no | 3 | 7 | `Run Command example 9`, `answers/lines.txt`, `batch.r9.json`, `?? .morph/batches/`, `0.0005804` |

min = the file's record examples; max = min + 6 (new) or its tests + 4 (patched).

**Output budget** (`max_tokens`): code = targets in tokens (≈ bytes / 3.5) × 2 + 2 500, rounded up; judges from the
file they return, the heaviest ≥ 28 000.

| card | returns | `max_tokens` |
|---|---|---|
| read-registry | registry.ts ≈ 5.7 KB | 8 000 |
| read-batch | batchResponse.ts ≈ 4.4 KB | 8 000 |
| send-batch | types.ts 1.8 KB + batch.ts 6.2 KB | 12 000 |
| process-generation | types.ts 2.4 KB + generation.ts 10.7 KB | 16 000 |
| run-deck | deck.ts ≈ 8.1 KB | 12 000 |
| archive-run | types.ts 1.0 KB + archive.ts 4.0 KB | 8 000 |
| run-command | runCommand.ts ≈ 4.7 KB | 10 000 |
| read-registry-judge, read-batch-judge | ≈ 1.5 KB new file | 12 000 |
| process-generation-judge, run-deck-judge | ≈ 2.5 KB new file | 16 000 |
| archive-run-judge | archive.p10c2 ≈ 8 KB whole | 20 000 |
| run-command-judge | runCommand.p10c2 ≈ 6.5 KB whole | 24 000 |
| send-batch-judge (most examples, 11) | batch.examples ≈ 12 KB whole | 28 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- Layers unchanged: processor writes no file (the record leaves through `transport.saveBatch`); git imports only cards
  (`saveBatchRecord` takes `{batchId: string}` structurally); node:zlib in git is allowed; runloop writes nothing.
- A file a card writes is in no sibling's slice in the same generation: generation 1 (send-batch writes
  `src/processor/types.ts`) has no judge with it in its slice; generation 2 (process-generation writes
  `src/runloop/types.ts`) — run-command's slice holds no runloop file.
- Tests write only under `tmpRoot()` / `tmpRepo()` and remove it in `finally`; a judge writes only its test file.
- Exact strings of the record and §2.2: the executor copies them.

## 7. Out of scope

- **P11b2** (the split, with its reason): `morph submit` / `morph collect [--wait]` with the persisted state (the Batch
  Record of this phase plus `runId`, `generation`, `submittedAt`), their logic in processor (PLAN 07.10: cli only
  routes) and two routing lines in cli, plus a detached collect that verifies and commits a generation it did not send
  (Process Generation split in two). Reason: P11b1 alone is 14 cards over 4 Components (the operator's archive decision,
  items 1–4 and finding 7 must come first); cli now stands at 29 998 bytes and needs another compaction before any
  routing line.
- A provider order on the batch route (gap above; needs one measured submit).
- A per-call HTTP timeout separate from the batch wait (realTransport aborts a single GET after TIMEOUT_MS, now 1 h on
  route batch).
- Whether DELETE stops work the upstream already queued (`upstream: unsupported` for DeepInfra): measured only on a
  completed batch.
- Pruning old `answers/` or moving existing `*.request.json` of past runs out of git (history is not rewritten).

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component processor --component runloop \
  --component git --component cli --judge --checks decks/p11b/checks.json --out decks/p11b/deck.json
python3 decks/p11b/filter.py decks/p11b/deck.json            # keeps the 14 cards of the phase
node dist/cli.js deck check --root . --deck decks/p11b/deck.json                                  # errors 0
rm -rf /tmp/v2bin-p11b && mkdir -p /tmp/v2bin-p11b && cp -r dist /tmp/v2bin-p11b/ && ln -s $PWD/node_modules /tmp/v2bin-p11b/node_modules
node /tmp/v2bin-p11b/dist/cli.js run --root . --deck decks/p11b/deck.json --processor glm53 --deadline 2400
```

Cross-check (dry): from `morph-lab`, `venv/bin/mrph plan --spec <repo>/contour.yaml --map <repo>/morph-map.json
--component processor --component runloop --component git --component cli --judge --root <repo>`.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 14 (7 code, 7 judges) / 4: [read-registry, read-batch, run-deck, archive-run] [send-batch + 4 judges] [process-generation, run-command, send-batch-judge] [process-generation-judge, run-command-judge] |
| executor bill | ≈ $0.20 nominal (≈ 20 first requests of 10–60 KB in / 2–10 k out, 2–4 retries), ≤ $0.45 with a re-cut; cap $5 |
| cards with regeneration | 2–4 of 14 (send-batch: `cost: undefined` keys or the DELETE on a final error; read-batch: `cost: undefined`; archive-run: answers/ created for an empty set; send-batch-judge: the whole-file patch) |
| tests after the run | 610 ± 4 in 71 files |
| first red | read-batch: the key present as undefined; send-batch: the "still" text taking "deleted"; process-generation: batchId not last; run-deck: now() called with no retry batch due |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no judge cut off at its `max_tokens`; (3) the V2 cut
equals the old mrph's dry cut in ids, dependsOn, generations, targets, slices and max_tokens; (4) after the run no test
file outside §2.3's seven changed; (5) the run's own archive is still in the P10c2 layout (the running binary predates
the phase).

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the row of
`docs/MEASURE.md`; DECISIONS lines name "#4 item <n>", "#4 operator decision" or "#4 finding 7"; **the merge of this
phase closes #4** (items 1–5 and finding 7); P11b2's submit/collect gets its own labelled issue at that merge.

## 11. Actual

### Gate (preparation)

07.10, on the VPS, by the preparing orchestrator (Opus 5.5); no paid run, no generation on the live service (free GETs
of two batch objects and the cancel-route probes of §1, one of which DELETEd the completed slug-probe batch's record).
Data commits ba2452b (spec, record, map, fixtures, checks, probes, deck, `.gitignore`) and c6b7df8 (an archive-run probe
row closing the one mutation survivor, deck re-cut). Component sizes after the patch: processor **29 969**, runloop
**29 899**, git **17 202**, cli **29 998** (≤ 30 000 each).

The deck **cut by V2**: `node dist/cli.js plan --component processor --component runloop --component git --component
cli --judge --checks decks/p11b/checks.json --out decks/p11b/deck.json` exit 0, 44 cards, filtered by
`decks/p11b/filter.py` to 14; generations `[archive-run, read-batch, read-registry, run-deck] [archive-run-judge,
read-batch-judge, read-registry-judge, run-deck-judge, send-batch] [process-generation, run-command, send-batch-judge]
[process-generation-judge, run-command-judge]`; `node dist/cli.js deck check` **0 errors**, 6 warnings, all
`unordered-read` of the two types.ts files a later generation extends additively (intended: the readers use none of the
new members). Cross-check: the old `mrph plan --spec … --component processor runloop git cli --judge` (dry) gives the
same 44 ids and the same 5 generations; targets, slices, dependsOn, intent, variants and reasoning (2 500) equal on all
44; max_tokens equal on the 14 phase cards (3 judges outside the phase differ: V2's P10a judge formula); instructions
differ on all 44 (the P10a design); acceptances differ on the 14 phase cards (V2's builder chain from checks.json — run
below) and on 6 cards outside the phase with no map acceptance (as in P11), the other 24 equal.

Scratch worktree from ba2452b (references of the 10 code files and the 7 test files, deleted afterwards), cards run in
deck order with the deck's own acceptances, each accepted card committed before the next: **14 of 14 chains green,
36.8–42.8 s each (557.1 s in all; limit 250 s per chain)**; archive-run re-run on c6b7df8 green (57.1 s under load). The
final tree `tsc`, `eslint src tests`, build clean, `vitest run` **610 / 610** in 71 files (599 − 0 + 11; ripple as
measured: the 3 fullExclude tests, red only between their code card and judge). Typed one-line throwing stubs (`Error:
stub <fn> <args>`; the three types.ts as specified): every code card red at the probe — read-registry 2/2, read-batch
2/2, send-batch 16/17 (the type row passes on typed stubs), process-generation 2/2, run-deck 2/2, archive-run 4/4,
run-command 3/3; **all new and changed record examples red** (RR 5, RB 6, SB 1–11, PG 14, RD 8, AR 4, 6, 7, RC 8, 9),
each with a readable line; chains 8.0–10.1 s. Judges with the reference code: the four new files absent → red at the
guard ("… missing", 5.8–7.3 s); the three patched files at HEAD → red at the guard (test counts 2/7/2 below min, every
new literal named, 7.9–8.4 s). Mutation check: **35 single-rule mutations** of the references (read-registry 2,
read-batch 2, send-batch 16, process-generation 2, run-deck 3, archive-run 7, run-command 3), every run under a 120 s
timeout: **35 killed** — 34 by the card's probe, **1 killed by timeout** (run-deck: the empty-batch `break` removed, the
retry loop never ends; in a real chain the 300 s acceptance timeout kills it). The first pass (without timeouts) left
one survivor (saveBatchRecord's id check as `includes("/")`), closed by the c6b7df8 row (`"a b"` → null).

Max slice + targets: send-batch-judge 59 415 bytes (gate 200 KB). **Forecast** on glm53 ≈ $0.30 (P10c2: 15 requests,
243 k in / 81 k out, $0.1840; here 21 first requests of 41–59 KB, ≈ 340 k in / 85 k out, 2–4 retries), ≤ $1. On `ds`
(deepseek/deepseek-v4.1-flash, catalogue 07.10: $0.30 / M in, $1.20 / M out) with every maxTokens × 3: ≈ $0.10 in +
$0.10–0.30 out (the × 3 raises the cap, not the use, unless an answer ran to it) ≈ **$0.20–0.40**, ≤ $1. **Gate holds.**

**Run command** (from the repo root, the binary copied first; today's binary = e10465c's code + data; default retry cap;
the session swaps `--processor` to `ds` and applies maxTokens × 3 to the deck as the operator ordered):

```
npm run build && rm -rf /tmp/v2bin-p11b && mkdir -p /tmp/v2bin-p11b && cp -r dist /tmp/v2bin-p11b/ && ln -s $PWD/node_modules /tmp/v2bin-p11b/node_modules
node /tmp/v2bin-p11b/dist/cli.js run --root . --deck decks/p11b/deck.json --processor glm53 --deadline 2400 > /tmp/p11b-run.json
```

### Run (07.10, VPS, autonomous) — cut by V2, run by the V2 binary on processor ds

Deck `decks/p11b/deck.json` (V2 cut of processor, runloop, git, cli, filtered to 14 cards by `decks/p11b/filter.py`,
then **every maxTokens ×3** by `decks/tools/scale_tokens.py` — the operator's processor switch of 07.10), run by the V2
binary copy in `/tmp/v2bin-p11b` with **`--processor ds`** (`deepseek/deepseek-v4.1-flash`, provider alibaba), default
retry cap, `--deadline 2400`: run 20261007-174926, **14 / 14 written in one run, no fix**, 13 at the first attempt
(retry won `run-deck-judge`, r1.v1; v1 red at the own-test stage), $0.1379, 21.8 min (1308 s), 22 requests, 410 508 in /
156 909 out tokens, every finish `stop`. On the run branch: `git status` clean; tsc, eslint, `npm run build` clean;
vitest **610 / 610** in 71 files. Read once against §2.2: request copies gzipped to `requests/` with its own `.gitignore`
`*` (never committed), answers + `answers/lines.txt` committed (#4 operator decision); batch cost read from the batch
object's `usage.cost` and shared over the replies by tokens when no item carries a cost (#4.1); `batchId` the last key of
a request row the batch names, the batch record saved through `transport.saveBatch` to `.morph/batches/<id>.json`
(ignored by `.morph/*`, local) (#4.2); no provider order on the batch route (#4.3); batch-route `TIMEOUT_MS` default
3 600 000 (#4.4); a give-up sends one DELETE and saves the record with status `deleted` on a 2xx (finding 7a); the deadline
checked before each retry batch, the stopped cards `budget-exceeded` "deadline" (finding 7b). 0 defects. Risk kept: the
real transport's per-call abort is `timeoutMs`, so on the batch route one HTTP call may hang up to 1 h. This run's own
archive is in the P10c2 layout (2.1 MB, request copies included): the running binary predates the phase. The merge
closes issue #4; `submit` / `collect` are P11b2.
