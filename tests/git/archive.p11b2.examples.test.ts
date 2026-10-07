import fs from "node:fs";
import { expect, test } from "vitest";
import { saveBatchAnswers } from "../../src/git/archive.js";
import { tmpRoot } from "../helpers.js";

test("Archive Run example 8: saveBatchAnswers writes each answer as <id>/<customId>.md and refuses unsafe ids", () => {
  const t = tmpRoot();
  try {
    const batchId = "batch-1791388269-cp5qOr5IQ0xoz1ntuc8W";
    const answers = [
      { customId: "clamp-value.v1", text: "A" },
      { customId: "sign-of.v1", text: "B\n" },
    ];
    expect(saveBatchAnswers(t.root, batchId, answers)).toStrictEqual([
      ".morph/batches/" + batchId + "/clamp-value.v1.md",
      ".morph/batches/" + batchId + "/sign-of.v1.md",
    ]);
    expect(t.read(".morph/batches/" + batchId + "/clamp-value.v1.md")).toBe("A");
    expect(t.read(".morph/batches/" + batchId + "/sign-of.v1.md")).toBe("B\n");

    expect(saveBatchAnswers(t.root, "a b", answers)).toStrictEqual([]);
    expect(
      saveBatchAnswers(t.root, batchId, [
        { customId: "x.v1", text: "A" },
        { customId: "../y", text: "B" },
      ]),
    ).toStrictEqual([]);
    expect(saveBatchAnswers(t.root, "batch-0", [])).toStrictEqual([]);

    expect(fs.readdirSync(t.path(".morph/batches"))).toStrictEqual([batchId]);
    expect(t.exists(".morph/batches/" + batchId + "/x.v1.md")).toBe(false);
    expect(t.exists(".morph/batches/batch-0")).toBe(false);
  } finally {
    t.rm();
  }
});
