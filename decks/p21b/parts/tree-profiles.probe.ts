// P21b probe for tree-profiles by docs/TASK_P21b_deckcheck.md §2.2 (src/language/treeProfiles.ts) — per language, how
// deck check compiles a stub tree and how a file:line line reads (issue #12, comment 6077766447). Record Tree Profiles
// examples 1-2, then a row.
import { test, expect } from "vitest";
import { TREE_PROFILES, treeProfileFor } from "../../src/language/treeProfiles.js";
import { PROFILES } from "../../src/language/profiles.js";

const TS = { id: "typescript", fileLine: "^(\\S+?\\.tsx?)(\\(\\d+,\\d+\\).*)$", config: "tsconfig.card.json", command: "node_modules/.bin/tsc --noEmit -p {config}" };
const PY = { id: "python", fileLine: "^(\\S+?\\.pyi?)(:\\d+.*)$", config: null, command: null };
const GO = { id: "go", fileLine: "^(?:vet: )?(?:\\./)?(\\S+?\\.go)(:\\d+.*)$", config: "full.json", command: "go build -overlay {config} ./... ; go vet -overlay {config} ./..." };

test("Tree Profiles example 1: one entry per profile, in PROFILES order; an unknown id is null", () => {
  expect([treeProfileFor("typescript"), treeProfileFor("python"), treeProfileFor("go"), treeProfileFor("rust")]).toStrictEqual([TS, PY, GO, null]);
  expect(TREE_PROFILES.map((p) => p.id)).toStrictEqual(PROFILES.map((p) => p.id));
});

test("Tree Profiles example 2: each fileLine splits its tool's line into the file and the rest", () => {
  const lines = ["src/a/b.ts(12,5): error TS2304: x", "vet: ./pkg/q.go:3:7: y", "pkg/q.go:3: z", "tests/test_a.py:9: AssertionError", "  src/a.ts(1,1): continuation"];
  const split = (fl: string): (string[] | null)[] => lines.map((l) => { const m = new RegExp(fl).exec(l); return m === null ? null : [m[1], m[2]]; });
  expect(split(TREE_PROFILES[0].fileLine)).toStrictEqual([["src/a/b.ts", "(12,5): error TS2304: x"], null, null, null, null]);
  expect(split(TREE_PROFILES[2].fileLine)).toStrictEqual([null, ["pkg/q.go", ":3:7: y"], ["pkg/q.go", ":3: z"], null, null]);
  expect(split(TREE_PROFILES[1].fileLine)).toStrictEqual([null, null, null, ["tests/test_a.py", ":9: AssertionError"], null]);
});

test("row: the entries are the table's own objects", () => {
  expect([treeProfileFor("go") === TREE_PROFILES[2], treeProfileFor("Go"), treeProfileFor("")]).toStrictEqual([true, null, null]);
});
