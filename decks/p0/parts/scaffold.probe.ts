// P0 probe: the scaffold by docs/TASK_P0_scaffold.md, values and types. Runs from
// probe/scaffold/ under vitest with tests/setup.ts; type-checked together with the project.
import { test, expect } from "vitest";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as H from "../../tests/helpers.js";
import type { TmpRoot, TmpRepo, FakeFetch, FakeResponse, FakeCall, FakeClock, FakeReply } from "../../tests/helpers.js";
import { version } from "../../src/index.js";
import vitestConfig from "../../vitest.config.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = (rel: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")) as Record<string, unknown>;

async function why(fn: () => unknown): Promise<string> {
  try { await fn(); return "not blocked"; } catch (e) { return String((e as Error)?.message ?? e); }
}

test("package.json: pins, bin, type, scripts, version", () => {
  const p = readJson("package.json");
  expect(p.name, "name").toBe("morph");
  expect(p.version, "version").toBe("0.0.0");
  expect(p.private, "private").toBe(true);
  expect(p.type, "type").toBe("module");
  expect(p.bin, "bin").toStrictEqual({ morph: "dist/cli.js" });
  expect(p.engines, "engines").toStrictEqual({ node: ">=20" });
  expect(p.scripts, "scripts").toStrictEqual({
    build: "tsc -p tsconfig.build.json", typecheck: "tsc --noEmit", lint: "eslint src tests", test: "vitest run",
  });
  expect(p.dependencies, "dependencies").toStrictEqual({ yaml: "2.9.1" });
  expect(p.devDependencies, "devDependencies").toStrictEqual({
    "@eslint/js": "9.39.5", "@types/node": "22.20.5", eslint: "9.39.5", tsx: "4.23.15",
    typescript: "5.9.3", "typescript-eslint": "8.71.1", vitest: "3.2.7",
  });
});

test("tsconfig.json and tsconfig.build.json", () => {
  const t = readJson("tsconfig.json");
  const co = t.compilerOptions as Record<string, unknown>;
  const got = ["strict", "noEmit", "target", "lib", "module", "moduleResolution", "types",
    "verbatimModuleSyntax", "skipLibCheck", "forceConsistentCasingInFileNames"]
    .map((k) => `${k}=${JSON.stringify(co[k])}`).join(" ");
  expect(got, "compilerOptions").toBe(
    'strict=true noEmit=true target="ES2022" lib=["ES2022"] module="NodeNext" moduleResolution="NodeNext" ' +
    'types=["node"] verbatimModuleSyntax=true skipLibCheck=true forceConsistentCasingInFileNames=true');
  expect(t.include, "include").toStrictEqual(["src", "tests"]);
  const b = readJson("tsconfig.build.json");
  const bo = b.compilerOptions as Record<string, unknown>;
  expect(b.extends, "build extends").toBe("./tsconfig.json");
  expect(`${bo.noEmit} ${bo.outDir} ${bo.rootDir} ${bo.declaration} ${bo.sourceMap}`, "build options")
    .toBe("false dist src false false");
  expect(b.include, "build include").toStrictEqual(["src"]);
});

test("vitest.config.ts and src/index.ts", () => {
  const t = (vitestConfig as { test?: Record<string, unknown> }).test ?? {};
  expect(t.environment, "environment").toBe("node");
  expect(t.include, "include").toStrictEqual(["tests/**/*.test.ts"]);
  expect(t.setupFiles, "setupFiles").toStrictEqual(["tests/setup.ts"]);
  expect((t.chaiConfig as { truncateThreshold?: number } | undefined)?.truncateThreshold, "truncateThreshold").toBe(200);
  const v: string = version;
  expect(v, "src/index.ts version").toBe("0.0.0");
});

test("tests/setup.ts blocks the network", async () => {
  // XMLHttpRequest and WebSocket are not in the Node typings: reach them through globalThis
  const g = globalThis as unknown as Record<string, unknown>;
  const ctor = (name: string): (new (...a: string[]) => unknown) => {
    const c = g[name];
    if (typeof c !== "function") throw new Error(`${name} is ${typeof c} (setup.ts did not install a blocker)`);
    return c as new (...a: string[]) => unknown;
  };
  const got = [
    await why(() => fetch("http://127.0.0.1:9/")),
    await why(() => new (ctor("XMLHttpRequest"))()),
    await why(() => new (ctor("WebSocket"))("ws://127.0.0.1:9/")),
    await why(() => net.connect(9, "127.0.0.1")),
    await why(() => net.createConnection(9, "127.0.0.1")),
  ].map((m) => (m.includes("network blocked in tests") ? "blocked" : m));
  expect(got, "fetch, XMLHttpRequest, WebSocket, net.connect, net.createConnection")
    .toStrictEqual(["blocked", "blocked", "blocked", "blocked", "blocked"]);
});

test("helpers: tmpRoot", () => {
  const r: TmpRoot = H.tmpRoot();
  expect(r.root.startsWith(fs.realpathSync(os.tmpdir())), "root under os.tmpdir()").toBe(true);
  expect(path.basename(r.root).startsWith("morph-"), "default prefix morph-").toBe(true);
  expect(fs.statSync(r.root).isDirectory(), "root exists").toBe(true);
  const abs: string = r.write("a/b/c.txt", "x\n");
  expect(abs, "write returns the absolute path").toBe(path.join(r.root, "a/b/c.txt"));
  expect(r.path("a/b/c.txt"), "path joins").toBe(abs);
  expect(r.read("a/b/c.txt"), "read").toBe("x\n");
  expect(`${r.exists("a/b/c.txt")} ${r.exists("nope")}`, "exists").toBe("true false");
  const r2 = H.tmpRoot("zz-");
  expect(path.basename(r2.root).startsWith("zz-"), "custom prefix").toBe(true);
  r.rm(); r2.rm();
  expect(`${fs.existsSync(r.root)} ${fs.existsSync(r2.root)}`, "rm removes").toBe("false false");
});

test("helpers: tmpRepo", () => {
  const g: TmpRepo = H.tmpRepo();
  const base: TmpRoot = g;
  expect(path.basename(base.root).startsWith("morph-repo-"), "prefix morph-repo-").toBe(true);
  expect(g.git(["rev-parse", "--is-inside-work-tree"]), "a repo").toBe("true");
  expect(g.git(["branch", "--show-current"]), "branch main").toBe("main");
  expect(g.git(["log", "--format=%s"]), "one commit init").toBe("init");
  expect(g.git(["config", "user.name"]) + " " + g.git(["config", "user.email"]) + " " + g.git(["config", "commit.gpgsign"]),
    "repo config").toBe("morph morph@example.invalid false");
  g.write("f.txt", "1\n");
  g.git(["add", "f.txt"]);
  g.git(["commit", "-q", "-m", "second"]);
  expect(g.git(["log", "--format=%s"]), "commits").toBe("second\ninit");
  let err = "no error";
  try { g.git(["rev-parse", "--verify", "nope"]); } catch (e) { err = (e as Error).message; }
  expect(err.includes("nope") || err.includes("fatal"), "a failed git throws with git's words").toBe(true);
  g.rm();
  expect(fs.existsSync(g.root), "rm").toBe(false);
});

test("helpers: fakeFetch", async () => {
  const routes: Record<string, FakeReply> = {
    "/a": { body: { x: 1 } },
    "/b": { status: 500, body: { error: "boom" }, headers: { "X-Id": "7" } },
    "/c": new TypeError("Failed to fetch"),
    "/d": { text: "not json" },
    "/e": { status: 201 },
  };
  const f: FakeFetch = H.fakeFetch(routes);
  const a: FakeResponse = await f.fetch("/a", { method: "post", headers: { "Content-Type": "application/json" }, body: '{"q":1}' });
  expect(`${a.ok} ${a.status} ${await a.text()}`, "/a").toBe('true 200 {"x":1}');
  expect(JSON.stringify(await a.json()), "/a json").toBe('{"x":1}');
  const b = await f.fetch("/b");
  expect(`${b.ok} ${b.status} ${b.headers.get("x-id")} ${b.headers.get("nope")}`, "/b").toBe("false 500 7 null");
  let c = "resolved";
  try { await f.fetch("/c"); } catch (e) { c = (e as Error).name + ":" + (e as Error).message; }
  expect(c, "/c rejects with the Error").toBe("TypeError:Failed to fetch");
  const d = await f.fetch("/d");
  expect(await d.text(), "/d text").toBe("not json");
  let dj = "resolved";
  try { await d.json(); } catch (e) { dj = (e as Error).name; }
  expect(dj, "/d json() rejects").toBe("SyntaxError");
  const e = await f.fetch("/e");
  expect(`${e.ok} ${e.status} "${await e.text()}"`, "/e no body").toBe('true 201 ""');
  const z = await f.fetch("/zzz");
  expect(`${z.ok} ${z.status} ${await z.text()}`, "unknown url").toBe('false 404 {"error":"not found"}');
  f.set("/a", { status: 204 });
  expect((await f.fetch("/a")).status, "set").toBe(204);
  f.failAll(new Error("down"));
  let down = "resolved";
  try { await f.fetch("/a"); } catch (err) { down = (err as Error).message; }
  expect(down, "failAll").toBe("down");
  f.failAll(null);
  expect((await f.fetch("/a")).status, "failAll(null)").toBe(204);
  const calls: FakeCall[] = f.calls;
  expect(calls.map((k) => `${k.method} ${k.url}`).join(","), "calls")
    .toBe("POST /a,GET /b,GET /c,GET /d,GET /e,GET /zzz,GET /a,GET /a,GET /a");
  expect(calls[0], "first call").toStrictEqual({ url: "/a", method: "POST", headers: { "Content-Type": "application/json" }, body: '{"q":1}' });
  expect(`${calls[1]?.body} ${JSON.stringify(calls[1]?.headers)}`, "defaults").toBe("null {}");
});

test("helpers: fakeClock and flush", async () => {
  const k: FakeClock = H.fakeClock();
  const n0: number = k.now();
  expect(n0, "now starts at 0").toBe(0);
  expect(H.fakeClock(50).now(), "start").toBe(50);
  const hits: string[] = [];
  void k.sleep(30).then(() => hits.push("c"));
  void k.sleep(10).then(() => hits.push("a"));
  void k.sleep(10).then(() => hits.push("b"));
  expect(k.pending().join(","), "pending").toBe("10,10,30");
  await k.advance(10);
  expect(`${k.now()} ${hits.join("")} ${k.pending().join(",")}`, "advance(10)").toBe("10 ab 30");
  await k.advance(5);
  expect(`${k.now()} ${hits.join("")}`, "advance(5) fires nothing").toBe("15 ab");
  await k.advance(100);
  expect(`${k.now()} ${hits.join("")} ${k.pending().length}`, "advance(100)").toBe("115 abc 0");
  let done = false;
  void Promise.resolve().then(() => 1).then(() => 2).then(() => { done = true; });
  await H.flush();
  expect(done, "flush").toBe(true);
});

test("helpers: fixture, fixtureJson, fixturePath", () => {
  const p: string = H.fixturePath("p0/hello.txt");
  expect(p, "fixturePath").toBe(path.join(ROOT, "tests/fixtures/p0/hello.txt"));
  const t: string = H.fixture("p0/hello.txt");
  expect(t, "fixture").toBe("hello\n");
  const j = H.fixtureJson("p0/hello.json") as { hello: number };
  expect(j.hello, "fixtureJson").toBe(1);
  j.hello = 2;
  expect((H.fixtureJson("p0/hello.json") as { hello: number }).hello, "fresh parse each call").toBe(1);
});
