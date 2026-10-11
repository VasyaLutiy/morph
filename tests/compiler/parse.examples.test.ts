import { describe, expect, test } from "vitest";
import { parseAnswer } from "../../src/compiler/parse.js";
import type { ParsedAnswer } from "../../src/compiler/types.js";
import { fixture } from "../helpers.js";

const A = ["src/a.ts"];
const AT = ["src/a.ts", "tests/a.test.ts"];

describe("parseAnswer", () => {
  test("Parse Answer example 1", () => {
    const r: ParsedAnswer = parseAnswer(fixture("compiler/answers/single.md"), A);
    if ("files" in r) {
      expect(Object.keys(r.files).length).toBe(1);
      expect(r.files["src/a.ts"]).toBe("export const a = 1;\n");
    } else if ("corrupt" in r) {
      expect.unreachable(r.corrupt);
    } else {
      expect.unreachable("truncated");
    }
  });

  test("Parse Answer example 2", () => {
    const r: ParsedAnswer = parseAnswer(fixture("compiler/answers/missingSection.md"), AT);
    if ("corrupt" in r) {
      expect(r.corrupt).toBe("missing section for tests/a.test.ts");
    } else if ("files" in r) {
      expect.unreachable(JSON.stringify(r.files));
    } else {
      expect.unreachable("truncated");
    }
  });

  test("Parse Answer example 3", () => {
    const r: ParsedAnswer = parseAnswer(fixture("compiler/answers/truncated.md"), AT);
    if ("truncated" in r) {
      expect(r.truncated).toBe(true);
    } else if ("files" in r) {
      expect.unreachable(JSON.stringify(r.files));
    } else {
      expect.unreachable(r.corrupt);
    }
  });

  test("two files, targets order, exact contents", () => {
    const r: ParsedAnswer = parseAnswer(fixture("compiler/answers/twoFiles.md"), AT);
    if ("files" in r) {
      expect(Object.keys(r.files).join(",")).toBe("src/a.ts,tests/a.test.ts");
      expect(r.files["src/a.ts"]).toBe("export const a = 1;\n");
      expect(r.files["tests/a.test.ts"].startsWith("import { test, expect } from \"vitest\";")).toBe(true);
      expect(r.files["tests/a.test.ts"].endsWith("});\n")).toBe(true);
    } else {
      expect.unreachable();
    }
  });

  test("two files with single target takes first fenced block", () => {
    const r: ParsedAnswer = parseAnswer(fixture("compiler/answers/twoFiles.md"), A);
    if ("files" in r) {
      expect(r.files["src/a.ts"]).toBe("export const a = 1;\n");
    } else {
      expect.unreachable();
    }
  });

  test("prose around a single fence is ignored", () => {
    const r: ParsedAnswer = parseAnswer(fixture("compiler/answers/proseSingle.md"), A);
    if ("files" in r) {
      expect(r.files["src/a.ts"]).toBe("export const a = 1;\n");
    } else {
      expect.unreachable();
    }
  });

  test("proseSingle with two targets is corrupt: no section at all", () => {
    const r: ParsedAnswer = parseAnswer(fixture("compiler/answers/proseSingle.md"), AT);
    if ("corrupt" in r) {
      expect(r.corrupt).toBe("missing section for src/a.ts");
    } else {
      expect.unreachable();
    }
  });

  test("prose between sections is ignored, byte for byte", () => {
    const r: ParsedAnswer = parseAnswer(fixture("compiler/answers/proseTwoFiles.md"), AT);
    if ("files" in r) {
      expect(r.files["src/a.ts"]).toBe("export const a = 1;\n");
      expect(r.files["tests/a.test.ts"].startsWith("import { test, expect } from \"vitest\";")).toBe(true);
      expect(r.files["tests/a.test.ts"].endsWith("});\n")).toBe(true);
    } else {
      expect.unreachable();
    }
  });

  test("extra section for a path not in targets", () => {
    const r: ParsedAnswer = parseAnswer(fixture("compiler/answers/outsideTargets.md"), AT);
    if ("corrupt" in r) {
      expect(r.corrupt).toBe("extra section for src/b.ts");
    } else {
      expect.unreachable();
    }
  });

  test("leading --- line is dropped", () => {
    const r: ParsedAnswer = parseAnswer(fixture("compiler/answers/leadingDashes.md"), A);
    if ("files" in r) {
      expect(r.files["src/a.ts"]).toBe("export const a = 1;\n");
    } else {
      expect.unreachable();
    }
  });

  test("no fence, single target: whole text is the file", () => {
    const r: ParsedAnswer = parseAnswer("export const a = 1;\n", A);
    if ("files" in r) {
      expect(r.files["src/a.ts"]).toBe("export const a = 1;\n");
    } else {
      expect.unreachable();
    }
  });

  test("duplicate section", () => {
    const r: ParsedAnswer = parseAnswer(
      "FILE: src/a.ts\n```ts\nexport const a = 1;\n```\nFILE: src/a.ts\n```ts\nexport const a = 1;\n```\n",
      AT,
    );
    if ("corrupt" in r) {
      expect(r.corrupt).toBe("duplicate section for src/a.ts");
    } else {
      expect.unreachable();
    }
  });

  test("section without a fenced block", () => {
    const r: ParsedAnswer = parseAnswer(
      "FILE: src/a.ts\n```ts\nexport const a = 1;\n```\nFILE: tests/a.test.ts\njust prose\n",
      AT,
    );
    if ("corrupt" in r) {
      expect(r.corrupt).toBe("no fenced block for tests/a.test.ts");
    } else {
      expect.unreachable();
    }
  });

  test("empty targets throws", () => {
    expect(() => parseAnswer("```ts\nx\n```\n", [])).toThrow(/^parseAnswer/);
  });

  test("crlf normalised and empty fenced block body is empty string", () => {
    const r: ParsedAnswer = parseAnswer("```ts\r\n```\r\n", A);
    if ("files" in r) {
      expect(r.files["src/a.ts"]).toBe("");
    } else {
      expect.unreachable();
    }
  });
});
