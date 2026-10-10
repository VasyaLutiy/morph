// P24c probe for tree-profiles by docs/TASK_P24c_blame.md §2.2 (src/language/treeProfiles.ts) — issue #19 item 1:
// the per-language patterns of a failing test's lines. Record Tree Profiles examples 3–4.
// TEST_LINES is read through the module namespace, so the probe compiles on main (the stub has no TEST_LINES).
import { test, expect } from "vitest";
import * as profiles from "../../src/language/treeProfiles.js";

interface Entry { id: string; failLine: string | null; locationLine: string | null; packageLine: string | null }
const testLines = (): Entry[] => {
  const value = (profiles as unknown as Record<string, unknown>).TEST_LINES;
  if (!Array.isArray(value)) throw new Error("TEST_LINES is not exported");
  return value as Entry[];
};

const EXPECTED: Entry[] = [
  { id: "typescript", failLine: "^\\s*FAIL\\s+(\\S+?\\.[cm]?[jt]sx?)(?:\\s|$)",
    locationLine: "^\\s+\\u276f\\s+(?:\\S+\\s+)?(\\S+?\\.[cm]?[jt]sx?):\\d+:\\d+", packageLine: null },
  { id: "python", failLine: "^(?:FAILED|ERROR) (\\S+?\\.pyi?)(?:::|\\s|$)", locationLine: null, packageLine: null },
  { id: "go", failLine: null, locationLine: "^\\s+(\\S+?\\.go):\\d+", packageLine: "^FAIL\\t(\\S+)" },
];

test("Tree Profiles example 3: TEST_LINES holds the three entries, in PROFILES order, every string as the record writes it", () => {
  expect(testLines()).toStrictEqual(EXPECTED);
});

test("Tree Profiles example 4: each test pattern reads only its own lines, group 1 the path", () => {
  const lines = [" FAIL  tests/units/len.test.ts > one metre", " ❯ tests/units/len.test.ts:4:21", " ❯ toFeet src/units/len.ts:2:25",
    "FAILED tests/test_calc.py::test_half - assert 2 == 4", "    daemon_examples_test.go:16: OnExit:",
    "\t/tmp/morphlite/daemon/daemon_examples_test.go:22 +0x2", "FAIL\tmorphlite/daemon\t0.004s", "FAIL",
    "--- FAIL: TestDaemonCoreExample2 (0.00s)"];
  const got: Record<string, (string | null)[]> = {};
  for (const entry of testLines()) {
    for (const key of ["failLine", "locationLine", "packageLine"] as const) {
      const source = entry[key];
      if (source === null) continue;
      got[entry.id + " " + key] = lines.map((line) => {
        const m = new RegExp(source).exec(line);
        return m === null ? null : (m[1] ?? null);
      });
    }
  }
  const n = null;
  expect(got).toStrictEqual({
    "typescript failLine": ["tests/units/len.test.ts", n, n, n, n, n, n, n, n],
    "typescript locationLine": [n, "tests/units/len.test.ts", "src/units/len.ts", n, n, n, n, n, n],
    "python failLine": [n, n, n, "tests/test_calc.py", n, n, n, n, n],
    "go locationLine": [n, n, n, n, "daemon_examples_test.go", "/tmp/morphlite/daemon/daemon_examples_test.go", n, n, n],
    "go packageLine": [n, n, n, n, n, n, "morphlite/daemon", n, n],
  });
});
