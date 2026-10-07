# TASK_P11 — the processor's batch route: one generation as one OpenRouter batch (`src/processor/`)

> Phase P11 of `docs/PLAN.md` ("Фазы по записи (после P2)", row P11: `/api/beta/batches`, submit/collect), first half
> **P11a**; the split is §7. Component `processor` of `contour.yaml`: three new Functions (Assemble Batch, Read Batch,
> Send Batch), two new Data Objects (Batch Call, Batch Read), Send Generation patched (route batch → Send Batch; the stub
> answers on either route). No other Component changes: `morph run` reaches the batch route through the processor's
> own `ROUTE=batch` (Read Registry has read it since P4), so `cli` (29 835 of 30 000 bytes) and `runloop` are not
> touched. The deck is cut by V2 (`morph plan --checks decks/p11/checks.json`), filtered to this phase's 8 cards by
> `decks/p11/filter.py`. No labelled issue (`gh issue list --label P11-processor`: none, 07.10).

## 1. Why this

- **The route exists and answers nothing.** Since P4 a config with `ROUTE=batch` is read and valid, and every request
  of it answers `route batch is not available on the sync sender` (P4 §7, DECISIONS P4 "scope"). The old Morph ran its
  decks on the batch route (`mrph/processors/batch.py` `OpenRouterBatchBackend`): `z-ai/glm-5.3-flash:batch` accepted
  **8 of 8** cards first try on 19.09 (`mrph/documentation/ORCHESTRATOR_RUNBOOK.md`); V2 has no way to run a deck there.
- **Width is free on a batch, depth is not.** Measured by the old Morph 17.09 (`mrph/documentation/ARCHITECTURE.md` §10):
  7 requests in one glm batch came back in the same 36 min as 1 request (35 min 56 s vs 37 min 54 s); queues 6 min to
  200+ min by model. On the sync route V2's last run (P10c2) sent 15 requests at concurrency 3 in 29.4 min with every
  `429`/`5xx` retried by the client; on a batch the provider holds the queue and a generation is one submit and a few
  GETs.
- **Price.** OpenRouter batches are billed at half the sync price (old Morph: "half price, 24h window"). The saving is
  small in dollars (P0–P10c2 executor bill $2.5388 in all; half of it ≈ $1.27) and the old Morph's own lesson stands:
  the orchestrator, not the executor, is 98 % of a phase's cost. The motive is parity and the queue, not the dollars.
- **Is there a batch endpoint for glm53?** The public catalogue (`GET https://openrouter.ai/api/v1/models`, 07.10, no
  key) lists 465 models, 73 `:batch` slugs, among them `z-ai/glm-5.3:batch` and `z-ai/glm-5.3-flash:batch`. The old
  Morph measured that the catalogue lies (17.09: of the Anthropic line only `claude-opus-5:batch` had an endpoint; the
  others answer `does not have a :batch endpoint`), and `glm-5.3-flash:batch` is the only glm slug it ran. Whether
  `z-ai/glm-5.3:batch` answers is **not measured** here (no paid call before the gate); the transport is tested on a
  scripted fetch, the slug is checked by the post-merge smoke's first step (§8), with `z-ai/glm-5.3-flash:batch` as the
  fallback.

**Ripple, measured** (references of the 4 code targets in a scratch worktree, full suite): **1 of 584** tests red —
`tests/processor/send.examples.test.ts` "Send Generation: the batch route answers every request with the route error"
(its rule is gone). `Transport.fetch`'s init member `body` becomes optional (a GET carries none; Node's `fetch` throws
on a GET with any body, `""` included — checked: "Request with GET/HEAD method cannot have body"): 0 tests red, tsc
clean. Processor Config, Answer, Usage, GenerationResult, the registry's 12 keys, Run Report and Run Document are
unchanged.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Request** — `src/compiler/types.ts`: `{customId, model: string | null, maxTokens: number | null, reasoning:
  Reasoning | null, messages: {role, content}[]}`, Reasoning `{maxTokens: n} | {effort}` (`src/cards/types.ts`). Every
  example builds requests inline (`model null, maxTokens null, reasoning null, messages [{role "user", content "hi"}]`
  unless the example says otherwise).
- **ProcessorConfig**, **Answer**, **Usage**, **Reply** (`{answer, usage}`), **GenerationResult**, **Transport** —
  `src/processor/types.ts` (P4); the one change is §2.2's `body?`.
- **The fixtures** (`tests/fixtures/processor/`; the batch shapes are the old Morph's, taken from its tests where it
  marks them "verbatim from the live service" — the batch id, the 404 body, the failed batch's error, the no-endpoint
  sentence — and cleaned: the account name of the quota error is `acct-0000`; the result bodies are the P4 chat
  completions `okResponse.json` / `lengthResponse.json` with new ids and half the cost). Each is described by the type
  the Function takes and what it returns:

| file | type | what it is | Read Batch returns on (status, its text) |
|---|---|---|---|
| `batchConfig.json` | ONE ProcessorConfig object | id glm53b, type openrouter, model `z-ai/glm-5.3:batch`, apiKey `sk-or-test`, baseUrl `https://openrouter.ai/api/v1`, route `batch`, concurrency 1, providerOrder ["Novita"], reasoning {maxTokens 2500}, **timeoutMs 60000** (→ 4 polls), maxRetries 2, answersDir null | — (a config) |
| `batchSubmitted.json` | text of ONE batch object | the answer to a submit: status `validating`, results null, error null | 202 → pending, status validating, batchId `batch-1789576284-Ejahe4wq9AgVdp5xGdNm`, 0 replies |
| `batchInProgress.json` | text of ONE batch object | the same id, status `in_progress` | 200 → pending, status in_progress, 0 replies |
| `batchCompleted.json` | text of ONE batch object | status `completed`, `results` = 3 entries in the order **c.v1, a.v1, b.v1**: c.v1 `{response: null, error: {message: "context length exceeded"}}`; a.v1 response 200, content "```ts\nexport const a = 1;\n```", finish stop, 11030/571 tokens, cost 0.00269316, provider Novita, id `gen-0000000003-TESTtestTESTtestTEST`; b.v1 response 200, content null, finish length, 15550/12000, cost 0.0086, id `gen-0000000004-…` | 200 → done, 3 replies (c.v1 an item error, a.v1 a text, b.v1 a null text with finish length) |
| `batchFailed.json` | text of ONE batch object | status `failed`, results null, error.message `HTTP 400: invalid batch inference job: job-submission-count for account acct-0000, in use: 16, quota: 16` | 200 → failed, that error, 0 replies |
| `batchNotFound.json` | text of ONE error body | `{"error": {"message": "Batch job batch-1789576284-Ejahe4wq9AgVdp5xGdNm not found.", "code": 404}}` | 404 → error read, `http 404: Batch job … not found.` |
| `noBatchEndpoint.json` | text of ONE error body | error.message `HTTP 400: invalid batch inference job: Model 'z-ai/glm-5.3:batch' does not have a :batch endpoint.` | 400 → error read, `http 400: HTTP 400: …` |

No request named d.v1 has a result in `batchCompleted.json` (Send Batch example 1's "no result").

**A judge's setup** (TASK_TEMPLATE §2.1; every Function here is of this Component):

- **F1** processor · Read Batch hands every entry with a response to Read Response, which reads usage on any status and
  maps a null content to `text: null, error: null` · Read Batch 2, Send Batch 1.
- **F2** helpers · `fixture("processor/<name>")` is the file's text, `fixtureJson(…)` its parsed value;
  `fakeFetch()` with no routes answers every URL 404 with the text `{"error":"not found"}` · Send Generation 7.
- **F3** processor · polls = max(1, floor(timeoutMs / 15000)): the fixture config's 60000 gives **4** polls, 120000
  gives 8; each poll sleeps BEFORE its GET, so n polls = n sleeps of 15000 · Send Batch 1–7.

**Distinct markers.** customIds `a.v1`, `b.v1`, `c.v1`, `d.v1`, `x.v1`; status words `validating`, `in_progress`,
`completed`, `failed`; the error prefixes `batch submit: `, `batch item error: `, `batch <id>: `, `batch <id> <status>: `,
`batch runs one model: ` — a test that greps one does not match another.

**Harness skeleton** (Send Batch and Send Generation 6; ≤ 10 lines, built from `tests/helpers.ts` and the types):

```ts
type Step = Error | { status: number; text: string };
const ok = (status: number, name: string): Step => ({ status, text: fixture("processor/" + name) });
function script(steps: Step[]) { // replies in call order, the last one repeats; every call and sleep recorded
  const calls: { url: string; method: string; body: string | undefined }[] = []; const sleeps: number[] = [];
  const transport: Transport = { fetch: async (url, init) => { calls.push({ url, method: init.method, body: init.body });
      const s = steps[Math.min(calls.length, steps.length) - 1]; if (s instanceof Error) throw s;
      return { status: s.status, text: async () => s.text }; },
    sleep: async (ms) => { sleeps.push(ms); } };
  return { transport, calls, sleeps }; }
```

### 2.2. OUTPUT data shapes

**`src/processor/types.ts`** — ONE change: Transport's fetch init gets an optional body.

```ts
export interface Transport {
  fetch(url: string, init: { method: string; headers: Record<string, string>; body?: string }): Promise<HttpReply>;
  sleep(ms: number): Promise<void>;
}
```

`realTransport` (send.ts) is unchanged: it spreads `init`, so a GET without a body key reaches `fetch` without one.

**`src/processor/batchRequest.ts`** (NEW) — Assemble Batch, pure:

```ts
export interface BatchCall { url: string; headers: Record<string, string>; body: string }
export function batchUrl(baseUrl: string): string
export function assembleBatch(requests: Request[], config: ProcessorConfig): BatchCall
```

- `batchUrl`: strip trailing `/`; when the rest ends with `/v1`, that final `/v1` becomes `/beta`; then `+ "/batches"`.
  `https://openrouter.ai/api/v1` → `https://openrouter.ai/api/beta/batches`; `http://127.0.0.1:9/v1/` →
  `http://127.0.0.1:9/beta/batches`; `http://h/x/` → `http://h/x/batches`; `http://h/v1x` → `http://h/v1x/batches`;
  `http://h/v1/api` → `http://h/v1/api/batches`.
- headers: `Authorization: "Bearer <apiKey>"` first when apiKey is not null, then `Content-Type: application/json`.
- body: ONE JSON text, keys in this order — `endpoint` `"/v1/chat/completions"`, `model` = config.model, `requests`;
  per request in order `{custom_id, body}`, the body's keys in this order: `max_tokens` (the request's maxTokens, absent
  when null), `reasoning` (the request's, else the config's: `{max_tokens: n}` or `{effort}`; absent when both null),
  `messages` (`{role, content}` copies). No item names a model (one model per batch; the old Morph: the service refuses
  an item whose model differs); no `provider`, `usage`, `tools`, `tool_choice`, `stream` anywhere (the old Morph's
  proven body; P4's provider pin is a sync-route field). `[]` → `{"endpoint":…,"model":…,"requests":[]}`.

**`src/processor/batchResponse.ts`** (NEW) — Read Batch, pure, never throws:

```ts
export type BatchState = "pending" | "done" | "failed" | "error";
export interface BatchRead { batchId: string | null; state: BatchState; status: string | null; error: string | null; replies: Reply[] }
export function readBatch(status: number, text: string): BatchRead
```

In order: status outside 200..299 → error read `"http <status>: " + (error.message of the JSON body ?? text.slice(0,
200))`; a body that is not a JSON object (an array included) → `"unreadable response: " + text.slice(0, 200)`; no string
`status` → `"provider error: " + (error.message ?? "no batch status")`. An error read is `{batchId: null, state:
"error", status: null, error, replies: []}`. Otherwise `batchId` = `id` when a string else null; `status` = the word;
`state` `done` for `completed`; `failed` for `failed`, `expired`, `cancelled`, `canceled`, `cancelling`; `pending` for
anything else (`validating`, `in_progress`, `finalizing`, …); `error` = the batch's `error.message` (string) else null.
`replies`: per entry of `results` when it is an array, in the provider's order, skipping an entry that is not an object
or has no string `custom_id`:

| entry | Reply |
|---|---|
| `error` not undefined/null | answer `{customId, text: null, finishReason: null, error: "batch item error: " + (error.message ?? JSON.stringify(error).slice(0, 200))}`, usage `{customId, 0, 0, cost null, provider null, generationId null}` (`error: "boom"` → `batch item error: "boom"`) |
| no `response` object | the same with `batch item error: no response` |
| else | `readResponse(custom_id, response.status_code when a number else 200, JSON.stringify(response.body ?? null))` (P4: `status_code 500` → `http 500: …`, `choices []` → `provider error: no choices`) |

**`src/processor/batch.ts`** (NEW) — Send Batch:

```ts
export const BATCH_POLL_MS = 15000;
export const BATCH_GRACE_MS = 60000;
export async function sendBatch(config: ProcessorConfig, requests: Request[], transport: Transport): Promise<GenerationResult>
```

Never rejects; `answers` and `usage` in the order of `requests`, one each. Every error answer is `{customId, text: null,
finishReason: null, error}` with usage `{customId, inputTokens: 0, outputTokens: 0, cost: null, provider: null,
generationId: null}`.

1. A request with `model !== null && model !== config.model` → `batch runs one model: <customId> pins <model>, the batch
   is <config.model>`; it is left out. No request left (`[]` included) → no call.
2. **Submit**: `call = assembleBatch(rest, config)`; ONE `transport.fetch(call.url, {method: "POST", headers:
   call.headers, body: call.body})`, never retried (a POST that reached the provider may already be a paid batch);
   `readBatch(status, text)`. Thrown → every request `batch submit: transport: <message>`; an error read → `batch
   submit: <its error>` (a 503 included); `batchId` null → `batch submit: no batch id`.
3. **Poll** `k = 1..polls`, `polls = max(1, floor(config.timeoutMs / BATCH_POLL_MS))` (on this route TIMEOUT_MS is the
   whole wait for the batch; `realTransport` still aborts each single HTTP call after it): `await
   transport.sleep(BATCH_POLL_MS)`; `transport.fetch(call.url + "/" + batchId, {method: "GET", headers: call.headers})`
   — no body key; `readBatch`. Thrown → next poll. Error read with status 404 and `k * BATCH_POLL_MS <=
   BATCH_GRACE_MS` (read-after-write lag, the old Morph's 60 s grace), or status 408, 429, ≥ 500 → next poll. Any other
   error read → final: every request `batch <batchId>: <its error>`. `pending` → remember its status, next poll.
4. **done or failed** → each request takes the FIRST reply whose `answer.customId` is its customId (its answer and
   usage as Read Batch gave them); none → `batch <batchId> <status>: <the read's error ?? "no result">` (a failed batch
   with no results: every request `batch <id> failed: HTTP 400: invalid batch inference job: …`).
5. Polls run out → every request `batch <batchId> still <last status> after <polls> polls`, the last status read by a
   poll, the submit's (`validating`) when no poll read one. The batch is not cancelled (§7).

| Send Batch example | calls | sleeps | answers |
|---|---|---|---|
| 1 submit 202, in_progress, completed; a.v1 b.v1 c.v1 d.v1 | POST, GET, GET | 15000 ×2 | a.v1 text stop; b.v1 null length; c.v1 `batch item error: context length exceeded`; d.v1 `batch batch-…Nm completed: no result` |
| 2 submit, 404, completed; a.v1 | 3 | ×2 | a.v1 stop |
| 3 timeoutMs 120000; submit, in_progress ×4, 404 | 6 | ×5 | `batch batch-…Nm: http 404: Batch job batch-…Nm not found.` |
| 4 submit, failed; a.v1 b.v1 | 2 | ×1 | both `batch batch-…Nm failed: HTTP 400: invalid batch inference job: job-submission-count for account acct-0000, in use: 16, quota: 16` |
| 5 submit 400 noBatchEndpoint; a.v1 b.v1 | 1 | none | both `batch submit: http 400: HTTP 400: invalid batch inference job: Model 'z-ai/glm-5.3:batch' does not have a :batch endpoint.` |
| 6 submit, in_progress forever; a.v1 | 5 | ×4 | `batch batch-…Nm still in_progress after 4 polls` |
| 7 x.v1 model "other/m", a.v1; submit, thrown, completed | 3 (the POST's requests: a.v1 only) | ×2 | x.v1 `batch runs one model: x.v1 pins other/m, the batch is z-ai/glm-5.3:batch`; a.v1 stop |

(`batch-…Nm` = `batch-1789576284-Ejahe4wq9AgVdp5xGdNm`; every literal in a test is written whole.)

**`sendGeneration`** (`src/processor/send.ts`) — the switch becomes: type `stub` → Stub Answer per request, no call,
on either route; type `openrouter`, route `batch` → `return sendBatch(config, requests, transport)`; route `sync` → the
P4 pool, unchanged. The text `route batch is not available on the sync sender` goes away. Example 6: batchConfig, a.v1,
submit 202 then completed → calls `POST https://openrouter.ai/api/beta/batches`, `GET
https://openrouter.ai/api/beta/batches/batch-1789576284-Ejahe4wq9AgVdp5xGdNm`, sleeps [15000], answers exactly
`[{customId "a.v1", text "```ts\nexport const a = 1;\n```", finishReason "stop", error null}]`, usage 11030 / 571 /
0.00269316. Example 7: the stub config of Read Registry example 2 with route "batch" and answersDir holding `a.v1.md` =
`"A\n"` → no call, no sleep, text `"A\n"`, finishReason "stop".

**Gaps decided here** (each one line in `docs/DECISIONS.md`, "P11 processor"):

- **Which processor/route.** Type `openrouter` with `ROUTE=batch` only; no new TYPE and no new registry key (the 12 KEYS
  are compared whole in the P4 tests). The model is the env's MODEL, a `:batch` slug written by the operator (the old
  Morph's `.env` did the same); no suffix is added by code. The stub ignores the route.
- **Where the batch lives in a run.** One generation = one batch: Process Generation already sends a generation's
  requests in ONE sendGeneration call (and each retry batch in one more), so `morph run` with a batch processor needs no
  `--batch` flag and no cli or runloop change. TIMEOUT_MS is the batch wait on this route (default 600000 = 10 min; the
  old Morph measured glm batches at 23–38 min, so a batch processor sets TIMEOUT_MS ≥ 3600000); the run's `--deadline`
  is checked between generations as before.
- **Persisted batch state: none in P11a.** The batch id is in every error text of a failed, refused or timed-out batch
  (`batch <id> …`), in the run's stderr variant lines and in `.morph/runs/<id>/answers/`; a batch that completes needs no
  state. A crash during the wait loses the id (the provider finishes and bills it; ≤ cents per batch). Detached
  `morph submit` / `morph collect` with a state file are P11b (§7).
- **Polling**: fixed 15 s, no backoff (a GET is free; a doubling interval overshoots a 20–40 min queue by minutes);
  sleep before every GET; 404 tolerated for 60 s; thrown, 408, 429, 5xx polls tolerated until the polls run out; any
  other error final. **Submit never retried** (the old Morph did not either; a duplicate POST is a second paid batch).
- **Partial results**: a done or failed batch maps every result it carries; a request without one gets the batch's
  error or `no result`; an item error becomes that request's error, the others keep their answers.
- **Pinned model**: refused per request before the submit, not silently replaced (one model per batch).
- **Transport**: `body?: string` instead of a second method; 0 tests red, measured.

### 2.3. Names and the tests each judge writes

| module | change | code card's tests | judge's file |
|---|---|---|---|
| `src/processor/batchRequest.ts` | NEW Assemble Batch, batchUrl, BatchCall | probe only | NEW `tests/processor/batchRequest.examples.test.ts` (AB 1–2) |
| `src/processor/batchResponse.ts` | NEW Read Batch, BatchState, BatchRead | probe only | NEW `tests/processor/batchResponse.examples.test.ts` (RB 1–5) |
| `src/processor/types.ts`, `src/processor/batch.ts` | `body?`; NEW Send Batch | probe only | NEW `tests/processor/batch.examples.test.ts` (SB 1–7) |
| `src/processor/send.ts` | the route switch | probe only | PATCH `tests/processor/send.examples.test.ts` (SG 6–7; one test deleted) |

- `batchRequest.examples`: "Assemble Batch example 1: …" (url, headers `toStrictEqual`, the body text `toBe` the
  record's string), "Assemble Batch example 2: …" (also `batchUrl("http://h/x/")`).
- `batchResponse.examples`: "Read Batch example 1…5"; example 2 compares each of the 3 replies whole.
- `batch.examples`: "Send Batch example 1…7", each transport from the §2.1 skeleton; calls by method and url, sleeps
  `toStrictEqual`, answers whole where the table gives them whole.
- `send.examples` (12 tests → 13): examples 1–5 and the six other tests unchanged; "Send Generation example 6: …" and
  "Send Generation example 7: …" right after example 5; the test "Send Generation: the batch route answers every request
  with the route error" deleted.

Strings with `toBe`; a whole answer, usage, reply or result with `toStrictEqual`; a literal holding a single quote goes
in a double-quoted string. No `vi.*`, no timers, no variable named `fetch` or `Fake*`; import only what you use.

### 2.4. What must not break

- Byte for byte: every file outside the 5 code targets and the 4 test files of §2.3 — `src/processor/{assemble,
  registry,response,stub}.ts`, every `src/` folder but processor, `src/cli.ts`, `tests/helpers.ts`, every existing test
  file but `send.examples`.
- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/` — untouched by every card.
- The 584 tests stay green except the one batch-route test of `send.examples` (red from send-generation, generation 2,
  to its judge, generation 3); after the run **584 − 1 + 2 + 2 + 5 + 7 = 599** in 67 files (the reference judges: 599).

## 3. Acceptance

Built by `morph plan --checks decks/p11/checks.json` (Component `builder`), narrow to broad, every stage printing
`== <stage>`. `ownGit: true` (the full suite spawns git in tmp repos; the chain checks this repository's HEAD and refs
before and after). `fullExclude` = `tests/processor/send.examples.test.ts` (the one rippled file).

Code cards (no test file, code-only targets, no smoke cap): `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs
src <targets>` (the processor layer: `fetch` only under `src/processor/`, no new folder) → `decks/p11/parts/<card>.probe.ts`
(assemble-batch: AB 1, 2 + 3 rows = 5; read-batch: RB 1–5 + 4 rows = 9; send-batch: SB 1–7 + 4 rows = 11;
send-generation: SG 6, 7 + 2 rows = 4; **29 tests**) → eslint's verdict → full `vitest run` minus fullExclude → own git →
frozen → untracked.

Judge cards: `probe/<card>/` → `tsc` → `eslint <targets>` → `guard.mjs tests <file> <min> <max> lits<n>.json` → (the
patched file only) every test name at HEAD still there but the dropped one → `vitest run <targets>` → eslint's verdict →
full run → own git → frozen → untracked.

| file | new | min | max | lits |
|---|---|---|---|---|
| `tests/processor/batchRequest.examples.test.ts` | yes | 2 | 8 | `Assemble Batch example 1`, `… 2`, `https://openrouter.ai/api/beta/batches`, `http://127.0.0.1:9/beta/batches`, `http://h/x/batches` |
| `tests/processor/batchResponse.examples.test.ts` | yes | 5 | 11 | `Read Batch example 1` … `5`, `batch item error: context length exceeded`, `gen-0000000003-TESTtestTESTtestTEST`, `unreadable response: <html>bad gateway</html>` |
| `tests/processor/batch.examples.test.ts` | yes | 7 | 13 | `Send Batch example 1` … `7`, `completed: no result`, `still in_progress after 4 polls`, `batch runs one model: x.v1 pins other/m, the batch is z-ai/glm-5.3:batch` |
| `tests/processor/send.examples.test.ts` | no | 7 | 16 | `Send Generation example 6`, `… 7`, `https://openrouter.ai/api/beta/batches/batch-1789576284-Ejahe4wq9AgVdp5xGdNm`; drop `Send Generation: the batch route answers every request with the route error` |

min = the file's record examples; max = min + 6 (new files) or its tests + 4 (send).

**Output budget per card** (`max_tokens`): code = the reference targets in tokens (≈ bytes / 3.5) × 2 + 2 500
reasoning, rounded up; judges by the file they return, the heaviest ≥ 28 000 (P10c2: a 20 000 judge was cut at
`length` on its first answer).

| card | returns | `max_tokens` |
|---|---|---|
| assemble-batch | batchRequest.ts ≈ 1.5 KB | 6 000 |
| read-batch | batchResponse.ts ≈ 2.9 KB | 8 000 |
| send-batch | types.ts 1.6 KB + batch.ts 3.3 KB | 10 000 |
| send-generation | send.ts ≈ 3.6 KB | 8 000 |
| assemble-batch-judge | ≈ 2.5 KB | 16 000 |
| read-batch-judge | ≈ 4.5 KB | 20 000 |
| send-batch-judge (most examples, 7) | ≈ 8–11 KB | 28 000 |
| send-generation-judge | send.examples ≈ 12.5 KB whole | 20 000 |

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`.
- Layers unchanged: processor imports cards and compiler types only; `fetch` (the global) stays inside `realTransport`;
  Assemble Batch and Read Batch read no clock, network or environment; Send Batch waits only through `transport.sleep`.
- A file a card writes is in no sibling's slice in the same generation: generation 1 (send-batch writes types.ts) has
  no judge with `src/processor/types.ts` in its slice; generation 2 (send-generation writes send.ts) has no
  send-batch-judge slice with send.ts.
- Tests write only under a `tmpRoot()` and remove it in `finally`; a judge writes only its test file.
- Exact strings of the record and §2.2 (every error text, the body text, the urls): the executor copies them.

## 7. Out of scope

- **P11b** (the split, with its reason): detached `morph submit` / `morph collect [--wait --timeout]` with a persisted
  state file `.morph/batches/<batchId>.json` (`{batchId, processor, runId, generation, customIds, submittedAt}`), the
  commands' record in Component processor and two routing lines in cli. Reason: cli stands at **29 835 of 30 000**
  bytes and needs a compaction first; a detached collect must verify and commit a generation it did not send, which
  splits Process Generation in two (runloop at 29 178 bytes, also at the limit); together ≥ 12 cards over 3 Components.
  P11a alone gives `morph run` the batch route at 8 cards and 0 bytes of cli/runloop.
- Cancelling a timed-out batch (`POST /batches/<id>/cancel`); a stderr line per poll (Send Batch has no log; the
  variant lines after the generation carry the batch id on failure).
- A per-model split of one generation into several batches (refused per request instead).
- OpenAI / Anthropic batch APIs (PLAN: only OpenRouter).
- A slug pre-flight in code (the old Morph's no-endpoint special message): the provider's own sentence reaches the
  answer verbatim (Send Batch 5).

## 8. How to run

```
npm run build
node dist/cli.js plan --root . --spec contour.yaml --map morph-map.json --component processor --judge \
  --checks decks/p11/checks.json --out decks/p11/deck.json
python3 decks/p11/filter.py decks/p11/deck.json            # keeps the 8 cards of the phase
node dist/cli.js deck check --root . --deck decks/p11/deck.json                                  # errors 0
rm -rf /tmp/v2bin-p11 && mkdir -p /tmp/v2bin-p11 && cp -r dist /tmp/v2bin-p11/ && ln -s $PWD/node_modules /tmp/v2bin-p11/node_modules
node /tmp/v2bin-p11/dist/cli.js run --root . --deck decks/p11/deck.json --processor glm53 --deadline 2400
```

Cross-check (dry): from `morph-lab`, `venv/bin/mrph plan --spec <repo>/contour.yaml --map <repo>/morph-map.json
--component processor --judge --root <repo>`.

**Post-merge live smoke (proposal, AUTONOMY "Smoke stops"; not run here).** What it exercises: the merged V2 binary
running a 2-card deck (a,b→c is not needed: two independent tiny cards, so ONE generation = ONE batch) on the batch route
of the real provider: submit, polls, results mapped back, acceptance, commits, archive. Recipe in the form of
`decks/p10b2/smoke/`, in a tmp git repo outside `~/MorphV2` (`decks/p11/smoke/run.sh` to be written by the smoke):
0. slug probe, one call, nothing else runs if it is refused: the `curl` of `mrph/documentation/ARCHITECTURE.md` §9
   (`max_tokens 8`) against `z-ai/glm-5.3:batch`; refused with `does not have a :batch endpoint` → use
   `z-ai/glm-5.3-flash:batch` (the old Morph's 8/8 slug);
1. env by indirection from `morph-lab/.env` (never printed): `MORPH_PROCESSOR_glm53b_TYPE=openrouter`, `_API_KEY` =
   glm53's key, `_MODEL=<the slug of step 0>`, `_ROUTE=batch`, `_TIMEOUT_MS=3600000`, `_MAX_RETRIES=0`;
2. deck: 2 TypeScript cards with shell acceptances (`grep -q 'export const a' out/a.ts`), `maxTokens 2000`;
3. `node <copy>/dist/cli.js run --root <tmp> --deck deck.json --processor glm53b --max-retry-batches 0 --deadline 4000`;
   ceiling **$0.10** (expected ≈ $0.002: two small requests at half price), wait ≤ 60 min (old Morph: 23–38 min).
Green = exit 0, 2/2 written, the report's two usage rows non-zero; record a "P11 smoke" row in `docs/MEASURE.md`.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards / generations | 8 (4 code, 4 judges) / 4: [assemble-batch, read-batch] [assemble-batch-judge, read-batch-judge, send-batch] [send-batch-judge, send-generation] [send-generation-judge] |
| executor bill | ≈ $0.10 nominal (≈ 10–12 first requests of 8–30 k in / 2–8 k out), ≤ $0.35 with a re-cut; cap $5 |
| cards with regeneration | 1–3 of 8 (send-batch: a retried submit or a sleep after the GET; read-batch: `"cancelling"` pending; send-batch-judge: a script that counts sleeps wrong) |
| tests after the run | 599 ± 4 in 67 files |
| first red | assemble-batch: `provider` copied from Assemble Request into an item; read-batch: an item error read from `response.body.error`; send-batch: the GET sent with `body: ""`; send-generation: the stub check left after the route check |

**Falsifiable claims:** (1) no card red on a sibling's file; (2) no judge cut off at its `max_tokens`; (3) the V2 cut
equals the old mrph's dry cut in ids, dependsOn, generations, targets, slices and max_tokens; (4) after the run no test
file outside §2.3's four changed; (5) cli and runloop sources byte-identical after the run.

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), truncations, judge defects, the row of
`docs/MEASURE.md`; then the smoke stop (AUTONOMY: after P11 the session stops for the operator, red or green).

## 11. Actual

### Gate (preparation)

(filled at the gate)
