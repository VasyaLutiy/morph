// P11b2 probe for archive-run by docs/TASK_P11b2_processor.md §2.2 (saveBatchAnswers) — a collected batch's answers as
// <root>/.morph/batches/<batchId>/<customId>.md (a stub processor's ANSWERS_DIR), path-unsafe ids refused whole, nothing
// created for no answers; archiveRun and saveBatchRecord unchanged. Record Archive Run example 8, then the §2.2 rows.
import { test, expect } from "vitest";
import fs from "node:fs";
import { saveBatchAnswers, saveBatchRecord } from "../../src/git/archive.js";
import { tmpRoot } from "../../tests/helpers.js";

test("Archive Run example 8: saveBatchAnswers writes a stub processor's answer files", () => {
  const t = tmpRoot();
  try {
    const id = "batch-1791388269-cp5qOr5IQ0xoz1ntuc8W";
    expect(saveBatchAnswers(t.root, id, [{ customId: "clamp-value.v1", text: "A" }, { customId: "sign-of.v1", text: "B\n" }]), "paths").toStrictEqual(
      [".morph/batches/" + id + "/clamp-value.v1.md", ".morph/batches/" + id + "/sign-of.v1.md"]);
    expect(`${t.read(".morph/batches/" + id + "/clamp-value.v1.md")}|${t.read(".morph/batches/" + id + "/sign-of.v1.md")}`, "texts").toBe("A|B\n");
    expect(saveBatchAnswers(t.root, "a b", [{ customId: "x.v1", text: "X" }]), "unsafe batch id").toStrictEqual([]);
    expect(saveBatchAnswers(t.root, id, [{ customId: "x.v1", text: "X" }, { customId: "../y", text: "Y" }]), "unsafe customId").toStrictEqual([]);
    expect(saveBatchAnswers(t.root, "batch-0", []), "no answers").toStrictEqual([]);
    expect(fs.readdirSync(t.path(".morph/batches")), "one directory").toStrictEqual([id]);
    expect(t.exists(".morph/batches/" + id + "/x.v1.md"), "no x.v1.md").toBe(false);
  } finally {
    t.rm();
  }
});

test("§2.2 rows: an overwrite, an empty text, another id; saveBatchRecord unchanged beside it", () => {
  const t = tmpRoot();
  try {
    t.write(".morph/batches/q.1/a.r1.v2.md", "old");
    expect(saveBatchAnswers(t.root, "q.1", [{ customId: "a.r1.v2", text: "" }, { customId: "b_c-D.v1", text: "Z" }]), "paths").toStrictEqual(
      [".morph/batches/q.1/a.r1.v2.md", ".morph/batches/q.1/b_c-D.v1.md"]);
    expect(`${t.read(".morph/batches/q.1/a.r1.v2.md")}|${t.read(".morph/batches/q.1/b_c-D.v1.md")}`, "texts").toBe("|Z");
    expect(saveBatchRecord(t.root, { batchId: "q.1" }), "record").toBe(".morph/batches/q.1.json");
    expect(t.read(".morph/batches/q.1.json"), "record text").toBe("{\n  \"batchId\": \"q.1\"\n}\n");
    expect(saveBatchAnswers(t.root, "", [{ customId: "a", text: "x" }]), "empty batch id").toStrictEqual([]);
  } finally {
    t.rm();
  }
});
