# {{name}} — the plan by epics and phases

> The architect's plan. Written once before the first deck, amended only by the operator. The record (`contour.yaml`)
> holds the current contract; this file holds the order in which it is built and why.

## Context

- What {{name}} is, for whom, and what "done" means for the first release (one paragraph, with numbers where there are
  any: users, requests, files, latency).
- The operator's decisions that bind the plan (stack: {{language}}; runtime; what is out of scope; the money cap per
  phase and for the whole stretch).
- Who builds: Morph cards from the record (`morph plan --spec` → `morph run`), one code card and one judge card per
  Function; the orchestrator writes only data.

## What recon found

Each item with its address (file, line, measured value). For a project from zero: the external contracts the code must
meet (APIs, file formats, protocols) and where their exact shapes come from (a recorded response, a specification, a
sample file kept under `tests/fixtures/`).

## Epics

| epic | Components | what it gives | depends on |
|---|---|---|---|
| E1 | <component>, <component> | <one line> | — |

## Phases by the record

A phase is one deck: one gate, one run, 6–12 cards, ≤ 4 generations, forecast within the phase cap. A phase that grows
past that is split (`<phase>a`, `<phase>b`) by the cut rules.

| phase | Component(s) | Functions | cards / generations | acceptance (what proves it) | risk | forecast $ |
|---|---|---|---|---|---|---|
| scaffold | — (data) | the toolchain files, the helpers module, the lock file, the declared dependencies installed and their API digests | data commit | `tsc`/`go build`/`pytest` on the empty tree, offline | — | 0 |
| 1 | <component> | <Function>, <Function> | <n> / <g> | <fixture → literal result> | <what may redden> | <$> |

## Rules of the record

1. **The record does not grow with history.** Runs, burned attempts and lessons live in `.morph/runs`,
   `docs/MEASURE.md` and `docs/DECISIONS.md`; `contour.yaml` holds only the current contract.
2. **Large literals live in fixtures.** An example names `tests/fixtures/<file>` by `ref` (or by key in a shared
   examples file) instead of carrying dozens of lines in `then`.
3. **A Component stays under 30 KB of record**; past that it is two Components.
4. **A command lives in its own Component**; the CLI Component only parses, routes and prints one document.
5. **Every example carries full values as measured**, never abbreviated; every constant the code must not hard-code is
   varied across the examples.

## Dependencies

The standard library is the default. A library enters only by declaration, approved with this plan:

1. **The architect declares it in the record**: `System.dependencies` lists `{name, version, language, doc}` — `name` the
   import path (the npm package, the Go module path, the Python distribution), `version` **exact** (no range: npm
   `2.8.1`, Go `v0.7.0` or a pseudo-version, Python `6.0`; quoted in YAML), `language` the Component's, `doc` the API
   digest `docs/deps/<name>.md`. Each Component lists the ones its code may import: `uses: [<name>]`. The planner then
   tells every card of that Component "the standard library plus <name>@<version>; their API is in <doc>; no other
   import", puts the digest into its slice, and the acceptance's guard allows exactly those imports in that card's code
   files; every other Component keeps the standard library only.
2. **The plan names each dependency with its reason** (what it saves, its size, its own dependencies) in this section's
   table; **the operator approves the list with the plan**. A dependency added later is a plan change: the session stops
   for the operator.
3. **The scaffold phase installs them once, with the network**; every acceptance after it runs offline:
   - **Go**: `go get <path>@<version>` per module; `internal/deps/tools.go` with `//go:build tools` and one blank import
     per module package (`go mod vendor` ignores build tags, so the packages are vendored before any card imports them;
     the file is never built); `go mod tidy`; `go mod vendor`; commit `go.mod`, `go.sum`, `vendor/` and tools.go. With
     `vendor/modules.txt` present when a deck is cut, every Go acceptance runs `GOFLAGS=-mod=vendor GOPROXY=off`.
   - **TypeScript**: `npm install --save-exact <name>@<version>` per package (the manifest and `package-lock.json`
     written), commit both; every later install is `npm ci`.
   - **Python**: a venv and a pinned `requirements.txt` (`<name>==<version>`), `pip install -r requirements.txt` into the
     venv; commit the requirements file. Python gets the directive only; no guard checks its imports.
4. **The API digest** (`docs/deps/<name>.md`, 2–5 KB): the signatures the cards will call and one short example, written
   from the library's own documentation and type declarations at the declared version, every value in it measured on
   that version. It is the only text about the library a card sees; a missing digest file is a plan fault.

| dependency | version | language | Components | why (what it saves) | approved |
|---|---|---|---|---|---|
| <name> | <exact> | <language> | <component> | <one line> | <operator, plan> |

## Measurements along the way

Per phase, in `docs/MEASURE.md`: cards planned / accepted / burned, executor and orchestrator money, minutes, first red
per burned variant, neighbour-red, judge defects, lines by hand (0), largest slice in bytes, the run ids.

## Order and stops

The phases in order; the smoke stops (a live run of the product on a tiny project) and the operator's checkpoints after
named phases. The autonomous session works exactly the phase `docs/AUTONOMY.md` "State at handoff" names.
