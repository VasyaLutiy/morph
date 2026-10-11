// P28a probe for transaction-deck by docs/TASK_P28a_neighbour.md §2.2 (src/cards/transaction.ts) — issue #22 M2:
// a red line naming a kept file of a target's package (Go: its directory; TypeScript: the module it names) blames the
// target's owner, not "outside". Record Blame Log examples 9–10 (new); 5–8 are P24c's rows, green on main by design.
// The test patterns and the neighbour rules are the record's Tree Profiles data, written here as literals, so the probe
// does not depend on the tree-profiles card.
import { test, expect } from "vitest";
import { blameLog } from "../../src/cards/transaction.js";
import { TREE_PROFILES } from "../../src/language/treeProfiles.js";
import { fixtureJson } from "../../tests/helpers.js";

const logs = fixtureJson("cards/blameTestLogs.json") as Record<string, string>;
const FL = TREE_PROFILES.map((p) => p.fileLine);
const TL = [
  { failLine: "^\\s*FAIL\\s+(\\S+?\\.[cm]?[jt]sx?)(?:\\s|$)", locationLine: "^\\s+\\u276f\\s+(?:\\S+\\s+)?(\\S+?\\.[cm]?[jt]sx?):\\d+:\\d+", packageLine: null },
  { failLine: "^(?:FAILED|ERROR) (\\S+?\\.pyi?)(?:::|\\s|$)", locationLine: null, packageLine: null },
  { failLine: null, locationLine: "^\\s+(\\S+?\\.go):\\d+", packageLine: "^FAIL\\t(\\S+)" },
];
const NR = [
  { file: "\\.[cm]?tsx?$", directory: false, testFile: null, module: "'\"?(\\.\\.?/[^'\"]+)\"?'" },
  { file: "\\.pyi?$", directory: false, testFile: null, module: null },
  { file: "\\.go$", directory: true, testFile: "_test\\.go$", module: null },
];
const on = (paths: string[]) => (p: string): boolean => paths.includes(p);
const always = (): boolean => true;
// the sixth and seventh arguments go through a loose call so the probe compiles on main's blameLog (the stub)
const blame7 = blameLog as unknown as (log: string, card: string, owners: Record<string, string>, fileLines: readonly string[],
  exists: (p: string) => boolean, testLines?: readonly unknown[], neighbours?: readonly unknown[]) => { cards: string[]; outside: string[] };
const blame6 = blame7;

const O5: Record<string, string> = { "control/control.go": "cc", "daemon/daemon.go": "dc", "daemon/daemon_examples_test.go": "dcj",
  "supervisor/guard.go": "rg", "supervisor/guard_examples_test.go": "rgj" };
const FIVE = Object.keys(O5);
const O3: Record<string, string> = { "control/control.go": "cc", "daemon/daemon.go": "dc", "supervisor/guard.go": "rg" };


const G1 = "# example.com/m/calc\ncalc/b.go:4:7: undefined: okView\ncalc/b.go:5:9: undefined: fmtOut\n# example.com/m/calc\nvet: calc/b.go:4:7: undefined: okView\n";
const OG: Record<string, string> = { "calc/a.go": "g", "calc/a_examples_test.go": "gj", "pump/flow.go": "p2" };

test("Blame Log example 9: a kept Go file of a target's package blames the package's code owner; another package stays outside", () => {
  expect({
    build: blame7(G1, "g", OG, FL, always, TL, NR),
    keptTest: blame7("calc/b_test.go:7:2: undefined: helperT\n", "g", OG, FL, always, TL, NR),
    otherPackage: blame7("cmd/tool/main.go:6:2: undefined: calc.Sum\n", "g", OG, FL, always, TL, NR),
    beforeP28: blame7(G1, "g", OG, FL, always, TL),
  }).toStrictEqual({
    build: { cards: ["g"], outside: [] },
    keptTest: { cards: ["g", "gj"], outside: [] },
    otherPackage: { cards: [], outside: ["cmd/tool/main.go:6:2: undefined: calc.Sum"] },
    beforeP28: { cards: [], outside: ["calc/b.go:4:7: undefined: okView", "calc/b.go:5:9: undefined: fmtOut"] },
  });
});

const T1 = `src/b.ts(1,10): error TS2305: Module '"./a.js"' has no exported member 'fmtOut'.
src/cli/c.ts(1,10): error TS2305: Module '"../a.js"' has no exported member 'fmtOut'.
`;
const OT: Record<string, string> = { "src/a.ts": "a", "tests/a.examples.test.ts": "aj" };

test("Blame Log example 10: a kept TypeScript file whose tsc line names a target's module blames its owner; no module, no blame", () => {
  expect({
    importers: blame7(T1, "a", OT, FL, always, TL, NR),
    sameDirNoModule: blame7("src/a2.ts(3,4): error TS2304: Cannot find name 'q7'.\n", "a", OT, FL, always, TL, NR),
    otherModule: blame7(`src/b.ts(1,10): error TS2305: Module '"./z.js"' has no exported member 'q'.\n`, "a", OT, FL, always, TL, NR),
    beforeP28: blame7(T1, "a", OT, FL, always, TL),
  }).toStrictEqual({
    importers: { cards: ["a"], outside: [] },
    sameDirNoModule: { cards: [], outside: ["src/a2.ts(3,4): error TS2304: Cannot find name 'q7'."] },
    otherModule: { cards: [], outside: [`src/b.ts(1,10): error TS2305: Module '"./z.js"' has no exported member 'q'.`] },
    beforeP28: { cards: [], outside: [
      `src/b.ts(1,10): error TS2305: Module '"./a.js"' has no exported member 'fmtOut'.`,
      `src/cli/c.ts(1,10): error TS2305: Module '"../a.js"' has no exported member 'fmtOut'.`,
    ] },
  });
});

test("Blame Log example 5: a go test assertion blames the owner of its test file, joined to the package after it", () => {
  expect({
    withTests: blame6(logs.go, "cc", O5, FL, on(FIVE), TL),
    withoutTests: blame6(logs.go, "cc", O5, FL, on(FIVE)),
    unowned: blame6(logs.go, "cc", O3, FL, on(FIVE), TL),
    gone: blame6(logs.go, "cc", O3, FL, () => false, TL),
  }).toStrictEqual({
    withTests: { cards: ["dcj", "rgj"], outside: [] },
    withoutTests: { cards: ["cc"], outside: [] },
    unowned: { cards: [], outside: [] },
    gone: { cards: ["cc"], outside: [] },
  });
});

test("Blame Log example 6: a go panic trace blames by the suffix of its absolute frame; toolchain frames blame nothing", () => {
  expect(blame6(logs.goPanic, "cc", O5, FL, on(FIVE), TL)).toStrictEqual({ cards: ["dcj"], outside: [] });
});

test("Blame Log example 7: vitest FAIL and location lines blame the test file's and the thrower's owners", () => {
  const two = ["src/units/len.ts", "tests/units/len.test.ts"];
  expect({
    owned: blame6(logs.typescript, "rt", { "src/units/len.ts": "lc", "tests/units/len.test.ts": "lj" }, FL, on(two), TL),
    unowned: blame6(logs.typescript, "rt", {}, FL, on(two), TL),
    gone: blame6(logs.typescript, "rt", {}, FL, () => false, TL),
  }).toStrictEqual({
    owned: { cards: ["lc", "lj"], outside: [] },
    unowned: { cards: [], outside: [] },
    gone: { cards: ["rt"], outside: [] },
  });
});

test("Blame Log example 8: pytest's column-0 location and its FAILED line (alone too) blame the test file's owner", () => {
  const two = ["src/calc.py", "tests/test_calc.py"];
  expect({
    owned: blame6(logs.python, "pc", { "src/calc.py": "pc", "tests/test_calc.py": "pj" }, FL, on(two), TL),
    unowned: blame6(logs.python, "pc", { "src/calc.py": "pc" }, FL, on(two), TL),
    failedOnly: blame6("FAILED tests/test_calc.py::test_half - assert 2 == 4\n", "pc", { "src/calc.py": "pc", "tests/test_calc.py": "pj" },
      FL, on(two), TL),
  }).toStrictEqual({
    owned: { cards: ["pj"], outside: [] },
    unowned: { cards: [], outside: ["tests/test_calc.py:5: in test_half"] },
    failedOnly: { cards: ["pj"], outside: [] },
  });
});
