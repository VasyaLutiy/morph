# Decisions on gaps in the record

One line per decision the orchestrator made where `contour.yaml` did not pin a shape, an
order or a message. The full text of each lives in §2.2 of the phase's TASK; this file is
the index the operator reads in one pass. Format: `P<N> · <Function> · <decision> · <why>`.

## P1 cards (`docs/TASK_P1_cards.md` §2.2, decided 06.10 by the orchestrator, confirmed by the operator at the gate)

- P1 · Validate Card · `Fault = {key, message}`, one line starting with the key, faults in schema key order, unknown keys last · the record names faults but no Data Object.
- P1 · Validate Card · repo-relative = posix-normalised, `./` stripped, no leading `/` or `../` · "repo-relative" was undefined.
- P1 · Load Deck · `loadDeck(text)`; the caller reads the file; non-JSON / non-array are deck faults with key `deck`; element faults re-keyed `cards[i].<key>` · the Component is pure.
- P1 · Load Deck · one fault per deck for the first cycle met by DFS in deck order, `dependsOn cycle a -> b -> a` · multiplicity was open.
- P1 · Find Hazards · output order write-write, read-write, unordered-read, implicit-read; one read-write per (reader, slice entry, writer); unordered-read keeps `repair: null` · ordering and multiplicity were open.
- P1 · Weigh Slices · `weighSlices(deck, root, cap)` → `{weights: [{card, bytes, missing}], hazards}`; every card weighed, empty slice included · the old Morph skipped empty slices; a deliberate difference.
- P1 · Card · types in `src/cards/types.ts`, every union literal · `src/types.ts` of the draft map never existed.

## P2 compiler (`docs/TASK_P2_compiler.md` §2.2, decided 06.10, confirmed at the gate)

- P2 · Compile Card · patch messages = originals (targets in array order) → slice (sorted) → instruction + directive · the record says originals come "first".
- P2 · Compile Card · new target announced as `Target <p> is a new file: it does not exist yet.` · the record gives only the words "new file".
- P2 · Compile Card · result `{ok, requests, inputs: InputDigest}` · Compile Card calls Capture Inputs but Request has no digest field.
- P2 · Compile Card · faults reuse `Fault` of cards; `contextSlice '<p>' does not exist` / `… is not a file`; a missing target is never a fault; all faults at once, sorted · fault shape was open.
- P2 · Output Directive · several targets: the record's sentence verbatim plus "The targets, in this order: …" · "names both paths" needed a form.
- P2 · Parse Answer · truncated checked first; corrupt in the order duplicate → extra → missing → no fenced block; block body = inner lines + final `\n`; `---` dropped from the first line of every extracted content, any extension · the record lists the rules without an order.
- P2 · Parse Answer · CRLF → LF; `FILE:` path trimmed and stripped of backticks/quotes · the old Morph did this.
- P2 · Compile Card · fence tag = extension without the dot, none for no extension · unspecified.
- P2 · Compile Card · under patch a slice entry that is also a target is sent twice · no dedupe rule in the record.
- P2 · plan · `renderRetry` of the draft PLAN is not in the record and belongs to runloop · reconciliation.

## P3 acceptance (`docs/TASK_P3_acceptance.md` §2.2, proposed 06.10 by the orchestrator, pending the gate)

- P3 · Snapshot Targets · `snapshotTargets(root, targets)` → `{root, entries: [{path, bytes: Uint8Array | null}]}` in targets order; `restoreSnapshot(snapshot)` rewrites bytes (mkdir -p) or `rmSync(force)`; a directory target is absent · the record named no shape; added Data Object Target Snapshot.
- P3 · Run Acceptance · `runAcceptance(command, root, {env, timeoutMs?})`, `/bin/sh -c "exec 2>&1\n" + command`, env = given + NO_COLOR/CI, never `process.env` (guard `NO_ENV`) · "merged" needed an order; Deterministic Core forbids environment reads.
- P3 · Run Acceptance · detached spawn, `process.kill(-pid, "SIGKILL")` on timeout, resolve on `close`; timed-out log gets `acceptance timed out after <ms> ms`; spawn error → exit null, `acceptance could not start: <message>` · the PLAN's orphan risk; a timeout must be visible in the log (old Morph: "exit None" over a green log).
- P3 · Run Acceptance · `clipLog`: >4000 chars → head 1500 + `\n[... N chars clipped; diagnosis lines kept:]\n` + middle lines matching `/FAIL|Error|assert|expected/` (≤200 each, ≤800 total) + `[...]\n` + tail 1500 · the record gave the budget, not the arithmetic; simpler than the old whole-line clipper, pinned byte for byte.
- P3 · Verify Card · input `{root, targets, command, variants: [{variant, answer: ParsedAnswer}], env, timeoutMs?}`; stand-in logs `answer corrupt: <reason>` / `answer truncated`; diff only on a failed run, computed before the rollback; winner's diff null · the record said "stand-in" without text.
- P3 · Verify Card · layer `acceptance` may import `compiler` (types only) · Parsed Answer exists in the tree; no second serialisation.
- P3 · Build Attempt Diff · `buildAttemptDiff(before: Record<p, string|null>, after: Record<p, string>)`, LCS with deletions first, 3 lines of context, merge at ≤ 6 context lines, both hunk counts always printed, no "No newline" marker, clip to exactly 6000 with `[diff clipped: <total> chars]\n` · "unified diff" had several valid renderings.

## P4 processor (`docs/TASK_P4_processor.md` §2.2, decided by the orchestrator, autonomous gate, 06.10)

- P4 · record · the skeleton Component completed: behaviour + 18 examples; two Functions added (Read Response, Stub Answer) and the steps of Send Generation call them; Processor Config gains `baseUrl`, `answersDir`, type `stub`; Usage says "0 tokens and null cost when none reported"; Requirement Deterministic Core gains the P4 sentence · the three skeleton Functions had no behaviour or example; the PLAN's stub processor and the reply parse needed their own probed units.
- P4 · scope · the batch route (`/api/beta/batches`, submit/collect) stays for P11; no Function of this Component is batch; a `route: batch` config answers `route batch is not available on the sync sender` with no call · PLAN P11.
- P4 · Read Registry · `readRegistry(env = process.env)` → `{configs, faults: Fault[]}`; id `[A-Za-z0-9-]+` split on the first `_`; 12 keys; values trimmed, empty = absent; a processor with any fault yields no config; configs by id, faults by key, code-unit order; messages per the §2.2 table · the record named the env prefix and "listed, not dropped" only.
- P4 · Read Registry · defaults route `sync` (the old Morph defaulted openrouter to batch), concurrency 1, TIMEOUT_MS 600000 (ms, not the old seconds), MAX_RETRIES 2, BASE_URL `https://openrouter.ai/api/v1`, stub model `"stub"` · V2 runs sync first; the timeout is a field of the schema in ms.
- P4 · Assemble Request · `{url, headers, body}` with body keys model, messages, max_tokens?, reasoning?, provider?, usage; the request's model/reasoning win over the config's; Authorization absent when apiKey is null · the record listed the keys without an order or a precedence.
- P4 · Read Response · `readResponse(customId, status, text)`; usage read on any status (0/0/null when absent); errors `http <s>: …`, `unreadable response: …`, `provider error: …`, `provider error: no choices`, first 200 chars; a null content is `text: null` with `error: null` · "recorded, not retried" needed texts; the old Morph's paid-truncation incident (issue #8).
- P4 · Stub Answer · `<answersDir>/<customId>.md`, else the customId without its final `.v<n>`; usage 0/0, cost 0, provider `stub`, generationId `stub-<customId>`; missing → `stub has no answer: <path>` · the PLAN named a stub processor without a shape.
- P4 · Send Generation · transport `{fetch, sleep}` is a parameter; retry on a throw, 408, 429, 5xx; backoff `1000 * 2^k` before retry k+1; other statuses final; ` (after <n> attempts)` when retries were used up; results by request index; never rejects; `realTransport(timeoutMs)` the only global fetch · "retries with backoff" had no numbers; a test must control the network and the clock.
- P4 · guard · `LAYERS.processor` gains `compiler` (types: Request, Message); `NO_ENV` gains `processor` with `ENV_READERS = {src/processor/registry.ts}` · Deterministic Core: one environment reader.
- P4 · Read Registry · re-cut data (rule 6 of TASK_P4 §2.2): the key is the whole rest after the first `_`; no valid config sets all 12 keys (ANSWERS_DIR on openrouter, both REASONING_* are faults); `Fault` imported from `src/cards/types.ts` · read-registry-judge failed 3 attempts on its own expectations of these consequences.
