// P3 probe for snapshot-targets: snapshotTargets and restoreSnapshot by
// docs/TASK_P3_acceptance.md §2.2, one test per record example, values and types. Runs from
// probe/snapshot-targets/ under vitest; every example works in its own tmpRoot().
import { test, expect } from "vitest";
import fs from "node:fs";
import { restoreSnapshot, snapshotTargets } from "../../src/acceptance/snapshot.js";
import type { SnapshotEntry, TargetSnapshot } from "../../src/acceptance/types.js";
import { tmpRoot } from "../../tests/helpers.js";

const hex = (b: Uint8Array | null): string => (b === null ? "null" : Buffer.from(b).toString("hex"));

test("Snapshot Targets example 1: a changed file and a created file are rolled back", () => {
  const r = tmpRoot();
  try {
    r.write("src/a.ts", "old\n");
    const s: TargetSnapshot = snapshotTargets(r.root, ["src/a.ts", "src/b.ts"]);
    const e: SnapshotEntry[] = s.entries;
    expect(s.root, "the root as given").toBe(r.root);
    expect(e.map((x) => x.path).join(","), "entries in targets order").toBe("src/a.ts,src/b.ts");
    expect(hex(e[0]?.bytes ?? null), 'src/a.ts with 4 bytes "old\\n"').toBe("6f6c640a");
    expect(e[1] === undefined ? "missing entry" : hex(e[1].bytes), "src/b.ts with bytes null").toBe("null");
    r.write("src/a.ts", "new\n");
    r.write("src/b.ts", "x\n");
    restoreSnapshot(s);
    expect(r.read("src/a.ts"), 'after restore src/a.ts reads "old\\n"').toBe("old\n");
    expect(r.exists("src/b.ts"), "after restore src/b.ts does not exist").toBe(false);
  } finally {
    r.rm();
  }
});

test("Snapshot Targets example 2: the parent directory is recreated, restoring twice is safe", () => {
  const r = tmpRoot();
  try {
    r.write("src/deep/a.ts", "old\n");
    const s = snapshotTargets(r.root, ["src/deep/a.ts"]);
    fs.rmSync(r.path("src/deep"), { recursive: true, force: true });
    restoreSnapshot(s);
    expect(r.read("src/deep/a.ts"), "after the first restore").toBe("old\n");
    restoreSnapshot(s);
    expect(r.read("src/deep/a.ts"), "after the second restore").toBe("old\n");
    const absent = snapshotTargets(r.root, ["src/none.ts"]);
    restoreSnapshot(absent);
    restoreSnapshot(absent);
    expect(r.exists("src/none.ts"), "null entry restored twice: no error, still absent").toBe(false);
  } finally {
    r.rm();
  }
});

test("Snapshot Targets example 3: bytes that are not UTF-8 come back exactly", () => {
  const r = tmpRoot();
  try {
    fs.writeFileSync(r.path("bin.dat"), Buffer.from([0xff, 0x00, 0xfe, 0x0a]));
    const s = snapshotTargets(r.root, ["bin.dat"]);
    r.write("bin.dat", "text\n");
    restoreSnapshot(s);
    expect(fs.readFileSync(r.path("bin.dat")).toString("hex"), "the 4 bytes ff 00 fe 0a").toBe("ff00fe0a");
  } finally {
    r.rm();
  }
});
