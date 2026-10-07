// P10b2 smoke probe for clamp-value: one test per Contour example of Clamp Value.
import { test, expect } from "vitest";
import { clampValue } from "../../src/calc/clampValue.js";

test("Clamp Value example 1: inside the range stays", () => { expect(clampValue(5, 0, 10)).toBe(5); });
test("Clamp Value example 2: below lo gives lo", () => { expect(clampValue(-3, 0, 10)).toBe(0); });
test("Clamp Value example 3: above hi gives hi", () => { expect(clampValue(42, 0, 10)).toBe(10); });
