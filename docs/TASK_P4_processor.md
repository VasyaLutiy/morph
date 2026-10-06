# TASK_P4 — the processor, sync route (`src/processor/`)

> Phase P4 of `docs/PLAN.md` ("Фазы по записи (после P2)"), Component `processor` of
> `contour.yaml` (five Functions: Read Registry, Assemble Request, Read Response, Stub Answer,
> Send Generation; three Data Objects: Processor Config, Answer, Usage). TypeScript under
> `src/processor/`: read the processors from the environment, turn a compiled Request into
> an OpenRouter chat-completions call, send one generation on the sync route under a
> concurrency limit with retries, read the answer and its usage back, and a stub processor
> that answers from files. The first `fetch` of the tree, always behind a transport that is
> a parameter (mocked in every test; the network stays blocked by `tests/setup.ts`).
> Built by the old Morph (`mrph`) on glm; judge cards write the example tests.
>
> Reconciliation with the PLAN: P4 = "реестр из env, сборка запроса OpenRouter,
> sync-отправка, usage, stub-процессор". The batch route (`/api/beta/batches`, submit and
> collect) is P11 and no Function of this phase touches it: the record's Component held three
> skeleton Functions, all sync; two were added (Read Response, Stub Answer) so that the
> parse of a reply and the stub are pure, separately probed units. Nothing stays for P11 in
> this Component except the batch route itself (§7).

## 1. Why this

P5 (`runloop`) needs a processor to run a deck end to end in vitest, and P7 needs one for
the first run of the `morph` binary; both run on the stub first, then on glm. The old Morph
paid for every rule below (`mrph/processors/registry.py`, `openai_processor.py`):

- **Provider drift.** One slug served by many upstreams: six requests of one slug landed
  on six providers, with up to a sixfold spread in output on identical input. The pin
  `provider: {order, allow_fallbacks: false}` makes it one machine. P0–P3 ran 6 runs on
  `glm53` pinned; every usage row of `.morph/runs/*/report.json` says `Novita`.
- **Paid truncation.** A reasoning model spent 79 974 of 80 000 tokens thinking and
  answered `finish_reason: "length"` with `content: null` (issue #8). The old code
  concatenated `None` and raised a TypeError that burned every retry. Here a null content
  is an Answer with `text: null`, `finishReason: "length"`, `error: null` (Read Response
  example 2), and the usage of exactly that paid call is kept.
- **Cost by hand.** Before `usage: {include: true}` a run's cost was copied from the
  dashboard. The six V2 runs so far: 958 065 tokens in, 219 070 out, $0.5392 total, every
  request with `cost` in its usage row — the field this phase must keep.
- **Hung provider.** SDK defaults (600 s × 3 tries) held one turn for ~30 minutes; the
  timeout and the retry count are fields of the config (`TIMEOUT_MS`, `MAX_RETRIES`).
- **Silent config.** A typo in `.env` of an unattended run sent a deck down a route nobody
  chose; here every invalid variable is a fault, and a processor with a fault yields no
  config (Read Registry examples 3 and 4).

PLAN: 8 cards per phase at ≈ $0.1–0.2. This cut: 8 cards (4 code, 4 judge), 18 record
examples (4 + 2 + 4 + 3 + 5).

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **An environment** — `Record<string, string | undefined>` (the type of `process.env`).
  Read Registry takes it as its one parameter; its default is `process.env`, the only
  environment read of the Component. Every example passes a literal object; the literals
  are in the record (Component processor, Function Read Registry, examples 1–4), no file.
- **A Request** — `Request` of `src/compiler/types.ts` (P2, accepted): `{customId, model:
  string | null, maxTokens: number | null, reasoning: Reasoning | null, messages: {role,
  content}[]}`, `Reasoning` of `src/cards/types.ts` = `{maxTokens: number} | {effort: "low"
  | "medium" | "high"}`. Every example builds it inline; no fixture.
- **A Processor Config** (§2.2) — the examples use one file:
  - `tests/fixtures/processor/glmConfig.json` — ONE JSON object, a `ProcessorConfig`
    (12 keys, in the interface order): id `glm53`, type `openrouter`, model `z-ai/glm-5.3`,
    apiKey `sk-or-test` (not a key), baseUrl `https://openrouter.ai/api/v1`, route `sync`,
    concurrency 4, providerOrder `["Novita", "Together"]`, reasoning `{maxTokens: 2500}`,
    timeoutMs 600000, maxRetries 2, answersDir null. It is exactly the one config Read
    Registry example 1 returns, and the config of Assemble Request example 1 and of Send
    Generation examples 1–5 (example 5 overrides concurrency 2, Assemble Request example 2
    overrides baseUrl and providerOrder). Read with `fixtureJson(...) as ProcessorConfig`.
- **A provider reply** — Read Response takes `(customId, status: number, text: string)`:
  the HTTP status and the body as TEXT (never parsed by the caller). Three files under
  `tests/fixtures/processor/`, each the `text` argument of one example, passed as
  `fixture(name)` (a string):
  - `okResponse.json` — an OpenRouter chat completion in the shape of the recorded glm
    answers, cleaned: values from the usage row `output-directive.v1` of run
    `20261006-132127-82ee751b` (11030 in, 571 out, cost 0.00538632, provider Novita), the
    generation id replaced by `gen-0000000001-TESTtestTESTtestTEST`, the content replaced
    by "```ts\nexport const a = 1;\n```" (29 chars, no final newline). Read Response
    example 1 (status 200) → one Answer with that text, finishReason `stop`; Send
    Generation examples 1, 4, 5 answer with it.
  - `lengthResponse.json` — the same shape, `content: null`, `finish_reason: "length"`,
    usage 15550 / 12000 / cost 0.0172: Read Response example 2 (status 200) → text null,
    finishReason `length`, error null.
  - `errorResponse.json` — `{"error": {"code": 402, "message": "Insufficient credits. Add
    more using https://openrouter.ai/settings/credits", "metadata": {...}}}`: Read Response
    example 3 with status **402** → error `http 402: <that message>`; Send Generation
    example 3 (status 402). No `usage`, no `id`: usage 0 / 0 / null / null / null.
  - Read Response example 4 has no file: status 200, text `<html>bad gateway</html>`.
- **A transport** (§2.2 `Transport`) — `{fetch, sleep}`. Tests build it from `fakeFetch` of
  `tests/helpers.ts` (P0): `const ff = fakeFetch({[url]: {status, text}})`, `fetch:
  ff.fetch` (assignable to `Transport["fetch"]`; it records `ff.calls`: url, method,
  headers, body as the JSON string), `ff.failAll(new Error("socket hang up"))` makes every
  call throw. `sleep` is `async (ms) => { sleeps.push(ms); }` — it records and resolves at
  once; no real timer. Send Generation example 4 wraps `ff.fetch` in an async function
  whose first call returns `{status: 503, text: async () => "upstream down"}`; example 5
  wraps it to count calls in flight (`live += 1; peak = max; await flush(); live -= 1`).
- **An answers directory** (Stub Answer) — a `tmpRoot()` holding `<name>.md` files written
  with `r.write`; `answersDir = r.root`. Example 1: `a.v1.md`; example 2: only `a.md`;
  example 3: empty. No fixture.

### 2.2. OUTPUT data shapes

`src/processor/types.ts` exports exactly these names (types only, no values):

```ts
import type { Effort, Fault, Reasoning } from "../cards/types.js";
import type { Message } from "../compiler/types.js";
export type ProcessorType = "openrouter" | "stub";
export type Route = "sync" | "batch";
export interface ProcessorConfig {
  id: string; type: ProcessorType; model: string; apiKey: string | null; baseUrl: string;
  route: Route; concurrency: number; providerOrder: string[] | null; reasoning: Reasoning | null;
  timeoutMs: number; maxRetries: number; answersDir: string | null;
}
export interface Registry { configs: ProcessorConfig[]; faults: Fault[] }
export type ProviderReasoning = { max_tokens: number } | { effort: Effort };
export interface ProviderBody {
  model: string; messages: Message[]; max_tokens?: number; reasoning?: ProviderReasoning;
  provider?: { order: string[]; allow_fallbacks: false }; usage: { include: true };
}
export interface ProviderRequest { url: string; headers: Record<string, string>; body: ProviderBody }
export interface Answer { customId: string; text: string | null; finishReason: string | null; error: string | null }
export interface Usage {
  customId: string; inputTokens: number; outputTokens: number;
  cost: number | null; provider: string | null; generationId: string | null;
}
export interface Reply { answer: Answer; usage: Usage }
export interface HttpReply { status: number; text(): Promise<string> }
export interface Transport {
  fetch(url: string, init: { method: string; headers: Record<string, string>; body: string }): Promise<HttpReply>;
  sleep(ms: number): Promise<void>;
}
export interface GenerationResult { answers: Answer[]; usage: Usage[] }
```

Every object is built with its keys in the interface order. A `Usage` "zero" is
`{customId, inputTokens: 0, outputTokens: 0, cost: null, provider: null, generationId: null}`.

**`readRegistry(env: Record<string, string | undefined> = process.env): Registry`** and
the constants **`PREFIX = "MORPH_PROCESSOR_"`**, **`KEYS`** (the 12 keys below, in this
order, `as const`), **`DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"`**
(`src/processor/registry.ts`).

1. Only variables whose name starts with `PREFIX` are read; the rest is ignored. The rest
   of the name must match `^([A-Za-z0-9-]+)_(.+)$` (the id has no underscore, so the FIRST
   `_` splits): no match → fault `<name> does not name MORPH_PROCESSOR_<id>_<KEY> with an id
   of [A-Za-z0-9-]`. Every matched id is known from then on (even when its key is bad).
2. The key must be one of `TYPE, MODEL, API_KEY, BASE_URL, ROUTE, CONCURRENCY,
   PROVIDER_ORDER, REASONING_MAX_TOKENS, REASONING_EFFORT, TIMEOUT_MS, MAX_RETRIES,
   ANSWERS_DIR` (exact case), else fault `<name> is not a known key` and the id yields no
   config. Values are `trim()`med; an empty value (after trim, or `undefined`) is absent.
3. Per id, with `N(K) = "MORPH_PROCESSOR_<id>_<K>"`, every fault `{key: N(K), message:
   N(K) + " " + rest}`:
   | condition | rest of the message |
   |---|---|
   | TYPE absent | `is required` |
   | TYPE not openrouter/stub | `must be one of openrouter, stub (got '<v>')` |
   | openrouter without API_KEY / MODEL | `is required` (one fault each) |
   | openrouter with ANSWERS_DIR | `is only for TYPE stub` |
   | stub without ANSWERS_DIR | `is required` |
   | ROUTE not sync/batch | `must be one of sync, batch (got '<v>')` |
   | CONCURRENCY, TIMEOUT_MS, REASONING_MAX_TOKENS not `^[0-9]+$` or < 1 | `must be a positive integer (got '<v>')` |
   | MAX_RETRIES not `^[0-9]+$` | `must be a non-negative integer (got '<v>')` |
   | both REASONING_MAX_TOKENS and REASONING_EFFORT | on key REASONING_EFFORT: `conflicts with N(REASONING_MAX_TOKENS): set one` (neither is then checked further) |
   | REASONING_EFFORT not low/medium/high | `must be one of low, medium, high (got '<v>')` |
   The type rows (openrouter/stub) apply only when TYPE is valid; the other rows always.
4. Defaults: model `"stub"` for a stub without MODEL (a stub may set MODEL); apiKey null;
   baseUrl `DEFAULT_BASE_URL` (as given otherwise, slashes and all); route `sync`;
   concurrency 1; timeoutMs 600000; maxRetries 2; answersDir null; providerOrder = the
   value split on `,`, each part trimmed, empty parts dropped, `null` when nothing is left
   or absent; reasoning `{maxTokens: n}` or `{effort: e}` or null.
5. An id with no fault gives one config; an id with any fault gives none. `configs` sorted by
   id, `faults` by key, both by plain code-unit comparison (`a < b`, never `localeCompare`):
   so `MORPH_PROCESSOR_x_TYPE` precedes `MORPH_PROCESSOR_x_y_TYPE`, and id `B` precedes id `a`. At
   most one fault per variable.
6. Consequences a test must respect (rules 1–3 applied, nothing new): the key is the WHOLE
   rest after the first `_`, so `MORPH_PROCESSOR_a_PROVIDER_ORDER`, `_a_API_KEY`, `_a_BASE_URL`,
   `_a_REASONING_MAX_TOKENS` are known keys of id `a` and give no fault by their name; only
   `MORPH_PROCESSOR_x_y_TYPE` (id `x`, key `y_TYPE`) is unknown. No valid config sets all 12
   keys: on `openrouter` `ANSWERS_DIR` is a fault, and the two `REASONING_*` keys together are
   a fault. The fullest valid openrouter id sets the other 10 keys with one of the two
   `REASONING_*` (11 variables at most); the fullest valid stub id sets `ANSWERS_DIR` and no
   `API_KEY` requirement applies. A test that sets "every key" and expects `faults: []` is
   wrong. `Fault` is the type of `src/cards/types.ts` (`{key, message}`); a test imports it
   from `../../src/cards/types.js` — `src/processor/types.ts` imports it but does not export it.

**`assembleRequest(request: Request, config: ProcessorConfig): ProviderRequest`**
(`src/processor/assemble.ts`; pure, no imports but types).

- `url` = `config.baseUrl` with every trailing `/` removed, + `"/chat/completions"`.
- `headers` = `{Authorization: "Bearer " + apiKey, "Content-Type": "application/json"}`, the
  Authorization key absent when apiKey is null.
- `body` keys in this order, each present only as stated: `model` = `request.model ??
  config.model`; `messages` = a new array of new `{role, content}` objects; `max_tokens` =
  `request.maxTokens` when not null (0 included); `reasoning` = `request.reasoning ??
  config.reasoning` converted (`{maxTokens: n}` → `{max_tokens: n}`, `{effort: e}` →
  `{effort: e}`), absent when null; `provider` = `{order: [...providerOrder],
  allow_fallbacks: false}` (a copy) when providerOrder is not null; `usage` = `{include:
  true}` always. Nothing else: no `tool_choice`, `tools`, `stream`, `temperature`.

**`readResponse(customId: string, status: number, text: string): Reply`**
(`src/processor/response.ts`; pure, never throws).

1. `JSON.parse(text)` inside try; `j` = the result when it is a plain object (not an array,
   not null), else `{}`. Usage from `j` on ANY status: `generationId` = `j.id` if a string,
   `provider` = `j.provider` if a string, `inputTokens` = `j.usage.prompt_tokens` and
   `outputTokens` = `j.usage.completion_tokens` if numbers else 0, `cost` = `j.usage.cost`
   if a number else null. `msg` = `j.error.message` when `j.error` is an object with a
   string `message`, else null.
2. In this order, the first that holds decides the answer (`text: null, finishReason:
   null` on every error):
   | condition | error |
   |---|---|
   | status < 200 or > 299 | `http <status>: ` + (msg ?? `text.slice(0, 200)`) |
   | parse failed or not a plain object | `unreadable response: ` + `text.slice(0, 200)` |
   | `j.error` present and not null | `provider error: ` + (msg ?? `JSON.stringify(j.error).slice(0, 200)`) |
   | `j.choices` not a non-empty array, or `choices[0]` not an object | `provider error: no choices` |
   | otherwise | none: `text` = `choices[0].message.content` if a string else null; `finishReason` = `choices[0].finish_reason` if a string else null; `error` null |

**`stubAnswer(request: Request, config: ProcessorConfig): Reply`** (`src/processor/stub.ts`;
`node:fs`, `node:path`). `dir = config.answersDir ?? ""`. Candidates, in order:
`path.join(dir, customId + ".md")`, then `path.join(dir, customId.replace(/\.v[0-9]+$/, "")
+ ".md")` (only a FINAL `.v<n>` is stripped: `d.r1.v2` → `d.r1.md`). The first that is a
regular file → `{customId, text: <file as UTF-8, unchanged>, finishReason: "stop", error:
null}`; none → `{customId, text: null, finishReason: null, error: "stub has no answer: " +
path.join(dir, customId + ".md")}`. Usage in both cases `{customId, inputTokens: 0,
outputTokens: 0, cost: 0, provider: "stub", generationId: "stub-" + customId}`.

**`sendGeneration(config: ProcessorConfig, requests: Request[], transport: Transport):
Promise<GenerationResult>`**, **`realTransport(timeoutMs: number): Transport`** and
**`BACKOFF_MS = 1000`** (`src/processor/send.ts`). Never rejects; `answers[i]` and
`usage[i]` belong to `requests[i]`; `[]` gives `{answers: [], usage: []}`.

1. `config.route === "batch"` (checked first, any type) → every request: error `route batch
   is not available on the sync sender`, usage zero; no call.
2. `config.type === "stub"` → `stubAnswer(request, config)` per request; no call, no sleep.
3. `openrouter`: `min(concurrency, requests.length)` workers, each taking the next unsent
   index until none is left (so at most `concurrency` calls in flight, results stored by
   index). Per request: `p = assembleRequest(request, config)`; attempts `k = 0 ..
   maxRetries`: before attempt `k > 0`, `await transport.sleep(BACKOFF_MS * 2 ** (k - 1))`
   (1000, 2000, 4000, …); `reply = await transport.fetch(p.url, {method: "POST", headers:
   p.headers, body: JSON.stringify(p.body)})`, `text = await reply.text()`, `r =
   readResponse(customId, reply.status, text)`:
   - status 408, 429 or ≥ 500 → retryable: keep `r`, next attempt;
   - any other status (2xx, and every other 4xx: a refusal) → `r` is final at once.
   - `fetch` or `text()` throws → retryable; `r` = error `transport: <error.message>`
     (`String(e)` for a non-Error), usage zero.
4. When every attempt was used and the last is retryable, that last `r` is final and, when
   `maxRetries > 0`, its error gets ` (after <maxRetries + 1> attempts)` appended. So
   maxRetries 2 and a hung socket → 3 calls, sleeps `[1000, 2000]`, `transport: socket hang
   up (after 3 attempts)`; maxRetries 0 → 1 call, no sleep, no suffix.
5. `realTransport(timeoutMs)` = `{fetch: (url, init) => fetch(url, {...init, signal:
   AbortSignal.timeout(timeoutMs)}), sleep: (ms) => setTimeout(ms)` from
   `node:timers/promises` (awaited, resolving to void)`}`. It is the only reference to the
   global `fetch` in the tree; no test calls its `fetch`.

### 2.3. Names

| module | exports | card writes no test | judge's test |
|---|---|---|---|
| `src/processor/types.ts` | the types of §2.2, no values | — | — |
| `src/processor/registry.ts` | `readRegistry`, `PREFIX`, `KEYS`, `DEFAULT_BASE_URL` | probe | `tests/processor/registry.examples.test.ts` |
| `src/processor/assemble.ts` | `assembleRequest` | probe | `tests/processor/assemble.examples.test.ts` |
| `src/processor/response.ts` | `readResponse` | probe | `tests/processor/response.examples.test.ts` (Read Response, then Stub Answer) |
| `src/processor/stub.ts` | `stubAnswer` | probe | (the same file) |
| `src/processor/send.ts` | `sendGeneration`, `realTransport`, `BACKOFF_MS` | probe | `tests/processor/send.examples.test.ts` |

A code card covered by a probe writes **no test file**. The judge's file holds one
`test(...)` per example of its Function(s), in record order, named `<Function> example <n>:
<what>`, then at most twelve tests of its own on §2.2. Answers, usage and configs may be
compared whole with `toStrictEqual` (small objects; key order does not matter to it);
strings and numbers with `toBe`; a request body as `JSON.stringify(body)` with `toBe` (the
key order of §2.2 is part of the contract). Every Send Generation test uses `fakeFetch` and
a recording `sleep` as in §2.1; never `vi.mock`, `vi.stubGlobal`, `vi.useFakeTimers`, a
real timer, or a function or variable named `fetch` or `Fake*` (the guard rejects them;
`fetch:` as a property of the transport object is fine). The global `fetch` stays blocked.

### 2.4. What must not break

- P0–P3 untouched byte for byte: the scaffold, `src/cards/*`, `src/compiler/*`,
  `src/acceptance/*` and their tests.
- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/` — untouched by
  every card.
- `tsc --noEmit`, `eslint src tests`, `vitest run` green on the whole tree after every
  generation; the 160 tests of P0–P3 stay green.

## 3. Acceptance

Built by `decks/tools/build.py p4` into the `acceptance` of every P4 card in
`morph-map.json`; `mrph plan --spec` copies it onto the card. Narrow to broad, every step
printing a readable line on failure; the first red is the regeneration's diagnosis.

Code cards (targets under `src/processor/` only; `read-registry` also writes `types.ts`):

1. `probe/<card>/`: the guard, a vitest config, `tsconfig.card.json` extending
   `../../tsconfig.json` and **excluding the targets of the other cards of the same
   generation**; removed on exit.
2. `node_modules/.bin/tsc --noEmit -p probe/<card>/tsconfig.card.json` (project + probe).
3. `node_modules/.bin/eslint <the card's targets>`.
4. `guard.mjs src <the card's targets>`: layer `processor` imports `cards`, `wait`,
   `compiler` only (types); `fetch` and `process` allowed in this layer, `process.env` only
   in `src/processor/registry.ts` (`NO_ENV` with one reader); `node:child_process` rejected;
   no `any`, no `console`, no `process.exit`, no package imports.
5. `decks/p4/parts/<card>.probe.ts` under vitest: one `test` per record example of the
   card's Function(s), values **and** types, then one or two tests pinning every row of the
   §2.2 tables (every fault message, every error row, every retry status, the stub and batch
   routes, the constants). Nulls are checked as `=== null` or inside `toStrictEqual`, never
   through `??` (the P3 lesson).
6. `vitest run` — everything in the tree.
7. Frozen: `git diff --quiet HEAD -- contour.yaml morph-map.json docs decks tests/fixtures`;
   untracked files other than the targets: none.

Judge cards (`tests/processor/<m>.examples.test.ts`):

1. `probe/<card>/` as above (no probe file); 2. the same `tsc`; 3. `eslint <target>`;
4. `guard.mjs tests <target> <min> <max> lits.json` — `min` = the examples of the
   Function(s) (Read Registry 4, Assemble Request 2, Read Response + Stub Answer 4 + 3 = 7,
   Send Generation 5), `max` = `min + 12`; `lits.json`: registry `glmConfig.json`,
   `must be a positive integer`, `MORPH_PROCESSOR_e_FOO is not a known key`,
   `MORPH_PROCESSOR_x_TYPE is required`, `/tmp/answers`; assemble `Bearer sk-or-test`,
   `http://127.0.0.1:9/v1/`, `allow_fallbacks`, `tool_choice`; response `okResponse.json`,
   `lengthResponse.json`, `errorResponse.json`, `gen-0000000001-TESTtestTESTtestTEST`,
   `unreadable response: <html>bad gateway</html>`, `stub-a.v1`, `stub has no answer: `;
   send `fakeFetch`, `failAll`, `socket hang up (after 3 attempts)`, `upstream down`,
   `Insufficient credits`;
5. `vitest run <target>`; 6. `vitest run`; 7. frozen and untracked as above.

Dense output: `--reporter=dot`, failures filtered to `^ FAIL |Error|expected|received`,
80 lines. Timeout of the whole chain 300 s (Morph's own limit); measured on a dry tree with
stubs (§9).

## 4. Constraints

- NodeNext: every relative import carries `.js`; types with `import type`. No `any`. The
  Node typings carry no DOM globals (`fetch`, `AbortSignal` and `Response` are Node's).
- **Layer change** (`decks/tools/guard.mjs`): `LAYERS.processor` = `cards`, `wait`,
  `compiler` — Assemble Request reads a `Request` (the record's step `reads: Request`) and
  the template forbids a second serialisation of a shape that exists in the tree; the import
  is `import type` only.
- **`process.env` only in `src/processor/registry.ts`** (guard `NO_ENV` now names
  `processor`, with `ENV_READERS` = that one file): the Requirement Deterministic Core of the
  record says it (P4 sentence). Everything else gets the config as a parameter.
- **The transport is a parameter.** `sendGeneration` calls only `transport.fetch` and
  `transport.sleep`; the global `fetch` appears only in `realTransport`; no `setTimeout`
  outside `realTransport`; no `Date`, no `Math.random`, no `console`, no child process.
- `assemble.ts` and `response.ts` import types only; `stub.ts` imports `node:fs` and
  `node:path`; `send.ts` imports `./assemble.js`, `./response.js`, `./stub.js`,
  `node:timers/promises`.
- Every test writes only under a `tmpRoot()` and removes it; fixtures are read, never
  written.
- A judge writes only its test file and never touches the module it tests.
- A file a card writes is in no sibling's slice in the same generation; a judge depends on
  its code card.
- Exact strings of §2.2 (every fault message, `http `, `unreadable response: `, `provider
  error: `, `provider error: no choices`, `transport: `, ` (after <n> attempts)`, `route
  batch is not available on the sync sender`, `stub has no answer: `, `stub-`): the executor
  copies them, it does not rephrase.

## 7. Out of scope

- The batch route: `/api/beta/batches`, submit, poll, collect, the half price (P11
  `processor (batch)`); here a batch config only answers with the route error.
- Other provider types (`openai`, `anthropic`, `llama_cpp`, `ollama`) and their legacy
  variables (`OPENAI_*`, `MRPH_PROCESSOR_*`); a `MORPH_PROCESSORS` order list.
- Streaming, tools and `tool_choice`, `temperature`, the scout's tool turns (P13).
- A `Retry-After` header, jitter, a run-wide retry budget, a per-request deadline other than
  the transport's timeout (P5 `runloop` owns the run's deadline).
- Choosing the processor for a run, writing usage into the run report, summing cost (P5);
  printing the registry's faults (P7 `cli`).
- Validating that a stub's answer parses; token estimation for the stub (its usage is 0).

## 8. How to run

```
python3 decks/tools/build.py p4                       # injects acceptances into morph-map.json
cd /home/morph/MorphProject/morph-lab
venv/bin/mrph plan --root <repo> --spec <repo>/contour.yaml --map <repo>/morph-map.json --component processor --judge          # dry
venv/bin/mrph deck clear --root <repo> && venv/bin/mrph deck reset --root <repo>
venv/bin/mrph plan --root <repo> --spec <repo>/contour.yaml --map <repo>/morph-map.json --component processor --judge --add
venv/bin/mrph deck check --root <repo>
venv/bin/mrph run --root <repo> --processor glm53 --deadline 2400   # by the gate of docs/AUTONOMY.md
```

`mrph` reads `.env` from the current directory: run it from `morph-lab`, never from the repo.

## 9. Pre-registration

| quantity | prediction |
|---|---|
| cards in the deck | 8 (4 code, 4 judge) |
| generations | 4 (read-registry; assemble-request + read-response + read-registry-judge; send-generation + assemble-request-judge + read-response-judge; send-generation-judge) |
| executor bill | ≈ $0.14 nominal (≈ 228k tokens in, 57k out at the glm53 rates fitted on the six V2 runs, $0.31/M in, $1.13/M out; 1.5 attempts per card), ≤ $0.30 with a re-cut (P3: $0.2254) |
| cards with regeneration | 2 of 8 |
| `write-write` / `read-write` at `deck check` | 0 / 0 |
| tests after the run | 160 + 4 judge files; ≥ 18 judge example tests |
| chain on a dry tree with stubs | measured before the gate in a scratch worktree: code cards 5.6–6.6 s, red at the probe on every example (18 of 18, each a readable `Error: stub <fn> …` line); judges 4.3–5.0 s, red at the guard (count and literals); with a reference implementation of §2.2 every code chain is green end to end in 13.7–14.3 s, and 18 of 18 single-rule mutations of it (sort by `localeCompare`, id split, sleep before the first attempt, suffix on maxRetries 0, 408 not retried, null content as `""`, 2xx as `=== 200`, …) redden the probe |
| first red | read-registry: fault order (`localeCompare` instead of code units) or the id split on the last `_`; send-generation: the sleep before the first attempt, or the suffix on a maxRetries 0 failure; read-response: a null content turned into `""` or an error |

**Falsifiable claims:** (1) no card goes red on a sibling's file; (2) no judge red traces to
§2.1; (3) no test of this phase opens a socket (the setup's block never fires in a green
log: grep `network blocked in tests` in the acceptance logs is empty).

## 10. What to record

Attempts and first red per variant, minutes per generation, $ (provider), judge tests
written, defects the judge found that the probe did not (and the reverse), the row of
`docs/MEASURE.md`.

## 11. Actual

