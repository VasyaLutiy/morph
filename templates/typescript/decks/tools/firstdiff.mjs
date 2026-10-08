// First-difference locator: reads a vitest log and, for every failed comparison whose two sides vitest printed in full
// ("Expected: ..." / "Received: ..." lines, or a "- Expected" / "+ Received" diff block), prints where the two first
// differ, with 40 chars of context on each side. The assertion line itself is cut at truncateThreshold, so a one-word
// difference deep in a long string would read as two identical sides. `morph plan --checks` inlines this file into
// every acceptance.
//   node firstdiff.mjs <vitest log>
import fs from "node:fs";

const lines = fs.readFileSync(process.argv[2], "utf8").split("\n");
const pairs = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith("Expected: ") && (lines[i + 1] ?? "").startsWith("Received: ")) {
    pairs.push([lines[i].slice(10), lines[i + 1].slice(10)]);
    continue;
  }
  if (lines[i] !== "- Expected" || lines[i + 1] !== "+ Received") continue;
  // the diff block: "  x" both sides, "- x" expected only, "+ x" received only, "" an empty common line;
  // it ends at the source pointer " ❯ ..." or a rule line
  const e = [], r = [];
  let j = i + 3;
  for (; j < lines.length && !lines[j].startsWith(" ❯") && !lines[j].startsWith("⎯"); j++) {
    const l = lines[j];
    if (l.startsWith("-")) e.push(l.slice(2));
    else if (l.startsWith("+")) r.push(l.slice(2));
    else { e.push(l.slice(2)); r.push(l.slice(2)); }
  }
  while (e.length && r.length && e[e.length - 1] === "" && r[r.length - 1] === "") { e.pop(); r.pop(); }
  pairs.push([e.join("\n"), r.join("\n")]);
  i = j;
}
let shown = 0;
for (const [e, r] of pairs) {
  if (e === r || shown >= 6) continue;
  let k = 0;
  while (k < e.length && k < r.length && e[k] === r[k]) k++;
  const line = e.slice(0, k).split("\n").length;
  const at = (s) => JSON.stringify((k > 40 ? "..." : "") + s.slice(Math.max(0, k - 40), k + 40));
  console.log(`first difference at char ${k} (line ${line}) of ${e.length}/${r.length}: expected ${at(e)} received ${at(r)}`);
  shown++;
}
