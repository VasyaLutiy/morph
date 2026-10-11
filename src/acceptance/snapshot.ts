import type { SnapshotEntry, TargetSnapshot } from "./types.js";
import * as fs from "node:fs";
import * as path from "node:path";

export function snapshotTargets(root: string, targets: string[]): TargetSnapshot {
  const entries: SnapshotEntry[] = [];
  for (const p of targets) {
    const abs = path.join(root, p);
    const isFile = fs.statSync(abs, { throwIfNoEntry: false })?.isFile() ?? false;
    entries.push({ path: p, bytes: isFile ? fs.readFileSync(abs) : null });
  }
  return { root, entries };
}

export function restoreSnapshot(snapshot: TargetSnapshot): void {
  for (const entry of snapshot.entries) {
    const abs = path.join(snapshot.root, entry.path);
    if (entry.bytes === null) {
      fs.rmSync(abs, { force: true });
    } else {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, entry.bytes);
    }
  }
}
