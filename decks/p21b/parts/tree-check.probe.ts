// P21b probe for tree-check by docs/TASK_P21b_deckcheck.md §2.2 (src/acceptance/treeCheck.ts) — a copy of the tree with
// the stubs in place, one compile step run in it, and the file:line lines of an output (issue #12 item 3.5). Record Tree
// Check examples 1-3, then rows.
import fs from "node:fs";
import os from "node:os";
import { test, expect } from "vitest";
import { findBreaks, treeCheck } from "../../src/acceptance/treeCheck.js";
import { fixtureJson, fixturePath, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

function copyOf(name: string): TmpRoot { const r = tmpRoot(); fs.cpSync(fixturePath(name), r.root, { recursive: true }); return r; }
const G = 'export GOFLAGS=-mod=mod GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOWORK=off GOCACHE="${GOCACHE:-/tmp/morph/go-build}" GOPATH="${GOPATH:-/tmp/morph/go}"';
const GO_LINE = "^(?:vet: )?(?:\\./)?(\\S+?\\.go)(:\\d+.*)$", TS_LINE = "^(\\S+?\\.tsx?)(\\(\\d+,\\d+\\).*)$";
const GO_CMD = "go build -overlay {config} ./... ; go vet -overlay {config} ./...";
const pathEnv = (): Record<string, string> => ({ PATH: process.env.PATH ?? "" });
const out = (): Record<string, string> => fixtureJson("acceptance/treeOutput.json") as Record<string, string>;
const GU = "supervisor/guard.go:20:23: l.Resumes undefined (type *Loop has no field or method Resumes)";
const STUB = { "b/b.go": "_stubs/b/b.go" };
const files = (r: TmpRoot): string => JSON.stringify(fs.readdirSync(r.root, { recursive: true }).map(String).sort());

test("Tree Check example 1: own lines dropped, the rest once, sorted; an unmatched line kept whole", () => {
  expect(findBreaks(out().go, GO_LINE, ["supervisor/loop.go"])).toStrictEqual(["daemon/daemon.go:9:81: not enough arguments in call to d.Loop.Exited",
    "go: updates to go.mod needed; to update it:", "mcp/session.go:6:2: package morphlite/supervisor is not in std", GU]);
  expect(findBreaks(out().typescript, TS_LINE, ["src/units/convert.ts"])).toStrictEqual(["error TS5083: Cannot read file '/x/tsconfig.json'.",
    "src/report/line.ts(1,17): error TS2724: '\"../units/convert.js\"' has no exported member named 'toMeters'. Did you mean 'toMetres'?",
    "tests/report/line.examples.test.ts(5,44): error TS2554: Expected 3 arguments, but got 2."]);
  expect(findBreaks(out().go, TS_LINE, [])).toStrictEqual(["go: updates to go.mod needed; to update it:", "mcp/session.go:6:2: package morphlite/supervisor is not in std",
    GU, "supervisor/loop.go:30: missing return", "vet: ./supervisor/loop.go:12:2: declared and not used: x",
    "vet: daemon/daemon.go:9:81: not enough arguments in call to d.Loop.Exited", "vet: " + GU]);
});

test("Tree Check example 2: the stub is compiled in place of b/b.go, the config hides a/a.go, the root untouched", () => {
  const r = copyOf("acceptance/tree");
  try {
    const before = files(r);
    const run = (text: string, stubs: Record<string, string>) => treeCheck(r.root, { card: "k1", exports: [G], config: { name: "full.json", text }, stubs, command: GO_CMD }, pathEnv(), 60000);
    expect(run('{"Replace":{}}', STUB)).toStrictEqual({ exit: 1, timedOut: false,
      output: "# example.com/vq/a\na/a.go:6:25: undefined: b.Old\n# example.com/vq/a\nvet: a/a.go:6:25: undefined: b.Old\n" });
    expect(run('{"Replace":{"a/a.go":""}}', STUB)).toStrictEqual({ exit: 0, timedOut: false, output: "" });
    expect(run('{"Replace":{}}', {})).toStrictEqual({ exit: 0, timedOut: false, output: "" });
    expect([files(r), r.read("b/b.go").includes("Old")]).toStrictEqual([before, true]);
  } finally { r.rm(); }
}, 120000);

test("Tree Check example 3: exports, config, stubs, the copy's entries, relative paths; a timeout", () => {
  const r = copyOf("acceptance/tree");
  try {
    r.write(".git/HEAD", "x"); r.write("node_modules/q/i.js", "x"); r.write("probe/old/o.txt", "x");
    const cmd = 'echo "a.go:1:1: $Q9 $(cat {config}) $(head -3 b/b.go | tail -1)"; ls -a; echo "$(pwd)/x.go:2:2: abs"; readlink node_modules >/dev/null && echo linked';
    expect(treeCheck(r.root, { card: "k2", exports: ["export Q9=-mod=vendor"], config: { name: "c.json", text: "{\"q\": 9}" }, stubs: STUB, command: cmd }, pathEnv(), 60000))
      .toStrictEqual({ exit: 0, timedOut: false, output: "a.go:1:1: -mod=vendor {\"q\": 9} // New is the API after the change.\n.\n..\n_stubs\na\nb\ngo.mod\nnode_modules\nprobe\nx.go:2:2: abs\nlinked\n" });
    const t0 = Date.now();
    expect(treeCheck(r.root, { card: "k3", exports: [], config: { name: "c.json", text: "{}" }, stubs: {}, command: "echo started; sleep 3; echo late" }, pathEnv(), 700))
      .toStrictEqual({ exit: null, timedOut: true, output: "started\n" });
    expect(Date.now() - t0 < 3000).toBe(true);
  } finally { r.rm(); }
}, 120000);

test("row: the config sits at probe/<card>/<name>, env is exactly the env given, the tmp directory is removed", () => {
  const r = copyOf("acceptance/tree");
  try {
    const tmpBefore = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith("morph-tree-")).length;
    const got = treeCheck(r.root, { card: "k4", exports: [], config: { name: "z.cfg", text: "hello" }, stubs: {},
      command: 'cat probe/k4/z.cfg; echo "[$HOME][$ZQ]"; exit 3' }, { PATH: process.env.PATH ?? "", ZQ: "zq" }, 60000);
    expect(got).toStrictEqual({ exit: 3, timedOut: false, output: "hello\n[][zq]\n" });
    expect(fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith("morph-tree-")).length <= tmpBefore).toBe(true);
  } finally { r.rm(); }
}, 120000);

test("row: blank, '#' and indented lines skipped; a line is trimmed before matching", () => {
  expect(findBreaks("\n# x.go:1:1: no\n\tq.go:2:2: tab\n  k.go:3:3: indented\nz.go:4:4: kept   \nown.go:5:5: mine\n", GO_LINE, ["own.go"])).toStrictEqual(["z.go:4:4: kept"]);
});
