// src/acceptance/diff.ts — Build Attempt Diff (TASK_P3 §2.2, rules 1–5).
//
// A unified diff of the failed variant against the snapshot, capped at
// DIFF_CAP chars. Pure: no imports, no clock, no randomness, no environment.
//
// Rules (the record is the contract; the illustrations below were computed
// by a reference implementation of exactly these rules):
//   1. one file section per key of `after`, in Object.keys order; a missing
//      or null `before` is an absent file; equal line arrays contribute
//      nothing (so "a" vs "a\n" is no change);
//   2. header `--- a/<p>` (or `--- /dev/null`) then `+++ b/<p>`;
//   3. edit script by LCS: match, else delete when L[i+1][j] >= L[i][j+1]
//      (deletions before additions inside a changed region);
//   4. hunks of 3 context ops around changes; changes with 6 or fewer
//      context ops between them share one hunk; both counts always printed;
//   5. over DIFF_CAP chars: slice, "\n", then the clip marker, exactly
//      DIFF_CAP chars.

/** The cap of the returned diff, in chars. */
export const DIFF_CAP = 6000;

/** One edit-script operation: context, deletion or addition. */
interface Op {
  readonly kind: " " | "-" | "+";
  readonly line: string;
}

/**
 * The lines of a file's text: `[]` for `null` (absent) and for `""`; else
 * `split("\n")` without the last element when the text ends in `\n`.
 */
function linesOf(text: string | null): string[] {
  if (text === null || text === "") return [];
  const parts: string[] = text.split("\n");
  if (text.endsWith("\n")) parts.pop();
  return parts;
}

/**
 * The edit script of `a` (old lines) and `b` (new lines) by LCS.
 * `L[i][j]` is the LCS length of `a[i..]` and `b[j..]`; the walk matches
 * equal heads, else deletes when `L[i + 1][j] >= L[i][j + 1]`, so that
 * within a changed region deletions come before additions. The leftovers
 * of `a` are deletions, then the leftovers of `b` additions.
 */
function editOps(a: readonly string[], b: readonly string[]): Op[] {
  const n: number = a.length;
  const m: number = b.length;
  const L: number[][] = Array.from(
    { length: n + 1 },
    (): number[] => new Array<number>(m + 1).fill(0)
  );
  for (let i: number = n - 1; i >= 0; i--) {
    for (let j: number = m - 1; j >= 0; j--) {
      L[i][j] =
        a[i] === b[j]
          ? L[i + 1][j + 1] + 1
          : Math.max(L[i + 1][j], L[i][j + 1]);
    }
  }
  const ops: Op[] = [];
  let i: number = 0;
  let j: number = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: " ", line: a[i] });
      i++;
      j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) {
      ops.push({ kind: "-", line: a[i] });
      i++;
    } else {
      ops.push({ kind: "+", line: b[j] });
      j++;
    }
  }
  while (i < n) {
    ops.push({ kind: "-", line: a[i] });
    i++;
  }
  while (j < m) {
    ops.push({ kind: "+", line: b[j] });
    j++;
  }
  return ops;
}

/**
 * The hunks of an edit script: every changed op keeps up to 3 context ops
 * before and after; two changes with 6 or fewer context ops between them
 * share one hunk. The header prints both counts always; `os` is the 1-based
 * old line number of the hunk's first old line (the number of old lines
 * before the hunk when `on` is 0), `ns` the 1-based new line number of the
 * hunk's first context or addition op — a leading deletion does not move it
 * (the number of new lines before the hunk only when `nn` is 0). Every op
 * line ends in `\n`; there is no "\ No newline" marker.
 */
function hunksOf(ops: readonly Op[]): string {
  const changed: number[] = [];
  for (let k: number = 0; k < ops.length; k++) {
    if (ops[k].kind !== " ") changed.push(k);
  }
  if (changed.length === 0) return "";
  const groups: Array<[number, number]> = [];
  let start: number = changed[0];
  let end: number = changed[0];
  for (let k: number = 1; k < changed.length; k++) {
    if (changed[k] - changed[k - 1] - 1 <= 6) {
      end = changed[k];
    } else {
      groups.push([start, end]);
      start = changed[k];
      end = changed[k];
    }
  }
  groups.push([start, end]);
  let out: string = "";
  for (const group of groups) {
    const first: number = Math.max(0, group[0] - 3);
    const last: number = Math.min(ops.length - 1, group[1] + 3);
    let oldBefore: number = 0;
    let newBefore: number = 0;
    for (let k: number = 0; k < first; k++) {
      if (ops[k].kind !== "+") oldBefore++;
      if (ops[k].kind !== "-") newBefore++;
    }
    let on: number = 0;
    let nn: number = 0;
    for (let k: number = first; k <= last; k++) {
      if (ops[k].kind !== "+") on++;
      if (ops[k].kind !== "-") nn++;
    }
    const os: number = on > 0 ? oldBefore + 1 : oldBefore;
    // The first context or addition op of the hunk is preceded inside the
    // hunk only by deletions, which consume no new lines.
    const ns: number = nn > 0 ? newBefore + 1 : newBefore;
    out += "@@ -" + os + "," + on + " +" + ns + "," + nn + " @@\n";
    for (let k: number = first; k <= last; k++) {
      out += ops[k].kind + ops[k].line + "\n";
    }
  }
  return out;
}

/**
 * Build the attempt diff: for each path of `after` in its key order whose
 * lines differ from `before` (a missing or null entry is an absent file),
 * the file headers and the hunks; `""` when nothing changed; capped at
 * DIFF_CAP chars by the clip marker, to exactly DIFF_CAP chars.
 */
export function buildAttemptDiff(
  before: Record<string, string | null>,
  after: Record<string, string>
): string {
  let text: string = "";
  for (const p of Object.keys(after)) {
    const old: string | null = before[p] ?? null;
    const a: string[] = linesOf(old);
    const b: string[] = linesOf(after[p]);
    const same: boolean =
      a.length === b.length && a.every((line: string, k: number): boolean => line === b[k]);
    if (same) continue;
    text += old === null ? "--- /dev/null\n" : "--- a/" + p + "\n";
    text += "+++ b/" + p + "\n";
    text += hunksOf(editOps(a, b));
  }
  if (text.length <= DIFF_CAP) return text;
  const marker: string = "[diff clipped: " + text.length + " chars]\n";
  return text.slice(0, DIFF_CAP - marker.length - 1) + "\n" + marker;
}
