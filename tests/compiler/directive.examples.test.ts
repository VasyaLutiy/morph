import { expect, test } from "vitest";
import { outputDirective } from "../../src/compiler/directive.js";

const FENCE = "```";

const SINGLE_TEXT =
  "Return the complete content of src/a.ts as ONE fenced block, and nothing else:\n\n" +
  FENCE +
  "\n<the complete content of src/a.ts>\n" +
  FENCE +
  "\n\nThe opening fence may name the file's language. Only the FIRST fenced block of the answer becomes the file: a second block (a diff, an edit summary, an example) is dropped, and every line outside the fence is discarded. An answer with no fence at all is written to the file verbatim, prose and all. An answer whose fences do not pair up is discarded unread as cut off, so no line of the file may begin with three backticks. No preamble, no closing commentary, no diff, no elision: the whole file.";

const MULTI_TEXT =
  "This card writes 2 files. Return each one as a line `FILE: <path>` followed by ONE fenced block holding its complete content:\n\nFILE: <path>\n" +
  FENCE +
  "\n<the complete content of that file>\n" +
  FENCE +
  "\n\nOne such pair per file, every file exactly once, in this order:\nsrc/a.ts\ntests/a.test.ts\n\nUse exactly these paths, each file whole: no diff, no elision. An answer that misses a file, gives one twice or names a file not in this list is discarded whole. Only the first fenced block after a FILE: line is that file's content: a second block (a diff, an edit summary, an example) is dropped. Lines outside the fenced blocks are ignored, but no other line may begin with FILE:. An answer whose fences do not pair up is discarded unread as cut off, so no line of a file may begin with three backticks.";

const count = (s: string, sub: string): number => s.split(sub).length - 1;

test("Output Directive example 1: several targets get the list directive", () => {
  const d = outputDirective(["src/a.ts", "tests/a.test.ts"]);
  expect(
    d.startsWith("This card writes 2 files. Return each one as a line `FILE: <path>`")
  ).toBe(true);
  expect(d.includes("in this order:\nsrc/a.ts\ntests/a.test.ts\n\n")).toBe(true);
  expect(d.endsWith("so no line of a file may begin with three backticks.")).toBe(true);
});

test("Output Directive example 2: one target gets the single-file directive verbatim", () => {
  expect(outputDirective(["src/a.ts"])).toBe(SINGLE_TEXT);
});

test("Output Directive example 3: three targets, bare fences, paths in order", () => {
  const d = outputDirective(["docs/B.md", "src/b.ts", "tests/b.test.ts"]);
  expect(d.startsWith("This card writes 3 files.")).toBe(true);
  for (const line of d.split("\n")) {
    if (line.startsWith(FENCE)) {
      expect(line).toBe(FENCE);
    }
  }
  expect(d.includes("docs/B.md\nsrc/b.ts\ntests/b.test.ts\n")).toBe(true);
});

test("Output Directive example 4: no targets throws", () => {
  expect(() => outputDirective([])).toThrowError(/^outputDirective/);
});

test("Output Directive section 2.2: the several-targets text in full for two targets", () => {
  expect(outputDirective(["src/a.ts", "tests/a.test.ts"])).toBe(MULTI_TEXT);
});

test("Output Directive section 2.2: the single text says 'the file', the several text says 'a file'", () => {
  expect(SINGLE_TEXT.includes("so no line of the file may begin with three backticks")).toBe(true);
  expect(SINGLE_TEXT.includes("so no line of a file may begin with three backticks")).toBe(false);
  expect(MULTI_TEXT.includes("so no line of a file may begin with three backticks")).toBe(true);
  expect(MULTI_TEXT.includes("so no line of the file may begin with three backticks")).toBe(false);
  expect(outputDirective(["src/a.ts"])).toBe(SINGLE_TEXT);
  expect(outputDirective(["src/a.ts", "tests/a.test.ts"])).toBe(MULTI_TEXT);
});

test("Output Directive section 2.2: neither text ends with a newline", () => {
  expect(outputDirective(["src/a.ts"]).endsWith("\n")).toBe(false);
  expect(
    outputDirective(["src/a.ts", "tests/a.test.ts"]).endsWith("\n")
  ).toBe(false);
});

test("Output Directive section 2.2: every target listed exactly once, in order", () => {
  const targets = ["docs/B.md", "src/b.ts", "tests/b.test.ts"];
  const d = outputDirective(targets);
  for (const p of targets) {
    expect(count(d, p)).toBe(1);
  }
  const positions = targets.map((p) => d.indexOf(p));
  expect(positions[0]).toBeLessThan(positions[1]);
  expect(positions[1]).toBeLessThan(positions[2]);
});
