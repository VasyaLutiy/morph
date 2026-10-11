import { expect, test } from "vitest";
import { TREE_PROFILES, treeProfileFor } from "../../src/language/treeProfiles.js";
import type { TreeProfile } from "../../src/language/treeProfiles.js";
import { PROFILES } from "../../src/language/profiles.js";

const groups = (pattern: string, line: string): string[] | null => {
  const match = new RegExp(pattern).exec(line);
  if (match === null) {
    return null;
  }
  return [match[1] ?? "", match[2] ?? ""];
};

const profile = (id: string): TreeProfile => {
  const found = treeProfileFor(id);
  if (found === null) {
    throw new Error("no tree profile for " + id);
  }
  return found;
};

test("Tree Profiles example 1: treeProfileFor returns the three entries, in PROFILES order, then null", () => {
  expect(treeProfileFor("typescript")).toStrictEqual({
    id: "typescript",
    fileLine: "^(\\S+?\\.tsx?)(\\(\\d+,\\d+\\).*)$",
    config: "tsconfig.card.json",
    command: "node_modules/.bin/tsc --noEmit -p {config}",
  });
  expect(treeProfileFor("python")).toStrictEqual({
    id: "python",
    fileLine: "^(\\S+?\\.pyi?)(:\\d+.*)$",
    config: null,
    command: null,
  });
  expect(treeProfileFor("go")).toStrictEqual({
    id: "go",
    fileLine: "^(?:vet: )?(?:\\./)?(\\S+?\\.go)(:\\d+.*)$",
    config: "full.json",
    command: "go build -overlay {config} ./... ; go vet -overlay {config} ./...",
  });
  expect(TREE_PROFILES.map((entry) => entry.id)).toStrictEqual(PROFILES.map((entry) => entry.id));
  expect(treeProfileFor("rust")).toBe(null);
});

test("Tree Profiles example 2: each fileLine reads only the lines of its own language", () => {
  const ts = profile("typescript");
  const py = profile("python");
  const go = profile("go");
  const tsLine = "src/a/b.ts(12,5): error TS2304: x";
  const vetLine = "vet: ./pkg/q.go:3:7: y";
  const goLine = "pkg/q.go:3: z";
  const pyLine = "tests/test_a.py:9: AssertionError";
  const indented = " src/a.ts(1,1): continuation";

  expect(groups(ts.fileLine, tsLine)).toStrictEqual(["src/a/b.ts", "(12,5): error TS2304: x"]);
  expect(groups(ts.fileLine, vetLine)).toBe(null);
  expect(groups(ts.fileLine, goLine)).toBe(null);
  expect(groups(ts.fileLine, pyLine)).toBe(null);
  expect(groups(ts.fileLine, indented)).toBe(null);

  expect(groups(go.fileLine, vetLine)).toStrictEqual(["pkg/q.go", ":3:7: y"]);
  expect(groups(go.fileLine, goLine)).toStrictEqual(["pkg/q.go", ":3: z"]);
  expect(groups(go.fileLine, tsLine)).toBe(null);
  expect(groups(go.fileLine, pyLine)).toBe(null);
  expect(groups(go.fileLine, indented)).toBe(null);

  expect(groups(py.fileLine, pyLine)).toStrictEqual(["tests/test_a.py", ":9: AssertionError"]);
  expect(groups(py.fileLine, tsLine)).toBe(null);
  expect(groups(py.fileLine, vetLine)).toBe(null);
  expect(groups(py.fileLine, goLine)).toBe(null);
  expect(groups(py.fileLine, indented)).toBe(null);
});

test("TREE_PROFILES is the whole table of the record", () => {
  expect(TREE_PROFILES).toStrictEqual([
    {
      id: "typescript",
      fileLine: "^(\\S+?\\.tsx?)(\\(\\d+,\\d+\\).*)$",
      config: "tsconfig.card.json",
      command: "node_modules/.bin/tsc --noEmit -p {config}",
    },
    {
      id: "python",
      fileLine: "^(\\S+?\\.pyi?)(:\\d+.*)$",
      config: null,
      command: null,
    },
    {
      id: "go",
      fileLine: "^(?:vet: )?(?:\\./)?(\\S+?\\.go)(:\\d+.*)$",
      config: "full.json",
      command: "go build -overlay {config} ./... ; go vet -overlay {config} ./...",
    },
  ]);
});

test("treeProfileFor returns the very entry of TREE_PROFILES and null for anything else", () => {
  for (const entry of TREE_PROFILES) {
    expect(treeProfileFor(entry.id)).toBe(entry);
  }
  expect(treeProfileFor("")).toBe(null);
  expect(treeProfileFor("Go")).toBe(null);
  expect(treeProfileFor("TypeScript")).toBe(null);
});

test("only a profile with a config names one in its command", () => {
  for (const entry of TREE_PROFILES) {
    if (entry.config === null) {
      expect(entry.command).toBe(null);
    } else {
      expect(entry.command?.includes("{config}")).toBe(true);
    }
  }
});

test("a line that names no position after its file is no break", () => {
  expect(groups(profile("typescript").fileLine, "src/a.ts")).toBe(null);
  expect(groups(profile("typescript").fileLine, "src/a.ts:12:5: y")).toBe(null);
  expect(groups(profile("go").fileLine, "pkg/q.go")).toBe(null);
  expect(groups(profile("python").fileLine, "tests/test_a")).toBe(null);
});
