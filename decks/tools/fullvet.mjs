// The gate's full-overlay vet of one Go card (P21, issue #12): on the stub tree of a card's stub run, vets the WHOLE
// module under the overlay of the card's own `== full` stage, the one stage a stub run never reaches. Node's standard
// library only; run from the module root.
//   node decks/tools/fullvet.mjs <deck.json> <card-id>
// The overlay is the card acceptance's `$P/full.json` heredoc and the go environment its `export GOFLAGS=…` line, both
// read from the deck. Fails (exit 1, one line each) when a vet line names a Go file outside the card's targets: a file
// the record breaks (a caller outside the subset, or a later card's old file the overlay keeps visible because a file
// outside the subset imports its package) — named here, before any paid run, instead of red in the run's `== full`.
// Exit 0 prints "fullvet: <id> vets clean outside its targets (<n> files hidden)".
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [deckPath, id] = process.argv.slice(2);
if (!deckPath || !id) {
  console.log("usage: node fullvet.mjs <deck.json> <card-id>");
  process.exit(2);
}
const deck = JSON.parse(fs.readFileSync(deckPath, "utf8"));
const card = (Array.isArray(deck) ? deck : deck.cards).find((c) => c.customId === id);
if (!card || typeof card.acceptance !== "string") {
  console.log(`fullvet: no card '${id}' with an acceptance in ${deckPath}`);
  process.exit(2);
}
const full = /cat > \$P\/full\.json <<'MORPH_CONF_EOF'\n([\s\S]*?)\nMORPH_CONF_EOF\n/.exec(card.acceptance);
const env = /^export GOFLAGS=.*$/m.exec(card.acceptance);
if (!full || !env) {
  console.log(`fullvet: '${id}' is not a Go acceptance (no $P/full.json or GOFLAGS line)`);
  process.exit(2);
}
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fullvet-"));
const overlay = path.join(dir, "full.json");
fs.writeFileSync(overlay, full[1] + "\n");
const hidden = Object.keys(JSON.parse(full[1]).Replace ?? {}).length;
let out = "";
try {
  out = execFileSync("sh", ["-c", `${env[0]}\ngo vet -overlay '${overlay}' ./... 2>&1`], { encoding: "utf8" });
} catch (e) {
  out = String(e.stdout ?? "") + String(e.stderr ?? "");
}
fs.rmSync(dir, { recursive: true, force: true });
const targets = card.targets.map((t) => t.replace(/^\.\//, ""));
const SOURCE = /((?:\.{0,2}\/)?[\w.@+-]+(?:\/[\w.@+-]+)*\.go)(?::\d+)/g;
const bad = [];
for (const line of out.split("\n")) {
  for (const m of line.matchAll(SOURCE)) {
    const file = m[1].replace(/^\.\//, "");
    if (!targets.includes(file)) {
      bad.push(`fullvet: ${file} outside the targets of ${id}: ${line.trim()}`);
      break;
    }
  }
  if (/is not in std|no Go files|cannot find package|matched no packages/.test(line) && !bad.some((b) => b.endsWith(line.trim())))
    bad.push(`fullvet: ${id}: ${line.trim()}`);
}
for (const b of bad) console.log(b);
if (bad.length === 0) console.log(`fullvet: ${id} vets clean outside its targets (${hidden} files hidden)`);
process.exit(bad.length ? 1 : 0);
