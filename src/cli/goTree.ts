import fs from "node:fs";
import path from "node:path";
import type { GoTree } from "../planner/hideLater.js";

const MODULE_LINE = /^module\s+(\S+)/m;
const QUOTED = /"([^"]*)"/;
const SKIP_DIRS = new Set<string>(["vendor", "testdata"]);

// The module path: the first line of root/go.mod matching `module <path>`.
function readModulePath(root: string): string | null {
  let text: string;
  try {
    text = fs.readFileSync(path.join(root, "go.mod"), "utf8");
  } catch {
    return null;
  }
  const match = MODULE_LINE.exec(text);
  return match === null ? null : match[1];
}

// Every regular .go file under root, the go tool's own rules: vendor, testdata,
// dot and underscore directories and dot and underscore files are skipped, and a
// symbolic link is neither a directory nor a file. Paths relative, joined by "/".
function walkGoFiles(root: string): string[] {
  const found: string[] = [];
  const visit = (abs: string, rel: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const name = entry.name;
      if (entry.isDirectory()) {
        if (name.startsWith(".") || name.startsWith("_")) continue;
        if (SKIP_DIRS.has(name)) continue;
        visit(path.join(abs, name), rel === "" ? name : rel + "/" + name);
      } else if (entry.isFile()) {
        if (name.startsWith(".") || name.startsWith("_")) continue;
        if (!name.endsWith(".go")) continue;
        found.push(rel === "" ? name : rel + "/" + name);
      }
    }
  };
  visit(root, "");
  return found.sort();
}

// A line's quoted import path once its `//` comment is removed.
function quotedPath(line: string): string | null {
  const at = line.indexOf("//");
  const cleaned = at === -1 ? line : line.slice(0, at);
  const match = QUOTED.exec(cleaned);
  return match === null ? null : match[1];
}

// The import declarations of a Go file: a line starting with `import` followed by
// an optional name and a quoted path, and the lines of an `import (` … `)` block.
function importPaths(text: string): string[] {
  const paths: string[] = [];
  let inBlock = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (inBlock) {
      if (line.startsWith(")")) {
        inBlock = false;
        continue;
      }
      const quoted = quotedPath(line);
      if (quoted !== null) paths.push(quoted);
      continue;
    }
    if (!line.startsWith("import")) continue;
    const rest = line.slice("import".length).trim();
    if (rest.startsWith("(")) {
      inBlock = true;
      const quoted = quotedPath(rest.slice(1));
      if (quoted !== null) paths.push(quoted);
      continue;
    }
    const quoted = quotedPath(rest);
    if (quoted !== null) paths.push(quoted);
  }
  return paths;
}

// An import path of the module itself, as a directory; null for anything else.
function ownPackage(importPath: string, modulePath: string): string | null {
  if (importPath === modulePath) return ".";
  const prefix = modulePath + "/";
  if (importPath.startsWith(prefix)) return importPath.slice(prefix.length);
  return null;
}

export function readGoTree(root: string): GoTree {
  const modulePath = readModulePath(root);
  const files = walkGoFiles(root);
  const imports: Record<string, string[]> = {};
  for (const file of files) {
    const own: string[] = [];
    if (modulePath !== null) {
      const text = fs.readFileSync(path.join(root, file), "utf8");
      for (const importPath of importPaths(text)) {
        const pkg = ownPackage(importPath, modulePath);
        if (pkg === null) continue;
        if (own.includes(pkg)) continue;
        own.push(pkg);
      }
    }
    imports[file] = own;
  }
  return { files, imports };
}
