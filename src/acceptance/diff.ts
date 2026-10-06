// src/acceptance/diff.ts — Build Attempt Diff (TASK_P3 §2.2).
// Pure: no imports, no clock, no randomness, no environment.

export const DIFF_CAP = 6000;

interface Op {
  kind: " " | "-" | "+";
  line: string;
  o: number; // 1-based old line number, 0 when the op has no old line
  n: number; // 1-based new line number, 0 when the op has no new line
}

function linesOf(text: string | null): string[] {
  if (text === null || text === "") return [];
  if (text.endsWith("\n")) return text.slice(0, -1).split("\n");
  return text.split("\n");
}

function editScript(a: readonly string[], b: readonly string[]): Op[] {
  // L[i][j] = LCS length of a[i..], b[j..]
  const L: number[][] = [];
  for (let i = 0; i <= a.length; i++) L.push(new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  let o = 1;
  let n = 1;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ kind: " ", line: a[i], o, n });
      i++; j++; o++; n++;
    } else if (L[i + 1][j] >= L[i][j + 1]) {
      ops.push({ kind: "-", line: a[i], o, n: 0 });
      i++; o++;
    } else {
      ops.push({ kind: "+", line: b[j], o: 0, n });
      j++; n++;
    }
  }
  while (i < a.length) {
    ops.push({ kind: "-", line: a[i], o, n: 0 });
    i++; o++;
  }
  while (j < b.length) {
    ops.push({ kind: "+", line: b[j], o: 0, n });
    j++; n++;
  }
  return ops;
}

function hunkText(ops: readonly Op[], start: number, end: number): string {
  let on = 0;
  let nn = 0;
  for (let k = start; k < end; k++) {
    const op = ops[k];
    if (op.kind === " " || op.kind === "-") on++;
    if (op.kind === " " || op.kind === "+") nn++;
  }
  let os: number;
  let ns: number;
  if (on === 0) {
    os = start > 0 ? ops[start - 1].o : 0;
  } else {
    os = ops[start].o;
  }
  if (nn === 0) {
    ns = start > 0 ? ops[start - 1].n : 0;
  } else {
    ns = ops[start].n;
  }
  let out = `@@ -${os},${on} +${ns},${nn} @@\n`;
  for (let k = start; k < end; k++) {
    out += ops[k].kind + ops[k].line + "\n";
  }
  return out;
}

function diffFile(oldText: string | null, newText: string): string {
  const a = linesOf(oldText);
  const b = linesOf(newText);
  if (a.length === b.length) {
    let equal = true;
    for (let k = 0; k < a.length; k++) {
      if (a[k] !== b[k]) { equal = false; break; }
    }
    if (equal) return "";
  } else if (oldText === newText) {
    return "";
  }
  const ops = editScript(a, b);
  // Indices of changed ops.
  const changes: number[] = [];
  for (let k = 0; k < ops.length; k++) {
    if (ops[k].kind !== " ") changes.push(k);
  }
  let out = "";
  let g = 0;
  while (g < changes.length) {
    let last = g;
    while (last + 1 < changes.length && changes[last + 1] - changes[last] - 1 <= 6) {
      last++;
    }
    const start = Math.max(0, changes[g] - 3);
    const end = Math.min(ops.length, changes[last] + 3 + 1);
    out += hunkText(ops, start, end);
    g = last + 1;
  }
  return out;
}

export function buildAttemptDiff(
  before: Record<string, string | null>,
  after: Record<string, string>,
): string {
  let text = "";
  for (const p of Object.keys(after)) {
    const oldText = before[p] ?? null;
    const header = oldText === null ? "--- /dev/null\n" : `--- a/${p}\n`;
    const body = diffFile(oldText, after[p]);
    if (body !== "") {
      text += header + `+++ b/${p}\n` + body;
    }
  }
  if (text.length <= DIFF_CAP) return text;
  const marker = `[diff clipped: ${text.length} chars]\n`;
  return text.slice(0, DIFF_CAP - marker.length - 1) + "\n" + marker;
}
