// P2 probe for parse-answer: parseAnswer by docs/TASK_P2_compiler.md §2.2, one test per record
// example, values and types. Runs from probe/parse-answer/ under vitest; reads fixtures only.
import { test, expect } from "vitest";
import { parseAnswer } from "../../src/compiler/parse.js";
import type { ParsedAnswer } from "../../src/compiler/types.js";
import { fixture } from "../../tests/helpers.js";

const A = ["src/a.ts"];
const AT = ["src/a.ts", "tests/a.test.ts"];
const answer = (name: string): string => fixture(`compiler/answers/${name}.md`);

// one line per outcome, so a wrong branch reads as a value, not a type error
function line(r: ParsedAnswer): string {
  if ("truncated" in r) return `truncated ${String(r.truncated)}`;
  if ("corrupt" in r) return `corrupt ${r.corrupt}`;
  return "files " + Object.entries(r.files).map(([p, c]) => `${p}=${JSON.stringify(c)}`).join(" ");
}

test("Parse Answer example 1: one target, one fenced block", () => {
  const r: ParsedAnswer = parseAnswer(answer("single"), A);
  expect(line(r), "files {'src/a.ts': 'export const a = 1;\\n'}").toBe('files src/a.ts="export const a = 1;\\n"');
  expect(Object.keys(r).join(","), "one key").toBe("files");
});

test("Parse Answer example 2: FILE: src/a.ts only, tests/a.test.ts missing", () => {
  expect(line(parseAnswer(answer("missingSection"), AT)), "corrupt names the missing path")
    .toBe("corrupt missing section for tests/a.test.ts");
});

test("Parse Answer example 3: three fence lines", () => {
  expect(line(parseAnswer(answer("truncated"), AT)), "truncated: true").toBe("truncated true");
  expect(line(parseAnswer(answer("truncated"), A)), "truncated before the single-target rule").toBe("truncated true");
});

test("Parse Answer §2.2: sections, prose, extra, dashes, bodies, duplicates, CRLF", () => {
  const two = parseAnswer(answer("twoFiles"), AT);
  expect(line(two).startsWith('files src/a.ts="export const a = 1;\\n" tests/a.test.ts="import { test, expect } from \\"vitest\\";'), "two files in targets order").toBe(true);
  const test2 = "files" in two ? (two.files["tests/a.test.ts"] ?? "") : "";
  expect(`${test2.length} ${test2.split("\n").length - 1}`, "tests/a.test.ts: 121 bytes, 6 lines").toBe("121 6");
  expect(line(parseAnswer(answer("proseTwoFiles"), AT)), "prose around sections is ignored").toBe(line(two));
  expect(line(parseAnswer(answer("twoFiles"), A)), "single target: the first fenced block, FILE lines ignored")
    .toBe('files src/a.ts="export const a = 1;\\n"');
  expect(line(parseAnswer(answer("proseSingle"), A)), "single target wrapped in prose").toBe('files src/a.ts="export const a = 1;\\n"');
  expect(line(parseAnswer(answer("proseSingle"), AT)), "no section at all names the first target").toBe("corrupt missing section for src/a.ts");
  expect(line(parseAnswer(answer("outsideTargets"), AT)), "extra before missing").toBe("corrupt extra section for src/b.ts");
  expect(line(parseAnswer(answer("leadingDashes"), A)), "a leading --- line is dropped").toBe('files src/a.ts="export const a = 1;\\n"');
  expect(line(parseAnswer("no fence at all\n", A)), "no fence: the whole text").toBe('files src/a.ts="no fence at all\\n"');
  expect(line(parseAnswer("---\nplain\n", A)), "--- dropped from an unfenced answer too").toBe('files src/a.ts="plain\\n"');
  expect(line(parseAnswer("```ts\n```", A)), "empty block body").toBe('files src/a.ts=""');
  expect(line(parseAnswer("```ts\nx\n```\n```ts\ny\n```", A)), "first block only").toBe('files src/a.ts="x\\n"');
  expect(line(parseAnswer("FILE: src/a.ts\n```ts\na\n```\nFILE: src/a.ts\n```ts\nb\n```\nFILE: tests/a.test.ts\n```ts\nt\n```\n", AT)), "duplicate")
    .toBe("corrupt duplicate section for src/a.ts");
  expect(line(parseAnswer("FILE: src/a.ts\nFILE: tests/a.test.ts\n```ts\nt\n```\n", AT)), "a section without a block")
    .toBe("corrupt no fenced block for src/a.ts");
  expect(line(parseAnswer("FILE: `src/a.ts`\n```ts\na\n```\nFILE: \"tests/a.test.ts\"\n```ts\nt\n```\n", AT)), "backticks and quotes around a path")
    .toBe('files src/a.ts="a\\n" tests/a.test.ts="t\\n"');
  expect(line(parseAnswer("FILE: src/a.ts\n```md\nFILE: tests/a.test.ts\n```\nFILE: tests/a.test.ts\n```ts\nt\n```\n", AT)), "FILE: inside a fence is content")
    .toBe('files src/a.ts="FILE: tests/a.test.ts\\n" tests/a.test.ts="t\\n"');
  expect(line(parseAnswer("```ts\r\nexport const a = 1;\r\n```\r\n", A)), "CRLF normalised").toBe('files src/a.ts="export const a = 1;\\n"');
  expect(() => parseAnswer("x", []), "empty targets").toThrow(/^parseAnswer/);
});
