// MorphV2 guard: the layer rules of docs/CONVENTIONS.md and the test-file rules, checked on
// the TypeScript syntax tree. Inlined into every acceptance by decks/tools/build.py.
//   node guard.mjs src [file,file,...]                   every .ts under src/, or only these
//   node guard.mjs helpers <file> <name,name,...>        the stub module: node:* only, exports
//   node guard.mjs tests <file> <min> <max> [lits.json]  one test file; lits = strings it must hold
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

const bad = [];

// which internal layers a layer may import; "*" = any; unknown dirs are reported
const LAYERS = {
  cards: [], wait: [],
  response: ["cards"], store: ["cards"], compiler: ["cards"], language: ["cards"],
  contour: ["cards"], git: ["cards"], acceptance: ["cards", "wait", "compiler"],
  processor: ["cards", "wait", "compiler"], planner: ["cards", "contour", "language"],
  primer: ["cards", "git", "store", "language"],
  scout: ["cards", "processor", "wait", "primer"],
  reviewer: ["cards", "contour", "primer", "scout", "git"],
  runloop: ["cards", "wait", "store", "compiler", "response", "acceptance", "language",
    "git", "processor"],
  cli: "*",
};
const ROOT_FILES = new Set(["src/index.ts"]);
const SHELL = new Set(["acceptance", "git"]);          // node:child_process
const NET = new Set(["processor"]);                    // fetch, WebSocket, XMLHttpRequest
const CONSOLE = new Set(["cli"]);                      // console, process.exit
const PROCESS = new Set(["cli", "processor", "acceptance"]);
const NO_CLOCK = new Set(["cards", "compiler", "response", "language", "contour", "planner"]);
const YAML = new Set(["contour"]);
// P3: the acceptance gets the child's environment as a parameter (docs/TASK_P3_acceptance.md §4)
const NO_ENV = new Set(["acceptance", "processor", "git"]);
// P4: the one file of a NO_ENV layer that may read process.env (Read Registry, docs/TASK_P4_processor.md §4)
const ENV_READERS = new Set(["src/processor/registry.ts"]);
// P6: the one file of src/git that spawns (Run Git, docs/TASK_P6_git.md §4); git takes the env whole
const GIT_SPAWNER = "src/git/run.ts";

function parse(file) {
  return ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true,
    ts.ScriptKind.TS);
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

function checkSrc(files) {
  for (const file of files ?? tsFiles("src")) {
    const sf = parse(file);
    const rel = file.split(path.sep).join("/");
    const layer = layerOf(rel);
    if (layer === null && !ROOT_FILES.has(rel)) { bad.push(`guard: ${rel} is not under a layer directory`); continue; }
    if (layer !== null && !(layer in LAYERS)) { bad.push(`guard: ${rel} is in an unknown layer "${layer}"`); continue; }
    const allowed = layer === null ? [] : LAYERS[layer];
    for (const [node, spec] of moduleSpecifiers(sf)) {
      if (spec.startsWith("node:")) {
        if (spec === "node:child_process" && !SHELL.has(layer))
          report(sf, node, `node:child_process outside src/acceptance and src/git`);
        if (spec === "node:child_process" && layer === "git" && rel !== GIT_SPAWNER)
          report(sf, node, `node:child_process in ${rel} (only ${GIT_SPAWNER} spawns git)`);
        continue;
      }
      if (spec === "yaml") { if (!YAML.has(layer)) report(sf, node, `"yaml" outside src/contour`); continue; }
      if (!spec.startsWith("./") && !spec.startsWith("../")) { report(sf, node, `package import "${spec}" (node:* only)`); continue; }
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec));
      const tl = layerOf(target);
      if (tl === null) { if (!ROOT_FILES.has(target)) report(sf, node, `import of "${spec}" outside src/<layer>/`); continue; }
      if (tl !== layer && allowed !== "*" && !allowed.includes(tl))
        report(sf, node, `layer ${layer ?? "src"} imports layer ${tl} (allowed: ${allowed.join(", ") || "none"})`);
    }
    walk(sf, (node) => {
      if (node.kind === ts.SyntaxKind.AnyKeyword) report(sf, node, "explicit any");
      if (ts.isIdentifier(node) && isValueRef(node)) {
        const n = node.text;
        if (["fetch", "WebSocket", "XMLHttpRequest"].includes(n) && !NET.has(layer))
          report(sf, node, `global ${n} outside src/processor`);
        if (n === "console" && !CONSOLE.has(layer)) report(sf, node, "console outside src/cli");
        if (n === "process" && !PROCESS.has(layer)) report(sf, node, "process outside src/cli, src/processor, src/acceptance");
        if (n === "Date" && NO_CLOCK.has(layer)) report(sf, node, `Date in the deterministic layer ${layer}`);
        if (n === "Math" && node.parent && ts.isPropertyAccessExpression(node.parent) &&
            node.parent.name.text === "random") report(sf, node, "Math.random");
      }
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) &&
          node.expression.text === "process" && node.name.text === "exit" && !CONSOLE.has(layer))
        report(sf, node, "process.exit outside src/cli");
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) &&
          node.expression.text === "process" && node.name.text === "env" && NO_ENV.has(layer) &&
          !ENV_READERS.has(rel))
        report(sf, node, `process.env in src/${layer} (the environment is a parameter)`);
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
    if (ts.isIdentifier(node) && isValueRef(node) &&
        ["setTimeout", "setInterval", "setImmediate"].includes(node.text))
      report(sf, node, `${node.text} (real timers are not used under tests/; use fakeClock)`);
    const declared = (ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node) ||
      ts.isClassDeclaration(node)) && node.name && ts.isIdentifier(node.name) ? node.name.text : null;
    if (declared && (declared === "fetch" || /^[Ff]ake/.test(declared)))
      report(sf, node, `own stub "${declared}" (stubs come from tests/helpers.ts)`);
  });
  if (count < min || count > max)
    bad.push(`guard: ${file} has ${count} test/it calls, expected ${min}..${max}`);
  for (const lit of lits) if (!text.includes(lit)) bad.push(`guard: ${file} does not mention the example literal ${JSON.stringify(lit)}`);
}

const [mode, a, b, c, d] = process.argv.slice(2);
if (mode === "src") checkSrc(a ? a.split(",").filter(Boolean) : null);
else if (mode === "helpers") checkHelpers(a, (b ?? "").split(",").filter(Boolean));
else if (mode === "tests") checkTest(a, Number(b), Number(c), d ? JSON.parse(fs.readFileSync(d, "utf8")) : []);
else bad.push(`guard: unknown mode ${mode}`);
for (const x of bad) console.log(x);
process.exit(bad.length ? 1 : 0);
