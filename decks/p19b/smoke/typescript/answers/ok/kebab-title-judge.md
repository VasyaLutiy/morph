```ts
import { test, expect } from "vitest";
import { kebabTitle } from "../../src/text/kebabTitle.js";

test("Kebab Title example 1: two words", () => {
  expect(kebabTitle("Hello World")).toBe("hello-world");
});

test("Kebab Title example 2: an acronym", () => {
  expect(kebabTitle("XMLHttpRequest")).toBe("xml-http-request");
});

test("Kebab Title example 3: punctuation and a number", () => {
  expect(kebabTitle("  Morph -- Cards 2 ")).toBe("morph-cards-2");
});
```
