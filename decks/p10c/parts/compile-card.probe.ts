// P10c probe for compile-card: compileCard by docs/TASK_P10c_runner.md §2.2 (issue #3 C5) — slice files and patch
// originals in named tags, never in a fenced block. One test per record example of Compile Card (1-5, the fixtures of
// tests/fixtures/compiler), then the §2.2 rows: an empty slice file, a file without a final newline, variants identical.
import { test, expect } from "vitest";
import { validateCard } from "../../src/cards/model.js";
import { compileCard } from "../../src/compiler/compile.js";
import { outputDirective } from "../../src/compiler/directive.js";
import type { Card } from "../../src/cards/types.js";
import type { Request } from "../../src/compiler/types.js";
import { fixtureJson, fixturePath, tmpRoot } from "../../tests/helpers.js";

const ROOT = fixturePath("compiler/project");
function load(name: string): Card {
  const r = validateCard(fixtureJson("compiler/cards/" + name + ".json"));
  if (!r.ok) throw new Error("fixture " + name + " does not validate");
  return r.card;
}
function requests(c: Card, root = ROOT): Request[] {
  const r = compileCard(c, root);
  if (!r.ok) throw new Error("compile fault: " + r.faults.map((f) => f.message).join("; "));
  return r.requests;
}
const contents = (m: Request, i: number): string => m.messages[i]?.content ?? "<no message " + i + ">";
const A = 'Contents of file docs/A.md:\n<file_contents path="docs/A.md">\n# A\n\nAlpha doc.\n</file_contents>';
const B = 'Contents of file docs/B.md:\n<file_contents path="docs/B.md">\n# B\n\nBeta doc.\n</file_contents>';
const X = 'Original file src/x.ts:\n<original_file path="src/x.ts">\nexport const x = 1;\nexport const y = 2;\nexport const z = 3;\n</original_file>';

test("Compile Card example 1: two slice files in sorted order, each in its named tag", () => {
  const rs = requests(load("generateA"));
  expect(rs.map((r) => r.customId), "ids").toStrictEqual(["a.v1", "a.v2"]);
  expect(contents(rs[0], 0), "messages[0]").toBe(A);
  expect(contents(rs[0], 1), "messages[1]").toBe(B);
  expect(contents(rs[0], 2), "messages[2]").toBe("Write src/a.ts.\n\n" + outputDirective(["src/a.ts"]));
  expect(rs[0].messages.length, "message count").toBe(3);
});

test("Compile Card example 2: the patch original in <original_file>, 132 chars", () => {
  const rs = requests(load("patchP"));
  expect(contents(rs[0], 0), "messages[0]").toBe(X);
  expect(contents(rs[0], 0).length, "length").toBe(132);
  expect(contents(rs[0], 1), "messages[1]").toBe(A);
  expect(contents(rs[0], 2), "messages[2]").toBe("Patch src/x.ts.\n\n" + outputDirective(["src/x.ts"]));
});

test("Compile Card example 3: a missing slice file is a fault", () => {
  const r = compileCard(load("missingSlice"), ROOT);
  expect(r.ok ? "ok" : r.faults.map((f) => f.message).join("; "), "faults").toBe("contextSlice 'docs/missing.md' does not exist");
});

test("Compile Card example 4: a fence inside a slice file stays as it is, one newline added", () => {
  const rs = requests(load("fencedF"));
  expect(contents(rs[0], 0), "messages[0]").toBe(
    'Contents of file docs/F.md:\n<file_contents path="docs/F.md">\n# F\n\n```ts\nconst f = 1;\n```\n</file_contents>');
  for (const m of rs[0].messages) expect(m.content.split("\n").includes("```md"), "a ```md line").toBe(false);
});

test("Compile Card example 5: the tagged original, then the new-file line, then the instruction", () => {
  const rs = requests(load("patchNew"));
  expect(rs[0].messages.map((m) => m.content), "messages").toStrictEqual([
    X, "Target src/z.ts is a new file: it does not exist yet.",
    "Patch src/x.ts and add src/z.ts.\n\n" + outputDirective(["src/x.ts", "src/z.ts"])]);
});

test("§2.2: an empty slice file gives the two tags on adjacent lines; a .ts slice file has no ```ts fence", () => {
  const t = tmpRoot("morph-p10c-");
  try {
    t.write("docs/E.md", "");
    t.write("src/y.ts", "export const y = 1;");
    const c: Card = { customId: "e", intent: "generate", targets: ["src/e.ts"], contextSlice: ["src/y.ts", "docs/E.md"],
      instruction: "Write e.", acceptance: null, model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn: [] };
    const rs = requests(c, t.root);
    expect(contents(rs[0], 0), "empty").toBe('Contents of file docs/E.md:\n<file_contents path="docs/E.md">\n</file_contents>');
    expect(contents(rs[0], 1), "no final newline").toBe(
      'Contents of file src/y.ts:\n<file_contents path="src/y.ts">\nexport const y = 1;\n</file_contents>');
  } finally {
    t.rm();
  }
});

test("§2.2: the variants carry identical messages, each its own objects", () => {
  const rs = requests(load("generateA"));
  expect(JSON.stringify(rs[1].messages), "v2 = v1").toBe(JSON.stringify(rs[0].messages));
  expect(rs[1].messages === rs[0].messages, "same array").toBe(false);
});
