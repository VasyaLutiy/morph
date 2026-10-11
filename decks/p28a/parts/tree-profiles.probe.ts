// P28a probe for tree-profiles by docs/TASK_P28a_neighbour.md §2.2 (src/language/treeProfiles.ts) — issue #22 M2:
// per language, which targets a kept file can use names of. Record Tree Profiles examples 5–6.
// NEIGHBOUR_RULES is read through the module namespace, so the probe compiles on main (the stub has no NEIGHBOUR_RULES).
import { test, expect } from "vitest";
import * as profiles from "../../src/language/treeProfiles.js";

interface Entry { id: string; file: string; directory: boolean; testFile: string | null; module: string | null }
const rules = (): Entry[] => {
  const value = (profiles as unknown as Record<string, unknown>).NEIGHBOUR_RULES;
  if (!Array.isArray(value)) throw new Error("NEIGHBOUR_RULES is not exported");
  return value as Entry[];
};

const EXPECTED: Entry[] = [
  { id: "typescript", file: "\\.[cm]?tsx?$", directory: false, testFile: null, module: "'\"?(\\.\\.?/[^'\"]+)\"?'" },
  { id: "python", file: "\\.pyi?$", directory: false, testFile: null, module: null },
  { id: "go", file: "\\.go$", directory: true, testFile: "_test\\.go$", module: null },
];

test("Tree Profiles example 5: NEIGHBOUR_RULES holds the three entries, in PROFILES order, every value as the record writes it", () => {
  expect(rules()).toStrictEqual(EXPECTED);
});

test("Tree Profiles example 6: each file pattern claims its own kept files; go's testFile; typescript's module reads the quoted specifier", () => {
  const got = rules();
  const byId = (id: string): Entry => {
    const entry = got.find((e) => e.id === id);
    if (entry === undefined) throw new Error("no entry " + id);
    return entry;
  };
  const paths = ["src/b.ts", "src/cli/c.mts", "calc/b.go", "calc/b_test.go", "pkg/b.py", "README.md"];
  const claims: Record<string, string[]> = {};
  for (const id of ["typescript", "python", "go"]) claims[id] = paths.filter((p) => new RegExp(byId(id).file).test(p));
  const testFile = byId("go").testFile ?? "(null)";
  const module = byId("typescript").module ?? "(null)";
  const lines = [
    `(1,10): error TS2305: Module '"./a.js"' has no exported member 'fmtOut'.`,
    "(1,1): error TS2307: Cannot find module '../units/gone.js' or its corresponding type declarations.",
    "(3,4): error TS2304: Cannot find name 'q7'.",
  ];
  expect({
    claims,
    testFile: [new RegExp(testFile).test("calc/b_test.go"), new RegExp(testFile).test("calc/b.go")],
    module: lines.map((line) => [...line.matchAll(new RegExp(module, "g"))].map((m) => m[1])),
  }).toStrictEqual({
    claims: { typescript: ["src/b.ts", "src/cli/c.mts"], python: ["pkg/b.py"], go: ["calc/b.go", "calc/b_test.go"] },
    testFile: [true, false],
    module: [["./a.js"], ["../units/gone.js"], []],
  });
});
