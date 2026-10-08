```ts
import { test, expect } from "vitest";
import { wordCount } from "../../src/count/wordCount.js";

test("Word Count example 1: three words", () => {
  expect(wordCount("one two  three")).toBe(3);
});

test("Word Count example 2: white space only", () => {
  expect(wordCount("   ")).toBe(0);
});

test("Word Count example 3: tab and newline", () => {
  expect(wordCount("a\tb\nc")).toBe(3);
});
```
