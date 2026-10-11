# Plan: Epic 2 fixes, acceptance rules back into the Contour (interim, 11.10)

Status: **draft for the operator**. Not in `docs/PLAN.md` yet. Phase numbers are proposals (P23, P26 and P29 are
reserved by #14, #20 and #24).

Source: issue #40 (beta tester, MorphStudio P7c/P9a on b9f4158, GLM-5.3 orchestrator). Split out: #41 and #42 under
epic E2 #33, reopened 11.10.

## 1. The principle and the drift

Morph's founding rule (operator, 11.10): **everything lives in the Contour.** A phase that changes the structure edits
the record, and Morph's logic reads the record.

What V2 still reads from `contour.yaml`:
- the cut: cards, `dependsOn` from `calls`, slices, instructions (behavior, examples, Guardrails as prose), judges from
  examples;
- the declared dependencies (`System.dependencies` + `Component.uses`), which reach the guard as allowed modules.

What drifted out into hand data beside the record:

| Rule the acceptance enforces | Old mrph | V2 today | Back into the record by |
|---|---|---|---|
| Layers: who imports whom | — | `decks/tools/layers.json` `layers` | P30 (#41): step `uses: <Component>` + map targets |
| Pure package, entry file | — | `layers.json` `pure`, `entry` | P31a (#42): Guardrails on the Component |
| Guardrail → machine check | `mrph/cards/plan_spec_guards.py` (3 names) | prose only (`src/planner/render.ts:83`) | P31a (#42): per-language table in the template |
| Imports whitelist | — | `checks.json` `imports` extras (per package, blame on the card) | P31b (#42): stdlib + record deps, blame per file |
| Clean tree during the run | Guardrail "Frozen Tree During Run" (MorphV2 record) | checked only at each acceptance's last stage | P32: `morph run` refuses a dirty tree |
| MorphV2's own guard tables (`LAYERS`, `NO_CLOCK`, `NO_ENV`, `NET`, …, about 15) | — | `decks/tools/guard.mjs` + 13 DECISIONS lines | P33 (data phase, later) |

Facts measured 11.10:
- MorphStudio `f85a8e7`: the record's `uses` between Components, mapped to target directories, gives 34 edges, and all
  34 are allowed by `layers.json`. The only gap is the new directory `users`. The record can be the source with no
  change in behaviour.
- MorphV2 itself: the record under-declares `uses` against its guard (runloop has 3 `uses`, `LAYERS` has 9). MorphV2
  cannot switch until its record is completed (P33).
- Reproduced P9a run 1 for $0. The real acceptances on the P9a stubs stop at `== guard` for the 3 `users` code cards.
  `deck check` exits 0, because Check Builds compiles but does not run the guard.

## 2. Phases

Order: D1 → P32 → P30 → P31a → P31b, then P33 when the operator decides. Each phase is one fresh
`/morph-v2-orchestrator` session, processor `ds` (maxTokens ×3), cap **$5 per phase**, paid run only on the
operator's word.

A phase is done when:
- the run branch is green;
- the MorphStudio replay named in its row passes (a phase is not done on our fixtures alone);
- #40 has a comment for the tester: the binary commit and what to change in their repo.

### D1: docs, by hand, $0 (E7) — done 11.10
#40 items 4, 5 and 7, plus the process note:
- skill §6.1: unique judge-stub test names per package.
- skill §4.6 vs §6.1: which wins for a `generate` re-cut with a throwing stub (the throwing stub wins, and unchanged
  rows are red by design).
- skill: the `deck check` key `unproven` appears only when non-empty, and its absence means none. §1.5: MEASURE
  bookkeeping is not the orchestrator's. §12.2: times from `date -u`, never typed.
- skill: stubs are played by the binary's own acceptances (`morph gate`, or the acceptance + `stubcheck.mjs`), never
  by an emulation (P9a: `guardcheck.py`).
- OTHER_PROJECT.md: #40 items 8 and 9 (open-model orchestrator: validate JSON/YAML after edits; headless `claude -p`
  notes).

### P32: one definition of a dirty tree (#43 from #40 item 1, E1) — done 11.10: run 20261011-134046, 3/3 first pass, $0.023 + scout $0.064; main 1023f30
- Class: every acceptance ends with the untracked/frozen stage, so a file that is already untracked or modified before
  the run turns every card red, and no answer can fix it (P7c-2 and P9a: 2 runs).
- Found in recon: the run already refuses a dirty tree (Open Run Branch), but it **exempts `.morph/`** (P6, when
  decks lived there). The acceptance's untracked step has no such exemption. Two definitions of "dirty": the run starts
  on a tree that every acceptance rejects.
- Must hold (issue #43): Open Run Branch treats every `git status` entry as dirty, `.morph/` included (ignored files
  are never listed). The refusal names the paths and the remedy. One code card (git) + its judge. The acceptance text is
  unchanged, so every deck stays byte-identical.
- Replay: MorphStudio P7c-2 tree with an untracked `.morph/scout/<id>/scout.json` → `run` exit 2, $0. Committed or
  removed → the run starts.

### P30: layers from the record (#41, E2, size M, 6–8 cards)
- Must hold: #41 §1–6. Edges come from a Function step `uses: <Component>`. Directories are the posix dirnames of the
  code targets of the used Component's Functions, from the whole record and map (never the `--only` subset). The union
  is taken per directory.
- Where:
  - **new Component `rules`** (`src/rules/`, pure, imports contour and language; planner 27.0 KB, builder 27.6 KB and
    cli 27.5 KB are at the 30 KB rule): Function **Layer Edges**(record, map) → `{dir: allowedDirs[]}` or errors (a
    Component also a dependency name);
  - **cli** Plan Command passes them to Build Acceptances;
  - **builder / builder-go** emit them as the guard's `src` argument;
  - **templates go/ts guards** (data, by hand in the phase data commit) read the argument, drop the `layers` key from
    `layers.json`, and declare `// morph-guard-contract: 2`.
- **Stale guard copies.** A project keeps its own copy of the guard (`decks/tools/guard.mjs`, inlined by `plan
  --checks`). An old copy would silently ignore the new argument. So: when the record yields edges and the guard text
  lacks `morph-guard-contract: 2`, `plan --checks` exits 2 with "decks/tools/guard.mjs speaks contract 1: copy
  templates/<language>/decks/tools/guard.mjs". MorphV2 has no `layers.json`, so no argument is emitted and its decks
  stay byte for byte.
- Fixtures: #41 F1–F8.
- Replay: MorphStudio P9a at `f85a8e7` with the new guard copy. The stub play of the 3 `users` code cards reaches
  `== probe`. A full cut at MorphStudio HEAD gives the same guard verdicts as today's `layers.json` (34 edges).

### P31a: Guardrails → guard rules (#42 §1, 2, 4, 5, E2, size M, 6–8 cards)
- Function **Guardrail Rules**(record) in `rules`: the normalised Guardrail name, inherited System → Component →
  Function, is looked up in `templates/<lang>/decks/tools/guardrails.json` (data) and gives rule ids per directory
  (union per directory, as in P30). Unknown names go to the plan document as `prose only`.
- Template guards implement the ids (`pure`, `no-clock`, `no-env`, `no-network`, `stdlib-only`). `pure` and `entry`
  leave `layers.json`. Contract 3.
- Fixtures: #42 F3–F6. Old mrph's 3 names give its verdicts.
- Replay: MorphStudio with its record's "Injected Clock And Ids" / "No Network In Tests" mapped to rules. Its committed
  code stays green under the rules (no false red on HEAD).

### P31b: the imports whitelist from the record, blamed per file (#42 §3, E2, size S–M, 4–6 cards)
- Allowed imports: the stdlib narrowed by the rules, plus the record dependencies of the directory's Components. The
  guard names the importing file, and the transaction's blame goes to that file's owner. The `imports` extras of
  `checks.json` are no longer needed for these cases (kept working, flagged as redundant in the plan document).
- Fixtures: #42 F1–F2.
- Replay: MorphStudio P9a run 2. `encoding/hex` and `io/fs` pass, and token-lookup is not blamed for
  `users/registry.go`.

### P33 (later, data phase, operator's decision): MorphV2 eats its own rule
Complete MorphV2's record: `uses` steps to match `LAYERS`, Guardrails per Component to match `NO_CLOCK`/`NO_ENV`/….
Then switch `decks/tools/guard.mjs` to the template's contract, so that the 13 "· guard ·" DECISIONS lines become
record lines. Proof: every committed deck re-cut gives the same verdicts on its reference.

## 3. Not in this plan
- #40 item 6 (answers cut at maxTokens ×3): a data point for `maxTokensFactor` in #27 and `run` budgets in #29.
- #14 (P23): record dependency versions against go.mod/vendor. Same class ("record vs a second copy"), E1, kept as is.
- A `deck check` preflight of `layers.json` (my first comment on #40): dropped. With P30 there is no copy to check.

## 4. Estimate
D1 $0. P32 + P30 + P31a + P31b ≈ 20–26 cards on `ds`. At the P10a–P28 rate (≈ $0.02–0.05 per card with retries),
that is ≈ $1 in total, far below the $5 per-phase cap. The orchestrator sessions are the main cost.

## 5. Open for the operator
1. Order: P32 first (it cost the tester 2 runs, and it is small) or P30 first (the epic's core)?
2. New Component `rules`, or let planner/builder pass 30 KB and split them later? Proposal: `rules`.
3. Does P33 (MorphV2 on its own rules) go into this epic or later?
