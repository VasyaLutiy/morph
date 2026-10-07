// P9b probe for output-directive: outputDirective by docs/TASK_P9b_runloop.md §2.2, one test per record
// example (Component compiler, Function Output Directive, examples 1-4), then the §2.2 rows: the
// several-targets text whole, and the rules the text states hold in parseAnswer.
import { test, expect } from "vitest";
import { outputDirective } from "../../src/compiler/directive.js";
import { parseAnswer } from "../../src/compiler/parse.js";

const F = "```";
const SINGLE_RULES = "The opening fence may name the file's language. Only the FIRST fenced block of the answer becomes the file: a second block (a diff, an edit summary, an example) is dropped, and every line outside the fence is discarded. An answer with no fence at all is written to the file verbatim, prose and all. An answer whose fences do not pair up is discarded unread as cut off, so no line of the file may begin with three backticks. No preamble, no closing commentary, no diff, no elision: the whole file.";
const MULTI_RULES = "Use exactly these paths, each file whole: no diff, no elision. An answer that misses a file, gives one twice or names a file not in this list is discarded whole. Only the first fenced block after a FILE: line is that file's content: a second block (a diff, an edit summary, an example) is dropped. Lines outside the fenced blocks are ignored, but no other line may begin with FILE:. An answer whose fences do not pair up is discarded unread as cut off, so no line of a file may begin with three backticks.";
const fenceLines = (s: string): string[] => s.split("\n").filter((l) => l.startsWith(F));

test("Output Directive example 1: two targets, both paths in order, the FILE: line form", () => {
  const got = outputDirective(["src/a.ts", "tests/a.test.ts"]);
  expect(got.startsWith("This card writes 2 files. Return each one as a line `FILE: <path>`"), "begins").toBe(true);
  expect(got.includes("in this order:\nsrc/a.ts\ntests/a.test.ts\n\n"), "paths in order").toBe(true);
  expect(got.endsWith("so no line of a file may begin with three backticks."), "ends").toBe(true);
});

test("Output Directive example 2: one target, the text exactly", () => {
  expect(outputDirective(["src/a.ts"]), "single text").toBe(
    "Return the complete content of src/a.ts as ONE fenced block, and nothing else:\n\n```\n<the complete content of src/a.ts>\n```\n\n" + SINGLE_RULES,
  );
});

test("Output Directive example 3: three targets, bare fences, order kept", () => {
  const got = outputDirective(["docs/B.md", "src/b.ts", "tests/b.test.ts"]);
  expect(got.startsWith("This card writes 3 files."), "begins").toBe(true);
  expect(fenceLines(got), "fence lines").toStrictEqual([F, F]);
  expect(got.includes("docs/B.md\nsrc/b.ts\ntests/b.test.ts\n"), "order").toBe(true);
});

test("Output Directive example 4: empty targets throw", () => {
  expect(() => outputDirective([]), "throws").toThrowError(/^outputDirective/);
});

test("§2.2: the several-targets text exactly", () => {
  expect(outputDirective(["src/a.ts", "tests/a.test.ts"]), "multi text").toBe(
    "This card writes 2 files. Return each one as a line `FILE: <path>` followed by ONE fenced block holding its complete content:\n\nFILE: <path>\n```\n<the complete content of that file>\n```\n\nOne such pair per file, every file exactly once, in this order:\nsrc/a.ts\ntests/a.test.ts\n\n" + MULTI_RULES,
  );
});

test("§2.2: what the text promises is what parseAnswer does", () => {
  const two = "intro\n```ts\nA\n```\nprose\n```diff\n-B\n```\n";
  expect(parseAnswer(two, ["x.ts"]), "first block only").toStrictEqual({ files: { "x.ts": "A\n" } });
  expect(parseAnswer("```ts\nA\n", ["x.ts"]), "unpaired fence").toStrictEqual({ truncated: true });
  expect(parseAnswer("bare text\n", ["x.ts"]), "no fence: verbatim").toStrictEqual({ files: { "x.ts": "bare text\n" } });
  expect(outputDirective(["a.ts", "b.ts"]).endsWith("\n"), "no trailing newline").toBe(false);
});
