// P34a probe for load-spec by docs/TASK_P34a_contour.md §2.2 (src/contour/load.ts) — issue #44: loadContour passes
// Validate Record's warnings on, only when there are some. Record Component contour, Load Spec example 5.
import { test, expect } from "vitest";
import { loadContour } from "../../src/contour/load.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";

test("Load Spec example 5: contourKeys.json gives the typed record and its 10 warnings", () => {
  expect(loadContour(fixture("contour/contourKeys.json"), "contourKeys.json")).toStrictEqual({
    ok: true,
    record: fixtureJson("contour/contourKeys.typed.json"),
    warnings: fixtureJson("contour/contourKeys.warnings.json"),
  });
});

test("Load Spec example 5: this repository's own record loads with no warnings key", () => {
  const own = loadContour(fixture("../../contour.yaml"), "contour.yaml");
  expect(own.ok).toBe(true);
  expect("warnings" in own).toBe(false);
});
