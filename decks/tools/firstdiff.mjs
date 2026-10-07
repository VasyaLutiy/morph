// MorphV2 first-difference locator: reads a vitest log and, for every failed comparison whose two
// sides vitest printed in full ("Expected: ..." / "Received: ..." or a "- ..." / "+ ..." diff pair),
// prints where the two first differ, with 40 chars of context on each side. The assertion line
// itself is cut at truncateThreshold, so a one-word difference deep in a long string reads as two
// identical sides (P9b, output-directive-judge: three retries on "the file" / "a file").
// Inlined into the acceptances by decks/tools/build.py (from P9c on).
//   node firstdiff.mjs <vitest log>
import fs from "node:fs";

const lines = fs.readFileSync(process.argv[2], "utf8").split("\n");
const pairs = [];
for (let i = 0; i + 1 < lines.length; i++) {
  const a = lines[i], b = lines[i + 1];
  if (a.startsWith("Expected: ") && b.startsWith("Received: ")) pairs.push([a.slice(10), b.slice(10)]);
  else if (a.startsWith("- ") && b.startsWith("+ ") && a !== "- Expected" && b !== "+ Received")
    pairs.push([a.slice(2), b.slice(2)]);
}
let shown = 0;
for (const [e, r] of pairs) {
  if (e === r || shown >= 6) continue;
  let k = 0;
  while (k < e.length && k < r.length && e[k] === r[k]) k++;
  const at = (s) => JSON.stringify((k > 40 ? "..." : "") + s.slice(Math.max(0, k - 40), k + 40));
  console.log(`first difference at char ${k} of ${e.length}/${r.length}: expected ${at(e)} received ${at(r)}`);
  shown++;
}
