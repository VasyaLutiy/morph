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
  builder: ["cards", "language"],
  primer: ["cards", "git", "store", "language"],
  scout: ["cards", "processor", "wait", "primer"],
  reviewer: ["cards", "contour", "primer", "scout", "git"],
  runloop: ["cards", "wait", "store", "compiler", "response", "acceptance", "language",
    "git", "processor"],
  // P11b2: the detached batch commands (morph submit / morph collect), the processor layer's second Component
  batches: ["cards", "wait", "compiler", "processor"],
  cli: "*",
};
const ROOT_FILES = new Set(["src/index.ts"]);
const SHELL = new Set(["acceptance", "git"]);          // node:child_process
const NET = new Set(["processor"]);                    // fetch, WebSocket, XMLHttpRequest
const CONSOLE = new Set(["cli"]);                      // console, process.exit
const PROCESS = new Set(["cli", "processor", "acceptance"]);
const NO_CLOCK = new Set(["cards", "compiler", "response", "language", "contour", "planner", "builder", "batches", "primer"]);
// P12a: the one file of src/primer that turns the clock parameter deps.now() into an ISO string (docs/TASK_P12_primer.md §4)
const CLOCK_FORMATTERS = new Set(["src/primer/primerCommand.ts"]);
const YAML = new Set(["contour"]);
// P3: the acceptance gets the child's environment as a parameter (docs/TASK_P3_acceptance.md §4)
const NO_ENV = new Set(["acceptance", "processor", "git", "batches", "primer"]);
// P4: the one file of a NO_ENV layer that may read process.env (Read Registry, docs/TASK_P4_processor.md §4)
const ENV_READERS = new Set(["src/processor/registry.ts"]);
// P6: the one file of src/git that spawns (Run Git, docs/TASK_P6_git.md §4); git takes the env whole
const GIT_SPAWNER = "src/git/run.ts";
// P7: the binary's entry is src/cli.ts (package.json bin dist/cli.js), layer cli; it alone touches
// process (env, argv, cwd, stdout, exitCode) and the wall clock: src/cli/* gets them as parameters
// (docs/TASK_P7_cli.md §4)
const CLI_ENTRY = "src/cli.ts";
// P8: language is pure data and pure functions; of the Node modules only node:path (posix) is allowed
// (docs/TASK_P8_language.md §4)
// P9: contour reads text it is given: no Node module at all, and the package yaml only in Parse Document
// (src/contour/load.ts) (docs/TASK_P9_contour.md §4)
// P10a: planner is pure like language: of the Node modules only node:path (docs/TASK_P10a_planner.md §4)
// P10b: builder is pure the same way (docs/TASK_P10b_builder.md §4)
const NODE_ONLY = { language: new Set(["node:path"]), contour: new Set(), planner: new Set(["node:path"]),
  builder: new Set(["node:path"]) };
const YAML_FILE = "src/contour/load.ts";

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
  if (rel === CLI_ENTRY) return "cli";
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
        if (layer in NODE_ONLY && !NODE_ONLY[layer].has(spec))
          report(sf, node, `${spec} in the pure layer ${layer} (only ${[...NODE_ONLY[layer]].join(", ") || "none"})`);
        if (spec === "node:child_process" && !SHELL.has(layer))
          report(sf, node, `node:child_process outside src/acceptance and src/git`);
        if (spec === "node:child_process" && layer === "git" && rel !== GIT_SPAWNER)
          report(sf, node, `node:child_process in ${rel} (only ${GIT_SPAWNER} spawns git)`);
        continue;
      }
      if (spec === "yaml") {
        if (!YAML.has(layer)) report(sf, node, `"yaml" outside src/contour`);
        else if (rel !== YAML_FILE) report(sf, node, `"yaml" in ${rel} (only ${YAML_FILE} parses text)`);
        continue;
      }
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
        if ((n === "process" || n === "console") && layer === "cli" && rel !== CLI_ENTRY)
          report(sf, node, `${n} in ${rel} (only ${CLI_ENTRY} touches it; env, cwd, clock and io are parameters)`);
        if (n === "Date" && NO_CLOCK.has(layer) && !CLOCK_FORMATTERS.has(rel)) report(sf, node, `Date in the deterministic layer ${layer}`);
        if (n === "Math" && node.parent && ts.isPropertyAccessExpression(node.parent) &&
            node.parent.name.text === "random") report(sf, node, "Math.random");
      }
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) &&
          node.expression.text === "process" && node.name.text === "exit" && !CONSOLE.has(layer))
        report(sf, node, "process.exit outside src/cli");
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) &&
          node.expression.text === "process" && node.name.text === "exit" && rel === CLI_ENTRY)
        report(sf, node, `process.exit in ${CLI_ENTRY} (set process.exitCode: exit cuts a piped stdout)`);
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) &&
          node.expression.text === "Date" && node.name.text === "now" && layer === "cli" && rel !== CLI_ENTRY)
        report(sf, node, `Date.now in ${rel} (the clock is the parameter now)`);
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
