// P24c probe for transaction-deck by docs/TASK_P24c_blame.md §2.2 (src/cards/transaction.ts) — issue #19 items 1–2:
// a failing test's location line blames the owner of its file; a red no card owns blames no card.
// Record Blame Log examples 5–8. The test patterns are the record's Tree Profiles TEST_LINES, written here as literals,
// so the probe does not depend on the tree-profiles card.
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
const on = (paths: string[]) => (p: string): boolean => paths.includes(p);
// the sixth argument goes through a loose call so the probe compiles on main's five-parameter blameLog (the stub)
const blame6 = blameLog as unknown as (log: string, card: string, owners: Record<string, string>, fileLines: readonly string[],
  exists: (p: string) => boolean, testLines?: readonly unknown[]) => { cards: string[]; outside: string[] };

const O5: Record<string, string> = { "control/control.go": "cc", "daemon/daemon.go": "dc", "daemon/daemon_examples_test.go": "dcj",
  "supervisor/guard.go": "rg", "supervisor/guard_examples_test.go": "rgj" };
const FIVE = Object.keys(O5);
const O3: Record<string, string> = { "control/control.go": "cc", "daemon/daemon.go": "dc", "supervisor/guard.go": "rg" };

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
