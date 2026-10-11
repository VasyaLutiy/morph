import type { Card } from "./types.js";

export const TRANSACTION_MARK = "# morph: subset transaction";

export function isTransactionDeck(cards: readonly Card[]): boolean {
  const mark = TRANSACTION_MARK + "\n";
  for (const card of cards) {
    const acceptance = card.acceptance;
    if (typeof acceptance === "string" && acceptance.startsWith(mark)) {
      return true;
    }
  }
  return false;
}

export interface Blame {
  cards: string[];
  outside: string[];
}

export interface TestLines {
  failLine: string | null;
  locationLine: string | null;
  packageLine: string | null;
}

export interface NeighbourRule {
  file: string;
  directory: boolean;
  testFile: string | null;
  module: string | null;
}

function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

function resolveAgainstDir(dir: string, spec: string): string {
  const parts: string[] = dir === "" ? [] : dir.split("/");
  for (const seg of spec.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      parts.pop();
      continue;
    }
    parts.push(seg);
  }
  return parts.join("/");
}

function withSourceExt(path: string): string {
  const i = path.lastIndexOf(".");
  if (i === -1) return path;
  const ext = path.slice(i);
  let replacement: string | null = null;
  if (ext === ".js") replacement = ".ts";
  else if (ext === ".jsx") replacement = ".tsx";
  else if (ext === ".mjs") replacement = ".mts";
  else if (ext === ".cjs") replacement = ".cts";
  if (replacement === null) return path;
  return path.slice(0, i) + replacement;
}

function neighboursOf(
  rule: NeighbourRule,
  p: string,
  rest: string,
  owners: Record<string, string>,
): string[] {
  const result = new Set<string>();
  const dir = dirOf(p);
  const fileRe = new RegExp(rule.file);
  const testRe = rule.testFile === null ? null : new RegExp(rule.testFile);
  const pIsTest = testRe !== null && testRe.test(p);
  if (rule.directory) {
    for (const k of Object.keys(owners)) {
      if (!fileRe.test(k)) continue;
      if (dirOf(k) !== dir) continue;
      if (testRe !== null && !pIsTest && testRe.test(k)) continue;
      result.add(k);
    }
  }
  if (rule.module !== null) {
    const moduleRe = new RegExp(rule.module, "g");
    let m: RegExpExecArray | null = moduleRe.exec(rest);
    while (m !== null) {
      const g1 = m[1];
      if (g1 !== undefined) {
        const s = resolveAgainstDir(dir, g1);
        const candidates = [s, withSourceExt(s)];
        for (const c of candidates) {
          if (Object.prototype.hasOwnProperty.call(owners, c)) {
            result.add(c);
            break;
          }
        }
      }
      if (m.index === moduleRe.lastIndex) moduleRe.lastIndex++;
      m = moduleRe.exec(rest);
    }
  }
  return Array.from(result);
}

export function blameLog(
  log: string,
  card: string,
  owners: Record<string, string>,
  fileLines: readonly string[],
  exists: (path: string) => boolean,
  testLines: readonly TestLines[] = [],
  neighbours: readonly NeighbourRule[] = [],
): Blame {
  const cards = new Set<string>();
  const outside = new Set<string>();
  let matchedFile = false;
  let matchedTest = false;

  const rawLines = log.split("\n");

  const packages: { index: number; name: string }[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    if (raw === undefined) continue;
    const line = raw.trimEnd();
    for (const pattern of testLines) {
      if (pattern.packageLine === null) continue;
      const m = new RegExp(pattern.packageLine).exec(line);
      if (m !== null) {
        const name = m[1];
        if (name !== undefined) packages.push({ index: i, name });
        break;
      }
    }
  }

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    if (raw === undefined) continue;
    const line = raw.trimEnd();
    if (line === "") continue;

    const first = line.charAt(0);
    if (first === "#") continue;

    const indented = first === " " || first === "\t";

    if (!indented) {
      let lineMatchedFile = false;
      for (const source of fileLines) {
        const match = new RegExp(source).exec(line);
        if (match === null) continue;
        lineMatchedFile = true;
        matchedFile = true;
        const path = match[1];
        if (path === undefined) break;
        const rest = match[2] ?? "";
        if (Object.prototype.hasOwnProperty.call(owners, path)) {
          cards.add(owners[path]);
        } else if (!exists(path)) {
          cards.add(card);
        } else {
          let some = false;
          for (const rule of neighbours) {
            if (!new RegExp(rule.file).test(path)) continue;
            const ns = neighboursOf(rule, path, rest, owners);
            if (ns.length > 0) {
              for (const k of ns) {
                cards.add(owners[k]);
              }
              some = true;
            }
            break;
          }
          if (!some) {
            outside.add(path + rest);
          }
        }
        break;
      }
      if (lineMatchedFile) continue;
    }

    for (const pattern of testLines) {
      let kind: "fail" | "location" | "package" | null = null;
      let captured: string | undefined;
      if (pattern.failLine !== null) {
        const m = new RegExp(pattern.failLine).exec(line);
        if (m !== null) {
          kind = "fail";
          captured = m[1];
        }
      }
      if (kind === null && pattern.locationLine !== null) {
        const m = new RegExp(pattern.locationLine).exec(line);
        if (m !== null) {
          kind = "location";
          captured = m[1];
        }
      }
      if (kind === null && pattern.packageLine !== null) {
        const m = new RegExp(pattern.packageLine).exec(line);
        if (m !== null) {
          kind = "package";
          captured = m[1];
        }
      }
      if (kind === null) continue;

      matchedTest = true;

      if (kind === "package") break;
      if (captured === undefined) break;

      let resolved = captured;
      if (kind === "location" && !resolved.includes("/")) {
        let k: string | null = null;
        for (const pkg of packages) {
          if (pkg.index > i) {
            k = pkg.name;
            break;
          }
        }
        if (k === null) {
          for (const pkg of packages) {
            if (pkg.index < i) {
              k = pkg.name;
            } else {
              break;
            }
          }
        }
        if (k !== null) {
          resolved = k + "/" + captured;
        }
      }

      const candidates: string[] = [];
      let cursor = resolved.startsWith("/") ? resolved.slice(1) : resolved;
      candidates.push(cursor);
      while (cursor.includes("/")) {
        cursor = cursor.slice(cursor.indexOf("/") + 1);
        candidates.push(cursor);
      }

      let handled = false;
      for (const candidate of candidates) {
        if (Object.prototype.hasOwnProperty.call(owners, candidate)) {
          cards.add(owners[candidate]);
          handled = true;
          break;
        }
        if (exists(candidate)) {
          handled = true;
          break;
        }
      }
      if (!handled && !resolved.startsWith("/")) {
        cards.add(card);
      }
      break;
    }
  }

  if (cards.size === 0 && outside.size === 0 && !matchedFile && !matchedTest) {
    cards.add(card);
  }

  return {
    cards: Array.from(cards).sort(),
    outside: Array.from(outside).sort(),
  };
}
