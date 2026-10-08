import { test, expect } from "vitest";
import { wordCount } from "../../src/count/wordCount.js";

test("Word Count example 1", () => expect(wordCount("one two  three")).toBe(3));
test("Word Count example 2", () => expect(wordCount("   ")).toBe(0));
test("Word Count example 3", () => expect(wordCount("a\tb\nc")).toBe(3));
test("rows", () => {
  expect(wordCount("")).toBe(0);
  expect(wordCount(" x ")).toBe(1);
});
