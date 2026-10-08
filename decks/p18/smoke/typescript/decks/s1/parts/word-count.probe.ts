// Smoke probe for word-count: one test per record example of Word Count.
import { test, expect } from "vitest";
import { wordCount } from "../../src/text/wordCount.js";

test("Word Count example 1", () => { expect(wordCount("one two  three")).toBe(3); });
test("Word Count example 2", () => { expect(wordCount("  \t\n ")).toBe(0); });
test("Word Count example 3", () => { expect(wordCount("a-b c")).toBe(2); });
