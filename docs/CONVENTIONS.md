# Conventions of this tree

The only `docs` entry every card reads. Keep it under 3 KB.

- **Language.** TypeScript, `strict` on, ESM. `tsconfig.json` uses `module` and
  `moduleResolution` `NodeNext`: every relative import carries the `.js` extension
  (`import { x } from "./model.js"`), and types are imported with `import type`.
  No `any`: use `unknown` and narrow. Package imports are `node:*` only; the one
  runtime dependency, `yaml`, is imported only under `src/contour/`. The typings are
  Node's without DOM: `XMLHttpRequest` and `WebSocket` are not names; reach a global
  through `globalThis as unknown as Record<string, unknown>`.
- **Layout.** One Component of the record = one directory `src/<component>/`; file
  names camelCase. Tests live in `tests/<component>/<name>.test.ts` (the author's smoke
  test) and `tests/<component>/<name>.examples.test.ts` (the judge's test, one
  `test(...)` per example of the Function, in example order). Fixtures live in
  `tests/fixtures/`.
- **Tests.** vitest. `toBe` on scalars and short strings; never `toEqual` on a
  fixture-sized object. Every stub comes from `tests/helpers.ts` (`tmpRoot`,
  `tmpRepo`, `fakeFetch`, `fakeClock`, `flush`, `fixture`, `fixtureJson`,
  `fixturePath`); a test declares no fetch, no `Fake*`, no real timer
  (`setTimeout`/`setInterval` are not named under `tests/`). A test writes only
  under a `tmpRoot()` and removes it. The network is blocked by `tests/setup.ts`.
- **Layers.** `src/cards` and `src/wait` import nothing internal; every other
  Component imports `cards`, `wait` and what the record's `steps` name; `src/cli`
  may import everything. `node:child_process` only under `src/acceptance/` and
  `src/git/`; `fetch` only under `src/processor/`; `console` and `process.exit`
  only under `src/cli/`. The acceptance checks these on the syntax tree.
- **Determinism.** `cards`, `compiler`, `response`, `language`, `contour`, `planner`
  read no clock, no randomness, no environment: same inputs, same bytes.
- **Output.** Every CLI command prints exactly one JSON document on stdout; the
  human log goes to stderr.
