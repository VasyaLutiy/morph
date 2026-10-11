import { test, expect } from "vitest";
import { loadContour } from "../../src/contour/load.js";
import { fixture, fixtureJson } from "../helpers.js";

test("Load Spec example 5: contourKeys.json yields a typed record with 10 warnings, and this repository's own contour.yaml loads with no warnings key", () => {
  const loaded = loadContour(fixture("contour/contourKeys.json"), "contourKeys.json");
  expect(loaded).toStrictEqual({
    ok: true,
    record: fixtureJson("contour/contourKeys.typed.json"),
    warnings: fixtureJson("contour/contourKeys.warnings.json"),
  });

  const own = loadContour(fixture("../../contour.yaml"), "contour.yaml");
  expect(own.ok).toBe(true);
  expect("warnings" in own).toBe(false);
});
