import { expect, test } from "vitest";
import { readGoTree } from "../../src/cli/goTree.js";
import { fixture, fixtureJson, tmpRoot, type TmpRoot } from "../helpers.js";

const P7B1: readonly string[] = [
  "contour.yaml",
  "morph-map.json",
  "go.mod",
  "internal/testhelp/testhelp.go",
  "decks/b1/checks.json",
  "decks/b1/parts/_phase-loop_probe_test.go",
  "control/control.go",
  "control/control_examples_test.go",
  "supervisor/loop.go",
  "supervisor/guard.go",
  "supervisor/loop_examples_test.go",
  "supervisor/guard_examples_test.go",
  "daemon/daemon.go",
  "daemon/daemon_examples_test.go",
  "mcp/session.go",
];

function rootOf(files: Record<string, string>): TmpRoot {
  const root = tmpRoot();
  for (const [p, text] of Object.entries(files)) root.write(p, text);
  return root;
}

function p7b1Files(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const file of P7B1) files[file] = fixture(`go-p7b/${file}`);
  return files;
}

test("Read Go Tree example 1: go-p7b's files under a tmp root", () => {
  const r = rootOf(p7b1Files());
  try {
    expect(readGoTree(r.root)).toStrictEqual(fixtureJson("cli/goP7b.tree.json"));
  } finally {
    r.rm();
  }
});

test("Read Go Tree example 2: the cli/goTree.json root", () => {
  const r = rootOf(fixtureJson("cli/goTree.json") as Record<string, string>);
  try {
    expect(readGoTree(r.root)).toStrictEqual({
      files: ["main.go", "x/x.go", "y/deep/d.go", "y/y.go", "z/z.go", "z/z_test.go"],
      imports: {
        "main.go": ["x"],
        "x/x.go": ["y", "z", "."],
        "y/deep/d.go": [],
        "y/y.go": ["y/deep"],
        "z/z.go": [],
        "z/z_test.go": ["x"],
      },
    });
  } finally {
    r.rm();
  }
});

test("Read Go Tree example 3: no go.mod", () => {
  const r = rootOf({
    "a/a.go": 'package a\n\nimport "brk/calc"\n',
    "b.go": "package b\n",
  });
  try {
    expect(readGoTree(r.root)).toStrictEqual({
      files: ["a/a.go", "b.go"],
      imports: {
        "a/a.go": [],
        "b.go": [],
      },
    });
  } finally {
    r.rm();
  }
});

test("Read Go Tree: no module line in go.mod leaves every import out", () => {
  const r = rootOf({
    "go.mod": "// a comment\n\ngo 1.22\n",
    "a/a.go": 'package a\n\nimport "example.com/m/x"\n',
  });
  try {
    expect(readGoTree(r.root)).toStrictEqual({
      files: ["a/a.go"],
      imports: { "a/a.go": [] },
    });
  } finally {
    r.rm();
  }
});

test("Read Go Tree: an import block ignores comments and stops at a closing line", () => {
  const r = rootOf({
    "go.mod": "module example.com/m\n",
    "a/a.go": 'package a\n\nimport (\n\t"fmt"\n\t"example.com/m/x"\n\t// "example.com/m/y"\n\t"example.com/m/z"\n)\n\nvar _ = fmt.Sprint\n',
    "x/x.go": "package x\n",
    "z/z.go": "package z\n",
  });
  try {
    expect(readGoTree(r.root)).toStrictEqual({
      files: ["a/a.go", "x/x.go", "z/z.go"],
      imports: {
        "a/a.go": ["x", "z"],
        "x/x.go": [],
        "z/z.go": [],
      },
    });
  } finally {
    r.rm();
  }
});

test("Read Go Tree: skips vendor, testdata, dot and underscore entries", () => {
  const r = rootOf({
    "go.mod": "module example.com/m\n",
    "main.go": "package main\n",
    "vendor/v/v.go": "package v\n",
    "x/testdata/t.go": "package t\n",
    ".cache/c.go": "package c\n",
    "_old/o.go": "package o\n",
    "x/_draft.go": "package x\n",
    "x/.swap.go": "package x\n",
    "z/notes.txt": 'import "example.com/m/x"\n',
  });
  try {
    expect(readGoTree(r.root)).toStrictEqual({
      files: ["main.go"],
      imports: { "main.go": [] },
    });
  } finally {
    r.rm();
  }
});

test("Read Go Tree: sorts paths with JavaScript's default sort", () => {
  const r = rootOf({
    "go.mod": "module example.com/m\n",
    "b.go": "package b\n",
    "b/b.go": "package b\n",
    "a/a.go": "package a\n",
  });
  try {
    expect(readGoTree(r.root).files).toStrictEqual(["a/a.go", "b.go", "b/b.go"]);
  } finally {
    r.rm();
  }
});
