# TASK_P31c — issue #42 ledger item 9: a Function-level Guardrail binds its card's code files, not its directory (`src/rules/guardrails.ts`)

Previous parts: `decks/p31a/TASK.md`, `decks/p31b/TASK.md` (merged; main 120a849). Record: Component
**rules** (description; Guardrail Rules behaviour and examples 3, 5; Card Rules behaviour and examples 1, 2; Rules Arg
example 8; Plan Rules wording). The phase's first data commit compacted rules 29 112 B → 27 327 B (Layer Edges examples
2–5 to `tests/fixtures/rules/examples.json` by key); after this phase's record edit 29 509 B. Cut with `--only` (rules
holds other Functions): the deck is a transaction.

## 1. Why this

- #42 Must hold 1 says a Guardrail attached to a Function binds "its code targets", but Guardrail Rules keyed every rule
  by DIRECTORY (`rules[dir][id]`), and Card Rules gave a card the whole entry of its directory. Found by the CONTOUR.md
  writer 11.10 on a scratch TS record: `No Clock` on one Function of `src/report` also reached its sibling Function's
  file. Silent widening is not allowed.
- Operator's decision (11.10), the scope rule, exact:
  - System-level Guardrail → every code file of every Component;
  - Component-level → every code file of that Component's directories;
  - Function-level (and Interface-level, via the Interface's card) → only the code target files of that Function's
    (Interface's) card;
  - the rules of a file = the union of the three that reach it (the most specific place's text wins for one id).
- Measured 11.10 (the template guards of main on `tests/fixtures/rules/scope/cases.json`, 2 languages × 4 records × 3
  files = 24 runs, every one as its "then"): with the argument this phase gives, `No Clock` on Stamp Line reds only
  `report/stamp.go:7` (Go) / `src/report/stamp.ts:3` (TS); its sibling `plain` and `units` are green.

**Design (recorded).** Per-directory rules plus per-file additions, folded per card:
- Guardrail Rules keeps its result type `Record<string, Record<string, string>>`; its keys are now a directory (the
  System and Component rules of that directory, every code directory a key as before) or a code FILE (the Function and
  Interface rules of the card owning that file; a file is a key only when such a rule falls on it).
- Card Rules folds, for each directory d of the card's code targets, the entries of the card's own files in d (first)
  and of d (then) into one entry keyed d. The guard argument therefore keeps contract 3's shape
  `{"<dir>": {"<rule id>": "<text>"}}`: a contract-3 guard reads `rules[dirname(file)]` and is given only the card's own
  code files, so that entry IS the rule set of each of those files. **Contract stays 3**; the template guards are
  unchanged (no byte of `templates/` changes) — no copy refusal is needed because no copy can misread the argument.
- Layers (P30) stay per directory: a package imports as a whole. Layer Edges and the layers argument do not change.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- **Existing, on main**: `src/rules/guardrails.ts` (P31a; its current text is the card's patch base): `Unit {dirs,
  names}`, `codeDirs`, `guardrailRules`, `cardRules`, `rulesArg`, `guardContract`, `planRules`; `src/language/paths.ts`
  — `codeTargets(profile, targets)`; `src/contour/types.ts` — `ContourMap.cards: {id, targets: string[] | null}[]`.
- **Fixtures** (committed in the data commit):

| file | type | what it gives |
|---|---|---|
| `tests/fixtures/rules/scope/cases.json` | `{"go"\|"typescript": {map: string (map JSON text), tree: Record<path, text>, files: Record<code file, card id>, records: {function, interface, component, system: record text}, then: Record<record key, Record<code file, {status: number, stdout: string}>>}}` | Guardrail Rules 5, Rules Arg 8 |
| `tests/fixtures/rules/examples.json` "Guardrail Rules 3" (changed then), "Guardrail Rules 5", "Card Rules 2", "Rules Arg 8" | given/then texts | §2.2 |
| `tests/fixtures/rules/guarded.yaml` (unchanged) | record text | Guardrail Rules 3, Card Rules 1 with `EMPTY_MAP`: default targets `src/orders/placeOrder.ts`, `src/orders/cancelOrder.ts`, `src/orders/ordersApi.ts` |

  The scope record: System `scope`; Component `report` (Functions Stamp Line → card `stamp-line`, Plain Line →
  `plain-line`; both code files in one directory), Component `units` (Unit Name → `unit-name`). Records: `function` =
  No Clock on Stamp Line; `interface` = No Clock on the Interface `stamp hook` exposing Stamp Line alone; `component` =
  on report; `system` = on the System. Every code file reads the clock (Go `time.Now` line 7, TS `Date` line 3).
- **Harness (verbatim; the judge builds from it)**, as `tests/rules/guardrails.p31b.examples.test.ts`:
  `const ROOT = path.resolve(fixturePath("."), "..", "..");`
  `const GUARD = (lang: string): string => path.join(ROOT, "templates", lang, "decks", "tools", "guard.mjs");`
  `const ENV = { ...process.env, GOFLAGS: "-mod=mod", GOPROXY: "off", GOTOOLCHAIN: "local", GOWORK: "off" };`
  Rules Arg 8 per language L and record key K: `R = loadContour(S[L].records[K], "contour.yaml")`, `M = loadMap(S[L].map,
  "morph-map.json")` (`if (!R.ok || !M.ok) throw …`), `P = planRules(R.record, M.map, false, "// morph-guard-contract: 3\n",
  L)` (`if (!P.ok || P.layers === null || P.rules === null) throw …`); per `[file, card]` of `Object.entries(S[L].files)`:
  `targets = M.map.cards.find((c) => c.id === card)?.targets ?? []`, `rules = cardRules(L === "go" ? GO : TYPESCRIPT,
  targets, P.rules)`, a fresh `tmpRoot()` with the tree written (TypeScript: `fs.symlinkSync(path.join(ROOT,
  "node_modules"), r.path("node_modules"))`), `spawnSync("node", [GUARD(L), "src", file, "", JSON.stringify(P.layers),
  JSON.stringify(rules)], { cwd: r.root, encoding: "utf8", env: ENV })` → `{status, stdout}` toStrictEqual
  `S[L].then[K][file]`; `r.rm()` in finally. Timeout 240000 ms (24 guard runs, Go via `go run`).

### 2.2. OUTPUT data shapes

**`src/rules/guardrails.ts`** (PATCH). Exports, signatures and result types unchanged. Only two bodies change:

- `guardrailRules`: a unit also keeps its code FILES (`codeTargets(profile, targets)`, in order, distinct). For a
  name whose place is a Function or an Interface, the text goes to the key of each code file of the unit (created as
  `{}` when its first rule falls on it); for a Component or System place, to the key of each dir of the unit (as
  today). "Unless the key already has id" — the first place wins — holds per key. Every dir stays a key (`{}` when no
  rule); a file is a key only when a rule falls on it. Sorting as today over all keys (a dir sorts before its files:
  `"src/orders" < "src/orders/cancelOrder.ts"`). Errors and proseOnly unchanged.
- `cardRules`: per dir d of the card's code targets (first seen first), a NEW object: first, for each code target t of
  the card in d (target order), each id of `rules[t]` (own key) not yet set; then each id of `rules[d]` (own key) not yet
  set; its keys sorted ascending (`Object.keys(o).sort()`). No code target → `{}`.

`planRules`: no code change (its "has a rule" test already walks every key; the record now says "a directory or a
file"). `rulesArg`, `guardContract` unchanged.

**Examples (the expected values).**

| example | given / then |
|---|---|
| Guardrail Rules 3 (changed), 5 (new); Card Rules 2 (new); Rules Arg 8 (new) | `tests/fixtures/rules/examples.json` |
| Card Rules 1 (changed: its second call) | the record (rules, Card Rules) |

Guardrail Rules 3's new rules, verbatim: `catalog` as today; `"src/orders": {"no-clock": "Guardrail 'no  CLOCK' of
Component orders", "no-network": "Guardrail 'No Network' of System guarded"}`; `"src/orders/cancelOrder.ts":
{"no-process": "Guardrail 'No Process' of Interface cancel hook", "pure": "Guardrail 'Pure' of Function Cancel
Order"}`; `"src/orders/ordersApi.ts": {"no-env": "Guardrail 'No Env' of Interface orders API"}`;
`"src/orders/placeOrder.ts": {"no-shell": "Guardrail 'No Shell' of Function Place Order"}`; proseOnly unchanged.

### 2.3. Names and the tests each judge writes

| module | change | code card | judge's files |
|---|---|---|---|
| `src/rules/guardrails.ts` | PATCH | `guardrail-rules` | PATCH `tests/rules/guardrails.examples.test.ts` (Guardrail Rules example 3 and Card Rules example 1 only; 14 tests kept) and NEW `tests/rules/guardrails.p31c.examples.test.ts` (Guardrail Rules 5, Card Rules 2, Rules Arg 8: 3 tests) |

One test per example. Test names: `"<Function> example <N>: <what>"`.

### 2.4. What must not break

- Byte for byte: every file but the code target and the 2 judge files; `templates/` untouched.
- A record with only System and Component Guardrails gives the same rules and the same card arguments as main (every
  existing fixture but `guarded.yaml`: parity, issue46, p9a, single, goMiniGuarded): Guardrail Rules 1, 2, 4, Rules Arg
  1–7, Plan Rules 1–5, Plan Command 19–20, Build Acceptances 12 unchanged.
- MorphV2's own guard has no contract line: Plan Rules returns rules null, so every MorphV2 deck and the identity corpus
  (`tests/gate/identity.examples.test.ts`) stay byte for byte.
- The suite of main green, plus the new judge file.

## 3. Acceptance

Built by `morph plan --checks decks/p31c/checks.json --only guardrail-rules,guardrail-rules-judge`. `ownGit: true`,
`frozen` the defaults + `templates`, `fullExclude` the two judge files (`tests/rules/guardrails.examples.test.ts` goes
red with the new code until its judge patches it). Code card: tsc → eslint → guard → probe
`decks/p31c/parts/guardrail-rules.probe.ts` → full. Judge: lits = example names and literals.

## 4. Constraints

- NodeNext, `.js` imports, `import type`, no `any`. **rules** is pure (MorphV2's guard: no clock, no env, no process, no
  file read; node:path only); no new import in `src/rules/guardrails.ts`.
- Generations: guardrail-rules (0); guardrail-rules-judge (1). The judge writes only its files; tests write only under
  `tmpRoot()`; the guard tests spawn `node` and need `go` on PATH (1.22 with `GOTOOLCHAIN=local`; the fixture's go.mod
  says `go 1.22`).

## 7. Out of scope

- The guards' rule tables, their contract number and their text (contract 3 kept, §1 Design).
- Layers per file: layers stay per directory (a package imports as a whole).
- Aliases ("Standard Library Only"): still prose only.
- Test files: rules apply to code files only (v1).
- A code file owned by no card (no map target, no Name Targets default): no Function rule can reach it; only System
  and Component rules of its directory, and only when some card's guard is given it (none is).
- MorphV2's own hand guard and record Guardrails per Component: P33.

## 9. Pre-registration

2 cards, 2 generations, transaction. First red expected: the judge (a patch of a 608-line file plus a new file of 3
tests). Bill: ≈ $0.05–0.15 on ds ×3.
