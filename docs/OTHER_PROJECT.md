# MorphV2 on another project, old-Morph scheme (operator 10.10)

The scheme is `docs/OLD_SCHEME.md`; the phase's data (checks.json, probes, _stubs, the transaction, exit codes)
is `docs/ORCHESTRATOR_REFERENCE.md` — read it instead of `src/` or `dist/`. This file has the commands, what to change in the
project's data, and the header of the orchestrator's task. It was checked dry (no paid call)
on a scratch clone of ETHSmartChecker (Python, an mrph project with 27 runs) on 10.10.

## 1. The binary

```bash
cd /home/john/Documents/Work2026/MorphV2 && npm run build      # dist/ at the commit you want
mkdir -p /tmp/morphbin && cp -r dist package.json /tmp/morphbin/ && ln -sfn $PWD/node_modules /tmp/morphbin/node_modules
```
Run the COPY (`/tmp/morphbin/dist/cli.js`), never the repo's `dist/` (a rebuild in the middle
would replace the running binary).

### The processor env: wrapper `~/bin/morphv2`
V2 does not read `.env` from the current directory. It reads `MORPH_PROCESSOR_<P>_<KEY>` from its environment.
The wrapper maps them from morph-lab's `.env` by indirection and never prints the key:
```bash
#!/bin/bash
(
  set -a; . /home/john/Documents/Work2026/MorphProject/morph-lab/.env; set +a
  for P in ds glm; do for k in TYPE API_KEY MODEL ROUTE CONCURRENCY PROVIDER_ORDER REASONING_MAX_TOKENS; do
    v="MRPH_PROCESSOR_${P}_$k"; [ -n "${!v:-}" ] && export "MORPH_PROCESSOR_${P}_$k=${!v}"
  done; done
  for v in $(compgen -e | grep -E '^(MRPH_|JEV_)'); do unset "$v"; done
  exec node /tmp/morphbin/dist/cli.js "$@"
)
```
A Claude Code session needs the permission `Bash(~/bin/morphv2:*)`, or the auto-mode classifier
denies scout and run ("Create Unsafe Agents").

## 2. mrph → V2, command by command

| step | old mrph | MorphV2 |
|---|---|---|
| primer | `mrph primer --root . --write` | `morphv2 primer --root . --write` (it reads mrph's `.morph/runs` too) |
| scout | `mrph scout --root . --issue - --processor glm --seed-from-primer <<'TASK'` | `morphv2 scout --root . --issue /tmp/<p>/issue.md --processor <P>`. `--issue` is a FILE outside the tree, not stdin. There is no `--seed-from-primer`: round zero is seeded from git ownership by default; `--seed-file seed.json` narrows it. Result: `.morph/scout/<id>/scout.json` |
| dry plan | `mrph plan --spec contour.yaml --map morph-map.json --component X` | `morphv2 plan --root . --spec contour.yaml --map morph-map.json --component X --judge --out /tmp/dry.json` |
| cut | `… --judge --add` → `.morph/deck.json` (a backlog) | `… --judge --out decks/<phase>/deck.json`. A file per phase: no backlog, so no `deck status / clear / reset`. Cards outside the phase: `--only id,id` |
| acceptances | from the map (`cards.<id>.acceptance`) | without `--checks` the map's acceptances are used as they are, but **an `--only` cut without `--checks` is NOT a transaction**: the acceptances are built, and marked as a transaction, only on the `--checks` path (`src/cli/planCommand.ts`). Any re-cut with `--only` needs `--checks decks/<phase>/checks.json`. `deck check` checks builds only when it gets the stubs (`decks/<phase>/_stubs/`). Details: `docs/ORCHESTRATOR_REFERENCE.md` §2–§5. `--checks` builds acceptances for TypeScript and Go only: a Python project keeps the map's acceptances and has no transaction |
| budget | `max_tokens` from the cut | for `ds`: `python3 /home/john/Documents/Work2026/MorphV2/decks/tools/scale_tokens.py decks/<phase>/deck.json 3` after the cut |
| check | `mrph deck check` | `morphv2 deck check --root . --deck decks/<phase>/deck.json` (errors 0; weights per card) |
| run | `mrph run --processor glm` | `morphv2 run --root . --deck decks/<phase>/deck.json --processor <P> --deadline 2400 > /tmp/<p>/run.json 2> /tmp/<p>/run.err` (stdout is the Run Document; progress lines are `morph run:` on stderr) |
| after the run | branch `morph/<id>`; `git checkout master` | the same |
| one card again | `/morph-agent-run` | `morphv2 card` / `morphv2 accept --commit` on a deck re-cut with `--only` |

Commit the data and the deck first: `plan` and `run` read the committed tree.

## 3. The project's data: what V2 requires that mrph did not
Found on ETHSmartChecker. The record and the map were otherwise read as they are, and plan, deck check and primer gave exit 0:
1. **Every Function needs `behavior:`.** mrph accepted `steps` alone; V2 refuses the record
   with `System.groups[i].functions[j].behavior: required` (3 Functions in ethsc).
2. **The language goes into `morph-map.json`: `"language": "python"`** (or `language:` on the
   Component). Without it a Python card ends with the TypeScript finale ("TypeScript with
   `strict` on … vitest").
3. **The Python finale is fixed:** "Python 3.10 or later … pytest … `tests/conftest.py`". On a
   project with other conventions (ethsc: Python 3.9 syntax, `tests/helpers.py`) the card
   gets two contradicting lines. The finale comes last, after the map's instruction. This is
   a V2 finding, not fixed here: it goes to a Fable review, as all bugs do.

## 4. The skill
Keep `morph-orchestrator` (the old order), with four changes, given in the task header:
- every `<mrph>` command → the right column above;
- Phase 3 (operator gate) → auto-approve by `docs/OLD_SCHEME.md` §6: plan exit 0, deck check 0
  errors, stubs red per example, forecast ≤ $5; nothing is waited for;
- Phase 5 run → as above; a red card: one fix by class, one re-run; still red = stop;
- Phase 6 stays: verification is not the orchestrator's (merge is yours).
The spec format (`documentation/TASK_TEMPLATE.md` of mrph) does not change: V2 does not read the spec.

## 5. The task header (in place of the mrph lines of the old prompt)
```
/morph-orchestrator

Project: the current folder (Scenario B).
Morph CLI: ~/bin/morphv2 (MorphV2, scheme /home/john/Documents/Work2026/MorphV2/docs/OLD_SCHEME.md;
command table: docs/OTHER_PROJECT.md §2 of that repo — use it in place of every mrph command of the skill;
the phase's data and exit codes: docs/ORCHESTRATOR_REFERENCE.md of that repo — read it, not MorphV2's src/ or dist/).
Processor: ds (deepseek flash; maxTokens x3 after the cut) or glm.
Gate: auto-approve by OLD_SCHEME.md §6 — do not wait for me. After the run: verify, then stop; merge is mine.

First call is primer, before any code: ~/bin/morphv2 primer --root . --write, then read .morph/primer.md.
Contour: contour.yaml by outline, the task's groups only.
Scout: the task in /tmp/<phase>/issue.md (3–6 lines), ~/bin/morphv2 scout --root . --issue /tmp/<phase>/issue.md --processor ds
Deck: ~/bin/morphv2 plan --root . --spec contour.yaml --map morph-map.json --component <C> --judge --checks decks/<phase>/checks.json --out decks/<phase>/deck.json
(TypeScript/Go; --only for a re-cut of code on main = a transaction), then scale x3 (ds), deck check (with decks/<phase>/_stubs), stubs, run.
In the report: deck targets the scout named and roles you changed — two numbers.

<the phase text, as before>
```
Untested so far: a paid V2 run and a V2 scout on a Python project. The first phase is that test.
