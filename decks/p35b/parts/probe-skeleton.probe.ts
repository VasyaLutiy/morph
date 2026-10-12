// P35b probe for probe-skeleton by docs/TASK_P35b_probes.md §2.2 (src/criterion/probeSkeleton.ts) — issue #45: the
// probe skeleton of a code card from its Functions' examples. A new file: every row red on the stub.
import { test, expect } from "vitest";
import { probeSkeleton } from "../../src/criterion/probeSkeleton.js";
import { checkProbeNames, probeTitles } from "../../src/criterion/probeNames.js";
import { GO, TYPESCRIPT } from "../../src/language/profiles.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";
import type { Example } from "../../src/contour/types.js";

type Fn = { name: string; examples: Example[] };

test("Probe Skeleton example 1: the typescript text, a ref line, whitespace collapsed", () => {
  const i1 = fixtureJson("criterion/skeleton1.input.json") as { id: string; functions: Fn[]; targets: string[] };
  const text = probeSkeleton({ ...i1, profile: TYPESCRIPT });
  expect(text).toBe(fixture("criterion/skeleton1.probe.ts.txt"));
  const counts = [{ name: "A B", count: 2 }, { name: "C", count: 1 }];
  expect(
    checkProbeNames({ id: "ab", path: "decks/p/parts/ab.probe.ts", profile: TYPESCRIPT, text, own: counts, record: counts, strict: true }),
  ).toStrictEqual([]);
});

test("Probe Skeleton example 2: the go text of go-mini's clamp-value reads back", () => {
  const crit = fixtureJson("criterion/goMini.criteria.json") as Record<string, { judge: boolean; functions: Fn[] }>;
  const text = probeSkeleton({ id: "clamp-value", profile: GO, functions: crit["clamp-value"].functions, targets: ["calc/clamp_value.go"] });
  expect(text).toBe(fixture("criterion/skeleton2.probe.go.txt"));
  expect(probeTitles(GO, text, ["Clamp Value"])).toStrictEqual([
    { function: "Clamp Value", n: 1 },
    { function: "Clamp Value", n: 2 },
    { function: "Clamp Value", n: 3 },
    { function: "Clamp Value", n: 4 },
  ]);
  expect(
    checkProbeNames({
      id: "clamp-value", path: "decks/m1/parts/_clamp-value_probe_test.go", profile: GO, text,
      own: [{ name: "Clamp Value", count: 4 }],
      record: [{ name: "Clamp Value", count: 4 }, { name: "Percent Of", count: 5 }, { name: "Format Share", count: 3 }],
      strict: true,
    }),
  ).toStrictEqual([]);
});

const C1 = (id: string): string =>
  "// Probe of card '" + id + "', written by morph plan --write-probes: one test per example of its Functions.\n" +
  "// Write each body from its example; until you do, it fails.\n";
const GO_OWN = (pkg: string, id: string): string =>
  "package " + pkg + "\n\n" + C1(id) + "\nimport \"testing\"\n\nfunc TestProbeOwn(t *testing.T) {\n" +
  "\t// the record gives no example: write the probe's own tests\n\tt.Fatal(\"probe " + id + ": no record example\")\n}\n";

test("Probe Skeleton example 3: no example, typescript", () => {
  expect(probeSkeleton({ id: "notes", profile: TYPESCRIPT, functions: [], targets: ["docs/NOTES.md"] })).toBe(
    C1("notes") + "import { expect, test } from \"vitest\";\n\ntest(\"notes probe\", () => {\n" +
      "  // the record gives no example: write the probe's own tests\n  throw new Error(\"probe notes: no record example\");\n});\n",
  );
});

test("Probe Skeleton example 3: no example, go package main for a root file", () => {
  expect(probeSkeleton({ id: "m", profile: GO, functions: [{ name: "Main", examples: [] }], targets: ["main.go"] })).toBe(GO_OWN("main", "m"));
});

test("Probe Skeleton example 3: no example, go package of the code target, the test target skipped", () => {
  expect(probeSkeleton({ id: "x", profile: GO, functions: [], targets: ["a/b/c_test.go", "a/b/c.go"] })).toBe(GO_OWN("b", "x"));
});

test("Probe Skeleton example 3: no example, go without a target is package main", () => {
  expect(probeSkeleton({ id: "y", profile: GO, functions: [], targets: [] })).toBe(GO_OWN("main", "y"));
});
