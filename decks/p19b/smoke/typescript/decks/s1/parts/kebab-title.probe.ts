import { test, expect } from "vitest";
import { kebabTitle } from "../../src/text/kebabTitle.js";

test("Kebab Title example 1", () => expect(kebabTitle("Hello World")).toBe("hello-world"));
test("Kebab Title example 2", () => expect(kebabTitle("XMLHttpRequest")).toBe("xml-http-request"));
test("Kebab Title example 3", () => expect(kebabTitle("  Morph -- Cards 2 ")).toBe("morph-cards-2"));
test("rows", () => {
  expect(kebabTitle("fooBarBaz")).toBe("foo-bar-baz");
  expect(kebabTitle("version 1.2.3")).toBe("version-1-2-3");
  expect(kebabTitle("")).toBe("");
});
