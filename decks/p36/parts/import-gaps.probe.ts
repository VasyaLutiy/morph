// P36 probe for import-gaps (src/primerRecord/importGaps.ts): the record's Import Gaps examples 1-3.
import { expect, test } from "vitest";
import { importGaps } from "../../src/primerRecord/importGaps.js";
import type { CodeText, LayerGap } from "../../src/primerRecord/importGaps.js";
import { fixtureJson } from "../../tests/helpers.js";

type Given = { language: string; module: string; files: CodeText[]; edges: Record<string, string[]> };
const EX = fixtureJson("primerRecord/examples.json") as Record<string, { given: unknown; then: unknown }>;
const run = (g: Given): LayerGap[] => importGaps(g.language, g.module, g.files, g.edges);

test("Import Gaps example 1: typescript gaps src/a → src/c, src/a → src/d, src/b → src/a", () => {
  expect(run(EX["Import Gaps 1"].given as Given)).toStrictEqual(EX["Import Gaps 1"].then as LayerGap[]);
});

test("Import Gaps example 2: go gaps internal/a → internal/b, internal/b → internal/a", () => {
  expect(run(EX["Import Gaps 2"].given as Given)).toStrictEqual(EX["Import Gaps 2"].then as LayerGap[]);
});

test("Import Gaps example 3: python → []; go with module \"\" → []", () => {
  const g = EX["Import Gaps 3"].given as Given[];
  expect(run(g[0] as Given)).toStrictEqual([]);
  expect(run(g[1] as Given)).toStrictEqual([]);
});
