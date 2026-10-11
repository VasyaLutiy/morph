// P34a probe for layer-edges by docs/TASK_P34a_contour.md §2.2 (src/rules/layers.ts) — issue #44: Contour's
// Component.dependsOn is a layer edge beside `uses` steps. Record Component rules, Layer Edges example 5; example 1
// unchanged. Needs validate-record (the loader reads dependsOn): on the stubs the fixture is refused.
import { test, expect } from "vitest";
import { layerEdges } from "../../src/rules/layers.js";
import { loadContour, loadMap } from "../../src/contour/load.js";
import { EMPTY_MAP } from "../../src/cli/planCommand.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";

test("Layer Edges example 5: dependsOn gives the edges of the named Components, by name or slug", () => {
  const R = loadContour(fixture("rules/dependsOn.yaml"), "dependsOn.yaml");
  if (!R.ok) throw new Error("fixture: " + R.error);
  expect(layerEdges(R.record, EMPTY_MAP)).toStrictEqual({
    ok: true,
    edges: { "src/app": ["src/store", "src/util"], "src/store": [], "src/util": ["src/store"] },
  });
});

test("Layer Edges example 5: a dependsOn naming no Component is one error", () => {
  const R = loadContour(fixture("rules/dependsOnBad.yaml"), "dependsOnBad.yaml");
  if (!R.ok) throw new Error("fixture: " + R.error);
  expect(layerEdges(R.record, EMPTY_MAP)).toStrictEqual({
    ok: false,
    errors: ["Component 'app': dependsOn 'nope' names no Component of the record"],
  });
});

test("Layer Edges example 1 (unchanged): ts-rename", () => {
  const files = fixtureJson("ts-rename.json") as Record<string, string>;
  const R = loadContour(files["contour.yaml"], "contour.yaml");
  const M = loadMap(files["morph-map.json"], "morph-map.json");
  if (!R.ok || !M.ok) throw new Error("fixture");
  expect(layerEdges(R.record, M.map)).toStrictEqual({ ok: true, edges: { "src/report": ["src/units"], "src/units": [] } });
});
