// P21 probe for read-go-tree by docs/TASK_P21a_breaking.md §2.2 (src/cli/goTree.ts) — the Go files of a module and the
// module's own packages each imports (issue #12). Record Read Go Tree examples 1-3, then rows. Tmp roots, removed in finally.
import { test, expect } from "vitest";
import { readGoTree } from "../../src/cli/goTree.js";
import { fixture, fixtureJson, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

function rootOf(files: Record<string, string>): TmpRoot {
  const r = tmpRoot();
  for (const [p, t] of Object.entries(files)) r.write(p, t);
  return r;
}
const P7B1 = ["contour.yaml", "morph-map.json", "go.mod", "internal/testhelp/testhelp.go", "decks/b1/checks.json",
  "decks/b1/parts/_phase-loop_probe_test.go", "control/control.go", "control/control_examples_test.go", "supervisor/loop.go",
  "supervisor/guard.go", "supervisor/loop_examples_test.go", "supervisor/guard_examples_test.go", "daemon/daemon.go",
  "daemon/daemon_examples_test.go", "mcp/session.go"];

test("Read Go Tree example 1: the go-p7b module", () => {
  const r = rootOf(Object.fromEntries(P7B1.map((f) => [f, fixture("go-p7b/" + f)])));
  try {
    expect(readGoTree(r.root)).toStrictEqual(fixtureJson("cli/goP7b.tree.json"));
  } finally {
    r.rm();
  }
});

test("Read Go Tree example 2: import forms, skipped directories and files", () => {
  const r = rootOf(fixtureJson("cli/goTree.json") as Record<string, string>);
  try {
    expect(readGoTree(r.root)).toStrictEqual({
      files: ["main.go", "x/x.go", "y/deep/d.go", "y/y.go", "z/z.go", "z/z_test.go"],
      imports: { "main.go": ["x"], "x/x.go": ["y", "z", "."], "y/deep/d.go": [], "y/y.go": ["y/deep"], "z/z.go": [], "z/z_test.go": ["x"] },
    });
  } finally {
    r.rm();
  }
});

test("Read Go Tree example 3: no go.mod, no own imports", () => {
  const r = rootOf({ "a/a.go": 'package a\n\nimport "brk/calc"\n', "b.go": "package b\n" });
  try {
    expect(readGoTree(r.root)).toStrictEqual({ files: ["a/a.go", "b.go"], imports: { "a/a.go": [], "b.go": [] } });
  } finally {
    r.rm();
  }
});

test("row: sort order, a nested vendor, a module without imports, a symlinked directory, an empty root", () => {
  const r = rootOf({
    "go.mod": "module q.io/w/v2\n",
    "b/z.go": 'package b\n\nimport (\n\t"q.io/w/v2/a"\n\t"q.io/w/v2/a"\n\t"q.io/w/v2"\n)\n',
    "B/c.go": "package B\n",
    "b.go": "package w\n",
    "a/a.go": 'package a\n\nimport _ "q.io/w"\n',
    "a/vendor/v.go": "package v\n",
    "a/b/testdata/x.go": "package x\n",
    "a/b/c.go": 'package c\nimport . "q.io/w/v2/b"\n',
  });
  const e = tmpRoot();
  try {
    r.write("b/notes.md", "x\n");
    expect(readGoTree(r.root)).toStrictEqual({
      files: ["B/c.go", "a/a.go", "a/b/c.go", "b.go", "b/z.go"],
      imports: { "B/c.go": [], "a/a.go": [], "a/b/c.go": ["b"], "b.go": [], "b/z.go": ["a", "."] },
    });
    expect(readGoTree(e.root)).toStrictEqual({ files: [], imports: {} });
  } finally {
    r.rm();
    e.rm();
  }
});
