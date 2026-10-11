import { describe, expect, test } from "vitest";
import { fixture } from "../helpers.js";
import { parseAnswer } from "../../src/compiler/parse.js";

describe("parseAnswer", () => {
  test("single target: first fenced block body", () => {
    const r = parseAnswer(fixture("compiler/answers/single.md"), ["src/a.ts"]);
    if (!("files" in r)) throw new Error("expected files");
    expect(r.files["src/a.ts"]).toBe("export const a = 1;\n");
  });

  test("single target on multi-target answer: first fenced block", () => {
    const r = parseAnswer(fixture("compiler/answers/twoFiles.md"), ["src/a.ts"]);
    if (!("files" in r)) throw new Error("expected files");
    expect(r.files["src/a.ts"]).toBe("export const a = 1;\n");
  });

  test("two targets: one file per section", () => {
    const r = parseAnswer(fixture("compiler/answers/twoFiles.md"), [
      "src/a.ts",
      "tests/a.test.ts",
    ]);
    if (!("files" in r)) throw new Error("expected files");
    expect(Object.keys(r.files).length).toBe(2);
    expect(r.files["src/a.ts"]).toBe("export const a = 1;\n");
  });

  test("a section not in the targets is extra", () => {
    const r = parseAnswer(fixture("compiler/answers/twoFiles.md"), [
      "src/a.ts",
      "tests/b.test.ts",
    ]);
    if ("files" in r) throw new Error("expected corrupt");
    if ("truncated" in r) throw new Error("expected corrupt");
    expect(r.corrupt).toBe("extra section for tests/a.test.ts");
  });

  test("odd fence count: truncated", () => {
    const r = parseAnswer(fixture("compiler/answers/truncated.md"), [
      "src/a.ts",
      "tests/a.test.ts",
    ]);
    if ("files" in r) throw new Error("expected truncated");
    if ("corrupt" in r) throw new Error("expected truncated");
    expect("truncated" in r).toBe(true);
  });
});
