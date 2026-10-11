import { describe, expect, test } from "vitest";
import type { Card } from "../../src/cards/types.js";
import { validateCard } from "../../src/cards/model.js";
import { compileCard } from "../../src/compiler/compile.js";
import type { CompileResult } from "../../src/compiler/types.js";
import { outputDirective } from "../../src/compiler/directive.js";
import { fixtureJson, fixturePath } from "../helpers.js";

function loadCard(name: string): Card {
  const r = validateCard(fixtureJson(`compiler/cards/${name}.json`));
  if (!r.ok) expect.unreachable(`fixture ${name} does not validate`);
  return r.card;
}

const root: string = fixturePath("compiler/project");

describe("compileCard examples", () => {
  test("Compile Card example 1", () => {
    const card = loadCard("generateA");
    const r: CompileResult = compileCard(card, root);
    if (!r.ok) expect.unreachable("generateA should compile");
    expect(r.requests.length).toBe(2);
    expect(r.requests[0].customId).toBe("a.v1");
    expect(r.requests[1].customId).toBe("a.v2");
    expect(r.requests[0].messages.length).toBe(3);
    expect(r.requests[0].messages[0].content).toBe(
      'Contents of file docs/A.md:\n<file_contents path="docs/A.md">\n# A\n\nAlpha doc.\n</file_contents>',
    );
    expect(r.requests[0].messages[1].content).toBe(
      'Contents of file docs/B.md:\n<file_contents path="docs/B.md">\n# B\n\nBeta doc.\n</file_contents>',
    );
    expect(r.requests[0].messages[2].content).toBe(
      "Write src/a.ts.\n\n" + outputDirective(["src/a.ts"]),
    );
    expect(JSON.stringify(r.inputs)).toBe(
      '{"docs/A.md":"5ab70d8e40bc35ca","docs/B.md":"18fe47246e49d6ea","src/a.ts":"absent"}',
    );
  });

  test("Compile Card example 2", () => {
    const card = loadCard("patchP");
    const r: CompileResult = compileCard(card, root);
    if (!r.ok) expect.unreachable("patchP should compile");
    expect(r.requests.length).toBe(1);
    expect(r.requests[0].customId).toBe("p.v1");
    expect(r.requests[0].messages.length).toBe(3);
    expect(r.requests[0].messages[0].content).toBe(
      'Original file src/x.ts:\n<original_file path="src/x.ts">\nexport const x = 1;\nexport const y = 2;\nexport const z = 3;\n</original_file>',
    );
    expect(r.requests[0].messages[0].content.startsWith('Original file src/x.ts:\n<original_file path="src/x.ts">\n')).toBe(true);
    expect(r.requests[0].messages[0].content.length).toBe(132);
    expect(r.requests[0].messages[1].content).toBe(
      'Contents of file docs/A.md:\n<file_contents path="docs/A.md">\n# A\n\nAlpha doc.\n</file_contents>',
    );
    expect(r.requests[0].messages[2].content).toBe(
      "Patch src/x.ts.\n\n" + outputDirective(["src/x.ts"]),
    );
    expect(JSON.stringify(r.inputs)).toBe(
      '{"docs/A.md":"5ab70d8e40bc35ca","src/x.ts":"73ab5a7f1128f2bb"}',
    );
  });

  test("Compile Card example 3", () => {
    const card = loadCard("missingSlice");
    const r: CompileResult = compileCard(card, root);
    if (r.ok) expect.unreachable("missingSlice should not compile");
    expect(r.faults.length).toBe(1);
    expect(r.faults[0].key).toBe("contextSlice");
    expect(r.faults[0].message).toBe("contextSlice 'docs/missing.md' does not exist");
  });

  test("Compile Card example 4: a slice file holding a fence is tagged, not fenced", () => {
    const card = loadCard("fencedF");
    const r: CompileResult = compileCard(card, root);
    if (!r.ok) expect.unreachable("fencedF should compile");
    expect(r.requests.length).toBe(1);
    expect(r.requests[0].customId).toBe("f.v1");
    expect(r.requests[0].messages.length).toBe(2);
    expect(r.requests[0].messages[0].content).toBe(
      'Contents of file docs/F.md:\n<file_contents path="docs/F.md">\n# F\n\n```ts\nconst f = 1;\n```\n</file_contents>',
    );
    for (const m of r.requests[0].messages) {
      expect(m.content.split("\n").includes("```md")).toBe(false);
    }
  });

  test("Compile Card example 5: patch of an existing target and an absent one", () => {
    const card = loadCard("patchNew");
    const r: CompileResult = compileCard(card, root);
    if (!r.ok) expect.unreachable("patchNew should compile");
    expect(r.requests.length).toBe(1);
    expect(r.requests[0].customId).toBe("n.v1");
    expect(r.requests[0].messages).toStrictEqual([
      {
        role: "user",
        content:
          'Original file src/x.ts:\n<original_file path="src/x.ts">\nexport const x = 1;\nexport const y = 2;\nexport const z = 3;\n</original_file>',
      },
      { role: "user", content: "Target src/z.ts is a new file: it does not exist yet." },
      {
        role: "user",
        content: "Patch src/x.ts and add src/z.ts.\n\n" + outputDirective(["src/x.ts", "src/z.ts"]),
      },
    ]);
  });
});

describe("compileCard rules", () => {
  test("messages identical across variants", () => {
    const card = loadCard("generateA");
    const r = compileCard(card, root);
    if (!r.ok) expect.unreachable("generateA should compile");
    expect(JSON.stringify(r.requests[0].messages)).toBe(JSON.stringify(r.requests[1].messages));
    expect(r.requests[0].messages).not.toBe(r.requests[1].messages);
  });

  test("all messages have role user", () => {
    const r = compileCard(loadCard("generateA"), root);
    if (!r.ok) expect.unreachable("generateA should compile");
    for (const m of r.requests[0].messages) expect(m.role).toBe("user");
  });

  test("patch with a new target sends the new-file line", () => {
    const card = loadCard("patchNew");
    const r = compileCard(card, root);
    if (!r.ok) expect.unreachable("patchNew should compile");
    expect(r.requests.length).toBe(1);
    expect(r.requests[0].customId).toBe("n.v1");
    expect(r.requests[0].messages.length).toBe(3);
    expect(r.requests[0].messages[0].content).toBe(
      'Original file src/x.ts:\n<original_file path="src/x.ts">\nexport const x = 1;\nexport const y = 2;\nexport const z = 3;\n</original_file>',
    );
    expect(r.requests[0].messages[1].content).toBe(
      "Target src/z.ts is a new file: it does not exist yet.",
    );
  });

  test("several targets get the section directive", () => {
    const r = compileCard(loadCard("patchNew"), root);
    if (!r.ok) expect.unreachable("patchNew should compile");
    expect(r.requests[0].messages[2].content).toBe(
      "Patch src/x.ts and add src/z.ts.\n\n" +
        outputDirective(["src/x.ts", "src/z.ts"]),
    );
  });

  test("patchNew inputs digest", () => {
    const r = compileCard(loadCard("patchNew"), root);
    if (!r.ok) expect.unreachable("patchNew should compile");
    expect(JSON.stringify(r.inputs)).toBe(
      '{"src/x.ts":"73ab5a7f1128f2bb","src/z.ts":"absent"}',
    );
  });

  test("generate target that exists sends no message for it", () => {
    const card = loadCard("patchP");
    const generateCard: Card = { ...card, intent: "generate", customId: "g" };
    const r = compileCard(generateCard, root);
    if (!r.ok) expect.unreachable("should compile");
    expect(r.requests[0].messages.length).toBe(2);
    expect(r.requests[0].messages[0].content.startsWith("Contents of file docs/A.md:")).toBe(true);
  });

  test("card fields are copied onto each request", () => {
    const card = loadCard("generateA");
    const r = compileCard(card, root);
    if (!r.ok) expect.unreachable("generateA should compile");
    for (const req of r.requests) {
      expect(req.model).toBe(card.model);
      expect(req.maxTokens).toBe(card.maxTokens);
      expect(req.reasoning).toBe(card.reasoning);
    }
  });
});
