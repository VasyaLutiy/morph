// P21b probe for vet-tree by docs/TASK_P21b_deckcheck.md §2.2 (src/acceptance/vetTree.ts) — go vet of a whole module
// under an overlay, the lines naming no own file (issue #12 item 3.5). Record Vet Tree examples 1-3, then rows.
import fs from "node:fs";
import { test, expect } from "vitest";
import { vetBreaks, vetTree } from "../../src/acceptance/vetTree.js";
import { fixture, fixturePath, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

function copyOf(name: string): TmpRoot { const r = tmpRoot(); fs.cpSync(fixturePath(name), r.root, { recursive: true }); return r; }
const G = 'export GOFLAGS=-mod=mod GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOWORK=off GOCACHE="${GOCACHE:-/tmp/morph/go-build}" GOPATH="${GOPATH:-/tmp/morph/go}"';
const pathEnv = (): Record<string, string> => ({ PATH: process.env.PATH ?? "" });
function goScript(r: TmpRoot, lines: string[]): Record<string, string> {
  r.write("bin/go", "#!/bin/sh\n" + lines.map((l) => 'echo "' + l + '"\n').join("") + "exit 1\n"); fs.chmodSync(r.path("bin/go"), 0o755);
  return { PATH: r.path("bin") + ":" + (process.env.PATH ?? "") };
}
const OV = { "supervisor/guard_examples_test.go": "", "supervisor/loop.go": "decks/q9/_stubs/supervisor/loop.go",
  "supervisor/loop_examples_test.go": "decks/q9/_stubs/supervisor/loop_examples_test.go" };
const D = "daemon/daemon.go:9:81: not enough arguments in call to d.Loop.Exited", GOL = "go: updates to go.mod needed; to update it:";
const M = "mcp/session.go:6:2: package morphlite/supervisor is not in std";
const GU = "supervisor/guard.go:20:23: l.Resumes undefined (type *Loop has no field or method Resumes)";

test("Vet Tree example 1: own lines and stubs of own targets dropped, a stub named by its target, deduped and sorted", () => {
  const out = fixture("acceptance/vetOutput.txt");
  expect(vetBreaks(out, OV, ["supervisor/loop.go"])).toStrictEqual([D, GOL, M, GU, "supervisor/loop_examples_test.go:5:6: TestStub redeclared in this block"]);
  expect(vetBreaks(out, {}, [])).toStrictEqual([D, "decks/q9/_stubs/supervisor/loop.go:12:2: declared and not used: x",
    "decks/q9/_stubs/supervisor/loop_examples_test.go:5:6: TestStub redeclared in this block", GOL, M, GU, "supervisor/loop.go:30: missing return"]);
});

test("Vet Tree example 2: a stub replaces b/b.go, a/a.go breaks; own a/a.go; no overlay", () => {
  const r = copyOf("acceptance/vet");
  try {
    expect(vetTree(r.root, G, { "b/b.go": "_stubs/b/b.go" }, ["b/b.go"], pathEnv(), 60000)).toStrictEqual({ exit: 1, timedOut: false, breaks: ["a/a.go:6:25: undefined: b.Old"] });
    expect(vetTree(r.root, G, { "b/b.go": "_stubs/b/b.go" }, ["a/a.go", "b/b.go"], pathEnv(), 60000)).toStrictEqual({ exit: 1, timedOut: false, breaks: [] });
    expect(vetTree(r.root, G, {}, ["b/b.go"], pathEnv(), 60000)).toStrictEqual({ exit: 0, timedOut: false, breaks: [] });
  } finally { r.rm(); }
}, 120000);

test("Vet Tree example 3: the env line and env reach the child; a timeout is a break", () => {
  const r = copyOf("acceptance/vet");
  try {
    const env = goScript(r, ["# example.com/fake", "vet: ./x/fake.go:3:1: fake go ran with $GOFLAGS"]);
    expect(vetTree(r.root, "export GOFLAGS=-mod=vendor", {}, [], env, 60000)).toStrictEqual({ exit: 1, timedOut: false, breaks: ["x/fake.go:3:1: fake go ran with -mod=vendor"] });
    const t0 = Date.now();
    expect(vetTree(r.root, "sleep 3", {}, [], pathEnv(), 700)).toStrictEqual({ exit: null, timedOut: true, breaks: ["go vet timed out after 700 ms"] });
    expect(Date.now() - t0 < 3000).toBe(true);
  } finally { r.rm(); }
}, 120000);

test("row: the overlay file holds {Replace: overlay}, run in root, and its directory is removed", () => {
  const r = copyOf("acceptance/vet");
  try {
    const env = goScript(r, []);
    r.write("bin/go", '#!/bin/sh\nf=$3; [ "$2" = "-overlay" ] || f=$2\nprintf "%s|%s|%s\\n" "$(cat "$f" | tr -d "\\n")" "$(pwd)" "$f" > ' + r.path("seen.txt") + "\nexit 0\n");
    const before = fs.readdirSync(r.path(".")).length;
    expect(vetTree(r.root, "true", { "a/a.go": "", "b/b.go": "_stubs/b/b.go" }, [], env, 60000)).toStrictEqual({ exit: 0, timedOut: false, breaks: [] });
    const [json, cwd, file] = r.read("seen.txt").trim().split("|");
    expect([JSON.parse(json), cwd, fs.existsSync(file), fs.readdirSync(r.path(".")).length]).toStrictEqual(
      [{ Replace: { "a/a.go": "", "b/b.go": "_stubs/b/b.go" } }, r.root, false, before + 1]);
  } finally { r.rm(); }
}, 120000);

test("row: a column-less own line and a whitespace-led line are dropped; the first key of a shared stub names it", () => {
  const out = "vet: ./st/x.go:7: bad\n  vet: indented.go:1:1: no\n\tq.go:2:2: tab\nst/x.go:8:1: again\nother.go:1:1: kept\n";
  expect(vetBreaks(out, { "k/a.go": "st/x.go", "k/b.go": "st/x.go" }, ["k/a.go"])).toStrictEqual(["other.go:1:1: kept"]);
  expect(vetBreaks(out, { "k/a.go": "st/x.go", "k/b.go": "st/x.go" }, ["k/b.go"])).toStrictEqual(["k/a.go:7: bad", "k/a.go:8:1: again", "other.go:1:1: kept"]);
});
