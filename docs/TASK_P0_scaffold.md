# TASK_P0 — the scaffold of MorphV2 (one card, run alone)

> Phase P0 of `docs/PLAN.md`. One card, `scaffold`, writes the Node project skeleton:
> package manifest, TypeScript and vitest configuration, ESLint configuration, the test
> setup that blocks the network, the one stub module every later test imports, and an
> empty `src/index.ts`. No product code. Built by the old Morph (`mrph`) on glm.

## 1. Why this

Every later phase (P1–P18, ≈148 cards) runs `tsc --noEmit`, `eslint` and `vitest`
in its acceptance and imports `tests/helpers.ts` in its tests. A scaffold that drifts
(a loose pin, a missing helper, a `bundler` resolution that a plain `node dist/cli.js`
cannot run) reddens every card after it. Measured on the previous TypeScript deck of
this builder: `tsc` was the first red on 8 of 19 failed variants, and a helpers type
that mirrored a product type as `string` instead of a union cost two downstream reds.
The scaffold is therefore one card, run alone, with a probe that asserts values **and
types**, and its lock file is committed by the operator as data before P1.

## 2. Contract

### 2.1. INPUT data shapes the code must build

- `tests/fixtures/p0/hello.txt` (bytes `hello\n`) and `tests/fixtures/p0/hello.json`
  (`{"hello": 1}` and a newline): the only fixtures; `fixture("p0/hello.txt")` reads
  the first, `fixtureJson("p0/hello.json")` parses the second.
- Nothing else: there is no `src/` yet.

### 2.2. OUTPUT data shapes

- `package.json`: `name` "morph", `version` "0.0.0", `private` true, `type` "module",
  `bin` `{"morph": "dist/cli.js"}`, `engines` `{"node": ">=20"}`, `scripts`
  `{"build": "tsc -p tsconfig.build.json", "typecheck": "tsc --noEmit", "lint":
  "eslint src tests", "test": "vitest run"}`, `dependencies` exactly `{"yaml": "2.9.1"}`,
  `devDependencies` exactly `{"@eslint/js": "9.39.5", "@types/node": "22.20.5",
  "eslint": "9.39.5", "tsx": "4.23.15", "typescript": "5.9.3", "typescript-eslint":
  "8.71.1", "vitest": "3.2.7"}`. Exact versions, no `^` or `~`, no other keys under
  the two dependency maps.
- `tsconfig.json`: `compilerOptions` `strict` true, `noEmit` true, `target` "ES2022",
  `lib` ["ES2022"], `module` "NodeNext", `moduleResolution` "NodeNext", `types`
  ["node"], `verbatimModuleSyntax` true, `skipLibCheck` true,
  `forceConsistentCasingInFileNames` true; `include` ["src", "tests"].
- `tsconfig.build.json`: `extends` "./tsconfig.json"; `compilerOptions` `noEmit` false,
  `outDir` "dist", `rootDir` "src", `declaration` false, `sourceMap` false; `include`
  ["src"]. `npm run build` then yields `dist/index.js`.
- `vitest.config.ts`: `defineConfig` from "vitest/config" with `test`
  `{environment: "node", include: ["tests/**/*.test.ts"], setupFiles: ["tests/setup.ts"],
  chaiConfig: {truncateThreshold: 200}}` and nothing else.
- `eslint.config.js` (ESM, the package is `type: module`): flat config exporting
  `tseslint.config(js.configs.recommended, ...tseslint.configs.recommended, {files:
  ["**/*.ts"], rules: {"@typescript-eslint/no-explicit-any": "error"}}, {ignores:
  ["dist/", "node_modules/", "coverage/", ".morph/"]})` with `js` from "@eslint/js" and
  `tseslint` from "typescript-eslint". `probe/` is **not** ignored: the acceptance
  lints a file there that must be rejected for `any`.
- `tests/setup.ts`: no exports; see §2.3.
- `tests/helpers.ts`: exactly the exports of §2.3; imports only `node:*` modules,
  never `src/` and never "vitest".
- `src/index.ts`: `export const version = "0.0.0";` and nothing else (it equals
  `package.json` `version`).

### 2.3. Names

`tests/setup.ts` replaces `globalThis.fetch`, `globalThis.XMLHttpRequest`,
`globalThis.WebSocket`, and `connect` and `createConnection` of the default export of
"node:net", with functions that throw `Error("network blocked in tests")`. A test that
needs fetch takes a fake from helpers as a parameter; nothing restores the globals.

`tests/helpers.ts` (signatures are the contract; every type below is exported):

- `interface TmpRoot { root: string; path(rel: string): string; write(rel: string, text:
  string): string; read(rel: string): string; exists(rel: string): boolean; rm(): void }`;
  `tmpRoot(prefix = "morph-"): TmpRoot` — `fs.mkdtempSync(path.join(os.tmpdir(),
  prefix))`, `root` is its `fs.realpathSync`; `path(rel)` joins; `write` creates the
  parent directories and returns the absolute path; `read` is utf8; `rm` is
  `fs.rmSync(root, {recursive: true, force: true})`.
- `interface TmpRepo extends TmpRoot { git(args: readonly string[]): string }`;
  `tmpRepo(): TmpRepo` — a `tmpRoot("morph-repo-")` where `git init -q -b main` ran,
  `user.name` "morph", `user.email` "morph@example.invalid" and `commit.gpgsign` false
  are set in the repo config, and one empty commit "init" exists. `git(args)` runs
  `execFileSync("git", args, {cwd: root, encoding: "utf8", stdio: ["ignore", "pipe",
  "pipe"], env: {...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C"}})` and returns
  stdout trimmed; a non-zero exit throws with git's stderr in the message.
- `type FakeReply = { status?: number; body?: unknown; text?: string; headers?:
  Record<string, string> } | Error`; `interface FakeResponse { ok: boolean; status:
  number; headers: { get(name: string): string | null }; json(): Promise<unknown>;
  text(): Promise<string> }`; `interface FakeCall { url: string; method: string; headers:
  Record<string, string>; body: string | null }`; `interface FakeFetch { fetch(url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }):
  Promise<FakeResponse>; calls: FakeCall[]; set(url: string, reply: FakeReply): void;
  failAll(e: Error | null): void }`; `fakeFetch(routes: Record<string, FakeReply> = {}):
  FakeFetch`. Every call pushes `{url, method: (init.method ?? "GET").toUpperCase(),
  headers: init.headers ?? {}, body: init.body ?? null}` to `calls` first. Then: when
  `failAll(e)` is armed, reject with e (until `failAll(null)`); an unknown url resolves
  `{ok: false, status: 404}` with body `{"error": "not found"}`; an `Error` reply rejects
  with it; otherwise `status` defaults to 200, `ok` is 200..299, `text()` resolves
  `reply.text` if given, else `JSON.stringify(reply.body)` if `body` is given, else "";
  `json()` is `JSON.parse` of that text (so it rejects with a `SyntaxError` on
  non-JSON); `headers.get` is case-insensitive over `reply.headers ?? {}`.
- `interface FakeClock { now(): number; sleep(ms: number): Promise<void>; advance(ms:
  number): Promise<void>; pending(): number[] }`; `fakeClock(start = 0): FakeClock` —
  `now()` starts at `start`; `sleep(ms)` registers a timer due at `now() + ms` and
  returns a promise; `advance(ms)` moves `now` forward by ms, resolves every timer due
  at or before the new now, in due order (ties in registration order), then awaits
  `flush()`; `pending()` is the due times of the unresolved timers, ascending. Timers
  never fire on their own: no real `setTimeout` anywhere in the module.
- `flush(): Promise<void>` — awaits five turns of `setImmediate` from
  "node:timers/promises".
- `fixturePath(name: string): string` — `path.resolve(path.dirname(fileURLToPath(
  import.meta.url)), "fixtures", name)`; `fixture(name): string` — a fresh utf8 read;
  `fixtureJson(name): unknown` — a fresh `JSON.parse(fixture(name))`.

### 2.4. What must not break

- `contour.yaml`, `morph-map.json`, `docs/`, `decks/`, `tests/fixtures/`: byte for byte.
- After the operator commits `package-lock.json`, no later card writes any of the eight
  scaffold files or the lock file.

## 3. Acceptance

Built by `decks/tools/build.py` into `decks/p0-scaffold.json`; the steps, narrow to
broad, each printing a readable line on failure:

1. `npm install --no-audit --no-fund` (the one step that may use the network; it writes
   `package-lock.json`, which the card does not).
2. `node_modules/.bin/tsc --noEmit -p probe/scaffold/tsconfig.probe.json` — the project
   plus the probe, so the probe's type-level assertions are checked.
3. `tsc --showConfig`: `strict` true and `module` NodeNext.
4. `node_modules/.bin/tsc -p tsconfig.build.json` yields `dist/index.js`; `dist/` is
   removed afterwards.
5. `node_modules/.bin/eslint src tests` is green; `eslint probe/scaffold/any.ts`
   (a one-line file with `: any`) is **red**.
6. `decks/tools/guard.mjs`: `src` (layers, no `any`, no package imports) and
   `helpers tests/helpers.ts <exports>` (imports only `node:*`, every export present).
7. `decks/p0/parts/scaffold.probe.ts` under vitest with `tests/setup.ts`: one `test`
   per file or helper, values and types.
8. `vitest run --passWithNoTests` (the full suite; empty in P0).
9. Frozen: `git diff --quiet HEAD -- contour.yaml morph-map.json docs decks tests/fixtures`.
10. Untracked files other than the eight targets and `package-lock.json`: none.

Timeout of the whole chain: 300 s (the builder's own limit); measured on a dry tree in
§11.

## 4. Constraints

- Exact versions in §2.2; the executor does not look them up.
- No `package-lock.json` in the answer: `npm install` writes it.
- `tests/helpers.ts` imports only `node:*`: it must not depend on `src/` (every card's
  slice carries it) nor on "vitest" (the probe runs under a different config).
- `module`/`moduleResolution` NodeNext, not `bundler`: `dist/cli.js` runs under plain
  Node from P10 on.

## 7. Out of scope

- Any file under `src/` beyond `src/index.ts`; `src/types.ts` is not written here.
- CI, publishing, `README` changes, a `.npmrc`.
- Python-profile helpers (P4 language).

## 8. How to run

```
python3 decks/tools/build.py p0
mrph deck add --root . --file decks/p0-scaffold.json && mrph deck check --root .
mrph run --root . --processor glm
```

## 9. Pre-registration

- 1 card, 2 variants; accepted within 2 attempts; ≤ $0.05.
- Likely first red: a pin written with `^`, or `bundler` resolution from habit.

## 10. What to record

Attempts, which step was first red per variant, minutes, $; the row of
`docs/MEASURE.md`.

## 11. Actual

(filled after the run)
