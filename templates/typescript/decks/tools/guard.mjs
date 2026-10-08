// Guard of a TypeScript project: the layer rules of decks/tools/layers.json and the test-file rules, checked on the
// TypeScript syntax tree (never by grep: a word in a comment is not an import). `morph plan --checks` inlines this file
// into every acceptance.
//   node guard.mjs src [file,file,...] [pkg,pkg,...]     every .ts under src/, or only these; the packages the card's
//                                                        Component declares (`uses`), allowed in these files only
//   node guard.mjs helpers <file> <name,name,...>        the stub module: node:* only, these exports
//   node guard.mjs tests <file> <min> <max> [lits.json]  one test file; lits = strings it must hold
// decks/tools/layers.json:
//   "layers":   {"<dir under src/>": ["<dir it may import>", ...] or "*"}; null → every folder may import every other
//   "pure":     folders with no clock, randomness, environment, network, console or process; of node:* only node:path
//   "entry":    the one file that touches process (argv, env, exit code) and console, e.g. "src/cli.ts"; null → none
//   "packages": npm packages every file of src/ may import (node:* is always allowed outside the pure folders); a
//               package one Component uses is declared in contour.yaml instead and reaches the guard per card
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

const bad = [];
const CONF = fs.existsSync("decks/tools/layers.json")
  ? JSON.parse(fs.readFileSync("decks/tools/layers.json", "utf8"))
  : {};
const LAYERS = CONF.layers ?? null;
const PURE = new Set(CONF.pure ?? []);
const ENTRY = CONF.entry ?? null;
const PACKAGES = CONF.packages ?? [];

function parse(file) {
  return ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}
function line(sf, node) {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}
function report(sf, node, rule) {
  bad.push(`guard: ${sf.fileName}:${line(sf, node)} ${rule}`);
}
function walk(node, fn) {
  fn(node);
  ts.forEachChild(node, (child) => walk(child, fn));
}
// an identifier that refers to a value binding (not a property name, a type, a declared name)
function isValueRef(node) {
  const p = node.parent;
  if (!p) return false;
  if (ts.isPropertyAccessExpression(p) && p.name === node) return false;
  if ((ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p) || ts.isPropertySignature(p) ||
       ts.isMethodDeclaration(p) || ts.isMethodSignature(p) || ts.isGetAccessor(p) ||
       ts.isSetAccessor(p) || ts.isEnumMember(p)) && p.name === node) return false;
  if (ts.isTypeReferenceNode(p) || ts.isQualifiedName(p) || ts.isTypeQueryNode(p)) return false;
  if ((ts.isParameter(p) || ts.isVariableDeclaration(p) || ts.isFunctionDeclaration(p) ||
       ts.isBindingElement(p)) && p.name === node) return false;
  if (ts.isImportSpecifier(p) || ts.isExportSpecifier(p) || ts.isImportClause(p)) return false;
  if (ts.isLabeledStatement(p) || ts.isBreakOrContinueStatement(p)) return false;
  return true;
}
function tsFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...tsFiles(f));
    else if (f.endsWith(".ts")) out.push(f);
  }
  return out.sort();
}
function moduleSpecifiers(sf) {
  const out = [];
  walk(sf, (node) => {
    if ((ts.isImportDeclaration(node) || (ts.isExportDeclaration(node) && node.moduleSpecifier)) &&
        ts.isStringLiteralLike(node.moduleSpecifier)) out.push([node, node.moduleSpecifier.text]);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)
      report(sf, node, "dynamic import");
  });
  return out;
}
function layerOf(rel) {
  const parts = rel.split("/");
  return parts.length >= 3 && parts[0] === "src" ? parts[1] : null;
}

function checkSrc(files, allowed) {
  const packages = [...PACKAGES, ...allowed];
  for (const file of files ?? tsFiles("src")) {
    const sf = parse(file);
    const rel = file.split(path.sep).join("/");
    const layer = layerOf(rel);
    if (LAYERS !== null && layer !== null && !(layer in LAYERS)) {
      bad.push(`guard: ${rel} is in an unknown layer "${layer}" (have: ${Object.keys(LAYERS).join(", ") || "none"})`);
      continue;
    }
    const pure = layer !== null && PURE.has(layer);
    for (const [node, spec] of moduleSpecifiers(sf)) {
      if (spec.startsWith("node:")) {
        if (pure && spec !== "node:path") report(sf, node, `${spec} in the pure layer ${layer} (only node:path)`);
        continue;
      }
      if (!spec.startsWith("./") && !spec.startsWith("../")) {
        if (!packages.some((p) => spec === p || spec.startsWith(p + "/")))
          report(sf, node, `package import "${spec}" (allowed: node:*${packages.length ? ", " + packages.join(", ") : ""})`);
        continue;
      }
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec));
      const tl = layerOf(target);
      if (LAYERS === null || layer === null || tl === null || tl === layer) continue;
      const allowed = LAYERS[layer];
      if (allowed !== "*" && !allowed.includes(tl))
        report(sf, node, `layer ${layer} imports layer ${tl} (allowed: ${allowed.join(", ") || "none"})`);
    }
    walk(sf, (node) => {
      if (node.kind === ts.SyntaxKind.AnyKeyword) report(sf, node, "explicit any");
      if (ts.isIdentifier(node) && isValueRef(node)) {
        const n = node.text;
        if (pure && ["fetch", "WebSocket", "XMLHttpRequest", "Date", "console", "process"].includes(n))
          report(sf, node, `${n} in the pure layer ${layer}`);
        if ((n === "process" || n === "console") && ENTRY !== null && rel !== ENTRY && !pure)
          report(sf, node, `${n} in ${rel} (only ${ENTRY} touches it; the rest gets it as a parameter)`);
        if (n === "Math" && node.parent && ts.isPropertyAccessExpression(node.parent) &&
            node.parent.name.text === "random" && pure) report(sf, node, `Math.random in the pure layer ${layer}`);
      }
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) &&
          node.expression.text === "process" && node.name.text === "exit")
        report(sf, node, "process.exit (set process.exitCode: exit cuts a piped stdout)");
    });
  }
}

function checkHelpers(file, names) {
  if (!fs.existsSync(file)) { bad.push(`guard: ${file} missing`); return; }
  const sf = parse(file);
  for (const [node, spec] of moduleSpecifiers(sf))
    if (!spec.startsWith("node:")) report(sf, node, `helpers import "${spec}" (node:* only)`);
  const exported = new Set();
  walk(sf, (node) => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) report(sf, node, "explicit any");
    const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) ?? [] : [];
    if (!mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) return;
    if ((ts.isFunctionDeclaration(node) || ts.isInterfaceDeclaration(node) ||
         ts.isTypeAliasDeclaration(node) || ts.isClassDeclaration(node)) && node.name)
      exported.add(node.name.text);
    if (ts.isVariableStatement(node))
      for (const d of node.declarationList.declarations) if (ts.isIdentifier(d.name)) exported.add(d.name.text);
  });
  for (const n of names) if (!exported.has(n)) bad.push(`guard: ${file} does not export ${n}`);
}

function checkTest(file, min, max, lits) {
  if (!fs.existsSync(file)) { bad.push(`guard: ${file} missing`); return; }
  const sf = parse(file);
  const text = sf.getFullText();
  let count = 0;
  for (const [node, spec] of moduleSpecifiers(sf))
    if (spec !== "vitest" && !spec.startsWith("node:") && !spec.startsWith("./") && !spec.startsWith("../"))
      report(sf, node, `import of a package "${spec}" (vitest, node:* and relative paths only)`);
  walk(sf, (node) => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) report(sf, node, "explicit any");
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
        (node.expression.text === "test" || node.expression.text === "it")) count += 1;
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
      const o = node.expression.text, p = node.name.text;
      if (["test", "it", "describe"].includes(o) && ["skip", "only", "todo", "fails"].includes(p))
        report(sf, node, `${o}.${p}`);
      if (o === "vi" && ["stubGlobal", "useFakeTimers", "mock", "doMock"].includes(p))
        report(sf, node, `vi.${p} (stubs come from tests/helpers.ts)`);
    }
    if (ts.isIdentifier(node) && isValueRef(node) && ["setTimeout", "setInterval", "setImmediate"].includes(node.text))
      report(sf, node, `${node.text} (real timers are not used under tests/; use fakeClock of tests/helpers.ts)`);
    const declared = (ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node) ||
      ts.isClassDeclaration(node)) && node.name && ts.isIdentifier(node.name) ? node.name.text : null;
    if (declared && (declared === "fetch" || /^[Ff]ake/.test(declared)))
      report(sf, node, `own stub "${declared}" (stubs come from tests/helpers.ts)`);
  });
  if (count < min || count > max) bad.push(`guard: ${file} has ${count} test/it calls, expected ${min}..${max}`);
  for (const lit of lits) if (!text.includes(lit)) bad.push(`guard: ${file} does not mention the example literal ${JSON.stringify(lit)}`);
}

const [mode, a, b, c, d] = process.argv.slice(2);
if (mode === "src") checkSrc(a ? a.split(",").filter(Boolean) : null, (b ?? "").split(",").filter(Boolean));
else if (mode === "helpers") checkHelpers(a, (b ?? "").split(",").filter(Boolean));
else if (mode === "tests") checkTest(a, Number(b), Number(c), d ? JSON.parse(fs.readFileSync(d, "utf8")) : []);
else bad.push(`guard: unknown mode ${mode}`);
for (const x of bad) console.log(x);
process.exit(bad.length ? 1 : 0);
