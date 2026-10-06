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
