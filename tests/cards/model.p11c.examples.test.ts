import { describe, expect, test } from "vitest";
import { validateCard } from "../../src/cards/model.js";

describe("Validate Card", () => {
  test("Validate Card example 5: a customId ending in .r<n> is one fault", () => {
    const result = validateCard({
      customId: "lint.r2",
      intent: "generate",
      targets: ["src/a.ts"],
      instruction: "x",
    });
    expect(result).toStrictEqual({
      ok: false,
      faults: [
        { key: "customId", message: "customId 'lint.r2' ends in .r<n>, the suffix of a retry" },
      ],
    });
  });

  test("Validate Card example 6: .. is refused in targets and in contextSlice", () => {
    const result = validateCard({
      customId: "a",
      intent: "patch",
      targets: [".."],
      contextSlice: ["..", "docs/x.md"],
      instruction: "x",
    });
    expect(result).toStrictEqual({
      ok: false,
      faults: [
        { key: "targets", message: "targets '..' is not repo-relative" },
        { key: "contextSlice", message: "contextSlice '..' is not repo-relative" },
      ],
    });
  });
});
