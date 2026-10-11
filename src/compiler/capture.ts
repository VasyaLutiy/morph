import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Card } from "../cards/types.js";
import type { InputDigest } from "./types.js";

function fileDigest(abs: string): string {
  const bytes: Buffer = fs.readFileSync(abs);
  return createHash("sha256").update(bytes).digest("hex").slice(0, 16);
}

export function captureInputs(card: Card, root: string): InputDigest {
  const declared = new Set<string>([...card.contextSlice, ...card.targets]);
  const sorted = [...declared].sort();
  const digest: InputDigest = {};
  for (const p of sorted) {
    const abs = path.join(root, p);
    let stat: fs.Stats | null = null;
    try {
      stat = fs.statSync(abs);
    } catch {
      stat = null; // missing path: absent
    }
    digest[p] = stat !== null && stat.isFile() ? fileDigest(abs) : "absent";
  }
  return digest;
}

function valueOf(digest: InputDigest, key: string): string | undefined {
  return Object.hasOwn(digest, key) ? digest[key] : undefined;
}

export function compareCaptures(before: InputDigest, after: InputDigest): string[] {
  const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (valueOf(before, key) !== valueOf(after, key)) changed.push(key);
  }
  return changed.sort();
}
