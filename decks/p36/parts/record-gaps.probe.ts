// P36 probe for record-gaps (src/primerRecord/recordGaps.ts): the record's Record Gaps examples 1-3 at the values of
// tests/fixtures/primerRecord/examples.json.
import { expect, test } from "vitest";
import { loadContour, loadMap } from "../../src/contour/load.js";
import { TYPESCRIPT } from "../../src/language/profiles.js";
import { codeFiles, componentWeights, recordGaps } from "../../src/primerRecord/recordGaps.js";
import type { ComponentWeight, RecordGaps } from "../../src/primerRecord/recordGaps.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";

const EX = fixtureJson("primerRecord/examples.json") as Record<string, { given: unknown; then: unknown }>;

test("Record Gaps example 1: the fixture project's gaps", () => {
  const text = fixture("primerRecord/repo/contour.yaml");
  const r = loadContour(text, "contour.yaml");
  const m = loadMap(fixture("primerRecord/repo/morph-map.json"), "morph-map.json");
  if (!r.ok || !m.ok) throw new Error("fixture does not load");
  const g = EX["Record Gaps 1"].given as { files: string[]; owned: string[] };
  const got = recordGaps({ record: r.record, map: m.map, recordText: text, loaderWarnings: r.warnings ?? [],
    files: g.files, profile: TYPESCRIPT, owned: g.owned });
  expect(got).toStrictEqual(EX["Record Gaps 1"].then as RecordGaps);
});

test("Record Gaps example 2: codeFiles keeps src/a.ts, src/b.ts, src/c.tsx, src/vendor.ts", () => {
  const g = EX["Record Gaps 2"].given as { files: string[] };
  expect(codeFiles(TYPESCRIPT, g.files)).toStrictEqual(EX["Record Gaps 2"].then as string[]);
});

test("Record Gaps example 3: componentWeights a 44, é 37, b 36; no groups line → []", () => {
  const g = EX["Record Gaps 3"].given as { texts: string[] };
  const then = EX["Record Gaps 3"].then as ComponentWeight[][];
  expect(componentWeights(g.texts[0] ?? "")).toStrictEqual(then[0]);
  expect(componentWeights(g.texts[1] ?? "")).toStrictEqual(then[1]);
});
