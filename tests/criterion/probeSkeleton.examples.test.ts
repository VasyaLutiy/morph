import { expect, test } from "vitest";
import { checkProbeNames, probeTitles } from "../../src/criterion/probeNames.js";
import { probeSkeleton } from "../../src/criterion/probeSkeleton.js";
import { GO, TYPESCRIPT } from "../../src/language/profiles.js";
import { fixture, fixtureJson } from "../helpers.js";
import type { Example } from "../../src/contour/types.js";

test("Probe Skeleton example 1: the TypeScript text, its ref line, and the strict name check passes", () => {
  const i1 = fixtureJson("criterion/skeleton1.input.json") as {
    id: string;
    functions: { name: string; examples: Example[] }[];
    targets: string[];
  };
  const text = probeSkeleton({ ...i1, profile: TYPESCRIPT });
  expect(text).toBe(fixture("criterion/skeleton1.probe.ts.txt"));
  const names = checkProbeNames({
    id: "ab",
    path: "decks/p/parts/ab.probe.ts",
    profile: TYPESCRIPT,
    text,
    own: [
      { name: "A B", count: 2 },
      { name: "C", count: 1 },
    ],
    record: [
      { name: "A B", count: 2 },
      { name: "C", count: 1 },
    ],
    strict: true,
  });
  expect(names).toStrictEqual([]);
});

test("Probe Skeleton example 2: the Go text of clamp-value, probeTitles reads 1..4, and the strict name check passes", () => {
  const entry = (
    fixtureJson("criterion/goMini.criteria.json") as {
      "clamp-value": {
        judge: boolean;
        functions: { name: string; examples: Example[] }[];
      };
    }
  )["clamp-value"];
  const text = probeSkeleton({
    id: "clamp-value",
    profile: GO,
    functions: entry.functions,
    targets: ["calc/clamp_value.go"],
  });
  expect(text).toBe(fixture("criterion/skeleton2.probe.go.txt"));
  expect(probeTitles(GO, text, ["Clamp Value"])).toStrictEqual([
    { function: "Clamp Value", n: 1 },
    { function: "Clamp Value", n: 2 },
    { function: "Clamp Value", n: 3 },
    { function: "Clamp Value", n: 4 },
  ]);
  const names = checkProbeNames({
    id: "clamp-value",
    path: "decks/m1/parts/_clamp-value_probe_test.go",
    profile: GO,
    text,
    own: [{ name: "Clamp Value", count: 4 }],
    record: [
      { name: "Clamp Value", count: 4 },
      { name: "Percent Of", count: 5 },
      { name: "Format Share", count: 3 },
    ],
    strict: true,
  });
  expect(names).toStrictEqual([]);
});

test("Probe Skeleton example 3: no example in any Function gives the one own-test probe, TypeScript and Go", () => {
  expect(
    probeSkeleton({
      id: "notes",
      profile: TYPESCRIPT,
      functions: [],
      targets: ["docs/NOTES.md"],
    }),
  ).toBe(
    "// Probe of card 'notes', written by morph plan --write-probes: one test per example of its Functions.\n" +
      "// Write each body from its example; until you do, it fails.\n" +
      "import { expect, test } from \"vitest\";\n" +
      "\n" +
      "test(\"notes probe\", () => {\n" +
      "  // the record gives no example: write the probe's own tests\n" +
      "  throw new Error(\"probe notes: no record example\");\n" +
      "});\n",
  );

  expect(
    probeSkeleton({
      id: "m",
      profile: GO,
      functions: [{ name: "Main", examples: [] }],
      targets: ["main.go"],
    }),
  ).toBe(
    "package main\n" +
      "\n" +
      "// Probe of card 'm', written by morph plan --write-probes: one test per example of its Functions.\n" +
      "// Write each body from its example; until you do, it fails.\n" +
      "\n" +
      "import \"testing\"\n" +
      "\n" +
      "func TestProbeOwn(t *testing.T) {\n" +
      "\t// the record gives no example: write the probe's own tests\n" +
      "\tt.Fatal(\"probe m: no record example\")\n" +
      "}\n",
  );

  expect(
    probeSkeleton({
      id: "x",
      profile: GO,
      functions: [],
      targets: ["a/b/c_test.go", "a/b/c.go"],
    }),
  ).toBe(
    "package b\n" +
      "\n" +
      "// Probe of card 'x', written by morph plan --write-probes: one test per example of its Functions.\n" +
      "// Write each body from its example; until you do, it fails.\n" +
      "\n" +
      "import \"testing\"\n" +
      "\n" +
      "func TestProbeOwn(t *testing.T) {\n" +
      "\t// the record gives no example: write the probe's own tests\n" +
      "\tt.Fatal(\"probe x: no record example\")\n" +
      "}\n",
  );

  expect(
    probeSkeleton({
      id: "y",
      profile: GO,
      functions: [],
      targets: [],
    }),
  ).toBe(
    "package main\n" +
      "\n" +
      "// Probe of card 'y', written by morph plan --write-probes: one test per example of its Functions.\n" +
      "// Write each body from its example; until you do, it fails.\n" +
      "\n" +
      "import \"testing\"\n" +
      "\n" +
      "func TestProbeOwn(t *testing.T) {\n" +
      "\t// the record gives no example: write the probe's own tests\n" +
      "\tt.Fatal(\"probe y: no record example\")\n" +
      "}\n",
  );
});
