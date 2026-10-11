// Guard of a TypeScript project: the layer rules and the Guardrail rules of the record, and the test-file rules,
// checked on the TypeScript syntax tree (never by grep: a word in a comment is not an import). `morph plan --checks`
// inlines this file into every acceptance.
// morph-guard-contract: 3
//   node guard.mjs src <file,file,...> <pkgs> <layers> <rules>  these files, all four arguments written by
//                                                        `morph plan --checks` from the record:
//     pkgs   = the packages the card's Component declares (`uses`, of System.dependencies), ","-joined ('' none): the
//              only npm packages these files may import (node:* is always allowed unless a rule forbids it);
//     layers = JSON {"<dir>": ["<dir it may import>", ...]} from the `uses: <Component>` steps (contract 2); a dir's
//              layer is its first folder under src/;
//     rules  = JSON {"<dir>": {"<rule id>": "<the Guardrail and where the record attaches it>"}} from the record's
//              canonical Guardrail names (contract 3), keyed by the file's directory.
//              A missing layers or rules argument is red, never "everything allowed" (issue #46): re-cut with morph plan.
//   node guard.mjs helpers <file> <name,name,...>        the stub module: node:* only, these exports
//   node guard.mjs tests <file> <min> <max> [lits.json]  one test file; lits = strings it must hold; it may import
//                                                        vitest, node:*, relative paths and package.json's dependencies
// Rule ids (a red names the file and line):
//   no-shell     no import of node:child_process
//   no-clock     no Date, no Math.random
//   no-network   no fetch, WebSocket, XMLHttpRequest; no import of node:net, node:http, node:https, node:http2,
//                node:dgram, node:tls
//   no-env       no process.env
//   no-process   no process, no console
//   stdlib-only  no package import (node:* and relative paths only), the declared packages included
//   pure         of node:* only node:path; no fetch, WebSocket, XMLHttpRequest, Date, console, process, Math.random
// No file beside the record is read: every allowed package, layer and rule comes in the arguments (P31b, issue #42).
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

const bad = [];
const RULE_ORDER = ["no-shell", "no-clock", "no-network", "no-env", "no-process", "stdlib-only", "pure"];
const NET_MODULES = ["net", "http", "https", "http2", "dgram", "tls"];

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

// the layers argument keyed by layer: a dir's layer is the first folder under src/ (src/report/x → report)
function edgeLayers(edges) {
  const out = {};
  for (const [dir, dirs] of Object.entries(edges)) {
    const key = layerOf(dir + "/_");
    if (key === null) continue;
    out[key] ??= [];
    for (const d of dirs) {
      const k = layerOf(d + "/_");
      if (k !== null && !out[key].includes(k)) out[key].push(k);
    }
  }
  return out;
}

function bare(spec) {
  return spec.startsWith("node:") ? spec.slice(5) : spec;
}
function importRules(spec) {
  const out = [];
  const rel = spec.startsWith("./") || spec.startsWith("../");
  const name = bare(spec);
  if (name === "child_process") out.push("no-shell");
  if (NET_MODULES.includes(name)) out.push("no-network");
  if (!rel && !spec.startsWith("node:")) out.push("stdlib-only");
  if (spec.startsWith("node:") && spec !== "node:path") out.push("pure");
  return out;
}
function nameRules(n) {
  if (n === "Date") return ["no-clock", "pure"];
  if (["fetch", "WebSocket", "XMLHttpRequest"].includes(n)) return ["no-network", "pure"];
  if (n === "process" || n === "console") return ["no-process", "pure"];
  return [];
}

function checkSrc(files, allowed, edges, rules) {
  const packages = allowed;
  const layers = edgeLayers(edges);
  for (const file of files ?? tsFiles("src")) {
    const sf = parse(file);
    const rel = file.split(path.sep).join("/");
    const layer = layerOf(rel);
    const active = rules[path.posix.dirname(rel)] ?? {};
    const first = (ids) => RULE_ORDER.find((id) => ids.includes(id) && id in active);
    const rule = (node, what, ids) => {
      const id = first(ids);
      if (id) bad.push(`guard: ${rel}:${line(sf, node)}: ${what}: ${active[id]}`);
      return id !== undefined;
    };
    for (const [node, spec] of moduleSpecifiers(sf)) {
      if (rule(node, `imports ${spec}`, importRules(spec))) continue;
      if (spec.startsWith("node:")) continue;
      if (!spec.startsWith("./") && !spec.startsWith("../")) {
        if (!packages.some((p) => spec === p || spec.startsWith(p + "/")))
          report(sf, node, `package import "${spec}" (allowed: node:*${packages.length ? ", " + packages.join(", ") : ""})`);
        continue;
      }
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec));
      const tl = layerOf(target);
      if (layer === null || tl === null || tl === layer) continue;
      const may = layers[layer] ?? [];
      if (!may.includes(tl))
        report(sf, node, `layer ${layer} imports layer ${tl}: the record has no 'uses' from ${layer} to ${tl} (allowed: ${may.join(", ") || "none"})`);
    }
    walk(sf, (node) => {
      if (node.kind === ts.SyntaxKind.AnyKeyword) report(sf, node, "explicit any");
      if (ts.isIdentifier(node) && isValueRef(node)) {
        const n = node.text;
        rule(node, `uses ${n}`, nameRules(n));
        if (n === "Math" && node.parent && ts.isPropertyAccessExpression(node.parent) && node.parent.name.text === "random")
          rule(node, "uses Math.random", ["no-clock", "pure"]);
      }
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) &&
          node.expression.text === "process" && node.name.text === "env")
        rule(node, "uses process.env", ["no-env"]);
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
  // package.json's "dependencies": the packages the scaffold installed for the declared dependencies; a
  // test may import them (a judge building a declared library's value). devDependencies stay out, vitest excepted.
  const deps = fs.existsSync("package.json") ? Object.keys(JSON.parse(fs.readFileSync("package.json", "utf8")).dependencies ?? {}) : [];
  for (const [node, spec] of moduleSpecifiers(sf))
    if (spec !== "vitest" && !spec.startsWith("node:") && !spec.startsWith("./") && !spec.startsWith("../") &&
        !deps.some((p) => spec === p || spec.startsWith(p + "/")))
      report(sf, node, `import of a package "${spec}" (vitest, node:*${deps.length ? ", relative paths, " + deps.join(", ") : " and relative paths"} only)`);
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
if (mode === "src" && c === undefined) bad.push("guard: no layer edges given — re-cut with morph plan");
else if (mode === "src" && d === undefined) bad.push("guard: no Guardrail rules given — re-cut with morph plan");
else if (mode === "src") checkSrc(a ? a.split(",").filter(Boolean) : null, (b ?? "").split(",").filter(Boolean), JSON.parse(c), JSON.parse(d));
else if (mode === "helpers") checkHelpers(a, (b ?? "").split(",").filter(Boolean));
else if (mode === "tests") checkTest(a, Number(b), Number(c), d ? JSON.parse(fs.readFileSync(d, "utf8")) : []);
else bad.push(`guard: unknown mode ${mode}`);
for (const x of bad) console.log(x);
process.exit(bad.length ? 1 : 0);
