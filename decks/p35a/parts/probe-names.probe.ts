// P35a probe for probe-names by docs/TASK_P35a_criterion.md §2.2 (src/criterion/probeNames.ts) — issue #45: the
// example titles of a probe against the record's examples. A new file: every row red on the stub.
import { test, expect } from "vitest";
import { checkProbeNames, pascalName, probeTitles } from "../../src/criterion/probeNames.js";
import { GO, TYPESCRIPT } from "../../src/language/profiles.js";
import { fixture } from "../../tests/helpers.js";

const P = "decks/m1/parts/clamp-value.probe.ts";
const GP = "decks/m1/parts/_percent-of_probe_test.go";
const T2 = (): string => fixture("criterion/titles2.ts.txt");

test("Probe Names example 1: typescript titles, a split example counts once", () => {
  const t1 = fixture("criterion/titles1.ts.txt");
  expect(probeTitles(TYPESCRIPT, t1, ["Clamp Value", "Percent Of"])).toStrictEqual([
    { function: "Clamp Value", n: 1 },
    { function: "Clamp Value", n: 2 },
    { function: "Clamp Value", n: 2 },
    { function: "Clamp Value", n: 3 },
  ]);
  expect(
    checkProbeNames({
      id: "clamp-value", path: P, profile: TYPESCRIPT, text: t1,
      own: [{ name: "Clamp Value", count: 3 }],
      record: [{ name: "Clamp Value", count: 3 }, { name: "Percent Of", count: 5 }],
      strict: true,
    }),
  ).toStrictEqual([]);
});

test("Probe Names example 2: strict, lacks and names lines", () => {
  expect(
    checkProbeNames({
      id: "clamp-value", path: P, profile: TYPESCRIPT, text: T2(),
      own: [{ name: "Clamp Value", count: 4 }],
      record: [{ name: "Clamp Value", count: 4 }, { name: "Percent Of", count: 5 }],
      strict: true,
    }),
  ).toStrictEqual([
    "card 'clamp-value': probe " + P + " lacks Clamp Value example 3, 4 (the record gives 4)",
    "card 'clamp-value': probe " + P + " names Clamp Value example 5, not an example of its Functions (Clamp Value)",
    "card 'clamp-value': probe " + P + " names Percent Of example 1, not an example of its Functions (Clamp Value)",
    "card 'clamp-value': probe " + P + " names Add Tax example 1, not an example of its Functions (Clamp Value)",
  ]);
});

test("Probe Names example 3: not strict, only what the record does not give", () => {
  const base = {
    id: "clamp-value", path: P, profile: TYPESCRIPT, text: T2(),
    own: [{ name: "Clamp Value", count: 4 }],
    record: [{ name: "Clamp Value", count: 4 }, { name: "Percent Of", count: 5 }],
  };
  expect(checkProbeNames({ ...base, strict: false })).toStrictEqual([
    "card 'clamp-value': probe " + P + " names Clamp Value example 5, which the record does not give",
    "card 'clamp-value': probe " + P + " names Add Tax example 1, which the record does not give",
  ]);
  expect(checkProbeNames({ ...base, own: [], strict: true })).toStrictEqual([
    "card 'clamp-value': probe " + P + " names Clamp Value example 1, 2, 5, not an example of its Functions (none)",
    "card 'clamp-value': probe " + P + " names Percent Of example 1, not an example of its Functions (none)",
    "card 'clamp-value': probe " + P + " names Add Tax example 1, not an example of its Functions (none)",
  ]);
});

test("Probe Names example 4: pascalName and the go titles", () => {
  expect([pascalName("Percent Of"), pascalName("MCP mount"), pascalName("go-p7b phase loop")]).toStrictEqual([
    "PercentOf", "McpMount", "GoP7bPhaseLoop",
  ]);
  const g = fixture("go-mini/decks/m1/parts/_percent-of_probe_test.go");
  expect(probeTitles(GO, g, ["Clamp Value", "Percent Of", "Format Share"])).toStrictEqual(
    [1, 2, 3, 4, 5].map((n) => ({ function: "Percent Of", n })),
  );
  const record = [{ name: "Clamp Value", count: 4 }, { name: "Percent Of", count: 5 }, { name: "Format Share", count: 3 }];
  const base = { id: "percent-of", path: GP, profile: GO, text: g, record };
  expect(checkProbeNames({ ...base, own: [{ name: "Percent Of", count: 5 }], strict: true })).toStrictEqual([]);
  expect(checkProbeNames({ ...base, own: [{ name: "Percent Of", count: 6 }], strict: true })).toStrictEqual([
    "card 'percent-of': probe " + GP + " lacks Percent Of example 6 (the record gives 6)",
  ]);
  expect(
    checkProbeNames({
      ...base, text: g + "func TestProbeNoSuchExample2(t *testing.T) {}\n",
      own: [{ name: "Percent Of", count: 5 }], strict: false,
    }),
  ).toStrictEqual(["card 'percent-of': probe " + GP + " names NoSuch example 2, which the record does not give"]);
});
