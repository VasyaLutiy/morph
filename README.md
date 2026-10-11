# MorphV2

Headless orchestrator of batch code generation, written in TypeScript. A cheap model writes the
code; a human-written criterion judges it. MorphV2 turns a project's **record**, the Contour
`contour.yaml` (what the system must do, with examples), into a **deck** of small **cards**.
It sends each card to a processor (an LLM through OpenRouter), runs the card's **acceptance** on
the answer, and commits every accepted file on a run branch. One command, one JSON document on
stdout, an exit code. No REPL, no human in the loop of a run.

MorphV2 is built by Morph itself. Phases P0–P9 were built by the old Python Morph (`mrph`); from
P10b1 on, MorphV2 cuts and runs its own decks. No module here is hand-written code: each one
arrived as a card, together with its judge card.

## The concept

```
contour.yaml + morph-map.json        the record: Components, Functions (behavior + examples),
        │                            Data Objects, Requirements, Guardrails; the map: Function → file
        ▼
morph plan --judge [--checks]        the deck: a card per file owner, a judge card per Function
        │                            with examples, acceptances built from checks.json + probes
        ▼
morph deck check                     ownership and order hazards, slice weights, stub-tree builds
        ▼
morph run --processor <P>            generations in order; per card: compile a request → processor
        │                            → write the targets → acceptance → accept / retry / fail
        ▼
branch morph/<runId>                 one commit per accepted card (trailers Morph-Card, Morph-Model,
                                     Morph-Run), the run's archive in .morph/runs/<runId>/
```

**Record.** `contour.yaml` holds the contract, not the code. Each Function has a `behavior` and
`examples` with full values. Examples become the judge's tests and the probes' expected values.

**Map.** `morph-map.json` says which file each Function lives in, which language, which
documents go into every card, and per-card overrides.

**Card.** One unit of work: `targets` (the files it owns and writes whole), `contextSlice` (what
it may read), `instruction`, `acceptance` (a shell script, exit 0 = accepted), `dependsOn`,
`variants`, `maxTokens`. A **code card** writes code. A **judge card** writes the tests of a
Function from its examples; it never writes the code it judges.

**Deck and generations.** `dependsOn` orders the deck into generations. One file has one owner card per generation.
A card reads only what earlier generations wrote.

**Acceptance.** The criterion, written by the orchestrator. For TypeScript and Go it is built from
`decks/<phase>/checks.json` and a **probe** per code card: the record's examples at their expected
values. The stages are typecheck, lint, guard (layer rules), probe, own tests, full suite, frozen paths,
no stray files. A red acceptance feeds the failing lines back into a retry.

**Run.** Generations run in order. Cards inside a generation run in parallel. A card gets `variants` attempts, then retries with
its log and diff, under a per-generation retry cap. A deck cut with `--checks --only` is a
**transaction**: every card is written first, every acceptance runs on the full tree, and one red
rolls the subset back.

**Tools around the run.**
- `primer`: the project's ownership table and run history in one page, for the orchestrator.
- `scout`: a cheap model's localisation of a task to files.
- `gate`: the full dry gate on stubs and references, with mutants.
- `review`: a reviewer session.
- `card` / `accept`: one card by hand-run processor and acceptance, to pay a debt.
- `init`: a project template for TypeScript, Go or Python.

## Principles

1. **Code only from cards.** Humans and orchestrators write data: the record, the map, the specs,
   fixtures, checks, probes and stubs. A hand edit of code is a defect of the process.
2. **The author of the criterion is not the author of the code.** Judge cards write the tests from
   the record's examples, and the acceptance decides. "Correct code, red acceptance" is always the
   criterion's fault.
3. **Cut by file ownership, not by the idea.** One owner per file per generation. A slice holds
   what the card must construct. A big change is split, never widened.
4. **The record is the truth.** Examples carry full measured values. No byte oracle, no memory.
5. **Headless and measurable.** Every command is one JSON document and an exit code. Every run is
   archived with its requests, tokens and dollars.
6. **Cheap executors, cheap retries.** A retry on a flash model costs cents. Spend the expensive
   model, the orchestrator, on the criterion and not on ritual (see Morph-Orchestrator below).
7. **One language profile per Component.** TypeScript, Go and Python each have their test runner,
   finale and tree check. Dependencies are declared in the record and enforced by the guard.

## Commands

| command | does |
|---|---|
| `morph plan --root . --spec contour.yaml --map morph-map.json --component <C>… --judge [--checks f] [--only ids] --out <deck>` | cut a deck |
| `morph deck check --root . --deck <deck>` | hazards, weights, stub-tree builds |
| `morph run --root . --deck <deck> --processor <P> [--deadline s]` | run a deck |
| `morph primer --root . --write` | `.morph/primer.md` |
| `morph scout --root . --issue <file> --processor <P>` | `.morph/scout/<id>/scout.json` |
| `morph gate --root . --deck <deck> --stubs <dir> --refs <dir> [--mutants N]` | the full dry gate |
| `morph card` / `morph accept --commit` | one card, one acceptance |
| `morph init --language ts\|go\|python` | a project template |
| `morph review`, `morph submit`, `morph collect` | reviewer, batch submit and collect |

The data format and the exit codes for orchestrators: `docs/ORCHESTRATOR_REFERENCE.md`.
Project tunables (scout exclusions and budgets): `morph.config.yaml` at the project root, reference §8.

## Morph-Orchestrator

How a phase is prepared and run. The rules live in the skill
`.claude/skills/morph-v2-orchestrator/SKILL.md`: one phase in one fresh agent session — step 0
environment, recon (primer, record, scout), spec and data, the cut, stubs, an auto gate, the run,
verify with a live smoke, salvage from the archive, the report. The receipts behind each rule are
in `references/lessons.md` beside it. The phase data and the exit codes are in
`docs/ORCHESTRATOR_REFERENCE.md`.

The skill names its binary `<morph>` (a wrapper that maps the processor keys and runs a copy of
`dist/`) and `$MORPHV2` (this checkout); set both for your machine.

A paid retry on a flash model costs cents. Do not add a check whose only gain is fewer retries.
