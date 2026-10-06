import { describe, expect, test } from "vitest";
import { validateCard } from "../../src/cards/model.js";
import { compileCard } from "../../src/compiler/compile.js";
import { fixtureJson, fixturePath } from "../helpers.js";

describe("compileCard", () => {
  test("generate with two slice files and 2 variants builds sorted slice messages and two requests", () => {
    const r = validateCard(fixtureJson("compiler/cards/generateA.json"));
    if (!r.ok) throw new Error("fixture card is invalid");
    const out = compileCard(r.card, fixturePath("compiler/project"));
    if (!out.ok) throw new Error("compile failed");
    expect(out.requests.length).toBe(2);
    expect(out.requests[0]?.customId).toBe("a.v1");
    expect(out.requests[1]?.customId).toBe("a.v2");
    expect(out.requests[0]?.messages[0]?.content.split("\n")[0]).toBe("Contents of file docs/A.md:");
    expect(out.requests[0]?.messages[1]?.content.split("\n")[0]).toBe("Contents of file docs/B.md:");
  });

  test("patch names the original file first", () => {
    const r = validateCard(fixtureJson("compiler/cards/patchP.json"));
    if (!r.ok) throw new Error("fixture card is invalid");
    const out = compileCard(r.card, fixturePath("compiler/project"));
    if (!out.ok) throw new Error("compile failed");
    expect(out.requests.length).toBe(1);
    expect(out.requests[0]?.customId).toBe("p.v1");
    expect(out.requests[0]?.messages[0]?.content.split("\n")[0]).toBe("Original file src/x.ts:");
  });

  test("a missing slice file is a compile fault with no requests", () => {
    const r = validateCard({
      customId: "m",
      intent: "generate",
      targets: ["src/a.ts"],
      contextSlice: ["docs/missing.md"],
      instruction: "Write src/a.ts.",
    });
    if (!r.ok) throw new Error("card is invalid");
    const out = compileCard(r.card, fixturePath("compiler/project"));
    if (out.ok) throw new Error("compile should fail");
    expect(out.faults.length).toBe(1);
    expect(out.faults[0]?.message).toBe("contextSlice 'docs/missing.md' does not exist");
  });
});
