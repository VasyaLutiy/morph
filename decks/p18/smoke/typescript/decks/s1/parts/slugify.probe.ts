// Smoke probe for slugify: one test per record example of Slugify.
import { test, expect } from "vitest";
import { slugify } from "../../src/text/slugify.js";

test("Slugify example 1", () => { expect(slugify("Hello, World!")).toBe("hello-world"); });
test("Slugify example 2", () => { expect(slugify("  Morph -- Cards 2  ")).toBe("morph-cards-2"); });
test("Slugify example 3", () => { expect(slugify("!!!")).toBe(""); });
