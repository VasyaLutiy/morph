// P11 smoke probe for sign-of: one test per Contour example of Sign Of.
import { test, expect } from "vitest";
import { signOf } from "../../src/calc/signOf.js";

test("Sign Of example 1: negative gives -1", () => { expect(signOf(-7.5)).toBe(-1); });
test("Sign Of example 2: zero gives 0", () => { expect(signOf(0)).toBe(0); });
test("Sign Of example 3: positive gives 1", () => { expect(signOf(42)).toBe(1); });
