// refcheck.mjs — docs/ORCHESTRATOR_REFERENCE.md against the built binary (issue #17).
// Usage (repo root, after `npm run build`): node decks/tools/refcheck.mjs [reference] [dist]
// Exit 0 = the marked parts of the reference agree with dist/; exit 1 = a line per mismatch.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ref = process.argv[2] ?? "docs/ORCHESTRATOR_REFERENCE.md";
const dist = path.resolve(process.argv[3] ?? "dist");
const load = (rel) => import(pathToFileURL(path.join(dist, rel)).href);
const { validateChecks, DEFAULT_FROZEN } = await load("builder/readChecks.js");
const { TRANSACTION_MARK } = await load("cards/transaction.js");
const { probeFile } = await load("builder/buildAcceptances.js");
const { TYPESCRIPT, GO } = await load("language/profiles.js");

const text = fs.readFileSync(ref, "utf8");
const bad = [];

// the line (or fenced block) right after <!-- refcheck: <name> -->
function marked(name) {
  const at = text.indexOf(`<!-- refcheck: ${name} -->`);
  if (at < 0) { bad.push(`marker '${name}' missing`); return ""; }
  const rest = text.slice(text.indexOf("\n", at) + 1);
  if (rest.startsWith("```")) {
    const open = rest.indexOf("\n") + 1;
    return rest.slice(open, rest.indexOf("\n```", open));
  }
  return rest.slice(0, rest.indexOf("\n"));
}
const ticks = (line) => [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
const same = (what, got, want) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${what}: reference ${JSON.stringify(got)}, binary ${JSON.stringify(want)}`);
};

// the key tables: read the binary's own lists off an "unknown key" problem
const probe = validateChecks({ phase: "x", zz: 1, cards: [{ id: "a", zz: 1, files: [{ file: "f", min: 0, max: 1, zz: 1 }] }] });
const known = (where) => {
  const p = probe.ok ? undefined : probe.problems.find((q) => q.startsWith(`${where}: unknown key 'zz'`));
  return p === undefined ? null : p.slice(p.indexOf("(known: ") + 8, -1).split(", ");
};
same("root keys", ticks(marked("root-keys")), known("(root)"));
same("card keys", ticks(marked("card-keys")), known("cards[0]"));
same("file keys", ticks(marked("file-keys")).slice(0, 6), known("cards[0].files[0]"));

// the example validates as it stands
let example = null;
try { example = JSON.parse(marked("example")); } catch (e) { bad.push(`example: not JSON (${e.message})`); }
if (example !== null) {
  const v = validateChecks(example);
  if (!v.ok) bad.push(`example: ${v.problems.join("; ")}`);
  else same("example parts default", v.checks.parts, `decks/${example.phase}/parts`);
}

// the transaction mark, the default frozen list, the probe file names
same("transaction mark", ticks(marked("mark"))[0], TRANSACTION_MARK);
const frozenRow = text.split("\n").find((l) => l.startsWith("| `frozen` |")) ?? "";
same("default frozen", frozenRow.slice(frozenRow.indexOf("default ") + 9).split("`")[0].split(", "), DEFAULT_FROZEN);
const partsLine = text.split("\n").find((l) => l.startsWith("decks/<phase>/parts/")) ?? "";
same("probe file (typescript)", partsLine.split(/\s+/)[0].replace("decks/<phase>/parts/", ""), probeFile(TYPESCRIPT, "<id>"));
same("probe file (go)", (partsLine.match(/Go: (\S+?)\)/) ?? [])[1], probeFile(GO, "<id>"));

for (const b of bad) console.log("refcheck: " + b);
console.log(bad.length === 0 ? "refcheck: ok" : `refcheck: ${bad.length} mismatch(es)`);
process.exit(bad.length === 0 ? 0 : 1);
