// P10b2 smoke probe for clamp-percent: one test per Contour example of Clamp Percent, and the call of clampValue.
import fs from "node:fs";
import { test, expect } from "vitest";
import { clampPercent } from "../../src/calc/clampPercent.js";

test("Clamp Percent example 1: rounds inside the range", () => { expect(clampPercent(42.4)).toBe(42); });
test("Clamp Percent example 2: above 100 gives 100", () => { expect(clampPercent(150)).toBe(100); });
test("Clamp Percent example 3: below 0 gives 0", () => { expect(clampPercent(-7.6)).toBe(0); });
test("Clamp Percent calls Clamp Value: imports ./clampValue.js", () => {
  const text = fs.readFileSync(new URL("../../src/calc/clampPercent.ts", import.meta.url), "utf8");
  expect(text).toMatch(/from "\.\/clampValue\.js"/);
});
