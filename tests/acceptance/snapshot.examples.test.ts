import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import type { SnapshotEntry, TargetSnapshot } from "../../src/acceptance/types.js";
import { restoreSnapshot, snapshotTargets } from "../../src/acceptance/snapshot.js";
import { tmpRoot } from "../helpers.js";

describe("snapshot", () => {
  test("Snapshot Targets example 1: two targets, one absent, restored byte for byte", () => {
    const r = tmpRoot();
    try {
      r.write("src/a.ts", "old\n");
      const snap = snapshotTargets(r.root, ["src/a.ts", "src/b.ts"]);
      r.write("src/a.ts", "new\n");
      r.write("src/b.ts", "x\n");
      restoreSnapshot(snap);
      const snap2: TargetSnapshot = snapshotTargets(r.root, ["src/a.ts", "src/b.ts"]);
      expect(snap2.entries.length).toBe(2);
      expect(snap2.entries[0]?.path).toBe("src/a.ts");
      expect(snap2.entries[0]?.bytes).not.toBeNull();
      expect(Buffer.from(snap2.entries[0]?.bytes ?? []).toString("utf8")).toBe("old\n");
      expect(snap2.entries[0]?.bytes?.length).toBe(4);
      expect(snap2.entries[1]?.path).toBe("src/b.ts");
      expect(snap2.entries[1]?.bytes).toBeNull();
      expect(r.read("src/a.ts")).toBe("old\n");
      expect(r.exists("src/b.ts")).toBe(false);
    } finally {
      r.rm();
    }
  });

  test("Snapshot Targets example 2: deep target, parent directory recreated on each restore", () => {
    const r = tmpRoot();
    try {
      r.write("src/deep/a.ts", "old\n");
      const snap = snapshotTargets(r.root, ["src/deep/a.ts"]);
      fs.rmSync(r.path("src/deep"), { recursive: true });
      restoreSnapshot(snap);
      expect(r.read("src/deep/a.ts")).toBe("old\n");
      fs.rmSync(r.path("src/deep"), { recursive: true });
      restoreSnapshot(snap);
      expect(r.read("src/deep/a.ts")).toBe("old\n");
    } finally {
      r.rm();
    }
  });

  test("Snapshot Targets example 3: non-UTF-8 bytes preserved exactly", () => {
    const r = tmpRoot();
    try {
      fs.writeFileSync(r.path("bin.dat"), Buffer.from([0xff, 0x00, 0xfe, 0x0a]));
      const snap = snapshotTargets(r.root, ["bin.dat"]);
      r.write("bin.dat", "text\n");
      restoreSnapshot(snap);
      expect(fs.readFileSync(r.path("bin.dat")).toString("hex")).toBe("ff00fe0a");
    } finally {
      r.rm();
    }
  });

  test("Snapshot Targets own 1: snapshot root is the given root and is never mutated by restore", () => {
    const r = tmpRoot();
    try {
      r.write("a.ts", "one\n");
      const snap = snapshotTargets(r.root, ["a.ts"]);
      expect(snap.root).toBe(r.root);
      r.write("a.ts", "two\n");
      restoreSnapshot(snap);
      expect(snap.entries.length).toBe(1);
      expect(snap.entries[0]?.path).toBe("a.ts");
      expect(Buffer.from(snap.entries[0]?.bytes ?? []).toString("utf8")).toBe("one\n");
      restoreSnapshot(snap);
      expect(r.read("a.ts")).toBe("one\n");
    } finally {
      r.rm();
    }
  });

  test("Snapshot Targets own 2: entries keep the targets' order and spelling", () => {
    const r = tmpRoot();
    try {
      r.write("z.ts", "z\n");
      r.write("dir/nested/x.ts", "x\n");
      const snap = snapshotTargets(r.root, ["z.ts", "missing.ts", "dir/nested/x.ts"]);
      expect(snap.entries.length).toBe(3);
      expect(snap.entries[0]?.path).toBe("z.ts");
      expect(snap.entries[1]?.path).toBe("missing.ts");
      expect(snap.entries[1]?.bytes).toBeNull();
      expect(snap.entries[2]?.path).toBe("dir/nested/x.ts");
      expect(Buffer.from(snap.entries[2]?.bytes ?? []).toString("utf8")).toBe("x\n");
    } finally {
      r.rm();
    }
  });

  test("Snapshot Targets own 3: a snapshot entry with bytes null removes a file written after the snapshot", () => {
    const r = tmpRoot();
    try {
      const snap = snapshotTargets(r.root, ["new.ts"]);
      expect(snap.entries[0]?.bytes).toBeNull();
      r.write("new.ts", "late\n");
      restoreSnapshot(snap);
      expect(r.exists("new.ts")).toBe(false);
      restoreSnapshot(snap);
      expect(r.exists("new.ts")).toBe(false);
    } finally {
      r.rm();
    }
  });

  test("Snapshot Targets own 4: empty string is a byte snapshot distinct from absence", () => {
    const r = tmpRoot();
    try {
      r.write("empty.ts", "");
      const snap = snapshotTargets(r.root, ["empty.ts"]);
      expect(snap.entries[0]?.bytes).not.toBeNull();
      expect(snap.entries[0]?.bytes?.length).toBe(0);
      r.write("empty.ts", "filled\n");
      restoreSnapshot(snap);
      expect(r.read("empty.ts")).toBe("");
    } finally {
      r.rm();
    }
  });

  test("Snapshot Targets own 5: bytes is a Uint8Array view of the file's contents", () => {
    const r = tmpRoot();
    try {
      r.write("a.ts", "old\n");
      const snap = snapshotTargets(r.root, ["a.ts"]);
      const entry: SnapshotEntry | undefined = snap.entries[0];
      expect(entry?.bytes).toBeInstanceOf(Uint8Array);
      expect(Array.from(entry?.bytes ?? [])).toEqual([0x6f, 0x6c, 0x64, 0x0a]);
    } finally {
      r.rm();
    }
  });
});
